/**
 * Fine Collector - Class 8:00 AM Late Tracker
 * Phase 2: Server-Enforced Zero-Trust Architecture
 * Powered by Google Cloud Firestore & Firebase Authentication
 */

(function () {
  'use strict';

  // Read configuration injected from firebase-config.js
  const firebaseConfig = window.__FC_FIREBASE_CONFIG__ || {
    projectId: "fine-collector",
    authDomain: "fine-collector.firebaseapp.com"
  };
  const recaptchaSiteKey = window.__FC_RECAPTCHA_SITE_KEY__ || "";

  // Immediately remove temporary global configurations
  try { delete window.__FC_FIREBASE_CONFIG__; } catch (_) {}
  try { delete window.__FC_RECAPTCHA_SITE_KEY__; } catch (_) {}

  // Obtain internal SDK reference and remove global window.firebase
  const fb = window.firebase;
  try { delete window.firebase; } catch (_) {}

  if (!fb) {
    console.error('Firebase SDK not detected. Please ensure compat scripts are loaded.');
    return;
  }

  /* ==================== APPLICATION STATE ==================== */
  const STATE = {
    students: [],
    isAdmin: false,
    isMasterAdmin: false,
    adminRole: 'guest', // 'guest' | 'subadmin' | 'master'
    adminName: '',
    adminUid: '',
    pendingRequests: [],
    activeAdmins: [],
    auditLogs: [],
    auditFilterAdmin: 'all',
    auditFilterAction: 'all',
    currentFilter: {
      search: '',
      date: 'all',
      status: 'all'
    }
  };

  /* ==================== THEME MANAGEMENT ==================== */
  const THEME_KEY = 'fc_theme';

  function getCurrentTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) {}
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
      toggleIcon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
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
      console.warn('Theme storage notice:', e);
    }
    applyTheme(next);
    showToast(`${next === 'dark' ? 'Dark' : 'Light'} Mode active`, 'info');
  }

  // Apply theme immediately
  applyTheme(getCurrentTheme());

  /* ==================== FIREBASE INITIALIZATION ==================== */
  // Determine if valid reCAPTCHA v3 site key is provided
  const isAppCheckConfigured = typeof recaptchaSiteKey === 'string' &&
    recaptchaSiteKey.trim() !== '' &&
    !recaptchaSiteKey.includes('REPLACE');

  // Primary Firebase app instance for Fine Collector (MUST initialize first)
  let mainApp;
  if (!fb.apps.length) {
    mainApp = fb.initializeApp(firebaseConfig);
  } else {
    mainApp = fb.app();
  }

  // Activate App Check on main app only AFTER initializeApp
  if (isAppCheckConfigured) {
    try {
      fb.appCheck().activate(recaptchaSiteKey, true);
    } catch (err) {
      console.warn('[AppCheck] Main app App Check activation error:', err.message);
    }
  } else {
    console.warn('[AppCheck] Skipping App Check activation: no valid reCAPTCHA v3 site key provided.');
  }

  const mainAuth = fb.auth();
  const mainDb = fb.firestore();

  // Secondary Firebase app instance for Master Mind key creation
  function getSecondaryAuth() {
    let secApp = fb.apps.find(a => a.name === 'secondary');
    if (!secApp) {
      secApp = fb.initializeApp(firebaseConfig, 'secondary');
      if (isAppCheckConfigured && secApp.appCheck) {
        try {
          secApp.appCheck().activate(recaptchaSiteKey, true);
        } catch (err) {
          console.warn('[AppCheck] Secondary app App Check activation error:', err.message);
        }
      } else if (!isAppCheckConfigured) {
        console.warn('[AppCheck] Skipping Secondary App Check activation: no valid reCAPTCHA v3 site key provided.');
      }
    }
    return secApp.auth();
  }

  /* ==================== MASTER LOCKOUT COUNTER ==================== */
  let failedMasterAttempts = 0;
  let masterLockedUntil = 0;

  /* ==================== SUB-ADMIN PERMISSION WAITING STATE ==================== */
  let waitingCountdownInterval = null;
  let waitingAdminUnsubscribe = null;
  let waitingRequestUnsubscribe = null;
  let isWaitingForApproval = false;

  /* ==================== INACTIVITY AUTO-LOGOUT ==================== */
  let lastActivityTimestamp = Date.now();
  const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

  function recordUserActivity() {
    lastActivityTimestamp = Date.now();
  }

  ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'].forEach(eventName => {
    window.addEventListener(eventName, recordUserActivity, { passive: true });
  });

  setInterval(async () => {
    if (STATE.isAdmin && (Date.now() - lastActivityTimestamp > INACTIVITY_TIMEOUT_MS)) {
      console.log('Inactivity timeout reached (10 minutes). Logging out...');
      await handleLogout('inactivity');
    }
  }, 15000);

  /* ==================== AUDIT LOGGING HELPER ==================== */
  async function logAdminAction(actionType, details) {
    if (!STATE.isAdmin || !mainAuth.currentUser) return;
    try {
      const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      const logEntry = {
        adminUid: mainAuth.currentUser.uid,
        adminName: STATE.adminName || 'Admin',
        actionType: String(actionType).toUpperCase(),
        details: String(details).substring(0, 200),
        timestamp: Date.now()
      };
      await mainDb.collection('admin_audit_logs').doc(logId).set(logEntry);
    } catch (err) {
      console.warn('Audit log write error:', err.message);
    }
  }

  /* ==================== STRING & DEVICE HELPERS ==================== */
  function slugify(name) {
    return String(name || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'admin';
  }

  function getDeviceDescription() {
    const ua = navigator.userAgent || '';
    let browser = 'Browser';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';

    let os = 'Device';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Macintosh') || ua.includes('Mac OS')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return `${browser} on ${os}`;
  }

  function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function isSameDay(dateStr1, dateStr2) {
    if (!dateStr1 || !dateStr2) return false;
    return String(dateStr1).substring(0, 10) === String(dateStr2).substring(0, 10);
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatDateDisplay(isoDate) {
    if (!isoDate) return '-';
    try {
      const parts = String(isoDate).trim().split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
        }
      }
      return String(isoDate);
    } catch (_) {
      return String(isoDate);
    }
  }

  /* ==================== TOAST NOTIFICATIONS ==================== */
  function showToast(message, type = 'info', duration = 3200) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.title = 'Click to dismiss';

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    toast.addEventListener('click', () => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 250);
    });

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 250);
      }
    }, duration);
  }

  /* ==================== REALTIME STUDENTS LISTENER ==================== */
  mainDb.collection('students').onSnapshot((snapshot) => {
    const list = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data && typeof data === 'object') {
        list.push({ ...data, id: doc.id });
      }
    });
    // Sort latest records first
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    STATE.students = list;
    renderAll();
  }, (error) => {
    console.warn('[Firestore] Students listener notice:', error.message);
  });

  /* ==================== AUTH STATE CHANGE LISTENER ==================== */
  mainAuth.onAuthStateChanged(async (user) => {
    if (user) {
      try {
        const adminDoc = await mainDb.collection('admins').doc(user.uid).get();
        if (adminDoc.exists) {
          const data = adminDoc.data() || {};
          STATE.isAdmin = true;
          STATE.adminRole = data.role || 'subadmin';
          STATE.isMasterAdmin = (STATE.adminRole === 'master');
          STATE.adminName = data.name || (STATE.isMasterAdmin ? 'Kausar Hayat' : 'Sub-Admin');
          STATE.adminUid = user.uid;

          updateUIForAdminState();

          if (STATE.isMasterAdmin) {
            attachMasterListeners();
          }
          return;
        }
      } catch (e) {
        console.warn('Admin status check notice:', e.message);
      }
    }

    if (!isWaitingForApproval) {
      resetAdminState();
      updateUIForAdminState();
    }
  });

  function resetAdminState() {
    STATE.isAdmin = false;
    STATE.isMasterAdmin = false;
    STATE.adminRole = 'guest';
    STATE.adminName = '';
    STATE.adminUid = '';
    STATE.pendingRequests = [];
    STATE.activeAdmins = [];
    STATE.auditLogs = [];
    detachMasterListeners();
  }

  function updateUIForAdminState() {
    const adminBanner = document.getElementById('adminBanner');
    const adminEntryCard = document.getElementById('adminEntryCard');
    const adminBtnText = document.getElementById('adminBtnText');
    const adminToggleBtn = document.getElementById('adminToggleBtn');
    const adminRoleBadge = document.getElementById('adminRoleBadge');
    const adminBannerDesc = document.getElementById('adminBannerDesc');
    const btnManageAdmins = document.getElementById('btnManageAdmins');
    const btnClearAll = document.getElementById('btnClearAllRecords');
    const headerActiveCount = document.getElementById('headerActiveAdminsCount');
    const manageModal = document.getElementById('adminManageModal');

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
        if (headerActiveCount) headerActiveCount.style.display = 'inline-flex';
        if (adminBannerDesc) {
          adminBannerDesc.textContent = 'Master Mind Authority (Kausar Hayat): Manage admins, credentials, and full record access.';
        }
        if (btnManageAdmins) btnManageAdmins.style.display = 'inline-flex';
        if (btnClearAll) btnClearAll.style.display = 'inline-flex';
        if (manageModal) manageModal.classList.add('verified');
      } else {
        if (adminBtnText) adminBtnText.textContent = '🛡️ Sub-Admin';
        if (adminRoleBadge) {
          adminRoleBadge.className = 'admin-role-tag role-subadmin';
          adminRoleBadge.innerHTML = `<i class="fa-solid fa-shield"></i> Sub-Admin (${escapeHtml(STATE.adminName)})`;
        }
        if (headerActiveCount) headerActiveCount.style.display = 'none';
        if (adminBannerDesc) {
          adminBannerDesc.textContent = 'Authorized Sub-Admin: Authorized to add late entries and update payment status.';
        }
        if (btnManageAdmins) btnManageAdmins.style.display = 'none';
        if (btnClearAll) btnClearAll.style.display = 'none';
        if (manageModal) manageModal.classList.remove('verified');
      }
    } else {
      if (adminBanner) adminBanner.style.display = 'none';
      if (adminEntryCard) adminEntryCard.style.display = 'none';
      if (headerActiveCount) headerActiveCount.style.display = 'none';
      if (btnManageAdmins) btnManageAdmins.style.display = 'none';
      if (btnClearAll) btnClearAll.style.display = 'none';
      if (adminBtnText) adminBtnText.textContent = 'Admin Login';
      if (adminToggleBtn) adminToggleBtn.classList.remove('logged-in');
      if (manageModal) manageModal.classList.remove('verified');
    }

    renderAll();
  }

  /* ==================== MASTER REALTIME LISTENERS ==================== */
  let unsubPendingRequests = null;
  let unsubActiveAdmins = null;
  let unsubAuditLogs = null;

  function attachMasterListeners() {
    detachMasterListeners();

    // 1. Pending Requests Listener
    unsubPendingRequests = mainDb.collection('admin_requests')
      .where('status', '==', 'pending')
      .onSnapshot((snapshot) => {
        const list = [];
        snapshot.forEach(doc => {
          list.push({ ...doc.data(), uid: doc.id });
        });
        STATE.pendingRequests = list;
        renderPendingRequests();
      }, (err) => {
        console.warn('Pending requests listener notice:', err.message);
      });

    // 2. Active Admins Listener
    unsubActiveAdmins = mainDb.collection('admins')
      .onSnapshot((snapshot) => {
        const list = [];
        snapshot.forEach(doc => {
          list.push({ ...doc.data(), uid: doc.id });
        });
        STATE.activeAdmins = list;
        renderActiveAdmins();
      }, (err) => {
        console.warn('Active admins listener notice:', err.message);
      });

    // 3. Activity and Audit Logs Listener
    unsubAuditLogs = mainDb.collection('admin_audit_logs')
      .orderBy('timestamp', 'desc')
      .limit(150)
      .onSnapshot((snapshot) => {
        const list = [];
        snapshot.forEach(doc => {
          list.push({ ...doc.data(), id: doc.id });
        });
        STATE.auditLogs = list;
        renderAuditLogsList();
      }, (err) => {
        console.warn('Audit logs listener notice:', err.message);
      });
  }

  function detachMasterListeners() {
    if (unsubPendingRequests) { unsubPendingRequests(); unsubPendingRequests = null; }
    if (unsubActiveAdmins) { unsubActiveAdmins(); unsubActiveAdmins = null; }
    if (unsubAuditLogs) { unsubAuditLogs(); unsubAuditLogs = null; }
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
      if (query && !String(student.name || '').toLowerCase().includes(query)) {
        return false;
      }
      if (dateFilter === 'today' && !isSameDay(student.date, todayStr)) {
        return false;
      }
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

      const initials = (student.name || 'ST')
        .split(' ')
        .map(part => part[0])
        .filter(Boolean)
        .join('')
        .substring(0, 2)
        .toUpperCase();

      const timeStr = String(student.time || '');
      const isOverTen = timeStr.includes('8:10+') || timeStr.includes('10+');
      const timeBadgeClass = isOverTen ? 'badge-time badge-time-late' : 'badge-time';

      let statusHtml = '';
      if (STATE.isAdmin) {
        statusHtml = `
          <button class="btn-toggle-payment ${student.paid ? 'is-paid' : 'is-unpaid'}"
                  data-action="toggle-paid"
                  data-id="${escapeHtml(student.id)}"
                  title="Click to toggle payment status">
            <i class="fa-solid ${student.paid ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
            <span>${student.paid ? 'Paid (Rs. ' + escapeHtml(student.fine) + ')' : 'Pending'}</span>
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

      const adminActionsHtml = STATE.isAdmin ? `
        <td class="admin-col">
          <div class="table-actions">
            <button class="btn-icon" data-action="edit" data-id="${escapeHtml(student.id)}" title="Edit Entry">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-icon btn-icon-delete" data-action="delete" data-id="${escapeHtml(student.id)}" title="Delete Entry">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      ` : '';

      tr.innerHTML = `
        <td style="color: var(--text-muted); font-weight: 600;">${index + 1}</td>
        <td>
          <div class="student-name-cell">
            <div class="student-avatar">${escapeHtml(initials || 'ST')}</div>
            <span>${escapeHtml(student.name)}</span>
          </div>
        </td>
        <td style="color: var(--text-secondary); white-space: nowrap;">${escapeHtml(formatDateDisplay(student.date))}</td>
        <td>
          <span class="${timeBadgeClass}">
            <i class="fa-regular fa-clock"></i> ${escapeHtml(student.time)}
          </span>
        </td>
        <td style="font-weight: 700; color: #f1f5f9;">Rs. ${escapeHtml(student.fine)}</td>
        <td>${statusHtml}</td>
        ${adminActionsHtml}
      `;

      tbody.appendChild(tr);
    });
  }

  /* ==================== STUDENT CRUD OPERATIONS ==================== */
  async function handleNewEntry(e) {
    if (e) e.preventDefault();
    if (!STATE.isAdmin) {
      showToast('Unauthorized: Only signed-in Admins can add records.', 'error');
      return;
    }

    const nameInput = document.getElementById('studentName');
    const dateInput = document.getElementById('entryDate');
    const timeInput = document.getElementById('arrivalTime');
    const fineInput = document.getElementById('fineAmount');
    const paidCheckbox = document.getElementById('initialPaid');

    const name = (nameInput?.value || '').trim();
    const date = (dateInput?.value || '').trim();
    const time = (timeInput?.value || '').trim();
    const fine = Number(fineInput?.value) || 100;
    const paid = Boolean(paidCheckbox?.checked);

    if (!name || name.length > 60) {
      showToast('Student name must be between 1 and 60 characters.', 'error');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      showToast('Valid date format (YYYY-MM-DD) is required.', 'error');
      return;
    }
    if (!time || time.length > 20) {
      showToast('Arrival time is required (max 20 characters).', 'error');
      return;
    }
    if (fine < 0 || fine > 1000) {
      showToast('Fine amount must be between Rs. 0 and Rs. 1,000.', 'error');
      return;
    }

    const newStudent = {
      id: 'st_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: name,
      fine: fine,
      date: date,
      time: time,
      paid: paid,
      createdAt: Date.now()
    };

    try {
      await mainDb.collection('students').doc(newStudent.id).set(newStudent);
      nameInput.value = '';
      paidCheckbox.checked = false;
      nameInput.focus();
      showToast(`Added ${name} to late records`, 'success');
      await logAdminAction('ADD_STUDENT', `Added late record for "${name}" (Fine: Rs. ${fine}, Time: ${time})`);
    } catch (err) {
      console.error('Failed to create student:', err);
      showToast('Server rejected record: ' + (err.message || 'Permission denied'), 'error');
    }
  }

  async function togglePayment(studentId) {
    if (!STATE.isAdmin) {
      showToast('Unauthorized: Only signed-in Admins can update payment.', 'error');
      return;
    }

    const student = STATE.students.find(s => s.id === studentId);
    if (!student) return;

    const updated = {
      id: student.id,
      name: student.name,
      fine: Number(student.fine) || 100,
      date: student.date,
      time: student.time,
      paid: !student.paid,
      createdAt: student.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    try {
      await mainDb.collection('students').doc(student.id).set(updated);
      const msg = updated.paid
        ? `Marked ${student.name} as Paid (Rs. ${updated.fine})`
        : `Marked ${student.name} as Pending`;
      showToast(msg, 'success');
      await logAdminAction('UPDATE_PAYMENT', `Marked ${student.name} as ${updated.paid ? 'PAID' : 'PENDING'}`);
    } catch (err) {
      console.error('Failed to toggle payment:', err);
      showToast('Server rejected payment update: ' + (err.message || 'Permission denied'), 'error');
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
    document.getElementById('editPaidStatus').checked = Boolean(student.paid);

    const modal = document.getElementById('editEntryModal');
    if (modal) modal.style.display = 'flex';
  }

  function closeEditModal() {
    const modal = document.getElementById('editEntryModal');
    if (modal) modal.style.display = 'none';
  }

  async function saveEditedEntry() {
    if (!STATE.isAdmin) return;
    const id = document.getElementById('editEntryId').value;
    const name = document.getElementById('editStudentName').value.trim();
    const date = document.getElementById('editEntryDate').value.trim();
    const time = document.getElementById('editArrivalTime').value.trim();
    const fine = Number(document.getElementById('editFineAmount').value) || 100;
    const paid = Boolean(document.getElementById('editPaidStatus').checked);

    if (!name || name.length > 60) {
      showToast('Student name must be between 1 and 60 characters.', 'error');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      showToast('Valid date format (YYYY-MM-DD) is required.', 'error');
      return;
    }
    if (!time || time.length > 20) {
      showToast('Arrival time is required (max 20 characters).', 'error');
      return;
    }
    if (fine < 0 || fine > 1000) {
      showToast('Fine amount must be between Rs. 0 and Rs. 1,000.', 'error');
      return;
    }

    const existing = STATE.students.find(s => s.id === id);
    const updated = {
      id: id,
      name: name,
      fine: fine,
      date: date,
      time: time,
      paid: paid,
      createdAt: existing?.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    try {
      await mainDb.collection('students').doc(id).set(updated);
      closeEditModal();
      showToast(`Updated record for ${name}`, 'success');
      await logAdminAction('EDIT_STUDENT', `Updated entry for "${name}" (Fine: Rs. ${fine}, Time: ${time})`);
    } catch (err) {
      console.error('Failed to save edited entry:', err);
      showToast('Server rejected edit: ' + (err.message || 'Permission denied'), 'error');
    }
  }

  async function deleteEntry(studentId) {
    if (!STATE.isAdmin) return;
    const student = STATE.students.find(s => s.id === studentId);
    if (!student) return;

    if (!confirm(`Are you sure you want to delete the record for ${student.name}?`)) return;

    try {
      await mainDb.collection('students').doc(studentId).delete();
      showToast(`${student.name} record deleted`, 'info');
      await logAdminAction('DELETE_STUDENT', `Deleted record for student "${student.name}" (Fine: Rs. ${student.fine})`);
    } catch (err) {
      console.error('Failed to delete student:', err);
      showToast('Server rejected deletion: ' + (err.message || 'Permission denied'), 'error');
    }
  }

  async function clearAllRecords() {
    if (!STATE.isMasterAdmin) {
      showToast('Unauthorized: Only Master Admin can clear all records.', 'error');
      return;
    }

    if (!confirm('Are you sure you want to clear all late records? This cannot be undone.')) return;

    try {
      let totalDeleted = 0;
      showToast('Clearing records in progress...', 'info', 2000);

      while (true) {
        // Query up to 400 documents per batch
        const snapshot = await mainDb.collection('students').limit(400).get();
        if (snapshot.empty) {
          break;
        }

        const batch = mainDb.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        totalDeleted += snapshot.docs.length;
        showToast(`Deleting records: ${totalDeleted} deleted so far...`, 'info', 1500);
      }

      showToast(`All records cleared successfully (${totalDeleted} total deleted)`, 'success');
      await logAdminAction('DELETE_STUDENT', `Master Mind cleared all late student records (${totalDeleted} entries removed)`);
    } catch (err) {
      console.error('Failed to clear records:', err);
      showToast('Server rejected clear all: ' + (err.message || 'Permission denied'), 'error');
    }
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

  /* ==================== TIME PRESETS ==================== */
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
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      timeInput.value = `${hours}:${minutes} ${ampm}`;
    }
  }

  /* ==================== MODAL CONTROLS ==================== */
  function toggleAdminModal() {
    const modal = document.getElementById('adminModal');
    if (!modal) return;

    if (STATE.isAdmin) {
      // If already logged in, show status info or open Master Page if master
      if (STATE.isMasterAdmin) {
        openAdminManagementModal();
      } else {
        showToast(`Logged in as Sub-Admin (${STATE.adminName})`, 'info');
      }
      return;
    }

    modal.style.display = 'flex';
    switchLoginTab('pin');
  }

  function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.style.display = 'none';
    cleanupWaiting();
  }

  function switchLoginTab(tab) {
    const viewPin = document.getElementById('loginViewPin');
    const viewWait = document.getElementById('pinStepWaiting');
    const viewDenied = document.getElementById('pinStepDenied');
    const viewMaster = document.getElementById('loginViewMaster');

    if (viewPin) viewPin.style.display = (tab === 'pin') ? 'block' : 'none';
    if (viewWait) viewWait.style.display = (tab === 'wait') ? 'block' : 'none';
    if (viewDenied) viewDenied.style.display = (tab === 'denied') ? 'block' : 'none';
    if (viewMaster) viewMaster.style.display = (tab === 'master') ? 'block' : 'none';

    // Clear error messages
    const loginErr = document.getElementById('loginErrorMsg');
    if (loginErr) loginErr.style.display = 'none';
    const masterErr = document.getElementById('masterLoginErrorMsg');
    if (masterErr) masterErr.style.display = 'none';

    if (tab === 'master') {
      const passInp = document.getElementById('masterPasscodeInput');
      if (passInp) {
        passInp.value = '';
        setTimeout(() => passInp.focus(), 100);
      }
    } else if (tab === 'pin') {
      const nameInp = document.getElementById('adminLoginNameInput');
      if (nameInp) setTimeout(() => nameInp.focus(), 100);
    }
  }

  function cleanupWaiting() {
    isWaitingForApproval = false;
    if (waitingCountdownInterval) {
      clearInterval(waitingCountdownInterval);
      waitingCountdownInterval = null;
    }
    if (waitingAdminUnsubscribe) {
      waitingAdminUnsubscribe();
      waitingAdminUnsubscribe = null;
    }
    if (waitingRequestUnsubscribe) {
      waitingRequestUnsubscribe();
      waitingRequestUnsubscribe = null;
    }
  }

  function retryAdminLogin() {
    cleanupWaiting();
    switchLoginTab('pin');
  }

  /* ==================== SUB-ADMIN LOGIN WORKFLOW ==================== */
  async function handleAdminLogin() {
    const nameInput = document.getElementById('adminLoginNameInput');
    const keyInput = document.getElementById('adminPrivateKeyInput');
    const errorMsg = document.getElementById('loginErrorMsg');

    const name = (nameInput?.value || '').trim();
    const key = (keyInput?.value || '').trim();

    if (errorMsg) errorMsg.style.display = 'none';

    if (!name) {
      if (errorMsg) {
        errorMsg.textContent = 'Please enter your Full Name.';
        errorMsg.style.display = 'block';
      }
      return;
    }
    if (name.length > 60) {
      if (errorMsg) {
        errorMsg.textContent = 'Name must be 60 characters or less.';
        errorMsg.style.display = 'block';
      }
      return;
    }

    // SCENARIO A: Sub-admin has entered an optional 6-digit Private Key
    if (key) {
      if (!/^\d{6}$/.test(key)) {
        if (errorMsg) {
          errorMsg.textContent = 'Private Key must be exactly 6 digits.';
          errorMsg.style.display = 'block';
        }
        return;
      }

      const email = `${slugify(name)}@fine-collector.app`;

      try {
        const userCred = await mainAuth.signInWithEmailAndPassword(email, key);
        const uid = userCred.user.uid;

        // Check if admin document exists in Firestore
        const adminDoc = await mainDb.collection('admins').doc(uid).get();
        if (!adminDoc.exists) {
          await mainAuth.signOut();
          if (errorMsg) {
            errorMsg.textContent = 'Access Denied: Account is not in the approved admin registry.';
            errorMsg.style.display = 'block';
          }
          return;
        }

        const adminData = adminDoc.data() || {};
        STATE.isAdmin = true;
        STATE.adminRole = adminData.role || 'subadmin';
        STATE.adminName = adminData.name || name;
        STATE.adminUid = uid;
        STATE.isMasterAdmin = (STATE.adminRole === 'master');

        updateUIForAdminState();
        closeAdminModal();
        showToast(`Welcome Sub-Admin (${STATE.adminName})`, 'success');
        await logAdminAction('LOGIN', `Sub-admin "${STATE.adminName}" logged in via 6-digit Private Key`);
      } catch (err) {
        console.warn('Private key sign-in error:', err.message);
        if (errorMsg) {
          errorMsg.textContent = 'Invalid Name or 6-digit Private Key.';
          errorMsg.style.display = 'block';
        }
      }
      return;
    }

    // SCENARIO B: Sub-admin has NO key -> Sign in anonymously & submit request to Master Mind
    try {
      const userCred = await mainAuth.signInAnonymously();
      const uid = userCred.user.uid;
      const deviceDesc = getDeviceDescription();

      const requestPayload = {
        uid: uid,
        name: name,
        device: deviceDesc,
        requestedAt: new Date().toISOString(),
        status: 'pending'
      };

      await mainDb.collection('admin_requests').doc(uid).set(requestPayload);

      isWaitingForApproval = true;
      switchLoginTab('wait');

      const requesterNameElem = document.getElementById('waitRequesterName');
      const deviceElem = document.getElementById('waitDeviceName');
      if (requesterNameElem) requesterNameElem.textContent = name;
      if (deviceElem) deviceElem.textContent = deviceDesc;

      // Start 5-minute countdown (300 seconds)
      let secondsLeft = 300;
      const timerElem = document.getElementById('waitCountdownTimer');

      function updateTimerDisplay() {
        const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
        const secs = String(secondsLeft % 60).padStart(2, '0');
        if (timerElem) timerElem.textContent = `${mins}:${secs}`;
      }
      updateTimerDisplay();

      if (waitingCountdownInterval) clearInterval(waitingCountdownInterval);
      waitingCountdownInterval = setInterval(() => {
        secondsLeft--;
        if (secondsLeft <= 0) {
          cleanupWaiting();
          const denialHeading = document.getElementById('denialHeading');
          const denialMessage = document.getElementById('denialMessage');
          if (denialHeading) denialHeading.textContent = 'Request Timed Out';
          if (denialMessage) denialMessage.textContent = 'Master Mind did not respond within 5 minutes. Please try again.';
          switchLoginTab('denied');
          mainAuth.signOut().catch(() => {});
        } else {
          updateTimerDisplay();
        }
      }, 1000);

      // Listen to admins/{uid} in real time: when it appears, unlock instantly!
      waitingAdminUnsubscribe = mainDb.collection('admins').doc(uid).onSnapshot((docSnap) => {
        if (docSnap.exists) {
          const adminData = docSnap.data() || {};
          cleanupWaiting();

          STATE.isAdmin = true;
          STATE.adminRole = adminData.role || 'subadmin';
          STATE.adminName = adminData.name || name;
          STATE.adminUid = uid;
          STATE.isMasterAdmin = (STATE.adminRole === 'master');

          updateUIForAdminState();
          closeAdminModal();
          showToast(`Access Granted! Welcome Sub-Admin (${STATE.adminName})`, 'success');
          logAdminAction('LOGIN', `Sub-admin "${STATE.adminName}" unlocked via Master Mind approval`);
        }
      }, (err) => {
        console.warn('Waiting admin listener notice:', err.message);
      });

      // Listen to admin_requests/{uid}: if deleted or rejected, check whether admins/{uid} exists first
      waitingRequestUnsubscribe = mainDb.collection('admin_requests').doc(uid).onSnapshot(async (docSnap) => {
        if (!docSnap.exists || docSnap.data()?.status === 'rejected') {
          // APPROVAL RACE: First check whether admins/{uid} exists!
          try {
            const adminDoc = await mainDb.collection('admins').doc(uid).get();
            if (adminDoc.exists) {
              const adminData = adminDoc.data() || {};
              cleanupWaiting();

              STATE.isAdmin = true;
              STATE.adminRole = adminData.role || 'subadmin';
              STATE.adminName = adminData.name || name;
              STATE.adminUid = uid;
              STATE.isMasterAdmin = (STATE.adminRole === 'master');

              updateUIForAdminState();
              closeAdminModal();
              showToast(`Access Granted! Welcome Sub-Admin (${STATE.adminName})`, 'success');
              logAdminAction('LOGIN', `Sub-admin "${STATE.adminName}" unlocked via Master Mind approval`);
              return;
            }
          } catch (e) {
            console.warn('Approval race condition check error:', e.message);
          }

          // Only show the Denied screen when admins/{uid} does not exist
          cleanupWaiting();
          const denialHeading = document.getElementById('denialHeading');
          const denialMessage = document.getElementById('denialMessage');
          if (denialHeading) denialHeading.textContent = 'Access Denied';
          if (denialMessage) denialMessage.textContent = 'Your access request was declined by Master Mind (Kausar Hayat).';
          switchLoginTab('denied');
          mainAuth.signOut().catch(() => {});
        }
      }, (err) => {
        console.warn('Waiting request listener notice:', err.message);
      });

    } catch (err) {
      console.error('Permission request failed:', err);
      if (errorMsg) {
        errorMsg.textContent = 'Failed to submit request: ' + (err.message || 'Network error');
        errorMsg.style.display = 'block';
      }
    }
  }

  /* ==================== MASTER MIND LOGIN WORKFLOW ==================== */
  async function handleMasterOwnerLogin() {
    const passInput = document.getElementById('masterPasscodeInput');
    const errorMsg = document.getElementById('masterLoginErrorMsg');
    const lockoutElem = document.getElementById('masterLockoutCountdown');

    if (errorMsg) errorMsg.style.display = 'none';

    // Client-side lockout enforcement (3 attempts = 5 min cooldown)
    if (failedMasterAttempts >= 3 && Date.now() < masterLockedUntil) {
      const remainingSecs = Math.ceil((masterLockedUntil - Date.now()) / 1000);
      if (lockoutElem) {
        lockoutElem.textContent = `Too many failed attempts. Locked for ${remainingSecs}s.`;
        lockoutElem.style.display = 'block';
      }
      return;
    }

    const passcode = (passInput?.value || '').trim();

    if (!passcode || passcode.length < 8) {
      if (errorMsg) {
        errorMsg.textContent = 'Passcode must be at least 8 characters.';
        errorMsg.style.display = 'block';
      }
      return;
    }

    try {
      const cred = await mainAuth.signInWithEmailAndPassword('master@fine-collector.app', passcode);
      const uid = cred.user.uid;

      // Verify master document in Firestore
      const adminDoc = await mainDb.collection('admins').doc(uid).get();
      if (!adminDoc.exists || adminDoc.data()?.role !== 'master') {
        await mainAuth.signOut();
        throw new Error('User is not authorized as Master Mind in Firestore.');
      }

      // Reset failed attempts upon successful login
      failedMasterAttempts = 0;
      masterLockedUntil = 0;
      if (lockoutElem) lockoutElem.style.display = 'none';

      const data = adminDoc.data() || {};
      STATE.isAdmin = true;
      STATE.isMasterAdmin = true;
      STATE.adminRole = 'master';
      STATE.adminName = data.name || 'Kausar Hayat';
      STATE.adminUid = uid;

      updateUIForAdminState();
      attachMasterListeners();
      closeAdminModal();
      showToast('Welcome Master Mind (Kausar Hayat)', 'success');
      await logAdminAction('LOGIN', 'Master Mind authenticated successfully');
    } catch (err) {
      console.warn('Master login failure:', err.message);
      failedMasterAttempts++;
      if (failedMasterAttempts >= 3) {
        masterLockedUntil = Date.now() + 5 * 60 * 1000; // 5 minutes
      }

      if (errorMsg) {
        errorMsg.textContent = 'Incorrect Master Passcode. Please try again.';
        errorMsg.style.display = 'block';
      }
    }
  }

  /* ==================== LOGOUT FUNCTIONALITY ==================== */
  async function handleLogout(reason = 'manual') {
    if (STATE.isAdmin && mainAuth.currentUser) {
      try {
        const details = reason === 'inactivity'
          ? 'Auto-logged out due to 10 minutes of inactivity'
          : `Admin "${STATE.adminName}" logged out manually`;
        await logAdminAction('LOGOUT', details);
      } catch (_) {}

      try {
        await mainAuth.signOut();
      } catch (_) {}
    }

    resetAdminState();
    updateUIForAdminState();
    closeAdminManagementModal();
    closeAdminModal();

    if (reason === 'inactivity') {
      showToast('Logged out due to 10 minutes of inactivity', 'info');
    } else {
      showToast('Logged out successfully', 'info');
    }
  }

  /* ==================== MASTER MIND PAGE (MANAGE ADMINS) ==================== */
  function openAdminManagementModal() {
    if (!STATE.isMasterAdmin) {
      showToast('Access Denied: Master Mind verification required.', 'error');
      return;
    }
    const modal = document.getElementById('adminManageModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.add('verified');
      switchManageTab('pending');
    }
  }

  function closeAdminManagementModal() {
    const modal = document.getElementById('adminManageModal');
    if (modal) modal.style.display = 'none';
  }

  function switchManageTab(tab) {
    const tabs = ['pending', 'approved', 'keys', 'audit'];
    tabs.forEach(t => {
      const btn = document.getElementById(`tabManage${t.charAt(0).toUpperCase() + t.slice(1)}Btn`);
      const view = document.getElementById(`manageView${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (btn) {
        if (t === tab) btn.classList.add('active');
        else btn.classList.remove('active');
      }
      if (view) {
        view.style.display = (t === tab) ? 'block' : 'none';
      }
    });

    if (tab === 'pending') renderPendingRequests();
    else if (tab === 'approved') renderActiveAdmins();
    else if (tab === 'keys') renderKeysView();
    else if (tab === 'audit') renderAuditLogsList();
  }

  /* Tab 1: Render Pending Requests */
  function renderPendingRequests() {
    const container = document.getElementById('pendingRequestsList');
    const emptyBox = document.getElementById('emptyPendingRequests');
    const badgeCount = document.getElementById('manageTabPendingBadge');
    const headerPendingBadge = document.getElementById('manageAdminsPendingBadge');

    const requests = STATE.pendingRequests || [];
    if (badgeCount) badgeCount.textContent = requests.length;
    if (headerPendingBadge) {
      headerPendingBadge.textContent = requests.length;
      headerPendingBadge.style.display = requests.length > 0 ? 'inline-block' : 'none';
    }

    if (!container) return;
    container.innerHTML = '';

    if (requests.length === 0) {
      if (emptyBox) emptyBox.style.display = 'block';
      return;
    }
    if (emptyBox) emptyBox.style.display = 'none';

    requests.forEach(req => {
      const card = document.createElement('div');
      card.className = 'device-card';
      card.innerHTML = `
        <div class="device-card-header">
          <div>
            <h4 style="color: var(--text-primary); font-size: 0.98rem; font-weight: 700; margin-bottom: 0.2rem;">
              <i class="fa-solid fa-user-shield" style="color: #38bdf8;"></i> ${escapeHtml(req.name)}
            </h4>
            <div style="font-size: 0.8rem; color: #94a3b8;">
              <i class="fa-solid fa-laptop"></i> ${escapeHtml(req.device || 'Unknown Device')}
            </div>
            <div style="font-size: 0.74rem; color: #64748b; margin-top: 0.2rem;">
              Requested: ${escapeHtml(req.requestedAt ? new Date(req.requestedAt).toLocaleTimeString() : 'Recently')}
            </div>
          </div>
          <span class="badge-waiting"><i class="fa-solid fa-circle-notch fa-spin"></i> Pending</span>
        </div>
        <div class="modal-actions-row" style="margin-top: 0.85rem; gap: 0.5rem; justify-content: flex-end;">
          <button class="btn btn-secondary btn-sm" data-action="reject-request" data-uid="${escapeHtml(req.uid)}" data-name="${escapeHtml(req.name)}">
            <i class="fa-solid fa-xmark"></i> Reject
          </button>
          <button class="btn btn-primary btn-sm" data-action="allow-access" data-uid="${escapeHtml(req.uid)}" data-name="${escapeHtml(req.name)}">
            <i class="fa-solid fa-check"></i> Allow Access
          </button>
          <button class="btn-card-key" data-action="assign-key-pending" data-uid="${escapeHtml(req.uid)}" data-name="${escapeHtml(req.name)}">
            <i class="fa-solid fa-key"></i> Assign Key
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  /* Allow Access: master writes admins/{requestUid} {role:'subadmin', name} */
  async function allowAccessForRequest(uid, name) {
    if (!STATE.isMasterAdmin) return;
    try {
      await mainDb.collection('admins').doc(uid).set({
        role: 'subadmin',
        name: name,
        createdAt: new Date().toISOString()
      });
      await mainDb.collection('admin_requests').doc(uid).delete();
      showToast(`Access granted to ${name}`, 'success');
      await logAdminAction('ALLOW_ACCESS', `Master Mind granted access to sub-admin "${name}"`);
    } catch (err) {
      console.error('Failed to allow access:', err);
      showToast('Failed to grant access: ' + err.message, 'error');
    }
  }

  /* Reject: delete admin_requests/{uid} */
  async function rejectRequest(uid, name) {
    if (!STATE.isMasterAdmin) return;
    try {
      await mainDb.collection('admin_requests').doc(uid).delete();
      showToast(`Rejected request from ${name}`, 'info');
      await logAdminAction('REJECT_REQUEST', `Master Mind rejected access request from "${name}"`);
    } catch (err) {
      console.error('Failed to reject request:', err);
      showToast('Failed to reject: ' + err.message, 'error');
    }
  }

  /* Tab 2: Render Active Admins */
  function renderActiveAdmins() {
    const container = document.getElementById('approvedAdminsList');
    const emptyBox = document.getElementById('emptyApprovedAdmins');
    const badgeCount = document.getElementById('manageTabApprovedBadge');
    const headerCount = document.getElementById('headerActiveAdminsCountNum');

    const subadmins = (STATE.activeAdmins || []).filter(a => a.role === 'subadmin');
    if (badgeCount) badgeCount.textContent = subadmins.length;
    if (headerCount) headerCount.textContent = subadmins.length;

    if (!container) return;
    container.innerHTML = '';

    if (subadmins.length === 0) {
      if (emptyBox) emptyBox.style.display = 'block';
      return;
    }
    if (emptyBox) emptyBox.style.display = 'none';

    subadmins.forEach(admin => {
      const card = document.createElement('div');
      card.className = 'device-card';
      card.innerHTML = `
        <div class="device-card-header">
          <div>
            <h4 style="color: var(--text-primary); font-size: 0.98rem; font-weight: 700; margin-bottom: 0.2rem;">
              <i class="fa-solid fa-user-shield" style="color: #34d399;"></i> ${escapeHtml(admin.name)}
            </h4>
            <div style="font-size: 0.78rem; color: #94a3b8;">
              Role: <span style="color: #38bdf8; font-weight: 600;">Sub-Admin</span> &bull; UID: <code>${escapeHtml(admin.uid.substring(0, 10))}...</code>
            </div>
            <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.2rem;">
              Active since: ${escapeHtml(admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : 'Active')}
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" style="color: #fb7185; border-color: rgba(244,63,94,0.4);" data-action="delete-admin" data-uid="${escapeHtml(admin.uid)}" data-name="${escapeHtml(admin.name)}">
            <i class="fa-solid fa-trash-can"></i> Delete Admin
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  /* Delete Admin: delete admins/{uid} */
  async function deleteAdmin(uid, name) {
    if (!STATE.isMasterAdmin) return;
    if (!confirm(`Are you sure you want to delete admin "${name}"? Access will be immediately revoked by the server.`)) {
      return;
    }

    try {
      await mainDb.collection('admins').doc(uid).delete();
      showToast(`Admin ${name} access revoked`, 'info');
      await logAdminAction('DELETE_ADMIN', `Master Mind deleted admin "${name}" (UID: ${uid})`);
    } catch (err) {
      console.error('Failed to delete admin:', err);
      showToast('Failed to delete admin: ' + err.message, 'error');
    }
  }

  /* Tab 3: Render Keys View & Key Assignment */
  function renderKeysView() {
    const container = document.getElementById('activeKeyHoldersList');
    const emptyBox = document.getElementById('emptyAdminPrivateKeys');
    const countLabel = document.getElementById('keysCountLabel');
    const badgeCount = document.getElementById('manageTabKeysBadge');

    const subadmins = (STATE.activeAdmins || []).filter(a => a.role === 'subadmin');
    if (badgeCount) badgeCount.textContent = subadmins.length;
    if (countLabel) countLabel.textContent = `${subadmins.length} Admin${subadmins.length === 1 ? '' : 's'} Registered`;

    if (!container) return;
    container.innerHTML = '';

    if (subadmins.length === 0) {
      if (emptyBox) emptyBox.style.display = 'block';
      return;
    }
    if (emptyBox) emptyBox.style.display = 'none';

    subadmins.forEach(admin => {
      const card = document.createElement('div');
      card.className = 'device-card';
      card.innerHTML = `
        <div class="device-card-header">
          <div>
            <h4 style="color: var(--text-primary); font-size: 0.95rem; font-weight: 700; margin-bottom: 0.2rem;">
              <i class="fa-solid fa-key" style="color: #818cf8;"></i> ${escapeHtml(admin.name)}
            </h4>
            <div style="font-size: 0.78rem; color: #94a3b8;">
              Status: <span style="color: #34d399; font-weight: 600;">Active Credential</span> &bull; Key stored only in Firebase Auth
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" data-action="reassign-key" data-name="${escapeHtml(admin.name)}" title="Assign New Key">
            <i class="fa-solid fa-rotate"></i> Assign New Key
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  /* Assign Key via Secondary Firebase App Instance */
  async function assignKeyForAdmin(fullName, sixDigitKey) {
    if (!STATE.isMasterAdmin) throw new Error('Unauthorized');

    const cleanName = fullName.trim();
    if (!cleanName || cleanName.length > 60) {
      throw new Error('Please enter a valid admin name (1-60 characters).');
    }
    if (!/^\d{6}$/.test(sixDigitKey)) {
      throw new Error('Key must be exactly 6 digits.');
    }

    const email = `${slugify(cleanName)}@fine-collector.app`;
    const secAuth = getSecondaryAuth();

    let newUid;
    try {
      const userCred = await secAuth.createUserWithEmailAndPassword(email, sixDigitKey);
      newUid = userCred.user.uid;
    } catch (err) {
      // If user exists in Auth, try to sign in with secondary app to update password or reuse
      if (err.code === 'auth/email-already-in-use') {
        throw new Error(`An account for "${cleanName}" already exists. Delete the admin first or choose a different name.`);
      }
      throw err;
    }

    // Immediately sign out secondary auth so master session stays pristine
    await secAuth.signOut().catch(() => {});

    // Write admins/{newUid} {role:'subadmin', name} using Master's connection
    await mainDb.collection('admins').doc(newUid).set({
      role: 'subadmin',
      name: cleanName,
      createdAt: new Date().toISOString()
    });

    await logAdminAction('ASSIGN_KEY', `Created 6-digit Private Key for sub-admin "${cleanName}"`);

    return { name: cleanName, key: sixDigitKey, uid: newUid };
  }

  /* Handler for New Key Form Submission */
  async function handleCreateNewKeyForm() {
    const nameInput = document.getElementById('newAdminKeyName');
    const keyInput = document.getElementById('newAdminKeyValue');

    const name = (nameInput?.value || '').trim();
    const key = (keyInput?.value || '').trim();

    if (!name) {
      showToast('Please enter the Admin Full Name.', 'error');
      return;
    }
    if (!key || !/^\d{6}$/.test(key)) {
      showToast('Please enter or generate a 6-digit key.', 'error');
      return;
    }

    try {
      const result = await assignKeyForAdmin(name, key);

      // Display the one-time key box
      const oneTimeBox = document.getElementById('oneTimeKeyBox');
      const nameElem = document.getElementById('oneTimeKeyAdminName');
      const digitsElem = document.getElementById('oneTimeKeyDigits');

      if (nameElem) nameElem.textContent = result.name;
      if (digitsElem) digitsElem.textContent = result.key;
      if (oneTimeBox) oneTimeBox.style.display = 'block';

      nameInput.value = '';
      keyInput.value = '';

      showToast(`Key assigned to ${result.name}! Copy and send it now.`, 'success');
      renderKeysView();
    } catch (err) {
      console.error('Assign key error:', err);
      showToast(err.message || 'Failed to assign key', 'error');
    }
  }

  /* Tab 4: Render Activity and Audit Logs */
  function renderAuditLogsList() {
    const container = document.getElementById('adminAuditLogsList');
    const emptyBox = document.getElementById('emptyAdminAuditLogs');
    const statTotal = document.getElementById('auditStatTotalCount');
    const statCrud = document.getElementById('auditStatCrudCount');
    const statLatest = document.getElementById('auditStatLastActive');
    const filterAdmin = document.getElementById('auditFilterAdmin');
    const filterAction = document.getElementById('auditFilterAction');
    const badgeCount = document.getElementById('manageTabAuditBadge');

    const logs = STATE.auditLogs || [];
    if (badgeCount) badgeCount.textContent = logs.length;
    if (statTotal) statTotal.textContent = logs.length;

    // Populate admin filter dropdown
    if (filterAdmin) {
      const currentSelected = filterAdmin.value;
      const adminNames = Array.from(new Set(logs.map(l => l.adminName).filter(Boolean)));
      filterAdmin.innerHTML = '<option value="all">All Admins</option>';
      adminNames.forEach(aName => {
        const opt = document.createElement('option');
        opt.value = aName;
        opt.textContent = aName;
        if (opt.value === currentSelected) opt.selected = true;
        filterAdmin.appendChild(opt);
      });
    }

    // Calculate CRUD changes count
    const crudActions = ['ADD_STUDENT', 'UPDATE_PAYMENT', 'EDIT_STUDENT', 'DELETE_STUDENT'];
    const crudCount = logs.filter(l => crudActions.includes(l.actionType)).length;
    if (statCrud) statCrud.textContent = crudCount;

    if (logs.length > 0 && statLatest) {
      statLatest.textContent = new Date(logs[0].timestamp).toLocaleTimeString();
    } else if (statLatest) {
      statLatest.textContent = 'None';
    }

    if (!container) return;
    container.innerHTML = '';

    const selectedAdmin = filterAdmin ? filterAdmin.value : 'all';
    const selectedAction = filterAction ? filterAction.value : 'all';

    const filtered = logs.filter(log => {
      if (selectedAdmin !== 'all' && log.adminName !== selectedAdmin) return false;
      if (selectedAction !== 'all' && log.actionType !== selectedAction) return false;
      return true;
    });

    if (filtered.length === 0) {
      if (emptyBox) emptyBox.style.display = 'block';
      return;
    }
    if (emptyBox) emptyBox.style.display = 'none';

    filtered.forEach(log => {
      let badgeClass = 'badge-action-login';
      let icon = 'fa-arrow-right-to-bracket';

      if (log.actionType === 'ADD_STUDENT') {
        badgeClass = 'badge-action-add';
        icon = 'fa-plus';
      } else if (log.actionType === 'UPDATE_PAYMENT') {
        badgeClass = 'badge-action-payment';
        icon = 'fa-receipt';
      } else if (log.actionType === 'EDIT_STUDENT') {
        badgeClass = 'badge-action-edit';
        icon = 'fa-pen';
      } else if (log.actionType === 'DELETE_STUDENT') {
        badgeClass = 'badge-action-delete';
        icon = 'fa-trash-can';
      } else if (log.actionType === 'LOGOUT') {
        badgeClass = 'badge-action-logout';
        icon = 'fa-right-from-bracket';
      } else if (log.actionType === 'ASSIGN_KEY') {
        badgeClass = 'badge-action-key';
        icon = 'fa-key';
      } else if (log.actionType === 'ALLOW_ACCESS') {
        badgeClass = 'badge-action-grant';
        icon = 'fa-check';
      }

      const card = document.createElement('div');
      card.className = 'audit-log-card';
      card.innerHTML = `
        <div class="audit-log-top">
          <span class="audit-badge ${badgeClass}">
            <i class="fa-solid ${icon}"></i> ${escapeHtml(log.actionType)}
          </span>
          <span class="audit-log-time">
            <i class="fa-regular fa-clock"></i> ${escapeHtml(log.timestamp ? new Date(log.timestamp).toLocaleString() : '-')}
          </span>
        </div>
        <div class="audit-log-desc">
          ${escapeHtml(log.details || 'No details')}
        </div>
        <div class="audit-log-meta">
          <span><i class="fa-solid fa-user-shield"></i> Admin: <strong>${escapeHtml(log.adminName || 'Admin')}</strong></span>
        </div>
      `;
      container.appendChild(card);
    });
  }

  /* ==================== ASSIGN KEY MODAL FOR PENDING REQUESTS ==================== */
  function openAssignKeyPendingModal(uid, name) {
    const modal = document.getElementById('assignKeyPendingModal');
    const nameElem = document.getElementById('assignKeyApplicantName');
    const uidInp = document.getElementById('assignKeyApplicantUid');
    const codeInp = document.getElementById('assignKeyPendingCode');
    const errElem = document.getElementById('assignKeyPendingError');

    if (nameElem) nameElem.textContent = name;
    if (uidInp) uidInp.value = uid;
    if (codeInp) codeInp.value = String(Math.floor(100000 + Math.random() * 900000));
    if (errElem) errElem.style.display = 'none';

    if (modal) modal.style.display = 'flex';
  }

  function closeAssignKeyPendingModal() {
    const modal = document.getElementById('assignKeyPendingModal');
    if (modal) modal.style.display = 'none';
  }

  async function confirmAssignKeyPending() {
    const uid = document.getElementById('assignKeyApplicantUid')?.value;
    const name = document.getElementById('assignKeyApplicantName')?.textContent;
    const code = document.getElementById('assignKeyPendingCode')?.value.trim();
    const errElem = document.getElementById('assignKeyPendingError');

    if (!code || !/^\d{6}$/.test(code)) {
      if (errElem) {
        errElem.textContent = 'Please enter a valid 6-digit key.';
        errElem.style.display = 'block';
      }
      return;
    }

    try {
      await assignKeyForAdmin(name, code);
      // Remove from pending requests
      if (uid) {
        await mainDb.collection('admin_requests').doc(uid).delete().catch(() => {});
      }

      closeAssignKeyPendingModal();

      // Show one-time key box in tab
      switchManageTab('keys');
      const oneTimeBox = document.getElementById('oneTimeKeyBox');
      const nameElem = document.getElementById('oneTimeKeyAdminName');
      const digitsElem = document.getElementById('oneTimeKeyDigits');
      if (nameElem) nameElem.textContent = name;
      if (digitsElem) digitsElem.textContent = code;
      if (oneTimeBox) oneTimeBox.style.display = 'block';

      showToast(`Key assigned to ${name}! Copy and send it now.`, 'success');
    } catch (err) {
      if (errElem) {
        errElem.textContent = err.message || 'Failed to assign key';
        errElem.style.display = 'block';
      }
    }
  }

  /* ==================== EVENT LISTENERS ATTACHMENT ==================== */
  function initEventListeners() {
    // 1. Theme toggle
    document.getElementById('themeToggleBtn')?.addEventListener('click', toggleTheme);

    // 2. Admin portal toggle button
    document.getElementById('adminToggleBtn')?.addEventListener('click', toggleAdminModal);

    // 3. Admin banner actions
    document.getElementById('btnManageAdmins')?.addEventListener('click', openAdminManagementModal);
    document.getElementById('btnClearAllRecords')?.addEventListener('click', clearAllRecords);
    document.getElementById('btnLogout')?.addEventListener('click', () => handleLogout('manual'));

    // 4. Student Add Entry Form
    document.getElementById('lateEntryForm')?.addEventListener('submit', handleNewEntry);
    document.getElementById('btnPresetNow')?.addEventListener('click', () => setPresetTime('now'));
    document.getElementById('btnPresetLate')?.addEventListener('click', () => setPresetTime('8:10+'));

    // 5. Search & Filters
    document.getElementById('searchStudent')?.addEventListener('input', applyFilters);
    document.getElementById('clearSearchBtn')?.addEventListener('click', clearSearch);
    document.getElementById('filterDate')?.addEventListener('change', applyFilters);
    document.getElementById('filterStatus')?.addEventListener('change', applyFilters);

    // 6. Admin Login Modal Views & Actions
    document.getElementById('closeAdminModalBtn')?.addEventListener('click', closeAdminModal);
    document.getElementById('closeAdminModalCancelBtn')?.addEventListener('click', closeAdminModal);
    document.getElementById('btnAdminSubmit')?.addEventListener('click', handleAdminLogin);
    document.getElementById('linkToMasterLogin')?.addEventListener('click', () => switchLoginTab('master'));
    document.getElementById('btnMasterBack')?.addEventListener('click', () => switchLoginTab('pin'));
    document.getElementById('btnVerifyMasterMind')?.addEventListener('click', handleMasterOwnerLogin);
    document.getElementById('closeWaitingModalBtn')?.addEventListener('click', closeAdminModal);
    document.getElementById('closeDeniedModalBtn')?.addEventListener('click', closeAdminModal);
    document.getElementById('btnRetryLogin')?.addEventListener('click', retryAdminLogin);

    // Password visibility toggles
    document.getElementById('adminPrivateKeyEyeBtn')?.addEventListener('click', () => {
      const input = document.getElementById('adminPrivateKeyInput');
      const icon = document.getElementById('adminPrivateKeyEyeIcon');
      if (input && icon) {
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        icon.className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      }
    });

    document.getElementById('masterPasscodeEyeBtn')?.addEventListener('click', () => {
      const input = document.getElementById('masterPasscodeInput');
      const icon = document.getElementById('masterPasscodeEyeIcon');
      if (input && icon) {
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        icon.className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
      }
    });

    // Enter key triggers
    document.getElementById('adminLoginNameInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') document.getElementById('adminPrivateKeyInput')?.focus();
    });
    document.getElementById('adminPrivateKeyInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAdminLogin();
    });
    document.getElementById('masterPasscodeInput')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleMasterOwnerLogin();
    });

    // 7. Manage Admins Modal Actions
    document.getElementById('closeAdminManageModalBtn')?.addEventListener('click', closeAdminManagementModal);
    document.getElementById('closeAdminManageModalFooterBtn')?.addEventListener('click', closeAdminManagementModal);
    document.getElementById('btnLockedPlaceholderAuth')?.addEventListener('click', () => {
      closeAdminManagementModal();
      toggleAdminModal();
      switchLoginTab('master');
    });

    document.getElementById('tabManagePendingBtn')?.addEventListener('click', () => switchManageTab('pending'));
    document.getElementById('tabManageApprovedBtn')?.addEventListener('click', () => switchManageTab('approved'));
    document.getElementById('tabManageKeysBtn')?.addEventListener('click', () => switchManageTab('keys'));
    document.getElementById('tabManageAuditBtn')?.addEventListener('click', () => switchManageTab('audit'));

    // Key generator buttons in Private Keys tab
    document.getElementById('btnGenerateKey')?.addEventListener('click', () => {
      const inp = document.getElementById('newAdminKeyValue');
      if (inp) inp.value = String(Math.floor(100000 + Math.random() * 900000));
    });
    document.getElementById('btnCreateNewKey')?.addEventListener('click', handleCreateNewKeyForm);

    document.getElementById('btnCopyOneTimeKey')?.addEventListener('click', () => {
      const digits = document.getElementById('oneTimeKeyDigits')?.textContent;
      if (digits) {
        navigator.clipboard.writeText(digits).then(() => {
          showToast('6-digit Private Key copied to clipboard!', 'success');
        }).catch(() => {
          showToast('Copy failed. Please manually select and copy the key.', 'error');
        });
      }
    });
    document.getElementById('btnCloseOneTimeKey')?.addEventListener('click', () => {
      const box = document.getElementById('oneTimeKeyBox');
      if (box) box.style.display = 'none';
    });

    // Audit log filters
    document.getElementById('auditFilterAdmin')?.addEventListener('change', renderAuditLogsList);
    document.getElementById('auditFilterAction')?.addEventListener('change', renderAuditLogsList);

    // 8. Edit Entry Modal Actions
    document.getElementById('closeEditModalBtn')?.addEventListener('click', closeEditModal);
    document.getElementById('editModalCancelBtn')?.addEventListener('click', closeEditModal);
    document.getElementById('editModalSaveBtn')?.addEventListener('click', saveEditedEntry);
    document.getElementById('editPresetLateBtn')?.addEventListener('click', () => {
      const inp = document.getElementById('editArrivalTime');
      if (inp) inp.value = '8:10+ AM';
    });

    // 9. Assign Key Pending Modal Actions
    document.getElementById('closeAssignKeyPendingModalBtn')?.addEventListener('click', closeAssignKeyPendingModal);
    document.getElementById('cancelAssignKeyPendingBtn')?.addEventListener('click', closeAssignKeyPendingModal);
    document.getElementById('btnAssignKeyPendingRandom')?.addEventListener('click', () => {
      const inp = document.getElementById('assignKeyPendingCode');
      if (inp) inp.value = String(Math.floor(100000 + Math.random() * 900000));
    });
    document.getElementById('confirmAssignKeyPendingBtn')?.addEventListener('click', confirmAssignKeyPending);

    // 10. Table delegated click handler (Paid toggle, Edit, Delete)
    const tbody = document.getElementById('studentsTableBody');
    if (tbody) {
      tbody.addEventListener('click', (e) => {
        const targetBtn = e.target.closest('[data-action]');
        if (!targetBtn) return;

        const action = targetBtn.dataset.action;
        const id = targetBtn.dataset.id;
        if (!id) return;

        if (action === 'toggle-paid') {
          togglePayment(id);
        } else if (action === 'edit') {
          openEditModal(id);
        } else if (action === 'delete') {
          deleteEntry(id);
        }
      });
    }

    // 11. Manage modal delegated click handler (Pending & Active tabs)
    const pendingList = document.getElementById('pendingRequestsList');
    if (pendingList) {
      pendingList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const uid = btn.dataset.uid;
        const name = btn.dataset.name;
        if (action === 'allow-access') {
          allowAccessForRequest(uid, name);
        } else if (action === 'reject-request') {
          rejectRequest(uid, name);
        } else if (action === 'assign-key-pending') {
          openAssignKeyPendingModal(uid, name);
        }
      });
    }

    const approvedList = document.getElementById('approvedAdminsList');
    if (approvedList) {
      approvedList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const uid = btn.dataset.uid;
        const name = btn.dataset.name;
        if (action === 'delete-admin') {
          deleteAdmin(uid, name);
        }
      });
    }

    const keysList = document.getElementById('activeKeyHoldersList');
    if (keysList) {
      keysList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        if (btn.dataset.action === 'reassign-key') {
          const name = btn.dataset.name;
          const nameInput = document.getElementById('newAdminKeyName');
          const keyInput = document.getElementById('newAdminKeyValue');
          if (nameInput) nameInput.value = name;
          if (keyInput) keyInput.value = String(Math.floor(100000 + Math.random() * 900000));
          nameInput?.focus();
        }
      });
    }

    // 12. Modal overlay background click dismissal
    ['adminModal', 'adminManageModal', 'editEntryModal', 'assignKeyPendingModal'].forEach(modalId => {
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.style.display = 'none';
            if (modalId === 'adminModal') cleanupWaiting();
          }
        });
      }
    });

    // Default entry date to current date
    const dateInput = document.getElementById('entryDate');
    if (dateInput && !dateInput.value) {
      dateInput.value = getLocalDateString();
    }
  }

  // Initialize event bindings once DOM is fully interactive
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEventListeners);
  } else {
    initEventListeners();
  }

})();
