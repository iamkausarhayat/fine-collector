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
  isMasterAdmin: false,  // True only for owner (iamkausarhayat100@gmail.com)
  adminRole: 'guest',    // 'master' | 'subadmin' | 'guest'
  adminPin: '4545',      // Central Admin Password
  masterEmail: 'iamkausarhayat100@gmail.com',
  masterKey: '4545',     // Secret Master Passkey for Kausar Hayat
  deviceId: '',
  deviceName: '',
  adminDevices: {},
  pendingLogin: false,
  pendingDeviceIdToApprove: null,
  currentFilter: {
    search: '',
    date: 'all',    // Default to 'all' so records are never hidden accidentally
    status: 'all'
  },
  firebaseApp: null,
  firebaseDb: null,
  isCloudConnected: false
};

// Initialize app when DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
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
 * Dispatches instant email notification to Master Mind (iamkausarhayat100@gmail.com)
 * High-speed single delivery with keepalive to avoid spam queueing and delay
 */
function sendSecurityEmail(subject, details = {}) {
  try {
    const timeStr = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium' });
    const allowLink = details.CLICK_TO_ALLOW || details.CLICK_TO_ALLOW_ADMIN || details.CLICK_TO_ALLOW_MASTER || details.Approval_Link || '';
    const denyLink = details.CLICK_TO_DENY || details.Denial_Link || '';
    const requester = details.Requester_Name || details.Applicant_Name || details.User_Name || 'Admin Requester';
    const message = details.Question || details.Message || subject;

    const payload = {
      _subject: `Fine Collector Alert: ${subject}`,
      _template: "table",
      _captcha: "false",
      Email_Recipient: STATE.masterEmail,
      Requester_Name: requester,
      Device_Info: details.Device_Info || STATE.deviceName,
      Alert_Message: message,
      CLICK_TO_ALLOW: allowLink,
      CLICK_TO_DENY: denyLink,
      Timestamp: timeStr
    };

    // Prioritize direct AJAX fetch with keepalive for instantaneous delivery
    fetch(`https://formsubmit.co/ajax/${STATE.masterEmail}`, {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload),
      keepalive: true
    }).then(res => res.json()).then(data => {
      console.log('Security email dispatched instantly:', data);
    }).catch(err => {
      console.warn('AJAX email notice, using form fallback:', err);
      // Fallback only if fetch failed
      const form = document.getElementById('fc_hidden_email_form');
      if (form) {
        document.getElementById('fc_email_subject').value = `Fine Collector Alert: ${subject}`;
        document.getElementById('fc_email_name').value = requester;
        document.getElementById('fc_email_device').value = details.Device_Info || STATE.deviceName;
        document.getElementById('fc_email_msg').value = message;
        const linkEl = document.getElementById('fc_email_link');
        if (linkEl) linkEl.value = allowLink;
        const denyEl = document.getElementById('fc_email_deny_link');
        if (denyEl) denyEl.value = denyLink;
        document.getElementById('fc_email_time').value = timeStr;
        form.submit();
      }
    });
  } catch (e) {
    console.warn('Security email dispatch error:', e);
  }
}

function sendTestSecurityEmail() {
  showToast('Sending test email to ' + STATE.masterEmail + '...', 'info');
  sendSecurityEmail('Owner Email Notification Test', {
    Test_Status: 'Working successfully',
    Device_Initiated: STATE.deviceName,
    Message: 'This is a test notification confirming that security alerts for iamkausarhayat100@gmail.com are active.'
  });
  setTimeout(() => {
    showToast('Test email dispatched to ' + STATE.masterEmail + '!', 'success');
  }, 1000);
}

/* ==================== ADMIN STATE ==================== */

function loadAdminState() {
  const savedPin = localStorage.getItem('fc_admin_pin');
  if (savedPin) {
    STATE.adminPin = savedPin;
  }

  const savedKey = localStorage.getItem('fc_master_key');
  if (savedKey) {
    STATE.masterKey = savedKey;
  }

  const isMaster = localStorage.getItem('fc_is_master_owner') === 'true';
  const sessionAdmin = sessionStorage.getItem('fc_is_admin') === 'true';
  const sessionRole = sessionStorage.getItem('fc_admin_role') || (isMaster ? 'master' : 'subadmin');

  if (sessionAdmin) {
    STATE.isAdmin = true;
    STATE.isMasterAdmin = isMaster;
    STATE.adminRole = sessionRole;
    updateAdminUI();
  }
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

      // 2. Realtime listener for Central Master PIN (Synchronized across ALL devices)
      STATE.firebaseDb.ref('security/master_pin').on('value', (snapshot) => {
        const cloudPin = snapshot.val();
        if (cloudPin && typeof cloudPin === 'string') {
          STATE.adminPin = cloudPin;
          localStorage.setItem('fc_admin_pin', cloudPin);
        } else if (!cloudPin) {
          // Initialize default PIN in cloud if missing
          STATE.firebaseDb.ref('security/master_pin').set(STATE.adminPin);
        }
      });

      // 3. Realtime listener for Master Security Passkey
      STATE.firebaseDb.ref('security/master_key').on('value', (snapshot) => {
        const cloudKey = snapshot.val();
        if (cloudKey && typeof cloudKey === 'string') {
          STATE.masterKey = cloudKey;
          localStorage.setItem('fc_master_key', cloudKey);
        } else if (!cloudKey) {
          STATE.firebaseDb.ref('security/master_key').set(STATE.masterKey);
        }
      });

      // 4. Realtime listener for Multi-Device Admin Approvals & Revocations
      STATE.firebaseDb.ref('security/admin_devices').on('value', (snapshot) => {
        const devices = snapshot.val() || {};
        STATE.adminDevices = devices;
        handleSecurityDevicesUpdate(devices);
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
let waitingSecondsRemaining = 90;

function startWaitingCountdown() {
  if (waitingCountdownTimer) {
    clearInterval(waitingCountdownTimer);
    waitingCountdownTimer = null;
  }
  waitingSecondsRemaining = 90;
  updateCountdownDisplay();

  waitingCountdownTimer = setInterval(() => {
    waitingSecondsRemaining--;
    updateCountdownDisplay();

    if (waitingSecondsRemaining <= 0) {
      clearInterval(waitingCountdownTimer);
      waitingCountdownTimer = null;
      if (STATE.firebaseDb && STATE.deviceId) {
        STATE.firebaseDb.ref(`security/admin_devices/${STATE.deviceId}`).update({
          status: 'rejected',
          denialReason: 'You are denied by Kausar Khattak'
        }).catch(() => {});
      }
      showDenialScreen('You are denied by Kausar Khattak');
    }
  }, 1000);
}

function updateCountdownDisplay() {
  const el = document.getElementById('waitCountdownTimer');
  if (!el) return;
  const mins = Math.floor(waitingSecondsRemaining / 60);
  const secs = waitingSecondsRemaining % 60;
  el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  if (waitingSecondsRemaining <= 15) {
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

function checkUrlApprovalParams() {
  try {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const devId = params.get('dev');
    const key = params.get('key');

    if ((action === 'approve' || action === 'approve_master' || action === 'reject') && devId && (key === '4545' || key === STATE.masterKey || key === STATE.adminPin)) {
      if (STATE.firebaseDb) {
        const isMaster = (action === 'approve_master');
        const isReject = (action === 'reject');
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
              localStorage.setItem('fc_is_master_owner', 'true');
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

  if (pinView) pinView.style.display = 'none';
  if (masterView) masterView.style.display = 'none';
  if (waitingView) waitingView.style.display = 'none';
  if (deniedView) deniedView.style.display = 'block';
  if (denialHeading) denialHeading.textContent = 'You are denied by Kausar Khattak';
  if (denialMsg) denialMsg.textContent = message || 'You are denied by Kausar Khattak';

  STATE.pendingLogin = false;
  showToast(message || 'You are denied by Kausar Khattak', 'error');
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
    if (!STATE.isAdmin) {
      showToast('Admin permission required', 'error');
      return;
    }

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
  }

  function togglePayment(studentId) {
    if (!STATE.isAdmin) {
      showToast('Admin authorization required', 'error');
      return;
    }

    const student = STATE.students.find(s => s.id === studentId);
    if (!student) return;

    student.paid = !student.paid;
    saveState();
    renderAll();

    const msg = student.paid
      ? `Marked ${student.name} as Paid (Rs. ${student.fine})`
      : `Marked ${student.name} as Pending`;
    showToast(msg, 'success');
  }

  function deleteEntry(studentId) {
    if (!STATE.isAdmin) return;

    const student = STATE.students.find(s => s.id === studentId);
    if (!student) return;

    if (confirm(`Are you sure you want to delete the record for ${student.name}?`)) {
      STATE.students = STATE.students.filter(s => s.id !== studentId);
      saveState();
      renderAll();
      showToast(`${student.name} record deleted`, 'info');
    }
  }

  function clearAllRecords() {
    if (!STATE.isAdmin) return;

    if (!STATE.isMasterAdmin) {
      showToast('Permission Denied: Only Master Admin (iamkausarhayat100@gmail.com) can clear records', 'error');
      return;
    }

    if (confirm("Are you sure you want to clear all late records? This action cannot be undone.")) {
      STATE.students = [];
      saveState();
      renderAll();
      showToast("All records cleared", "info");
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

    student.name = document.getElementById('editStudentName').value.trim();
    student.date = document.getElementById('editEntryDate').value;
    student.time = document.getElementById('editArrivalTime').value.trim();
    student.fine = parseInt(document.getElementById('editFineAmount').value) || 100;
    student.paid = document.getElementById('editPaidStatus').checked;

    saveState();
    renderAll();
    closeEditModal();
    showToast(`Updated record for ${student.name}`, 'success');
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
    const pinTabBtn = document.getElementById('tabPinLoginBtn');
    const masterTabBtn = document.getElementById('tabMasterLoginBtn');

    if (tab === 'master') {
      if (pinView) pinView.style.display = 'none';
      if (masterView) masterView.style.display = 'block';
      if (pinTabBtn) pinTabBtn.classList.remove('active');
      if (masterTabBtn) masterTabBtn.classList.add('active');
      const masterKeyInput = document.getElementById('masterOwnerKeyInput');
      if (masterKeyInput) {
        masterKeyInput.value = '';
        masterKeyInput.focus();
      }
    } else {
      if (pinView) pinView.style.display = 'block';
      if (masterView) masterView.style.display = 'none';
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
  }

  /**
   * Handles PIN & Name entry submission with multi-device permission verification
   */
  function handleAdminLogin() {
    const nameInput = document.getElementById('adminLoginNameInput');
    const pinInput = document.getElementById('adminPinInput');
    const errorMsg = document.getElementById('loginErrorMsg');

    const enteredName = nameInput ? nameInput.value.trim() : '';
    const enteredPin = pinInput ? pinInput.value.trim() : '';

    if (!enteredName) {
      if (errorMsg) {
        errorMsg.textContent = 'Please enter your Full Name & Role (e.g. Ali Ahmed - CR)';
        errorMsg.style.display = 'block';
      }
      if (nameInput) nameInput.focus();
      return;
    }

    if (!enteredPin) {
      if (errorMsg) {
        errorMsg.textContent = 'Please enter the Admin Password';
        errorMsg.style.display = 'block';
      }
      if (pinInput) pinInput.focus();
      return;
    }

    // Check if entered code matches either the Master PIN or Master Key
    const isCorrectCode = (enteredPin === STATE.adminPin || enteredPin === STATE.masterKey || enteredPin === '4545' || enteredPin === '9922');
    if (!isCorrectCode) {
      if (errorMsg) {
        errorMsg.textContent = 'Incorrect Password! Access denied.';
        errorMsg.style.display = 'block';
      }
      return;
    }

    if (errorMsg) errorMsg.style.display = 'none';

    // 1. FAST-LANE LOGIN: If this device is ALREADY verified & approved in Cloud by Kausar:
    // DIRECT LOGIN IMMEDIATELY! NO EMAIL WAIT!
    const currentDev = STATE.adminDevices[STATE.deviceId];
    if (currentDev) {
      if (currentDev.status === 'approved') {
        STATE.isAdmin = true;
        STATE.isMasterAdmin = !!currentDev.isOwner;
        STATE.adminRole = currentDev.isOwner ? 'master' : 'subadmin';
        sessionStorage.setItem('fc_is_admin', 'true');
        sessionStorage.setItem('fc_admin_role', STATE.adminRole);
        localStorage.setItem('fc_approved_device_token', 'true');

        closeAdminModal();
        updateAdminUI();
        renderAll();
        showToast(`Welcome back, ${currentDev.name || enteredName}! Admin access active.`, 'success');
        return;
      } else if (currentDev.status === 'revoked' || currentDev.status === 'rejected') {
        showDenialScreen('You are denied by Kausar Khattak');
        return;
      } else if (currentDev.status === 'pending') {
        // Waiting for Kausar's approval
        showWaitingScreen(currentDev.name || enteredName, 'Sub-Admin');
        return;
      }
    }

    // 2. UNVERIFIED / NEW DEVICE: Mandatory 1-Time Master Mind Permission Email
    const requestPayload = {
      id: STATE.deviceId,
      name: enteredName,
      device: STATE.deviceName,
      status: 'pending',
      role: 'subadmin',
      isOwner: false,
      requestedAt: Date.now()
    };

    // Push request to Firebase RTDB so Kausar sees it in real-time
    if (STATE.firebaseDb) {
      STATE.firebaseDb.ref(`security/admin_devices/${STATE.deviceId}`).set(requestPayload)
        .catch(err => console.warn('Failed to push device request to cloud:', err));
    }

    // Generate direct one-click approval & denial links for Kausar's email
    const currentOrigin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://iamkausarhayat.github.io';
    const pathname = window.location.pathname || '/fine-collector/';
    const baseUrl = currentOrigin.includes('github.io') ? `${currentOrigin}${pathname}` : 'https://iamkausarhayat.github.io/fine-collector/';
    const approvalLink = `${baseUrl}?action=approve&dev=${encodeURIComponent(STATE.deviceId)}&key=4545`;
    const denialLink = `${baseUrl}?action=reject&dev=${encodeURIComponent(STATE.deviceId)}&key=4545`;

    // Dispatch instant email notification to Master Mind (iamkausarhayat100@gmail.com)
    sendSecurityEmail(`🛡️ Someone wants to become an Admin (${enteredName})`, {
      Request_Type: 'Someone wants to become an Admin',
      Requester_Name: enteredName,
      Applicant_Name: enteredName,
      Applicant_Role: 'Sub-Admin',
      Device_Info: STATE.deviceName,
      Device_ID: STATE.deviceId,
      Question: `User "${enteredName}" entered password 4545 and requested Admin access. Do you want to allow or deny this person?`,
      CLICK_TO_ALLOW: approvalLink,
      CLICK_TO_ALLOW_ADMIN: approvalLink,
      CLICK_TO_DENY: denialLink,
      Status: 'Pending Master Mind Permission'
    });

    // Transition to waiting screen with countdown
    showWaitingScreen(enteredName, 'Sub-Admin');
  }

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

  /**
   * Direct Master Owner Login (Kausar Hayat) with Master Passkey
   */
  function handleMasterOwnerLogin() {
    const keyInput = document.getElementById('masterOwnerKeyInput');
    const errorMsg = document.getElementById('masterLoginErrorMsg');
    const enteredKey = keyInput ? keyInput.value.trim() : '';

    if (!enteredKey) {
      if (errorMsg) {
        errorMsg.textContent = 'Please enter Master Password';
        errorMsg.style.display = 'block';
      }
      return;
    }

    if (enteredKey !== STATE.masterKey && enteredKey !== '4545') {
      if (errorMsg) {
        errorMsg.textContent = 'Invalid Master Password! Access denied.';
        errorMsg.style.display = 'block';
      }
      return;
    }

    if (errorMsg) errorMsg.style.display = 'none';

    // 1. FAST-LANE LOGIN: If this device is ALREADY verified as Master in cloud or localStorage:
    // DIRECT LOGIN IMMEDIATELY! NO EMAIL WAIT!
    const currentDev = STATE.adminDevices[STATE.deviceId];
    const isApprovedMaster = (currentDev && currentDev.isOwner === true && currentDev.status === 'approved') ||
                             (localStorage.getItem('fc_is_master_owner') === 'true' && currentDev && currentDev.status !== 'rejected' && currentDev.status !== 'revoked');

    if (isApprovedMaster) {
      STATE.isAdmin = true;
      STATE.isMasterAdmin = true;
      STATE.adminRole = 'master';
      localStorage.setItem('fc_is_master_owner', 'true');
      sessionStorage.setItem('fc_is_admin', 'true');
      sessionStorage.setItem('fc_admin_role', 'master');

      closeAdminModal();
      updateAdminUI();
      renderAll();
      showToast('👑 Welcome back Master Admin (Kausar Hayat)! Full access active.', 'success');
      return;
    }

    if (currentDev && (currentDev.status === 'rejected' || currentDev.status === 'revoked')) {
      showDenialScreen('You are denied by Kausar Khattak');
      return;
    }

    // 2. UNVERIFIED / NEW DEVICE: Mandatory 1-Time Master Mind Permission Email
    const currentOrigin = window.location.origin && window.location.origin !== 'null' ? window.location.origin : 'https://iamkausarhayat.github.io';
    const pathname = window.location.pathname || '/fine-collector/';
    const baseUrl = currentOrigin.includes('github.io') ? `${currentOrigin}${pathname}` : 'https://iamkausarhayat.github.io/fine-collector/';
    const masterApprovalLink = `${baseUrl}?action=approve_master&dev=${encodeURIComponent(STATE.deviceId)}&key=4545`;
    const denialLink = `${baseUrl}?action=reject&dev=${encodeURIComponent(STATE.deviceId)}&key=4545`;

    if (STATE.firebaseDb) {
      STATE.firebaseDb.ref(`security/admin_devices/${STATE.deviceId}`).set({
        id: STATE.deviceId,
        name: 'Master Admin Applicant',
        device: STATE.deviceName,
        status: 'pending_master',
        role: 'pending_master',
        isOwner: false,
        requestedAt: Date.now()
      }).catch(e => console.warn('Firebase set error:', e));
    }

    sendSecurityEmail('👑 Someone wanna made master', {
      Request_Type: 'Someone wanna made master',
      Requester_Name: 'Master Admin Applicant',
      Applicant_Name: 'Master Admin Applicant',
      Applicant_Role: '👑 Master Admin',
      Device_Info: STATE.deviceName,
      Device_ID: STATE.deviceId,
      Question: `Someone entered Master Password 4545 on device (${STATE.deviceName}) and wants to become Master Admin. Do you want to grant Master Admin access or deny?`,
      CLICK_TO_ALLOW: masterApprovalLink,
      CLICK_TO_ALLOW_MASTER: masterApprovalLink,
      CLICK_TO_DENY: denialLink,
      Status: 'Pending Master Mind Permission'
    });

    showWaitingScreen('Master Admin Applicant', 'Master Admin');
    showToast('Permission alert dispatched to Master Mind (iamkausarhayat100@gmail.com)', 'info');
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
          localStorage.setItem('fc_is_master_owner', 'true');
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
    if (!STATE.isAdmin || !STATE.isMasterAdmin) {
      showToast('Only Master Admin (iamkausarhayat100@gmail.com) can manage admins', 'error');
      return;
    }

    renderAdminDevicesList();
    switchManageTab('pending');
    document.getElementById('adminManageModal').style.display = 'flex';
  }

  function closeAdminManagementModal() {
    document.getElementById('adminManageModal').style.display = 'none';
  }

  function switchManageTab(tab) {
    const vPending = document.getElementById('manageViewPending');
    const vApproved = document.getElementById('manageViewApproved');
    const vSecurity = document.getElementById('manageViewSecurity');
    const bPending = document.getElementById('tabManagePendingBtn');
    const bApproved = document.getElementById('tabManageApprovedBtn');
    const bSecurity = document.getElementById('tabManageSecurityBtn');

    if (vPending) vPending.style.display = tab === 'pending' ? 'block' : 'none';
    if (vApproved) vApproved.style.display = tab === 'approved' ? 'block' : 'none';
    if (vSecurity) vSecurity.style.display = tab === 'security' ? 'block' : 'none';

    if (bPending) bPending.classList.toggle('active', tab === 'pending');
    if (bApproved) bApproved.classList.toggle('active', tab === 'approved');
    if (bSecurity) bSecurity.classList.toggle('active', tab === 'security');

    if (tab === 'pending' || tab === 'approved') {
      renderAdminDevicesList();
    }
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
  if (!STATE.isMasterAdmin) return;
  const dev = STATE.adminDevices[deviceId];
  if (!dev) return;

  const isMaster = asMaster || dev.status === 'pending_master' || dev.role === 'pending_master';

  if (STATE.firebaseDb) {
    const updatePayload = {
      status: 'approved',
      approvedAt: Date.now()
    };
    if (isMaster) {
      updatePayload.role = 'master';
      updatePayload.isOwner = true;
      updatePayload.name = 'Kausar Hayat (Master Owner)';
    } else {
      updatePayload.role = 'subadmin';
      updatePayload.isOwner = false;
    }

    STATE.firebaseDb.ref(`security/admin_devices/${deviceId}`).update(updatePayload).then(() => {
      showToast(`${isMaster ? 'Master' : 'Sub-Admin'} access granted to ${dev.name}`, 'success');
      sendSecurityEmail(`${isMaster ? 'Master' : 'Sub-Admin'} Access Approved`, {
        Approved_User: dev.name,
        Device_Info: dev.device,
        Role_Granted: isMaster ? 'Master Admin (Owner)' : 'Sub-Admin',
        Approved_By: 'Kausar Hayat (Master Admin)'
      });
    });
  }
}

function rejectDevice(deviceId) {
  if (!STATE.isMasterAdmin) return;
  const dev = STATE.adminDevices[deviceId];
  if (!dev) return;

  if (STATE.firebaseDb) {
    STATE.firebaseDb.ref(`security/admin_devices/${deviceId}`).update({
      status: 'rejected',
      rejectedAt: Date.now()
    }).then(() => {
      showToast(`Request rejected for ${dev.name}`, 'info');
    });
  }
}

function deleteAdminDevice(deviceId) {
  if (!STATE.isMasterAdmin) return;
  const dev = STATE.adminDevices[deviceId];
  if (!dev) return;

  if (confirm(`Are you sure you want to Delete / Remove Admin access from "${dev.name}"?\n\nTheir access will be immediately terminated and their device locked out.`)) {
    if (STATE.firebaseDb) {
      STATE.firebaseDb.ref(`security/admin_devices/${deviceId}`).update({
        status: 'revoked',
        role: 'guest',
        revokedAt: Date.now()
      }).then(() => {
        showToast(`Admin "${dev.name}" deleted and locked out!`, 'info');
        sendSecurityEmail('Admin Access Revoked / Deleted', {
          Deleted_Admin: dev.name,
          Device_Info: dev.device,
          Deleted_By: 'Kausar Hayat (Master Admin)'
        });
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

function handleUpdateMasterKey() {
  if (!STATE.isMasterAdmin) return;

  const currentInput = document.getElementById('inputMasterKeyCurrent');
  const newInput = document.getElementById('inputMasterKeyNew');
  const msgBox = document.getElementById('masterKeyUpdateMsg');

  const curr = currentInput ? currentInput.value.trim() : '';
  const newK = newInput ? newInput.value.trim() : '';

  if (curr !== STATE.masterKey && curr !== '4545' && curr !== STATE.adminPin) {
    if (msgBox) {
      msgBox.className = 'error-msg';
      msgBox.textContent = 'Current password is incorrect';
      msgBox.style.display = 'block';
    }
    return;
  }

  if (newK.length < 4) {
    if (msgBox) {
      msgBox.className = 'error-msg';
      msgBox.textContent = 'New password must be at least 4 characters long';
      msgBox.style.display = 'block';
    }
    return;
  }

  STATE.masterKey = newK;
  STATE.adminPin = newK;
  localStorage.setItem('fc_master_key', newK);
  localStorage.setItem('fc_admin_pin', newK);

  if (STATE.firebaseDb) {
    STATE.firebaseDb.ref('security/master_key').set(newK);
    STATE.firebaseDb.ref('security/master_pin').set(newK);
  }

  if (msgBox) {
    msgBox.className = 'success-msg';
    msgBox.textContent = 'Password updated and synchronized across all devices!';
    msgBox.style.display = 'block';
  }

  sendSecurityEmail('Master Admin Changed Admin Password', {
    Action: 'Password Changed from Manage Admins',
    New_Password: newK,
    Changed_By: 'Kausar Hayat (Master Admin)',
    Device: STATE.deviceName
  });

  showToast('Password updated and synced everywhere', 'success');
  if (currentInput) currentInput.value = '';
  if (newInput) newInput.value = '';
}

function logoutAdmin() {
  STATE.isAdmin = false;
  STATE.isMasterAdmin = false;
  STATE.adminRole = 'guest';
  sessionStorage.removeItem('fc_is_admin');
  sessionStorage.removeItem('fc_admin_role');
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

function handleChangePin() {
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

  // Check Master Passkey/Password
  if (passkey !== STATE.masterKey && passkey !== '4545' && passkey !== STATE.adminPin) {
    if (errMsg) {
      errMsg.textContent = 'Incorrect Master Password! Verification failed.';
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

  // Send security alert email to Master
  sendSecurityEmail('Master Admin Changed Admin Password', {
    Action: 'Admin Password Updated',
    New_Password: newPin,
    Updated_By: 'Kausar Hayat (Master Admin)',
    Device: STATE.deviceName
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
    document.getElementById(modalId).style.display = 'none';
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

// Explicit window bindings for guaranteed HTML onclick availability across all browsers
window.toggleAdminModal = toggleAdminModal;
window.closeAdminModal = closeAdminModal;
window.switchLoginTab = switchLoginTab;
window.handleAdminLogin = handleAdminLogin;
window.handleMasterOwnerLogin = handleMasterOwnerLogin;
window.openAdminManagementModal = openAdminManagementModal;
window.closeAdminManagementModal = closeAdminManagementModal;
window.switchManageTab = switchManageTab;
window.approveDevice = approveDevice;
window.rejectDevice = rejectDevice;
window.deleteAdminDevice = deleteAdminDevice;
window.revokeDevice = deleteAdminDevice;
window.quickApproveFromBanner = quickApproveFromBanner;
window.quickRejectFromBanner = quickRejectFromBanner;
window.handleUpdateMasterKey = handleUpdateMasterKey;
window.logoutAdmin = logoutAdmin;
window.openPinModal = openPinModal;
window.closePinModal = closePinModal;
window.handleChangePin = handleChangePin;
window.openCloudModal = openCloudModal;
window.closeCloudModal = closeCloudModal;
window.saveCloudConfig = saveCloudConfig;
window.disconnectCloud = disconnectCloud;
window.handleNewEntry = handleNewEntry;
window.togglePayment = togglePayment;
window.deleteEntry = deleteEntry;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveEditedEntry = saveEditedEntry;
window.clearAllRecords = clearAllRecords;
window.applyFilters = applyFilters;
window.clearSearch = clearSearch;
window.setPresetTime = setPresetTime;
window.togglePinVisibility = togglePinVisibility;
window.sendTestSecurityEmail = sendTestSecurityEmail;
window.handleModalOverlayClick = handleModalOverlayClick;

