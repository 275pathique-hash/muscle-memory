const STORAGE_KEY = "workout-log-app-v2";

const state = {
  sessions: loadSessions(),
  selectedId: null,
};

const elements = {
  historySelect: document.querySelector("#history-select"),
  historyEmpty: document.querySelector("#history-empty"),
  historyDetail: document.querySelector("#history-detail"),
};

bootstrap();

function bootstrap() {
  elements.historySelect.addEventListener("change", handleHistoryChange);
  state.selectedId = state.sessions[0]?.id ?? null;
  render();
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

function saveSessions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sessions));
}

function handleHistoryChange(event) {
  state.selectedId = event.target.value || null;
  renderHistoryDetail();
}

function render() {
  renderHistorySelect();
  renderHistoryDetail();
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
    <div class="detail-row compact-row"><span>${formatDateLabel(session.date)} / ${formatTime(session.startAt)} - ${formatTime(session.endAt)} / ${formatMinutes(session.durationMinutes)} / ${formatBodyweight(session.bodyweight)}</span></div>
    ${renderExerciseSummary(session.exercises ?? [])}
    <button class="danger-button" id="delete-session-button" type="button">この記録を削除</button>
  `;

  elements.historyDetail
    .querySelector("#delete-session-button")
    .addEventListener("click", () => deleteSession(session.id));
}

function renderExerciseSummary(exercises) {
  if (!exercises.length) {
    return `
      <div class="detail-note-block">
        <span>種目</span>
        <p>記録なし</p>
      </div>
    `;
  }

  return `
    <div class="detail-note-block">
      <span>種目</span>
      ${exercises
        .map((exercise) => `<p><strong>${escapeHtml(exercise.name)}</strong><br>${escapeHtml(summarizeExercise(exercise))}</p>`)
        .join("")}
    </div>
  `;
}

function summarizeExercise(exercise) {
  const sets = exercise.sets ?? [];
  if (!sets.length) return "セット未入力";

  const first = sets[0];
  const samePattern = sets.every((set) => Number(set.weight) === Number(first.weight) && Number(set.reps) === Number(first.reps));
  if (samePattern) {
    return `${first.weight}kg x ${first.reps}回 x ${sets.length}セット`;
  }

  return sets.map((set) => `${set.weight}kg x ${set.reps}回`).join(" / ");
}

function deleteSession(id) {
  const confirmed = window.confirm("この記録を削除しますか？");
  if (!confirmed) return;

  state.sessions = state.sessions.filter((session) => session.id !== id);
  state.selectedId = state.sessions[0]?.id ?? null;
  saveSessions();
  render();
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

function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}分`;
  return `${hours}時間${minutes}分`;
}

function formatBodyweight(value) {
  if (value === null || value === undefined || value === "") return "未入力";
  return `${value}kg`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
