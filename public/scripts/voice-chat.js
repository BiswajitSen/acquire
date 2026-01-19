import { socketClient } from "./socket-client.js";

class VoiceChat {
  #localStream = null;
  #peerConnections = new Map();
  #audioElements = new Map();
  #isMicOn = false;
  #isListening = false;
  #toggleButton = null;
  #statusElement = null;

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
    socketClient.emit("voiceJoin");
  }

  #setupSocketListeners() {
    socketClient.on("voiceOffer", async ({ from, offer }) => {
      try {
        const pc = this.#createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketClient.emit("voiceAnswer", { to: from, answer });
      } catch (err) {
        console.error("Error handling voice offer:", err);
      }
    });

    socketClient.on("voiceAnswer", async ({ from, answer }) => {
      const pc = this.#peerConnections.get(from);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (err) {
          console.error("Error setting remote description:", err);
        }
      }
    });

    socketClient.on("voiceIceCandidate", async ({ from, candidate }) => {
      const pc = this.#peerConnections.get(from);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
      }
    });

    socketClient.on("voiceUserJoined", async ({ oderId }) => {
      await this.#initiateConnection(oderId);
    });

    socketClient.on("voiceUserLeft", ({ oderId }) => {
      this.#cleanupPeer(oderId);
    });

    socketClient.on("voiceRoomUsers", async ({ users }) => {
      for (const oderId of users) {
        await this.#initiateConnection(oderId);
      }
    });
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
  }

  #createPeerConnection(peerId) {
    if (this.#peerConnections.has(peerId)) {
      this.#cleanupPeer(peerId);
    }

    const config = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" }
      ]
    };

    const pc = new RTCPeerConnection(config);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketClient.emit("voiceIceCandidate", {
          to: peerId,
          candidate: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        this.#cleanupPeer(peerId);
      }
    };

    pc.ontrack = (event) => {
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
      
      audio.play().catch(() => {});
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
      const pc = this.#createPeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketClient.emit("voiceOffer", { to: peerId, offer });
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

      this.#peerConnections.forEach((pc, peerId) => {
        this.#localStream.getTracks().forEach(track => {
          pc.addTrack(track, this.#localStream);
        });
        this.#renegotiate(peerId, pc);
      });

      this.#isMicOn = true;
      this.#toggleButton?.classList.add("active");
      if (this.#statusElement) {
        this.#statusElement.textContent = "MIC ON";
      }

      socketClient.emit("voiceMicOn");
    } catch (error) {
      console.error("Failed to start mic:", error);
      if (this.#statusElement) {
        this.#statusElement.textContent = "ERROR";
      }
    }
  }

  async #renegotiate(peerId, pc) {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketClient.emit("voiceOffer", { to: peerId, offer });
    } catch (err) {
      console.error("Renegotiation failed:", err);
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

    socketClient.emit("voiceMicOff");
  }

  leave() {
    this.stopMic();
    
    this.#peerConnections.forEach((pc, peerId) => {
      this.#cleanupPeer(peerId);
    });
    this.#peerConnections.clear();
    this.#audioElements.clear();

    this.#isListening = false;
    socketClient.emit("voiceLeave");
  }
}

export const voiceChat = new VoiceChat();
