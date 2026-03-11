const STORAGE_KEY = "workout-log-app-v2";
const ACTIVE_SESSION_KEY = "workout-log-app-active-session";

const state = {
  sessions: loadSessions(),
  activeSession: loadActiveSession(),
  selectedId: null,
};

registerServiceWorker();

const elements = {
  todayLabel: document.querySelector("#today-label"),
  startButton: document.querySelector("#start-button"),
  finishButton: document.querySelector("#finish-button"),
  startTime: document.querySelector("#start-time"),
  finishTime: document.querySelector("#finish-time"),
  durationTime: document.querySelector("#duration-time"),
  sessionNote: document.querySelector("#session-note"),
  historySelect: document.querySelector("#history-select"),
  historyEmpty: document.querySelector("#history-empty"),
  historyDetail: document.querySelector("#history-detail"),
};

bootstrap();

function bootstrap() {
  elements.todayLabel.textContent = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());

  elements.startButton.addEventListener("click", startSession);
  elements.finishButton.addEventListener("click", finishSession);
  elements.sessionNote.addEventListener("input", handleNoteInput);
  elements.historySelect.addEventListener("change", handleHistoryChange);

  if (state.activeSession) {
    elements.sessionNote.value = state.activeSession.note ?? "";
  }

  state.selectedId = state.sessions[0]?.id ?? null;
  render();
  window.setInterval(updateLiveDuration, 1000);
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadActiveSession() {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
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
  if (state.activeSession) {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(state.activeSession));
    return;
  }
  localStorage.removeItem(ACTIVE_SESSION_KEY);
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
  saveActiveSession();
  render();
}

function finishSession() {
  if (!state.activeSession) return;

  const now = new Date();
  const started = new Date(state.activeSession.startAt);
  const durationMinutes = Math.max(1, Math.round((now.getTime() - started.getTime()) / 60000));

  const session = {
    id: state.activeSession.id,
    date: state.activeSession.date,
    startAt: state.activeSession.startAt,
    endAt: now.toISOString(),
    durationMinutes,
    note: state.activeSession.note?.trim() ?? "",
  };

  state.sessions.unshift(session);
  state.selectedId = session.id;
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

function handleHistoryChange(event) {
  state.selectedId = event.target.value || null;
  renderHistoryDetail();
}

function render() {
  renderSessionCard();
  renderHistorySelect();
  renderHistoryDetail();
}

function renderSessionCard() {
  const active = state.activeSession;
  elements.startButton.disabled = Boolean(active);
  elements.finishButton.disabled = !active;
  elements.sessionNote.disabled = !active;

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

function renderHistorySelect() {
  elements.historySelect.innerHTML = "";

  if (state.sessions.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "記録なし";
    elements.historySelect.appendChild(option);
    elements.historySelect.disabled = true;
    return;
  }

  elements.historySelect.disabled = false;

  state.sessions.forEach((session) => {
    const option = document.createElement("option");
    option.value = session.id;
    option.textContent = `${formatDateLabel(session.date)} ${formatTime(session.startAt)}`;
    if (session.id === state.selectedId) option.selected = true;
    elements.historySelect.appendChild(option);
  });
}

function renderHistoryDetail() {
  const session = state.sessions.find((entry) => entry.id === state.selectedId);
  const hasSession = Boolean(session);

  elements.historyEmpty.classList.toggle("hidden", hasSession);
  elements.historyDetail.classList.toggle("hidden", !hasSession);

  if (!session) {
    elements.historyDetail.innerHTML = "";
    return;
  }

  elements.historyDetail.innerHTML = `
    <div class="detail-row"><span>日付</span><strong>${formatDateLabel(session.date)}</strong></div>
    <div class="detail-row"><span>開始</span><strong>${formatTime(session.startAt)}</strong></div>
    <div class="detail-row"><span>終了</span><strong>${formatTime(session.endAt)}</strong></div>
    <div class="detail-row"><span>時間</span><strong>${formatMinutes(session.durationMinutes)}</strong></div>
    <div class="detail-note-block">
      <span>メモ</span>
      <p>${escapeHtml(session.note || "メモなし")}</p>
    </div>
  `;
}

function updateLiveDuration() {
  if (!state.activeSession) return;
  elements.durationTime.textContent = formatElapsed(state.activeSession.startAt);
}

function formatDateLabel(dateKey) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${dateKey}T00:00:00`));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatElapsed(startAt) {
  const diffMinutes = Math.max(0, Math.floor((Date.now() - new Date(startAt).getTime()) / 60000));
  return formatMinutes(diffMinutes);
}

function formatMinutes(totalMinutes) {
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
    navigator.serviceWorker
      .register("./service-worker.js")
      .then((registration) => registration.update())
      .catch(() => {
        // PWA registration is optional.
      });
  });
}
