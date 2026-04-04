// ============================================================
// LumiConnect - WebRTC Handler (Audio + Video)
// Uses PeerJS for signaling + WebRTC for P2P
// ============================================================

const WebRTC = {
  peer: null,
  currentCall: null,
  localStream: null,
  currentRoom: null,
  callType: null, // 'audio' | 'video'
  callStartTime: null,
  callTimer: null,
  pointTimer: null,
  sigPollTimer: null,
  lastSigTime: null,
  isMuted: false,
  isCamOff: false,

  // ── Init PeerJS ──────────────────────────────────────────
  async initPeer() {
    if (this.peer && !this.peer.destroyed) return this.peer;
    return new Promise((resolve, reject) => {
      const peer = new Peer(undefined, CONFIG.PEER_CONFIG);
      peer.on('open', id => {
        console.log('[WebRTC] Peer ID:', id);
        this.peer = peer;
        resolve(peer);
      });
      peer.on('call', call => this.handleIncomingCall(call));
      peer.on('error', err => {
        console.error('[WebRTC] Peer error:', err);
        if (err.type === 'peer-unavailable') {
          showToast('Peer not available. They may have left.', 'error');
        }
      });
      peer.on('disconnected', () => {
        console.log('[WebRTC] Peer disconnected, reconnecting...');
        peer.reconnect();
      });
      setTimeout(() => reject(new Error('PeerJS timeout')), 10000);
    });
  },

  // ── Get Media ────────────────────────────────────────────
  async getMedia(type) {
    try {
      const constraints = type === 'video'
        ? { video: { width: 640, height: 480 }, audio: true }
        : { video: false, audio: true };
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (type === 'video') {
        const localVid = document.getElementById('local-video');
        if (localVid) localVid.srcObject = this.localStream;
      }
      return this.localStream;
    } catch(err) {
      console.error('[WebRTC] Media error:', err);
      if (err.name === 'NotAllowedError') showToast('Please allow microphone/camera access', 'error');
      else showToast('Cannot access media devices: ' + err.message, 'error');
      return null;
    }
  },

  // ── Start Call (Caller) ──────────────────────────────────
  async startCall(type, room) {
    this.callType = type;
    this.currentRoom = room;
    const stream = await this.getMedia(type);
    if (!stream) return;
    // Wait for peer 2 to join and share their peerId
    this.lastSigTime = new Date().toISOString();
    this.startSigPoll(room.roomId, 'caller', null, stream);
    showToast('Waiting for someone to join...', 'info');
    this.updateCallUI(type, 'waiting');
  },

  // ── Join Call (Callee) ───────────────────────────────────
  async joinCall(type, room) {
    this.callType = type;
    this.currentRoom = room;
    const stream = await this.getMedia(type);
    if (!stream) return;
    // Get caller's peerId from room
    const callerPeerId = room.peerId;
    if (!callerPeerId) {
      showToast('Room creator not ready yet...', 'info');
      // Poll for peer id
      this.startSigPoll(room.roomId, 'callee', null, stream);
      return;
    }
    await this.callPeer(callerPeerId, stream, type);
  },

  async callPeer(targetPeerId, stream, type) {
    try {
      const peer = await this.initPeer();
      showToast('Connecting to peer...', 'info');
      const call = peer.call(targetPeerId, stream, {
        metadata: { type, userId: Auth.user?.userId }
      });
      this.currentCall = call;
      this.setupCallHandlers(call, type);
    } catch(err) {
      showToast('Could not connect: ' + err.message, 'error');
    }
  },

  handleIncomingCall(call) {
    if (!this.localStream) {
      const type = call.metadata?.type || 'audio';
      this.getMedia(type).then(stream => {
        if (!stream) { call.close(); return; }
        call.answer(stream);
        this.currentCall = call;
        this.setupCallHandlers(call, type);
      });
    } else {
      call.answer(this.localStream);
      this.currentCall = call;
      this.setupCallHandlers(call, this.callType || 'audio');
    }
  },

  setupCallHandlers(call, type) {
    call.on('stream', remoteStream => {
      if (type === 'video') {
        const remoteVid = document.getElementById('remote-video');
        if (remoteVid) {
          remoteVid.srcObject = remoteStream;
          document.getElementById('video-overlay').style.display = 'none';
        }
      } else {
        const remoteAudio = document.getElementById('remote-audio');
        if (remoteAudio) remoteAudio.srcObject = remoteStream;
        document.querySelectorAll('.audio-ring').forEach(r => r.classList.add('active'));
      }
      this.onCallConnected(type);
    });
    call.on('close', () => this.onCallEnded());
    call.on('error', err => {
      console.error('[WebRTC] Call error:', err);
      this.onCallEnded();
    });
  },

  onCallConnected(type) {
    this.callStartTime = Date.now();
    this.updateCallUI(type, 'connected');
    showToast('Connected! 🎉', 'success');
    // Start call timer
    this.callTimer = setInterval(() => this.updateTimer(), 1000);
    // Deduct points per minute
    const costPerMin = type === 'video' ? CONFIG.POINTS.VIDEO_COST : CONFIG.POINTS.AUDIO_COST;
    this.pointTimer = setInterval(async () => {
      if (!Auth.user) return;
      const res = await API.deductPoints({ ...Auth.getSessionData(), amount: costPerMin, reason: `${type}_call`, description: `${type} call minute` });
      if (res.ok) { Auth.updatePoints(res.points); }
      else if (res.error === 'Insufficient points') {
        showToast('Insufficient points! Call ended.', 'error');
        this.endCall();
      }
    }, 60000);
  },

  onCallEnded() {
    clearInterval(this.callTimer);
    clearInterval(this.pointTimer);
    clearInterval(this.sigPollTimer);
    // Long call bonus (3+ hours = 180 min)
    if (this.callStartTime) {
      const mins = (Date.now() - this.callStartTime) / 60000;
      if (mins >= 180) {
        API.addPoints({ ...Auth.getSessionData(), amount: CONFIG.POINTS.LONG_CALL_BONUS, reason: 'long_call', description: 'Long session bonus!' });
        showToast('+30 pts Long Session Bonus! 🏆', 'success');
      }
    }
    this.stopTracks();
    this.updateCallUI(this.callType, 'ended');
    this.currentCall = null;
    this.callStartTime = null;
  },

  stopTracks() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop());
      this.localStream = null;
    }
    const localVid = document.getElementById('local-video');
    const remoteVid = document.getElementById('remote-video');
    const remoteAudio = document.getElementById('remote-audio');
    if (localVid) localVid.srcObject = null;
    if (remoteVid) remoteVid.srcObject = null;
    if (remoteAudio) remoteAudio.srcObject = null;
  },

  updateTimer() {
    if (!this.callStartTime) return;
    const sec = Math.floor((Date.now() - this.callStartTime) / 1000);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    const timerEl = document.getElementById('audio-timer');
    if (timerEl) { timerEl.textContent = `⏱️ ${mm}:${ss}`; timerEl.classList.remove('hidden'); }
  },

  updateCallUI(type, state) {
    if (type === 'audio') {
      const statusEl = document.getElementById('audio-status');
      if (statusEl) statusEl.textContent = state === 'connected' ? 'Connected 🟢' : state === 'waiting' ? 'Waiting...' : 'Call Ended';
      document.getElementById('audio-controls')?.classList.remove('hidden');
    } else if (type === 'video') {
      const textEl = document.getElementById('video-status-text');
      if (textEl) textEl.textContent = state === 'connected' ? 'Connected' : state === 'waiting' ? 'Waiting for peer...' : 'Call Ended';
      if (state === 'ended') document.getElementById('video-overlay').style.display = 'flex';
    }
  },

  // ── GAS Signal Polling (fallback signaling) ──────────────
  startSigPoll(roomId, role, targetPeerId, stream) {
    clearInterval(this.sigPollTimer);
    this.lastSigTime = new Date().toISOString();
    this.sigPollTimer = setInterval(async () => {
      if (!Auth.user) return;
      const res = await API.getSignals({ roomId, userId: Auth.user.userId, since: this.lastSigTime });
      if (res.ok && res.signals?.length) {
        this.lastSigTime = new Date().toISOString();
        for (const sig of res.signals) {
          try {
            const payload = JSON.parse(sig.content);
            if (payload.type === 'peer_id' && role === 'caller' && payload.peerId !== this.peer?.id) {
              clearInterval(this.sigPollTimer);
              await this.callPeer(payload.peerId, stream, this.callType);
            }
          } catch(e) {}
        }
      }
    }, CONFIG.SIGNAL_POLL_INTERVAL);
  },

  async broadcastPeerId(roomId) {
    if (!this.peer?.id) return;
    await API.sendSignal({
      ...Auth.getSessionData(),
      roomId,
      signal: JSON.stringify({ type: 'peer_id', peerId: this.peer.id }),
      signalType: 'peer'
    });
  },

  toggleMute() {
    if (!this.localStream) return;
    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach(t => t.enabled = !this.isMuted);
    const btn = document.getElementById('mute-btn') || document.getElementById('vid-mute-btn');
    if (btn) {
      btn.textContent = this.isMuted ? '🔇 Unmute' : '🎙️ Mute';
      btn.classList.toggle('muted', this.isMuted);
    }
  },

  toggleCamera() {
    if (!this.localStream) return;
    this.isCamOff = !this.isCamOff;
    this.localStream.getVideoTracks().forEach(t => t.enabled = !this.isCamOff);
    const btn = document.getElementById('vid-cam-btn');
    if (btn) btn.textContent = this.isCamOff ? '📷 On' : '📷 Off';
  },

  endCall() {
    if (this.currentCall) this.currentCall.close();
    if (this.currentRoom) {
      API.leaveRoom({ ...Auth.getSessionData(), roomId: this.currentRoom.roomId });
    }
    this.onCallEnded();
  },

  destroy() {
    this.endCall();
    if (this.peer && !this.peer.destroyed) this.peer.destroy();
    this.peer = null;
  }
};

// Global control functions
function toggleMute()      { WebRTC.toggleMute(); }
function toggleVideoMute() { WebRTC.toggleMute(); }
function toggleCamera()    { WebRTC.toggleCamera(); }
function endCall() {
  WebRTC.endCall();
  const type = WebRTC.callType;
  if (type) showView(type);
}
