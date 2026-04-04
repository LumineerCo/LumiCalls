// ============================================================
// LumiConnect - Authentication
// ============================================================

const Auth = {
  user: null,
  sessionId: null,

  init() {
    const saved = localStorage.getItem('lumiconnect_session');
    if (saved) {
      try {
        const { sessionId, user } = JSON.parse(saved);
        this.sessionId = sessionId;
        this.user = user;
        this.refreshUser();
      } catch(e) { this.clear(); }
    }
    this.updateUI();
  },

  async refreshUser() {
    if (!this.sessionId) return;
    const res = await API.getUser({ sessionId: this.sessionId });
    if (res.ok) {
      this.user = res.user;
      this.save();
      this.updateUI();
    } else {
      this.clear();
      this.updateUI();
    }
  },

  save() {
    if (this.sessionId && this.user) {
      localStorage.setItem('lumiconnect_session', JSON.stringify({
        sessionId: this.sessionId,
        user: this.user
      }));
    }
  },

  clear() {
    this.user = null;
    this.sessionId = null;
    localStorage.removeItem('lumiconnect_session');
  },

  updateUI() {
    const u = this.user;
    const navUser = document.getElementById('nav-user');
    const navAuthBtn = document.getElementById('nav-auth-btn');
    const navPoints = document.getElementById('nav-points');
    const navPtsVal = document.getElementById('nav-pts-val');

    if (u) {
      navUser.classList.remove('hidden');
      navAuthBtn.classList.add('hidden');
      navPoints.classList.remove('hidden');
      document.getElementById('nav-avatar').textContent = (u.username || 'G')[0].toUpperCase();
      document.getElementById('nav-username').textContent = u.username;
      navPtsVal.textContent = u.points;
    } else {
      navUser.classList.add('hidden');
      navAuthBtn.classList.remove('hidden');
      navPoints.classList.add('hidden');
    }
    // Update points displays
    ['chat','audio','video'].forEach(t => {
      const el = document.getElementById(`${t}-points-display`);
      if (el) el.textContent = `${u ? u.points : 0} ⚡`;
    });
    const profilePts = document.getElementById('profile-points-big');
    if (profilePts) profilePts.textContent = u ? u.points : 0;
  },

  updatePoints(newPts) {
    if (this.user) {
      this.user.points = newPts;
      this.save();
      this.updateUI();
    }
  },

  isLoggedIn() { return !!this.user; },
  isRegistered() { return this.user && this.user.accountType === 'registered'; },
  canDo(feature) {
    if (!this.user) return false;
    const plan = this.user.plan || 'free';
    return CONFIG.PLANS[plan] && CONFIG.PLANS[plan][feature];
  },
  getSessionData() {
    return {
      sessionId: this.sessionId,
      userId: this.user?.userId,
      username: this.user?.username || 'Guest'
    };
  }
};

// ── Login/Register Functions ──────────────────────────────

async function doTempLogin() {
  showLoading('Creating guest account...');
  const geo = await getGeo();
  const res = await API.createTempUser({ ...geo, referralCode: getUrlReferral() });
  if (res.ok) {
    Auth.user = res.user;
    Auth.sessionId = res.sessionId;
    Auth.save();
    Auth.updateUI();
    showToast('Welcome, ' + res.user.username + '! ⚡ 20 points added.', 'success');
    showView('home');
  } else {
    showToast(res.error || 'Failed to create account', 'error');
  }
  hideLoading();
}

async function doRegister() {
  const username = document.getElementById('reg-username').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const referral = document.getElementById('reg-referral').value.trim();
  if (!username || !email || !password) { showToast('Fill all fields', 'error'); return; }
  if (password.length < 6) { showToast('Password min 6 chars', 'error'); return; }
  showLoading('Creating account...');
  const geo = await getGeo();
  const res = await API.register({ username, email, password, referralCode: referral, ...geo });
  if (res.ok) {
    Auth.user = res.user;
    Auth.sessionId = res.sessionId;
    Auth.save();
    Auth.updateUI();
    showToast('Welcome ' + res.user.username + '! +100 pts 🎉', 'success');
    showView('home');
  } else {
    showToast(res.error || 'Registration failed', 'error');
  }
  hideLoading();
}

async function doLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  if (!email || !password) { showToast('Fill all fields', 'error'); return; }
  showLoading('Logging in...');
  const res = await API.login({ email, password });
  if (res.ok) {
    Auth.user = res.user;
    Auth.sessionId = res.sessionId;
    Auth.save();
    Auth.updateUI();
    showToast('Welcome back, ' + res.user.username + '!', 'success');
    showView('home');
  } else {
    showToast(res.error || 'Login failed', 'error');
  }
  hideLoading();
}

async function doLogout() {
  if (Auth.sessionId) await API.logout({ sessionId: Auth.sessionId });
  Auth.clear();
  Auth.updateUI();
  showToast('Logged out', 'info');
  showView('home');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', ['login','register','temp'][i] === tab);
  });
  ['login','register','temp'].forEach(t => {
    document.getElementById(`auth-${t}`).classList.toggle('hidden', t !== tab);
  });
}

// ── Location Helper ───────────────────────────────────────

async function getGeo() {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    return { country: data.country_name || '', city: data.city || '' };
  } catch { return { country: '', city: '' }; }
}

function getUrlReferral() {
  const p = new URLSearchParams(window.location.search);
  return p.get('ref') || '';
}

// Show/hide loading overlay (reuse toast)
function showLoading(msg) { showToast(msg, 'info'); }
function hideLoading() {}
