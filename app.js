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
  bodyweightField: document.querySelector("#bodyweight-field"),
  bodyweightInput: document.querySelector("#bodyweight-input"),
  exercisePanel: document.querySelector("#exercise-panel"),
  addExercise: document.querySelector("#add-exercise"),
  presetButtons: [...document.querySelectorAll(".preset-button")],
  exerciseList: document.querySelector("#exercise-list"),
  historySelect: document.querySelector("#history-select"),
  historyEmpty: document.querySelector("#history-empty"),
  historyDetail: document.querySelector("#history-detail"),
  exerciseTemplate: document.querySelector("#exercise-template"),
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
  elements.bodyweightInput.addEventListener("input", handleBodyweightInput);
  elements.addExercise.addEventListener("click", () => addExerciseItem());
  elements.presetButtons.forEach((button) => {
    button.addEventListener("click", () => addPresetExercise(button.dataset.name));
  });
  elements.historySelect.addEventListener("change", handleHistoryChange);

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
    bodyweight: "",
    exercises: [],
  };

  elements.bodyweightInput.value = "";
  elements.exerciseList.innerHTML = "";
  addExerciseItem();
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
    bodyweight: toNullableNumber(state.activeSession.bodyweight),
    exercises: serializeExercises(),
  };

  state.sessions.unshift(session);
  state.selectedId = session.id;
  state.activeSession = null;
  saveSessions();
  saveActiveSession();
  render();
}

function addExerciseItem(exercise = null) {
  const fragment = elements.exerciseTemplate.content.cloneNode(true);
  const item = fragment.querySelector(".exercise-item");
  const nameInput = fragment.querySelector(".exercise-name");
  const removeExerciseButton = fragment.querySelector(".remove-exercise");
  const weightInput = fragment.querySelector(".set-weight");
  const repsInput = fragment.querySelector(".set-reps");
  const countInput = fragment.querySelector(".set-count");

  nameInput.value = exercise?.name ?? "";
  nameInput.addEventListener("input", syncActiveExercises);
  populateSelect(weightInput, buildWeightOptions(), "重さ");
  populateSelect(repsInput, buildSequentialOptions(1, 30), "回数");
  populateSelect(countInput, buildSequentialOptions(1, 10), "セット数");
  weightInput.addEventListener("change", syncActiveExercises);
  repsInput.addEventListener("change", syncActiveExercises);
  countInput.addEventListener("change", syncActiveExercises);

  removeExerciseButton.addEventListener("click", () => {
    item.remove();
    syncActiveExercises();
  });

  const summary = normalizeExerciseForEditor(exercise);
  weightInput.value = summary.weight;
  repsInput.value = summary.reps;
  countInput.value = summary.count;
  elements.exerciseList.appendChild(fragment);
}

function addPresetExercise(name) {
  if (!state.activeSession) return;
  addExerciseItem({ name, sets: [{ weight: "", reps: "" }] });
  syncActiveExercises();
}

function handleBodyweightInput(event) {
  if (!state.activeSession) return;
  state.activeSession.bodyweight = event.target.value;
  saveActiveSession();
}

function serializeExercises() {
  return [...elements.exerciseList.querySelectorAll(".exercise-item")]
    .map((item) => {
      const name = item.querySelector(".exercise-name").value.trim();
      const weight = item.querySelector(".set-weight").value;
      const reps = item.querySelector(".set-reps").value;
      const count = item.querySelector(".set-count").value;

      if (!name && !weight && !reps && !count) return null;
      const sets = buildSetsFromSimpleInputs(weight, reps, count);
      return { name: name || "種目名なし", sets };
    })
    .filter(Boolean);
}

function buildSetsFromSimpleInputs(weight, reps, count) {
  const safeCount = Math.max(1, Number(count) || 1);
  if (!weight || !reps) return [];

  return Array.from({ length: safeCount }, () => ({
    weight: Number(weight),
    reps: Number(reps),
  }));
}

function normalizeExerciseForEditor(exercise) {
  const sets = exercise?.sets ?? [];
  if (!sets.length) return { weight: "", reps: "", count: "" };

  return {
    weight: sets[0].weight ?? "",
    reps: sets[0].reps ?? "",
    count: sets.length,
  };
}

function populateSelect(select, values, placeholder) {
  select.innerHTML = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = placeholder;
  select.appendChild(emptyOption);

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = String(value);
    select.appendChild(option);
  });
}

function buildWeightOptions() {
  return Array.from({ length: 41 }, (_, index) => index * 5);
}

function buildSequentialOptions(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function syncActiveExercises() {
  if (!state.activeSession) return;
  state.activeSession.exercises = serializeExercises();
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
  elements.bodyweightField.classList.toggle("hidden", !active);
  elements.exercisePanel.classList.toggle("hidden", !active);

  if (!active) {
    elements.startTime.textContent = "--:--";
    elements.finishTime.textContent = "--:--";
    elements.durationTime.textContent = "--";
    elements.bodyweightInput.value = "";
    elements.exerciseList.innerHTML = "";
    return;
  }

  renderExerciseEditor(active.exercises ?? []);
  elements.bodyweightInput.value = active.bodyweight ?? "";
  elements.startTime.textContent = formatTime(active.startAt);
  elements.finishTime.textContent = "--:--";
  elements.durationTime.textContent = formatElapsed(active.startAt);
}

function renderExerciseEditor(exercises) {
  if (elements.exerciseList.children.length > 0) return;
  elements.exerciseList.innerHTML = "";

  if (!exercises.length) {
    addExerciseItem();
    return;
  }

  exercises.forEach((exercise) => addExerciseItem(exercise));
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
        .map((exercise) => {
          return `<p><strong>${escapeHtml(exercise.name)}</strong><br>${escapeHtml(summarizeExercise(exercise))}</p>`;
        })
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
  if (state.selectedId === id) {
    state.selectedId = state.sessions[0]?.id ?? null;
  }
  saveSessions();
  render();
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

function formatBodyweight(value) {
  if (value === null || value === undefined || value === "") return "未入力";
  return `${value}kg`;
}

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  return Number(value);
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
