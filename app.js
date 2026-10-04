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
  adminPin: '9922', // Default Master PIN
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
  loadAdminState();
  initDateInput();
  initCloudOrLocalStorage();
  renderAll();
});

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

/* ==================== ADMIN STATE ==================== */

function loadAdminState() {
  const savedPin = localStorage.getItem('fc_admin_pin');
  if (savedPin) {
    STATE.adminPin = savedPin;
  }

  const sessionAdmin = sessionStorage.getItem('fc_is_admin');
  if (sessionAdmin === 'true') {
    STATE.isAdmin = true;
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

      // Realtime listener for cross-device synchronization
      STATE.firebaseDb.ref('students').on('value', (snapshot) => {
        const val = snapshot.val();
        if (val) {
          STATE.students = Array.isArray(val) ? val : Object.keys(val).map(key => ({ ...val[key], id: val[key].id || key }));
        } else {
          STATE.students = [];
        }
        renderAll();
      }, (error) => {
        console.warn('Cloud sync error, falling back to local:', error);
        loadFromLocalStorage();
      });

      return;
    } catch (err) {
      console.warn('Firebase init error:', err);
    }
  }

  loadFromLocalStorage();
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
  if (STATE.isCloudConnected && STATE.firebaseDb) {
    STATE.firebaseDb.ref('students').set(STATE.students)
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
    localStorage.setItem('fc_students', JSON.stringify(STATE.students));
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

function toggleAdminModal() {
  if (STATE.isAdmin) {
    const entryCard = document.getElementById('adminEntryCard');
    if (entryCard) entryCard.scrollIntoView({ behavior: 'smooth' });
  } else {
    document.getElementById('adminModal').style.display = 'flex';
    document.getElementById('loginErrorMsg').style.display = 'none';
    const pinInput = document.getElementById('adminPinInput');
    pinInput.value = '';
    pinInput.focus();
  }
}

function closeAdminModal() {
  document.getElementById('adminModal').style.display = 'none';
}

function handleAdminLogin() {
  const pinInput = document.getElementById('adminPinInput');
  const errorMsg = document.getElementById('loginErrorMsg');
  const enteredPin = pinInput.value.trim();

  if (enteredPin === STATE.adminPin) {
    STATE.isAdmin = true;
    sessionStorage.setItem('fc_is_admin', 'true');
    closeAdminModal();
    updateAdminUI();
    renderAll();
    showToast('Admin access granted', 'success');
  } else {
    errorMsg.textContent = 'Incorrect PIN! Access denied.';
    errorMsg.style.display = 'block';
  }
}

function logoutAdmin() {
  STATE.isAdmin = false;
  sessionStorage.removeItem('fc_is_admin');
  updateAdminUI();
  renderAll();
  showToast('Logged out of Admin mode', 'info');
}

function updateAdminUI() {
  const adminBanner = document.getElementById('adminBanner');
  const adminEntryCard = document.getElementById('adminEntryCard');
  const adminBtnText = document.getElementById('adminBtnText');
  const adminToggleBtn = document.getElementById('adminToggleBtn');

  if (STATE.isAdmin) {
    if (adminBanner) adminBanner.style.display = 'flex';
    if (adminEntryCard) adminEntryCard.style.display = 'block';
    if (adminBtnText) adminBtnText.textContent = 'Admin Active';
    if (adminToggleBtn) adminToggleBtn.classList.add('logged-in');
  } else {
    if (adminBanner) adminBanner.style.display = 'none';
    if (adminEntryCard) adminEntryCard.style.display = 'none';
    if (adminBtnText) adminBtnText.textContent = 'Admin Login';
    if (adminToggleBtn) adminToggleBtn.classList.remove('logged-in');
  }
}

function togglePinVisibility(inputId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById('adminPinEyeIcon');
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) { icon.classList.remove('fa-eye'); icon.classList.add('fa-eye-slash'); }
  } else {
    input.type = 'password';
    if (icon) { icon.classList.remove('fa-eye-slash'); icon.classList.add('fa-eye'); }
  }
}

/* ==================== PIN CHANGE MODAL ==================== */

function openPinModal() {
  document.getElementById('currentPinInput').value = '';
  document.getElementById('newPinInput').value = '';
  document.getElementById('confirmNewPinInput').value = '';
  document.getElementById('pinErrorMsg').style.display = 'none';
  document.getElementById('pinSuccessMsg').style.display = 'none';
  document.getElementById('pinModal').style.display = 'flex';
}

function closePinModal() {
  document.getElementById('pinModal').style.display = 'none';
}

function handleChangePin() {
  const currentPin = document.getElementById('currentPinInput').value.trim();
  const newPin = document.getElementById('newPinInput').value.trim();
  const confirmPin = document.getElementById('confirmNewPinInput').value.trim();
  const errBox = document.getElementById('pinErrorMsg');
  const succBox = document.getElementById('pinSuccessMsg');

  errBox.style.display = 'none';
  succBox.style.display = 'none';

  if (currentPin !== STATE.adminPin) {
    errBox.textContent = 'Current master PIN is incorrect';
    errBox.style.display = 'block';
    return;
  }

  if (newPin.length < 4 || newPin.length > 12) {
    errBox.textContent = 'New PIN must be between 4 and 12 characters';
    errBox.style.display = 'block';
    return;
  }

  if (newPin !== confirmPin) {
    errBox.textContent = 'PIN confirmation does not match';
    errBox.style.display = 'block';
    return;
  }

  STATE.adminPin = newPin;
  localStorage.setItem('fc_admin_pin', newPin);
  succBox.textContent = 'PIN updated successfully';
  succBox.style.display = 'block';

  setTimeout(() => {
    closePinModal();
    showToast('Admin PIN updated', 'success');
  }, 1000);
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
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return isoDate;
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
