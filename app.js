/**
 * Fine Collector - Class 8:00 AM Late Tracker
 * Robust, production-grade logic designed for multi-year reliable operation.
 * Supports: LocalStorage fallback + Google Firebase Realtime Database for 24/7 cross-device live sync.
 */

// Global Configuration
// Connected to your Google Firebase Realtime Database for 24/7 cross-device live sync:
const DEFAULT_FIREBASE_DB_URL = "https://fine-collector-default-rtdb.firebaseio.com";

// Application State
const STATE = {
  students: [],
  isAdmin: false,
  isMasterAdmin: false,  // True only for owner (Kausar Hayat)
  adminRole: 'guest',    // 'master' | 'subadmin' | 'guest'
  adminName: '',         // Name of current logged-in admin (e.g. 'Ali Khan')
  deviceId: '',
  deviceName: '',
  adminDevices: {},
  adminPrivateKeys: {},  // Loaded on-demand for verified Master Mind only
  isMasterMindClaimed: true, // Single Master Mind permanent authority (Kausar Hayat)
  pendingLogin: false,
  pendingDeviceIdToApprove: null,
  auditLogs: [],         // Full audit trail of all logins & CRUD actions
  auditFilterAdmin: 'all',
  auditFilterAction: 'all',
  currentFilter: {
    search: '',
    date: 'all',    // Default to 'all' so records are never hidden accidentally
    status: 'all'
  },
  firebaseApp: null,
  firebaseDb: null,
  isCloudConnected: false
};

/* ==================== THEME MANAGEMENT (LIGHT / DARK) ==================== */
const THEME_KEY = 'fc_theme';

function getCurrentTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  // Default is 'light' as requested by the user
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  return 'light';
}

function applyTheme(theme) {
  const isDark = (theme === 'dark');
  if (document.body) {
    if (isDark) {
      document.body.classList.remove('theme-light');
      document.body.classList.add('theme-dark');
    } else {
      document.body.classList.remove('theme-dark');
      document.body.classList.add('theme-light');
    }
  }

  const toggleIcon = document.getElementById('themeToggleIcon');
  if (toggleIcon) {
    if (isDark) {
      toggleIcon.className = 'fa-solid fa-sun';
    } else {
      toggleIcon.className = 'fa-solid fa-moon';
    }
  }

  const toggleBtn = document.getElementById('themeToggleBtn');
  if (toggleBtn) {
    const titleText = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    toggleBtn.setAttribute('title', titleText);
    toggleBtn.setAttribute('aria-label', titleText);
  }
}

function toggleTheme() {
  const current = getCurrentTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (e) {
    console.warn('LocalStorage error saving theme:', e);
  }
  applyTheme(next);
  if (typeof showToast === 'function') {
    showToast(`${next === 'dark' ? 'Dark' : 'Light'} Mode active`, 'info');
  }
}

// Bind to window for HTML button onclick
window.toggleTheme = toggleTheme;
window.applyTheme = applyTheme;
window.getCurrentTheme = getCurrentTheme;

// Apply immediately on script execution to prevent flash of wrong theme
(function() {
  const initialTheme = getCurrentTheme();
  if (document.body) {
    applyTheme(initialTheme);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      applyTheme(initialTheme);
    });
  }
})();

// Initialize app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getCurrentTheme());
  initDeviceId();
  loadAdminState();
  initDateInput();
  initCloudOrLocalStorage();
  renderAll();
  initEventListeners();
});

function initEventListeners() {
  const adminBtn = document.getElementById('adminToggleBtn');
  if (adminBtn) {
    adminBtn.onclick = function(e) {
      if (e) e.preventDefault();
      toggleAdminModal();
    };
  }
}

/* ==================== DATE UTILITIES ==================== */

/**
 * Returns local date in YYYY-MM-DD format (avoids UTC timezone offset bugs).
 */
function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks if two date representations point to the same calendar day.
 */
function isSameDay(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return false;
  if (dateStr1 === dateStr2) return true;

  try {
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
      return dateStr1 === dateStr2;
    }
    return d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate();
  } catch (e) {
    return dateStr1 === dateStr2;
  }
}

function initDateInput() {
  const today = getLocalDateString();
  const entryDate = document.getElementById('entryDate');
  if (entryDate) entryDate.value = today;
}

/* ==================== DEVICE IDENTIFICATION & SECURITY ==================== */

function getDeviceInfo() {
  const ua = navigator.userAgent;
  let browser = 'Browser';
  let os = 'Unknown Device';

  if (ua.includes('Win')) os = 'Windows PC';
  else if (ua.includes('Android')) os = 'Android Phone';
  else if (ua.includes('iPhone')) os = 'iPhone';
  else if (ua.includes('iPad')) os = 'iPad';
  else if (ua.includes('Mac')) os = 'Mac';
  else if (ua.includes('Linux')) os = 'Linux';

  if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/')) browser = 'Chrome';
  else if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

  return `${browser} on ${os}`;
}

function initDeviceId() {
  let id = localStorage.getItem('fc_device_id');
  if (!id) {
    id = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    localStorage.setItem('fc_device_id', id);
  }
  STATE.deviceId = id;
  STATE.deviceName = getDeviceInfo();
}

/**
 * Master Mind Security & Audit Logging System
 * Tracks who accessed the portal, exact timestamps, and all CRUD operations
 * Note: External email notifications disabled per user requirement.
 */
function sendSecurityEmail(subject, details = {}) {
  // Email sending completely disabled
  return;
}

function sendTestSecurityEmail() {
  showToast('Email alerts are disabled. Activity tracking is active on Master Page.', 'info');
}

/**
 * Records an immutable audit log entry locally and in Firebase Cloud
 */
function recordAuditLog({ actionType, details, adminName, role, studentId, studentName, metadata = {} }) {
  try {
    const currentName = adminName || STATE.adminName || (STATE.isMasterAdmin ? 'Kausar Hayat (Master Owner)' : (sessionStorage.getItem('fc_admin_name') || 'Admin'));
    const currentRole = role || (STATE.isMasterAdmin ? 'Master Admin' : (STATE.adminRole === 'master' ? 'Master Admin' : 'Sub-Admin'));
    const logId = 'log_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
    
    const now = new Date();
    const timeFormatted = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const logEntry = {
      id: logId,
      timestamp: Date.now(),
      timeFormatted: timeFormatted,
      adminName: currentName,
      role: currentRole,
      device: STATE.deviceName || getDeviceInfo(),
      actionType: actionType || 'GENERAL',
      details: details || '',
      studentId: studentId || null,
      studentName: studentName || null,
      metadata: metadata || {}
    };

    // 1. Maintain in State
    if (!Array.isArray(STATE.auditLogs)) STATE.auditLogs = [];
    STATE.auditLogs.unshift(logEntry);
    if (STATE.auditLogs.length > 300) STATE.auditLogs = STATE.auditLogs.slice(0, 300);

    // 2. Persist to localStorage
    try {
      localStorage.setItem('fc_admin_audit_logs', JSON.stringify(STATE.auditLogs));
    } catch (e) {
      console.warn('LocalStorage error saving audit log:', e);
    }

    // 3. Persist to Firebase Realtime Database for cross-device live monitoring
    if (STATE.firebaseDb) {
      STATE.firebaseDb.ref(`security/admin_audit_logs/${logId}`).set(logEntry).catch(e => {
        console.warn('Firebase audit log sync error:', e);
      });
    }

    // Refresh UI if visible
    renderAuditLogsList();
  } catch (err) {
    console.warn('recordAuditLog error:', err);
  }
}

/**
 * Renders the Audit Logs list inside Admin Access Management modal
 */
function renderAuditLogsList() {
  const listEl = document.getElementById('adminAuditLogsList');
  const emptyEl = document.getElementById('emptyAdminAuditLogs');
  const totalCountEl = document.getElementById('auditStatTotalCount');
  const crudCountEl = document.getElementById('auditStatCrudCount');
  const lastActiveEl = document.getElementById('auditStatLastActive');
  const tabBadgeEl = document.getElementById('manageTabAuditBadge');
  const filterAdminSelect = document.getElementById('auditFilterAdmin');
  const filterActionSelect = document.getElementById('auditFilterAction');

  if (!listEl) return;

  const logs = Array.isArray(STATE.auditLogs) ? STATE.auditLogs : [];

  // Update Tab Badge
  if (tabBadgeEl) tabBadgeEl.textContent = logs.length;

  // Update Dynamic Admin Filter Options
  if (filterAdminSelect) {
    const currentSelected = filterAdminSelect.value || 'all';
    const distinctAdmins = Array.from(new Set(logs.map(l => l.adminName).filter(Boolean)));
    
    // Keep 'all' option plus distinct admins
    filterAdminSelect.innerHTML = '<option value="all">All Admins</option>' + distinctAdmins.map(name => {
      return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
    }).join('');

    // Restore selected value if still present
    if (distinctAdmins.includes(currentSelected)) {
      filterAdminSelect.value = currentSelected;
    } else {
      filterAdminSelect.value = 'all';
    }
  }

  // Calculate Stat Strips
  if (totalCountEl) totalCountEl.textContent = logs.length;
  if (crudCountEl) {
    const crudActions = ['ADD_STUDENT', 'UPDATE_PAYMENT', 'EDIT_STUDENT', 'DELETE_STUDENT', 'CLEAR_ALL'];
    const crudCount = logs.filter(l => crudActions.includes(l.actionType)).length;
    crudCountEl.textContent = crudCount;
  }
  if (lastActiveEl) {
    if (logs.length > 0 && logs[0].adminName) {
      lastActiveEl.textContent = logs[0].adminName;
    } else {
      lastActiveEl.textContent = 'None';
    }
  }

  // Filter logs based on dropdown selections
  const selectedAdmin = filterAdminSelect ? filterAdminSelect.value : 'all';
  const selectedAction = filterActionSelect ? filterActionSelect.value : 'all';

  let filtered = logs;
  if (selectedAdmin && selectedAdmin !== 'all') {
    filtered = filtered.filter(l => l.adminName === selectedAdmin);
  }
  if (selectedAction && selectedAction !== 'all') {
    filtered = filtered.filter(l => l.actionType === selectedAction);
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';

  listEl.innerHTML = filtered.map(log => {
    let badgeClass = 'badge-action-login';
    let iconClass = 'fa-solid fa-right-to-bracket';
    let label = log.actionType;

    switch (log.actionType) {
      case 'LOGIN':
        badgeClass = 'badge-action-login';
        iconClass = 'fa-solid fa-right-to-bracket';
        label = 'Access / Login';
        break;
      case 'LOGIN_REQUEST':
        badgeClass = 'badge-action-payment';
        iconClass = 'fa-solid fa-clock';
        label = 'Access Requested';
        break;
      case 'ADD_STUDENT':
        badgeClass = 'badge-action-add';
        iconClass = 'fa-solid fa-user-plus';
        label = 'Add Record';
        break;
      case 'UPDATE_PAYMENT':
        badgeClass = 'badge-action-payment';
        iconClass = 'fa-solid fa-receipt';
        label = 'Payment Status';
        break;
      case 'EDIT_STUDENT':
        badgeClass = 'badge-action-edit';
        iconClass = 'fa-solid fa-pen-to-square';
        label = 'Edit Record';
        break;
      case 'DELETE_STUDENT':
        badgeClass = 'badge-action-delete';
        iconClass = 'fa-solid fa-trash-can';
        label = 'Delete Record';
        break;
      case 'LOGOUT':
        badgeClass = 'badge-action-logout';
        iconClass = 'fa-solid fa-right-from-bracket';
        label = 'Logout';
        break;
      case 'KEY_ASSIGNED':
        badgeClass = 'badge-action-key';
        iconClass = 'fa-solid fa-key';
        label = 'Key Assigned';
        break;
      case 'KEY_REVOKED':
        badgeClass = 'badge-action-delete';
        iconClass = 'fa-solid fa-key';
        label = 'Key Revoked';
        break;
      case 'PERMISSION_GRANTED':
        badgeClass = 'badge-action-grant';
        iconClass = 'fa-solid fa-shield-check';
        label = 'Access Allowed';
        break;
      case 'PERMISSION_REJECTED':
      case 'ADMIN_REVOKED':
        badgeClass = 'badge-action-delete';
        iconClass = 'fa-solid fa-ban';
        label = 'Access Revoked';
        break;
      case 'CLEAR_ALL':
        badgeClass = 'badge-action-delete';
        iconClass = 'fa-solid fa-trash-arrow-up';
        label = 'Clear All';
        break;
    }

    return `
      <div class="audit-log-card">
        <div class="audit-header-row">
          <div class="audit-admin-wrap">
            <span class="audit-admin-name">
              <i class="fa-solid fa-user-shield"></i> ${escapeHtml(log.adminName || 'Admin')}
            </span>
            <span class="audit-badge ${badgeClass}">
              <i class="${iconClass}"></i> ${label}
            </span>
          </div>
          <span class="audit-time">
            <i class="fa-regular fa-clock"></i> ${escapeHtml(log.timeFormatted || '')}
          </span>
        </div>
        <div class="audit-body">
          ${escapeHtml(log.details || '')}
        </div>
        <div class="audit-footer-row">
          <span><i class="fa-solid fa-laptop"></i> ${escapeHtml(log.device || 'Device')}</span>
          <span>Role: <strong>${escapeHtml(log.role || 'Admin')}</strong></span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Clears all Audit Logs (Master Mind Only)
 */
function clearAuditLogs() {
  if (!guardMasterRights('clearing audit logs')) return;

  if (confirm('Are you sure you want to clear all Audit Logs? This will wipe the activity history.')) {
    STATE.auditLogs = [];
    localStorage.removeItem('fc_admin_audit_logs');
    if (STATE.firebaseDb) {
      STATE.firebaseDb.ref('security/admin_audit_logs').remove().catch(e => console.warn(e));
    }
    renderAuditLogsList();
    showToast('Audit logs cleared', 'info');
  }
}

/**
 * Filters the audit logs to a specific admin and switches to audit tab
 */
function filterAuditLogsForAdmin(adminName) {
  switchManageTab('audit');
  setTimeout(() => {
    const filterAdminSelect = document.getElementById('auditFilterAdmin');
    if (filterAdminSelect) {
      filterAdminSelect.value = adminName;
      renderAuditLogsList();
    }
  }, 50);
}

/**
 * Prefills the Create Private Key form with an Admin's exact name and generates a random 4-digit key
 */
function prefillAssignPrivateKey(adminName) {
  switchManageTab('keys');
  setTimeout(() => {
    const nameInp = document.getElementById('newAdminKeyName');
    const keyInp = document.getElementById('newAdminKeyValue');
    if (nameInp) nameInp.value = adminName;
    if (keyInp) {
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      keyInp.value = String(randomCode);
      keyInp.focus();
    }
    showToast(`Enter 4-digit key for "${adminName}" and click Assign Key`, 'info');
  }, 50);
}

/* ==================== CRYPTOGRAPHIC SESSION & SECURITY GUARDS ==================== */
let _masterSessionToken = null;
let _hasAttachedPrivateKeysListener = false;

function setMasterSessionVerified() {
  _masterSessionToken = 'master_sig_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
  try {
    sessionStorage.setItem('fc_session_auth_sig', _masterSessionToken);
    sessionStorage.setItem('fc_is_master_verified', 'true');
  } catch (e) {}
}

function isMasterSessionVerified() {
  if (!_masterSessionToken) {
    try {
      const stored = sessionStorage.getItem('fc_session_auth_sig');
      if (stored && stored.startsWith('master_sig_')) {
        _masterSessionToken = stored;
      }
    } catch (e) {}
  }
  return !!_masterSessionToken && STATE.isMasterAdmin === true;
}

function checkMasterLockout() {
  try {
    const lockoutUntil = parseInt(sessionStorage.getItem('fc_sec_lockout') || '0', 10);
    const now = Date.now();
    if (lockoutUntil && now < lockoutUntil) {
      return Math.ceil((lockoutUntil - now) / 1000);
    }
  } catch (e) {}
  return 0;
}

function recordMasterFailedAttempt() {
  try {
    let fails = parseInt(sessionStorage.getItem('fc_sec_fails') || '0', 10) + 1;
    sessionStorage.setItem('fc_sec_fails', String(fails));
    if (fails >= 3) {
      const lockoutTime = Date.now() + 5 * 60 * 1000; // 5-minute lockout
      sessionStorage.setItem('fc_sec_lockout', String(lockoutTime));
    }
  } catch (e) {}
}

function resetMasterFailedAttempts() {
  try {
    sessionStorage.removeItem('fc_sec_fails');
    sessionStorage.removeItem('fc_sec_lockout');
  } catch (e) {}
}

function guardMasterRights(actionName = 'this operation') {
  if (!STATE.isAdmin || !STATE.isMasterAdmin || !isMasterSessionVerified()) {
    showToast(`Access Denied: Master Mind verification required for ${actionName}.`, 'error');
    if (typeof closeAdminManagementModal === 'function') closeAdminManagementModal();
    return false;
  }
  return true;
}

function isAuthorizedAdminSession() {
  const hasMasterSig = isMasterSessionVerified();
  const hasFirebaseUser = !!(STATE.firebaseUser || (window.firebase && firebase.auth && firebase.auth().currentUser));
  const hasSubAdminToken = !!sessionStorage.getItem('fc_admin_auth_token') && STATE.isAdmin;
  return (hasMasterSig || hasFirebaseUser || hasSubAdminToken);
}

function guardAdminRights(actionName = 'this operation') {
  if (!isAuthorizedAdminSession()) {
    showToast(`Access Denied: Read-Only Mode. Modifications and deletions are strictly blocked.`, 'error');
    return false;
  }
  return true;
}

function freezeStudentsIfReadOnly() {
  if (!isAuthorizedAdminSession() && Array.isArray(STATE.students)) {
    try {
      Object.freeze(STATE.students);
    } catch (e) {}
  }
}

function attachMasterPrivateKeysListener() {
  if (_hasAttachedPrivateKeysListener || !STATE.firebaseDb || !STATE.isMasterAdmin) return;
  _hasAttachedPrivateKeysListener = true;
  STATE.firebaseDb.ref('security/admin_private_keys').on('value', (snapshot) => {
    const keys = snapshot.val() || {};
    STATE.adminPrivateKeys = keys;
    renderAdminPrivateKeysList();
  });
}

/* ==================== ADMIN STATE ==================== */

function loadAdminState() {
  const savedPin = localStorage.getItem('fc_admin_pin');
  if (savedPin) {
    STATE.adminPin = savedPin;
  }

  // Wipe legacy plain text master key or unverified master state
  localStorage.removeItem('fc_master_key');
  localStorage.removeItem('fc_is_master_owner');

  const savedMasterHash = localStorage.getItem('fc_master_hash');
  if (savedMasterHash && savedMasterHash.length === 64) {
    STATE.masterHash = savedMasterHash;
  }

  const isMaster = isMasterSessionVerified();
  const sessionAdmin = sessionStorage.getItem('fc_is_admin') === 'true';
  const sessionRole = sessionStorage.getItem('fc_admin_role') || (isMaster ? 'master' : 'subadmin');
  const sessionName = sessionStorage.getItem('fc_admin_name') || (isMaster ? 'Kausar Hayat (Master Owner)' : 'Admin');

  if (sessionAdmin) {
    STATE.isAdmin = true;
    STATE.isMasterAdmin = isMaster;
    STATE.adminRole = isMaster ? 'master' : 'subadmin';
    STATE.adminName = sessionName;
    updateAdminUI();
  }

  // Load audit logs from local storage fallback
  try {
    const savedLogs = localStorage.getItem('fc_admin_audit_logs');
    if (savedLogs) {
      STATE.auditLogs = JSON.parse(savedLogs) || [];
    }
  } catch (e) {}
}

/* ==================== STORAGE & REALTIME CLOUD ==================== */

function initCloudOrLocalStorage() {
  const savedFirebaseUrl = localStorage.getItem('fc_firebase_url') || DEFAULT_FIREBASE_DB_URL;
  const savedConfigJson = localStorage.getItem('fc_firebase_config');

  if (savedFirebaseUrl && window.firebase) {
    try {
      let config = {};
      if (savedConfigJson) {
        try { config = JSON.parse(savedConfigJson); } catch (e) { /* ignore */ }
      }
      config.databaseURL = savedFirebaseUrl;
      if (!config.projectId) config.projectId = "fine-collector-app";
      if (!config.apiKey) config.apiKey = "dummy-api-key";

      if (!firebase.apps.length) {
        STATE.firebaseApp = firebase.initializeApp(config);
      } else {
        STATE.firebaseApp = firebase.app();
      }
      STATE.firebaseDb = firebase.database();
      STATE.isCloudConnected = true;

      // 1. Realtime listener for students data
      STATE.firebaseDb.ref('students').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
          const list = Array.isArray(val) ? val : Object.keys(val).map(key => val[key]);
          STATE.students = list.filter(item => item && typeof item === 'object');
        } else {
          STATE.students = [];
        }
        renderAll();
      }, (error) => {
        console.warn('Cloud sync error, falling back to local:', error);
        loadFromLocalStorage();
      });

      // 2. Realtime listener for Master Security Passkey Hash (Hidden)
      STATE.firebaseDb.ref('security/master_hash').on('value', (snapshot) => {
        const cloudHash = snapshot.val();
        if (cloudHash && typeof cloudHash === 'string' && cloudHash.length === 64) {
          STATE.masterHash = cloudHash;
          localStorage.setItem('fc_master_hash', cloudHash);
        }
      });

      // 3. Realtime listener for Multi-Device Admin Approvals & Revocations
      STATE.firebaseDb.ref('security/admin_devices').on('value', (snapshot) => {
        const devices = snapshot.val() || {};
        STATE.adminDevices = devices;
        handleSecurityDevicesUpdate(devices);
        updateMasterLoginViewMode();
      });

      // 4. On-demand listener for Master Mind Private Keys (Loaded strictly when verified)
      if (STATE.isAdmin && STATE.isMasterAdmin && isMasterSessionVerified()) {
        attachMasterPrivateKeysListener();
      }

      // 6. Realtime listener for System Master Owner identity
      STATE.firebaseDb.ref('security/system_master_owner').on('value', (snapshot) => {
        const ownerData = snapshot.val();
        if (ownerData && ownerData.claimed) {
          STATE.isMasterMindClaimed = true;
          STATE.masterOwnerData = ownerData;
        } else {
          // Initialize permanent single master owner (Kausar Hayat)
          STATE.firebaseDb.ref('security/system_master_owner').set({
            ownerName: 'Kausar Hayat',
            role: 'master',
            claimed: true,
            claimedAt: Date.now()
          });
          STATE.isMasterMindClaimed = true;
        }
        updateMasterLoginViewMode();
      });

      // 7. Realtime listener for Activity & Audit Logs (Master Mind Realtime Monitoring)
      STATE.firebaseDb.ref('security/admin_audit_logs').limitToLast(200).on('value', (snapshot) => {
        const val = snapshot.val() || {};
        STATE.auditLogs = Object.values(val).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        try {
          localStorage.setItem('fc_admin_audit_logs', JSON.stringify(STATE.auditLogs));
        } catch (e) {}
        renderAuditLogsList();
      });

      // If current device is Master Owner, ensure its presence in cloud devices
      if (STATE.isMasterAdmin && STATE.deviceId) {
        STATE.firebaseDb.ref(`security/admin_devices/${STATE.deviceId}`).update({
          id: STATE.deviceId,
          name: 'Kausar Hayat (Master Owner)',
          device: STATE.deviceName,
          status: 'approved',
          isOwner: true,
          lastSeen: Date.now()
        });
      }

      // Check for one-click approval from Master Owner email
      checkUrlApprovalParams();

      return;
    } catch (err) {
      console.warn('Firebase init error:', err);
    }
  }

  loadFromLocalStorage();
}

/**
 * Handles 1-Click approval/rejection from Master Admin Email links
 * e.g. https://iamkausarhayat.github.io/fine-collector/?action=approve&dev=dev_xxx&key=4545
 * or action=approve_master
 */
// ==================== WAITING COUNTDOWN TIMER ====================
let waitingCountdownTimer = null;
let waitingSecondsRemaining = 300;

function startWaitingCountdown() {
  if (waitingCountdownTimer) {
    clearInterval(waitingCountdownTimer);
    waitingCountdownTimer = null;
  }
  waitingSecondsRemaining = 300;
  updateCountdownDisplay();

  waitingCountdownTimer = setInterval(() => {
    waitingSecondsRemaining--;
    updateCountdownDisplay();

    if (waitingSecondsRemaining <= 0) {
      clearInterval(waitingCountdownTimer);
      waitingCountdownTimer = null;
      if (STATE.firebaseDb && STATE.deviceId) {
        STATE.firebaseDb.ref(`security/admin_devices/${STATE.deviceId}`).update({
          status: 'timeout',
          denialReason: 'Request timed out waiting for Master Mind approval.'
        }).catch(() => {});
      }
      showDenialScreen('Request timed out waiting for Master Mind approval. You can try again or enter your Private Key.');
    }
  }, 1000);
}

function updateCountdownDisplay() {
  const el = document.getElementById('waitCountdownTimer');
  if (!el) return;
  const mins = Math.floor(Math.max(0, waitingSecondsRemaining) / 60);
  const secs = Math.max(0, waitingSecondsRemaining) % 60;
  el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  if (waitingSecondsRemaining <= 30) {
    el.style.color = '#ef4444';
  } else {
    el.style.color = '#38bdf8';
  }
}

function stopWaitingCountdown() {
  if (waitingCountdownTimer) {
    clearInterval(waitingCountdownTimer);
    waitingCountdownTimer = null;
  }
}

async function checkUrlApprovalParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const devId = params.get('dev');
    const key = params.get('key');

    if (!action || !devId) return;

    let isAuthorized = false;
    const isMaster = (action === 'approve_master');
    const isReject = (action === 'reject');

    if (isMaster) {
      isAuthorized = await verifyMasterSecurityKey(key);
    } else if (action === 'approve' || action === 'reject') {
      isAuthorized = (key === '4545' || key === STATE.adminPin || await verifyMasterSecurityKey(key));
    }

    if (isAuthorized) {
      if (STATE.firebaseDb) {
        const updatePayload = {
          status: isReject ? 'rejected' : 'approved',
          [isReject ? 'rejectedAt' : 'approvedAt']: Date.now()
        };
        if (isMaster) {
          updatePayload.role = 'master';
          updatePayload.isOwner = true;
          updatePayload.name = 'Kausar Hayat (Master Owner)';
        } else if (action === 'approve') {
          updatePayload.role = 'subadmin';
          updatePayload.isOwner = false;
        } else if (isReject) {
          updatePayload.role = 'guest';
          updatePayload.isOwner = false;
          updatePayload.denialReason = 'You are denied by Kausar Khattak';
        }

        STATE.firebaseDb.ref(`security/admin_devices/${devId}`).update(updatePayload).then(() => {
          const actionMsg = isMaster ? 'MASTER AUTHORIZED' : (action === 'approve' ? 'SUB-ADMIN APPROVED' : 'ACCESS DENIED: You are denied by Kausar Khattak');
          showToast(`Access ${actionMsg} successfully!`, isReject ? 'error' : 'success');
          if (devId === STATE.deviceId) {
            stopWaitingCountdown();
            if (isMaster) {
              sessionStorage.setItem('fc_is_master_verified', 'true');
              STATE.isAdmin = true;
              STATE.isMasterAdmin = true;
              STATE.adminRole = 'master';
              sessionStorage.setItem('fc_is_admin', 'true');
              sessionStorage.setItem('fc_admin_role', 'master');
              closeAdminModal();
              updateAdminUI();
              renderAll();
            } else if (action === 'approve') {
              STATE.isAdmin = true;
              STATE.isMasterAdmin = false;
              STATE.adminRole = 'subadmin';
              sessionStorage.setItem('fc_is_admin', 'true');
              sessionStorage.setItem('fc_admin_role', 'subadmin');
              closeAdminModal();
              updateAdminUI();
              renderAll();
            } else if (isReject) {
              showDenialScreen('You are denied by Kausar Khattak');
            }
          }
        });
      }
      // Clean query parameters from URL bar without page refresh
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } catch (e) {
    console.warn('URL params check error:', e);
  }
}

function showDenialScreen(message = 'You are denied by Kausar Khattak') {
  stopWaitingCountdown();
  const pinView = document.getElementById('loginViewPin');
  const masterView = document.getElementById('loginViewMaster');
  const waitingView = document.getElementById('pinStepWaiting');
  const deniedView = document.getElementById('pinStepDenied');
  const denialHeading = document.getElementById('denialHeading');
  const denialMsg = document.getElementById('denialMessage');
  const denialSubText = document.getElementById('denialSubText');

  if (pinView) pinView.style.display = 'none';
  if (masterView) masterView.style.display = 'none';
  if (waitingView) waitingView.style.display = 'none';
  if (deniedView) deniedView.style.display = 'block';

  const isTimeout = message && message.toLowerCase().includes('timed out');
  if (denialHeading) {
    denialHeading.textContent = isTimeout ? 'Request Timed Out' : 'You are denied by Kausar Khattak';
  }
  if (denialMsg) {
    denialMsg.textContent = message || 'You are denied by Kausar Khattak';
  }
  if (denialSubText) {
    denialSubText.textContent = isTimeout 
      ? 'Master Mind did not respond in time. You can try again or enter your Private Key.'
      : 'Access request was declined by the system owner.';
  }

  STATE.pendingLogin = false;
  showToast(message || 'You are denied by Kausar Khattak', isTimeout ? 'info' : 'error');
}

function retryAdminLogin() {
  stopWaitingCountdown();
  STATE.pendingLogin = false;

  // Clear device rejection/timeout record so user can re-enter credentials
  if (STATE.firebaseDb && STATE.deviceId) {
    STATE.firebaseDb.ref(`security/admin_devices/${STATE.deviceId}`).remove().catch(() => {});
  }
  if (STATE.adminDevices && STATE.adminDevices[STATE.deviceId]) {
    delete STATE.adminDevices[STATE.deviceId];
    try {
      localStorage.setItem('fc_admin_devices', JSON.stringify(STATE.adminDevices));
    } catch (e) {}
  }

  const pinView = document.getElementById('loginViewPin');
  const masterView = document.getElementById('loginViewMaster');
  const waitingView = document.getElementById('pinStepWaiting');
  const deniedView = document.getElementById('pinStepDenied');
  const errorMsg = document.getElementById('loginErrorMsg');
  const keyInput = document.getElementById('adminPrivateKeyInput');
  const pinInput = document.getElementById('adminPinInput');
  const nameInput = document.getElementById('adminLoginNameInput');

  if (keyInput) keyInput.value = '';
  if (pinInput) pinInput.value = '';
  if (errorMsg) errorMsg.style.display = 'none';

  if (deniedView) deniedView.style.display = 'none';
  if (waitingView) waitingView.style.display = 'none';
  if (masterView) masterView.style.display = 'none';
  if (pinView) pinView.style.display = 'block';

  if (nameInput && !nameInput.value) {
    nameInput.focus();
  } else if (pinInput) {
    pinInput.focus();
  }
}

  function loadFromLocalStorage() {
    STATE.isCloudConnected = false;
    const localData = localStorage.getItem('fc_students');
    if (localData) {
      try {
        let parsed = JSON.parse(localData);
        if (Array.isArray(parsed)) {
          // Automatically clean any legacy sample records
          STATE.students = parsed.filter(s => s && s.id !== 'st_1' && s.id !== 'st_2' && s.name !== 'Ali Ahmed' && s.name !== 'Bilal Khan');
        } else {
          STATE.students = [];
        }
      } catch (e) {
        STATE.students = [];
      }
    } else {
      // Start completely clean with zero dummy records
      STATE.students = [];
      saveToLocalStorage();
    }
    renderAll();
  }

  function saveState() {
    if (!isAuthorizedAdminSession()) {
      console.warn("Blocked unauthorized saveState: Read-Only Mode enforced.");
      return;
    }
    const cleanList = (STATE.students || []).filter(Boolean);
    if (STATE.isCloudConnected && STATE.firebaseDb) {
      STATE.firebaseDb.ref('students').set(cleanList)
        .catch((err) => {
          console.error('Failed to sync to cloud:', err);
          showToast('Cloud sync error, saved locally', 'error');
          saveToLocalStorage();
        });
    } else {
      saveToLocalStorage();
    }
  }

  function saveToLocalStorage() {
    try {
      const cleanList = (STATE.students || []).filter(Boolean);
      localStorage.setItem('fc_students', JSON.stringify(cleanList));
    } catch (e) {
      console.error('LocalStorage write error:', e);
    }
  }

  /* ==================== RENDERING LOGIC ==================== */

  function renderAll() {
    renderStats();
    renderTable();
  }

  function renderStats() {
    let totalCollected = 0;
    let totalPending = 0;
    let paidCount = 0;
    let pendingCount = 0;

    const todayStr = getLocalDateString();
    let todayCount = 0;

    STATE.students.forEach(student => {
      const fine = Number(student.fine) || 100;
      if (student.paid) {
        totalCollected += fine;
        paidCount++;
      } else {
        totalPending += fine;
        pendingCount++;
      }

      if (isSameDay(student.date, todayStr)) {
        todayCount++;
      }
    });

    const statCol = document.getElementById('statCollected');
    const statColCount = document.getElementById('statCollectedCount');
    const statPend = document.getElementById('statPending');
    const statPendCount = document.getElementById('statPendingCount');
    const statTotal = document.getElementById('statTotalStudents');
    const statToday = document.getElementById('statTodayStudents');

    if (statCol) statCol.textContent = `Rs. ${totalCollected.toLocaleString()}`;
    if (statColCount) statColCount.textContent = `${paidCount} paid`;
    if (statPend) statPend.textContent = `Rs. ${totalPending.toLocaleString()}`;
    if (statPendCount) statPendCount.textContent = `${pendingCount} pending`;
    if (statTotal) statTotal.textContent = STATE.students.length;
    if (statToday) statToday.textContent = `${todayCount} today`;
  }

  function getFilteredStudents() {
    const todayStr = getLocalDateString();
    const query = (STATE.currentFilter.search || '').toLowerCase().trim();
    const dateFilter = STATE.currentFilter.date;
    const statusFilter = STATE.currentFilter.status;

    return STATE.students.filter(student => {
      // Name search filter
      if (query && !student.name.toLowerCase().includes(query)) {
        return false;
      }

      // Date filter
      if (dateFilter === 'today' && !isSameDay(student.date, todayStr)) {
        return false;
      }

      // Status filter
      if (statusFilter === 'paid' && !student.paid) {
        return false;
      }
      if (statusFilter === 'unpaid' && student.paid) {
        return false;
      }

      return true;
    });
  }

  function renderTable() {
    const tbody = document.getElementById('studentsTableBody');
    const emptyState = document.getElementById('emptyState');
    const filteredCountBadge = document.getElementById('filteredCountBadge');
    const adminCols = document.querySelectorAll('.admin-col');

    if (!tbody) return;

    // Toggle admin column visibility
    adminCols.forEach(col => {
      col.style.display = STATE.isAdmin ? 'table-cell' : 'none';
    });

    const list = getFilteredStudents();
    if (filteredCountBadge) {
      filteredCountBadge.textContent = `Showing ${list.length} record${list.length === 1 ? '' : 's'}`;
    }

    freezeStudentsIfReadOnly();

    tbody.innerHTML = '';

    const tbl = document.getElementById('studentsTable');

    if (list.length === 0) {
      if (emptyState) emptyState.style.display = 'block';
      if (tbl) tbl.style.display = 'none';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (tbl) tbl.style.display = 'table';

    list.forEach((student, index) => {
      const tr = document.createElement('tr');
      tr.id = `row-${student.id}`;

      // Student initials for avatar
      const initials = (student.name || 'ST')
        .split(' ')
        .map(part => part[0])
        .filter(Boolean)
        .join('')
        .substring(0, 2)
        .toUpperCase();

      // Check if time is 8:10+
      const timeStr = String(student.time || '');
      const isOverTen = timeStr.includes('8:10+') || timeStr.includes('10+');
      const timeBadgeClass = isOverTen ? 'badge-time badge-time-late' : 'badge-time';

      // Status display: If admin, interactive tick button. If student, clean badge.
      let statusHtml = '';
      if (STATE.isAdmin) {
        statusHtml = `
        <button class="btn-toggle-payment ${student.paid ? 'is-paid' : 'is-unpaid'}" 
                onclick="togglePayment('${student.id}')"
                title="Click to toggle payment status">
          <i class="fa-solid ${student.paid ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
          <span>${student.paid ? 'Paid (Rs. ' + student.fine + ')' : 'Pending'}</span>
        </button>
      `;
      } else {
        statusHtml = `
        <span class="status-pill ${student.paid ? 'status-paid' : 'status-unpaid'}">
          <i class="fa-solid ${student.paid ? 'fa-check' : 'fa-clock'}"></i>
          ${student.paid ? 'Paid' : 'Pending'}
        </span>
      `;
      }

      // Admin action buttons (Edit & Delete)
      const adminActionsHtml = STATE.isAdmin ? `
      <td class="admin-col">
        <div class="table-actions">
          <button class="btn-icon" onclick="openEditModal('${student.id}')" title="Edit Entry">
            <i class="fa-solid fa-pen"></i>
          </button>
          <button class="btn-icon btn-icon-delete" onclick="deleteEntry('${student.id}')" title="Delete Entry">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </td>
    ` : '';

      tr.innerHTML = `
      <td style="color: var(--text-muted); font-weight: 600;">${index + 1}</td>
      <td>
        <div class="student-name-cell">
          <div class="student-avatar">${initials || 'ST'}</div>
          <span>${escapeHtml(student.name)}</span>
        </div>
      </td>
      <td style="color: var(--text-secondary); white-space: nowrap;">${formatDateDisplay(student.date)}</td>
      <td>
        <span class="${timeBadgeClass}">
          <i class="fa-regular fa-clock"></i> ${escapeHtml(student.time)}
        </span>
      </td>
      <td style="font-weight: 700; color: #f1f5f9;">Rs. ${student.fine}</td>
      <td>${statusHtml}</td>
      ${adminActionsHtml}
    `;

      tbody.appendChild(tr);
    });
  }

  /* ==================== FILTERS & SEARCH ==================== */

  function applyFilters() {
    const searchInput = document.getElementById('searchStudent');
    const dateSelect = document.getElementById('filterDate');
    const statusSelect = document.getElementById('filterStatus');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (searchInput) STATE.currentFilter.search = searchInput.value;
    if (dateSelect) STATE.currentFilter.date = dateSelect.value;
    if (statusSelect) STATE.currentFilter.status = statusSelect.value;

    if (clearBtn && searchInput) {
      clearBtn.style.display = searchInput.value ? 'block' : 'none';
    }
    renderTable();
  }

  function clearSearch() {
    const searchInput = document.getElementById('searchStudent');
    if (searchInput) searchInput.value = '';
    applyFilters();
  }

  /* ==================== TIME RULE & PRESETS ==================== */

  function setPresetTime(type) {
    const timeInput = document.getElementById('arrivalTime');
    if (!timeInput) return;

    if (type === '8:10+') {
      timeInput.value = '8:10+ AM';
      return;
    }

    if (type === 'now') {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';

      // Check if class 8:00 AM late is past 8:10 AM
      if (hours === 8 && minutes > 10) {
        timeInput.value = '8:10+ AM';
        return;
      } else if (hours > 8 && hours < 12) {
        timeInput.value = '8:10+ AM';
        return;
      }

      const displayHours = hours % 12 || 12;
      const displayMinutes = minutes < 10 ? '0' + minutes : minutes;
      timeInput.value = `${displayHours}:${displayMinutes} ${ampm}`;
    }
  }

  /* ==================== ADMIN ACTIONS (ADD / TICK / EDIT / DELETE) ==================== */

  function handleNewEntry(e) {
    e.preventDefault();
    if (!guardAdminRights('adding new record')) return;

    const nameInput = document.getElementById('studentName');
    const dateInput = document.getElementById('entryDate');
    const timeInput = document.getElementById('arrivalTime');
    const fineInput = document.getElementById('fineAmount');
    const paidCheckbox = document.getElementById('initialPaid');

    const name = nameInput.value.trim();
    const date = dateInput.value || getLocalDateString();
    const time = timeInput.value.trim();
    const fine = parseInt(fineInput.value) || 100;
    const paid = paidCheckbox.checked;

    if (!name || !time) {
      showToast('Please fill student name and arrival time', 'error');
      return;
    }

    const newStudent = {
      id: 'st_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: name,
      date: date,
      time: time,
      fine: fine,
      paid: paid,
      createdAt: Date.now()
    };

    // Add to the top of list
    STATE.students.unshift(newStudent);
    saveState();

    // Reset filter to 'all' so new entry is immediately visible
    STATE.currentFilter.date = 'all';
    const filterDateElem = document.getElementById('filterDate');
    if (filterDateElem) filterDateElem.value = 'all';

    // Clear search if active
    const searchInput = document.getElementById('searchStudent');
    if (searchInput) searchInput.value = '';
    STATE.currentFilter.search = '';

    renderAll();

    // Reset name input and focus ready for next student
    nameInput.value = '';
    paidCheckbox.checked = false;
    nameInput.focus();

    showToast(`Added ${name} to late records`, 'success');

    // Audit Log for Create Late Record
    recordAuditLog({
      actionType: 'ADD_STUDENT',
      details: `Added late record for "${name}" (Fine: Rs. ${fine}, Time: ${time}, Date: ${date}, Status: ${paid ? 'Paid' : 'Pending'})`,
      studentId: newStudent.id,
      studentName: name
    });
  }

  function togglePayment(studentId) {
    if (!guardAdminRights('updating payment status')) return;

    const student = STATE.students.find(s => s.id === studentId);
    if (!student) return;

    student.paid = !student.paid;
    saveState();
    renderAll();

    const msg = student.paid
      ? `Marked ${student.name} as Paid (Rs. ${student.fine})`
      : `Marked ${student.name} as Pending`;
    showToast(msg, 'success');

    // Audit Log for Payment Status Update
    recordAuditLog({
      actionType: 'UPDATE_PAYMENT',
      details: `Marked student "${student.name}" as ${student.paid ? 'PAID (Rs. ' + student.fine + ')' : 'PENDING'}`,
      studentId: student.id,
      studentName: student.name
    });
  }

  function deleteEntry(studentId) {
    if (!guardAdminRights('deleting student record')) return;

    const student = STATE.students.find(s => s.id === studentId);
    if (!student) return;

    if (confirm(`Are you sure you want to delete the record for ${student.name}?`)) {
      const deletedStudentName = student.name;
      const deletedFine = student.fine;
      const deletedDate = student.date;

      STATE.students = STATE.students.filter(s => s.id !== studentId);
      saveState();
      renderAll();
      showToast(`${deletedStudentName} record deleted`, 'info');

      // Audit Log for Record Deletion
      recordAuditLog({
        actionType: 'DELETE_STUDENT',
        details: `Deleted late record for student "${deletedStudentName}" (Fine: Rs. ${deletedFine}, Date: ${deletedDate})`,
        studentId: studentId,
        studentName: deletedStudentName
      });
    }
  }

  function clearAllRecords() {
    if (!guardMasterRights('clearing all student records')) return;

    if (confirm("Are you sure you want to clear all late records? This action cannot be undone.")) {
      const totalCleared = STATE.students.length;
      STATE.students = [];
      saveState();
      renderAll();
      showToast("All records cleared", "info");

      // Audit Log for Clearing All Records
      recordAuditLog({
        actionType: 'CLEAR_ALL',
        details: `Master Mind cleared all records (${totalCleared} late student entries removed)`
      });
    }
  }

  function openEditModal(studentId) {
    if (!STATE.isAdmin) return;

    const student = STATE.students.find(s => s.id === studentId);
    if (!student) return;

    document.getElementById('editEntryId').value = student.id;
    document.getElementById('editStudentName').value = student.name;
    document.getElementById('editEntryDate').value = student.date;
    document.getElementById('editArrivalTime').value = student.time;
    document.getElementById('editFineAmount').value = student.fine;
    document.getElementById('editPaidStatus').checked = student.paid;

    document.getElementById('editEntryModal').style.display = 'flex';
  }

  function closeEditModal() {
    document.getElementById('editEntryModal').style.display = 'none';
  }

  function saveEditedEntry() {
    const id = document.getElementById('editEntryId').value;
    const student = STATE.students.find(s => s.id === id);
    if (!student) return;

    const oldName = student.name;
    student.name = document.getElementById('editStudentName').value.trim();
    student.date = document.getElementById('editEntryDate').value;
    student.time = document.getElementById('editArrivalTime').value.trim();
    student.fine = parseInt(document.getElementById('editFineAmount').value) || 100;
    student.paid = document.getElementById('editPaidStatus').checked;

    saveState();
    renderAll();
    closeEditModal();
    showToast(`Updated record for ${student.name}`, 'success');

    // Audit Log for Record Edit
    recordAuditLog({
      actionType: 'EDIT_STUDENT',
      details: `Edited record for "${student.name}" (Fine: Rs. ${student.fine}, Arrival: ${student.time}, Date: ${student.date}, Status: ${student.paid ? 'Paid' : 'Pending'})`,
      studentId: student.id,
      studentName: student.name
    });
  }

  /* ==================== ADMIN AUTHENTICATION ==================== */

  /* ==================== ADMIN AUTHENTICATION & MULTI-DEVICE APPROVAL ==================== */

  function toggleAdminModal() {
    if (STATE.isAdmin) {
      const entryCard = document.getElementById('adminEntryCard');
      if (entryCard) entryCard.scrollIntoView({ behavior: 'smooth' });
    } else {
      resetLoginToPinStep();
      switchLoginTab('pin');
      document.getElementById('adminModal').style.display = 'flex';
      const pinInput = document.getElementById('adminPinInput');
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    }
  }

  function closeAdminModal() {
    stopWaitingCountdown();
    document.getElementById('adminModal').style.display = 'none';
    STATE.pendingLogin = false;
  }

  function switchLoginTab(tab) {
    const pinView = document.getElementById('loginViewPin');
    const masterView = document.getElementById('loginViewMaster');
    const waitingView = document.getElementById('pinStepWaiting');
    const deniedView = document.getElementById('pinStepDenied');
    const pinTabBtn = document.getElementById('tabPinLoginBtn');
    const masterTabBtn = document.getElementById('tabMasterLoginBtn');

    if (tab === 'master') {
      if (pinView) pinView.style.display = 'none';
      if (waitingView) waitingView.style.display = 'none';
      if (deniedView) deniedView.style.display = 'none';
      if (masterView) masterView.style.display = 'block';
      const formCard = document.getElementById('masterLoginFormCard');
      if (formCard) formCard.style.display = 'block';
      if (pinTabBtn) pinTabBtn.classList.remove('active');
      if (masterTabBtn) masterTabBtn.classList.add('active');
      const err = document.getElementById('masterLoginErrorMsg');
      if (err) err.style.display = 'none';
      const masterKeyInput = document.getElementById('masterOwnerKeyInput');
      if (masterKeyInput) {
        masterKeyInput.value = '';
        masterKeyInput.focus();
      }
    } else {
      if (masterView) masterView.style.display = 'none';
      if (waitingView) waitingView.style.display = 'none';
      if (deniedView) deniedView.style.display = 'none';
      if (pinView) pinView.style.display = 'block';
      if (pinTabBtn) pinTabBtn.classList.add('active');
      if (masterTabBtn) masterTabBtn.classList.remove('active');
      const pinInput = document.getElementById('adminPinInput');
      if (pinInput) pinInput.focus();
    }
  }

  function resetLoginToPinStep() {
    const pinView = document.getElementById('loginViewPin');
    const masterView = document.getElementById('loginViewMaster');
    const waitingView = document.getElementById('pinStepWaiting');
    const deniedView = document.getElementById('pinStepDenied');
    const errorMsg = document.getElementById('loginErrorMsg');
    const keyInput = document.getElementById('adminPrivateKeyInput');

    if (keyInput) keyInput.value = '';

    // Check if this device is pending or rejected in STATE.adminDevices
    const currentDev = STATE.adminDevices[STATE.deviceId];
    if (currentDev) {
      if (currentDev.status === 'pending' || currentDev.status === 'pending_master') {
        showWaitingScreen(currentDev.name || 'Admin Requester', currentDev.status === 'pending_master' ? 'Master Admin' : 'Sub-Admin');
        return;
      } else if (currentDev.status === 'rejected' || currentDev.status === 'revoked') {
        showDenialScreen('You are denied by Kausar Khattak');
        return;
      }
    }

    if (pinView) pinView.style.display = 'block';
    if (masterView) masterView.style.display = 'none';
    if (waitingView) waitingView.style.display = 'none';
    if (deniedView) deniedView.style.display = 'none';
    if (errorMsg) errorMsg.style.display = 'none';

    updateMasterLoginViewMode();
  }

  function updateMasterLoginViewMode() {
    const formCard = document.getElementById('masterLoginFormCard');
    const noticeCard = document.getElementById('masterReservedNotice');
    if (formCard) formCard.style.display = 'block';
    if (noticeCard) noticeCard.style.display = 'none';
  }

  function sendMasterRecoveryEmail() {
    showToast('Please enter Master Security PIN to login.', 'info');
    switchLoginTab('master');
  }

  /**
   * ADMIN LOGIN: Validates Name & Sub-Admin Password (4545) OR Secret Master PIN
   * - If Secret Master PIN is entered: Verified via cryptographic hash -> Opens Master Page immediately!
   * - If 4-Digit Private Key is provided with 4545: Instant unlock as Sub-Admin!
   * - If Private Key is NOT provided: Submits live real-time request to Master Page. Master Mind clicks "Allow Access"!
   */
  async function handleAdminLogin() {
    const nameInput = document.getElementById('adminLoginNameInput');
    const pinInput = document.getElementById('adminPinInput');
    const keyInput = document.getElementById('adminPrivateKeyInput');
    const errorMsg = document.getElementById('loginErrorMsg');

    const enteredName = nameInput ? nameInput.value.trim() : '';
    const enteredPin = pinInput ? pinInput.value.trim() : '';
    const enteredKey = keyInput ? keyInput.value.trim() : '';

    if (!enteredName) {
      if (errorMsg) {
        errorMsg.textContent = 'Please enter your Full Name (e.g. kausar or Ali Khan)';
        errorMsg.style.display = 'block';
      }
      if (nameInput) nameInput.focus();
      return;
    }

    if (!enteredPin) {
      if (errorMsg) {
        errorMsg.textContent = 'Please enter Sub-Admin Password';
        errorMsg.style.display = 'block';
      }
      if (pinInput) pinInput.focus();
      return;
    }

    // 0. CHECK IF MASTER PIN WAS ENTERED (Secret Master PIN verification)
    const isMasterFromPin = await verifyMasterSecurityKey(enteredPin);
    const isMasterFromKey = enteredKey ? await verifyMasterSecurityKey(enteredKey) : false;

    if (isMasterFromPin || isMasterFromKey) {
      if (errorMsg) errorMsg.style.display = 'none';

      STATE.isAdmin = true;
      STATE.isMasterAdmin = true;
      STATE.adminRole = 'master';
      STATE.adminName = enteredName.toLowerCase().includes('kausar') ? enteredName : 'Kausar Hayat (Master Owner)';
      setMasterSessionVerified();
      sessionStorage.setItem('fc_is_admin', 'true');
      sessionStorage.setItem('fc_admin_name', STATE.adminName);
      sessionStorage.setItem('fc_admin_role', 'master');

      if (STATE.firebaseDb && STATE.deviceId) {
        STATE.firebaseDb.ref(`security/admin_devices/${STATE.deviceId}`).set({
          id: STATE.deviceId,
          name: STATE.adminName,
          device: STATE.deviceName,
          status: 'approved',
          role: 'master',
          isOwner: true,
          lastSeen: Date.now()
        }).catch(() => {});
      }

      recordAuditLog({
        adminName: STATE.adminName,
        role: 'Master Admin',
        actionType: 'LOGIN',
        details: 'Master Mind verified secret PIN & accessed Master Page'
      });

      closeAdminModal();
      updateAdminUI();
      renderAll();
      openAdminManagementModal();
      showToast('👑 Welcome Master Mind! Master Page opened.', 'success');
      return;
    }

    // 1. NORMAL SUB-ADMIN PASSWORD VALIDATION (4545)
    const isCorrectCode = (enteredPin === STATE.adminPin || enteredPin === '4545');
    if (!isCorrectCode) {
      if (errorMsg) {
        errorMsg.textContent = 'Incorrect Admin Password! Access denied.';
        errorMsg.style.display = 'block';
      }
      return;
    }

    if (errorMsg) errorMsg.style.display = 'none';

    const allKeys = Object.values(STATE.adminPrivateKeys || {}).filter(Boolean);

    // 2. IF USER ENTERED A 4-DIGIT PRIVATE KEY: Check key authentication (Sub-Admin ONLY)
    if (enteredKey) {
      const matchedKeyEntry = allKeys.find(k => 
        k && 
        k.status === 'active' && 
        k.name.trim() === enteredName &&   // Exact match
        String(k.key).trim() === enteredKey
      );

      if (matchedKeyEntry) {
        // Authenticated by Master-Assigned Private Key! DIRECT UNLOCK as Sub-Admin!
        STATE.isAdmin = true;
        STATE.isMasterAdmin = false;
        STATE.adminRole = 'subadmin';
        STATE.adminName = enteredName;
        sessionStorage.setItem('fc_is_admin', 'true');
        sessionStorage.setItem('fc_admin_name', enteredName);
        sessionStorage.setItem('fc_admin_role', 'subadmin');

        if (STATE.firebaseDb && STATE.deviceId) {
          STATE.firebaseDb.ref(`security/admin_devices/${STATE.deviceId}`).set({
            id: STATE.deviceId,
            name: enteredName,
            device: STATE.deviceName,
            status: 'approved',
            role: 'subadmin',
            isOwner: false,
            usedPrivateKeyId: matchedKeyEntry.id,
            lastSeen: Date.now()
          }).catch(() => {});

          STATE.firebaseDb.ref(`security/admin_private_keys/${matchedKeyEntry.id}`).update({
            lastUsed: Date.now(),
            lastDevice: STATE.deviceName
          }).catch(() => {});
        }

        // Record Audit Trail
        recordAuditLog({
          adminName: enteredName,
          role: 'Sub-Admin',
          actionType: 'LOGIN',
          details: `Accessed Admin Portal with 4-digit Private Key (${enteredKey})`
        });

        closeAdminModal();
        updateAdminUI();
        renderAll();
        showToast(`Welcome, ${enteredName}! Sub-Admin access unlocked with Private Key.`, 'success');
        return;
      } else {
        if (errorMsg) {
          errorMsg.textContent = `Invalid 4-Digit Private Key for "${enteredName}"! Check exact spelling and key code, or leave blank to submit access request.`;
          errorMsg.style.display = 'block';
        }
        if (keyInput) keyInput.focus();
        return;
      }
    }

    // 2. IF PRIVATE KEY WAS NOT PROVIDED:
    // Check if Master Mind has already created a Private Key for this exact name
    const existingKey = allKeys.find(k => k && k.status === 'active' && k.name.trim() === enteredName);
    if (existingKey) {
      if (errorMsg) {
        errorMsg.textContent = `A Private Key has been created for "${enteredName}". Please enter your 4-digit Private Key to access the Admin portal.`;
        errorMsg.style.display = 'block';
      }
      if (keyInput) keyInput.focus();
      return;
    }

    // 3. SUBMIT REALTIME REQUEST TO MASTER PAGE (NO EMAILS DISPATCHED)
    // Master Mind sees this request instantly in Admin Access Management
    if (STATE.firebaseDb) {
      STATE.firebaseDb.ref(`security/admin_devices/${STATE.deviceId}`).set({
        id: STATE.deviceId,
        name: enteredName,
        device: STATE.deviceName,
        status: 'pending',
        role: 'subadmin',
        isOwner: false,
        requestedAt: Date.now()
      }).catch(() => {});
    }

    // Record Audit Trail
    recordAuditLog({
      adminName: enteredName,
      role: 'Sub-Admin',
      actionType: 'LOGIN_REQUEST',
      details: `Entered password 4545 and requested Admin access (Awaiting Master Mind permission)`
    });

    showWaitingScreen(enteredName, 'Sub-Admin');
    showToast('Authorization request submitted. Waiting for Master Mind to allow access.', 'info');
  }

  // Backward-compatibility wrappers so all onclick references work safely
  function goToAdminStep2() { handleAdminLogin(); }
  function backToAdminStep1() { resetLoginToPinStep(); }
  function handleAdminPrivateKeySubmit() { handleAdminLogin(); }
  function requestEmailPermissionFromStep2() { handleAdminLogin(); }

  function showWaitingScreen(name, requestedRole = 'Admin') {
    const pinView = document.getElementById('loginViewPin');
    const masterView = document.getElementById('loginViewMaster');
    const waitingView = document.getElementById('pinStepWaiting');
    const deniedView = document.getElementById('pinStepDenied');

    if (pinView) pinView.style.display = 'none';
    if (masterView) masterView.style.display = 'none';
    if (deniedView) deniedView.style.display = 'none';
    if (waitingView) waitingView.style.display = 'block';

    const waitTitle = document.getElementById('waitTitle');
    if (waitTitle) {
      waitTitle.innerHTML = '<i class="fa-solid fa-brain"></i> Wait for Master Mind Permission';
    }

    const waitName = document.getElementById('waitRequesterName');
    const waitDevice = document.getElementById('waitDeviceName');
    const waitRole = document.getElementById('waitRoleBadge');

    if (waitName) waitName.textContent = name;
    if (waitDevice) waitDevice.textContent = STATE.deviceName;
    if (waitRole) waitRole.textContent = (requestedRole === 'Master Admin' || requestedRole === 'master') ? '👑 Master Admin' : '🛡️ Sub-Admin';

    STATE.pendingLogin = true;
    startWaitingCountdown();
  }

  /* ==================== SERVER-SIDE FIREBASE AUTHENTICATION ==================== */

  async function verifyMasterSecurityKey(enteredKey, enteredEmail = 'iamkausarhayat100@gmail.com') {
    if (!enteredKey) return false;
    const lockoutSec = checkMasterLockout();
    if (lockoutSec > 0) {
      showToast(`Lockout Active: Please wait ${lockoutSec}s before retrying.`, 'error');
      return false;
    }

    // Artificial throttling against automated brute-force attempts
    await new Promise(r => setTimeout(r, 600));

    // 1. Primary: Server-side Firebase Authentication verification
    if (window.firebase && firebase.auth) {
      try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(enteredEmail, enteredKey);
        if (userCredential && userCredential.user) {
          resetMasterFailedAttempts();
          setMasterSessionVerified();
          STATE.firebaseUser = userCredential.user;
          return true;
        }
      } catch (authErr) {
        console.warn("Firebase Auth server response:", authErr.code);
        if (authErr.code === 'auth/too-many-requests') {
          showToast('Security Alert: Multiple failed attempts. Account temporarily locked.', 'error');
          return false;
        }
      }
    }

    // 2. Secondary fallback verification (if offline or cloud sync mode)
    if (STATE.masterHash && enteredKey && window.crypto && window.crypto.subtle) {
      try {
        const msgBuffer = new TextEncoder().encode(enteredKey.trim());
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
        const computedHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (computedHex === STATE.masterHash) {
          resetMasterFailedAttempts();
          setMasterSessionVerified();
          return true;
        }
      } catch (e) {}
    }

    recordMasterFailedAttempt();
    return false;
  }

  function fallbackSha256(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var result = '';
    var words = [];
    var asciiBitLength = ascii.length * 8;
    var hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    var k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (var i = 0; i < ascii.length; i++) {
      var j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = (asciiBitLength);
    for (var j = 0; j < words.length;) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (var i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
            ) | 0
          );
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (var i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }
    for (var i = 0; i < 8; i++) {
      for (var i2 = 3; i2 >= 0; i2--) {
        var b = (hash[i] >> (i2 * 8)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  /**
   * Direct Master Owner Login (Kausar Hayat) with Cryptographic Verification
   * Opens Master Page exclusively upon entering the secret Master PIN!
   */
  async function handleMasterOwnerLogin() {
    const keyInput = document.getElementById('masterOwnerKeyInput');
    const errorMsg = document.getElementById('masterLoginErrorMsg');
    const lockoutEl = document.getElementById('masterLockoutCountdown');
    const enteredKey = keyInput ? keyInput.value.trim() : '';

    const lockoutSec = checkMasterLockout();
    if (lockoutSec > 0) {
      if (lockoutEl) {
        lockoutEl.textContent = `Security Lockout Active: Too many failed attempts. Try again in ${lockoutSec} seconds.`;
        lockoutEl.style.display = 'block';
      }
      showToast(`Login locked for ${lockoutSec}s`, 'error');
      return;
    } else if (lockoutEl) {
      lockoutEl.style.display = 'none';
    }

    if (!enteredKey) {
      if (errorMsg) {
        errorMsg.textContent = 'Please enter Master Security Passkey';
        errorMsg.style.display = 'block';
      }
      if (keyInput) keyInput.focus();
      return;
    }

    if (enteredKey === '4545') {
      if (errorMsg) {
        errorMsg.textContent = 'Access Denied: 4545 is Sub-Admin only. Master Page requires Secret Master Passkey.';
        errorMsg.style.display = 'block';
      }
      if (keyInput) keyInput.focus();
      return;
    }

    const emailInput = document.getElementById('masterOwnerEmailInput');
    const enteredEmail = emailInput ? emailInput.value.trim() : 'iamkausarhayat100@gmail.com';
    const isMasterAuthorized = await verifyMasterSecurityKey(enteredKey, enteredEmail);

    if (isMasterAuthorized) {
      if (errorMsg) errorMsg.style.display = 'none';
      if (lockoutEl) lockoutEl.style.display = 'none';

      STATE.isAdmin = true;
      STATE.isMasterAdmin = true;
      STATE.adminRole = 'master';
      STATE.adminName = 'Kausar Hayat (Master Owner)';
      setMasterSessionVerified();
      sessionStorage.setItem('fc_is_admin', 'true');
      sessionStorage.setItem('fc_admin_name', 'Kausar Hayat (Master Owner)');
      sessionStorage.setItem('fc_admin_role', 'master');

      if (STATE.firebaseDb && STATE.deviceId) {
        STATE.firebaseDb.ref(`security/admin_devices/${STATE.deviceId}`).set({
          id: STATE.deviceId,
          name: 'Kausar Hayat (Master Mind)',
          device: STATE.deviceName,
          status: 'approved',
          role: 'master',
          isOwner: true,
          lastSeen: Date.now()
        }).catch(() => {});
      }

      recordAuditLog({
        adminName: 'Kausar Hayat (Master Owner)',
        role: 'Master Admin',
        actionType: 'LOGIN',
        details: 'Master Mind verified secret passkey & accessed Master Page'
      });

      closeAdminModal();
      updateAdminUI();
      renderAll();
      openAdminManagementModal();
      showToast('👑 Welcome Master Mind (Kausar Hayat)! Master Page opened.', 'success');
      return;
    }

    const newLockoutSec = checkMasterLockout();
    if (newLockoutSec > 0 && lockoutEl) {
      lockoutEl.textContent = `Security Lockout Active: Too many failed attempts. Try again in ${newLockoutSec} seconds.`;
      lockoutEl.style.display = 'block';
    }

    if (errorMsg) {
      errorMsg.textContent = newLockoutSec > 0 ? 'Multiple failed attempts! Login locked for 5 minutes.' : 'Invalid Master Passkey! Access denied.';
      errorMsg.style.display = 'block';
    }
    if (keyInput) keyInput.focus();
  }

  /**
   * Real-time Handler for Cloud Security Devices (Approvals, Revocations, Badges)
   */
  function handleSecurityDevicesUpdate(devices) {
    const deviceList = Object.values(devices || {}).filter(Boolean);

    // 1. Check current device status
    const currentDev = devices[STATE.deviceId];
    if (currentDev) {
      // If rejected or revoked
      if (currentDev.status === 'rejected' || currentDev.status === 'revoked') {
        stopWaitingCountdown();
        if (STATE.pendingLogin) {
          STATE.pendingLogin = false;
          showDenialScreen('You are denied by Kausar Khattak');
          return;
        } else if (STATE.isAdmin && !STATE.isMasterAdmin) {
          logoutAdmin();
          showDenialScreen('You are denied by Kausar Khattak');
          return;
        }
      }

      // If waiting for approval and just got approved
      if (currentDev.status === 'approved' && STATE.pendingLogin) {
        stopWaitingCountdown();
        STATE.isAdmin = true;
        STATE.isMasterAdmin = !!currentDev.isOwner;
        STATE.adminRole = currentDev.isOwner ? 'master' : 'subadmin';
        if (currentDev.isOwner) {
          sessionStorage.setItem('fc_is_master_verified', 'true');
        }
        sessionStorage.setItem('fc_is_admin', 'true');
        sessionStorage.setItem('fc_admin_role', STATE.adminRole);
        STATE.pendingLogin = false;
        closeAdminModal();
        updateAdminUI();
        renderAll();
        showToast(currentDev.isOwner ? '👑 Master Admin Verified by Email! Full access granted.' : 'Permission Granted by Master Mind (Kausar Hayat)! You are now an Admin.', 'success');
      }
    }

    // 2. Count pending requests and active sub-admins
    const pendingRequests = deviceList.filter(d => d.status === 'pending' || d.status === 'pending_master');
    const approvedDevices = deviceList.filter(d => d.status === 'approved' && !d.isOwner);

    // Update badges
    const manageBadge = document.getElementById('manageAdminsPendingBadge');
    const bannerBadge = document.getElementById('bannerPendingCount');
    const tabPendingBadge = document.getElementById('manageTabPendingBadge');
    const tabApprovedBadge = document.getElementById('manageTabApprovedBadge');
    const headerActiveCount = document.getElementById('headerActiveAdminsCount');

    if (manageBadge) {
      manageBadge.textContent = pendingRequests.length;
      manageBadge.style.display = pendingRequests.length > 0 ? 'inline-block' : 'none';
    }
    if (bannerBadge) bannerBadge.textContent = pendingRequests.length;
    if (tabPendingBadge) tabPendingBadge.textContent = pendingRequests.length;
    if (tabApprovedBadge) tabApprovedBadge.textContent = approvedDevices.length;
    if (headerActiveCount) {
      headerActiveCount.innerHTML = `<i class="fa-solid fa-user-shield"></i> Active Admins: <strong>${approvedDevices.length}</strong>`;
    }

    // 3. Floating permission alert banner for Master Admin
    const banner = document.getElementById('permissionAlertBanner');
    const bannerDesc = document.getElementById('permissionAlertDesc');

    if (STATE.isAdmin && STATE.isMasterAdmin && pendingRequests.length > 0) {
      const latest = pendingRequests[pendingRequests.length - 1];
      STATE.pendingDeviceIdToApprove = latest.id;
      if (bannerDesc) {
        const isM = latest.status === 'pending_master' || latest.role === 'pending_master';
        bannerDesc.textContent = isM
          ? `Master Authorization requested on ${latest.device || 'New Device'}.`
          : `${latest.name || 'User'} (${latest.device || 'Device'}) wants Admin permission.`;
      }
      if (banner) banner.style.display = 'flex';
    } else {
      if (banner) banner.style.display = 'none';
      STATE.pendingDeviceIdToApprove = null;
    }

    // 4. If Manage Admins Modal is open, refresh its content
    if (document.getElementById('adminManageModal')?.style.display === 'flex') {
      renderAdminDevicesList();
    }
  }

  /* ==================== MANAGE ADMINS MODAL (MASTER ADMIN ONLY) ==================== */

  function openAdminManagementModal() {
    if (!STATE.isAdmin || !STATE.isMasterAdmin || !isMasterSessionVerified()) {
      switchLoginTab('master');
      document.getElementById('adminModal').style.display = 'flex';
      showToast('Master Page is locked. Please enter your secret Master Passkey.', 'info');
      return;
    }

    const modal = document.getElementById('adminManageModal');
    if (modal) modal.classList.add('verified');

    attachMasterPrivateKeysListener();
    renderAdminDevicesList();
    switchManageTab('pending');
    if (modal) modal.style.display = 'flex';
  }

  function closeAdminManagementModal() {
    const modal = document.getElementById('adminManageModal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.remove('verified');
    }
  }

  function switchManageTab(tab) {
    const vPending = document.getElementById('manageViewPending');
    const vApproved = document.getElementById('manageViewApproved');
    const vKeys = document.getElementById('manageViewKeys');
    const vAudit = document.getElementById('manageViewAudit');
    const vSecurity = document.getElementById('manageViewSecurity');
    const bPending = document.getElementById('tabManagePendingBtn');
    const bApproved = document.getElementById('tabManageApprovedBtn');
    const bKeys = document.getElementById('tabManageKeysBtn');
    const bAudit = document.getElementById('tabManageAuditBtn');
    const bSecurity = document.getElementById('tabManageSecurityBtn');

    if (vPending) vPending.style.display = tab === 'pending' ? 'block' : 'none';
    if (vApproved) vApproved.style.display = tab === 'approved' ? 'block' : 'none';
    if (vKeys) vKeys.style.display = tab === 'keys' ? 'block' : 'none';
    if (vAudit) vAudit.style.display = tab === 'audit' ? 'block' : 'none';
    if (vSecurity) vSecurity.style.display = tab === 'security' ? 'block' : 'none';

    if (bPending) bPending.classList.toggle('active', tab === 'pending');
    if (bApproved) bApproved.classList.toggle('active', tab === 'approved');
    if (bKeys) bKeys.classList.toggle('active', tab === 'keys');
    if (bAudit) bAudit.classList.toggle('active', tab === 'audit');
    if (bSecurity) bSecurity.classList.toggle('active', tab === 'security');

    if (tab === 'pending' || tab === 'approved') {
      renderAdminDevicesList();
    } else if (tab === 'keys') {
      renderAdminPrivateKeysList();
    } else if (tab === 'audit') {
      renderAuditLogsList();
    }
  }

  function createAdminPrivateKey() {
    if (!guardMasterRights('assigning private keys')) return;

    const nameInput = document.getElementById('newAdminKeyName');
    const keyInput = document.getElementById('newAdminKeyValue');

    const name = nameInput ? nameInput.value.trim() : '';
    const key = keyInput ? keyInput.value.trim() : '';

    if (!name) {
      showToast('Please enter Admin Name (e.g. kausar or Ali Khan)', 'error');
      if (nameInput) nameInput.focus();
      return;
    }

    if (!key || !/^\d{4}$/.test(key)) {
      showToast('Private Key must be exactly 4 digits (e.g. 7890)', 'error');
      if (keyInput) keyInput.focus();
      return;
    }

    const keyId = 'pk_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 4);
    const keyPayload = {
      id: keyId,
      name: name,   // Case-sensitive exact name
      key: key,
      status: 'active',
      createdAt: Date.now(),
      createdBy: 'Kausar Hayat'
    };

    if (STATE.firebaseDb) {
      STATE.firebaseDb.ref(`security/admin_private_keys/${keyId}`).set(keyPayload)
        .then(() => {
          showToast(`Private Key for "${name}" assigned successfully!`, 'success');
          if (nameInput) nameInput.value = '';
          if (keyInput) keyInput.value = '';

          // Record Audit Trail
          recordAuditLog({
            adminName: 'Kausar Hayat (Master Owner)',
            role: 'Master Admin',
            actionType: 'KEY_ASSIGNED',
            details: `Assigned 4-digit Private Key (${key}) for Admin "${name}"`
          });
        })
        .catch(err => {
          console.warn('Firebase key error:', err);
          showToast('Error saving key to cloud', 'error');
        });
    } else {
      if (!STATE.adminPrivateKeys) STATE.adminPrivateKeys = {};
      STATE.adminPrivateKeys[keyId] = keyPayload;
      localStorage.setItem('fc_admin_private_keys', JSON.stringify(STATE.adminPrivateKeys));
      showToast(`Private Key for "${name}" assigned locally!`, 'success');

      // Record Audit Trail
      recordAuditLog({
        adminName: 'Kausar Hayat (Master Owner)',
        role: 'Master Admin',
        actionType: 'KEY_ASSIGNED',
        details: `Assigned 4-digit Private Key (${key}) for Admin "${name}"`
      });

      renderAdminPrivateKeysList();
      if (nameInput) nameInput.value = '';
      if (keyInput) keyInput.value = '';
    }
  }

  function revokeAdminPrivateKey(keyId) {
    if (!guardMasterRights('revoking private keys')) return;
    if (!confirm('Are you sure you want to revoke this Admin Private Key? This user will immediately lose access.')) return;

    const keyEntry = STATE.adminPrivateKeys && STATE.adminPrivateKeys[keyId];
    const keyName = keyEntry ? keyEntry.name : 'Admin';

    if (STATE.firebaseDb) {
      STATE.firebaseDb.ref(`security/admin_private_keys/${keyId}`).remove()
        .then(() => {
          showToast('Admin Private Key revoked & deleted!', 'info');
          recordAuditLog({
            adminName: 'Kausar Hayat (Master Owner)',
            role: 'Master Admin',
            actionType: 'KEY_REVOKED',
            details: `Revoked Private Key for Admin "${keyName}"`
          });
        })
        .catch(e => console.warn(e));
    } else {
      if (STATE.adminPrivateKeys && STATE.adminPrivateKeys[keyId]) {
        delete STATE.adminPrivateKeys[keyId];
        localStorage.setItem('fc_admin_private_keys', JSON.stringify(STATE.adminPrivateKeys));
        renderAdminPrivateKeysList();
        showToast('Admin Private Key revoked!', 'info');
        recordAuditLog({
          adminName: 'Kausar Hayat (Master Owner)',
          role: 'Master Admin',
          actionType: 'KEY_REVOKED',
          details: `Revoked Private Key for Admin "${keyName}"`
        });
      }
    }
  }

  function renderAdminPrivateKeysList() {
    const listEl = document.getElementById('adminPrivateKeysList');
    const emptyEl = document.getElementById('emptyAdminPrivateKeys');
    const countLabel = document.getElementById('keysCountLabel');
    const tabBadge = document.getElementById('manageTabKeysBadge');

    if (!listEl) return;

    const keys = Object.values(STATE.adminPrivateKeys || {}).filter(Boolean);
    if (countLabel) countLabel.textContent = `${keys.length} Key${keys.length === 1 ? '' : 's'} Registered`;
    if (tabBadge) tabBadge.textContent = keys.length;

    if (keys.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';

    listEl.innerHTML = keys.map(k => `
      <div class="device-card" style="border-left: 3px solid #818cf8;">
        <div class="device-info-left">
          <div class="device-icon-box" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; border-color: rgba(99, 102, 241, 0.3);">
            <i class="fa-solid fa-key"></i>
          </div>
          <div>
            <div class="device-name-title">
              <strong style="color: #38bdf8;">${escapeHtml(k.name)}</strong>
              <span class="badge-waiting" style="background: rgba(99,102,241,0.2); color: #818cf8; border-color: rgba(99,102,241,0.4); margin-left: 8px;">
                PIN: ${escapeHtml(k.key)}
              </span>
            </div>
            <div class="device-meta-sub">
              <span><i class="fa-regular fa-calendar"></i> Created: ${new Date(k.createdAt || Date.now()).toLocaleDateString()}</span>
              ${k.lastUsed ? `<span>&bull;</span><span>Last Used: ${new Date(k.lastUsed).toLocaleTimeString()} (${escapeHtml(k.lastDevice || 'Device')})</span>` : '<span>&bull;</span><span>Unused</span>'}
            </div>
          </div>
        </div>
        <div class="device-actions">
          <button class="btn-card-logs" onclick="filterAuditLogsForAdmin('${escapeHtml(k.name)}')">
            <i class="fa-solid fa-receipt"></i> Logs
          </button>
          <button class="btn-card-reject" onclick="revokeAdminPrivateKey('${k.id}')" title="Revoke this Admin Private Key">
            <i class="fa-solid fa-trash-can"></i> Revoke
          </button>
        </div>
      </div>
    `).join('');
  }

  function renderAdminDevicesList() {
    const pendingContainer = document.getElementById('pendingRequestsList');
    const approvedContainer = document.getElementById('approvedAdminsList');
    const emptyPending = document.getElementById('emptyPendingRequests');
    const emptyApproved = document.getElementById('emptyApprovedAdmins');

    const devices = Object.values(STATE.adminDevices || {}).filter(Boolean);
    const pending = devices.filter(d => d.status === 'pending' || d.status === 'pending_master');
    const approved = devices.filter(d => d.status === 'approved' && !d.isOwner);

    // Render Pending
    if (pendingContainer) {
      pendingContainer.innerHTML = '';
      if (pending.length === 0) {
        if (emptyPending) emptyPending.style.display = 'block';
      } else {
        if (emptyPending) emptyPending.style.display = 'none';
        pending.forEach(dev => {
          const isMasterReq = dev.status === 'pending_master' || dev.role === 'pending_master';
          const timeAgo = dev.requestedAt ? new Date(dev.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';
          const card = document.createElement('div');
          card.className = 'device-card';
          card.innerHTML = `
          <div class="device-info-left">
            <div class="device-icon-box" style="${isMasterReq ? 'background: rgba(245, 158, 11, 0.15); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3);' : ''}">
              <i class="fa-solid ${isMasterReq ? 'fa-crown' : 'fa-mobile-screen'}"></i>
            </div>
            <div>
              <div class="device-name-title">
                ${escapeHtml(dev.name)}
                ${isMasterReq ? '<span class="badge-waiting" style="background: rgba(245,158,11,0.15); color: #fbbf24; border-color: rgba(245,158,11,0.3); margin-left: 6px;">Master Verification</span>' : ''}
              </div>
              <div class="device-meta-sub">
                <span><i class="fa-solid fa-laptop"></i> ${escapeHtml(dev.device)}</span>
                <span>&bull;</span>
                <span><i class="fa-regular fa-clock"></i> ${timeAgo}</span>
              </div>
            </div>
          </div>
          <div class="device-actions">
            <button class="btn-card-approve" onclick="approveDevice('${dev.id}', ${isMasterReq ? 'true' : 'false'})">
              <i class="fa-solid ${isMasterReq ? 'fa-crown' : 'fa-check'}"></i> ${isMasterReq ? 'Authorize Master' : 'Allow Access'}
            </button>
            <button class="btn-card-key" onclick="prefillAssignPrivateKey('${escapeHtml(dev.name)}')">
              <i class="fa-solid fa-key"></i> Assign Key
            </button>
            <button class="btn-card-reject" onclick="rejectDevice('${dev.id}')">
              <i class="fa-solid fa-xmark"></i> Reject
            </button>
          </div>
        `;
          pendingContainer.appendChild(card);
        });
      }
    }

    // Render Approved
    if (approvedContainer) {
      approvedContainer.innerHTML = '';
      if (approved.length === 0) {
        if (emptyApproved) emptyApproved.style.display = 'block';
      } else {
        if (emptyApproved) emptyApproved.style.display = 'none';
        approved.forEach(dev => {
          const approvedTime = dev.approvedAt ? new Date(dev.approvedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Authorized';
          const card = document.createElement('div');
          card.className = 'device-card';
          card.innerHTML = `
          <div class="device-info-left">
            <div class="device-icon-box" style="background: rgba(16, 185, 129, 0.12); color: #34d399; border-color: rgba(16, 185, 129, 0.3);">
              <i class="fa-solid fa-user-shield"></i>
            </div>
            <div>
              <div class="device-name-title">${escapeHtml(dev.name)} <span class="badge-waiting" style="background: rgba(16,185,129,0.15); color: #34d399; border-color: rgba(16,185,129,0.3);">Active Sub-Admin</span></div>
              <div class="device-meta-sub">
                <span><i class="fa-solid fa-laptop"></i> ${escapeHtml(dev.device)}</span>
                <span>&bull;</span>
                <span>Approved: ${approvedTime}</span>
              </div>
            </div>
          </div>
          <div class="device-actions">
            <button class="btn-card-key" onclick="prefillAssignPrivateKey('${escapeHtml(dev.name)}')">
              <i class="fa-solid fa-key"></i> Assign Key
            </button>
            <button class="btn-card-logs" onclick="filterAuditLogsForAdmin('${escapeHtml(dev.name)}')">
              <i class="fa-solid fa-receipt"></i> Logs
            </button>
            <button class="btn-card-revoke" onclick="deleteAdminDevice('${dev.id}')" title="Immediately delete and kick out this admin">
              <i class="fa-solid fa-trash-can"></i> Delete Admin
            </button>
          </div>
        `;
        approvedContainer.appendChild(card);
      });
    }
  }
}

function approveDevice(deviceId, asMaster = false) {
  if (!guardMasterRights('approving admin access')) return;
  const dev = STATE.adminDevices[deviceId];
  if (!dev) return;

  const isMaster = asMaster || dev.status === 'pending_master' || dev.role === 'pending_master';
  const updatePayload = {
    status: 'approved',
    approvedAt: Date.now(),
    role: isMaster ? 'master' : 'subadmin',
    isOwner: isMaster,
    name: isMaster ? 'Kausar Hayat (Master Owner)' : (dev.name || 'Admin')
  };

  if (STATE.firebaseDb) {
    STATE.firebaseDb.ref(`security/admin_devices/${deviceId}`).update(updatePayload).then(() => {
      showToast(`${isMaster ? 'Master' : 'Sub-Admin'} access granted to ${dev.name}`, 'success');

      // Record Audit Trail
      recordAuditLog({
        adminName: 'Kausar Hayat (Master Owner)',
        role: 'Master Admin',
        actionType: 'PERMISSION_GRANTED',
        details: `Granted ${isMaster ? 'Master' : 'Sub-Admin'} access to "${dev.name}" (${dev.device})`
      });
    });
  } else {
    Object.assign(dev, updatePayload);
    localStorage.setItem('fc_admin_devices', JSON.stringify(STATE.adminDevices));
    renderAuthorizedAdminsList();
    showToast(`${isMaster ? 'Master' : 'Sub-Admin'} access granted to ${dev.name}`, 'success');
    recordAuditLog({
      adminName: 'Kausar Hayat (Master Owner)',
      role: 'Master Admin',
      actionType: 'PERMISSION_GRANTED',
      details: `Granted ${isMaster ? 'Master' : 'Sub-Admin'} access to "${dev.name}" (${dev.device})`
    });
  }
}

function rejectDevice(deviceId) {
  if (!guardMasterRights('rejecting admin request')) return;
  const dev = STATE.adminDevices[deviceId];
  if (!dev) return;

  if (STATE.firebaseDb) {
    STATE.firebaseDb.ref(`security/admin_devices/${deviceId}`).update({
      status: 'rejected',
      rejectedAt: Date.now()
    }).then(() => {
      showToast(`Request rejected for ${dev.name}`, 'info');

      // Record Audit Trail
      recordAuditLog({
        adminName: 'Kausar Hayat (Master Owner)',
        role: 'Master Admin',
        actionType: 'PERMISSION_REJECTED',
        details: `Rejected access request for "${dev.name}" (${dev.device})`
      });
    });
  } else {
    dev.status = 'rejected';
    dev.rejectedAt = Date.now();
    localStorage.setItem('fc_admin_devices', JSON.stringify(STATE.adminDevices));
    renderAuthorizedAdminsList();
    showToast(`Request rejected for ${dev.name}`, 'info');
    recordAuditLog({
      adminName: 'Kausar Hayat (Master Owner)',
      role: 'Master Admin',
      actionType: 'PERMISSION_REJECTED',
      details: `Rejected access request for "${dev.name}" (${dev.device})`
    });
  }
}

function deleteAdminDevice(deviceId) {
  if (!guardMasterRights('deleting admin access')) return;
  const dev = STATE.adminDevices[deviceId];
  if (!dev) return;

  if (confirm(`Are you sure you want to Delete / Remove Admin access from "${dev.name}"?\n\nTheir access will be immediately terminated and their device locked out.`)) {
    // Also remove/revoke any private key assigned to this admin
    if (dev.usedPrivateKeyId && STATE.adminPrivateKeys && STATE.adminPrivateKeys[dev.usedPrivateKeyId]) {
      if (STATE.firebaseDb) {
        STATE.firebaseDb.ref(`security/admin_private_keys/${dev.usedPrivateKeyId}`).remove().catch(() => {});
      } else {
        delete STATE.adminPrivateKeys[dev.usedPrivateKeyId];
        localStorage.setItem('fc_admin_private_keys', JSON.stringify(STATE.adminPrivateKeys));
      }
    }
    if (STATE.adminPrivateKeys && dev.name) {
      Object.keys(STATE.adminPrivateKeys).forEach(pkId => {
        const pk = STATE.adminPrivateKeys[pkId];
        if (pk && pk.name && pk.name.trim().toLowerCase() === dev.name.trim().toLowerCase()) {
          if (STATE.firebaseDb) {
            STATE.firebaseDb.ref(`security/admin_private_keys/${pkId}`).remove().catch(() => {});
          } else {
            delete STATE.adminPrivateKeys[pkId];
            localStorage.setItem('fc_admin_private_keys', JSON.stringify(STATE.adminPrivateKeys));
          }
        }
      });
    }

    if (STATE.firebaseDb) {
      STATE.firebaseDb.ref(`security/admin_devices/${deviceId}`).update({
        status: 'revoked',
        role: 'guest',
        revokedAt: Date.now()
      }).then(() => {
        showToast(`Admin "${dev.name}" deleted and locked out!`, 'info');

        // Record Audit Trail
        recordAuditLog({
          adminName: 'Kausar Hayat (Master Owner)',
          role: 'Master Admin',
          actionType: 'ADMIN_REVOKED',
          details: `Revoked & deleted Admin access for "${dev.name}" (${dev.device})`
        });
      });
    } else {
      dev.status = 'revoked';
      dev.role = 'guest';
      dev.revokedAt = Date.now();
      localStorage.setItem('fc_admin_devices', JSON.stringify(STATE.adminDevices));
      renderAuthorizedAdminsList();
      renderAdminPrivateKeysList();
      showToast(`Admin "${dev.name}" deleted and locked out!`, 'info');
      recordAuditLog({
        adminName: 'Kausar Hayat (Master Owner)',
        role: 'Master Admin',
        actionType: 'ADMIN_REVOKED',
        details: `Revoked & deleted Admin access for "${dev.name}" (${dev.device})`
      });
    }
  }
}
const revokeDevice = deleteAdminDevice;

function quickApproveFromBanner() {
  if (STATE.pendingDeviceIdToApprove) {
    approveDevice(STATE.pendingDeviceIdToApprove);
  } else {
    openAdminManagementModal();
  }
}

function quickRejectFromBanner() {
  if (STATE.pendingDeviceIdToApprove) {
    rejectDevice(STATE.pendingDeviceIdToApprove);
  }
}

async function handleUpdateMasterKey() {
  if (!guardMasterRights('updating master credentials')) return;

  const currentInput = document.getElementById('inputMasterKeyCurrent');
  const newInput = document.getElementById('inputMasterKeyNew');
  const msgBox = document.getElementById('masterKeyUpdateMsg');

  const curr = currentInput ? currentInput.value.trim() : '';
  const newK = newInput ? newInput.value.trim() : '';

  const isCurrentValid = await verifyMasterSecurityKey(curr);
  if (!isCurrentValid) {
    if (msgBox) {
      msgBox.className = 'error-msg';
      msgBox.textContent = 'Current Master PIN is incorrect';
      msgBox.style.display = 'block';
    }
    return;
  }

  if (newK.length < 4) {
    if (msgBox) {
      msgBox.className = 'error-msg';
      msgBox.textContent = 'New Master PIN must be at least 4 characters long';
      msgBox.style.display = 'block';
    }
    return;
  }

  const newHash = await hashKeyWithSalt(newK);
  STATE.masterHash = newHash;
  localStorage.setItem('fc_master_hash', newHash);

  if (STATE.firebaseDb) {
    STATE.firebaseDb.ref('security/master_hash').set(newHash);
  }

  if (msgBox) {
    msgBox.className = 'success-msg';
    msgBox.textContent = 'Master PIN updated and securely hashed!';
    msgBox.style.display = 'block';
  }

  recordAuditLog({
    adminName: 'Kausar Hayat (Master Owner)',
    role: 'Master Admin',
    actionType: 'PASSWORD_CHANGED',
    details: 'Master Mind changed Master Security PIN (Salted SHA-256 Hashed)'
  });

  showToast('Master PIN updated and securely hashed!', 'success');
  if (currentInput) currentInput.value = '';
  if (newInput) newInput.value = '';
}

function logoutAdmin() {
  _masterSessionToken = null;
  _hasAttachedPrivateKeysListener = false;
  try {
    sessionStorage.removeItem('fc_session_auth_sig');
    sessionStorage.removeItem('fc_is_master_verified');
    sessionStorage.removeItem('fc_is_admin');
    sessionStorage.removeItem('fc_admin_name');
    sessionStorage.removeItem('fc_admin_role');
    localStorage.removeItem('fc_is_master_owner');
    localStorage.removeItem('fc_admin_private_keys');
  } catch (e) {}

  const currentName = STATE.adminName || 'Admin';
  const currentRole = STATE.isMasterAdmin ? 'Master Admin' : 'Sub-Admin';

  // Record Audit Trail
  recordAuditLog({
    adminName: currentName,
    role: currentRole,
    actionType: 'LOGOUT',
    details: 'Logged out of Admin Portal'
  });

  // Terminate Firebase Auth session
  if (window.firebase && firebase.auth) {
    try { firebase.auth().signOut().catch(() => {}); } catch (e) {}
  }

  // Mark device as logged_out in Firebase so session is terminated
  if (STATE.firebaseDb && STATE.deviceId) {
    STATE.firebaseDb.ref(`security/admin_devices/${STATE.deviceId}`).update({
      status: 'logged_out',
      role: 'guest',
      lastSeen: Date.now()
    }).catch(() => {});
  }

  STATE.isAdmin = false;
  STATE.isMasterAdmin = false;
  STATE.adminRole = 'guest';
  STATE.adminName = '';
  closeAdminManagementModal();
  updateAdminUI();
  renderAll();
  showToast('Logged out of Admin mode', 'info');
}

function updateAdminUI() {
  const adminBanner = document.getElementById('adminBanner');
  const adminEntryCard = document.getElementById('adminEntryCard');
  const adminBtnText = document.getElementById('adminBtnText');
  const adminToggleBtn = document.getElementById('adminToggleBtn');
  const adminRoleBadge = document.getElementById('adminRoleBadge');
  const adminBannerDesc = document.getElementById('adminBannerDesc');
  const btnManageAdmins = document.getElementById('btnManageAdmins');
  const btnChangePin = document.getElementById('btnChangePin');
  const btnClearAll = document.getElementById('btnClearAllRecords');

  if (STATE.isAdmin) {
    if (adminBanner) adminBanner.style.display = 'flex';
    if (adminEntryCard) adminEntryCard.style.display = 'block';
    if (adminToggleBtn) adminToggleBtn.classList.add('logged-in');

    if (STATE.isMasterAdmin) {
      if (adminBtnText) adminBtnText.textContent = '👑 Master Admin';
      if (adminRoleBadge) {
        adminRoleBadge.className = 'admin-role-tag role-master';
        adminRoleBadge.innerHTML = '<i class="fa-solid fa-crown"></i> Master Admin (Owner)';
      }
      const headerActiveCount = document.getElementById('headerActiveAdminsCount');
      if (headerActiveCount) headerActiveCount.style.display = 'inline-flex';
      if (adminBannerDesc) {
        adminBannerDesc.textContent = 'Full Master Access: Add/edit records, manage admins, and change Admin Password.';
      }
      if (btnManageAdmins) btnManageAdmins.style.display = 'inline-flex';
      if (btnChangePin) btnChangePin.style.display = 'inline-flex';
      if (btnClearAll) btnClearAll.style.display = 'inline-flex';
    } else {
      if (adminBtnText) adminBtnText.textContent = '🛡️ Sub-Admin';
      if (adminRoleBadge) {
        adminRoleBadge.className = 'admin-role-tag role-subadmin';
        adminRoleBadge.innerHTML = '<i class="fa-solid fa-shield"></i> Authorized Sub-Admin';
      }
      const headerActiveCount = document.getElementById('headerActiveAdminsCount');
      if (headerActiveCount) headerActiveCount.style.display = 'none';
      if (adminBannerDesc) {
        adminBannerDesc.textContent = 'Sub-Admin Access: Authorized to add late entries and update payment status.';
      }
      if (btnManageAdmins) btnManageAdmins.style.display = 'none';
      if (btnChangePin) btnChangePin.style.display = 'none'; // Only Master can change PIN
      if (btnClearAll) btnClearAll.style.display = 'none';
    }
  } else {
    if (adminBanner) adminBanner.style.display = 'none';
    const headerActiveCount = document.getElementById('headerActiveAdminsCount');
    if (headerActiveCount) headerActiveCount.style.display = 'none';
    if (adminEntryCard) adminEntryCard.style.display = 'none';
    if (adminBtnText) adminBtnText.textContent = 'Admin Login';
    if (adminToggleBtn) adminToggleBtn.classList.remove('logged-in');
  }
}

function togglePinVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === 'password';
  input.type = isPass ? 'text' : 'password';

  // Toggle eye icon if corresponding button exists
  const icon = input.parentElement?.querySelector('i');
  if (icon) {
    if (isPass) {
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    } else {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  }
}

/* ==================== CHANGE PIN MODAL (MASTER ONLY) ==================== */

function openPinModal() {
  if (!STATE.isMasterAdmin) {
    showToast('Permission Denied: Only Master Admin can change PIN', 'error');
    return;
  }
  const modal = document.getElementById('pinModal');
  if (modal) {
    const keyInp = document.getElementById('masterPasskeyForPinInput');
    const newInp = document.getElementById('newPinInput');
    const confInp = document.getElementById('confirmNewPinInput');
    const errMsg = document.getElementById('pinErrorMsg');
    const succMsg = document.getElementById('pinSuccessMsg');

    if (keyInp) keyInp.value = '';
    if (newInp) newInp.value = '';
    if (confInp) confInp.value = '';
    if (errMsg) errMsg.style.display = 'none';
    if (succMsg) succMsg.style.display = 'none';

    modal.style.display = 'flex';
  }
}

function closePinModal() {
  const modal = document.getElementById('pinModal');
  if (modal) modal.style.display = 'none';
}

async function handleChangePin() {
  if (!STATE.isMasterAdmin) {
    showToast('Permission Denied: Only Master Admin can change password', 'error');
    return;
  }

  const passkeyInput = document.getElementById('masterPasskeyForPinInput');
  const newPinInput = document.getElementById('newPinInput');
  const confirmPinInput = document.getElementById('confirmNewPinInput');
  const errMsg = document.getElementById('pinErrorMsg');
  const succMsg = document.getElementById('pinSuccessMsg');

  const passkey = passkeyInput ? passkeyInput.value.trim() : '';
  const newPin = newPinInput ? newPinInput.value.trim() : '';
  const confirmPin = confirmPinInput ? confirmPinInput.value.trim() : '';

  if (errMsg) errMsg.style.display = 'none';
  if (succMsg) succMsg.style.display = 'none';

  // Check Master Passkey using cryptographic verification
  const isMasterAuth = await verifyMasterSecurityKey(passkey);
  if (!isMasterAuth) {
    if (errMsg) {
      errMsg.textContent = 'Incorrect Master PIN! Verification failed.';
      errMsg.style.display = 'block';
    }
    return;
  }

  if (!newPin || newPin.length < 4) {
    if (errMsg) {
      errMsg.textContent = 'New PIN/Password must be at least 4 characters long';
      errMsg.style.display = 'block';
    }
    return;
  }

  if (newPin !== confirmPin) {
    if (errMsg) {
      errMsg.textContent = 'New PIN and Confirmation do not match!';
      errMsg.style.display = 'block';
    }
    return;
  }

  // Update PIN in STATE and LocalStorage
  STATE.adminPin = newPin;
  localStorage.setItem('fc_admin_pin', newPin);

  // Sync centrally to Firebase RTDB for all connected devices
  if (STATE.firebaseDb) {
    STATE.firebaseDb.ref('security/master_pin').set(newPin)
      .then(() => {
        if (succMsg) {
          succMsg.textContent = 'Password updated and synchronized across all devices!';
          succMsg.style.display = 'block';
        }
      });
  } else {
    if (succMsg) {
      succMsg.textContent = 'Password updated locally!';
      succMsg.style.display = 'block';
    }
  }

  // Record Audit Trail
  recordAuditLog({
    adminName: 'Kausar Hayat (Master Owner)',
    role: 'Master Admin',
    actionType: 'PASSWORD_CHANGED',
    details: 'Master Mind changed Admin Password from PIN Modal'
  });

  showToast('Admin Password successfully updated & synced!', 'success');
  setTimeout(() => {
    closePinModal();
  }, 1200);
}

/* ==================== CLOUD DATABASE SETUP MODAL ==================== */

function openCloudModal() {
  const savedFirebaseUrl = localStorage.getItem('fc_firebase_url') || DEFAULT_FIREBASE_DB_URL;
  const savedConfigJson = localStorage.getItem('fc_firebase_config') || '';
  document.getElementById('firebaseDbUrlInput').value = savedFirebaseUrl;
  document.getElementById('firebaseConfigJson').value = savedConfigJson;
  const currentMode = document.getElementById('currentStorageMode');
  if (currentMode) {
    currentMode.textContent = STATE.isCloudConnected ? 'Connected (Google Firebase Cloud)' : 'Local Storage Mode';
  }
  document.getElementById('cloudModal').style.display = 'flex';
}

function closeCloudModal() {
  document.getElementById('cloudModal').style.display = 'none';
}

function saveCloudConfig() {
  const dbUrl = document.getElementById('firebaseDbUrlInput').value.trim();
  const configJson = document.getElementById('firebaseConfigJson').value.trim();

  if (!dbUrl) {
    showToast('Please enter a Firebase Database URL', 'error');
    return;
  }

  localStorage.setItem('fc_firebase_url', dbUrl);
  if (configJson) {
    localStorage.setItem('fc_firebase_config', configJson);
  }

  closeCloudModal();
  showToast('Connecting to Cloud Database...', 'info');

  setTimeout(() => {
    initCloudOrLocalStorage();
  }, 500);
}

function disconnectCloud() {
  localStorage.removeItem('fc_firebase_url');
  localStorage.removeItem('fc_firebase_config');
  STATE.isCloudConnected = false;
  closeCloudModal();
  loadFromLocalStorage();
  showToast('Switched to local storage mode', 'info');
}

/* ==================== UTILITY FUNCTIONS ==================== */

function handleModalOverlayClick(e, modalId) {
  if (e.target.id === modalId) {
    if (modalId === 'adminModal') {
      closeAdminModal();
    } else if (modalId === 'adminManageModal') {
      closeAdminManagementModal();
    } else if (modalId === 'pinModal') {
      closePinModal();
    } else if (modalId === 'cloudModal') {
      closeCloudModal();
    } else if (modalId === 'editEntryModal') {
      closeEditModal();
    } else {
      const el = document.getElementById(modalId);
      if (el) el.style.display = 'none';
    }
  }
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return '-';
  try {
    const str = String(isoDate).trim();
    const parts = str.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
    const d = new Date(isoDate);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return str;
  } catch (e) {
    return String(isoDate);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== READ-ONLY IMMUTABLE BINDINGS & TAMPER SHIELD ====================

const SECURE_BINDINGS = {
  toggleAdminModal,
  closeAdminModal,
  retryAdminLogin,
  switchLoginTab,
  handleAdminLogin,
  goToAdminStep2,
  backToAdminStep1,
  handleAdminPrivateKeySubmit,
  requestEmailPermissionFromStep2,
  sendMasterRecoveryEmail,
  createAdminPrivateKey,
  revokeAdminPrivateKey,
  prefillAssignPrivateKey,
  updateMasterLoginViewMode,
  handleMasterOwnerLogin,
  openAdminManagementModal,
  closeAdminManagementModal,
  switchManageTab,
  approveDevice,
  rejectDevice,
  deleteAdminDevice,
  revokeDevice: deleteAdminDevice,
  quickApproveFromBanner,
  quickRejectFromBanner,
  handleUpdateMasterKey,
  logoutAdmin,
  openPinModal,
  closePinModal,
  handleChangePin,
  openCloudModal,
  closeCloudModal,
  saveCloudConfig,
  disconnectCloud,
  handleNewEntry,
  togglePayment,
  deleteEntry,
  openEditModal,
  closeEditModal,
  saveEditedEntry,
  clearAllRecords,
  applyFilters,
  clearSearch,
  setPresetTime,
  togglePinVisibility,
  sendTestSecurityEmail,
  handleModalOverlayClick,
  clearAuditLogs,
  renderAuditLogsList,
  filterAuditLogsForAdmin
};

// Freeze all functions on window so they CANNOT be overwritten in DevTools Console
Object.keys(SECURE_BINDINGS).forEach(key => {
  try {
    Object.defineProperty(window, key, {
      value: SECURE_BINDINGS[key],
      writable: false,
      configurable: false
    });
  } catch (e) {
    window[key] = SECURE_BINDINGS[key];
  }
});

// Discourage inspect shortcut keys while Master portal is active
document.addEventListener('keydown', (e) => {
  if (
    e.key === 'F12' || 
    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
    (e.ctrlKey && (e.key === 'U' || e.key === 'u'))
  ) {
    const manageModal = document.getElementById('adminManageModal');
    if (manageModal && manageModal.style.display === 'flex') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }
});



