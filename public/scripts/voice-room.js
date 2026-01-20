/**
 * VoiceRoom - Client-side voice communication for multiplayer games
 * 
 * This module provides real-time voice chat between players in the same game.
 * It uses WebRTC for peer-to-peer audio streaming and Socket.IO for signaling.
 * 
 * Key Features:
 * - Auto-joins voice room when game starts
 * - Mesh topology: each player connects directly to every other player
 * - Works on Android, iOS, Windows, macOS
 * - Handles browser audio policies automatically
 * 
 * Usage:
 *   import { voiceRoom } from './voice-room.js';
 *   
 *   // When game starts
 *   await voiceRoom.join(gameId);
 *   
 *   // Toggle microphone
 *   await voiceRoom.toggleMic();
 *   
 *   // When game ends
 *   voiceRoom.leave();
 */

import { io } from "https://cdn.socket.io/4.7.2/socket.io.esm.min.js";

// ============================================================================
// CONSTANTS
// ============================================================================

// Voice events matching server-side events
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

// WebRTC configuration with STUN/TURN servers for NAT traversal
const RTC_CONFIG = {
  iceServers: [
    // Google's free STUN servers
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    // Free TURN servers (for when STUN doesn't work)
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

// Audio constraints for getUserMedia
const AUDIO_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  },
  video: false
};

// ============================================================================
// VOICE ROOM CLASS
// ============================================================================

class VoiceRoom {
  constructor() {
    // Socket.IO connection
    this.socket = null;
    this.socketId = null;
    
    // Current room state
    this.roomId = null;
    this.isJoined = false;
    
    // Local audio
    this.localStream = null;
    this.isMicOn = false;
    
    // Peer connections: Map<peerId, RTCPeerConnection>
    this.peers = new Map();
    
    // Audio elements: Map<peerId, HTMLAudioElement>
    this.audioElements = new Map();
    
    // Buffered ICE candidates (received before connection ready)
    this.pendingCandidates = new Map();
    
    // Audio unlock state (for mobile browsers)
    this.audioUnlocked = false;
    
    // UI elements
    this.micButton = null;
    this.statusElement = null;
    
    // Set up audio unlock listener
    this.setupAudioUnlock();
  }

  // ==========================================================================
  // PUBLIC API
  // ==========================================================================

  /**
   * Join a voice room (call when game starts)
   * @param {string} roomId - The game/lobby ID
   */
  async join(roomId) {
    if (this.isJoined) {
      console.log("[Voice] Already in a room, leaving first...");
      this.leave();
    }

    this.roomId = roomId;
    
    // Connect to voice server
    await this.connectSocket();
    
    // Join the room
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

  /**
   * Leave the voice room (call when game ends)
   */
  leave() {
    console.log("[Voice] Leaving room...");
    
    // Stop microphone
    this.stopMic();
    
    // Close all peer connections
    this.peers.forEach((pc, peerId) => {
      this.closePeer(peerId);
    });
    this.peers.clear();
    this.audioElements.clear();
    this.pendingCandidates.clear();
    
    // Leave room on server
    if (this.socket?.connected) {
      this.socket.emit(EVENTS.LEAVE);
    }
    
    // Disconnect socket
    this.socket?.disconnect();
    this.socket = null;
    
    this.isJoined = false;
    this.roomId = null;
    this.socketId = null;
    
    console.log("[Voice] Left room");
  }

  /**
   * Toggle microphone on/off
   */
  async toggleMic() {
    if (this.isMicOn) {
      this.stopMic();
    } else {
      await this.startMic();
    }
    return this.isMicOn;
  }

  /**
   * Start the microphone
   */
  async startMic() {
    try {
      // Check requirements
      if (!this.checkRequirements()) {
        return false;
      }

      console.log("[Voice] Starting microphone...");
      
      // Get microphone access
      this.localStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
      console.log("[Voice] Got local stream");
      
      // Add audio track to all existing peer connections
      this.peers.forEach((pc, peerId) => {
        this.addLocalTracksToPeer(pc, peerId);
      });
      
      this.isMicOn = true;
      this.updateUI();
      
      console.log("[Voice] Microphone started");
      return true;
      
    } catch (error) {
      console.error("[Voice] Failed to start microphone:", error);
      this.handleMicError(error);
      return false;
    }
  }

  /**
   * Stop the microphone
   */
  stopMic() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }
    
    // Remove tracks from peer connections
    this.peers.forEach((pc) => {
      pc.getSenders().forEach(sender => {
        if (sender.track) {
          pc.removeTrack(sender);
        }
      });
    });
    
    this.isMicOn = false;
    this.updateUI();
    
    console.log("[Voice] Microphone stopped");
  }

  /**
   * Bind UI elements for mic button
   */
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

  // ==========================================================================
  // SOCKET CONNECTION
  // ==========================================================================

  /**
   * Connect to the voice signaling server
   */
  async connectSocket() {
    return new Promise((resolve, reject) => {
      // Get auth info from cookies
      const username = document.cookie
        .split("; ")
        .find(row => row.startsWith("username="))
        ?.split("=")[1] || "Guest";

      // Connect to /voice namespace
      this.socket = io("/voice", {
        auth: { username, lobbyId: this.roomId },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      // Connection events
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

      // Set up voice event handlers
      this.setupSocketHandlers();

      // Timeout
      setTimeout(() => {
        if (!this.socket.connected) {
          reject(new Error("Connection timeout"));
        }
      }, 10000);
    });
  }

  /**
   * Set up handlers for voice events from server
   */
  setupSocketHandlers() {
    // Receive list of existing users when we join
    this.socket.on(EVENTS.ROOM_USERS, async ({ users }) => {
      console.log("[Voice] Room users:", users.length);
      
      // Create peer connections to each existing user
      for (const user of users) {
        await this.createPeerConnection(user.socketId, true);
      }
    });

    // New user joined the room
    this.socket.on(EVENTS.USER_JOINED, async ({ socketId, username }) => {
      console.log(`[Voice] User joined: ${username} (${socketId})`);
      
      // They will initiate the connection to us
      // We just need to be ready to receive their offer
    });

    // User left the room
    this.socket.on(EVENTS.USER_LEFT, ({ socketId, username }) => {
      console.log(`[Voice] User left: ${username} (${socketId})`);
      this.closePeer(socketId);
    });

    // Receive WebRTC offer from a peer
    this.socket.on(EVENTS.OFFER, async ({ senderId, senderName, offer }) => {
      console.log(`[Voice] Received offer from ${senderName}`);
      
      try {
        // Create peer connection if we don't have one
        const pc = await this.createPeerConnection(senderId, false);
        
        // Set remote description (their offer)
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        
        // Flush any buffered ICE candidates
        await this.flushPendingCandidates(senderId);
        
        // Create and send answer
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        this.socket.emit(EVENTS.ANSWER, {
          targetId: senderId,
          answer: pc.localDescription
        });
        
        console.log(`[Voice] Sent answer to ${senderName}`);
        
      } catch (error) {
        console.error("[Voice] Error handling offer:", error);
      }
    });

    // Receive WebRTC answer from a peer
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

    // Receive ICE candidate from a peer
    this.socket.on(EVENTS.ICE_CANDIDATE, async ({ senderId, candidate }) => {
      if (!candidate) return;
      
      const pc = this.peers.get(senderId);
      
      if (pc && pc.remoteDescription) {
        // Connection ready, add candidate directly
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("[Voice] Error adding ICE candidate:", error);
        }
      } else {
        // Buffer candidate until connection is ready
        if (!this.pendingCandidates.has(senderId)) {
          this.pendingCandidates.set(senderId, []);
        }
        this.pendingCandidates.get(senderId).push(candidate);
      }
    });

    // Error from server
    this.socket.on(EVENTS.ERROR, (error) => {
      console.error("[Voice] Server error:", error);
    });
  }

  // ==========================================================================
  // WEBRTC PEER CONNECTIONS
  // ==========================================================================

  /**
   * Create a peer connection to another user
   * @param {string} peerId - Socket ID of the peer
   * @param {boolean} initiator - If true, we create and send the offer
   */
  async createPeerConnection(peerId, initiator) {
    // Clean up existing connection if any
    if (this.peers.has(peerId)) {
      this.closePeer(peerId);
    }

    console.log(`[Voice] Creating peer connection to ${peerId} (initiator: ${initiator})`);
    
    const pc = new RTCPeerConnection(RTC_CONFIG);
    this.peers.set(peerId, pc);

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit(EVENTS.ICE_CANDIDATE, {
          targetId: peerId,
          candidate: event.candidate
        });
      }
    };

    // Handle negotiation needed (when tracks are added)
    pc.onnegotiationneeded = async () => {
      console.log(`[Voice] Negotiation needed for ${peerId}`);
      
      // Only the initiator should create a new offer
      // This prevents both sides from sending offers simultaneously
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

    // Handle connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log(`[Voice] ICE state [${peerId}]: ${pc.iceConnectionState}`);
      
      if (pc.iceConnectionState === "connected") {
        console.log(`[Voice] ✅ Connected to ${peerId}`);
      } else if (pc.iceConnectionState === "failed") {
        console.log(`[Voice] Connection failed to ${peerId}, restarting ICE...`);
        pc.restartIce();
      } else if (pc.iceConnectionState === "disconnected") {
        // Give it a few seconds to recover
        setTimeout(() => {
          if (pc.iceConnectionState === "disconnected") {
            console.log(`[Voice] Connection to ${peerId} lost`);
            this.closePeer(peerId);
          }
        }, 5000);
      }
    };

    // Handle incoming audio track
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

    // Add local tracks if microphone is on
    if (this.localStream) {
      this.addLocalTracksToPeer(pc, peerId);
    }

    // If we're the initiator, create and send offer
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

  /**
   * Add local audio tracks to a peer connection
   */
  addLocalTracksToPeer(pc, peerId) {
    if (!this.localStream) return;
    
    this.localStream.getTracks().forEach(track => {
      // Check if track already added
      const senders = pc.getSenders();
      const hasTrack = senders.some(s => s.track === track);
      
      if (!hasTrack) {
        pc.addTrack(track, this.localStream);
        console.log(`[Voice] Added local track to peer ${peerId}`);
      }
    });
  }

  /**
   * Handle incoming audio track from a peer
   */
  handleRemoteTrack(peerId, event) {
    if (!event.streams || !event.streams[0]) {
      console.warn("[Voice] No stream in track event");
      return;
    }

    // Remove existing audio element if any
    const existingAudio = this.audioElements.get(peerId);
    if (existingAudio) {
      existingAudio.pause();
      existingAudio.srcObject = null;
      existingAudio.remove();
    }

    // Create new audio element
    const audio = document.createElement("audio");
    audio.id = `voice-audio-${peerId}`;
    audio.autoplay = true;
    audio.playsInline = true;
    audio.srcObject = event.streams[0];
    audio.style.display = "none";
    
    document.body.appendChild(audio);
    this.audioElements.set(peerId, audio);

    // Try to play (may be blocked by browser policy)
    this.tryPlayAudio(audio);
  }

  /**
   * Try to play an audio element (handles autoplay restrictions)
   */
  async tryPlayAudio(audio) {
    try {
      await audio.play();
      console.log("[Voice] ✅ Audio playing");
    } catch (error) {
      if (error.name === "NotAllowedError") {
        console.warn("[Voice] Audio autoplay blocked - will play on user interaction");
        // Audio will play after user interacts with the page
      } else {
        console.error("[Voice] Audio play error:", error);
      }
    }
  }

  /**
   * Flush buffered ICE candidates for a peer
   */
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

  /**
   * Close a peer connection
   */
  closePeer(peerId) {
    // Close RTCPeerConnection
    const pc = this.peers.get(peerId);
    if (pc) {
      pc.close();
      this.peers.delete(peerId);
    }
    
    // Remove audio element
    const audio = this.audioElements.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.audioElements.delete(peerId);
    }
    
    // Clear pending candidates
    this.pendingCandidates.delete(peerId);
    
    console.log(`[Voice] Closed peer ${peerId}`);
  }

  // ==========================================================================
  // AUDIO HANDLING
  // ==========================================================================

  /**
   * Set up audio unlock listener for mobile browsers
   * Mobile browsers require a user gesture before playing audio
   */
  setupAudioUnlock() {
    const unlock = async () => {
      if (this.audioUnlocked) return;
      
      try {
        // Create and resume audio context
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        
        // Play silent sound
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.01);
        
        this.audioUnlocked = true;
        console.log("[Voice] Audio unlocked");
        
        // Try to play any existing audio elements
        this.audioElements.forEach(audio => {
          audio.play().catch(() => {});
        });
        
      } catch (error) {
        console.error("[Voice] Audio unlock failed:", error);
      }
    };

    // Listen for user gestures
    ["click", "touchstart", "touchend", "keydown"].forEach(event => {
      document.addEventListener(event, unlock, { passive: true });
    });
  }

  /**
   * Check if all requirements are met for voice chat
   */
  checkRequirements() {
    // Check HTTPS (required for getUserMedia on mobile)
    if (!window.isSecureContext) {
      console.error("[Voice] HTTPS required for microphone access");
      alert("Voice chat requires HTTPS. Please use a secure connection.");
      return false;
    }
    
    // Check getUserMedia support
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("[Voice] getUserMedia not supported");
      alert("Your browser doesn't support voice chat.");
      return false;
    }
    
    return true;
  }

  /**
   * Handle microphone errors with user-friendly messages
   */
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

  // ==========================================================================
  // UI UPDATES
  // ==========================================================================

  /**
   * Update UI elements to reflect current state
   */
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

  // ==========================================================================
  // DEBUG / STATUS
  // ==========================================================================

  /**
   * Get current voice room status
   */
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

  /**
   * Force try to play all audio elements
   */
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

  /**
   * Test speaker with a beep
   */
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

// ============================================================================
// EXPORT SINGLETON INSTANCE
// ============================================================================

export const voiceRoom = new VoiceRoom();

// Expose to window for debugging
window.voiceRoom = voiceRoom;
