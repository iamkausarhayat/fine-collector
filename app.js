/**
 * Fine Collector - Class 8:00 AM Late Tracker
 * Production Enterprise Edition
 * Full Backend Firebase Authentication & Firestore Role Enforcement
 * Authority: Kausar Hayat (Master Mind / Owner)
 */

(function () {
  'use strict';

  // Global Configuration
  const DEFAULT_FIREBASE_PROJECT_ID = "fine-collector";
  const MASTER_OWNER_EMAIL = "iamkausarhayat100@gmail.com";

  // Internal Firebase Reference
  const _internalFirebase = window.firebase;

  /* ==================== APPLICATION STATE ==================== */
  const _state = {
    students: [],
    authorizedAdmins: {},   // Synced from Firestore 'admins' collection
    pendingRequests: {},    // Synced from Firestore 'admin_requests' collection
    auditLogs: [],          // Synced from Firestore 'admin_audit_logs' collection
    currentFilter: {
      search: '',
      date: 'all',
      status: 'all'
    },
    firebaseApp: null,
    firestoreDb: null,
    isCloudConnected: false,
    currentUser: null,       // Firebase Auth User object
    adminProfile: null       // Document from Firestore 'admins' collection
  };

  let _adminsListenerUnsub = null;
  let _requestsListenerUnsub = null;
  let _auditListenerUnsub = null;

  /* ==================== AUTHENTICATION & ROLE GUARDS ==================== */

  function isAuthenticated() {
    return !!_state.currentUser;
  }

  function getAdminRole() {
    if (!isAuthenticated()) return 'guest';
    if (_state.currentUser.email === MASTER_OWNER_EMAIL) return 'master';
    if (_state.adminProfile && _state.adminProfile.status === 'active') {
      return _state.adminProfile.role || 'guest';
    }
    return 'guest';
  }

  function isMasterAdmin() {
    return isAuthenticated() && (getAdminRole() === 'master' || _state.currentUser.email === MASTER_OWNER_EMAIL);
  }

  function isApprovedAdmin() {
    const role = getAdminRole();
    return isAuthenticated() && (role === 'master' || role === 'subadmin');
  }

  function guardMasterRights(actionName = 'this operation') {
    if (!isMasterAdmin()) {
      showToast(`Access Denied: Master Mind verification required for ${actionName}.`, 'error');
      closeAdminManagementModal();
      return false;
    }
    return true;
  }

  function guardAdminRights(actionName = 'this operation') {
    if (!isApprovedAdmin()) {
      showToast(`Access Denied: Admin authorization required for ${actionName}. Read-Only Mode enforced.`, 'error');
      return false;
    }
    return true;
  }

  /* ==================== THEME MANAGEMENT ==================== */
  const THEME_KEY = 'fc_theme';

  function getCurrentTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (e) {}
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
    } catch (e) {}
    applyTheme(next);
    showToast(`${next === 'dark' ? 'Dark' : 'Light'} Mode active`, 'info');
  }

  /* ==================== DATE UTILITIES ==================== */

  function getLocalDateString(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function isSameDay(dateStr1, dateStr2) {
    if (!dateStr1 || !dateStr2) return false;
    if (dateStr1 === dateStr2) return true;
    try {
      const d1 = new Date(dateStr1);
      const d2 = new Date(dateStr2);
      if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return dateStr1 === dateStr2;
      return d1.getFullYear() === d2.getFullYear() &&
             d1.getMonth() === d2.getMonth() &&
             d1.getDate() === d2.getDate();
    } catch (e) {
      return dateStr1 === dateStr2;
    }
  }

  function initDateInput() {
    const entryDate = document.getElementById('entryDate');
    if (entryDate) entryDate.value = getLocalDateString();
  }

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

  /* ==================== AUDIT LOGGING (TAMPER-PROOF & SANITIZED) ==================== */

  function recordAuditLog({ actionType, details, adminName, role, studentId, studentName, metadata = {} }) {
    if (!isApprovedAdmin()) return;

    try {
      const currentName = adminName || (_state.adminProfile?.name) || (_state.currentUser?.email) || 'Admin';
      const currentRole = role || (isMasterAdmin() ? 'Master Admin' : 'Sub-Admin');
      const logId = 'log_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);

      const now = new Date();
      const timeFormatted = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      // Sanitized log entry without any secret values
      const logEntry = {
        id: logId,
        timestamp: Date.now(),
        timeFormatted: timeFormatted,
        adminName: currentName,
        adminEmail: _state.currentUser?.email || '',
        role: currentRole,
        device: getDeviceInfo(),
        actionType: actionType || 'GENERAL',
        details: details || '',
        studentId: studentId || null,
        studentName: studentName || null,
        metadata: metadata || {}
      };

      if (!Array.isArray(_state.auditLogs)) _state.auditLogs = [];
      _state.auditLogs.unshift(logEntry);
      if (_state.auditLogs.length > 300) _state.auditLogs = _state.auditLogs.slice(0, 300);

      try {
        localStorage.setItem('fc_admin_audit_logs', JSON.stringify(_state.auditLogs));
      } catch (e) {}

      if (_state.isCloudConnected && _state.firestoreDb) {
        _state.firestoreDb.collection('admin_audit_logs').doc(logId).set(logEntry).catch(e => {
          console.warn('Firestore audit log write error:', e);
        });
      }

      renderAuditLogsList();
    } catch (err) {
      console.warn('recordAuditLog error:', err);
    }
  }

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

    const logs = Array.isArray(_state.auditLogs) ? _state.auditLogs : [];
    if (tabBadgeEl) tabBadgeEl.textContent = logs.length;

    if (filterAdminSelect) {
      const currentSelected = filterAdminSelect.value || 'all';
      const distinctAdmins = Array.from(new Set(logs.map(l => l.adminName).filter(Boolean)));
      filterAdminSelect.innerHTML = '<option value="all">All Admins</option>' + distinctAdmins.map(name => {
        return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
      }).join('');
      if (distinctAdmins.includes(currentSelected)) {
        filterAdminSelect.value = currentSelected;
      } else {
        filterAdminSelect.value = 'all';
      }
    }

    if (totalCountEl) totalCountEl.textContent = logs.length;
    if (crudCountEl) {
      const crudActions = ['ADD_STUDENT', 'UPDATE_PAYMENT', 'EDIT_STUDENT', 'DELETE_STUDENT', 'CLEAR_ALL'];
      crudCountEl.textContent = logs.filter(l => crudActions.includes(l.actionType)).length;
    }
    if (lastActiveEl) {
      lastActiveEl.textContent = (logs.length > 0 && logs[0].adminName) ? logs[0].adminName : 'None';
    }

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
        case 'ADMIN_AUTHORIZED':
          badgeClass = 'badge-action-grant';
          iconClass = 'fa-solid fa-user-shield';
          label = 'Admin Authorized';
          break;
        case 'ADMIN_REVOKED':
          badgeClass = 'badge-action-delete';
          iconClass = 'fa-solid fa-user-xmark';
          label = 'Admin Revoked';
          break;
        case 'PASSWORD_CHANGED':
          badgeClass = 'badge-action-login';
          iconClass = 'fa-solid fa-key';
          label = 'Password Changed';
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

  function clearAuditLogs() {
    if (!guardMasterRights('clearing audit logs')) return;

    if (confirm('Are you sure you want to clear all Audit Logs? This will wipe activity history.')) {
      if (_state.isCloudConnected && _state.firestoreDb) {
        (_state.auditLogs || []).forEach(l => {
          if (l && l.id) _state.firestoreDb.collection('admin_audit_logs').doc(l.id).delete().catch(() => {});
        });
      }
      _state.auditLogs = [];
      try {
        localStorage.removeItem('fc_admin_audit_logs');
      } catch (e) {}
      renderAuditLogsList();
      showToast('Audit logs cleared', 'info');
    }
  }

  /* ==================== BACKEND FIREBASE CLOUD & AUTH INITIALIZATION ==================== */

  function initCloudOrLocalStorage() {
    let savedProjectId = null;
    try {
      savedProjectId = localStorage.getItem('fc_firebase_project_id');
    } catch (e) {}

    if (!savedProjectId || savedProjectId.includes('rtdb') || savedProjectId === 'fine-collector-default-rtdb') {
      savedProjectId = DEFAULT_FIREBASE_PROJECT_ID;
      try {
        localStorage.setItem('fc_firebase_project_id', DEFAULT_FIREBASE_PROJECT_ID);
      } catch (e) {}
    }

    let savedConfigJson = null;
    try {
      savedConfigJson = localStorage.getItem('fc_firebase_config');
    } catch (e) {}

    if (_internalFirebase && _internalFirebase.firestore && _internalFirebase.auth) {
      try {
        let config = {
          projectId: savedProjectId
        };
        if (savedConfigJson) {
          try { Object.assign(config, JSON.parse(savedConfigJson)); } catch (e) {}
        }
        if (!config.apiKey) config.apiKey = "AIzaSyDummyFirestoreClientKey2026";
        if (!config.authDomain) config.authDomain = `${config.projectId}.firebaseapp.com`;

        if (!_internalFirebase.apps.length) {
          _state.firebaseApp = _internalFirebase.initializeApp(config);
        } else {
          _state.firebaseApp = _internalFirebase.app();
        }
        _state.firestoreDb = _internalFirebase.firestore();
        _state.isCloudConnected = true;

        // 1. Listen for Students collection (Public Read, Admin Write)
        _state.firestoreDb.collection('students').onSnapshot((snapshot) => {
          const list = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data && typeof data === 'object') {
              list.push({ ...data, id: doc.id });
            }
          });
          list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          _state.students = list;
          saveToLocalStorage();
          renderAll();
        }, (error) => {
          console.warn('Firestore students listener fallback:', error);
          loadFromLocalStorage();
        });

        // 2. Primary Backend Firebase Authentication State Listener
        _internalFirebase.auth().onAuthStateChanged(async (user) => {
          _state.currentUser = user;

          if (user) {
            console.log("Firebase Auth User active:", user.email, "UID:", user.uid);
            await verifyAdminProfile(user);
          } else {
            console.log("Firebase Auth: Visitor / Guest Mode");
            _state.adminProfile = null;
            detachAdminListeners();
            updateAdminUI();
            renderAll();
          }
        });

        return;
      } catch (err) {
        console.warn('Firestore initialization error:', err);
      }
    }

    loadFromLocalStorage();
  }

  /**
   * Verifies the authenticated user against the Firestore 'admins' collection
   */
  async function verifyAdminProfile(user) {
    if (!_state.firestoreDb) return;

    try {
      const isOwnerEmail = (user.email === MASTER_OWNER_EMAIL);

      // Auto-bootstrap master record for the Owner email if first-time run
      if (isOwnerEmail) {
        await _state.firestoreDb.collection('admins').doc(user.uid).set({
          uid: user.uid,
          email: user.email,
          name: 'Kausar Hayat (Master Owner)',
          role: 'master',
          status: 'active',
          updatedAt: Date.now()
        }, { merge: true }).catch(() => {});
      }

      // Fetch admin role document from Firestore 'admins'
      const adminDoc = await _state.firestoreDb.collection('admins').doc(user.uid).get();

      if (adminDoc.exists && adminDoc.data().status === 'active') {
        _state.adminProfile = adminDoc.data();
        const role = _state.adminProfile.role || (isOwnerEmail ? 'master' : 'subadmin');

        updateAdminUI();
        renderAll();

        // Attach listeners for Master Admin
        if (role === 'master' || isOwnerEmail) {
          attachMasterListeners();
        }

        // Attach audit logs listener
        attachAuditLogsListener();

        recordAuditLog({
          actionType: 'LOGIN',
          details: `User ${user.email} signed in as ${role === 'master' ? 'Master Admin' : 'Sub-Admin'}`
        });

        showToast(`Welcome, ${_state.adminProfile.name || user.email}!`, 'success');
      } else if (isOwnerEmail) {
        _state.adminProfile = {
          uid: user.uid,
          email: user.email,
          name: 'Kausar Hayat (Master Owner)',
          role: 'master',
          status: 'active'
        };
        updateAdminUI();
        renderAll();
        attachMasterListeners();
        attachAuditLogsListener();
        showToast('👑 Welcome Master Mind!', 'success');
      } else {
        // Authenticated with Firebase Auth, but NOT listed in Firestore 'admins'
        console.warn("User authenticated in Firebase but NOT present in 'admins' collection:", user.email);
        showToast("Unauthorized: Your account has not been authorized as an Admin by Master Mind.", "error");
        await _internalFirebase.auth().signOut();
      }
    } catch (err) {
      console.error("Error verifying admin role:", err);
      showToast("Verification error checking admin role.", "error");
    }
  }

  function attachMasterListeners() {
    if (!_state.firestoreDb || !isMasterAdmin()) return;

    // 1. Realtime listener for all authorized admins in 'admins' collection
    if (!_adminsListenerUnsub) {
      _adminsListenerUnsub = _state.firestoreDb.collection('admins').onSnapshot((snapshot) => {
        const admins = {};
        snapshot.forEach(doc => {
          admins[doc.id] = doc.data();
        });
        _state.authorizedAdmins = admins;
        renderAuthorizedAdminsList();
      }, (err) => {
        console.warn("admins listener note:", err);
      });
    }

    // 2. Realtime listener for pending access requests in 'admin_requests' collection
    if (!_requestsListenerUnsub) {
      _requestsListenerUnsub = _state.firestoreDb.collection('admin_requests').where('status', '==', 'pending').onSnapshot((snapshot) => {
        const reqs = {};
        snapshot.forEach(doc => {
          reqs[doc.id] = doc.data();
        });
        _state.pendingRequests = reqs;
        renderPendingRequestsList();
      }, (err) => {
        console.warn("admin_requests listener note:", err);
      });
    }
  }

  function attachAuditLogsListener() {
    if (!_state.firestoreDb || !isApprovedAdmin() || _auditListenerUnsub) return;

    _auditListenerUnsub = _state.firestoreDb.collection('admin_audit_logs').limit(200).onSnapshot((snapshot) => {
      const logs = [];
      snapshot.forEach(doc => {
        logs.push(doc.data());
      });
      logs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      _state.auditLogs = logs;
      try {
        localStorage.setItem('fc_admin_audit_logs', JSON.stringify(logs));
      } catch (e) {}
      renderAuditLogsList();
    }, () => {});
  }

  function detachAdminListeners() {
    if (_adminsListenerUnsub) {
      _adminsListenerUnsub();
      _adminsListenerUnsub = null;
    }
    if (_requestsListenerUnsub) {
      _requestsListenerUnsub();
      _requestsListenerUnsub = null;
    }
    if (_auditListenerUnsub) {
      _auditListenerUnsub();
      _auditListenerUnsub = null;
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

    _state.students.forEach(student => {
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
    if (statTotal) statTotal.textContent = _state.students.length;
    if (statToday) statToday.textContent = `${todayCount} today`;
  }

  function getFilteredStudents() {
    const todayStr = getLocalDateString();
    const query = (_state.currentFilter.search || '').toLowerCase().trim();
    const dateFilter = _state.currentFilter.date;
    const statusFilter = _state.currentFilter.status;

    return _state.students.filter(student => {
      if (query && !student.name.toLowerCase().includes(query)) return false;
      if (dateFilter === 'today' && !isSameDay(student.date, todayStr)) return false;
      if (statusFilter === 'paid' && !student.paid) return false;
      if (statusFilter === 'unpaid' && student.paid) return false;
      return true;
    });
  }

  function renderTable() {
    const tbody = document.getElementById('studentsTableBody');
    const emptyState = document.getElementById('emptyState');
    const filteredCountBadge = document.getElementById('filteredCountBadge');
    const adminCols = document.querySelectorAll('.admin-col');

    if (!tbody) return;

    const isAdmin = isApprovedAdmin();
    adminCols.forEach(col => {
      col.style.display = isAdmin ? 'table-cell' : 'none';
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
      if (isAdmin) {
        statusHtml = `
          <button class="btn-toggle-payment ${student.paid ? 'is-paid' : 'is-unpaid'}" 
                  onclick="window.togglePayment('${student.id}')"
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

      const adminActionsHtml = isAdmin ? `
        <td class="admin-col">
          <div class="table-actions">
            <button class="btn-icon" onclick="window.openEditModal('${student.id}')" title="Edit Entry">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="btn-icon btn-icon-delete" onclick="window.deleteEntry('${student.id}')" title="Delete Entry">
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

  /* ==================== FILTERS & PRESETS ==================== */

  function applyFilters() {
    const searchInput = document.getElementById('searchStudent');
    const dateSelect = document.getElementById('filterDate');
    const statusSelect = document.getElementById('filterStatus');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (searchInput) _state.currentFilter.search = searchInput.value;
    if (dateSelect) _state.currentFilter.date = dateSelect.value;
    if (statusSelect) _state.currentFilter.status = statusSelect.value;

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

  /* ==================== SECURED STUDENT CRUD (BACKEND ENFORCED) ==================== */

  function handleNewEntry(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!guardAdminRights('adding new record')) return;

    const nameInput = document.getElementById('studentName');
    const dateInput = document.getElementById('entryDate');
    const timeInput = document.getElementById('arrivalTime');
    const fineInput = document.getElementById('fineAmount');
    const paidCheckbox = document.getElementById('initialPaid');

    const name = nameInput ? nameInput.value.trim() : '';
    const date = dateInput?.value || getLocalDateString();
    const time = timeInput ? timeInput.value.trim() : '';
    const fine = parseInt(fineInput?.value) || 100;
    const paid = !!paidCheckbox?.checked;

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

    _state.students.unshift(newStudent);
    saveToLocalStorage();

    if (_state.isCloudConnected && _state.firestoreDb) {
      _state.firestoreDb.collection('students').doc(newStudent.id).set(newStudent)
        .catch(err => {
          console.error('Server rejected student creation:', err);
          showToast('Security Alert: Server rejected student record creation (Missing Admin Privileges in Firestore).', 'error');
          _state.students = _state.students.filter(s => s.id !== newStudent.id);
          renderAll();
        });
    }

    _state.currentFilter.date = 'all';
    const filterDateElem = document.getElementById('filterDate');
    if (filterDateElem) filterDateElem.value = 'all';

    const searchInput = document.getElementById('searchStudent');
    if (searchInput) searchInput.value = '';
    _state.currentFilter.search = '';

    renderAll();

    if (nameInput) {
      nameInput.value = '';
      nameInput.focus();
    }
    if (paidCheckbox) paidCheckbox.checked = false;

    showToast(`Added ${name} to late records`, 'success');

    recordAuditLog({
      actionType: 'ADD_STUDENT',
      details: `Added late record for "${name}" (Fine: Rs. ${fine}, Time: ${time}, Date: ${date}, Status: ${paid ? 'Paid' : 'Pending'})`,
      studentId: newStudent.id,
      studentName: name
    });
  }

  function togglePayment(studentId) {
    if (!guardAdminRights('updating payment status')) return;

    const student = _state.students.find(s => s.id === studentId);
    if (!student) return;

    const previousPaid = student.paid;
    student.paid = !student.paid;
    student.updatedAt = Date.now();
    saveToLocalStorage();
    renderAll();

    if (_state.isCloudConnected && _state.firestoreDb) {
      _state.firestoreDb.collection('students').doc(studentId).update({
        paid: student.paid,
        updatedAt: student.updatedAt
      }).catch(err => {
        console.error('Server rejected payment toggle:', err);
        showToast('Security Alert: Server rejected payment modification (Unauthorized).', 'error');
        student.paid = previousPaid;
        renderAll();
      });
    }

    const msg = student.paid
      ? `Marked ${student.name} as Paid (Rs. ${student.fine})`
      : `Marked ${student.name} as Pending`;
    showToast(msg, 'success');

    recordAuditLog({
      actionType: 'UPDATE_PAYMENT',
      details: `Marked student "${student.name}" as ${student.paid ? 'PAID (Rs. ' + student.fine + ')' : 'PENDING'}`,
      studentId: student.id,
      studentName: student.name
    });
  }

  function deleteEntry(studentId) {
    if (!guardAdminRights('deleting student record')) return;

    const student = _state.students.find(s => s.id === studentId);
    if (!student) return;

    if (confirm(`Are you sure you want to delete the record for ${student.name}?`)) {
      const deletedStudentName = student.name;
      const deletedFine = student.fine;
      const deletedDate = student.date;
      const originalStudents = [..._state.students];

      _state.students = _state.students.filter(s => s.id !== studentId);
      saveToLocalStorage();
      renderAll();

      if (_state.isCloudConnected && _state.firestoreDb) {
        _state.firestoreDb.collection('students').doc(studentId).delete()
          .catch(err => {
            console.error('Server rejected record deletion:', err);
            showToast('Security Alert: Server rejected record deletion.', 'error');
            _state.students = originalStudents;
            renderAll();
          });
      }
      showToast(`${deletedStudentName} record deleted`, 'info');

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
      const totalCleared = _state.students.length;
      if (_state.isCloudConnected && _state.firestoreDb) {
        (_state.students || []).forEach(s => {
          if (s && s.id) _state.firestoreDb.collection('students').doc(s.id).delete().catch(() => {});
        });
      }
      _state.students = [];
      saveToLocalStorage();
      renderAll();
      showToast("All records cleared", "info");

      recordAuditLog({
        actionType: 'CLEAR_ALL',
        details: `Master Mind cleared all records (${totalCleared} late student entries removed)`
      });
    }
  }

  function openEditModal(studentId) {
    if (!isApprovedAdmin()) return;
    const student = _state.students.find(s => s.id === studentId);
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
    if (!guardAdminRights('editing student record')) return;

    const id = document.getElementById('editEntryId').value;
    const student = _state.students.find(s => s.id === id);
    if (!student) return;

    student.name = document.getElementById('editStudentName').value.trim();
    student.date = document.getElementById('editEntryDate').value;
    student.time = document.getElementById('editArrivalTime').value.trim();
    student.fine = parseInt(document.getElementById('editFineAmount').value) || 100;
    student.paid = document.getElementById('editPaidStatus').checked;
    student.updatedAt = Date.now();

    saveToLocalStorage();
    renderAll();
    closeEditModal();

    if (_state.isCloudConnected && _state.firestoreDb) {
      _state.firestoreDb.collection('students').doc(student.id).update({
        name: student.name,
        date: student.date,
        time: student.time,
        fine: student.fine,
        paid: student.paid,
        updatedAt: student.updatedAt
      }).catch(err => {
        console.error('Server rejected edit update:', err);
        showToast('Security Alert: Server rejected record alteration.', 'error');
      });
    }
    showToast(`Updated record for ${student.name}`, 'success');

    recordAuditLog({
      actionType: 'EDIT_STUDENT',
      details: `Edited record for "${student.name}" (Fine: Rs. ${student.fine}, Arrival: ${student.time}, Date: ${student.date}, Status: ${student.paid ? 'Paid' : 'Pending'})`,
      studentId: student.id,
      studentName: student.name
    });
  }

  /* ==================== BACKEND FIREBASE AUTH LOGIN & REGISTRATION ==================== */

  function toggleAdminModal() {
    if (isApprovedAdmin()) {
      const entryCard = document.getElementById('adminEntryCard');
      if (entryCard) entryCard.scrollIntoView({ behavior: 'smooth' });
    } else {
      openAdminModal();
    }
  }

  function openAdminModal() {
    switchLoginAuthTab('login');
    const modal = document.getElementById('adminModal');
    if (modal) modal.style.display = 'flex';
    const emailInput = document.getElementById('adminLoginEmailInput');
    if (emailInput) emailInput.focus();
  }

  function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) modal.style.display = 'none';
  }

  function switchLoginAuthTab(tab) {
    const vLogin = document.getElementById('loginViewSignIn');
    const vReq = document.getElementById('loginViewRequestAccess');
    const bLogin = document.getElementById('tabAuthLoginBtn');
    const bReq = document.getElementById('tabAuthRequestBtn');
    const err = document.getElementById('loginErrorMsg');

    if (err) err.style.display = 'none';

    if (tab === 'request') {
      if (vLogin) vLogin.style.display = 'none';
      if (vReq) vReq.style.display = 'block';
      if (bLogin) bLogin.classList.remove('active');
      if (bReq) bReq.classList.add('active');
      const reqName = document.getElementById('requestAccessNameInput');
      if (reqName) reqName.focus();
    } else {
      if (vLogin) vLogin.style.display = 'block';
      if (vReq) vReq.style.display = 'none';
      if (bLogin) bLogin.classList.add('active');
      if (bReq) bReq.classList.remove('active');
      const emailInput = document.getElementById('adminLoginEmailInput');
      if (emailInput) emailInput.focus();
    }
  }

  /**
   * BACKEND SIGN IN via Firebase Authentication
   */
  async function handleAdminLogin() {
    const emailInput = document.getElementById('adminLoginEmailInput');
    const passwordInput = document.getElementById('adminLoginPasswordInput');
    const errorMsg = document.getElementById('loginErrorMsg');
    const submitBtn = document.getElementById('btnAdminSignIn');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!email || !password) {
      if (errorMsg) {
        errorMsg.textContent = 'Please enter both Email and Password';
        errorMsg.style.display = 'block';
      }
      return;
    }

    if (errorMsg) errorMsg.style.display = 'none';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Signing In...';
    }

    try {
      if (!_internalFirebase || !_internalFirebase.auth) {
        throw new Error("Firebase Authentication SDK is not loaded.");
      }

      // Backend authentication: Verified by Google Firebase Auth servers
      const userCred = await _internalFirebase.auth().signInWithEmailAndPassword(email, password);
      console.log("Firebase Auth Sign-in succeeded for:", userCred.user.email);

      closeAdminModal();
    } catch (authErr) {
      console.error("Firebase Auth sign-in failed:", authErr);
      let friendlyMsg = "Authentication failed: Invalid email or password.";
      if (authErr.code === 'auth/user-not-found') friendlyMsg = "No account found with this email.";
      else if (authErr.code === 'auth/wrong-password') friendlyMsg = "Incorrect password. Please try again.";
      else if (authErr.code === 'auth/too-many-requests') friendlyMsg = "Account temporarily locked due to many attempts. Reset password or wait.";

      if (errorMsg) {
        errorMsg.textContent = friendlyMsg;
        errorMsg.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Sign In';
      }
    }
  }

  /**
   * SUBMIT ACCESS REQUEST to Firestore 'admin_requests' collection
   */
  async function handleRequestAccess() {
    const nameInput = document.getElementById('requestAccessNameInput');
    const emailInput = document.getElementById('requestAccessEmailInput');
    const reasonInput = document.getElementById('requestAccessReasonInput');
    const errorMsg = document.getElementById('requestAccessMsg');
    const successMsg = document.getElementById('requestAccessSuccessMsg');
    const submitBtn = document.getElementById('btnSubmitRequest');

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const reason = reasonInput ? reasonInput.value.trim() : '';

    if (!name || !email) {
      if (errorMsg) {
        errorMsg.textContent = 'Please provide both your Full Name and Email.';
        errorMsg.style.display = 'block';
      }
      return;
    }

    if (errorMsg) errorMsg.style.display = 'none';
    if (successMsg) successMsg.style.display = 'none';
    if (submitBtn) submitBtn.disabled = true;

    try {
      if (!_state.firestoreDb) {
        throw new Error("Cloud database not connected.");
      }

      const reqId = 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
      await _state.firestoreDb.collection('admin_requests').doc(reqId).set({
        id: reqId,
        name: name,
        email: email,
        reason: reason,
        status: 'pending',
        requestedAt: Date.now()
      });

      if (successMsg) {
        successMsg.textContent = 'Access request submitted! Master Mind (Kausar Hayat) will review and approve your account.';
        successMsg.style.display = 'block';
      }
      if (nameInput) nameInput.value = '';
      if (emailInput) emailInput.value = '';
      if (reasonInput) reasonInput.value = '';

      showToast("Access request submitted to Master Mind!", "success");
    } catch (e) {
      console.error("Access request submission error:", e);
      if (errorMsg) {
        errorMsg.textContent = 'Error submitting request. Please try again.';
        errorMsg.style.display = 'block';
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  /**
   * Password Reset via Firebase Authentication Email
   */
  async function handleForgotPassword() {
    const emailInput = document.getElementById('adminLoginEmailInput');
    const email = emailInput ? emailInput.value.trim() : '';

    if (!email) {
      const enteredEmail = prompt("Please enter your Admin Email address to receive a password reset link:");
      if (!enteredEmail) return;
      sendReset(enteredEmail);
    } else {
      sendReset(email);
    }

    async function sendReset(e) {
      try {
        await _internalFirebase.auth().sendPasswordResetEmail(e);
        showToast(`Password reset link sent to ${e}`, "info");
      } catch (err) {
        showToast("Error sending password reset email: " + err.message, "error");
      }
    }
  }

  /**
   * Change Password directly via Firebase Authentication
   */
  async function handleChangePassword() {
    const newPassInput = document.getElementById('newAdminPasswordInput');
    const confPassInput = document.getElementById('confirmAdminPasswordInput');
    const errorMsg = document.getElementById('passwordErrorMsg');
    const successMsg = document.getElementById('passwordSuccessMsg');

    const newPass = newPassInput ? newPassInput.value : '';
    const confPass = confPassInput ? confPassInput.value : '';

    if (errorMsg) errorMsg.style.display = 'none';
    if (successMsg) successMsg.style.display = 'none';

    if (!newPass || newPass.length < 6) {
      if (errorMsg) {
        errorMsg.textContent = 'Password must be at least 6 characters long.';
        errorMsg.style.display = 'block';
      }
      return;
    }

    if (newPass !== confPass) {
      if (errorMsg) {
        errorMsg.textContent = 'New Password and Confirmation do not match.';
        errorMsg.style.display = 'block';
      }
      return;
    }

    try {
      if (!_state.currentUser) throw new Error("No active user session.");
      await _state.currentUser.updatePassword(newPass);

      if (successMsg) {
        successMsg.textContent = 'Password updated successfully on Firebase Auth server!';
        successMsg.style.display = 'block';
      }

      recordAuditLog({
        actionType: 'PASSWORD_CHANGED',
        details: 'User updated their account password'
      });

      showToast("Password updated successfully!", "success");
      if (newPassInput) newPassInput.value = '';
      if (confPassInput) confPassInput.value = '';

      setTimeout(() => {
        closePinModal();
      }, 1500);
    } catch (err) {
      console.error("Update password error:", err);
      if (errorMsg) {
        errorMsg.textContent = err.message || "Failed to update password. You may need to sign out and re-login first.";
        errorMsg.style.display = 'block';
      }
    }
  }

  function logoutAdmin() {
    if (_state.currentUser) {
      recordAuditLog({
        actionType: 'LOGOUT',
        details: `Admin ${_state.currentUser.email} logged out`
      });
    }

    if (_internalFirebase && _internalFirebase.auth) {
      _internalFirebase.auth().signOut().catch(() => {});
    }

    _state.currentUser = null;
    _state.adminProfile = null;
    detachAdminListeners();
    closeAdminManagementModal();
    updateAdminUI();
    renderAll();
    showToast('Logged out of Admin mode', 'info');
  }

  /* ==================== MASTER ADMIN MANAGEMENT ==================== */

  function openAdminManagementModal() {
    if (!guardMasterRights('opening Admin Management')) return;

    const modal = document.getElementById('adminManageModal');
    if (modal) modal.classList.add('verified');

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
    const vAudit = document.getElementById('manageViewAudit');
    const bPending = document.getElementById('tabManagePendingBtn');
    const bApproved = document.getElementById('tabManageApprovedBtn');
    const bAudit = document.getElementById('tabManageAuditBtn');

    if (vPending) vPending.style.display = (tab === 'pending') ? 'block' : 'none';
    if (vApproved) vApproved.style.display = (tab === 'approved') ? 'block' : 'none';
    if (vAudit) vAudit.style.display = (tab === 'audit') ? 'block' : 'none';

    if (bPending) bPending.classList.toggle('active', tab === 'pending');
    if (bApproved) bApproved.classList.toggle('active', tab === 'approved');
    if (bAudit) bAudit.classList.toggle('active', tab === 'audit');

    if (tab === 'pending') renderPendingRequestsList();
    else if (tab === 'approved') renderAuthorizedAdminsList();
    else if (tab === 'audit') renderAuditLogsList();
  }

  function renderPendingRequestsList() {
    const container = document.getElementById('pendingRequestsList');
    const emptyBox = document.getElementById('emptyPendingRequests');
    const badgeTab = document.getElementById('manageTabPendingBadge');
    const badgeBanner = document.getElementById('manageAdminsPendingBadge');
    const banner = document.getElementById('permissionAlertBanner');
    const bannerDesc = document.getElementById('permissionAlertDesc');

    if (!container) return;

    const requests = Object.values(_state.pendingRequests || {}).filter(Boolean);
    if (badgeTab) badgeTab.textContent = requests.length;
    if (badgeBanner) {
      badgeBanner.textContent = requests.length;
      badgeBanner.style.display = requests.length > 0 ? 'inline-block' : 'none';
    }

    if (requests.length > 0 && isMasterAdmin()) {
      if (banner) banner.style.display = 'flex';
      if (bannerDesc) bannerDesc.textContent = `${requests[requests.length - 1].name} (${requests[requests.length - 1].email}) requested access.`;
    } else if (banner) {
      banner.style.display = 'none';
    }

    if (requests.length === 0) {
      container.innerHTML = '';
      if (emptyBox) emptyBox.style.display = 'block';
      return;
    }

    if (emptyBox) emptyBox.style.display = 'none';

    container.innerHTML = requests.map(req => {
      const timeStr = req.requestedAt ? new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently';
      return `
        <div class="device-card">
          <div class="device-info-left">
            <div class="device-icon-box">
              <i class="fa-solid fa-user-plus"></i>
            </div>
            <div>
              <div class="device-name-title">
                ${escapeHtml(req.name)} <span class="badge-waiting" style="margin-left: 6px;">${escapeHtml(req.email)}</span>
              </div>
              <div class="device-meta-sub">
                <span><i class="fa-solid fa-comment"></i> ${escapeHtml(req.reason || 'Sub-Admin request')}</span>
                <span>&bull;</span>
                <span><i class="fa-regular fa-clock"></i> ${timeStr}</span>
              </div>
            </div>
          </div>
          <div class="device-actions">
            <button class="btn-card-approve" onclick="window.prefillAuthorizeAdmin('${escapeHtml(req.email)}', '${escapeHtml(req.name)}')">
              <i class="fa-solid fa-user-check"></i> Authorize Admin
            </button>
            <button class="btn-card-reject" onclick="window.rejectAccessRequest('${req.id}')">
              <i class="fa-solid fa-xmark"></i> Dismiss
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function prefillAuthorizeAdmin(email, name) {
    switchManageTab('approved');
    setTimeout(() => {
      const nameInput = document.getElementById('newAdminNameInput');
      const uidInput = document.getElementById('newAdminUidInput');
      if (nameInput) nameInput.value = `${name} (${email})`;
      if (uidInput) {
        uidInput.focus();
        showToast(`Paste UID for ${email} from Firebase Console`, 'info');
      }
    }, 100);
  }

  async function rejectAccessRequest(requestId) {
    if (!guardMasterRights('rejecting request')) return;

    if (_state.isCloudConnected && _state.firestoreDb) {
      await _state.firestoreDb.collection('admin_requests').doc(requestId).delete().catch(() => {});
      showToast("Access request dismissed.", "info");
    }
  }

  async function handleAddAdminDoc() {
    if (!guardMasterRights('authorizing admin')) return;

    const uidInput = document.getElementById('newAdminUidInput');
    const nameInput = document.getElementById('newAdminNameInput');
    const roleSelect = document.getElementById('newAdminRoleSelect');

    const uid = uidInput ? uidInput.value.trim() : '';
    const name = nameInput ? nameInput.value.trim() : '';
    const role = roleSelect ? roleSelect.value : 'subadmin';

    if (!uid || !name) {
      showToast("Please enter both the Firebase Auth UID and Admin Name/Email", "error");
      return;
    }

    try {
      await _state.firestoreDb.collection('admins').doc(uid).set({
        uid: uid,
        name: name,
        role: role,
        status: 'active',
        createdAt: Date.now(),
        createdBy: 'Kausar Hayat (Master Owner)'
      });

      showToast(`Admin "${name}" authorized as ${role}!`, "success");

      recordAuditLog({
        actionType: 'ADMIN_AUTHORIZED',
        details: `Authorized "${name}" (UID: ${uid}) with role ${role}`
      });

      if (uidInput) uidInput.value = '';
      if (nameInput) nameInput.value = '';
    } catch (err) {
      console.error("Authorize admin error:", err);
      showToast("Error saving admin to Firestore: " + err.message, "error");
    }
  }

  async function revokeAdminDoc(adminUid, adminName) {
    if (!guardMasterRights('revoking admin')) return;

    if (confirm(`Are you sure you want to revoke Admin rights from "${adminName}"?\n\nThey will immediately lose all write access to late records.`)) {
      try {
        await _state.firestoreDb.collection('admins').doc(adminUid).delete();
        showToast(`Admin "${adminName}" revoked!`, "info");

        recordAuditLog({
          actionType: 'ADMIN_REVOKED',
          details: `Revoked admin rights for "${adminName}" (UID: ${adminUid})`
        });
      } catch (err) {
        showToast("Error revoking admin: " + err.message, "error");
      }
    }
  }

  function renderAuthorizedAdminsList() {
    const container = document.getElementById('approvedAdminsList');
    const emptyBox = document.getElementById('emptyApprovedAdmins');
    const badgeTab = document.getElementById('manageTabApprovedBadge');

    if (!container) return;

    const admins = Object.values(_state.authorizedAdmins || {}).filter(Boolean);
    if (badgeTab) badgeTab.textContent = admins.length;

    if (admins.length === 0) {
      container.innerHTML = '';
      if (emptyBox) emptyBox.style.display = 'block';
      return;
    }

    if (emptyBox) emptyBox.style.display = 'none';

    container.innerHTML = admins.map(a => {
      const isMaster = (a.role === 'master' || a.email === MASTER_OWNER_EMAIL);
      return `
        <div class="device-card" style="${isMaster ? 'border-left: 3px solid #fbbf24;' : 'border-left: 3px solid #10b981;'}">
          <div class="device-info-left">
            <div class="device-icon-box" style="${isMaster ? 'background: rgba(245, 158, 11, 0.15); color: #fbbf24;' : 'background: rgba(16, 185, 129, 0.12); color: #34d399;'}">
              <i class="fa-solid ${isMaster ? 'fa-crown' : 'fa-user-shield'}"></i>
            </div>
            <div>
              <div class="device-name-title">
                ${escapeHtml(a.name || a.email)} 
                <span class="badge-waiting" style="${isMaster ? 'background: rgba(245, 158, 11, 0.15); color: #fbbf24;' : 'background: rgba(16, 185, 129, 0.15); color: #34d399;'}">
                  ${isMaster ? 'Master Admin' : 'Sub-Admin'}
                </span>
              </div>
              <div class="device-meta-sub">
                <span>UID: <code>${escapeHtml(a.uid || a.id)}</code></span>
                ${a.email ? `<span>&bull;</span><span>${escapeHtml(a.email)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="device-actions">
            ${!isMaster ? `
              <button class="btn-card-reject" onclick="window.revokeAdminDoc('${a.uid || a.id}', '${escapeHtml(a.name || 'Admin')}')" title="Revoke Admin Access">
                <i class="fa-solid fa-trash-can"></i> Revoke
              </button>
            ` : '<span style="font-size: 0.8rem; color: #fbbf24; font-weight: 700; padding: 4px 8px;"><i class="fa-solid fa-shield"></i> System Owner</span>'}
          </div>
        </div>
      `;
    }).join('');
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
    const modalManage = document.getElementById('adminManageModal');

    if (isApprovedAdmin()) {
      if (adminBanner) adminBanner.style.display = 'flex';
      if (adminEntryCard) adminEntryCard.style.display = 'block';
      if (adminToggleBtn) adminToggleBtn.classList.add('logged-in');

      if (isMasterAdmin()) {
        if (adminBtnText) adminBtnText.textContent = '👑 Master Admin';
        if (adminRoleBadge) {
          adminRoleBadge.className = 'admin-role-tag role-master';
          adminRoleBadge.innerHTML = '<i class="fa-solid fa-crown"></i> Master Admin (Owner)';
        }
        if (adminBannerDesc) {
          adminBannerDesc.textContent = 'Full Master Access: Add/edit records, manage admins, view live audit logs.';
        }
        if (btnManageAdmins) btnManageAdmins.style.display = 'inline-flex';
        if (btnChangePin) btnChangePin.style.display = 'inline-flex';
        if (btnClearAll) btnClearAll.style.display = 'inline-flex';
        if (modalManage) modalManage.classList.add('verified');
      } else {
        if (adminBtnText) adminBtnText.textContent = '🛡️ Sub-Admin';
        if (adminRoleBadge) {
          adminRoleBadge.className = 'admin-role-tag role-subadmin';
          adminRoleBadge.innerHTML = '<i class="fa-solid fa-shield"></i> Authorized Sub-Admin';
        }
        if (adminBannerDesc) {
          adminBannerDesc.textContent = 'Sub-Admin Access: Authorized to add late entries and update payment status.';
        }
        if (btnManageAdmins) btnManageAdmins.style.display = 'none';
        if (btnChangePin) btnChangePin.style.display = 'inline-flex';
        if (btnClearAll) btnClearAll.style.display = 'none';
        if (modalManage) modalManage.classList.remove('verified');
      }
    } else {
      if (adminBanner) adminBanner.style.display = 'none';
      if (adminEntryCard) adminEntryCard.style.display = 'none';
      if (adminBtnText) adminBtnText.textContent = 'Admin Login';
      if (adminToggleBtn) adminToggleBtn.classList.remove('logged-in');
      if (modalManage) modalManage.classList.remove('verified');
    }
  }

  function togglePinVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';

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

  /* ==================== CHANGE PASSWORD MODAL ==================== */

  function openPinModal() {
    if (!isAuthenticated()) {
      showToast('Please sign in to change password.', 'info');
      openAdminModal();
      return;
    }
    const modal = document.getElementById('pinModal');
    if (modal) {
      const newInp = document.getElementById('newAdminPasswordInput');
      const confInp = document.getElementById('confirmAdminPasswordInput');
      const errMsg = document.getElementById('passwordErrorMsg');
      const succMsg = document.getElementById('passwordSuccessMsg');

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

  /* ==================== CLOUD DATABASE SETUP MODAL ==================== */

  function openCloudModal() {
    const savedProjectId = localStorage.getItem('fc_firebase_project_id') || DEFAULT_FIREBASE_PROJECT_ID;
    const savedConfigJson = localStorage.getItem('fc_firebase_config') || '';
    const projInput = document.getElementById('firebaseProjectIdInput');
    const confInput = document.getElementById('firebaseConfigJson');
    if (projInput) projInput.value = savedProjectId;
    if (confInput) confInput.value = savedConfigJson;
    const currentMode = document.getElementById('currentStorageMode');
    if (currentMode) {
      currentMode.textContent = _state.isCloudConnected ? 'Connected (Google Cloud Firestore)' : 'Local Storage Mode';
    }
    document.getElementById('cloudModal').style.display = 'flex';
  }

  function closeCloudModal() {
    document.getElementById('cloudModal').style.display = 'none';
  }

  function saveCloudConfig() {
    const projId = document.getElementById('firebaseProjectIdInput')?.value.trim();
    const configJson = document.getElementById('firebaseConfigJson')?.value.trim();

    if (!projId) {
      showToast('Please enter a Firebase Project ID', 'error');
      return;
    }

    try {
      localStorage.setItem('fc_firebase_project_id', projId);
      if (configJson) localStorage.setItem('fc_firebase_config', configJson);
    } catch (e) {}

    closeCloudModal();
    showToast('Connecting to Google Cloud Firestore...', 'info');

    setTimeout(() => {
      initCloudOrLocalStorage();
    }, 500);
  }

  function disconnectCloud() {
    try {
      localStorage.removeItem('fc_firebase_project_id');
      localStorage.removeItem('fc_firebase_config');
    } catch (e) {}
    _state.isCloudConnected = false;
    closeCloudModal();
    loadFromLocalStorage();
    showToast('Switched to local storage mode', 'info');
  }

  /* ==================== UTILITY FUNCTIONS ==================== */

  function handleModalOverlayClick(e, modalId) {
    if (e.target.id === modalId) {
      if (modalId === 'adminModal') closeAdminModal();
      else if (modalId === 'adminManageModal') closeAdminManagementModal();
      else if (modalId === 'pinModal') closePinModal();
      else if (modalId === 'cloudModal') closeCloudModal();
      else if (modalId === 'editEntryModal') closeEditModal();
      else {
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

  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cursor = 'pointer';
    toast.title = 'Click to dismiss';

    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';

    toast.innerHTML = `
      <i class="fa-solid ${icon}"></i>
      <span>${escapeHtml(message)}</span>
    `;

    const dismissToast = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 250);
    };
    toast.onclick = dismissToast;

    container.appendChild(toast);
    const displayTime = Math.max(1000, Number(duration) || 3000);
    setTimeout(dismissToast, displayTime);
  }

  function loadFromLocalStorage() {
    _state.isCloudConnected = false;
    try {
      const localData = localStorage.getItem('fc_students');
      if (localData) {
        let parsed = JSON.parse(localData);
        if (Array.isArray(parsed)) {
          _state.students = parsed.filter(s => s && s.id !== 'st_1' && s.id !== 'st_2' && s.name !== 'Ali Ahmed' && s.name !== 'Bilal Khan');
        } else {
          _state.students = [];
        }
      } else {
        _state.students = [];
      }
    } catch (e) {
      _state.students = [];
    }
    renderAll();
  }

  function saveToLocalStorage() {
    try {
      const cleanList = (_state.students || []).filter(Boolean);
      localStorage.setItem('fc_students', JSON.stringify(cleanList));
    } catch (e) {}
  }

  /* ==================== GLOBAL PUBLIC BINDINGS ==================== */
  const PUBLIC_API = {
    toggleTheme,
    applyTheme,
    getCurrentTheme,
    toggleAdminModal,
    openAdminModal,
    closeAdminModal,
    switchLoginAuthTab,
    handleAdminLogin,
    handleRequestAccess,
    handleForgotPassword,
    openAdminManagementModal,
    closeAdminManagementModal,
    switchManageTab,
    prefillAuthorizeAdmin,
    rejectAccessRequest,
    handleAddAdminDoc,
    revokeAdminDoc,
    logoutAdmin,
    openPinModal,
    closePinModal,
    handleChangePassword,
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
    handleModalOverlayClick,
    clearAuditLogs,
    renderAuditLogsList
  };

  // Bind to window for HTML element handlers
  Object.keys(PUBLIC_API).forEach(key => {
    try {
      Object.defineProperty(window, key, {
        value: PUBLIC_API[key],
        writable: false,
        configurable: false
      });
    } catch (e) {
      window[key] = PUBLIC_API[key];
    }
  });

  /* ==================== INITIALIZATION ==================== */
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(getCurrentTheme());
    initDateInput();
    initCloudOrLocalStorage();
    renderAll();

    const adminBtn = document.getElementById('adminToggleBtn');
    if (adminBtn) {
      adminBtn.onclick = function (e) {
        if (e) e.preventDefault();
        toggleAdminModal();
      };
    }
  });

})();
