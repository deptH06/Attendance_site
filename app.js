/* =========================================================
   ATTENDFLOW - APPLICATION STATE & LOCALSTORAGE ENGINE
========================================================= */

const STORAGE_KEYS = {
  USER: "attendflow_current_user",
  USERS: "attendflow_users_db",
  SUBJECTS: "attendflow_subjects_db",
  LOGS: "attendflow_logs_db",
  TIMETABLE: "attendflow_timetable_meta",
  TIMETABLE_IMG: "attendflow_timetable_image"
};

let currentUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.USER)) || null;
let isRegisterMode = false;
let cameraStream = null;

// Initial Default Subjects Seed
const DEFAULT_SUBJECTS = [
  { id: "sub_1", name: "Data Structures & Algorithms", code: "CS-201" },
  { id: "sub_2", name: "Database Management Systems", code: "CS-202" },
  { id: "sub_3", name: "Operating Systems", code: "CS-203" },
  { id: "sub_4", name: "Linear Algebra & Calculus", code: "MATH-102" }
];

/* =========================================================
   DOM ELEMENTS SELECTORS
========================================================= */
const authSection = document.getElementById("auth-section");
const dashboardSection = document.getElementById("dashboard-section");
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const toggleAuthBtn = document.getElementById("toggle-auth-btn");
const nameGroup = document.getElementById("name-field-group");
const userEmailInput = document.getElementById("user-email");
const userPassInput = document.getElementById("user-password");
const regNameInput = document.getElementById("reg-name");
const authSubmitBtn = document.getElementById("auth-submit-btn");

const displayUserName = document.getElementById("display-user-name");
const avatarInitials = document.getElementById("avatar-initials");
const logoutBtn = document.getElementById("logout-btn");
const navTabs = document.querySelectorAll(".nav-tab");
const tabPanes = document.querySelectorAll(".tab-pane");

const attendanceDatePicker = document.getElementById("attendance-date");
const subjectsContainer = document.getElementById("subjects-container");
const overallBadge = document.getElementById("overall-badge");

// Subject Modal
const addSubModal = document.getElementById("add-sub-modal");
const openAddSubBtn = document.getElementById("open-add-sub-modal");
const closeSubModalBtn = document.getElementById("close-sub-modal");
const addSubjectForm = document.getElementById("add-subject-form");

// Timetable & Camera Elements
const openCameraBtn = document.getElementById("open-camera-btn");
const cameraModal = document.getElementById("camera-modal");
const cameraFeed = document.getElementById("camera-feed");
const cameraCanvas = document.getElementById("camera-canvas");
const snapBtn = document.getElementById("snap-btn");
const closeCameraBtn = document.getElementById("close-camera-btn");
const timetablePreview = document.getElementById("timetable-preview");
const capturedImageWrap = document.getElementById("captured-image-wrap");
const clearImgBtn = document.getElementById("clear-img-btn");
const timetableRows = document.getElementById("timetable-rows");

// Calculator Elements
const calcAttended = document.getElementById("calc-attended");
const calcTotal = document.getElementById("calc-total");
const calcTarget = document.getElementById("calc-target");
const calculateBtn = document.getElementById("calculate-btn");
const calcResult = document.getElementById("calc-result");

/* =========================================================
   INITIALIZATION
========================================================= */
function init() {
  // Set default date to today's date (YYYY-MM-DD)
  const today = new Date().toISOString().split("T")[0];
  attendanceDatePicker.value = today;

  if (currentUser) {
    showDashboard();
  } else {
    showAuth();
  }

  initDefaultSubjects();
  setupEventListeners();
}

function initDefaultSubjects() {
  const existing = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
  if (!existing) {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(DEFAULT_SUBJECTS));
  }
}

/* =========================================================
   AUTHENTICATION LOGIC
========================================================= */
function showAuth() {
  dashboardSection.classList.remove("active");
  authSection.classList.add("active");
}

function showDashboard() {
  authSection.classList.remove("active");
  dashboardSection.classList.add("active");
  
  displayUserName.textContent = currentUser.name || "Student";
  const initials = currentUser.name
    ? currentUser.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : "ST";
  avatarInitials.textContent = initials;

  renderDashboardData();
  renderTimetable();
  loadSavedTimetableImage();
}

toggleAuthBtn.addEventListener("click", (e) => {
  e.preventDefault();
  isRegisterMode = !isRegisterMode;
  if (isRegisterMode) {
    authTitle.textContent = "Create Account";
    authSubtitle.textContent = "Sign up to track your academic journey";
    nameGroup.style.display = "flex";
    regNameInput.required = true;
    authSubmitBtn.textContent = "Create Account";
    toggleAuthBtn.textContent = "Sign in instead";
  } else {
    authTitle.textContent = "Welcome Back";
    authSubtitle.textContent = "Log in using your student Gmail credentials";
    nameGroup.style.display = "none";
    regNameInput.required = false;
    authSubmitBtn.textContent = "Sign In";
    toggleAuthBtn.textContent = "Create an account";
  }
});

authForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = userEmailInput.value.trim().toLowerCase();
  const pass = userPassInput.value;

  if (!email.endsWith("@gmail.com")) {
    alert("Please sign in with a valid Gmail address (@gmail.com).");
    return;
  }

  let users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];

  if (isRegisterMode) {
    const name = regNameInput.value.trim();
    if (users.find(u => u.email === email)) {
      alert("Account already exists with this Gmail address. Please login.");
      return;
    }
    const newUser = { email, password: pass, name };
    users.push(newUser);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    currentUser = newUser;
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(newUser));
    showDashboard();
  } else {
    const userMatch = users.find(u => u.email === email && u.password === pass);
    if (userMatch) {
      currentUser = userMatch;
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(currentUser));
      showDashboard();
    } else {
      alert("Invalid Gmail or password. If you are new, click 'Create an account'.");
    }
  }
});

logoutBtn.addEventListener("click", (e) => {
  e.preventDefault();
  currentUser = null;
  localStorage.removeItem(STORAGE_KEYS.USER);
  showAuth();
});

/* =========================================================
   NAVIGATION TABS CONTROLLER
========================================================= */
navTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    navTabs.forEach(t => t.classList.remove("active"));
    tabPanes.forEach(p => p.classList.remove("active"));

    tab.classList.add("active");
    const targetId = tab.getAttribute("data-view");
    document.getElementById(targetId).classList.add("active");
  });
});

/* =========================================================
   CORE ATTENDANCE ENGINE & 75% METRICS
========================================================= */
function getAttendanceLogs() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGS)) || {};
}

function saveAttendanceLogs(logs) {
  localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
}

function getSubjects() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBJECTS)) || [];
}

/**
 * Calculates classes required to reach 75% criteria.
 * Formula: (attended + X) / (total + X) >= 0.75
 * => X >= (0.75 * total - attended) / (1 - 0.75) = (3*total - 4*attended)
 */
function calculateClassesNeeded(attended, total, targetPct = 75) {
  if (total === 0) return 0;
  const currentPct = (attended / total) * 100;
  if (currentPct >= targetPct) return 0;

  const targetDecimal = targetPct / 100;
  const required = Math.ceil((targetDecimal * total - attended) / (1 - targetDecimal));
  return required > 0 ? required : 0;
}

function renderDashboardData() {
  const subjects = getSubjects();
  const logs = getAttendanceLogs();
  const selectedDate = attendanceDatePicker.value;

  subjectsContainer.innerHTML = "";

  let totalAttendedAll = 0;
  let totalHeldAll = 0;

  subjects.forEach(subject => {
    // Tally historical counts for this subject
    let attendedCount = 0;
    let totalHeld = 0;

    // Check all recorded dates
    for (const [dateKey, dayRecords] of Object.entries(logs)) {
      const status = dayRecords[subject.id];
      if (status === "present") {
        attendedCount++;
        totalHeld++;
      } else if (status === "absent") {
        totalHeld++;
      }
      // 'holiday' is ignored in total held classes
    }

    const percentage = totalHeld > 0 ? ((attendedCount / totalHeld) * 100).toFixed(1) : 100.0;
    const isBelow75 = parseFloat(percentage) < 75.0 && totalHeld > 0;
    const neededClasses = calculateClassesNeeded(attendedCount, totalHeld, 75);

    totalAttendedAll += attendedCount;
    totalHeldAll += totalHeld;

    // Status on currently selected date
    const currentDateStatus = logs[selectedDate]?.[subject.id] || null;

    // Build subject card element
    const card = document.createElement("div");
    card.className = `glass-panel subject-card ${isBelow75 ? "low-attendance" : ""}`;

    card.innerHTML = `
      <div class="subject-top-row">
        <div class="subject-info">
          <h4>${subject.name}</h4>
          <span>${subject.code} ${isBelow75 ? "• ⚠️ Criteria Breached" : ""}</span>
        </div>
        <div class="pct-pill">${percentage}%</div>
      </div>

      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${Math.min(percentage, 100)}%;"></div>
      </div>

      <div class="subject-bottom-row">
        <div class="subject-metrics">
          <span class="stat-item">Attended: <strong>${attendedCount} / ${totalHeld}</strong></span>
          <span class="stat-item" style="margin-left: 12px;">
            Target 75%: 
            <span class="target-stat ${isBelow75 ? "warning" : ""}">
              ${neededClasses > 0 ? `Attend next <strong>${neededClasses}</strong> classes` : "Safe Zone"}
            </span>
          </span>
        </div>

        <div class="attendance-actions" data-subject-id="${subject.id}">
          <button class="action-btn ${currentDateStatus === 'present' ? 'active-p' : ''}" data-status="present">Present</button>
          <button class="action-btn ${currentDateStatus === 'absent' ? 'active-a' : ''}" data-status="absent">Absent</button>
          <button class="action-btn ${currentDateStatus === 'holiday' ? 'active-h' : ''}" data-status="holiday">Holiday</button>
        </div>
      </div>
    `;

    subjectsContainer.appendChild(card);
  });

  // Calculate & update overall average indicator
  const overallAvg = totalHeldAll > 0 ? ((totalAttendedAll / totalHeldAll) * 100).toFixed(1) : 100;
  overallBadge.textContent = `Overall: ${overallAvg}%`;
  overallBadge.style.color = overallAvg < 75 ? "var(--danger)" : "var(--accent-cyan)";
}

// Attendance Selection Handlers
subjectsContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("action-btn")) {
    const btn = e.target;
    const actionWrap = btn.closest(".attendance-actions");
    const subjectId = actionWrap.getAttribute("data-subject-id");
    const status = btn.getAttribute("data-status");
    const selectedDate = attendanceDatePicker.value;

    if (!selectedDate) {
      alert("Please select a valid date first.");
      return;
    }

    const logs = getAttendanceLogs();
    if (!logs[selectedDate]) logs[selectedDate] = {};

    // Toggle logic: click active status resets it
    if (logs[selectedDate][subjectId] === status) {
      delete logs[selectedDate][subjectId];
    } else {
      logs[selectedDate][subjectId] = status;
    }

    saveAttendanceLogs(logs);
    renderDashboardData();
  }
});

attendanceDatePicker.addEventListener("change", renderDashboardData);

/* =========================================================
   MODAL ADD SUBJECT LOGIC
========================================================= */
openAddSubBtn.addEventListener("click", () => addSubModal.classList.add("show"));
closeSubModalBtn.addEventListener("click", () => addSubModal.classList.remove("show"));

addSubjectForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("new-sub-name").value.trim();
  const code = document.getElementById("new-sub-code").value.trim();

  if (name && code) {
    const subjects = getSubjects();
    const newSubject = { id: "sub_" + Date.now(), name, code };
    subjects.push(newSubject);
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    
    addSubjectForm.reset();
    addSubModal.classList.remove("show");
    renderDashboardData();
  }
});

/* =========================================================
   TIMETABLE & CAMERA INTEGRATION
========================================================= */
function renderTimetable() {
  const defaultEntries = [
    { day: "Monday", time: "09:00 - 10:30 AM", subject: "Data Structures", room: "Lab 2" },
    { day: "Tuesday", time: "11:00 - 12:30 PM", subject: "Operating Systems", room: "Hall B" },
    { day: "Wednesday", time: "10:00 - 11:30 AM", subject: "Database Systems", room: "Hall A" },
    { day: "Thursday", time: "01:30 - 03:00 PM", subject: "Linear Algebra", room: "Room 105" }
  ];

  const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.TIMETABLE)) || defaultEntries;
  timetableRows.innerHTML = stored.map(entry => `
    <tr>
      <td><strong>${entry.day}</strong></td>
      <td>${entry.time}</td>
      <td>${entry.subject}</td>
      <td>${entry.room}</td>
    </tr>
  `).join("");
}

openCameraBtn.addEventListener("click", async () => {
  cameraModal.style.display = "flex";
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } }
    });
    cameraFeed.srcObject = cameraStream;
  } catch (err) {
    alert("Camera access denied or unavailable: " + err.message);
    cameraModal.style.display = "none";
  }
});

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  cameraModal.style.display = "none";
}

closeCameraBtn.addEventListener("click", stopCamera);

snapBtn.addEventListener("click", () => {
  if (!cameraStream) return;
  cameraCanvas.width = cameraFeed.videoWidth;
  cameraCanvas.height = cameraFeed.videoHeight;
  const ctx = cameraCanvas.getContext("2d");
  ctx.drawImage(cameraFeed, 0, 0, cameraCanvas.width, cameraCanvas.height);

  const imgData = cameraCanvas.toDataURL("image/png");
  localStorage.setItem(STORAGE_KEYS.TIMETABLE_IMG, imgData);
  loadSavedTimetableImage();
  stopCamera();
});

function loadSavedTimetableImage() {
  const savedImage = localStorage.getItem(STORAGE_KEYS.TIMETABLE_IMG);
  if (savedImage) {
    timetablePreview.src = savedImage;
    capturedImageWrap.style.display = "block";
  } else {
    capturedImageWrap.style.display = "none";
  }
}

clearImgBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEYS.TIMETABLE_IMG);
  loadSavedTimetableImage();
});

document.getElementById("open-manual-tt-btn").addEventListener("click", () => {
  const day = prompt("Enter Day (e.g. Friday):");
  const time = prompt("Enter Time Slot (e.g. 10:00 - 11:30 AM):");
  const subject = prompt("Enter Subject Name:");
  const room = prompt("Enter Room/Lab No:");

  if (day && time && subject) {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.TIMETABLE)) || [];
    stored.push({ day, time, subject, room: room || "N/A" });
    localStorage.setItem(STORAGE_KEYS.TIMETABLE, JSON.stringify(stored));
    renderTimetable();
  }
});

/* =========================================================
   ATTENDANCE SIMULATION CALCULATOR
========================================================= */
calculateBtn.addEventListener("click", () => {
  const attended = parseInt(calcAttended.value, 10);
  const total = parseInt(calcTotal.value, 10);
  const target = parseFloat(calcTarget.value);

  if (isNaN(attended) || isNaN(total) || isNaN(target) || total <= 0 || attended > total) {
    alert("Please enter valid positive numbers where attended does not exceed total classes.");
    return;
  }

  const currentPct = ((attended / total) * 100).toFixed(1);
  calcResult.style.display = "block";

  if (currentPct >= target) {
    // Calculate how many classes user can skip and still stay above target
    // (attended) / (total + S) >= target/100  => S <= (attended / targetDecimal) - total
    const targetDecimal = target / 100;
    const canSkip = Math.floor((attended / targetDecimal) - total);
    
    calcResult.innerHTML = `
      <h4 style="color: var(--success); margin-bottom: 6px;">🎉 Criteria Fulfilled!</h4>
      <p>Your current attendance is <strong>${currentPct}%</strong>.</p>
      <p style="margin-top: 4px;">You can safely skip up to <strong>${canSkip > 0 ? canSkip : 0}</strong> upcoming class(es) while staying above ${target}%.</p>
    `;
  } else {
    const needed = calculateClassesNeeded(attended, total, target);
    calcResult.innerHTML = `
      <h4 style="color: #f87171; margin-bottom: 6px;">⚠️ Attendance Shortage</h4>
      <p>Your current attendance is <strong>${currentPct}%</strong>.</p>
      <p style="margin-top: 4px;">You must attend the next <strong>${needed}</strong> consecutive class(es) to regain the ${target}% requirement.</p>
    `;
  }
});

function setupEventListeners() {
  window.addEventListener("click", (e) => {
    if (e.target === addSubModal) {
      addSubModal.classList.remove("show");
    }
  });
}

// Run App
init();