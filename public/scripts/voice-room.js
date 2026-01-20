import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const EVENTS = {
  JOIN: "voice:join",
  LEAVE: "voice:leave",
  OFFER: "voice:offer",
  ANSWER: "voice:answer",
  ICE_CANDIDATE: "voice:ice",
  USER_JOINED: "voice:user-joined",
  USER_LEFT: "voice:user-left",
  ROOM_USERS: "voice:room-users",
  ERROR: "voice:error"
};

const RTC_CONFIG = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
};

const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  },
  video: false
};

class VoiceRoom {
  constructor() {
    this.socket = null;
    this.socketId = null;
    
    this.roomId = null;
    this.isJoined = false;
    
    this.localStream = null;
    this.isMicOn = false;
    
    this.peers = new Map();
    
    this.audioElements = new Map();
    
    this.pendingCandidates = new Map();
    
    this.audioUnlocked = false;
    
    this.micButton = null;
    this.statusElement = null;
    
    this.setupAudioUnlock();
  }

  async join(roomId) {
    if (this.isJoined) {
      console.log("[Voice] Already in a room, leaving first...");
      this.leave();
    }

    this.roomId = roomId;
    
    await this.connectSocket();
    
    return new Promise((resolve, reject) => {
      this.socket.emit(EVENTS.JOIN, { roomId }, (response) => {
        if (response?.success) {
          this.isJoined = true;
          this.socketId = response.socketId;
          console.log(`[Voice] Joined room ${roomId} as ${this.socketId}`);
          resolve(response);
        } else {
          console.error("[Voice] Failed to join room:", response?.error);
          reject(response?.error);
        }
      });
    });
  }

  leave() {
    console.log("[Voice] Leaving room...");
    
    this.stopMic();
    
    this.peers.forEach((pc, peerId) => {
      this.closePeer(peerId);
    });
    this.peers.clear();
    this.audioElements.clear();
    this.pendingCandidates.clear();
    
    if (this.socket?.connected) {
      this.socket.emit(EVENTS.LEAVE);
    }
    
    this.socket?.disconnect();
    this.socket = null;
    
    this.isJoined = false;
    this.roomId = null;
    this.socketId = null;
    
    console.log("[Voice] Left room");
  }

  async toggleMic() {
    if (this.isMicOn) {
      this.stopMic();
    } else {
      await this.startMic();
    }
    return this.isMicOn;
  }

  async startMic() {
    try {
      if (!this.checkRequirements()) {
        return false;
      }

      console.log("[Voice] Starting microphone...");
      
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }
      
      let stream = null;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (!stream && attempts < maxAttempts) {
        attempts++;
        try {
          console.log(`[Voice] Requesting microphone (attempt ${attempts}/${maxAttempts})...`);
          stream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
        } catch (err) {
          console.warn(`[Voice] Mic attempt ${attempts} failed:`, err.name);
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            throw err;
          }
        }
      }
      
      this.localStream = stream;
      
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No audio tracks received from microphone");
      }
      
      console.log("[Voice] Got local stream with tracks:", audioTracks.map(t => t.label));
      
      audioTracks.forEach(track => {
        console.log(`[Voice] Track: ${track.label}, enabled: ${track.enabled}, muted: ${track.muted}, readyState: ${track.readyState}`);
        
        track.onended = () => console.log("[Voice] Local track ended");
        track.onmute = () => console.log("[Voice] Local track muted");
        track.onunmute = () => console.log("[Voice] Local track unmuted");
      });
      
      console.log(`[Voice] Adding tracks to ${this.peers.size} peer(s)...`);
      this.peers.forEach((pc, peerId) => {
        this.addLocalTracksToPeer(pc, peerId);
      });
      
      this.isMicOn = true;
      this.updateUI();
      
      console.log("[Voice] ✅ Microphone started successfully");
      return true;
      
    } catch (error) {
      console.error("[Voice] ❌ Failed to start microphone:", error);
      this.handleMicError(error);
      return false;
    }
  }

  stopMic() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }
    
    this.peers.forEach((pc) => {
      pc.getSenders().forEach(sender => {
        if (sender.track?.kind === "audio") {
          sender.replaceTrack(null).catch(err => {
            console.warn("[Voice] Failed to stop offering track:", err);
          });
        }
      });
      
      if (typeof pc.getTransceivers === "function") {
        pc.getTransceivers().forEach(transceiver => {
          if (transceiver.receiver?.track?.kind === "audio") {
            try {
              transceiver.direction = "recvonly";
            } catch (err) {
              console.warn("[Voice] Failed to set recvonly:", err);
            }
          }
        });
      }
    });
    
    this.isMicOn = false;
    this.updateUI();
    
    console.log("[Voice] Microphone stopped");
  }

  bindUI(micButtonId, statusElementSelector) {
    this.micButton = document.getElementById(micButtonId);
    this.statusElement = document.querySelector(statusElementSelector);
    this.mobileMicButton = document.getElementById("mobile-voice-toggle");
    
    if (this.micButton) {
      this.micButton.addEventListener("click", () => this.toggleMic());
    }
    
    if (this.mobileMicButton) {
      this.mobileMicButton.addEventListener("click", () => this.toggleMic());
    }
  }

  async connectSocket() {
    return new Promise((resolve, reject) => {
      const username = document.cookie
        .split("; ")
        .find(row => row.startsWith("username="))
        ?.split("=")[1] || "Guest";

      this.socket = io("/voice", {
        auth: { username, lobbyId: this.roomId },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.socket.on("connect", () => {
        console.log("[Voice] Socket connected:", this.socket.id);
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        console.error("[Voice] Socket connection error:", error.message);
        reject(error);
      });

      this.socket.on("disconnect", (reason) => {
        console.log("[Voice] Socket disconnected:", reason);
      });

      this.setupSocketHandlers();

      setTimeout(() => {
        if (!this.socket.connected) {
          reject(new Error("Connection timeout"));
        }
      }, 10000);
    });
  }

  setupSocketHandlers() {
    this.socket.on(EVENTS.ROOM_USERS, async ({ users }) => {
      console.log("[Voice] Room users:", users.length);
      
      for (const user of users) {
        await this.createPeerConnection(user.socketId, true);
      }
    });

    this.socket.on(EVENTS.USER_JOINED, async ({ socketId, username }) => {
      console.log(`[Voice] User joined: ${username} (${socketId})`);
    });

    this.socket.on(EVENTS.USER_LEFT, ({ socketId, username }) => {
      console.log(`[Voice] User left: ${username} (${socketId})`);
      this.closePeer(socketId);
    });

    this.socket.on(EVENTS.OFFER, async ({ senderId, senderName, offer }) => {
      console.log(`[Voice] Received offer from ${senderName} (${senderId})`);
      
      try {
        let pc = this.peers.get(senderId);
        
        if (!pc) {
          pc = await this.createPeerConnection(senderId, false);
        }
        
        const isCollision = pc.signalingState !== "stable";
        if (isCollision) {
          console.log(`[Voice] Offer collision detected, rolling back...`);
          await Promise.all([
            pc.setLocalDescription({ type: "rollback" }),
            pc.setRemoteDescription(new RTCSessionDescription(offer))
          ]);
        } else {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
        }
        
        if (this.localStream) {
          this.addLocalTracksToPeer(pc, senderId);
        }
        
        await this.flushPendingCandidates(senderId);
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        this.socket.emit(EVENTS.ANSWER, {
          targetId: senderId,
          answer: pc.localDescription
        });
        
        console.log(`[Voice] ✅ Sent answer to ${senderName}`);
        
      } catch (error) {
        console.error("[Voice] Error handling offer:", error);
      }
    });

    this.socket.on(EVENTS.ANSWER, async ({ senderId, answer }) => {
      console.log(`[Voice] Received answer from ${senderId}`);
      
      const pc = this.peers.get(senderId);
      if (pc && pc.signalingState === "have-local-offer") {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await this.flushPendingCandidates(senderId);
        } catch (error) {
          console.error("[Voice] Error setting answer:", error);
        }
      }
    });

    this.socket.on(EVENTS.ICE_CANDIDATE, async ({ senderId, candidate }) => {
      if (!candidate) return;
      
      const pc = this.peers.get(senderId);
      
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("[Voice] Error adding ICE candidate:", error);
        }
      } else {
        if (!this.pendingCandidates.has(senderId)) {
          this.pendingCandidates.set(senderId, []);
        }
        this.pendingCandidates.get(senderId).push(candidate);
      }
    });

    this.socket.on(EVENTS.ERROR, (error) => {
      console.error("[Voice] Server error:", error);
    });
  }

  async createPeerConnection(peerId, initiator) {
    if (this.peers.has(peerId)) {
      this.closePeer(peerId);
    }

    console.log(`[Voice] Creating peer connection to ${peerId} (initiator: ${initiator})`);
    
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peers.set(peerId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit(EVENTS.ICE_CANDIDATE, {
          targetId: peerId,
          candidate: event.candidate
        });
      }
    };

    pc.onnegotiationneeded = async () => {
      console.log(`[Voice] Negotiation needed for ${peerId}`);
      
      try {
        if (pc.signalingState === "stable") {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          
          this.socket.emit(EVENTS.OFFER, {
            targetId: peerId,
            offer: pc.localDescription
          });
          
          console.log(`[Voice] Sent renegotiation offer to ${peerId}`);
        }
      } catch (error) {
        console.error("[Voice] Renegotiation error:", error);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[Voice] ICE state [${peerId}]: ${pc.iceConnectionState}`);
      
      if (pc.iceConnectionState === "connected") {
        console.log(`[Voice] ✅ Connected to ${peerId}`);
      } else if (pc.iceConnectionState === "failed") {
        console.log(`[Voice] Connection failed to ${peerId}, restarting ICE...`);
        pc.restartIce();
      } else if (pc.iceConnectionState === "disconnected") {
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") {
            console.log(`[Voice] Connection to ${peerId} lost`);
            this.closePeer(peerId);
          }
        }, 5000);
      }
    };

    pc.ontrack = (event) => {
      console.log(`[Voice] ======================================`);
      console.log(`[Voice] RECEIVED TRACK from ${peerId}`);
      console.log(`[Voice] Track kind:`, event.track?.kind);
      console.log(`[Voice] Track enabled:`, event.track?.enabled);
      console.log(`[Voice] Track muted:`, event.track?.muted);
      console.log(`[Voice] Track readyState:`, event.track?.readyState);
      console.log(`[Voice] Streams count:`, event.streams?.length);
      console.log(`[Voice] ======================================`);
      this.handleRemoteTrack(peerId, event);
    };
    
    this.ensureAudioTransceiver(pc);

    if (this.localStream) {
      this.addLocalTracksToPeer(pc, peerId);
    }

    if (initiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        this.socket.emit(EVENTS.OFFER, {
          targetId: peerId,
          offer: pc.localDescription
        });
        
        console.log(`[Voice] Sent offer to ${peerId}`);
      } catch (error) {
        console.error("[Voice] Error creating offer:", error);
      }
    }

    return pc;
  }

  addLocalTracksToPeer(pc, peerId) {
    if (!this.localStream) {
      console.log(`[Voice] No local stream to add to ${peerId}`);
      return;
    }
    
    const tracks = this.localStream.getAudioTracks();
    if (tracks.length === 0) {
      console.log(`[Voice] No audio tracks to add to ${peerId}`);
      return;
    }
    
    console.log(`[Voice] Adding ${tracks.length} audio track(s) to peer ${peerId}`);
    
    tracks.forEach(track => {
      const senders = pc.getSenders();
      const existingSender = senders.find(s => s.track?.kind === "audio");
      
      if (existingSender) {
        if (existingSender.track === track) {
          console.log(`[Voice] Track already added to ${peerId}`);
          return;
        }
        
        existingSender.replaceTrack(track)
          .then(() => console.log(`[Voice] Replaced track for ${peerId}`))
          .catch(err => console.error(`[Voice] Failed to replace track:`, err));
        return;
      }
      
      const transceiver = this.ensureAudioTransceiver(pc);
      if (transceiver?.sender) {
        try {
          if (transceiver.direction !== "sendrecv") {
            transceiver.direction = "sendrecv";
          }
        } catch (err) {
          console.warn("[Voice] Failed to set sendrecv:", err);
        }
        
        transceiver.sender.replaceTrack(track)
          .then(() => console.log(`[Voice] Reused transceiver for ${peerId}`))
          .catch(err => console.error(`[Voice] Failed to reuse transceiver:`, err));
        return;
      }
      
      try {
        pc.addTrack(track, this.localStream);
        console.log(`[Voice] ✅ Added track to ${peerId}`);
      } catch (err) {
        console.error(`[Voice] Failed to add track to ${peerId}:`, err);
      }
    });
    
    const currentSenders = pc.getSenders();
    console.log(`[Voice] Peer ${peerId} now has ${currentSenders.length} sender(s)`);
  }

  handleRemoteTrack(peerId, event) {
    const stream = event.streams?.[0] || (event.track ? new MediaStream([event.track]) : null);
    
    if (!stream) {
      console.warn("[Voice] No stream in track event");
      return;
    }

    const existingAudio = this.audioElements.get(peerId);
    if (existingAudio) {
      existingAudio.pause();
      existingAudio.srcObject = null;
      existingAudio.remove();
    }

    const audio = document.createElement("audio");
    audio.id = `voice-audio-${peerId}`;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.setAttribute("playsinline", "true");
    audio.muted = false;
    audio.volume = 1.0;
    audio.srcObject = stream;
    audio.style.display = "none";
    
    document.body.appendChild(audio);
    this.audioElements.set(peerId, audio);

    this.tryPlayAudio(audio);
  }

  ensureAudioTransceiver(pc) {
    if (typeof pc.addTransceiver !== "function") {
      return null;
    }
    
    const existing = this.getAudioTransceiver(pc);
    if (existing) {
      return existing;
    }
    
    try {
      const direction = this.localStream ? "sendrecv" : "recvonly";
      return pc.addTransceiver("audio", { direction });
    } catch (error) {
      console.warn("[Voice] Failed to add audio transceiver:", error);
      return null;
    }
  }

  getAudioTransceiver(pc) {
    if (typeof pc.getTransceivers !== "function") {
      return null;
    }
    
    return pc.getTransceivers().find(transceiver => {
      const senderKind = transceiver.sender?.track?.kind;
      const receiverKind = transceiver.receiver?.track?.kind;
      return senderKind === "audio" || receiverKind === "audio";
    }) || null;
  }

  async tryPlayAudio(audio) {
    try {
      await audio.play();
      console.log("[Voice] ✅ Audio playing");
    } catch (error) {
      if (error.name === "NotAllowedError") {
        console.warn("[Voice] Audio autoplay blocked - will play on user interaction");
      } else {
        console.error("[Voice] Audio play error:", error);
      }
    }
  }

  async flushPendingCandidates(peerId) {
    const candidates = this.pendingCandidates.get(peerId);
    const pc = this.peers.get(peerId);
    
    if (candidates && pc) {
      console.log(`[Voice] Flushing ${candidates.length} candidates for ${peerId}`);
      
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("[Voice] Error adding buffered candidate:", error);
        }
      }
      
      this.pendingCandidates.delete(peerId);
    }
  }

  closePeer(peerId) {
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    
    const audio = this.audioElements.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.audioElements.delete(peerId);
    }
    
    this.pendingCandidates.delete(peerId);
    
    console.log(`[Voice] Closed peer ${peerId}`);
  }

  setupAudioUnlock() {
    const unlock = async () => {
      if (this.audioUnlocked) return;
      
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.01);
        
        this.audioUnlocked = true;
        console.log("[Voice] Audio unlocked");
        
        this.audioElements.forEach(audio => {
          audio.play().catch(() => {});
        });
        
      } catch (error) {
        console.error("[Voice] Audio unlock failed:", error);
      }
    };

    ["click", "touchstart", "touchend", "keydown"].forEach(event => {
      document.addEventListener(event, unlock, { passive: true });
    });
  }

  checkRequirements() {
    if (!window.isSecureContext) {
      console.error("[Voice] HTTPS required for microphone access");
      alert("Voice chat requires HTTPS. Please use a secure connection.");
      return false;
    }
    
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("[Voice] getUserMedia not supported");
      alert("Your browser doesn't support voice chat.");
      return false;
    }
    
    return true;
  }

  handleMicError(error) {
    let message;
    
    switch (error.name) {
      case "NotAllowedError":
        message = "Microphone access denied. Please allow microphone access in your browser settings.";
        break;
      case "NotFoundError":
        message = "No microphone found. Please connect a microphone.";
        break;
      case "NotReadableError":
        message = "Microphone is in use by another application.";
        break;
      default:
        message = `Microphone error: ${error.message}`;
    }
    
    console.error("[Voice]", message);
    alert(message);
  }

  updateUI() {
    if (this.micButton) {
      this.micButton.classList.toggle("active", this.isMicOn);
    }
    
    if (this.mobileMicButton) {
      this.mobileMicButton.classList.toggle("active", this.isMicOn);
    }
    
    if (this.statusElement) {
      this.statusElement.textContent = this.isMicOn ? "MIC ON" : "MIC OFF";
    }
  }

  getStatus() {
    const status = {
      isJoined: this.isJoined,
      roomId: this.roomId,
      socketId: this.socketId,
      socketConnected: this.socket?.connected || false,
      isMicOn: this.isMicOn,
      localStreamActive: this.localStream?.active || false,
      localTracks: this.localStream?.getTracks().map(t => ({
        kind: t.kind,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState
      })) || [],
      peerCount: this.peers.size,
      peers: Array.from(this.peers.entries()).map(([id, pc]) => ({
        id: id.substring(0, 8) + "...",
        iceConnectionState: pc.iceConnectionState,
        connectionState: pc.connectionState,
        signalingState: pc.signalingState,
        localTracks: pc.getSenders().map(s => s.track?.kind || "none"),
        remoteTracks: pc.getReceivers().map(r => ({
          kind: r.track?.kind,
          enabled: r.track?.enabled,
          muted: r.track?.muted,
          readyState: r.track?.readyState
        }))
      })),
      audioElementCount: this.audioElements.size,
      audioElements: Array.from(this.audioElements.entries()).map(([id, audio]) => ({
        id: id.substring(0, 8) + "...",
        paused: audio.paused,
        muted: audio.muted,
        volume: audio.volume,
        readyState: audio.readyState,
        hasSrcObject: !!audio.srcObject
      })),
      audioUnlocked: this.audioUnlocked
    };
    
    console.log("[Voice] Status:", JSON.stringify(status, null, 2));
    return status;
  }

  forcePlayAudio() {
    console.log("[Voice] Force playing all audio elements...");
    this.audioElements.forEach((audio, peerId) => {
      console.log(`[Voice] Trying to play audio for ${peerId}`);
      audio.muted = false;
      audio.volume = 1.0;
      audio.play()
        .then(() => console.log(`[Voice] ✅ Playing audio for ${peerId}`))
        .catch(err => console.error(`[Voice] ❌ Failed to play audio for ${peerId}:`, err));
    });
  }

  async testSpeaker() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      
      oscillator.type = "sine";
      oscillator.frequency.value = 440;
      gain.gain.value = 0.3;
      
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
        ctx.close();
      }, 500);
      
      console.log("[Voice] ✅ Speaker test - you should hear a beep");
      return true;
    } catch (err) {
      console.error("[Voice] ❌ Speaker test failed:", err);
      return false;
    }
  }
}

export const voiceRoom = new VoiceRoom();

window.voiceRoom = voiceRoom;
