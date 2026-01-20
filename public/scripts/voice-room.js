import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

const EVENTS = {
  JOIN: "voice:join",
  LEAVE: "voice:leave",
  SIGNAL: "voice:signal",
  USER_JOINED: "voice:user-joined",
  USER_LEFT: "voice:user-left",
  ROOM_USERS: "voice:room-users",
  ERROR: "voice:error"
};

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" }
];

class VoiceRoom {
  constructor() {
    this.socket = null;
    this.socketId = null;
    this.roomId = null;
    this.isJoined = false;
    
    this.localStream = null;
    this.isMicOn = false;
    
    this.peers = new Map();
    
    this.micButton = null;
    this.statusElement = null;
    this.mobileMicButton = null;
    
    // Unlock audio on user interaction
    this.audioUnlocked = false;
    document.addEventListener("click", () => this.unlockAudio(), { once: true });
  }

  unlockAudio() {
    if (this.audioUnlocked) return;
    
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.resume().then(() => {
      this.audioUnlocked = true;
      console.log("[Voice] 🔓 Audio unlocked");
      ctx.close();
    });
  }

  async join(roomId) {
    if (this.isJoined) {
      this.leave();
    }

    this.roomId = roomId;
    await this.connectSocket();
    
    return new Promise((resolve, reject) => {
      this.socket.emit(EVENTS.JOIN, { roomId }, (response) => {
        if (response?.success) {
          this.isJoined = true;
          this.socketId = response.socketId;
          console.log(`[Voice] ✅ Joined room ${roomId} as ${this.socketId}`);
          resolve(response);
        } else {
          reject(response?.error);
        }
      });
    });
  }

  leave() {
    this.stopMic();
    this.closeAllPeers();
    
    if (this.socket?.connected) {
      this.socket.emit(EVENTS.LEAVE);
      this.socket.disconnect();
    }
    
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
      if (!window.isSecureContext) {
        alert("Voice chat requires HTTPS");
        return false;
      }

      console.log("[Voice] Requesting microphone...");
      
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      
      const track = this.localStream.getAudioTracks()[0];
      console.log(`[Voice] ✅ Got microphone: ${track.label}`);
      console.log(`[Voice] Track enabled: ${track.enabled}, muted: ${track.muted}`);
      
      // Add audio track to all existing peers
      this.peers.forEach((peer, peerId) => {
        this.addTrackToPeer(peer.pc, peerId);
      });
      
      this.isMicOn = true;
      this.updateUI();
      
      return true;
      
    } catch (error) {
      console.error("[Voice] ❌ Mic error:", error);
      alert(`Microphone error: ${error.message}`);
      return false;
    }
  }

  stopMic() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    this.isMicOn = false;
    this.updateUI();
    console.log("[Voice] Microphone stopped");
  }

  async connectSocket() {
    return new Promise((resolve, reject) => {
      const username = document.cookie
        .split("; ")
        .find(row => row.startsWith("username="))
        ?.split("=")[1] || "Guest";

      console.log(`[Voice] Connecting as ${username}...`);

      this.socket = io("/voice", {
        auth: { username, lobbyId: this.roomId },
        reconnection: true,
        reconnectionAttempts: 5
      });

      this.socket.on("connect", () => {
        console.log("[Voice] ✅ Socket connected:", this.socket.id);
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        console.error("[Voice] ❌ Connection error:", error.message);
        reject(error);
      });

      this.setupSocketHandlers();

      setTimeout(() => {
        if (!this.socket?.connected) {
          reject(new Error("Connection timeout"));
        }
      }, 10000);
    });
  }

  setupSocketHandlers() {
    this.socket.on(EVENTS.ROOM_USERS, ({ users }) => {
      console.log(`[Voice] Room has ${users.length} existing user(s):`, users.map(u => u.username));
      
      users.forEach(user => {
        this.createPeer(user.socketId, user.username, true);
      });
    });

    this.socket.on(EVENTS.USER_JOINED, ({ socketId, username }) => {
      console.log(`[Voice] 👋 ${username} joined - waiting for their offer`);
    });

    this.socket.on(EVENTS.USER_LEFT, ({ socketId, username }) => {
      console.log(`[Voice] 👋 ${username} left`);
      this.closePeer(socketId);
    });

    this.socket.on(EVENTS.SIGNAL, async ({ senderId, senderName, signal }) => {
      const signalType = signal.type || (signal.candidate ? "ice-candidate" : "unknown");
      console.log(`[Voice] 📨 Signal from ${senderName}: ${signalType}`);
      
      let peer = this.peers.get(senderId);
      
      if (!peer && signal.type === "offer") {
        console.log(`[Voice] Creating peer for incoming offer from ${senderName}`);
        peer = this.createPeer(senderId, senderName, false);
      }
      
      if (!peer) {
        console.warn(`[Voice] No peer found for ${senderName}, ignoring signal`);
        return;
      }
      
      try {
        if (signal.type === "offer") {
          console.log(`[Voice] Setting remote offer from ${senderName}`);
          await peer.pc.setRemoteDescription(new RTCSessionDescription(signal));
          
          console.log(`[Voice] Creating answer for ${senderName}`);
          const answer = await peer.pc.createAnswer();
          await peer.pc.setLocalDescription(answer);
          
          console.log(`[Voice] Sending answer to ${senderName}`);
          this.socket.emit(EVENTS.SIGNAL, {
            targetId: senderId,
            signal: peer.pc.localDescription
          });
          
        } else if (signal.type === "answer") {
          console.log(`[Voice] Setting remote answer from ${senderName}`);
          await peer.pc.setRemoteDescription(new RTCSessionDescription(signal));
          
        } else if (signal.candidate) {
          console.log(`[Voice] Adding ICE candidate from ${senderName}`);
          await peer.pc.addIceCandidate(new RTCIceCandidate(signal));
        }
      } catch (error) {
        console.error(`[Voice] ❌ Signal error:`, error);
      }
    });

    this.socket.on(EVENTS.ERROR, (error) => {
      console.error("[Voice] Server error:", error);
    });
  }

  createPeer(peerId, peerName, initiator) {
    console.log(`[Voice] 🔗 Creating peer to ${peerName} (initiator: ${initiator})`);
    
    this.closePeer(peerId);
    
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peer = { pc, audio: null, name: peerName };
    this.peers.set(peerId, peer);
    
    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`[Voice] 🧊 Sending ICE candidate to ${peerName}`);
        this.socket.emit(EVENTS.SIGNAL, {
          targetId: peerId,
          signal: event.candidate
        });
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log(`[Voice] 🧊 ICE state with ${peerName}: ${pc.iceConnectionState}`);
    };
    
    pc.onconnectionstatechange = () => {
      console.log(`[Voice] 🔌 Connection with ${peerName}: ${pc.connectionState}`);
    };
    
    // IMPORTANT: Handle incoming audio track
    pc.ontrack = (event) => {
      console.log(`[Voice] 🎵 Received track from ${peerName}:`, event.track.kind);
      console.log(`[Voice] Track enabled: ${event.track.enabled}, muted: ${event.track.muted}`);
      console.log(`[Voice] Streams: ${event.streams.length}`);
      
      if (event.track.kind === "audio") {
        const stream = event.streams[0] || new MediaStream([event.track]);
        
        // Create audio element
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.volume = 1.0;
        
        // Try to play
        const playPromise = audio.play();
        
        if (playPromise) {
          playPromise
            .then(() => {
              console.log(`[Voice] 🔊 Playing audio from ${peerName}`);
            })
            .catch(err => {
              console.warn(`[Voice] ⚠️ Autoplay blocked for ${peerName}:`, err.message);
              console.log("[Voice] Click anywhere to enable audio");
              
              // Retry on click
              document.addEventListener("click", () => {
                audio.play().then(() => {
                  console.log(`[Voice] 🔊 Now playing audio from ${peerName}`);
                }).catch(() => {});
              }, { once: true });
            });
        }
        
        peer.audio = audio;
      }
    };
    
    // Add transceiver to receive audio (even if not sending)
    const transceiver = pc.addTransceiver("audio", { 
      direction: this.localStream ? "sendrecv" : "recvonly" 
    });
    console.log(`[Voice] Added transceiver: ${transceiver.direction}`);
    
    // Add our audio track if we have it
    if (this.localStream) {
      this.addTrackToPeer(pc, peerId);
    }
    
    // If initiator, create offer
    if (initiator) {
      this.createAndSendOffer(pc, peerId, peerName);
    }
    
    return peer;
  }

  async createAndSendOffer(pc, peerId, peerName) {
    try {
      console.log(`[Voice] Creating offer for ${peerName}...`);
      const offer = await pc.createOffer();
      
      console.log(`[Voice] Setting local description for ${peerName}...`);
      await pc.setLocalDescription(offer);
      
      console.log(`[Voice] 📤 Sending offer to ${peerName}`);
      this.socket.emit(EVENTS.SIGNAL, {
        targetId: peerId,
        signal: pc.localDescription
      });
    } catch (error) {
      console.error(`[Voice] ❌ Offer error for ${peerName}:`, error);
    }
  }

  addTrackToPeer(pc, peerId) {
    if (!this.localStream) return;
    
    const track = this.localStream.getAudioTracks()[0];
    if (!track) return;
    
    // Get existing transceiver
    const transceivers = pc.getTransceivers();
    const audioTransceiver = transceivers.find(t => 
      t.receiver.track?.kind === "audio" || t.sender.track?.kind === "audio"
    );
    
    if (audioTransceiver) {
      // Update direction to sendrecv if it was recvonly
      if (audioTransceiver.direction === "recvonly") {
        console.log(`[Voice] Changing transceiver to sendrecv for ${peerId.slice(0, 8)}`);
        audioTransceiver.direction = "sendrecv";
      }
      
      // Replace the track
      console.log(`[Voice] Replacing track for peer ${peerId.slice(0, 8)}`);
      audioTransceiver.sender.replaceTrack(track).then(() => {
        // Need to renegotiate after changing direction
        this.renegotiate(pc, peerId);
      }).catch(err => {
        console.error("[Voice] Replace track error:", err);
      });
    } else {
      console.log(`[Voice] Adding new track for peer ${peerId.slice(0, 8)}`);
      pc.addTrack(track, this.localStream);
      this.renegotiate(pc, peerId);
    }
  }

  async renegotiate(pc, peerId) {
    try {
      console.log(`[Voice] 🔄 Renegotiating with ${peerId.slice(0, 8)}...`);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      this.socket.emit(EVENTS.SIGNAL, {
        targetId: peerId,
        signal: pc.localDescription
      });
      console.log(`[Voice] 📤 Sent renegotiation offer`);
    } catch (err) {
      console.error("[Voice] Renegotiation error:", err);
    }
  }

  closePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    
    if (peer.audio) {
      peer.audio.pause();
      peer.audio.srcObject = null;
    }
    
    peer.pc.close();
    this.peers.delete(peerId);
    
    console.log(`[Voice] Closed peer ${peerId.slice(0, 8)}`);
  }

  closeAllPeers() {
    this.peers.forEach((_, peerId) => this.closePeer(peerId));
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

  updateUI() {
    this.micButton?.classList.toggle("active", this.isMicOn);
    this.mobileMicButton?.classList.toggle("active", this.isMicOn);
    
    if (this.statusElement) {
      this.statusElement.textContent = this.isMicOn ? "MIC ON" : "MIC OFF";
    }
  }

  // Debug helper
  debug() {
    console.log("=== VOICE DEBUG ===");
    console.log("Joined:", this.isJoined);
    console.log("Room:", this.roomId);
    console.log("Socket ID:", this.socketId);
    console.log("Socket connected:", this.socket?.connected);
    console.log("Mic on:", this.isMicOn);
    console.log("Local stream:", this.localStream?.active);
    console.log("Audio unlocked:", this.audioUnlocked);
    console.log("Peers:", this.peers.size);
    
    this.peers.forEach((peer, id) => {
      console.log(`  Peer ${id.slice(0, 8)} (${peer.name}):`);
      console.log(`    Connection: ${peer.pc.connectionState}`);
      console.log(`    ICE: ${peer.pc.iceConnectionState}`);
      console.log(`    Has audio element: ${!!peer.audio}`);
      if (peer.audio) {
        console.log(`    Audio paused: ${peer.audio.paused}`);
        console.log(`    Audio muted: ${peer.audio.muted}`);
        console.log(`    Audio volume: ${peer.audio.volume}`);
      }
      console.log(`    Senders:`, peer.pc.getSenders().map(s => s.track?.kind || "empty"));
      console.log(`    Receivers:`, peer.pc.getReceivers().map(r => r.track?.kind || "empty"));
    });
    console.log("===================");
  }

  getStatus() {
    return {
      joined: this.isJoined,
      room: this.roomId,
      micOn: this.isMicOn,
      connected: this.socket?.connected,
      audioUnlocked: this.audioUnlocked,
      peerCount: this.peers.size
    };
  }

  async testMic() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("[Voice] ✅ Mic test passed:", stream.getAudioTracks()[0].label);
      stream.getTracks().forEach(t => t.stop());
      return true;
    } catch (err) {
      console.error("[Voice] ❌ Mic test failed:", err.message);
      return false;
    }
  }

  testSpeaker() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.frequency.value = 440;
    osc.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, 500);
    console.log("[Voice] ✅ Speaker test - you should hear a beep");
    return true;
  }

  // Force play all audio elements (call after clicking on page)
  forcePlay() {
    console.log("[Voice] Force playing all audio...");
    this.peers.forEach((peer, id) => {
      if (peer.audio) {
        peer.audio.play()
          .then(() => console.log(`[Voice] ✅ Playing ${peer.name}`))
          .catch(e => console.error(`[Voice] ❌ Can't play ${peer.name}:`, e.message));
      }
    });
  }
}

export const voiceRoom = new VoiceRoom();
window.voiceRoom = voiceRoom;
