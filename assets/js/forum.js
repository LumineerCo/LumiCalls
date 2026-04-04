// ============================================================
// LumiConnect - Forum Module
// ============================================================

const Forum = {
  async load() {
    const container = document.getElementById('forum-posts');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner">Loading posts...</div>';
    const res = await API.getPosts({ limit: 20 });
    if (!res.ok) { container.innerHTML = '<p style="color:var(--text-muted);text-align:center">Could not load posts.</p>'; return; }
    if (!res.posts.length) { container.innerHTML = '<p style="color:var(--text-muted);text-align:center">No posts yet. Be the first!</p>'; return; }
    container.innerHTML = '';
    res.posts.forEach(post => container.appendChild(this.renderPost(post)));
    // Show post button for logged-in registered users
    const postBtn = document.getElementById('forum-post-btn');
    if (postBtn) postBtn.classList.toggle('hidden', !Auth.isRegistered());
  },

  renderPost(post) {
    const div = document.createElement('div');
    div.className = `forum-post${post.isAI || post.isAI === 'true' ? ' ai-post' : ''}`;
    const isAI = post.isAI === true || post.isAI === 'true';
    const initial = (post.authorName || 'A')[0].toUpperCase();
    const timeAgo = getTimeAgo(post.timestamp);
    div.innerHTML = `
      <div class="post-header">
        <div class="post-avatar${isAI ? ' lumia' : ''}">${isAI ? '🤖' : initial}</div>
        <div class="post-meta">
          <div class="post-author">${escHtml(post.authorName)}${isAI ? ' <span class="ai-tag">AI</span>' : ''}</div>
          <div class="post-time">${timeAgo}</div>
        </div>
      </div>
      <div class="post-title">${escHtml(post.title)}</div>
      <div class="post-content">${escHtml(post.content).replace(/\n/g, '<br>')}</div>
      <div class="post-footer">
        <button class="like-btn" onclick="likePost('${post.postId}', this)">❤️ ${post.likes || 0}</button>
        <span style="color:var(--text-muted);font-size:0.78rem">${isAI ? '✨ LUMIA' : '📝 Community'}</span>
      </div>
    `;
    return div;
  }
};

async function likePost(postId, btn) {
  await API.likePost({ ...Auth.getSessionData(), postId });
  const current = parseInt(btn.textContent.replace(/\D/g,'')) || 0;
  btn.textContent = `❤️ ${current + 1}`;
  btn.style.color = 'var(--pink)';
}

function showForumCompose() {
  if (!Auth.isRegistered()) { showToast('Login required to post', 'error'); showView('auth'); return; }
  document.getElementById('forum-compose').classList.remove('hidden');
}
function hideForumCompose() { document.getElementById('forum-compose').classList.add('hidden'); }

async function submitForumPost() {
  const title   = document.getElementById('forum-title').value.trim();
  const content = document.getElementById('forum-content').value.trim();
  if (!title || !content) { showToast('Fill title and content', 'error'); return; }
  const res = await API.createPost({ ...Auth.getSessionData(), title, content });
  if (res.ok) {
    showToast('Post published! -5 pts', 'success');
    Auth.updatePoints((Auth.user?.points || 0) - 5);
    document.getElementById('forum-title').value = '';
    document.getElementById('forum-content').value = '';
    hideForumCompose();
    Forum.load();
  } else {
    showToast(res.error || 'Could not post', 'error');
  }
}

async function loadForumPosts() { Forum.load(); }

function getTimeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}


// ============================================================
// LumiConnect - Points & Ads Module
// ============================================================

let adTimer = null;

async function watchAd(type = 'video') {
  const ads = await API.getAds();
  let ad = null;
  if (ads.ok && ads.ads?.length) {
    ad = ads.ads.find(a => a.type === type || (!type)) || ads.ads[0];
  }
  // Show ad modal
  const modal = document.getElementById('ad-modal');
  const content = document.getElementById('ad-content');
  const closeBtn = document.getElementById('ad-close-btn');
  const timerEl = document.getElementById('ad-timer');
  const rewardEl = document.getElementById('ad-reward-text');

  const isVideo = (ad?.type || type) === 'video';
  const wait = isVideo ? 15 : 8;
  const pts = isVideo ? CONFIG.POINTS.WATCH_VIDEO_AD : CONFIG.POINTS.WATCH_LINK_AD;

  if (ad?.type === 'link' && ad.url && ad.url !== '#') {
    // Link ad: open in new tab, short wait
    window.open(ad.url, '_blank');
  }

  content.innerHTML = ad
    ? `<div style="text-align:center;padding:20px">
        <h3 style="margin-bottom:12px">${escHtml(ad.title || 'Advertisement')}</h3>
        ${ad.type === 'banner' ? `<div style="background:linear-gradient(135deg,var(--cyan),var(--violet));padding:30px;border-radius:12px;color:#fff;font-family:var(--font-head)">${escHtml(ad.title)}</div>` : `<div style="font-size:4rem">📢</div><p style="color:var(--text-muted)">${escHtml(ad.title || 'LumiConnect')}</p>`}
        ${ad.url && ad.url !== '#' ? `<a href="${escHtml(ad.url)}" target="_blank" class="btn btn-glow mt">Visit →</a>` : ''}
       </div>`
    : `<div style="text-align:center;padding:30px">
        <div style="font-size:3rem;margin-bottom:12px">🌐</div>
        <h3>LumineerCo</h3>
        <p style="color:var(--text-muted)">Powering global connections</p>
        <p style="margin-top:16px;color:var(--cyan)">Advertise your business here!<br/>Visit <strong>Contact</strong> page to book a slot.</p>
       </div>`;

  rewardEl.textContent = `+${pts} ⚡ Points for watching`;
  closeBtn.disabled = true;
  modal.classList.remove('hidden');

  let remaining = wait;
  timerEl.textContent = `⏳ ${remaining}s`;
  clearInterval(adTimer);
  adTimer = setInterval(async () => {
    remaining--;
    timerEl.textContent = remaining > 0 ? `⏳ ${remaining}s` : '✅ Done!';
    if (remaining <= 0) {
      clearInterval(adTimer);
      closeBtn.disabled = false;
      closeBtn.onclick = async () => {
        modal.classList.add('hidden');
        const res = await API.watchAd({ ...Auth.getSessionData(), adType: isVideo ? 'video' : 'link', adId: ad?.adId });
        if (res.ok) {
          Auth.updatePoints(res.points);
          showToast(`+${res.earned} pts earned! ⚡`, 'success');
        }
      };
    }
  }, 1000);
}

function showModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

async function copyReferralCode() {
  const code = Auth.user?.referralCode;
  if (!code) return;
  const link = `${location.origin}${location.pathname}?ref=${code}`;
  try { await navigator.clipboard.writeText(link); showToast('Referral link copied!', 'success'); }
  catch { showToast('Code: ' + code, 'info'); }
}

function showInvite() {
  const room = window._currentRoom;
  if (!room) { showToast('No active room', 'error'); return; }
  const link = `${location.origin}${location.pathname}?room=${room.roomId}&type=${room.type}`;
  document.getElementById('invite-link').value = link;
  showModal('invite-modal');
}

function copyInvite() {
  const v = document.getElementById('invite-link').value;
  navigator.clipboard.writeText(v).then(() => showToast('Link copied!', 'success'));
}

function shareWhatsApp() {
  const v = document.getElementById('invite-link').value;
  window.open(`https://wa.me/?text=${encodeURIComponent('Join me on LumiConnect! ' + v)}`, '_blank');
}
function shareSMS() {
  const v = document.getElementById('invite-link').value;
  window.open(`sms:?body=${encodeURIComponent('Join me on LumiConnect! ' + v)}`, '_blank');
}
function shareEmail() {
  const v = document.getElementById('invite-link').value;
  window.open(`mailto:?subject=Join me on LumiConnect&body=${encodeURIComponent('Join me on LumiConnect!\n' + v)}`, '_blank');
}

async function loadProfileData() {
  if (!Auth.user) return;
  const u = Auth.user;
  document.getElementById('profile-avatar-lg').textContent = (u.username || 'G')[0].toUpperCase();
  document.getElementById('profile-username-display').textContent = u.username;
  document.getElementById('profile-plan-badge').textContent = (u.plan || 'free').charAt(0).toUpperCase() + (u.plan || 'free').slice(1);
  document.getElementById('profile-type-badge').textContent = u.accountType === 'registered' ? 'Registered' : 'Guest';
  document.getElementById('profile-points-big').textContent = u.points;
  document.getElementById('p-referrals').textContent = u.totalReferrals || 0;
  document.getElementById('p-plan').textContent = u.plan || 'free';
  document.getElementById('p-type').textContent = u.accountType;
  document.getElementById('referral-code-display').textContent = u.referralCode || '—';

  // Upgrade info
  const upgradeEl = document.getElementById('upgrade-info');
  if (upgradeEl) {
    const pts = u.points;
    if (u.plan === 'free') upgradeEl.innerHTML = `You need <strong>${Math.max(0, 500 - pts)}</strong> more points to unlock <strong>Standard</strong> plan (Audio Calls).`;
    else if (u.plan === 'standard') upgradeEl.innerHTML = `You need <strong>${Math.max(0, 2000 - pts)}</strong> more points to unlock <strong>Premium</strong> plan (Video Calls).`;
    else upgradeEl.innerHTML = `🏆 You're on <strong>Premium</strong>! Enjoy all features.`;
  }

  // Point history
  const histRes = await API.getPointHistory(Auth.getSessionData());
  const histEl = document.getElementById('point-history-list');
  if (histEl && histRes.ok) {
    histEl.innerHTML = histRes.history.slice(0, 15).map(h => `
      <div class="point-item">
        <span>${escHtml(h.description || h.type)}</span>
        <span class="${Number(h.points) > 0 ? 'earn' : 'spend'}">${Number(h.points) > 0 ? '+' : ''}${h.points} ⚡</span>
      </div>
    `).join('') || '<p style="color:var(--text-muted);font-size:0.8rem">No history yet.</p>';
  }
}


// ============================================================
// LumiConnect - Admin Module
// ============================================================

const Admin = {
  secret: null,

  async doLogin() {
    const secret = document.getElementById('admin-secret-input').value;
    const res = await API.adminLogin({ secret });
    if (res.ok) {
      this.secret = secret;
      document.getElementById('admin-login-screen').classList.add('hidden');
      document.getElementById('admin-panel').classList.remove('hidden');
      this.loadReport();
      this.loadUsers();
    } else {
      showToast('Invalid admin credentials', 'error');
    }
  },

  async loadReport() {
    const res = await API.adminReport({ adminSecret: this.secret });
    if (!res.ok) return;
    const s = res.stats;
    const grid = document.getElementById('admin-stats');
    grid.innerHTML = [
      ['Total Users', s.totalUsers], ['Registered', s.regUsers], ['Guest/Temp', s.tempUsers],
      ['Free Plan', s.freeUsers], ['Standard', s.standardUsers], ['Premium', s.premiumUsers],
      ['Active Rooms', s.activeRooms], ['Total Messages', s.totalMessages],
      ['Forum Posts', s.totalForumPosts], ['AI Posts', s.aiPosts],
      ['Pending Ads', s.pendingSlots], ['Active Ads', s.activeAds]
    ].map(([lbl, val]) => `
      <div class="admin-stat">
        <div class="val">${val}</div>
        <div class="lbl">${lbl}</div>
      </div>
    `).join('');
  },

  async loadUsers() {
    const res = await API.adminGetUsers({ adminSecret: this.secret });
    if (!res.ok) return;
    const table = document.getElementById('admin-users-table');
    table.innerHTML = `<table class="data-table">
      <thead><tr><th>Username</th><th>Email</th><th>Plan</th><th>Points</th><th>Type</th><th>Status</th></tr></thead>
      <tbody>${res.users.map(u => `
        <tr>
          <td>${escHtml(u.username)}</td>
          <td>${escHtml(u.email)}</td>
          <td>${u.plan}</td>
          <td>${u.points}</td>
          <td>${u.accountType}</td>
          <td><span style="color:${u.status==='active'?'var(--green)':'var(--pink)'}">${u.status}</span></td>
        </tr>
      `).join('')}</tbody>
    </table>`;
  },

  async loadSlots() {
    const res = await API.adminGetSlots({ adminSecret: this.secret });
    if (!res.ok) return;
    const table = document.getElementById('admin-slots-table');
    table.innerHTML = `<table class="data-table">
      <thead><tr><th>Company</th><th>Email</th><th>Ad Type</th><th>Budget</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${res.slots.map(s => `
        <tr>
          <td>${escHtml(s.company)}</td>
          <td>${escHtml(s.email)}</td>
          <td>${s.adType}</td>
          <td>${escHtml(s.budget)}</td>
          <td>${s.status}</td>
          <td>${s.status === 'pending' ? `<button class="btn btn-sm btn-glow" onclick="adminApproveSlotUI('${s.slotId}')">Approve</button>` : '—'}</td>
        </tr>
      `).join('')}</tbody>
    </table>`;
  },

  async loadAds() {
    const res = await API.adminGetAds({ adminSecret: this.secret });
    if (!res.ok) return;
    const table = document.getElementById('admin-ads-table');
    table.innerHTML = res.ads.length ? `<table class="data-table">
      <thead><tr><th>Title</th><th>Type</th><th>Points</th><th>Impressions</th><th>Status</th></tr></thead>
      <tbody>${res.ads.map(a => `<tr><td>${escHtml(a.title)}</td><td>${a.type}</td><td>+${a.pointsReward}</td><td>${a.impressions||0}</td><td>${a.status}</td></tr>`).join('')}</tbody>
    </table>` : '<p style="color:var(--text-muted)">No ads yet. Create one above.</p>';
  }
};

function doAdminLogin() { Admin.doLogin(); }

function adminTabSwitch(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.add('hidden'));
  event.target.classList.add('active');
  document.getElementById(`admin-tab-${tab}`)?.classList.remove('hidden');
  if (tab === 'adslots') Admin.loadSlots();
  if (tab === 'ads') Admin.loadAds();
}

async function adminApproveSlotUI(slotId) {
  const price = prompt('Agreed price (e.g. ₹5000/week):');
  if (!price) return;
  const start = prompt('Start date (YYYY-MM-DD):') || '';
  const end   = prompt('End date (YYYY-MM-DD):')   || '';
  await API.adminApproveSlot({ adminSecret: Admin.secret, slotId, status: 'approved', price, startDate: start, endDate: end });
  showToast('Slot approved!', 'success');
  Admin.loadSlots();
}

function showAddAdForm() { document.getElementById('admin-add-ad-form')?.classList.toggle('hidden'); }

async function adminCreateAd() {
  const ad = {
    adminSecret: Admin.secret,
    title: document.getElementById('ad-title').value,
    url:   document.getElementById('ad-url').value,
    type:  document.getElementById('ad-type').value,
    pointsReward: document.getElementById('ad-pts').value,
    slotId: document.getElementById('ad-slot-id').value
  };
  const res = await API.adminAddAd(ad);
  if (res.ok) { showToast('Ad created!', 'success'); Admin.loadAds(); }
}

async function adminTriggerLumia() {
  const res = await API.call('lumiaPost', { adminSecret: Admin.secret });
  showToast(res.ok ? 'LUMIA posted! 🤖' : 'Failed', res.ok ? 'success' : 'error');
}

async function adminDoUserAction() {
  const targetId = document.getElementById('admin-target-user').value.trim();
  const action   = document.getElementById('admin-user-action').value;
  const value    = document.getElementById('admin-action-value').value.trim();
  if (!targetId) { showToast('Enter user ID', 'error'); return; }
  const res = await API.adminAction({ adminSecret: Admin.secret, targetId, action, value });
  showToast(res.ok ? 'Action applied!' : res.error || 'Failed', res.ok ? 'success' : 'error');
  if (res.ok) Admin.loadUsers();
}
