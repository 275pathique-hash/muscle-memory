const STORAGE_KEY = "workout-log-app-v2";

const state = {
  sessions: loadSessions(),
  activeSession: loadActiveSession(),
  selectedDate: null,
  calendarDate: startOfMonth(new Date()),
};

registerServiceWorker();

const elements = {
  totalSessions: document.querySelector("#total-sessions"),
  monthStamps: document.querySelector("#month-stamps"),
  sessionStatus: document.querySelector("#session-status"),
  liveDate: document.querySelector("#live-date"),
  liveTime: document.querySelector("#live-time"),
  startTime: document.querySelector("#start-time"),
  finishTime: document.querySelector("#finish-time"),
  durationTime: document.querySelector("#duration-time"),
  startButton: document.querySelector("#start-button"),
  finishButton: document.querySelector("#finish-button"),
  sessionNote: document.querySelector("#session-note"),
  prevMonth: document.querySelector("#prev-month"),
  nextMonth: document.querySelector("#next-month"),
  calendarTitle: document.querySelector("#calendar-title"),
  calendarGrid: document.querySelector("#calendar-grid"),
  detailEmpty: document.querySelector("#detail-empty"),
  detailView: document.querySelector("#detail-view"),
};

bootstrap();

function bootstrap() {
  elements.startButton.addEventListener("click", startSession);
  elements.finishButton.addEventListener("click", finishSession);
  elements.prevMonth.addEventListener("click", () => shiftMonth(-1));
  elements.nextMonth.addEventListener("click", () => shiftMonth(1));
  elements.sessionNote.addEventListener("input", handleNoteInput);

  if (state.activeSession) {
    elements.sessionNote.value = state.activeSession.note ?? "";
  }

  const todayKey = formatDateKey(new Date());
  state.selectedDate = state.activeSession?.date ?? findLatestDate() ?? todayKey;
  state.calendarDate = startOfMonth(new Date(`${state.selectedDate}T00:00:00`));

  updateClock();
  setInterval(updateClock, 1000);
  render();
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }

    const legacyRaw = localStorage.getItem("workout-log-app-v1");
    if (!legacyRaw) return [];
    const legacy = JSON.parse(legacyRaw);
    if (!Array.isArray(legacy)) return [];

    const migrated = legacy.map((workout) => migrateLegacyWorkout(workout)).filter(Boolean);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
}

function migrateLegacyWorkout(workout) {
  if (!workout?.date) return null;

  return {
    id: workout.id ?? crypto.randomUUID(),
    date: workout.date,
    startAt: `${workout.date}T09:00:00`,
    endAt: `${workout.date}T10:00:00`,
    durationMinutes: 60,
    note: workout.note ?? "",
    stampCount: 1,
  };
}

function loadActiveSession() {
  try {
    const raw = localStorage.getItem("workout-log-app-active-session");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sessions));
}

function saveActiveSession() {
  if (!state.activeSession) {
    localStorage.removeItem("workout-log-app-active-session");
    return;
  }
  localStorage.setItem("workout-log-app-active-session", JSON.stringify(state.activeSession));
}

function startSession() {
  if (state.activeSession) return;

  const now = new Date();
  state.activeSession = {
    id: crypto.randomUUID(),
    date: formatDateKey(now),
    startAt: now.toISOString(),
    note: "",
  };

  elements.sessionNote.value = "";
  state.selectedDate = state.activeSession.date;
  state.calendarDate = startOfMonth(now);
  saveActiveSession();
  render();
}

function finishSession() {
  if (!state.activeSession) return;

  const now = new Date();
  const started = new Date(state.activeSession.startAt);
  const durationMinutes = Math.max(1, Math.round((now.getTime() - started.getTime()) / 60000));

  state.sessions.unshift({
    id: state.activeSession.id,
    date: state.activeSession.date,
    startAt: state.activeSession.startAt,
    endAt: now.toISOString(),
    durationMinutes,
    note: state.activeSession.note?.trim() ?? "",
    stampCount: 1,
  });

  state.selectedDate = state.activeSession.date;
  state.activeSession = null;
  elements.sessionNote.value = "";
  saveSessions();
  saveActiveSession();
  render();
}

function handleNoteInput(event) {
  if (!state.activeSession) return;
  state.activeSession.note = event.target.value;
  saveActiveSession();
}

function shiftMonth(offset) {
  const next = new Date(state.calendarDate);
  next.setMonth(next.getMonth() + offset);
  state.calendarDate = startOfMonth(next);
  renderCalendar();
  renderStats();
}

function render() {
  renderStats();
  renderSessionCard();
  renderCalendar();
  renderDetail();
}

function renderStats() {
  elements.totalSessions.textContent = String(state.sessions.length);

  const currentMonthKey = monthKey(state.calendarDate);
  const stampDays = new Set(
    state.sessions.filter((session) => monthKey(new Date(session.date)) === currentMonthKey).map((session) => session.date)
  );
  if (state.activeSession && monthKey(new Date(state.activeSession.date)) === currentMonthKey) {
    stampDays.add(state.activeSession.date);
  }
  elements.monthStamps.textContent = String(stampDays.size);
}

function renderSessionCard() {
  const active = state.activeSession;
  elements.sessionStatus.textContent = active ? "進行中" : "未開始";
  elements.sessionStatus.classList.toggle("is-live", Boolean(active));
  elements.startButton.disabled = Boolean(active);
  elements.finishButton.disabled = !active;

  if (!active) {
    elements.startTime.textContent = "--:--";
    elements.finishTime.textContent = "--:--";
    elements.durationTime.textContent = "--";
    return;
  }

  elements.startTime.textContent = formatTime(active.startAt);
  elements.finishTime.textContent = "--:--";
  elements.durationTime.textContent = formatElapsed(active.startAt);
}

function renderCalendar() {
  elements.calendarTitle.textContent = formatMonthTitle(state.calendarDate);
  elements.calendarGrid.innerHTML = "";

  const firstDay = startOfMonth(state.calendarDate);
  const firstWeekday = firstDay.getDay();
  const totalDays = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0).getDate();
  const stamps = buildStampMap(firstDay);

  for (let i = 0; i < firstWeekday; i += 1) {
    const blank = document.createElement("div");
    blank.className = "calendar-day is-blank";
    elements.calendarGrid.appendChild(blank);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
    const key = formatDateKey(date);
    const button = document.createElement("button");
    const count = stamps.get(key) ?? 0;

    button.type = "button";
    button.className = "calendar-day";
    if (count > 0) button.classList.add("has-stamp");
    if (key === state.selectedDate) button.classList.add("is-selected");
    if (key === formatDateKey(new Date())) button.classList.add("is-today");

    const dayNumber = document.createElement("span");
    dayNumber.className = "day-number";
    dayNumber.textContent = String(day);

    button.appendChild(dayNumber);

    if (count > 0) {
      const stamp = document.createElement("span");
      stamp.className = "stamp-badge";
      stamp.textContent = count > 1 ? `🏋️ ${count}` : "🏋️";
      button.appendChild(stamp);
    }

    button.addEventListener("click", () => {
      state.selectedDate = key;
      renderCalendar();
      renderDetail();
    });

    elements.calendarGrid.appendChild(button);
  }
}

function renderDetail() {
  const sessions = sessionsForDate(state.selectedDate);
  const active = state.activeSession?.date === state.selectedDate ? state.activeSession : null;
  const hasEntries = sessions.length > 0 || Boolean(active);

  elements.detailEmpty.classList.toggle("hidden", hasEntries);
  elements.detailView.classList.toggle("hidden", !hasEntries);

  if (!hasEntries) {
    elements.detailView.innerHTML = "";
    return;
  }

  const parts = [];

  if (active) {
    parts.push(`
      <section class="detail-session live-session">
        <div class="detail-header">
          <div>
            <h3>${formatDateLabel(active.date)}</h3>
            <p class="detail-subtext">進行中のセッション</p>
          </div>
          <span class="mini-chip">LIVE</span>
        </div>
        <p class="detail-note">開始: ${formatTime(active.startAt)}</p>
        <p class="detail-note">${escapeHtml(active.note || "メモなし")}</p>
      </section>
    `);
  }

  sessions.forEach((session) => {
    parts.push(`
      <section class="detail-session">
        <div class="detail-header">
          <div>
            <h3>${formatDateLabel(session.date)}</h3>
            <p class="detail-subtext">${formatTime(session.startAt)} - ${formatTime(session.endAt)}</p>
          </div>
          <button class="ghost-button delete-session" type="button" data-id="${session.id}">削除</button>
        </div>
        <div class="detail-metrics">
          <span class="detail-pill">開始 ${formatTime(session.startAt)}</span>
          <span class="detail-pill">終了 ${formatTime(session.endAt)}</span>
          <span class="detail-pill">${formatMinutes(session.durationMinutes)}</span>
        </div>
        <p class="detail-note">${escapeHtml(session.note || "メモなし")}</p>
      </section>
    `);
  });

  elements.detailView.innerHTML = parts.join("");
  elements.detailView.querySelectorAll(".delete-session").forEach((button) => {
    button.addEventListener("click", () => deleteSession(button.dataset.id));
  });
}

function deleteSession(id) {
  const confirmed = window.confirm("この記録を削除しますか？");
  if (!confirmed) return;

  state.sessions = state.sessions.filter((session) => session.id !== id);
  saveSessions();
  render();
}

function sessionsForDate(dateKey) {
  if (!dateKey) return [];
  return state.sessions.filter((session) => session.date === dateKey);
}

function buildStampMap(monthDate) {
  const key = monthKey(monthDate);
  const map = new Map();

  state.sessions.forEach((session) => {
    if (monthKey(new Date(session.date)) !== key) return;
    map.set(session.date, (map.get(session.date) ?? 0) + 1);
  });

  if (state.activeSession && monthKey(new Date(state.activeSession.date)) === key) {
    map.set(state.activeSession.date, (map.get(state.activeSession.date) ?? 0) + 1);
  }

  return map;
}

function findLatestDate() {
  const latest = state.sessions[0]?.date;
  return latest ?? null;
}

function updateClock() {
  const now = new Date();
  elements.liveDate.textContent = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);

  elements.liveTime.textContent = new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now);

  if (state.activeSession) {
    elements.durationTime.textContent = formatElapsed(state.activeSession.startAt);
  }
}

function formatMonthTitle(date) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function formatDateLabel(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function formatTime(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatElapsed(startAt) {
  const start = new Date(startAt).getTime();
  const diffMinutes = Math.max(0, Math.floor((Date.now() - start) / 60000));
  return formatMinutes(diffMinutes);
}

function formatMinutes(totalMinutes) {
  if (!Number.isFinite(totalMinutes)) return "--";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}分`;
  return `${hours}時間${minutes}分`;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // PWA registration is optional; the app still works without it.
    });
  });
}
