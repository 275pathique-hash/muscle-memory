const STORAGE_KEY = "workout-log-app-v2";

const state = {
  sessions: loadSessions(),
  selectedExercise: null,
};

const elements = {
  exerciseSelect: document.querySelector("#exercise-select"),
  analysisEmpty: document.querySelector("#analysis-empty"),
  analysisSummary: document.querySelector("#analysis-summary"),
  chart: document.querySelector("#growth-chart"),
  countChart: document.querySelector("#count-chart"),
};

bootstrap();

function bootstrap() {
  const exerciseNames = getExerciseNames();
  state.selectedExercise = exerciseNames[0] ?? null;

  elements.exerciseSelect.addEventListener("change", (event) => {
    state.selectedExercise = event.target.value || null;
    render();
  });

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

function getExerciseNames() {
  const names = new Set();
  state.sessions.forEach((session) => {
    (session.exercises ?? []).forEach((exercise) => {
      if (exercise.name) names.add(exercise.name);
    });
  });
  return [...names];
}

function render() {
  renderSelect();
  renderSummary();
  renderChart();
  renderCountChart();
}

function renderSelect() {
  const names = getExerciseNames();
  elements.exerciseSelect.innerHTML = "";

  if (!names.length) {
    const option = document.createElement("option");
    option.textContent = "記録なし";
    option.value = "";
    elements.exerciseSelect.appendChild(option);
    elements.exerciseSelect.disabled = true;
    return;
  }

  elements.exerciseSelect.disabled = false;
  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    if (name === state.selectedExercise) option.selected = true;
    elements.exerciseSelect.appendChild(option);
  });
}

function renderSummary() {
  const points = buildPoints(state.selectedExercise);
  const hasData = points.length > 0;

  elements.analysisEmpty.classList.toggle("hidden", hasData);
  elements.analysisSummary.classList.toggle("hidden", !hasData);

  if (!hasData) {
    elements.analysisSummary.innerHTML = "";
    return;
  }

  const first = points[0].maxWeight;
  const latest = points[points.length - 1].maxWeight;
  const growthRate = first === 0 ? 0 : ((latest - first) / first) * 100;

  elements.analysisSummary.innerHTML = `
    <div class="detail-row"><span>初回最高重量</span><strong>${first}kg</strong></div>
    <div class="detail-row"><span>最新最高重量</span><strong>${latest}kg</strong></div>
    <div class="detail-row"><span>成長率</span><strong>${growthRate.toFixed(1)}%</strong></div>
    <div class="detail-row"><span>記録回数</span><strong>${points.length}回</strong></div>
    <div class="detail-row"><span>最新体重</span><strong>${formatBodyweight(points[points.length - 1].bodyweight)}</strong></div>
  `;
}

function renderChart() {
  const ctx = elements.chart.getContext("2d");
  const points = buildPoints(state.selectedExercise);
  const width = elements.chart.width;
  const height = elements.chart.height;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, width, height);

  if (!points.length) {
    ctx.fillStyle = "#6e625b";
    ctx.font = "24px sans-serif";
    ctx.fillText("データがありません", 40, 60);
    return;
  }

  const padding = 48;
  const maxWeight = Math.max(...points.map((point) => point.maxWeight), 1);
  const stepX = points.length === 1 ? 0 : (width - padding * 2) / (points.length - 1);

  ctx.strokeStyle = "rgba(61, 52, 45, 0.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = padding + ((height - padding * 2) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#c55b2d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = padding + stepX * index;
    const y = height - padding - (point.maxWeight / maxWeight) * (height - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#c55b2d";
  points.forEach((point, index) => {
    const x = padding + stepX * index;
    const y = height - padding - (point.maxWeight / maxWeight) * (height - padding * 2);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(String(point.maxWeight), x - 8, y - 12);
  });

  ctx.fillStyle = "#6e625b";
  ctx.font = "12px sans-serif";
  points.forEach((point, index) => {
    const x = padding + stepX * index;
    ctx.fillText(formatShortDate(point.date), x - 18, height - 18);
  });
}

function buildPoints(exerciseName) {
  if (!exerciseName) return [];

  return state.sessions
    .slice()
    .reverse()
    .map((session) => {
      const exercise = (session.exercises ?? []).find((entry) => entry.name === exerciseName);
      if (!exercise) return null;
      const maxWeight = Math.max(...(exercise.sets ?? []).map((set) => Number(set.weight) || 0), 0);
      return { date: session.date, maxWeight, bodyweight: session.bodyweight };
    })
    .filter(Boolean);
}

function renderCountChart() {
  const ctx = elements.countChart.getContext("2d");
  const points = buildCountPoints(state.selectedExercise);
  drawLineChart(ctx, elements.countChart.width, elements.countChart.height, points, "count");
}

function buildCountPoints(exerciseName) {
  if (!exerciseName) return [];

  let count = 0;
  return state.sessions
    .slice()
    .reverse()
    .map((session) => {
      const exists = (session.exercises ?? []).some((entry) => entry.name === exerciseName);
      if (!exists) return null;
      count += 1;
      return { date: session.date, value: count };
    })
    .filter(Boolean);
}

function drawLineChart(ctx, width, height, points, mode) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, width, height);

  if (!points.length) {
    ctx.fillStyle = "#6e625b";
    ctx.font = "24px sans-serif";
    ctx.fillText("データがありません", 40, 60);
    return;
  }

  const padding = 48;
  const values = points.map((point) => (mode === "count" ? point.value : point.maxWeight));
  const maxValue = Math.max(...values, 1);
  const stepX = points.length === 1 ? 0 : (width - padding * 2) / (points.length - 1);

  ctx.strokeStyle = "rgba(61, 52, 45, 0.14)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = padding + ((height - padding * 2) / 3) * i;
    ctx.beginPath();
    ctx.moveTo(padding, y);
    ctx.lineTo(width - padding, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#c55b2d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((point, index) => {
    const value = mode === "count" ? point.value : point.maxWeight;
    const x = padding + stepX * index;
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#c55b2d";
  points.forEach((point, index) => {
    const value = mode === "count" ? point.value : point.maxWeight;
    const x = padding + stepX * index;
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(String(value), x - 8, y - 12);
  });

  ctx.fillStyle = "#6e625b";
  ctx.font = "12px sans-serif";
  points.forEach((point, index) => {
    const x = padding + stepX * index;
    ctx.fillText(formatShortDate(point.date), x - 18, height - 18);
  });
}

function formatShortDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatBodyweight(value) {
  if (value === null || value === undefined || value === "") return "未入力";
  return `${value}kg`;
}
