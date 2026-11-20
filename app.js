// Klistra in din Google Apps Script-länk (som slutar på /exec) mellan citattecknen nedan:
const DEFAULT_APPS_SCRIPT_URL = "";

// --- Hjälpfunktioner för datum ---
function getOffsetDateStr(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split("T")[0];
}

const TODAY_STR = getOffsetDateStr(0);

// --- Standarddata (Demoläge innan första synk) ---
const DEFAULT_COURSES = [
  { id: "c1", name: "Matematik 3c", section: "NA24A", teacher: "Anna Lindqvist", color: "#1a73e8", link: "https://classroom.google.com" },
  { id: "c2", name: "Programmering 1", section: "TE24B", teacher: "Johan Bergström", color: "#1e8e3e", link: "https://classroom.google.com" },
  { id: "c3", name: "Svenska 2", section: "NA24A", teacher: "Maria Ek", color: "#d93025", link: "https://classroom.google.com" },
  { id: "c4", name: "Engelska 6", section: "NA24A", teacher: "David Miller", color: "#e37400", link: "https://classroom.google.com" }
];

const DEFAULT_ASSIGNMENTS = [
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
    title: "Webbprojekt: Fler-sidig Study Hub",
    description: "Dela upp koden i separata HTML-, CSS- och JavaScript-filer.",
    dueDate: TODAY_STR,
    completed: false,
    link: "https://classroom.google.com"
  }
];

let courses = JSON.parse(localStorage.getItem("studyhub_courses")) || DEFAULT_COURSES;
let assignments = JSON.parse(localStorage.getItem("studyhub_assignments")) || DEFAULT_ASSIGNMENTS;
let completedIds = JSON.parse(localStorage.getItem("studyhub_completed_ids")) || [];
let appsScriptUrl = localStorage.getItem("studyhub_apps_script_url") || DEFAULT_APPS_SCRIPT_URL;

let currentClassroomFilter = "todo";
let selectedCourseId = "all";

function saveData() {
  localStorage.setItem("studyhub_courses", JSON.stringify(courses));
  localStorage.setItem("studyhub_assignments", JSON.stringify(assignments));
  localStorage.setItem("studyhub_completed_ids", JSON.stringify(completedIds));
}

function getCourseById(id) {
  return courses.find(c => c.id === id) || { name: "Okänd kurs", color: "#1a73e8", teacher: "Lärare" };
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
          <span class="course-tag" style="background:${course.color}18; color:${course.color};">${course.name}</span>
          <span class="due-tag ${due.cls}">${due.text}</span>
        </div>
        <h4 class="assignment-title" style="margin-top:0.65rem;">${item.title}</h4>
        <p class="assignment-desc">${item.description || "Ingen ytterligare beskrivning."}</p>
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

// --- Synka uppgifter från Google Apps Script ---
async function syncFromAppsScript(url, statusEl = null) {
  const cleanUrl = (url || "").trim();
  if (!cleanUrl) return;

  if (statusEl) {
    statusEl.textContent = "Hämtar kurser och uppgifter från Google Classroom...";
  }

  try {
    const response = await fetch(cleanUrl);
    if (!response.ok) {
      throw new Error(`HTTP-fel: ${response.status}`);
    }

    const data = await response.json();
    if (!Array.isArray(data.courses) || !Array.isArray(data.assignments)) {
      throw new Error("Ogiltigt dataformat från webbappen.");
    }

    // Behåll manuellt tillagda uppgifter (custom_) och avbockade uppgifter
    const customTasks = assignments.filter(a => String(a.id).startsWith("custom_"));
    const syncedTasks = data.assignments.map(item => ({
      ...item,
      completed: Boolean(item.completed) || completedIds.includes(item.id)
    }));

    courses = data.courses.length > 0 ? data.courses : courses;
    assignments = [...customTasks, ...syncedTasks];

    appsScriptUrl = cleanUrl;
    localStorage.setItem("studyhub_apps_script_url", cleanUrl);
    saveData();
    renderAll();

    if (statusEl) {
      const timeNow = new Date().toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
      statusEl.textContent = `Synkad kl. ${timeNow} (${courses.length} kurser, ${syncedTasks.length} uppgifter).`;
    }
  } catch (err) {
    console.error("Fel vid synkning med Apps Script:", err);
    if (statusEl) {
      statusEl.textContent = "Kunde inte hämta data. Kontrollera att länken slutar på /exec och att åtkomst är satt till 'Alla'.";
    }
  }
}

// --- Gemensam Header (körs på alla sidor) ---
function initHeader() {
  const studentInput = document.getElementById("studentNameInput");
  if (studentInput) {
    studentInput.value = localStorage.getItem("studyhub_student_name") || "Alex Andersson";
    studentInput.addEventListener("input", () => {
      localStorage.setItem("studyhub_student_name", studentInput.value);
    });
  }
  updateHeaderBadges();
}

function updateHeaderBadges() {
  const pending = assignments.filter(a => !a.completed);
  const dueTodayCount = pending.filter(a => a.dueDate === TODAY_STR).length;

  const badgeEl = document.getElementById("classroomBadge");
  if (badgeEl) badgeEl.textContent = pending.length;

  const dueEl = document.getElementById("dueTodayStatus");
  if (dueEl) {
    dueEl.textContent = `Inlämning idag: ${dueTodayCount} ${dueTodayCount === 1 ? "uppgift" : "uppgifter"}`;
  }
}

// --- Översiktssidan (index.html) ---
function renderOverviewPage() {
  const headingEl = document.getElementById("overviewHeading");
  if (headingEl) {
    const weekdays = ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"];
    headingEl.textContent = `Dagens översikt (${weekdays[new Date().getDay()]})`;
  }

  const overviewContainer = document.getElementById("overviewAssignments");
  if (!overviewContainer) return;

  const pending = assignments.filter(a => !a.completed);
  const upcomingThree = [...pending]
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, 3);

  overviewContainer.innerHTML = upcomingThree.length
    ? upcomingThree.map(createAssignmentCardHTML).join("")
    : `<p style="color:var(--text-muted);">Inga kommande uppgifter just nu!</p>`;
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
      courses.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
    courseSelect.value = courses.some(c => c.id === currentVal) ? currentVal : selectedCourseId;
  }

  if (newTaskCourseSelect) {
    newTaskCourseSelect.innerHTML = courses.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
  }

  if (currentClassroomFilter === "courses") {
    assignmentsContainer.style.display = "none";
    if (courseFilterWrapper) courseFilterWrapper.style.display = "none";
    coursesContainer.style.display = "grid";

    coursesContainer.innerHTML = courses.map(c => {
      const count = assignments.filter(a => a.courseId === c.id && !a.completed).length;
      return `
        <div class="course-card">
          <div class="course-banner" style="background:${c.color};">
            <div>${c.name}</div>
            <small style="opacity:0.9; font-weight:400;">${c.section || ""}</small>
          </div>
          <div class="course-body">
            <div><strong>Lärare:</strong> ${c.teacher || "Ej angiven"}</div>
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

    let filtered = [...assignments];
    if (currentClassroomFilter === "todo") filtered = filtered.filter(a => !a.completed);
    if (currentClassroomFilter === "done") filtered = filtered.filter(a => a.completed);
    if (selectedCourseId !== "all") filtered = filtered.filter(a => a.courseId === selectedCourseId);

    filtered.sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"));

    assignmentsContainer.innerHTML = filtered.length
      ? filtered.map(createAssignmentCardHTML).join("")
      : `<div class="card" style="grid-column:1/-1;"><p>Inga uppgifter matchar valt filter.</p></div>`;
  }
}

function renderAll() {
  updateHeaderBadges();
  renderOverviewPage();
  renderClassroomPage();
}

window.toggleAssignment = function(id) {
  assignments = assignments.map(a => {
    if (a.id !== id) return a;
    const nextState = !a.completed;
    if (nextState && !completedIds.includes(id)) {
      completedIds.push(id);
    } else if (!nextState) {
      completedIds = completedIds.filter(item => item !== id);
    }
    return { ...a, completed: nextState };
  });
  saveData();
  renderAll();
};

window.filterByCourse = function(courseId) {
  selectedCourseId = courseId;
  setClassroomSubTab("todo");
};

function setClassroomSubTab(filter) {
  currentClassroomFilter = filter;
  document.querySelectorAll(".sub-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  renderClassroomPage();
}

// --- Event Listeners för Classroom-sidan ---
function initClassroomEvents() {
  document.querySelectorAll(".sub-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => setClassroomSubTab(btn.dataset.filter));
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
      const title = document.getElementById("newTaskTitle").value.trim();
      const courseId = document.getElementById("newTaskCourse").value;
      const dueDate = document.getElementById("newTaskDue").value;
      const description = document.getElementById("newTaskDesc").value.trim();

      if (!title) return;

      assignments.unshift({
        id: "custom_" + Date.now(),
        courseId,
        title,
        description,
        dueDate,
        completed: false,
        link: "https://classroom.google.com"
      });

      saveData();
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

  // Stöd både nuvarande input-ID i classroom.html och eventuellt nytt ID
  const urlInput = document.getElementById("appsScriptUrlInput") || document.getElementById("googleClientIdInput");
  const statusEl = document.getElementById("apiStatusMessage");

  if (urlInput && appsScriptUrl) {
    urlInput.value = appsScriptUrl;
  }

  const connectBtn = document.getElementById("connectGoogleBtn");
  if (connectBtn) {
    connectBtn.addEventListener("click", () => {
      const enteredUrl = urlInput ? urlInput.value.trim() : "";
      if (!enteredUrl) {
        if (statusEl) statusEl.textContent = "Klistra in din Google Apps Script-länk (/exec) först.";
        return;
      }
      syncFromAppsScript(enteredUrl, statusEl);
    });
  }

  const resetDemoBtn = document.getElementById("resetDemoBtn");
  if (resetDemoBtn) {
    resetDemoBtn.addEventListener("click", () => {
      localStorage.removeItem("studyhub_apps_script_url");
      appsScriptUrl = DEFAULT_APPS_SCRIPT_URL;
      courses = [...DEFAULT_COURSES];
      assignments = [...DEFAULT_ASSIGNMENTS];
      completedIds = [];
      saveData();
      renderAll();
      if (urlInput) urlInput.value = appsScriptUrl;
      if (statusEl) statusEl.textContent = "Demodata återställd.";
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initHeader();
  initClassroomEvents();
  renderAll();

  // Hämta färska uppgifter automatiskt om en webbapp-länk är sparad
  if (appsScriptUrl) {
    const statusEl = document.getElementById("apiStatusMessage");
    syncFromAppsScript(appsScriptUrl, statusEl);
  }
});