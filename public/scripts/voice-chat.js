import { socketClient, EVENTS } from "./socket-client.js";

class VoiceChat {
  #localStream = null;
  #peerConnections = new Map();
  #audioElements = new Map();
  #pendingCandidates = new Map(); // Buffer ICE candidates until connection is ready
  #isMicOn = false;
  #isListening = false;
  #toggleButton = null;
  #statusElement = null;
  #mySocketId = null;

  constructor() {
    this.#toggleButton = document.getElementById("voice-toggle");
    this.#statusElement = document.querySelector(".voice-status");
    
    if (this.#toggleButton) {
      this.#toggleButton.addEventListener("click", () => this.toggleMic());
    }

    this.#setupSocketListeners();
  }

  async joinVoiceRoom() {
    if (this.#isListening) return;
    
    this.#isListening = true;
    socketClient.voice.emit(EVENTS.VOICE_JOIN, {}, (response) => {
      if (response?.socketId) {
        this.#mySocketId = response.socketId;
      }
    });
  }

  #setupSocketListeners() {
    socketClient.voice.on(EVENTS.VOICE_OFFER, async ({ from, offer }) => {
      console.log("Received offer from:", from);
      try {
        const pc = this.#getOrCreatePeerConnection(from);
        
        // "Polite peer" pattern - handle offer collision
        const offerCollision = pc.signalingState !== "stable";
        
        // We're "polite" if our ID is smaller (we yield to larger IDs)
        const isPolite = !this.#mySocketId || this.#mySocketId < from;
        
        if (offerCollision) {
          if (!isPolite) {
            // We're impolite - ignore their offer, they'll accept our answer
            console.log("Ignoring offer - we're impolite and have pending offer");
            return;
          }
          // We're polite - rollback our offer and accept theirs
          console.log("Rolling back our offer - we're polite");
          await pc.setLocalDescription({ type: "rollback" });
        }
        
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Flush any pending ICE candidates
        await this.#flushPendingCandidates(from);
        
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketClient.voice.emit(EVENTS.VOICE_ANSWER, { to: from, answer });
      } catch (err) {
        console.error("Error handling voice offer:", err);
      }
    });

    socketClient.voice.on(EVENTS.VOICE_ANSWER, async ({ from, answer }) => {
      console.log("Received answer from:", from);
      const pc = this.#peerConnections.get(from);
      if (pc && pc.signalingState === "have-local-offer") {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          // Flush any pending ICE candidates
          await this.#flushPendingCandidates(from);
        } catch (err) {
          console.error("Error setting remote description:", err);
        }
      }
    });

    socketClient.voice.on(EVENTS.VOICE_ICE_CANDIDATE, async ({ from, candidate }) => {
      if (!candidate) return;
      
      const pc = this.#peerConnections.get(from);
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        // Connection is ready, add candidate directly
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      } else {
        // Buffer candidate until connection is ready
        console.log("Buffering ICE candidate from:", from);
        if (!this.#pendingCandidates.has(from)) {
          this.#pendingCandidates.set(from, []);
        }
        this.#pendingCandidates.get(from).push(candidate);
      }
    });

    socketClient.voice.on(EVENTS.VOICE_USER_JOINED, async ({ oderId }) => {
      console.log("User joined voice:", oderId);
      // Only initiate if our ID is "greater" to prevent both sides sending offers
      if (this.#shouldInitiate(oderId)) {
        await this.#initiateConnection(oderId);
      }
    });

    socketClient.voice.on(EVENTS.VOICE_USER_LEFT, ({ oderId }) => {
      console.log("User left voice:", oderId);
      this.#cleanupPeer(oderId);
    });

    socketClient.voice.on(EVENTS.VOICE_ROOM_USERS, async ({ users }) => {
      console.log("Room users:", users);
      for (const oderId of users) {
        // For existing users, always initiate (we're the new joiner)
        await this.#initiateConnection(oderId);
      }
    });

    socketClient.voice.onReconnect(() => {
      console.log("Voice socket reconnected");
      if (this.#isListening) {
        // Clear old connections on reconnect
        this.#peerConnections.forEach((_, peerId) => this.#cleanupPeer(peerId));
        socketClient.voice.emit(EVENTS.VOICE_JOIN);
      }
    });
  }

  #shouldInitiate(peerId) {
    // Simple tiebreaker: compare socket IDs
    // If we don't know our ID, initiate anyway (fallback)
    if (!this.#mySocketId) return true;
    return this.#mySocketId > peerId;
  }

  async #flushPendingCandidates(peerId) {
    const candidates = this.#pendingCandidates.get(peerId) || [];
    const pc = this.#peerConnections.get(peerId);
    
    if (pc && candidates.length > 0) {
      console.log(`Flushing ${candidates.length} pending candidates for:`, peerId);
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding buffered ICE candidate:", err);
        }
      }
      this.#pendingCandidates.delete(peerId);
    }
  }

  #cleanupPeer(peerId) {
    const pc = this.#peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.#peerConnections.delete(peerId);
    }
    
    const audio = this.#audioElements.get(peerId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      this.#audioElements.delete(peerId);
    }
    
    this.#pendingCandidates.delete(peerId);
  }

  #getOrCreatePeerConnection(peerId) {
    if (this.#peerConnections.has(peerId)) {
      return this.#peerConnections.get(peerId);
    }
    return this.#createPeerConnection(peerId);
  }

  #createPeerConnection(peerId) {
    if (this.#peerConnections.has(peerId)) {
      this.#cleanupPeer(peerId);
    }

    const config = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        {
          urls: "turn:openrelay.metered.ca:80",
          username: "openrelayproject",
          credential: "openrelayproject"
        },
        {
          urls: "turn:openrelay.metered.ca:443",
          username: "openrelayproject",
          credential: "openrelayproject"
        },
        {
          urls: "turn:openrelay.metered.ca:443?transport=tcp",
          username: "openrelayproject",
          credential: "openrelayproject"
        }
      ],
      iceCandidatePoolSize: 10
    };

    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketClient.voice.emit(EVENTS.VOICE_ICE_CANDIDATE, {
          to: peerId,
          candidate: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state [${peerId}]:`, pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        console.error("ICE connection failed, attempting restart");
        pc.restartIce();
      } else if (pc.iceConnectionState === "disconnected") {
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") {
            this.#cleanupPeer(peerId);
          }
        }, 5000);
      } else if (pc.iceConnectionState === "connected") {
        console.log("✅ Voice connected to:", peerId);
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log(`ICE gathering state [${peerId}]:`, pc.iceGatheringState);
    };

    pc.onnegotiationneeded = async () => {
      console.log("Negotiation needed for:", peerId);
      // Always renegotiate when tracks change (no tie-breaker here)
      try {
        const offer = await pc.createOffer();
        if (pc.signalingState === "stable") {
          await pc.setLocalDescription(offer);
          socketClient.voice.emit(EVENTS.VOICE_OFFER, { to: peerId, offer });
        }
      } catch (err) {
        console.error("Error during negotiation:", err);
      }
    };

    pc.ontrack = (event) => {
      console.log("Received track from:", peerId);
      const existingAudio = this.#audioElements.get(peerId);
      if (existingAudio) {
        existingAudio.srcObject = null;
        existingAudio.remove();
      }
      
      const audio = document.createElement("audio");
      audio.id = `audio-${peerId}`;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.srcObject = event.streams[0];
      
      document.body.appendChild(audio);
      this.#audioElements.set(peerId, audio);
      
      audio.play().catch((err) => {
        console.warn("Audio autoplay blocked:", err);
      });
    };

    if (this.#localStream) {
      this.#localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.#localStream);
      });
    }

    this.#peerConnections.set(peerId, pc);
    return pc;
  }

  async #initiateConnection(peerId) {
    try {
      console.log("Initiating connection to:", peerId);
      const pc = this.#createPeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketClient.voice.emit(EVENTS.VOICE_OFFER, { to: peerId, offer });
    } catch (err) {
      console.error("Error initiating connection:", err);
    }
  }

  async toggleMic() {
    if (this.#isMicOn) {
      await this.stopMic();
    } else {
      await this.startMic();
    }
  }

  async startMic() {
    try {
      this.#localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      this.#peerConnections.forEach((pc) => {
        this.#localStream.getTracks().forEach(track => {
          // Check if track already added
          const senders = pc.getSenders();
          const hasTrack = senders.some(s => s.track === track);
          if (!hasTrack) {
            pc.addTrack(track, this.#localStream);
          }
        });
      });

      this.#isMicOn = true;
      this.#toggleButton?.classList.add("active");
      if (this.#statusElement) {
        this.#statusElement.textContent = "MIC ON";
      }

      socketClient.voice.emit(EVENTS.VOICE_MIC_ON);
    } catch (error) {
      console.error("Failed to start mic:", error);
      if (this.#statusElement) {
        this.#statusElement.textContent = "ERROR";
      }
    }
  }

  async stopMic() {
    if (this.#localStream) {
      this.#localStream.getTracks().forEach(track => track.stop());
      this.#localStream = null;
    }

    this.#peerConnections.forEach((pc) => {
      const senders = pc.getSenders();
      senders.forEach(sender => {
        if (sender.track) {
          pc.removeTrack(sender);
        }
      });
    });

    this.#isMicOn = false;
    this.#toggleButton?.classList.remove("active");
    if (this.#statusElement) {
      this.#statusElement.textContent = "MIC OFF";
    }

    socketClient.voice.emit(EVENTS.VOICE_MIC_OFF);
  }

  leave() {
    this.stopMic();
    
    this.#peerConnections.forEach((_, peerId) => {
      this.#cleanupPeer(peerId);
    });
    this.#peerConnections.clear();
    this.#audioElements.clear();
    this.#pendingCandidates.clear();

    this.#isListening = false;
    socketClient.voice.emit(EVENTS.VOICE_LEAVE);
  }
}

export const voiceChat = new VoiceChat();
