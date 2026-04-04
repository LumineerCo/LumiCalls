// ============================================================
// LumiConnect - Chat Module
// ============================================================

const Chat = {
  currentRoom: null,
  lastMsgTime: null,
  pollTimer: null,

  async connect(type = 'random', roomId = null) {
    if (!Auth.isLoggedIn()) {
      // Auto create temp user
      const geo = await getGeo();
      const res = await API.createTempUser({ ...geo });
      if (res.ok) {
        Auth.user = res.user;
        Auth.sessionId = res.sessionId;
        Auth.save();
        Auth.updateUI();
      } else {
        showToast('Failed to connect. Try again.', 'error');
        return;
      }
    }

    setStatusBar('chat', 'Connecting...', 'connecting');
    let res;

    if (type === 'random') {
      res = await API.findRandomRoom({ ...Auth.getSessionData(), type: 'chat' });
    } else if (type === 'create') {
      res = await API.createRoom({ ...Auth.getSessionData(), type: 'chat', isPublic: true });
    } else if (type === 'join' && roomId) {
      res = await API.joinRoom({ ...Auth.getSessionData(), roomId });
    }

    if (!res || !res.ok) {
      setStatusBar('chat', 'Connection failed', '');
      showToast(res?.error || 'Could not connect', 'error');
      return;
    }

    this.currentRoom = res.room;
    this.lastMsgTime = new Date().toISOString();
    setStatusBar('chat', 'Connected to Room: ' + res.room.roomId, 'connected');
    updateRoomUI('chat', res.room);
    this.addSystemMsg('Connected! Say hello 👋');
    this.startPolling();
    showToast('Connected to chat room!', 'success');
  },

  startPolling() {
    clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.fetchMessages(), CONFIG.CHAT_POLL_INTERVAL);
  },

  async fetchMessages() {
    if (!this.currentRoom) return;
    const res = await API.getMessages({
      roomId: this.currentRoom.roomId,
      since: this.lastMsgTime
    });
    if (res.ok && res.messages?.length) {
      this.lastMsgTime = new Date().toISOString();
      res.messages.forEach(msg => this.renderMessage(msg));
    }
  },

  async send(content) {
    if (!this.currentRoom) {
      showToast('Not connected to a room', 'error');
      return;
    }
    if (!content.trim()) return;
    if (!Auth.user || Auth.user.points < 1) {
      showToast('Not enough points! Watch an ad to earn more.', 'error');
      return;
    }
    const res = await API.sendMessage({
      ...Auth.getSessionData(),
      roomId: this.currentRoom.roomId,
      content: content.trim()
    });
    if (res.ok) {
      Auth.updatePoints(res.pointsLeft || (Auth.user.points - 1));
      this.renderMessage(res.message, true);
    } else {
      showToast(res.error || 'Could not send message', 'error');
    }
  },

  renderMessage(msg, isMine = null) {
    const area = document.getElementById('chat-messages');
    if (!area) return;
    const empty = area.querySelector('.chat-empty');
    if (empty) empty.remove();
    const isOwn = isMine !== null ? isMine : (msg.senderId === Auth.user?.userId);
    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'mine' : 'theirs'}`;
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `
      <div>${escHtml(msg.content)}</div>
      <div class="message-meta">${isOwn ? 'You' : escHtml(msg.senderName)} · ${time}</div>
    `;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  addSystemMsg(text) {
    const area = document.getElementById('chat-messages');
    if (!area) return;
    const div = document.createElement('div');
    div.className = 'message system';
    div.textContent = text;
    area.appendChild(div);
    area.scrollTop = area.scrollHeight;
  },

  disconnect() {
    clearInterval(this.pollTimer);
    if (this.currentRoom) {
      API.leaveRoom({ ...Auth.getSessionData(), roomId: this.currentRoom.roomId });
      this.currentRoom = null;
    }
    setStatusBar('chat', 'Disconnected', '');
  }
};

// Global functions
async function quickConnect(type) {
  showView(type);
  if (type === 'chat') {
    await Chat.connect('random');
  } else if (type === 'audio') {
    await AudioCall.start();
  } else if (type === 'video') {
    await VideoCall.start();
  }
}

async function randomConnect(type) {
  if (type === 'chat') await Chat.connect('random');
  else if (type === 'audio') await AudioCall.start('random');
  else if (type === 'video') await VideoCall.start('random');
}

async function createMyRoom(type) {
  if (type === 'chat') await Chat.connect('create');
  else if (type === 'audio') await AudioCall.start('create');
  else if (type === 'video') await VideoCall.start('create');
}

async function joinByRoomId(type) {
  const inputId = type === 'chat' ? 'join-room-id' : `join-${type}-id`;
  const roomId = document.getElementById(inputId)?.value.trim();
  if (!roomId) { showToast('Enter a room ID', 'error'); return; }
  if (type === 'chat') await Chat.connect('join', roomId);
  else if (type === 'audio') await AudioCall.start('join', roomId);
  else if (type === 'video') await VideoCall.start('join', roomId);
}

function sendChatMsg() {
  const input = document.getElementById('chat-input');
  if (!input) return;
  Chat.send(input.value);
  input.value = '';
}

// ── Audio Call ───────────────────────────────────────────────

const AudioCall = {
  currentRoom: null,

  async start(type = 'random', roomId = null) {
    if (!Auth.canDo('audio')) {
      document.getElementById('audio-plan-gate')?.classList.remove('hidden');
      document.getElementById('audio-connect-opts')?.classList.add('hidden');
      showToast('Audio calls need Standard plan (500 pts)', 'error');
      return;
    }
    if (!Auth.isLoggedIn()) {
      const geo = await getGeo();
      const res = await API.createTempUser({ ...geo });
      if (res.ok) { Auth.user = res.user; Auth.sessionId = res.sessionId; Auth.save(); Auth.updateUI(); }
    }

    try {
      const peer = await WebRTC.initPeer();
      let roomRes;
      if (type === 'random') {
        roomRes = await API.findRandomRoom({ ...Auth.getSessionData(), type: 'audio', peerId: peer.id });
      } else if (type === 'create') {
        roomRes = await API.createRoom({ ...Auth.getSessionData(), type: 'audio', isPublic: true, peerId: peer.id });
      } else if (type === 'join' && roomId) {
        roomRes = await API.joinRoom({ ...Auth.getSessionData(), roomId, peerId: peer.id });
      }
      if (!roomRes?.ok) { showToast(roomRes?.error || 'Could not connect', 'error'); return; }
      this.currentRoom = roomRes.room;
      updateRoomUI('audio', roomRes.room);
      WebRTC.callType = 'audio';
      WebRTC.currentRoom = roomRes.room;
      const room = roomRes.room;
      const isCaller = room.createdBy === Auth.user?.userId && room.participantCount <= 1;
      if (isCaller) {
        // Broadcast our peer ID and wait
        await WebRTC.broadcastPeerId(room.roomId);
        await WebRTC.startCall('audio', room);
      } else {
        // Join: call the creator
        await WebRTC.joinCall('audio', room);
        await WebRTC.broadcastPeerId(room.roomId);
      }
    } catch(err) {
      showToast('Connection failed: ' + err.message, 'error');
    }
  }
};

// ── Video Call ───────────────────────────────────────────────

const VideoCall = {
  currentRoom: null,

  async start(type = 'random', roomId = null) {
    if (!Auth.canDo('video')) {
      document.getElementById('video-plan-gate')?.classList.remove('hidden');
      document.getElementById('video-connect-opts')?.classList.add('hidden');
      showToast('Video calls need Premium plan (2000 pts)', 'error');
      return;
    }
    if (!Auth.isLoggedIn()) {
      const geo = await getGeo();
      const res = await API.createTempUser({ ...geo });
      if (res.ok) { Auth.user = res.user; Auth.sessionId = res.sessionId; Auth.save(); Auth.updateUI(); }
    }

    try {
      const peer = await WebRTC.initPeer();
      let roomRes;
      if (type === 'random') {
        roomRes = await API.findRandomRoom({ ...Auth.getSessionData(), type: 'video', peerId: peer.id });
      } else if (type === 'create') {
        roomRes = await API.createRoom({ ...Auth.getSessionData(), type: 'video', isPublic: true, peerId: peer.id });
      } else if (type === 'join' && roomId) {
        roomRes = await API.joinRoom({ ...Auth.getSessionData(), roomId, peerId: peer.id });
      }
      if (!roomRes?.ok) { showToast(roomRes?.error || 'Could not connect', 'error'); return; }
      this.currentRoom = roomRes.room;
      updateRoomUI('video', roomRes.room);
      WebRTC.callType = 'video';
      WebRTC.currentRoom = roomRes.room;
      const room = roomRes.room;
      const isCaller = room.createdBy === Auth.user?.userId && room.participantCount <= 1;
      if (isCaller) {
        await WebRTC.broadcastPeerId(room.roomId);
        await WebRTC.startCall('video', room);
      } else {
        await WebRTC.joinCall('video', room);
        await WebRTC.broadcastPeerId(room.roomId);
      }
    } catch(err) {
      showToast('Connection failed: ' + err.message, 'error');
    }
  }
};

// ── Helpers ──────────────────────────────────────────────────

function setStatusBar(type, text, dotClass) {
  if (type !== 'chat') return;
  const textEl = document.getElementById('chat-status-text');
  const dotEl  = document.getElementById('chat-status-dot');
  if (textEl) textEl.textContent = text;
  if (dotEl)  { dotEl.className = 'status-dot'; if (dotClass) dotEl.classList.add(dotClass); }
}

function updateRoomUI(type, room) {
  const infoEl = document.getElementById(`${type}-room-info`);
  const dispEl = document.getElementById(`${type}-room-display`);
  if (infoEl) infoEl.classList.remove('hidden');
  if (dispEl) dispEl.textContent = '🏠 ' + room.roomId;
  window._currentRoom = room; // Store for invite
}

function escHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}
