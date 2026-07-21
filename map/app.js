(() => {
  "use strict";

  const DATA = window.KOREA_MAP_DATA || [];
  const SVG_NS = "http://www.w3.org/2000/svg";
  const BEST_KEY = "eodige-speedrun-best-v1";
  const SETTINGS_KEY = "eodige-speedrun-settings-v1";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const elements = {
    setup: $("#setupScreen"),
    game: $("#gameScreen"),
    result: $("#resultScreen"),
    setupForm: $("#setupForm"),
    scopeFieldset: $("#scopeFieldset"),
    scopeSelect: $("#scopeSelect"),
    northToggle: $("#northToggle"),
    soundToggle: $("#soundToggle"),
    poolSummary: $("#poolSummary"),
    setupBest: $("#setupBest"),
    previewMap: $("#previewMap"),
    gameMap: $("#gameMap"),
    baseLayer: $("#baseLayer"),
    regionLayer: $("#regionLayer"),
    targetRing: $("#targetRing"),
    mapPanel: $("#mapPanel"),
    mapCanvas: $(".map-canvas"),
    mapHint: $("#mapHint"),
    questionNumber: $("#questionNumber"),
    countdown: $("#countdown"),
    modeLabel: $("#modeLabel"),
    correctCount: $("#correctCount"),
    streakCount: $("#streakCount"),
    timerText: $("#timerText"),
    timerFill: $("#timerFill"),
    timerBox: $("#timerBox"),
    answerInput: $("#answerInput"),
    answerBox: $("#answerBox"),
    feedback: $("#feedback"),
    skipButton: $("#skipButton"),
    quitButton: $("#quitButton"),
    zoomInButton: $("#zoomInButton"),
    zoomOutButton: $("#zoomOutButton"),
    resetZoomButton: $("#resetZoomButton"),
    fullMapButton: $("#fullMapButton"),
    resultCorrect: $("#resultCorrect"),
    resultStreak: $("#resultStreak"),
    resultAccuracy: $("#resultAccuracy"),
    resultSpeed: $("#resultSpeed"),
    recordRibbon: $("#recordRibbon"),
    missedSection: $("#missedSection"),
    missedList: $("#missedList"),
    resultMap: $("#resultMap"),
    retryButton: $("#retryButton"),
    settingsButton: $("#settingsButton"),
    shareButton: $("#shareButton"),
    toast: $("#toast"),
    confetti: $("#confetti"),
  };

  const provinceRegions = DATA.filter((region) => region.level === "province");
  const cityCountyRegions = DATA.filter((region) => region.level === "citycounty");
  const municipalRegions = DATA.filter((region) => region.level === "municipal");
  const southProvinces = provinceRegions.filter((region) => region.country === "south");
  const northProvinces = provinceRegions.filter((region) => region.country === "north");
  const northMunicipalRegions = municipalRegions.filter((region) => region.country === "north");
  const northCityCountyRegions = northMunicipalRegions.filter((region) => !/(구|구역|지구)$/u.test(region.name));
  const wholeCityNames = new Set([
    "서울특별시",
    "부산광역시",
    "대구광역시",
    "인천광역시",
    "광주광역시",
    "대전광역시",
    "울산광역시",
    "세종특별자치시",
  ]);
  const southCityCountyRegions = [
    ...cityCountyRegions.filter((region) => region.country === "south" && !wholeCityNames.has(region.province)),
    ...southProvinces.filter((region) => wholeCityNames.has(region.name)),
  ];

  let settings = loadSettings();
  let bestScores = loadJSON(BEST_KEY, {});
  let game = null;
  let timerFrame = 0;
  let nextQuestionTimer = 0;
  let feedbackTimer = 0;
  let toastTimer = 0;
  let audioContext = null;
  let composing = false;
  let viewBox = { x: 0, y: 0, width: 600, height: 900 };
  let defaultViewBox = { ...viewBox };
  let wholeMapViewBox = { ...viewBox };
  let dragState = null;

  function loadJSON(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function loadSettings() {
    const loaded = {
      level: "citycounty",
      scope: "all",
      duration: 60,
      north: false,
      sound: true,
      ...loadJSON(SETTINGS_KEY, {}),
    };
    if (!["citycounty", "municipal"].includes(loaded.level)) loaded.level = "citycounty";
    loaded.duration = 60;
    return loaded;
  }

  function normalizeAnswer(value) {
    return value
      .normalize("NFC")
      .toLocaleLowerCase("ko-KR")
      .replace(/[\s·.\-_]/g, "");
  }

  function answerMatches(region, value) {
    if (!region) return false;
    const answer = normalizeAnswer(value);
    return answer.length > 0 && region.aliases.some((alias) => normalizeAnswer(alias) === answer);
  }

  function escapeHTML(value) {
    return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  }

  function shuffle(values) {
    const result = [...values];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function currentFormSettings() {
    return {
      level: $("input[name='level']:checked").value,
      scope: elements.scopeSelect.value,
      duration: 60,
      north: elements.northToggle.checked,
      sound: elements.soundToggle.checked,
    };
  }

  function applySettingsToForm() {
    const levelInput = $(`input[name='level'][value='${settings.level}']`);
    if (levelInput) levelInput.checked = true;
    elements.northToggle.checked = settings.north;
    elements.soundToggle.checked = settings.sound;
    populateScopes();
    if ([...elements.scopeSelect.options].some((option) => option.value === settings.scope)) {
      elements.scopeSelect.value = settings.scope;
    }
    updateSetup();
  }

  function populateScopes() {
    const includeNorth = elements.northToggle.checked;
    const provinces = includeNorth ? [...southProvinces, ...northProvinces] : southProvinces;
    const selected = elements.scopeSelect.value;
    elements.scopeSelect.innerHTML = [
      '<option value="all">전국 전체</option>',
      ...provinces.map((region) => `<option value="${escapeHTML(region.name)}">${escapeHTML(region.name)}</option>`),
    ].join("");
    elements.scopeSelect.value = [...elements.scopeSelect.options].some((option) => option.value === selected) ? selected : "all";
  }

  function getPool(candidateSettings = currentFormSettings()) {
    const southSource = candidateSettings.level === "citycounty"
      ? southCityCountyRegions
      : municipalRegions.filter((region) => region.country === "south");
    const northSource = candidateSettings.level === "citycounty" ? northCityCountyRegions : northMunicipalRegions;
    const source = candidateSettings.north ? [...southSource, ...northSource] : southSource;
    return source.filter((region) => {
      return candidateSettings.scope === "all" || region.province === candidateSettings.scope;
    });
  }

  function getMapRegions(candidateSettings = settings) {
    const southSource = municipalRegions.filter((region) => region.country === "south");
    return candidateSettings.north ? [...southSource, ...northMunicipalRegions] : southSource;
  }

  function bestKey(candidateSettings = currentFormSettings()) {
    return [candidateSettings.level, candidateSettings.scope, candidateSettings.duration, candidateSettings.north ? "north" : "south"].join(":");
  }

  function updateSetup() {
    const current = currentFormSettings();
    const pool = getPool(current);
    const northCount = pool.filter((region) => region.country === "north").length;
    const unit = current.level === "citycounty" ? "시·군" : "시·군·구";
    const countryText = northCount ? `남북한 ${unit} ${pool.length}곳` : `남한 ${unit} ${pool.length}곳`;
    elements.poolSummary.textContent = `${countryText}이 출제됩니다.`;
    elements.setupBest.textContent = bestScores[bestKey(current)]?.correct ?? "—";
  }

  function createPath(region, className = "") {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", region.path);
    path.setAttribute("data-id", region.id);
    path.setAttribute("class", className);
    return path;
  }

  function unionBounds(regions) {
    if (!regions.length) return [0, 0, 600, 900];
    return regions.reduce((bounds, region) => [
      Math.min(bounds[0], region.bounds[0]),
      Math.min(bounds[1], region.bounds[1]),
      Math.max(bounds[2], region.bounds[2]),
      Math.max(bounds[3], region.bounds[3]),
    ], [Infinity, Infinity, -Infinity, -Infinity]);
  }

  function paddedViewBox(bounds, padding = 0.08) {
    let [minX, minY, maxX, maxY] = bounds;
    let width = Math.max(1, maxX - minX);
    let height = Math.max(1, maxY - minY);
    const pad = Math.max(width, height) * padding;
    minX -= pad;
    minY -= pad;
    width += pad * 2;
    height += pad * 2;
    return { x: minX, y: minY, width, height };
  }

  function setViewBox(next) {
    viewBox = { ...next };
    elements.gameMap.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  }

  function renderPreview() {
    elements.previewMap.replaceChildren();
    const southMunicipalities = municipalRegions.filter((region) => region.country === "south");
    const bounds = unionBounds(southMunicipalities);
    elements.previewMap.setAttribute("viewBox", Object.values(paddedViewBox(bounds, .035)).join(" "));
    southMunicipalities.forEach((region) => elements.previewMap.append(createPath(region)));
    const previewTarget = cityCountyRegions.find((region) => region.name === "수원시");
    if (previewTarget) elements.previewMap.append(createPath(previewTarget, "preview-target"));
  }

  function renderGameMap() {
    if (!game?.current) return;
    const current = game.current;
    const detailRegions = getMapRegions();

    elements.baseLayer.replaceChildren();
    elements.regionLayer.replaceChildren();

    detailRegions.forEach((region) => {
      const provinceClass = region.province === current.province ? " province-context" : "";
      const targetClass = region.id === current.id ? " target" : "";
      const className = `quiz-region${provinceClass}${targetClass}`;
      elements.regionLayer.append(createPath(region, className));
    });
    if (settings.level === "citycounty" && current.country === "south") {
      elements.regionLayer.append(createPath(current, "quiz-region target"));
    }

    const wholeMapView = paddedViewBox(unionBounds(detailRegions), .06);
    wholeMapViewBox = { ...wholeMapView };
    const currentProvince = provinceRegions.find((region) => (
      region.country === current.country && region.name === current.province
    ));
    defaultViewBox = currentProvince
      ? paddedViewBox(currentProvince.bounds, .34)
      : { ...wholeMapView };
    setViewBox(defaultViewBox);
    const [minX, minY, maxX, maxY] = current.bounds;
    elements.targetRing.setAttribute("cx", String((minX + maxX) / 2));
    elements.targetRing.setAttribute("cy", String((minY + maxY) / 2));
    elements.targetRing.setAttribute("r", String(Math.max(4, Math.min(12, defaultViewBox.height * .025))));
  }

  function renderResultMap() {
    elements.resultMap.replaceChildren();
    const enabled = getMapRegions();
    const answeredIds = new Set(game.answered.map((region) => region.id));
    const bounds = unionBounds(enabled);
    elements.resultMap.setAttribute("viewBox", Object.values(paddedViewBox(bounds, .035)).join(" "));
    enabled.forEach((region) => elements.resultMap.append(createPath(region, answeredIds.has(region.id) ? "result-hit" : "")));
    if (settings.level === "citycounty") {
      game.answered
        .filter((region) => region.country === "south")
        .forEach((region) => elements.resultMap.append(createPath(region, "result-hit")));
    }
  }

  function modeText() {
    const unit = settings.level === "citycounty" ? "시·군" : "시·군·구";
    const scope = settings.scope === "all" ? (settings.north ? "남북한" : "전국") : settings.scope;
    return `${scope} · ${unit}`;
  }

  function screen(name) {
    elements.setup.hidden = name !== "setup";
    elements.game.hidden = name !== "game";
    elements.result.hidden = name !== "result";
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function beginGame(candidateSettings = currentFormSettings()) {
    clearTimeout(nextQuestionTimer);
    cancelAnimationFrame(timerFrame);
    settings = { ...candidateSettings, duration: 60 };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    const pool = getPool(settings);
    if (!pool.length) {
      showToast("출제할 지역이 없습니다. 설정을 바꿔주세요.");
      return;
    }

    game = {
      pool,
      queue: [],
      current: null,
      correct: 0,
      streak: 0,
      maxStreak: 0,
      attempts: 0,
      skips: 0,
      question: 0,
      questionStartedAt: 0,
      responseTimes: [],
      missed: [],
      answered: [],
      accepting: false,
      running: false,
      endAt: 0,
      durationMs: settings.duration * 1000,
    };

    elements.modeLabel.textContent = modeText();
    elements.correctCount.textContent = "0";
    elements.streakCount.textContent = "0";
    elements.timerText.textContent = formatTime(game.durationMs);
    elements.timerFill.style.transform = "scaleX(1)";
    elements.timerBox.classList.remove("danger");
    elements.answerInput.value = "";
    elements.answerInput.disabled = true;
    elements.skipButton.disabled = true;
    setFeedback("ready", "준비하세요");
    screen("game");
    chooseNext();
    await runCountdown();
    if (!game) return;
    game.running = true;
    game.questionStartedAt = performance.now();
    game.endAt = performance.now() + game.durationMs;
    elements.answerInput.disabled = false;
    elements.skipButton.disabled = false;
    elements.answerInput.focus({ preventScroll: true });
    setFeedback("ready", "");
    playSound("start");
    tickTimer();
  }

  async function runCountdown() {
    elements.countdown.hidden = false;
    const label = elements.countdown.querySelector("span");
    for (const value of [3, 2, 1]) {
      if (!game) break;
      label.textContent = value;
      label.style.animation = "none";
      void label.offsetWidth;
      label.style.animation = "";
      await new Promise((resolve) => setTimeout(resolve, 680));
    }
    elements.countdown.hidden = true;
  }

  function refillQueue() {
    const shuffled = shuffle(game.pool);
    if (game.current && shuffled[0]?.id === game.current.id && shuffled.length > 1) {
      [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
    }
    game.queue.push(...shuffled);
  }

  function chooseNext() {
    if (!game) return;
    if (!game.queue.length) refillQueue();
    game.current = game.queue.shift();
    game.accepting = true;
    game.question += 1;
    game.questionStartedAt = performance.now();
    elements.answerInput.value = "";
    elements.questionNumber.textContent = `QUESTION ${String(game.question).padStart(2, "0")}`;
    elements.mapHint.textContent = "진한 파란색 지역은 어디일까요?";
    renderGameMap();
  }

  function submitCorrect() {
    if (!game?.running || !game.accepting) return;
    game.accepting = false;
    const elapsed = performance.now() - game.questionStartedAt;

    game.correct += 1;
    game.attempts += 1;
    game.streak += 1;
    game.maxStreak = Math.max(game.maxStreak, game.streak);
    game.responseTimes.push(elapsed);
    game.answered.push(game.current);

    elements.correctCount.textContent = game.correct;
    elements.streakCount.textContent = game.streak;
    elements.answerBox.classList.add("is-correct");
    setFeedback("correct", `<strong>정답!</strong>${game.streak >= 3 ? ` · ${game.streak}연속` : ""}`);
    playSound("correct");

    clearTimeout(nextQuestionTimer);
    nextQuestionTimer = setTimeout(() => {
      elements.answerBox.classList.remove("is-correct");
      chooseNext();
      elements.answerInput.focus({ preventScroll: true });
    }, 85);
  }

  function skipQuestion() {
    if (!game?.running || !game.accepting) return;
    game.accepting = false;
    game.attempts += 1;
    game.skips += 1;
    game.streak = 0;
    game.endAt -= 1500;
    game.missed.push(game.current);
    elements.streakCount.textContent = "0";
    elements.answerInput.value = "";
    const targetPath = elements.regionLayer.querySelector(`[data-id="${CSS.escape(game.current.id)}"]`);
    targetPath?.classList.replace("target", "revealed");
    setFeedback("wrong", `정답은 <strong>${escapeHTML(game.current.name)}</strong> · 1.5초 차감`);
    playSound("skip");
    elements.answerInput.disabled = true;
    elements.skipButton.disabled = true;
    clearTimeout(nextQuestionTimer);
    nextQuestionTimer = setTimeout(() => {
      if (!game?.running) return;
      chooseNext();
      elements.answerInput.disabled = false;
      elements.skipButton.disabled = false;
      elements.answerInput.focus({ preventScroll: true });
    }, 520);
  }

  function formatTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function tickTimer() {
    if (!game?.running) return;
    const remaining = game.endAt - performance.now();
    if (remaining <= 0) {
      endGame();
      return;
    }
    elements.timerText.textContent = formatTime(remaining);
    elements.timerFill.style.transform = `scaleX(${Math.max(0, remaining / game.durationMs)})`;
    elements.timerBox.classList.toggle("danger", remaining <= 10000);
    timerFrame = requestAnimationFrame(tickTimer);
  }

  function endGame({ quit = false } = {}) {
    if (!game) return;
    game.running = false;
    cancelAnimationFrame(timerFrame);
    clearTimeout(nextQuestionTimer);
    elements.answerInput.disabled = true;
    elements.skipButton.disabled = true;
    playSound("end");

    if (quit) {
      game = null;
      screen("setup");
      updateSetup();
      return;
    }

    const accuracy = game.attempts ? Math.round((game.correct / game.attempts) * 100) : 100;
    const average = game.responseTimes.length
      ? game.responseTimes.reduce((sum, value) => sum + value, 0) / game.responseTimes.length
      : 0;
    const key = bestKey(settings);
    const priorBest = bestScores[key]?.correct ?? -1;
    const isRecord = game.correct > priorBest;
    if (isRecord) {
      bestScores[key] = { correct: game.correct, date: new Date().toISOString() };
      localStorage.setItem(BEST_KEY, JSON.stringify(bestScores));
    }

    elements.resultCorrect.textContent = game.correct;
    elements.resultStreak.textContent = game.maxStreak;
    elements.resultAccuracy.textContent = `${accuracy}%`;
    elements.resultSpeed.textContent = average ? `${(average / 1000).toFixed(1)}초` : "—";
    elements.recordRibbon.hidden = !isRecord;
    const uniqueMissed = [...new Map(game.missed.map((region) => [region.id, region])).values()].slice(-6);
    elements.missedSection.hidden = uniqueMissed.length === 0;
    elements.missedList.innerHTML = uniqueMissed.map((region) => `<b>${escapeHTML(region.name)}</b>`).join("");
    renderResultMap();
    screen("result");
    if (isRecord && game.correct > 0) launchConfetti();
  }

  function setFeedback(type, html) {
    clearTimeout(feedbackTimer);
    elements.feedback.className = `feedback ${type === "ready" ? "" : type}`;
    elements.feedback.innerHTML = `<span>${html}</span>`;
    if (type !== "ready") {
      feedbackTimer = setTimeout(() => setFeedback("ready", ""), 900);
    }
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 1800);
  }

  function playSound(type) {
    if (!settings.sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      const now = audioContext.currentTime;
      const notes = {
        start: [[440, 0], [660, .07]],
        correct: [[660, 0], [880, .055]],
        skip: [[260, 0], [210, .07]],
        end: [[520, 0], [390, .11], [260, .22]],
      }[type] || [];
      notes.forEach(([frequency, delay]) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(.0001, now + delay);
        gain.gain.exponentialRampToValueAtTime(.055, now + delay + .008);
        gain.gain.exponentialRampToValueAtTime(.0001, now + delay + .095);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(now + delay);
        oscillator.stop(now + delay + .11);
      });
    } catch {
      // Audio is a progressive enhancement; gameplay must never depend on it.
    }
  }

  function launchConfetti() {
    elements.confetti.replaceChildren();
    const colors = ["#ff654f", "#f4ce55", "#1d8068", "#ffffff"];
    for (let index = 0; index < 34; index += 1) {
      const piece = document.createElement("i");
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[index % colors.length];
      piece.style.setProperty("--fall", `${1.3 + Math.random() * 1.4}s`);
      piece.style.setProperty("--drift", `${-80 + Math.random() * 160}px`);
      piece.style.setProperty("--rotate", `${Math.random() * 180}deg`);
      piece.style.animationDelay = `${Math.random() * .45}s`;
      elements.confetti.append(piece);
    }
    setTimeout(() => elements.confetti.replaceChildren(), 3200);
  }

  function zoomMap(factor) {
    const nextWidth = Math.max(defaultViewBox.width * .15, Math.min(wholeMapViewBox.width * 1.5, viewBox.width * factor));
    const nextHeight = Math.max(defaultViewBox.height * .15, Math.min(wholeMapViewBox.height * 1.5, viewBox.height * factor));
    const centerX = viewBox.x + viewBox.width / 2;
    const centerY = viewBox.y + viewBox.height / 2;
    setViewBox({ x: centerX - nextWidth / 2, y: centerY - nextHeight / 2, width: nextWidth, height: nextHeight });
  }

  function shareResult() {
    if (!game) return;
    const text = `🗺️ 어디게? 백지도 스피드런\n${modeText()} · ${settings.duration}초\n${game.correct}곳 정답 · 최고 ${game.maxStreak}연속\n${location.href}`;
    if (navigator.share) {
      navigator.share({ title: "어디게? 백지도 스피드런", text }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(text).then(() => showToast("결과를 클립보드에 복사했습니다."), () => showToast("공유 문구를 복사하지 못했습니다."));
  }

  elements.setupForm.addEventListener("change", (event) => {
    if (event.target === elements.northToggle) populateScopes();
    updateSetup();
  });
  elements.scopeSelect.addEventListener("change", updateSetup);
  elements.setupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    beginGame();
  });
  elements.answerInput.addEventListener("compositionstart", () => { composing = true; });
  elements.answerInput.addEventListener("compositionend", () => {
    composing = false;
    if (answerMatches(game?.current, elements.answerInput.value)) submitCorrect();
  });
  elements.answerInput.addEventListener("input", () => {
    if (!composing && answerMatches(game?.current, elements.answerInput.value)) submitCorrect();
  });
  elements.answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      if (answerMatches(game?.current, elements.answerInput.value)) submitCorrect();
      else skipQuestion();
    }
  });
  elements.skipButton.addEventListener("click", skipQuestion);
  elements.quitButton.addEventListener("click", () => endGame({ quit: true }));
  elements.retryButton.addEventListener("click", () => beginGame(settings));
  elements.settingsButton.addEventListener("click", () => {
    game = null;
    applySettingsToForm();
    screen("setup");
  });
  elements.shareButton.addEventListener("click", shareResult);
  elements.zoomInButton.addEventListener("click", () => zoomMap(.78));
  elements.zoomOutButton.addEventListener("click", () => zoomMap(1.28));
  elements.resetZoomButton.addEventListener("click", () => setViewBox(defaultViewBox));
  elements.fullMapButton.addEventListener("click", () => setViewBox(wholeMapViewBox));
  elements.mapCanvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomMap(event.deltaY < 0 ? .84 : 1.18);
  }, { passive: false });
  elements.mapCanvas.addEventListener("dblclick", (event) => {
    event.preventDefault();
    zoomMap(.72);
  });
  elements.mapCanvas.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    elements.mapCanvas.setPointerCapture(event.pointerId);
    dragState = { clientX: event.clientX, clientY: event.clientY, viewBox: { ...viewBox } };
  });
  elements.mapCanvas.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    const rect = elements.gameMap.getBoundingClientRect();
    const dx = ((event.clientX - dragState.clientX) / rect.width) * dragState.viewBox.width;
    const dy = ((event.clientY - dragState.clientY) / rect.height) * dragState.viewBox.height;
    setViewBox({ ...dragState.viewBox, x: dragState.viewBox.x - dx, y: dragState.viewBox.y - dy });
  });
  elements.mapCanvas.addEventListener("pointerup", () => { dragState = null; });
  elements.mapCanvas.addEventListener("pointercancel", () => { dragState = null; });
  document.addEventListener("keydown", (event) => {
    if (!elements.setup.hidden && event.ctrlKey && event.key === "Enter") {
      event.preventDefault();
      elements.setupForm.requestSubmit();
    }
    if (game?.running && event.key === "Escape") {
      event.preventDefault();
      skipQuestion();
    }
    if (game?.running && event.key === "/" && document.activeElement !== elements.answerInput) {
      event.preventDefault();
      elements.answerInput.focus();
    }
  });

  window.GAME_TEST = { normalizeAnswer, answerMatches, getPool, paddedViewBox };

  renderPreview();
  applySettingsToForm();
})();
