// ============================================================
// LumiConnect - Config
// GAS_APP_URL is injected at build time via GitHub Actions
// ============================================================

const CONFIG = {
  // This will be replaced by GitHub Actions during deployment
  GAS_URL: '%%GAS_APP_URL%%',

  // App settings
  APP_NAME: 'LumiConnect',
  COMPANY:  'LumineerCo',
  VERSION:  '1.0.0',

  // Poll intervals (ms)
  CHAT_POLL_INTERVAL  : 2500,
  SIGNAL_POLL_INTERVAL: 1500,

  // PeerJS config (free public server)
  PEER_CONFIG: {
    host:   '0.peerjs.com',
    port:   443,
    secure: true,
    path:   '/',
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
      ]
    }
  },

  // Point values (mirror GAS)
  POINTS: {
    TEMP_SIGNUP   : 20,
    REG_SIGNUP    : 100,
    REFERRAL_BONUS: 50,
    CHAT_COST     : 1,
    AUDIO_COST    : 3,
    VIDEO_COST    : 5,
    WATCH_VIDEO_AD: 15,
    WATCH_LINK_AD : 8,
    LONG_CALL_BONUS: 30,
    DAILY_LOGIN   : 10
  },

  // Plan requirements
  PLAN_THRESHOLDS: {
    standard: 500,
    premium : 2000
  },

  // Plan capabilities
  PLANS: {
    free    : { chat: true,  audio: false, video: false, forumPost: false },
    standard: { chat: true,  audio: true,  video: false, forumPost: true  },
    premium : { chat: true,  audio: true,  video: true,  forumPost: true  }
  }
};

// Validate GAS URL
if (!CONFIG.GAS_URL || CONFIG.GAS_URL === '%%GAS_APP_URL%%') {
  console.warn('[LumiConnect] GAS_APP_URL not configured. Using demo mode.');
  CONFIG.GAS_URL = null; // Will use local fallback
  CONFIG.DEMO_MODE = true;
} else {
  CONFIG.DEMO_MODE = false;
}
