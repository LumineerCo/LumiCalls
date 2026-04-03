// ============================================================
// LumiConnect - API Layer
// Handles all GAS backend communication
// ============================================================

const API = {
  async call(action, data = {}, method = 'POST') {
    if (!CONFIG.GAS_URL) {
      return this._demoResponse(action, data);
    }
    try {
      const url = `${CONFIG.GAS_URL}?action=${action}`;
      const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify({ ...data, action }) : undefined,
        redirect: 'follow'
      };
      if (method === 'GET') {
        const params = new URLSearchParams({ action, ...data });
        const res = await fetch(`${CONFIG.GAS_URL}?${params}`, { method: 'GET', redirect: 'follow' });
        return await res.json();
      }
      const res = await fetch(url, opts);
      const text = await res.text();
      try { return JSON.parse(text); }
      catch { return { ok: false, error: 'Invalid response from server' }; }
    } catch (err) {
      console.error('[API] Error:', err);
      return { ok: false, error: err.message };
    }
  },

  // ── Auth ──────────────────────────────────────────────
  createTempUser: (data)         => API.call('createTempUser', data),
  register:       (data)         => API.call('register', data),
  login:          (data)         => API.call('login', data),
  logout:         (data)         => API.call('logout', data),
  getUser:        (data)         => API.call('getUser', data, 'GET'),
  updateUser:     (data)         => API.call('updateUser', data),

  // ── Rooms ─────────────────────────────────────────────
  createRoom:     (data)         => API.call('createRoom', data),
  joinRoom:       (data)         => API.call('joinRoom', data),
  leaveRoom:      (data)         => API.call('leaveRoom', data),
  getRoomInfo:    (data)         => API.call('getRoomInfo', data, 'GET'),
  findRandomRoom: (data)         => API.call('findRandomRoom', data),

  // ── Signaling ─────────────────────────────────────────
  sendSignal:     (data)         => API.call('sendSignal', data),
  getSignals:     (data)         => API.call('getSignals', data, 'GET'),

  // ── Chat ──────────────────────────────────────────────
  sendMessage:    (data)         => API.call('sendMessage', data),
  getMessages:    (data)         => API.call('getMessages', data, 'GET'),

  // ── Points ────────────────────────────────────────────
  addPoints:      (data)         => API.call('addPoints', data),
  deductPoints:   (data)         => API.call('deductPoints', data),
  watchAd:        (data)         => API.call('watchAd', data),
  getAds:         ()             => API.call('getAds', {}, 'GET'),
  getPointHistory:(data)         => API.call('getPointHistory', data, 'GET'),
  applyReferral:  (data)         => API.call('applyReferral', data),

  // ── Forum ─────────────────────────────────────────────
  getPosts:       (data)         => API.call('getPosts', data, 'GET'),
  createPost:     (data)         => API.call('createPost', data),
  likePost:       (data)         => API.call('likePost', data),

  // ── Ad Slots ──────────────────────────────────────────
  bookAdSlot:     (data)         => API.call('bookAdSlot', data),
  getAds:         ()             => API.call('getAds', {}, 'GET'),

  // ── Admin ─────────────────────────────────────────────
  adminLogin:     (data)         => API.call('adminLogin', data),
  adminReport:    (data)         => API.call('adminReport', data, 'GET'),
  adminGetUsers:  (data)         => API.call('adminGetUsers', data, 'GET'),
  adminGetSlots:  (data)         => API.call('adminGetSlots', data, 'GET'),
  adminApproveSlot:(data)        => API.call('adminApproveSlot', data),
  adminGetAds:    (data)         => API.call('adminGetAds', data, 'GET'),
  adminAddAd:     (data)         => API.call('adminAddAd', data),
  adminAction:    (data)         => API.call('adminAction', data),

  // ── Demo Mode Fallback ────────────────────────────────
  _demoData: {
    users: [], sessions: {}, messages: {}, rooms: {}, forum: [], ads: []
  },
  _demoResponse(action, data) {
    console.log('[DEMO]', action, data);
    const d = this._demoData;
    const uid = () => Math.random().toString(36).substring(2, 14);

    switch(action) {
      case 'createTempUser': {
        const userId = 'tmp_' + uid();
        const user = { userId, username: 'Guest_' + Math.floor(Math.random()*99999), email: '', accountType: 'temp', plan: 'free', points: 20, referralCode: uid().substring(0,8), totalReferrals: 0, isAdmin: false, status: 'active' };
        d.users.push(user);
        const sessionId = 'sess_' + uid();
        d.sessions[sessionId] = userId;
        return { ok: true, user, sessionId };
      }
      case 'register': {
        if (d.users.find(u => u.email === data.email)) return { ok: false, error: 'Email exists' };
        const userId = 'usr_' + uid();
        const user = { userId, username: data.username, email: data.email, accountType: 'registered', plan: 'free', points: 100, referralCode: uid().substring(0,8), totalReferrals: 0, isAdmin: false, status: 'active' };
        d.users.push(user);
        const sessionId = 'sess_' + uid();
        d.sessions[sessionId] = userId;
        return { ok: true, user, sessionId };
      }
      case 'login': {
        const user = d.users.find(u => u.email === data.email);
        if (!user) return { ok: false, error: 'Not found' };
        const sessionId = 'sess_' + uid();
        d.sessions[sessionId] = user.userId;
        return { ok: true, user, sessionId };
      }
      case 'getUser': {
        const userId = d.sessions[data.sessionId] || data.userId;
        const user = d.users.find(u => u.userId === userId);
        return user ? { ok: true, user } : { ok: false, error: 'Not found' };
      }
      case 'createRoom': {
        const roomId = 'DEMO_' + Math.random().toString(36).substring(2,8).toUpperCase();
        const room = { roomId, type: data.type || 'chat', createdBy: data.userId || 'tmp', status: 'waiting', participants: data.userId || 'tmp', participantCount: 1, peerId: data.peerId || '' };
        d.rooms[roomId] = room;
        return { ok: true, room };
      }
      case 'joinRoom': {
        const room = d.rooms[data.roomId];
        if (!room) return { ok: false, error: 'Room not found' };
        if (!room.participants.includes(data.userId || '')) {
          room.participants += ',' + (data.userId || 'guest');
          room.participantCount = (room.participantCount || 1) + 1;
          room.status = 'active';
          room.peerId2 = data.peerId || '';
        }
        return { ok: true, room };
      }
      case 'findRandomRoom': {
        const type = data.type || 'chat';
        const waiting = Object.values(d.rooms).find(r => r.type === type && r.status === 'waiting');
        if (waiting) return this._demoResponse('joinRoom', { ...data, roomId: waiting.roomId });
        return this._demoResponse('createRoom', data);
      }
      case 'sendMessage': {
        const roomId = data.roomId;
        if (!d.messages[roomId]) d.messages[roomId] = [];
        const msg = { messageId: uid(), roomId, senderId: data.userId || 'guest', senderName: data.username || 'Guest', content: data.content, type: 'chat', timestamp: new Date().toISOString() };
        d.messages[roomId].push(msg);
        return { ok: true, message: msg, pointsLeft: 19 };
      }
      case 'getMessages': {
        const since = data.since ? new Date(data.since) : new Date(0);
        const msgs = (d.messages[data.roomId] || []).filter(m => new Date(m.timestamp) > since);
        return { ok: true, messages: msgs };
      }
      case 'sendSignal': {
        const key = 'sig_' + data.roomId;
        if (!d.messages[key]) d.messages[key] = [];
        d.messages[key].push({ senderId: data.userId, content: data.signal, type: 'signal', timestamp: new Date().toISOString() });
        return { ok: true };
      }
      case 'getSignals': {
        const key = 'sig_' + data.roomId;
        const since = data.since ? new Date(data.since) : new Date(0);
        const sigs = (d.messages[key] || []).filter(s => s.senderId !== data.userId && new Date(s.timestamp) > since);
        return { ok: true, signals: sigs };
      }
      case 'addPoints': {
        const user = d.users.find(u => u.userId === (d.sessions[data.sessionId] || data.userId));
        if (user) { user.points = (user.points || 0) + Number(data.amount); return { ok: true, points: user.points }; }
        return { ok: false };
      }
      case 'deductPoints': {
        const user = d.users.find(u => u.userId === (d.sessions[data.sessionId] || data.userId));
        if (user && user.points >= Number(data.amount)) { user.points -= Number(data.amount); return { ok: true, points: user.points }; }
        return { ok: false, error: 'Insufficient points' };
      }
      case 'watchAd': {
        const pts = data.adType === 'video' ? 15 : 8;
        const user = d.users.find(u => u.userId === (d.sessions[data.sessionId] || data.userId));
        if (user) { user.points = (user.points || 0) + pts; return { ok: true, earned: pts, points: user.points }; }
        return { ok: true, earned: pts, points: pts };
      }
      case 'getAds':
        return { ok: true, ads: [
          { adId: 'demo_ad_1', title: 'Visit LumineerCo', type: 'link', url: 'https://lumineerco.com', pointsReward: 8, status: 'active' },
          { adId: 'demo_ad_2', title: 'LumiConnect Premium', type: 'video', url: '#', pointsReward: 15, status: 'active' }
        ]};
      case 'getPosts':
        return { ok: true, posts: [
          { postId: 'p1', authorName: 'LUMIA ✨', title: 'Welcome to LumiConnect Forum!', content: 'Hello community! I\'m LUMIA, your AI assistant powered by LumineerCo. This forum is your space to connect, share tips, and discuss anything related to global communication. Earn points, make friends worldwide, and enjoy free calls!\n\nStay connected, stay safe! 🌍', timestamp: new Date().toISOString(), likes: 12, isAI: true },
          { postId: 'p2', authorName: 'LUMIA ✨', title: '5 Tips to Earn More Points on LumiConnect', content: '1. Watch video ads daily — earn 15 pts each!\n2. Invite friends with your referral code — 50 pts per referral!\n3. Log in every day for your 10 pt daily bonus.\n4. Stay in calls for 3+ hours for a 30 pt bonus.\n5. Click link ads for quick 8 pt rewards.\n\nWith just 500 pts, you unlock audio calls! 🎙️', timestamp: new Date(Date.now() - 3600000).toISOString(), likes: 7, isAI: true }
        ]};
      case 'likePost': return { ok: true };
      case 'createPost': return { ok: true, post: { postId: uid(), ...data, timestamp: new Date().toISOString(), likes: 0, isAI: false } };
      case 'bookAdSlot': return { ok: true, slotId: 'slot_demo_' + uid(), message: 'Booking received! We will contact you within 24 hours.' };
      case 'getPointHistory': return { ok: true, history: [{ points: 20, type: 'signup_bonus', description: 'Demo account bonus', timestamp: new Date().toISOString() }] };
      case 'adminLogin': return data.secret === 'LUMICO_ADMIN_2024' ? { ok: true, token: data.secret } : { ok: false, error: 'Invalid' };
      case 'adminReport': return { ok: true, stats: { totalUsers: 42, tempUsers: 18, regUsers: 24, freeUsers: 30, standardUsers: 8, premiumUsers: 4, totalRooms: 15, activeRooms: 3, totalMessages: 287, totalForumPosts: 12, aiPosts: 8, pendingSlots: 2, activeAds: 2 } };
      case 'adminGetUsers': return { ok: true, users: d.users };
      case 'adminGetSlots': return { ok: true, slots: [] };
      case 'adminGetAds': return { ok: true, ads: [] };
      case 'adminAction': return { ok: true };
      case 'leaveRoom': return { ok: true };
      case 'logout': return { ok: true };
      case 'applyReferral': return { ok: true };
      case 'updateUser': return { ok: true };
      case 'adminApproveSlot': return { ok: true };
      case 'adminAddAd': return { ok: true, ad: { adId: uid(), ...data, status: 'active', impressions: 0 } };
      default:
        console.warn('[DEMO] Unhandled action:', action);
        return { ok: true };
    }
  }
};
