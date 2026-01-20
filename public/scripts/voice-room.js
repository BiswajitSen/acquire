/**
 * Agora Voice Chat Integration
 * 
 * Setup:
 * 1. Create account at https://console.agora.io
 * 2. Create a project (select "Testing mode" for App certificate)
 * 3. Copy your App ID and paste below
 */

// TODO: Replace with your Agora App ID from https://console.agora.io
const AGORA_APP_ID = "e5e48368eb5c435a8b834ba1be60f4a3";

// Import Agora SDK dynamically
let AgoraRTC = null;

class VoiceRoom {
  constructor() {
    this.client = null;
    this.localAudioTrack = null;
    this.remoteUsers = new Map();
    
    this.roomId = null;
    this.userId = null;
    this.isJoined = false;
    this.isMicOn = false;
    
    this.micButton = null;
    this.statusElement = null;
    this.mobileMicButton = null;
  }

  async loadAgoraSDK() {
    if (AgoraRTC) return;
    
    // Load Agora SDK from CDN
    return new Promise((resolve, reject) => {
      if (window.AgoraRTC) {
        AgoraRTC = window.AgoraRTC;
        resolve();
        return;
      }
      
      const script = document.createElement("script");
      script.src = "https://download.agora.io/sdk/release/AgoraRTC_N-4.20.0.js";
      script.onload = () => {
        AgoraRTC = window.AgoraRTC;
        console.log("[Voice] Agora SDK loaded");
        resolve();
      };
      script.onerror = () => reject(new Error("Failed to load Agora SDK"));
      document.head.appendChild(script);
    });
  }

  async join(roomId) {
    if (!AGORA_APP_ID) {
      console.error("[Voice] ❌ Agora App ID not configured!");
      console.log("[Voice] Get your App ID from https://console.agora.io");
      alert("Voice chat not configured. See console for instructions.");
      return;
    }

    if (this.isJoined) {
      await this.leave();
    }

    try {
      await this.loadAgoraSDK();
      
      // Create Agora client
      this.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      
      // Set up event handlers
      this.setupEventHandlers();
      
      // Get user ID from cookie
      this.userId = document.cookie
        .split("; ")
        .find(row => row.startsWith("username="))
        ?.split("=")[1] || `user_${Date.now()}`;
      
      this.roomId = roomId;
      
      // Join the channel (room)
      console.log(`[Voice] Joining room ${roomId}...`);
      await this.client.join(AGORA_APP_ID, roomId, null, this.userId);
      
      this.isJoined = true;
      console.log(`[Voice] ✅ Joined room ${roomId} as ${this.userId}`);
      
      // Subscribe to any users who are already publishing
      await this.subscribeToExistingUsers();
      
      return { success: true, roomId, userId: this.userId };
      
    } catch (error) {
      console.error("[Voice] ❌ Failed to join:", error);
      throw error;
    }
  }

  setupEventHandlers() {
    // Handle new user publishing audio
    this.client.on("user-published", async (user, mediaType) => {
      console.log(`[Voice] 📡 user-published event: ${user.uid}, type: ${mediaType}`);
      
      if (mediaType === "audio") {
        try {
          console.log(`[Voice] 🎤 Subscribing to ${user.uid}...`);
          
          // Subscribe to the remote user's audio
          await this.client.subscribe(user, mediaType);
          
          // Play the audio
          if (user.audioTrack) {
            user.audioTrack.play();
            this.remoteUsers.set(user.uid, user);
            console.log(`[Voice] 🔊 Now playing audio from ${user.uid}`);
          } else {
            console.warn(`[Voice] ⚠️ No audio track from ${user.uid}`);
          }
        } catch (error) {
          console.error(`[Voice] ❌ Failed to subscribe to ${user.uid}:`, error);
        }
      }
    });

    // Handle user stopping audio
    this.client.on("user-unpublished", (user, mediaType) => {
      console.log(`[Voice] 📡 user-unpublished event: ${user.uid}, type: ${mediaType}`);
      
      if (mediaType === "audio") {
        console.log(`[Voice] 🔇 ${user.uid} stopped publishing audio`);
        this.remoteUsers.delete(user.uid);
      }
    });

    // Handle user joining (before they publish)
    this.client.on("user-joined", (user) => {
      console.log(`[Voice] 👋 ${user.uid} joined the channel`);
    });

    // Handle user leaving the channel
    this.client.on("user-left", (user) => {
      console.log(`[Voice] 👋 ${user.uid} left the channel`);
      this.remoteUsers.delete(user.uid);
    });

    // Handle errors
    this.client.on("exception", (event) => {
      console.error("[Voice] ⚠️ Exception:", event);
    });

    // Handle connection state changes
    this.client.on("connection-state-change", (curState, prevState) => {
      console.log(`[Voice] 🔌 Connection: ${prevState} → ${curState}`);
    });
  }

  async subscribeToExistingUsers() {
    // Get all remote users who are already in the channel
    const remoteUsers = this.client.remoteUsers;
    console.log(`[Voice] Found ${remoteUsers.length} existing user(s) in channel`);
    
    for (const user of remoteUsers) {
      // Check if user has published audio
      if (user.hasAudio) {
        try {
          console.log(`[Voice] 🎤 Subscribing to existing user ${user.uid}...`);
          await this.client.subscribe(user, "audio");
          
          if (user.audioTrack) {
            user.audioTrack.play();
            this.remoteUsers.set(user.uid, user);
            console.log(`[Voice] 🔊 Now playing audio from ${user.uid}`);
          }
        } catch (error) {
          console.error(`[Voice] ❌ Failed to subscribe to existing user ${user.uid}:`, error);
        }
      } else {
        console.log(`[Voice] ℹ️ User ${user.uid} hasn't published audio yet`);
      }
    }
  }

  async leave() {
    console.log("[Voice] Leaving room...");
    
    await this.stopMic();
    
    if (this.client) {
      await this.client.leave();
      this.client = null;
    }
    
    this.remoteUsers.clear();
    this.isJoined = false;
    this.roomId = null;
    
    console.log("[Voice] Left room");
  }

  async toggleMic() {
    if (this.isMicOn) {
      await this.stopMic();
    } else {
      await this.startMic();
    }
    return this.isMicOn;
  }

  async startMic() {
    try {
      if (!this.isJoined) {
        console.warn("[Voice] Not in a room");
        return false;
      }

      console.log("[Voice] Starting microphone...");
      
      // Create local audio track
      this.localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack({
        encoderConfig: "speech_low_quality",
        AEC: true,  // Echo cancellation
        ANS: true,  // Noise suppression
        AGC: true   // Auto gain control
      });
      
      // Publish to the channel
      await this.client.publish([this.localAudioTrack]);
      
      this.isMicOn = true;
      this.updateUI();
      
      console.log("[Voice] ✅ Microphone started - others can hear you!");
      return true;
      
    } catch (error) {
      console.error("[Voice] ❌ Failed to start mic:", error);
      
      if (error.message?.includes("Permission denied")) {
        alert("Microphone access denied. Please allow microphone access.");
      } else {
        alert(`Microphone error: ${error.message}`);
      }
      
      return false;
    }
  }

  async stopMic() {
    if (this.localAudioTrack) {
      // Unpublish from channel
      if (this.client && this.isJoined) {
        await this.client.unpublish([this.localAudioTrack]);
      }
      
      // Stop and close the track
      this.localAudioTrack.stop();
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }
    
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

  updateUI() {
    this.micButton?.classList.toggle("active", this.isMicOn);
    this.mobileMicButton?.classList.toggle("active", this.isMicOn);
    
    if (this.statusElement) {
      this.statusElement.textContent = this.isMicOn ? "MIC ON" : "MIC OFF";
    }
  }

  getStatus() {
    return {
      joined: this.isJoined,
      room: this.roomId,
      user: this.userId,
      micOn: this.isMicOn,
      remoteUsers: Array.from(this.remoteUsers.keys()),
      remoteUserCount: this.remoteUsers.size
    };
  }

  // Debug helper
  debug() {
    console.log("=== VOICE DEBUG ===");
    console.log("Agora App ID configured:", !!AGORA_APP_ID);
    console.log("Joined:", this.isJoined);
    console.log("Room:", this.roomId);
    console.log("User:", this.userId);
    console.log("Mic on:", this.isMicOn);
    console.log("Local track:", this.localAudioTrack ? "exists" : "none");
    console.log("Remote users playing:", Array.from(this.remoteUsers.keys()));
    
    if (this.client) {
      console.log("All remote users in channel:", this.client.remoteUsers.map(u => ({
        uid: u.uid,
        hasAudio: u.hasAudio,
        audioTrack: !!u.audioTrack
      })));
    }
    console.log("===================");
  }
}

export const voiceRoom = new VoiceRoom();
window.voiceRoom = voiceRoom;
