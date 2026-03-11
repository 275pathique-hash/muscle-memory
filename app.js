const STORAGE_KEY = "workout-log-app-v1";

const state = {
  workouts: loadWorkouts(),
  selectedWorkoutId: null,
};

registerServiceWorker();

const elements = {
  form: document.querySelector("#workout-form"),
  workoutDate: document.querySelector("#workout-date"),
  workoutNote: document.querySelector("#workout-note"),
  exerciseList: document.querySelector("#exercise-list"),
  addExercise: document.querySelector("#add-exercise"),
  resetForm: document.querySelector("#reset-form"),
  historyList: document.querySelector("#history-list"),
  emptyHistory: document.querySelector("#empty-history"),
  detailEmpty: document.querySelector("#detail-empty"),
  detailView: document.querySelector("#detail-view"),
  totalWorkouts: document.querySelector("#total-workouts"),
  totalExercises: document.querySelector("#total-exercises"),
  exerciseTemplate: document.querySelector("#exercise-template"),
  setRowTemplate: document.querySelector("#set-row-template"),
};

bootstrap();

function bootstrap() {
  elements.workoutDate.value = getToday();

  elements.addExercise.addEventListener("click", () => addExerciseCard());
  elements.resetForm.addEventListener("click", resetForm);
  elements.form.addEventListener("submit", handleSubmit);

  if (state.workouts.length > 0) {
    state.selectedWorkoutId = state.workouts[0].id;
  }

  addExerciseCard();
  render();
}

function loadWorkouts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveWorkouts() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workouts));
}

function addExerciseCard(exercise = null) {
  const fragment = elements.exerciseTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".exercise-card");
  const nameInput = fragment.querySelector(".exercise-name");
  const removeButton = fragment.querySelector(".remove-exercise");
  const addSetButton = fragment.querySelector(".add-set");
  const previousRecord = fragment.querySelector(".previous-record");
  const setRows = fragment.querySelector(".set-rows");

  nameInput.value = exercise?.name ?? "";

  removeButton.addEventListener("click", () => {
    card.remove();
    ensureExerciseExists();
  });

  addSetButton.addEventListener("click", () => {
    addSetRow(setRows);
    refreshSetIndexes(setRows);
  });

  nameInput.addEventListener("input", () => {
    updatePreviousRecord(nameInput, previousRecord);
  });

  const initialSets = exercise?.sets?.length ? exercise.sets : [{ weight: "", reps: "" }];
  initialSets.forEach((set) => addSetRow(setRows, set));
  refreshSetIndexes(setRows);
  updatePreviousRecord(nameInput, previousRecord);

  elements.exerciseList.appendChild(fragment);
}

function addSetRow(container, set = null) {
  const fragment = elements.setRowTemplate.content.cloneNode(true);
  const row = fragment.querySelector(".set-row");
  const weightInput = fragment.querySelector(".set-weight");
  const repsInput = fragment.querySelector(".set-reps");
  const removeButton = fragment.querySelector(".remove-set");

  weightInput.value = set?.weight ?? "";
  repsInput.value = set?.reps ?? "";

  removeButton.addEventListener("click", () => {
    row.remove();
    if (container.children.length === 0) {
      addSetRow(container);
    }
    refreshSetIndexes(container);
  });

  container.appendChild(fragment);
}

function refreshSetIndexes(container) {
  [...container.querySelectorAll(".set-row")].forEach((row, index) => {
    row.querySelector(".set-index").textContent = `${index + 1}セット目`;
  });
}

function ensureExerciseExists() {
  if (elements.exerciseList.children.length === 0) {
    addExerciseCard();
  }
}

function handleSubmit(event) {
  event.preventDefault();

  const exercises = [...elements.exerciseList.querySelectorAll(".exercise-card")]
    .map((card) => serializeExercise(card))
    .filter(Boolean);

  if (exercises.length === 0) {
    alert("少なくとも1つの種目を入力してください。");
    return;
  }

  const workout = {
    id: crypto.randomUUID(),
    date: elements.workoutDate.value,
    note: elements.workoutNote.value.trim(),
    exercises,
    createdAt: Date.now(),
  };

  state.workouts.unshift(workout);
  state.selectedWorkoutId = workout.id;
  saveWorkouts();
  render();
  resetForm();
}

function serializeExercise(card) {
  const name = card.querySelector(".exercise-name").value.trim();
  if (!name) return null;

  const sets = [...card.querySelectorAll(".set-row")]
    .map((row) => {
      const weight = row.querySelector(".set-weight").value;
      const reps = row.querySelector(".set-reps").value;
      if (!weight || !reps) return null;

      return {
        weight: Number(weight),
        reps: Number(reps),
      };
    })
    .filter(Boolean);

  if (sets.length === 0) return null;

  return { name, sets };
}

function resetForm() {
  elements.form.reset();
  elements.workoutDate.value = getToday();
  elements.exerciseList.innerHTML = "";
  addExerciseCard();
}

function render() {
  renderStats();
  renderHistory();
  renderDetail();
}

function renderStats() {
  elements.totalWorkouts.textContent = String(state.workouts.length);
  const exerciseNames = new Set(
    state.workouts.flatMap((workout) => workout.exercises.map((exercise) => exercise.name.toLowerCase()))
  );
  elements.totalExercises.textContent = String(exerciseNames.size);
}

function renderHistory() {
  elements.historyList.innerHTML = "";
  const hasHistory = state.workouts.length > 0;
  elements.emptyHistory.classList.toggle("hidden", hasHistory);

  state.workouts.forEach((workout) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-item";
    const date = document.createElement("div");
    const summary = document.createElement("p");

    date.className = "history-item-date";
    date.textContent = formatDate(workout.date);

    summary.className = "history-item-summary";
    summary.textContent = summarizeWorkout(workout);

    if (workout.id === state.selectedWorkoutId) {
      button.classList.add("active");
    }

    button.append(date, summary);

    button.addEventListener("click", () => {
      state.selectedWorkoutId = workout.id;
      render();
    });

    elements.historyList.appendChild(button);
  });
}

function renderDetail() {
  const selectedWorkout = state.workouts.find((workout) => workout.id === state.selectedWorkoutId);
  const hasSelection = Boolean(selectedWorkout);

  elements.detailEmpty.classList.toggle("hidden", hasSelection);
  elements.detailView.classList.toggle("hidden", !hasSelection);

  if (!selectedWorkout) {
    elements.detailView.innerHTML = "";
    return;
  }

  elements.detailView.innerHTML = `
    <div class="detail-header">
      <div>
        <h3>${formatDate(selectedWorkout.date)}</h3>
        <p class="detail-subtext">${selectedWorkout.exercises.length}種目</p>
      </div>
      <button id="delete-workout" class="ghost-button" type="button">削除</button>
    </div>
    ${
      selectedWorkout.note
        ? `<p class="detail-note">${escapeHtml(selectedWorkout.note)}</p>`
        : '<p class="detail-note">メモはありません。</p>'
    }
    ${selectedWorkout.exercises
      .map(
        (exercise) => `
          <section class="detail-exercise">
            <h3>${escapeHtml(exercise.name)}</h3>
            <div class="detail-sets">
              ${exercise.sets
                .map(
                  (set, index) =>
                    `<span class="detail-pill">${index + 1}セット目 ${set.weight}kg × ${set.reps}回</span>`
                )
                .join("")}
            </div>
          </section>
        `
      )
      .join("")}
  `;

  elements.detailView.querySelector("#delete-workout").addEventListener("click", () => {
    const confirmed = window.confirm("このワークアウト記録を削除しますか？");
    if (!confirmed) return;

    state.workouts = state.workouts.filter((workout) => workout.id !== selectedWorkout.id);
    state.selectedWorkoutId = state.workouts[0]?.id ?? null;
    saveWorkouts();
    render();
  });
}

function updatePreviousRecord(nameInput, target) {
  const name = nameInput.value.trim().toLowerCase();
  if (!name) {
    target.classList.add("hidden");
    target.textContent = "";
    return;
  }

  const lastRecord = findPreviousRecord(name);
  if (!lastRecord) {
    target.classList.add("hidden");
    target.textContent = "";
    return;
  }

  const setSummary = lastRecord.sets.map((set) => `${set.weight}kg×${set.reps}`).join(" / ");
  target.textContent = `前回: ${formatDate(lastRecord.date)} - ${setSummary}`;
  target.classList.remove("hidden");
}

function findPreviousRecord(exerciseName) {
  for (const workout of state.workouts) {
    const match = workout.exercises.find((exercise) => exercise.name.trim().toLowerCase() === exerciseName);
    if (match) {
      return {
        date: workout.date,
        sets: match.sets,
      };
    }
  }
  return null;
}

function summarizeWorkout(workout) {
  const names = workout.exercises.map((exercise) => exercise.name).join(" / ");
  return names || "種目なし";
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
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
