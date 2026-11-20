// Valfritt: klistra in din Google Apps Script-länk (/exec) här
const DEFAULT_APPS_SCRIPT_URL = "";

const TODAY_STR = new Date().toISOString().split("T")[0];

// Standarddatabas (speglar database.json v2)
const FALLBACK_DATABASE = {
  version: 2,
  users: [
    { id: "u1", username: "alex.elev", password: "elev123", name: "Alex Andersson", role: "student", class: "NA24A" },
    { id: "u5", username: "sara.elev", password: "elev123", name: "Sara Svensson", role: "student", class: "NA24A" },
    { id: "u6", username: "liam.elev", password: "elev123", name: "Liam Lindberg", role: "student", class: "TE24B" },
    { id: "u2", username: "anna.larare", password: "larare123", name: "Anna Lindqvist", role: "teacher", subject: "Matematik 3c" },
    { id: "u3", username: "johan.larare", password: "larare123", name: "Johan Bergström", role: "teacher", subject: "Programmering 1" },
    { id: "u4", username: "admin", password: "admin123", name: "Systemadministratör", role: "admin" }
  ],
  courses: [
    { id: "c1", name: "Matematik 3c", section: "NA24A", teacher: "Anna Lindqvist", color: "#1a73e8", link: "https://classroom.google.com" },
    { id: "c2", name: "Programmering 1", section: "TE24B", teacher: "Johan Bergström", color: "#1e8e3e", link: "https://classroom.google.com" },
    { id: "c3", name: "Svenska 2", section: "NA24A", teacher: "Maria Ek", color: "#d93025", link: "https://classroom.google.com" },
    { id: "c4", name: "Engelska 6", section: "NA24A", teacher: "David Miller", color: "#e37400", link: "https://classroom.google.com" }
  ],
  assignments: [
    {
      id: "a1",
      courseId: "c1",
      title: "Inlämningsuppgift: Derivata och extremvärden",
      description: "Lös uppgift 1–6 i bifogat dokument och ladda upp tydliga uträkningar.",
      dueDate: TODAY_STR,
      completed: false,
      link: "https://classroom.google.com"
    },
    {
      id: "a2",
      courseId: "c2",
      title: "Webbprojekt: Study Hub med JSON-databas",
      description: "Bygg roller för elev, lärare och admin med dynamisk datalagring.",
      dueDate: TODAY_STR,
      completed: false,
      link: "https://classroom.google.com"
    },
    {
      id: "a3",
      courseId: "c3",
      title: "Krönika: Språket i sociala medier",
      description: "Skriv en argumenterande krönika på 600–800 ord i Google Docs.",
      dueDate: "2026-11-24",
      completed: false,
      link: "https://classroom.google.com"
    }
  ],
  grades: [
    { id: "g1", studentId: "u1", studentName: "Alex Andersson", course: "Matematik 3c", points: 100, grade: "B", teacher: "Anna Lindqvist", comment: "Starkt resultat på derivata-provet." },
    { id: "g2", studentId: "u1", studentName: "Alex Andersson", course: "Programmering 1", points: 100, grade: "A", teacher: "Johan Bergström", comment: "Välstrukturerad kod i webbutvecklingsprojektet." },
    { id: "g3", studentId: "u1", studentName: "Alex Andersson", course: "Svenska 2", points: 100, grade: "C", teacher: "Maria Ek", comment: "Bra analys i litteraturseminariet." },
    { id: "g4", studentId: "u5", studentName: "Sara Svensson", course: "Matematik 3c", points: 100, grade: "A", teacher: "Anna Lindqvist", comment: "Mycket god problemlösningsförmåga." },
    { id: "g5", studentId: "u5", studentName: "Sara Svensson", course: "Programmering 1", points: 100, grade: "B", teacher: "Johan Bergström", comment: "Snygg gränssnittsdesign och fungerande API-koppling." },
    { id: "g6", studentId: "u5", studentName: "Sara Svensson", course: "Svenska 2", points: 100, grade: "A", teacher: "Maria Ek", comment: "Välformulerad och träffsäker krönika." },
    { id: "g7", studentId: "u6", studentName: "Liam Lindberg", course: "Matematik 3c", points: 100, grade: "C", teacher: "Anna Lindqvist", comment: "Godkänd på samtliga delmoment." },
    { id: "g8", studentId: "u6", studentName: "Liam Lindberg", course: "Programmering 1", points: 100, grade: "A", teacher: "Johan Bergström", comment: "Utmärkt struktur i JavaScript-logiken." },
    { id: "g9", studentId: "u6", studentName: "Liam Lindberg", course: "Engelska 6", points: 100, grade: "B", teacher: "David Miller", comment: "Stark muntlig presentation." }
  ],
  announcements: [
    { id: "m1", title: "Temavecka", text: "Imorgon är det pyjamas- och mysig tröja-dag.", author: "Elevkåren" },
    { id: "m2", title: "Bibliotekets öppettider", text: "Mediecentret stänger kl. 16:00 idag på grund av ett läraremöte.", author: "Skolexpeditionen" }
  ],
  lunchMenu: {
    "Måndag": "Örtstekt kyckling med potatismos / Kikärtscurry med ris",
    "Tisdag": "Spaghetti med köttfärssås / Sojafärssås & parmesan",
    "Onsdag": "Panerad torskfilé med remouladsås / Krispiga grönsaksbiffar",
    "Torsdag": "Ärtsoppa & pannkakor / Vegetarisk linssoppa & pannkakor",
    "Fredag": "Tacobuffé med tillbehör / Vegofärs-tacos"
  }
};

let db = null;
let emails = JSON.parse(localStorage.getItem("studyhub_emails")) || [];
let driveFiles = JSON.parse(localStorage.getItem("studyhub_drive_files")) || [];
let completedIds = JSON.parse(localStorage.getItem("studyhub_completed_ids")) || [];
let appsScriptUrl = localStorage.getItem("studyhub_apps_script_url") || DEFAULT_APPS_SCRIPT_URL;
let currentClassroomFilter = "todo";
let selectedCourseId = "all";
let selectedTeacherStudentId = null;

function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Databasinitiering ---
async function initDatabase() {
  const saved = localStorage.getItem("studyhub_db");
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed && parsed.version >= 2) {
      db = parsed;
      return;
    }
  }

  try {
    const res = await fetch("database.json");
    if (res.ok) {
      db = await res.json();
    } else {
      db = structuredClone(FALLBACK_DATABASE);
    }
  } catch {
    db = structuredClone(FALLBACK_DATABASE);
  }
  saveDatabase();
}

function saveDatabase() {
  localStorage.setItem("studyhub_db", JSON.stringify(db));
  localStorage.setItem("studyhub_completed_ids", JSON.stringify(completedIds));
}

// --- Autentisering & Roller ---
function getCurrentUser() {
  const raw = localStorage.getItem("studyhub_session");
  if (!raw) return null;
  try {
    const session = JSON.parse(raw);
    return db.users.find(u => u.id === session.id) || null;
  } catch {
    return null;
  }
}

function loginUser(username, password) {
  const user = db.users.find(
    u => u.username.toLowerCase() === username.trim().toLowerCase() && u.password === password
  );
  if (!user) return null;
  localStorage.setItem("studyhub_session", JSON.stringify({ id: user.id }));
  return user;
}

function logoutUser() {
  localStorage.removeItem("studyhub_session");
  window.location.href = "login.html";
}

function getRoleLabel(role) {
  if (role === "admin") return { text: "Admin", cls: "role-admin" };
  if (role === "teacher") return { text: "Lärare", cls: "role-teacher" };
  return { text: "Elev", cls: "role-student" };
}

function renderAuthHeader() {
  const container = document.getElementById("authHeaderStatus");
  if (!container) return;

  const user = getCurrentUser();
  if (user) {
    const roleInfo = getRoleLabel(user.role);
    container.innerHTML = `
      <span class="role-badge ${roleInfo.cls}">${roleInfo.text}</span>
      <strong>${escapeHTML(user.name)}</strong>
      <button class="btn btn-outline btn-sm" onclick="logoutUser()">Logga ut</button>
    `;
  } else {
    container.innerHTML = `
      <span style="color:var(--text-muted);">Ej inloggad</span>
      <a href="login.html" class="btn btn-primary btn-sm">Logga in</a>
    `;
  }
}

function updateHeaderBadges() {
  const pending = db.assignments.filter(a => !a.completed);
  const dueTodayCount = pending.filter(a => a.dueDate === TODAY_STR).length;

  const badgeEl = document.getElementById("classroomBadge");
  if (badgeEl) badgeEl.textContent = pending.length;

  const dueEl = document.getElementById("dueTodayStatus");
  if (dueEl) {
    dueEl.textContent = `Inlämning idag: ${dueTodayCount} ${dueTodayCount === 1 ? "uppgift" : "uppgifter"}`;
  }
}

// --- Hjälpare för kurser & uppgifter ---
function getCourseById(id) {
  return db.courses.find(c => c.id === id) || { name: "Okänd kurs", color: "#1a73e8", teacher: "Lärare" };
}

function formatDueLabel(dateStr, completed) {
  if (completed) return { text: "Inlämnad", cls: "due-done" };
  if (!dateStr) return { text: "Inget slutdatum", cls: "due-upcoming" };
  if (dateStr === TODAY_STR) return { text: "Inlämning idag", cls: "due-today" };
  if (dateStr < TODAY_STR) return { text: `Försenad (${dateStr})`, cls: "due-overdue" };
  return { text: `Deadline: ${dateStr}`, cls: "due-upcoming" };
}

function createAssignmentCardHTML(item) {
  const course = getCourseById(item.courseId);
  const due = formatDueLabel(item.dueDate, item.completed);
  return `
    <article class="assignment-card ${item.completed ? "completed" : ""}">
      <div>
        <div class="assignment-top">
          <span class="course-tag" style="background:${course.color}18; color:${course.color};">${escapeHTML(course.name)}</span>
          <span class="due-tag ${due.cls}">${due.text}</span>
        </div>
        <h4 class="assignment-title" style="margin-top:0.65rem;">${escapeHTML(item.title)}</h4>
        <p class="assignment-desc">${escapeHTML(item.description || "Ingen ytterligare beskrivning.")}</p>
      </div>
      <div class="assignment-footer">
        <a href="${item.link || "https://classroom.google.com"}" target="_blank" rel="noopener noreferrer">Öppna i Classroom ↗</a>
        <button class="btn ${item.completed ? "btn-outline" : "btn-primary"}" onclick="toggleAssignment('${item.id}')">
          ${item.completed ? "Ångra" : "Markera klar"}
        </button>
      </div>
    </article>
  `;
}

// --- Översiktssidan (index.html) ---
function renderOverviewPage() {
  const headingEl = document.getElementById("overviewHeading");
  if (headingEl) {
    const weekdays = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
    const dayName = weekdays[new Date().getDay()];
    headingEl.textContent = `Dagens översikt (${dayName})`;

    const todayLunchEl = document.getElementById("overviewTodayLunch");
    if (todayLunchEl && db.lunchMenu) {
      const menuText = db.lunchMenu[dayName] || db.lunchMenu["Måndag"] || "Ingen matsedel angiven.";
      todayLunchEl.innerHTML = `<li><strong>${dayName}:</strong> ${escapeHTML(menuText)}</li>`;
    }
  }

  const annEl = document.getElementById("overviewAnnouncements");
  if (annEl) {
    annEl.innerHTML = db.announcements.length
      ? db.announcements.map(m => `
          <li>
            <strong>${escapeHTML(m.title)}:</strong> ${escapeHTML(m.text)}
            <small style="display:block; color:var(--text-muted); margin-top:0.2rem;">Publicerat av ${escapeHTML(m.author || "Skolan")}</small>
          </li>
        `).join("")
      : `<li>Inga aktuella meddelanden.</li>`;
  }

  const overviewContainer = document.getElementById("overviewAssignments");
  if (overviewContainer) {
    const pending = db.assignments.filter(a => !a.completed);
    const upcomingThree = [...pending]
      .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
      .slice(0, 3);

    overviewContainer.innerHTML = upcomingThree.length
      ? upcomingThree.map(createAssignmentCardHTML).join("")
      : `<p style="color:var(--text-muted);">Inga kommande uppgifter just nu!</p>`;
  }

  const emailListEl = document.getElementById("overviewEmails");
  if (emailListEl) {
    emailListEl.innerHTML = emails.length
      ? emails.map(mail => `
          <li style="border-left-color: ${mail.unread ? "#d93025" : "#1a73e8"};">
            <div style="display:flex; justify-content:space-between; gap:0.5rem;">
              <strong>${escapeHTML(mail.from)}</strong>
              <small style="color:var(--text-muted);">${escapeHTML(mail.date)}</small>
            </div>
            <a href="${mail.link}" target="_blank" rel="noopener noreferrer" style="color:var(--text); font-weight:600; text-decoration:none;">
              ${escapeHTML(mail.subject)} ↗
            </a>
          </li>
        `).join("")
      : `<li>Koppla Google Apps Script under Classroom-fliken för att visa Gmail här.</li>`;
  }

  const driveListEl = document.getElementById("overviewDriveFiles");
  if (driveListEl) {
    driveListEl.innerHTML = driveFiles.length
      ? driveFiles.map(file => `
          <li style="border-left-color: #1e8e3e;">
            <div style="display:flex; justify-content:space-between; gap:0.5rem;">
              <a href="${file.link}" target="_blank" rel="noopener noreferrer" style="font-weight:600; color:var(--primary); text-decoration:none;">
                ${escapeHTML(file.name)} ↗
              </a>
              <small style="color:var(--text-muted);">${escapeHTML(file.updated)}</small>
            </div>
            <small style="color:var(--text-muted);">${escapeHTML(file.type)}</small>
          </li>
        `).join("")
      : `<li>Koppla Google Apps Script under Classroom-fliken för att visa Drive-filer här.</li>`;
  }
}

// --- Classroom-sidan (classroom.html) ---
function renderClassroomPage() {
  const assignmentsContainer = document.getElementById("classroomAssignmentsContainer");
  const coursesContainer = document.getElementById("classroomCoursesContainer");
  if (!assignmentsContainer || !coursesContainer) return;

  const courseSelect = document.getElementById("courseFilterSelect");
  const newTaskCourseSelect = document.getElementById("newTaskCourse");
  const courseFilterWrapper = document.getElementById("courseFilterWrapper");

  if (courseSelect) {
    const currentVal = courseSelect.value;
    courseSelect.innerHTML = `<option value="all">Alla kurser</option>` +
      db.courses.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");
    courseSelect.value = db.courses.some(c => c.id === currentVal) ? currentVal : selectedCourseId;
  }

  if (newTaskCourseSelect) {
    newTaskCourseSelect.innerHTML = db.courses.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");
  }

  if (currentClassroomFilter === "courses") {
    assignmentsContainer.style.display = "none";
    if (courseFilterWrapper) courseFilterWrapper.style.display = "none";
    coursesContainer.style.display = "grid";

    coursesContainer.innerHTML = db.courses.map(c => {
      const count = db.assignments.filter(a => a.courseId === c.id && !a.completed).length;
      return `
        <div class="course-card">
          <div class="course-banner" style="background:${c.color};">
            <div>${escapeHTML(c.name)}</div>
            <small style="opacity:0.9; font-weight:400;">${escapeHTML(c.section || "")}</small>
          </div>
          <div class="course-body">
            <div><strong>Lärare:</strong> ${escapeHTML(c.teacher || "Ej angiven")}</div>
            <div><strong>Aktiva uppgifter:</strong> ${count} st</div>
            <div style="margin-top:0.5rem; display:flex; gap:0.5rem;">
              <button class="btn btn-outline" onclick="filterByCourse('${c.id}')">Visa uppgifter</button>
              <a href="${c.link || "https://classroom.google.com"}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Öppna ↗</a>
            </div>
          </div>
        </div>
      `;
    }).join("");
  } else {
    coursesContainer.style.display = "none";
    assignmentsContainer.style.display = "grid";
    if (courseFilterWrapper) courseFilterWrapper.style.display = "flex";

    let filtered = [...db.assignments];
    if (currentClassroomFilter === "todo") filtered = filtered.filter(a => !a.completed);
    if (currentClassroomFilter === "done") filtered = filtered.filter(a => a.completed);
    if (selectedCourseId !== "all") filtered = filtered.filter(a => a.courseId === selectedCourseId);

    filtered.sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));

    assignmentsContainer.innerHTML = filtered.length
      ? filtered.map(createAssignmentCardHTML).join("")
      : `<div class="card" style="grid-column:1/-1;"><p>Inga uppgifter matchar valt filter.</p></div>`;
  }
}

// --- Betygssidan (betyg.html) ---
function renderGradesPage() {
  const tbody = document.getElementById("gradesTableBody");
  if (!tbody) return;

  const currentUser = getCurrentUser();
  const students = db.users.filter(u => u.role === "student");
  const targetStudent = (currentUser && currentUser.role === "student")
    ? currentUser
    : (students[0] || { id: "u1", name: "Alex Andersson" });

  const heading = tbody.closest("main")?.querySelector(".section-header h2");
  if (heading) {
    heading.textContent = `Betyg & Betygskatalog – ${targetStudent.name}`;
  }

  const studentGrades = db.grades.filter(
    g => g.studentId === targetStudent.id || (!g.studentId && g.studentName === targetStudent.name)
  );

  tbody.innerHTML = studentGrades.length
    ? studentGrades.map(g => `
        <tr>
          <td><strong>${escapeHTML(g.course)}</strong></td>
          <td>${escapeHTML(g.points)} p</td>
          <td><span class="grade-pill">${escapeHTML(g.grade)}</span></td>
          <td>${escapeHTML(g.teacher)}</td>
          <td>${escapeHTML(g.comment)}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="5">Inga betyg registrerade ännu för ${escapeHTML(targetStudent.name)}.</td></tr>`;
}

// --- Skolinfo & Matsedel (skolinfo.html) ---
function renderSchoolInfoPage() {
  const menuList = document.getElementById("weeklyMenuList");
  if (!menuList || !db.lunchMenu) return;

  menuList.innerHTML = Object.entries(db.lunchMenu).map(([day, dish]) => `
    <li><strong>${escapeHTML(day)}:</strong> ${escapeHTML(dish)}</li>
  `).join("");
}

// --- Inloggningssidan (login.html) ---
function initLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const errorBox = document.getElementById("loginError");

  document.querySelectorAll("[data-quick-user]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.getElementById("loginUsername").value = btn.dataset.quickUser;
      document.getElementById("loginPassword").value = btn.dataset.quickPass;
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const u = document.getElementById("loginUsername").value;
    const p = document.getElementById("loginPassword").value;
    const user = loginUser(u, p);

    if (!user) {
      errorBox.textContent = "Felaktigt användarnamn eller lösenord.";
      errorBox.style.display = "block";
      return;
    }

    if (user.role === "admin") {
      window.location.href = "admin.html";
    } else if (user.role === "teacher") {
      window.location.href = "larare.html";
    } else {
      window.location.href = "index.html";
    }
  });
}

// --- Lärarvy (larare.html) ---
function showTeacherFeedback(message) {
  const box = document.getElementById("teacherGradeFeedback");
  if (!box) return;
  box.textContent = message;
  box.style.display = "block";
  clearTimeout(box._timer);
  box._timer = setTimeout(() => {
    box.style.display = "none";
  }, 3200);
}

function initTeacherPage() {
  const gate = document.getElementById("teacherAuthGate");
  const dashboard = document.getElementById("teacherDashboard");
  if (!gate || !dashboard) return;

  const user = getCurrentUser();
  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    gate.style.display = "block";
    dashboard.style.display = "none";

    const inlineForm = document.getElementById("inlineTeacherLoginForm");
    if (inlineForm) {
      inlineForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const logged = loginUser(
          document.getElementById("inlineTeacherUser").value,
          document.getElementById("inlineTeacherPass").value
        );
        if (logged && (logged.role === "teacher" || logged.role === "admin")) {
          window.location.reload();
        } else {
          document.getElementById("inlineTeacherError").style.display = "block";
        }
      });
    }
    return;
  }

  gate.style.display = "none";
  dashboard.style.display = "block";
  document.getElementById("teacherWelcome").textContent = `Inloggad som ${user.name}`;

  const courseSelect = document.getElementById("teacherTaskCourse");
  courseSelect.innerHTML = db.courses.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");

  // Elevväljare för betygssättning
  const studentSelect = document.getElementById("teacherStudentSelect");
  if (studentSelect) {
    studentSelect.addEventListener("change", (e) => {
      selectedTeacherStudentId = e.target.value;
      renderTeacherLists();
    });
  }

  // Lägg till nytt kursbetyg för vald elev
  const addGradeForm = document.getElementById("teacherAddGradeForm");
  if (addGradeForm) {
    addGradeForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const students = db.users.filter(u => u.role === "student");
      const targetStudent = students.find(s => s.id === selectedTeacherStudentId) || students[0];
      if (!targetStudent) return;

      const courseName = document.getElementById("teacherNewGradeCourse").value;
      const gradeVal = document.getElementById("teacherNewGradeValue").value;
      const commentVal = document.getElementById("teacherNewGradeComment").value.trim();

      // Kontrollera om eleven redan har betyg i denna kurs – uppdatera i så fall
      const existing = db.grades.find(
        g => (g.studentId === targetStudent.id || g.studentName === targetStudent.name) && g.course === courseName
      );

      if (existing) {
        existing.grade = gradeVal;
        existing.comment = commentVal;
        existing.teacher = user.name;
      } else {
        db.grades.push({
          id: "g_" + Date.now(),
          studentId: targetStudent.id,
          studentName: targetStudent.name,
          course: courseName,
          points: 100,
          grade: gradeVal,
          teacher: user.name,
          comment: commentVal
        });
      }

      saveDatabase();
      e.target.reset();
      renderTeacherLists();
      showTeacherFeedback(`Betyg i ${courseName} sparat för ${targetStudent.name}.`);
    });
  }

  // Publicera ny uppgift
  document.getElementById("teacherTaskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    db.assignments.unshift({
      id: "task_" + Date.now(),
      courseId: courseSelect.value,
      title: document.getElementById("teacherTaskTitle").value.trim(),
      description: document.getElementById("teacherTaskDesc").value.trim(),
      dueDate: document.getElementById("teacherTaskDue").value,
      completed: false,
      link: "https://classroom.google.com"
    });
    saveDatabase();
    e.target.reset();
    renderAll();
    renderTeacherLists();
  });

  // Publicera nytt meddelande
  document.getElementById("teacherAnnouncementForm").addEventListener("submit", (e) => {
    e.preventDefault();
    db.announcements.unshift({
      id: "msg_" + Date.now(),
      title: document.getElementById("teacherMsgTitle").value.trim(),
      text: document.getElementById("teacherMsgBody").value.trim(),
      author: user.name
    });
    saveDatabase();
    e.target.reset();
    renderAll();
  });

  renderTeacherLists();
}

function renderTeacherLists() {
  const listEl = document.getElementById("teacherAssignmentsList");
  if (listEl) {
    listEl.innerHTML = db.assignments.map(a => {
      const c = getCourseById(a.courseId);
      return `
        <li>
          <div style="display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
            <div>
              <strong>${escapeHTML(a.title)}</strong> (${escapeHTML(c.name)})
              <small style="display:block; color:var(--text-muted);">Deadline: ${escapeHTML(a.dueDate || "Inget")}</small>
            </div>
            <button class="btn btn-danger btn-sm" onclick="deleteAssignment('${a.id}')">Ta bort</button>
          </div>
        </li>
      `;
    }).join("");
  }

  // Fyll elevdropdown och rendera vald elevs betyg
  const students = db.users.filter(u => u.role === "student");
  const studentSelect = document.getElementById("teacherStudentSelect");
  const studentMeta = document.getElementById("teacherStudentMeta");
  const newGradeCourseSelect = document.getElementById("teacherNewGradeCourse");
  const gradesBody = document.getElementById("teacherGradesBody");

  if (!studentSelect || !gradesBody) return;

  if (students.length === 0) {
    studentSelect.innerHTML = `<option value="">Inga elever registrerade</option>`;
    gradesBody.innerHTML = `<tr><td colspan="6">Lägg till elever i Adminvyn först.</td></tr>`;
    return;
  }

  if (!selectedTeacherStudentId || !students.some(s => s.id === selectedTeacherStudentId)) {
    selectedTeacherStudentId = students[0].id;
  }

  studentSelect.innerHTML = students.map(s => `
    <option value="${s.id}" ${s.id === selectedTeacherStudentId ? "selected" : ""}>
      ${escapeHTML(s.name)} (${escapeHTML(s.class || "Elev")})
    </option>
  `).join("");

  const activeStudent = students.find(s => s.id === selectedTeacherStudentId);
  const studentGrades = db.grades.filter(
    g => g.studentId === activeStudent.id || (!g.studentId && g.studentName === activeStudent.name)
  );

  if (studentMeta) {
    studentMeta.textContent = `${activeStudent.class || "Elev"} • ${studentGrades.length} kurser`;
  }

  if (newGradeCourseSelect) {
    newGradeCourseSelect.innerHTML = db.courses
      .map(c => `<option value="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`)
      .join("");
  }

  const gradeOptions = ["A", "B", "C", "D", "E", "F", "-"];
  gradesBody.innerHTML = studentGrades.length
    ? studentGrades.map(g => `
        <tr>
          <td><strong>${escapeHTML(g.course)}</strong></td>
          <td>${escapeHTML(g.points)} p</td>
          <td>
            <select id="grade_sel_${g.id}">
              ${gradeOptions.map(opt => `<option value="${opt}" ${g.grade === opt ? "selected" : ""}>${opt}</option>`).join("")}
            </select>
          </td>
          <td>
            <input type="text" id="grade_com_${g.id}" value="${escapeHTML(g.comment)}">
          </td>
          <td><small style="color:var(--text-muted);">${escapeHTML(g.teacher)}</small></td>
          <td style="white-space:nowrap;">
            <button class="btn btn-success btn-sm" onclick="saveStudentGrade('${g.id}')">Spara</button>
            <button class="btn btn-danger btn-sm" onclick="deleteStudentGrade('${g.id}')">Ta bort</button>
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="6">Inga betyg registrerade för ${escapeHTML(activeStudent.name)} ännu. Lägg till ett nedan!</td></tr>`;
}

window.deleteAssignment = function(id) {
  db.assignments = db.assignments.filter(a => a.id !== id);
  saveDatabase();
  renderAll();
  renderTeacherLists();
};

window.saveStudentGrade = function(gradeId) {
  const newGrade = document.getElementById(`grade_sel_${gradeId}`).value;
  const newComment = document.getElementById(`grade_com_${gradeId}`).value.trim();
  const user = getCurrentUser();
  let targetStudentName = "";

  db.grades = db.grades.map(g => {
    if (g.id !== gradeId) return g;
    targetStudentName = g.studentName;
    return { ...g, grade: newGrade, comment: newComment, teacher: user ? user.name : g.teacher };
  });

  saveDatabase();
  renderTeacherLists();
  showTeacherFeedback(`Betyg (${newGrade}) sparat för ${targetStudentName}!`);
};

window.deleteStudentGrade = function(gradeId) {
  db.grades = db.grades.filter(g => g.id !== gradeId);
  saveDatabase();
  renderTeacherLists();
  showTeacherFeedback("Kursbetyget har tagits bort.");
};

// --- Adminvy (admin.html) ---
function initAdminPage() {
  const gate = document.getElementById("adminAuthGate");
  const dashboard = document.getElementById("adminDashboard");
  if (!gate || !dashboard) return;

  const user = getCurrentUser();
  if (!user || user.role !== "admin") {
    gate.style.display = "block";
    dashboard.style.display = "none";

    const inlineForm = document.getElementById("inlineAdminLoginForm");
    if (inlineForm) {
      inlineForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const logged = loginUser(
          document.getElementById("inlineAdminUser").value,
          document.getElementById("inlineAdminPass").value
        );
        if (logged && logged.role === "admin") {
          window.location.reload();
        } else {
          document.getElementById("inlineAdminError").style.display = "block";
        }
      });
    }
    return;
  }

  gate.style.display = "none";
  dashboard.style.display = "block";

  // Lägg till användare
  document.getElementById("adminUserForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("newUserName").value.trim();
    const username = document.getElementById("newUserUsername").value.trim();
    const password = document.getElementById("newUserPassword").value.trim();
    const role = document.getElementById("newUserRole").value;

    if (!name || !username || !password) return;

    db.users.push({
      id: "u_" + Date.now(),
      name,
      username,
      password,
      role,
      class: role === "student" ? "NA24A" : undefined
    });
    saveDatabase();
    e.target.reset();
    renderAdminDashboard();
  });

  // Uppdatera matsedel
  const lunchForm = document.getElementById("adminLunchForm");
  Object.keys(db.lunchMenu).forEach(day => {
    const input = document.getElementById(`lunch_${day}`);
    if (input) input.value = db.lunchMenu[day];
  });

  lunchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    Object.keys(db.lunchMenu).forEach(day => {
      const input = document.getElementById(`lunch_${day}`);
      if (input) db.lunchMenu[day] = input.value.trim();
    });
    saveDatabase();
    renderAdminDashboard();
    alert("Veckans matsedel är uppdaterad!");
  });

  // Exportera database.json
  document.getElementById("downloadDbBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "database.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  // Importera database.json
  document.getElementById("importDbInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (!imported.users || !imported.assignments) {
          alert("Ogiltig database.json-struktur.");
          return;
        }
        db = imported;
        saveDatabase();
        renderAll();
        renderAdminDashboard();
        alert("Databasen har importerats!");
      } catch {
        alert("Kunde inte läsa JSON-filen.");
      }
    };
    reader.readAsText(file);
  });

  // Återställ databas
  document.getElementById("resetFullDbBtn").addEventListener("click", () => {
    db = structuredClone(FALLBACK_DATABASE);
    saveDatabase();
    renderAll();
    renderAdminDashboard();
    alert("Databasen har återställts till standardvärden.");
  });

  renderAdminDashboard();
}

function renderAdminDashboard() {
  const statsEl = document.getElementById("adminStats");
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="stat-box"><span>Användare</span><strong>${db.users.length}</strong></div>
      <div class="stat-box"><span>Kurser</span><strong>${db.courses.length}</strong></div>
      <div class="stat-box"><span>Uppgifter</span><strong>${db.assignments.length}</strong></div>
      <div class="stat-box"><span>Betygsposter</span><strong>${db.grades.length}</strong></div>
    `;
  }

  const usersBody = document.getElementById("adminUsersTableBody");
  const currentUser = getCurrentUser();
  if (usersBody) {
    usersBody.innerHTML = db.users.map(u => {
      const r = getRoleLabel(u.role);
      const isSelf = currentUser && currentUser.id === u.id;
      return `
        <tr>
          <td><strong>${escapeHTML(u.name)}</strong></td>
          <td><code>${escapeHTML(u.username)}</code></td>
          <td><code>${escapeHTML(u.password)}</code></td>
          <td><span class="role-badge ${r.cls}">${r.text}</span></td>
          <td>
            ${isSelf
              ? `<small style="color:var(--text-muted);">Aktivt konto</small>`
              : `<button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}')">Ta bort</button>`}
          </td>
        </tr>
      `;
    }).join("");
  }

  const jsonViewer = document.getElementById("jsonDatabasePreview");
  if (jsonViewer) {
    jsonViewer.textContent = JSON.stringify(db, null, 2);
  }
}

window.deleteUser = function(id) {
  db.users = db.users.filter(u => u.id !== id);
  saveDatabase();
  renderAdminDashboard();
};

// --- Classroom interaktioner & Apps Script-synk ---
window.toggleAssignment = function(id) {
  db.assignments = db.assignments.map(a => {
    if (a.id !== id) return a;
    const nextState = !a.completed;
    if (nextState && !completedIds.includes(id)) completedIds.push(id);
    if (!nextState) completedIds = completedIds.filter(x => x !== id);
    return { ...a, completed: nextState };
  });
  saveDatabase();
  renderAll();
};

window.filterByCourse = function(courseId) {
  selectedCourseId = courseId;
  currentClassroomFilter = "todo";
  document.querySelectorAll(".sub-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === "todo");
  });
  renderClassroomPage();
};

async function syncFromAppsScript(url, statusEl = null) {
  const cleanUrl = (url || "").trim();
  if (!cleanUrl) return;
  if (statusEl) statusEl.textContent = "Synkar med Google Apps Script...";

  try {
    const response = await fetch(cleanUrl);
    const data = await response.json();

    if (Array.isArray(data.courses) && data.courses.length > 0) db.courses = data.courses;
    if (Array.isArray(data.assignments)) {
      const localTasks = db.assignments.filter(a => !String(a.id).includes("@google.com"));
      const synced = data.assignments.map(item => ({
        ...item,
        completed: Boolean(item.completed) || completedIds.includes(item.id)
      }));
      db.assignments = [...localTasks, ...synced];
    }
    if (Array.isArray(data.emails)) {
      emails = data.emails;
      localStorage.setItem("studyhub_emails", JSON.stringify(emails));
    }
    if (Array.isArray(data.driveFiles)) {
      driveFiles = data.driveFiles;
      localStorage.setItem("studyhub_drive_files", JSON.stringify(driveFiles));
    }

    appsScriptUrl = cleanUrl;
    localStorage.setItem("studyhub_apps_script_url", cleanUrl);
    saveDatabase();
    renderAll();
    if (statusEl) statusEl.textContent = "Synkning slutförd!";
  } catch {
    if (statusEl) statusEl.textContent = "Kunde inte hämta data från Apps Script-länken.";
  }
}

function initClassroomEvents() {
  document.querySelectorAll(".sub-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentClassroomFilter = btn.dataset.filter;
      document.querySelectorAll(".sub-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderClassroomPage();
    });
  });

  const courseSelect = document.getElementById("courseFilterSelect");
  if (courseSelect) {
    courseSelect.addEventListener("change", (e) => {
      selectedCourseId = e.target.value;
      renderClassroomPage();
    });
  }

  const toggleAddBtn = document.getElementById("toggleAddTaskBtn");
  if (toggleAddBtn) {
    toggleAddBtn.addEventListener("click", () => {
      document.getElementById("addTaskPanel").classList.toggle("open");
    });
  }

  const addForm = document.getElementById("addTaskForm");
  if (addForm) {
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      db.assignments.unshift({
        id: "custom_" + Date.now(),
        courseId: document.getElementById("newTaskCourse").value,
        title: document.getElementById("newTaskTitle").value.trim(),
        description: document.getElementById("newTaskDesc").value.trim(),
        dueDate: document.getElementById("newTaskDue").value,
        completed: false,
        link: "https://classroom.google.com"
      });
      saveDatabase();
      e.target.reset();
      document.getElementById("addTaskPanel").classList.remove("open");
      renderAll();
    });
  }

  const toggleApiBtn = document.getElementById("toggleApiConfigBtn");
  if (toggleApiBtn) {
    toggleApiBtn.addEventListener("click", () => {
      document.getElementById("apiConfigBox").classList.toggle("open");
    });
  }

  const urlInput = document.getElementById("appsScriptUrlInput");
  const statusEl = document.getElementById("apiStatusMessage");
  if (urlInput && appsScriptUrl) urlInput.value = appsScriptUrl;

  const connectBtn = document.getElementById("connectGoogleBtn");
  if (connectBtn) {
    connectBtn.addEventListener("click", () => {
      if (urlInput && urlInput.value.trim()) {
        syncFromAppsScript(urlInput.value.trim(), statusEl);
      }
    });
  }
}

function renderAll() {
  renderAuthHeader();
  updateHeaderBadges();
  renderOverviewPage();
  renderClassroomPage();
  renderGradesPage();
  renderSchoolInfoPage();
}

document.addEventListener("DOMContentLoaded", async () => {
  await initDatabase();
  renderAll();
  initClassroomEvents();
  initLoginPage();
  initTeacherPage();
  initAdminPage();

  if (appsScriptUrl) {
    syncFromAppsScript(appsScriptUrl);
  }
});