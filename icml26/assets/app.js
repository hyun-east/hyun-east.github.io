const DATA = {
  site: "data/site/icml2026_site_data.json",
  enriched: "data/processed/icml2026_papers_with_keywords.json",
  papers: "data/processed/icml2026_papers.json",
  sessions: "data/processed/icml2026_sessions.json",
};

const DISPLAY_LOCALE = "en-US";
const DISPLAY_TIME_ZONE = "Asia/Seoul";
const DISPLAY_TIME_ZONE_LABEL = "KST";
const KEYWORD_RENDER_LIMIT = 320;
const SELECTED_KEYWORD_PREVIEW_LIMIT = 8;
const SESSION_NOW_PREVIEW_LIMIT = 3;

const state = {
  papers: [],
  sessions: [],
  keywordCounts: new Map(),
  selectedKeywords: new Set(),
  selectedKeywordQueries: new Set(),
  selectedKeywordsExpanded: false,
  plannedIds: new Set(JSON.parse(localStorage.getItem("icml2026.plan") || "[]")),
  openIds: new Set(),
  view: "papers",
  keywordMode: "or",
  visibleLimit: 150,
  currentSessions: new Set(),
  nextSession: null,
  nextSessions: [],
  sessionNowExpanded: false,
};

const els = {};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeKeyword(value) {
  return String(value || "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function parseTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatTime(value, options = {}) {
  const parsed = parseTime(value);
  if (!parsed) return "";
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    timeZone: DISPLAY_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...options,
  }).format(parsed);
}

function displayDayKey(value) {
  const parsed = parseTime(value);
  if (!parsed) return "";
  return new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(parsed);
}

function formatRange(start, end) {
  if (!start && !end) return "Unscheduled";
  if (!start) return `${formatTime(end)} ${DISPLAY_TIME_ZONE_LABEL}`;
  if (!end) return `${formatTime(start)} ${DISPLAY_TIME_ZONE_LABEL}`;
  const endOptions = displayDayKey(start) === displayDayKey(end)
    ? { hour: "2-digit", minute: "2-digit" }
    : {};
  return `${formatTime(start)} - ${formatTime(end, endOptions)} ${DISPLAY_TIME_ZONE_LABEL}`;
}

async function loadJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response.json();
}

async function loadData() {
  let paperPayload;
  let sessionPayload;
  let source = "base";
  try {
    const sitePayload = await loadJson(DATA.site);
    paperPayload = sitePayload;
    sessionPayload = sitePayload;
    source = "site";
  } catch {
    try {
      paperPayload = await loadJson(DATA.enriched);
      source = "enriched";
    } catch {
      paperPayload = await loadJson(DATA.papers);
    }
  }
  if (!sessionPayload) {
    sessionPayload = await loadJson(DATA.sessions);
  }
  state.sessions = prepareSessions(sessionPayload.sessions || []);
  state.papers = preparePapers(paperPayload.papers || [], state.sessions);
  computeSessionStatus();
  buildKeywordCounts();

  const labeled = paperPayload.labeled_count ?? state.papers.filter((paper) => paper._keywords.length).length;
  const sourceLabel = source === "base" ? "base metadata" : `${labeled.toLocaleString(DISPLAY_LOCALE)} labeled`;
  els.dataStatus.textContent =
    `${state.papers.length.toLocaleString(DISPLAY_LOCALE)} papers, ${state.sessions.length} sessions, ${sourceLabel}`;
}

function isOralSession(session) {
  return session?.eventtype === "Oral" || /^oral\b/i.test(String(session?.session || ""));
}

function buildOralSessionsByPaper(sessions) {
  const sessionsByPaper = new Map();
  for (const session of sessions.filter(isOralSession)) {
    for (const entry of session.papers || []) {
      if (!entry?.id) continue;
      const matches = sessionsByPaper.get(entry.id) || [];
      matches.push({ session, entry });
      sessionsByPaper.set(entry.id, matches);
    }
  }
  for (const matches of sessionsByPaper.values()) {
    matches.sort((a, b) => (a.session._start?.getTime() ?? 0) - (b.session._start?.getTime() ?? 0));
  }
  return sessionsByPaper;
}

function preparePapers(papers, sessions = []) {
  const oralSessionsByPaper = buildOralSessionsByPaper(sessions);
  const sessionsByName = new Map(sessions.map((session) => [session.session, session]));
  return papers.map((paper) => {
    const keywords = [
      ...(paper.llm_keywords || []),
      ...(paper.llm_new_keywords || []),
      ...(paper.keywords || []),
    ]
      .map(normalizeKeyword)
      .filter(Boolean);
    const uniqueKeywords = [...new Set(keywords)];
    const authors = paper.authors || [];
    const sessions = paper.sessions || [paper.session].filter(Boolean);
    const searchParts = [
      paper.title,
      authors.join(" "),
      paper.topic,
      paper.topic_area,
      paper.topic_subtopic,
      paper.abstract,
      uniqueKeywords.join(" "),
      sessions.join(" "),
      paper.poster_position,
    ];
    const relatedOralSessions = (paper.related_sessions || [])
      .filter((session) => isOralSession(session))
      .map((talk) => ({
        talk,
        session: sessionsByName.get(talk.session) || {
          session: talk.session,
          room_name: talk.room_name,
          starttime: talk.session_starttime || talk.starttime,
          endtime: talk.session_endtime || talk.endtime,
          starttime_utc: talk.session_starttime_utc || talk.starttime_utc,
          endtime_utc: talk.session_endtime_utc || talk.endtime_utc,
        },
      }));
    const fallbackOralSessions = (oralSessionsByPaper.get(paper.id) || []).map(({ session, entry }) => ({
      talk: entry,
      session,
    }));
    return {
      ...paper,
      _keywords: uniqueKeywords,
      _keywordText: uniqueKeywords.join(" | "),
      _search: searchParts.join(" ").toLowerCase(),
      _authorsText: authors.join(", "),
      _sessions: sessions,
      _start: parseTime(paper.starttime_utc || paper.starttime),
      _end: parseTime(paper.endtime_utc || paper.endtime),
      _oralSessions: relatedOralSessions.length ? relatedOralSessions : fallbackOralSessions,
    };
  });
}

function prepareSessions(sessions) {
  return sessions.map((session) => ({
    ...session,
    _start: parseTime(session.starttime_utc || session.starttime),
    _end: parseTime(session.endtime_utc || session.endtime),
    _paperIds: new Set((session.papers || []).map((paper) => paper.id)),
  }));
}

function computeSessionStatus() {
  const now = new Date();
  state.currentSessions = new Set();
  state.nextSession = null;
  state.nextSessions = [];
  let nextStart = null;
  for (const session of state.sessions) {
    if (session._start && session._end && session._start <= now && now <= session._end) {
      state.currentSessions.add(session.session);
    }
    if (session._start && session._start > now) {
      const start = session._start.getTime();
      if (nextStart === null || start < nextStart) {
        nextStart = start;
        state.nextSessions = [session];
      } else if (start === nextStart) {
        state.nextSessions.push(session);
      }
    }
  }
  state.nextSessions.sort(compareSessionsByTime);
  state.nextSession = state.nextSessions[0] || null;
}

function buildKeywordCounts() {
  state.keywordCounts = new Map();
  for (const paper of state.papers) {
    for (const keyword of paper._keywords) {
      state.keywordCounts.set(keyword, (state.keywordCounts.get(keyword) || 0) + 1);
    }
  }
}

function bindElements() {
  for (const id of [
    "dataStatus",
    "clockLabel",
    "themeToggle",
    "filterToggle",
    "filtersPanel",
    "searchInput",
    "areaSelect",
    "topicSelect",
    "sessionSelect",
    "badgeSelect",
    "sortSelect",
    "keywordSearch",
    "keywordMatchSummary",
    "applyKeywordSearch",
    "addKeywordMatches",
    "selectedKeywords",
    "keywordList",
    "clearFilters",
    "resultCount",
    "plannedCount",
    "currentSessionCount",
    "sessionNow",
    "paperList",
    "loadMore",
  ]) {
    els[id] = $(id);
  }
}

function bindEvents() {
  const rerender = () => {
    state.visibleLimit = 150;
    render();
  };
  for (const element of [
    els.searchInput,
    els.areaSelect,
    els.topicSelect,
    els.sessionSelect,
    els.badgeSelect,
    els.sortSelect,
  ]) {
    element.addEventListener("input", rerender);
    element.addEventListener("change", rerender);
  }
  els.areaSelect.addEventListener("change", () => {
    populateTopics();
    rerender();
  });
  els.keywordSearch.addEventListener("input", renderKeywords);
  els.keywordSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const keyword = normalizeKeyword(els.keywordSearch.value);
      if (keyword) {
        if (state.keywordCounts.has(keyword)) state.selectedKeywords.add(keyword);
        else state.selectedKeywordQueries.add(keyword);
        rerender();
      }
    }
  });
  els.applyKeywordSearch.addEventListener("click", () => {
    applyKeywordSearch();
    rerender();
  });
  els.addKeywordMatches.addEventListener("click", () => {
    addVisibleKeywordMatches();
    rerender();
  });
  els.keywordList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-keyword]");
    if (!button) return;
    toggleKeyword(button.dataset.keyword);
  });
  els.selectedKeywords.addEventListener("click", (event) => {
    const toggle = event.target.closest("[data-selected-keywords-toggle]");
    if (toggle) {
      state.selectedKeywordsExpanded = !state.selectedKeywordsExpanded;
      rerender();
      return;
    }
    const button = event.target.closest("[data-keyword], [data-keyword-query]");
    if (!button) return;
    if (button.dataset.keyword) state.selectedKeywords.delete(button.dataset.keyword);
    if (button.dataset.keywordQuery) state.selectedKeywordQueries.delete(button.dataset.keywordQuery);
    if (state.selectedKeywords.size + state.selectedKeywordQueries.size <= SELECTED_KEYWORD_PREVIEW_LIMIT) {
      state.selectedKeywordsExpanded = false;
    }
    rerender();
  });
  document.querySelectorAll("[data-keyword-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.keywordMode = button.dataset.keywordMode;
      document.querySelectorAll("[data-keyword-mode]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      rerender();
    });
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      document.querySelectorAll("[data-view]").forEach((item) => {
        item.classList.toggle("active", item === button);
      });
      rerender();
    });
  });
  els.paperList.addEventListener("click", (event) => {
    const keywordButton = event.target.closest("[data-keyword]");
    if (keywordButton) {
      toggleKeyword(keywordButton.dataset.keyword);
      return;
    }
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = Number(button.dataset.id);
    if (button.dataset.action === "toggle") {
      if (state.openIds.has(id)) state.openIds.delete(id);
      else state.openIds.add(id);
      render();
    }
    if (button.dataset.action === "plan") {
      togglePlan(id);
      render();
    }
  });
  els.clearFilters.addEventListener("click", () => {
    els.searchInput.value = "";
    els.areaSelect.value = "";
    populateTopics();
    els.topicSelect.value = "";
    els.sessionSelect.value = "";
    els.badgeSelect.value = "";
    els.sortSelect.value = "relevance";
    els.keywordSearch.value = "";
    state.selectedKeywords.clear();
    state.selectedKeywordQueries.clear();
    state.selectedKeywordsExpanded = false;
    state.visibleLimit = 150;
    render();
  });
  els.loadMore.addEventListener("click", () => {
    state.visibleLimit += 150;
    render();
  });
  els.themeToggle.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current === "dark" ? "light" : "dark");
  });
  els.filterToggle.addEventListener("click", () => {
    const isOpen = els.filtersPanel.classList.toggle("open");
    els.filterToggle.setAttribute("aria-expanded", String(isOpen));
  });
  els.sessionNow.addEventListener("click", (event) => {
    const button = event.target.closest("[data-session-now-toggle]");
    if (!button) return;
    state.sessionNowExpanded = !state.sessionNowExpanded;
    renderSessionNow();
  });
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("icml2026.theme", theme);
}

function populateSelect(select, values, allLabel = "All") {
  const current = select.value;
  select.innerHTML = `<option value="">${escapeHtml(allLabel)}</option>` + values
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
    .join("");
  if (values.includes(current)) select.value = current;
}

function populateFilters() {
  const areas = [...new Set(state.papers.map((paper) => paper.topic_area).filter(Boolean))].sort();
  const sessions = [...new Set(state.papers.flatMap((paper) => paper._sessions).filter(Boolean))].sort(sessionSort);
  populateSelect(els.areaSelect, areas, "All areas");
  populateSelect(els.sessionSelect, sessions, "All sessions");
  populateTopics();
}

function populateTopics() {
  const area = els.areaSelect.value;
  const topics = [...new Set(
    state.papers
      .filter((paper) => !area || paper.topic_area === area)
      .map((paper) => paper.topic)
      .filter(Boolean),
  )].sort();
  populateSelect(els.topicSelect, topics, "All topics");
}

function sessionSort(a, b) {
  const sessionA = state.sessions.find((session) => session.session === a);
  const sessionB = state.sessions.find((session) => session.session === b);
  const timeA = sessionA?._start?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const timeB = sessionB?._start?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return timeA - timeB || a.localeCompare(b);
}

function toggleKeyword(keyword) {
  const normalized = normalizeKeyword(keyword);
  if (!normalized) return;
  if (state.selectedKeywords.has(normalized)) state.selectedKeywords.delete(normalized);
  else state.selectedKeywords.add(normalized);
  render();
}

function applyKeywordSearch() {
  const query = normalizeKeyword(els.keywordSearch.value);
  if (!query) return;
  state.selectedKeywordQueries.add(query);
}

function addVisibleKeywordMatches() {
  const { visible } = getKeywordMatches();
  for (const [keyword] of visible) {
    state.selectedKeywords.add(keyword);
  }
  if (state.selectedKeywords.size + state.selectedKeywordQueries.size > SELECTED_KEYWORD_PREVIEW_LIMIT) {
    state.selectedKeywordsExpanded = false;
  }
}

function togglePlan(id) {
  if (state.plannedIds.has(id)) state.plannedIds.delete(id);
  else state.plannedIds.add(id);
  localStorage.setItem("icml2026.plan", JSON.stringify([...state.plannedIds]));
}

function getFilters() {
  return {
    query: els.searchInput.value.trim().toLowerCase(),
    area: els.areaSelect.value,
    topic: els.topicSelect.value,
    session: els.sessionSelect.value,
    badge: els.badgeSelect.value,
    sort: els.sortSelect.value,
    keywords: [...state.selectedKeywords],
    keywordQueries: [...state.selectedKeywordQueries],
  };
}

function paperMatches(paper, filters) {
  if (filters.query) {
    const terms = filters.query.split(/\s+/).filter(Boolean);
    if (!terms.every((term) => paper._search.includes(term))) return false;
  }
  if (filters.area && paper.topic_area !== filters.area) return false;
  if (filters.topic && paper.topic !== filters.topic) return false;
  if (filters.session && !paper._sessions.includes(filters.session)) return false;
  if (filters.badge === "spotlight" && !paper.is_spotlight) return false;
  if (filters.badge === "oral" && !paper.has_oral) return false;
  if (filters.badge === "planned" && !state.plannedIds.has(paper.id)) return false;
  if (filters.badge === "unscheduled" && (paper.session || paper.starttime)) return false;
  if (state.view === "plan" && !state.plannedIds.has(paper.id)) return false;
  if (filters.keywords.length || filters.keywordQueries.length) {
    const keywordSet = new Set(paper._keywords);
    const checks = [
      ...filters.keywords.map((keyword) => keywordSet.has(keyword)),
      ...filters.keywordQueries.map((query) => paper._keywords.some((keyword) => keyword.includes(query))),
    ];
    if (state.keywordMode === "and" && checks.some((value) => !value)) return false;
    if (state.keywordMode === "or" && checks.every((value) => !value)) return false;
  }
  return true;
}

function scorePaper(paper, filters) {
  let score = 0;
  if (filters.query) {
    if ((paper.title || "").toLowerCase().includes(filters.query)) score += 20;
    if (paper._authorsText.toLowerCase().includes(filters.query)) score += 8;
    if (paper._keywordText.includes(filters.query)) score += 8;
  }
  for (const keyword of filters.keywords) {
    if (paper._keywords.includes(keyword)) score += 10;
  }
  for (const query of filters.keywordQueries) {
    if (paper._keywords.some((keyword) => keyword.includes(query))) score += 6;
  }
  if (paper.has_oral) score += 3;
  if (paper.is_spotlight) score += 2;
  if (state.plannedIds.has(paper.id)) score += 1;
  return score;
}

function sortPapers(papers, filters) {
  const collator = new Intl.Collator(DISPLAY_LOCALE, { numeric: true, sensitivity: "base" });
  const byTime = (paper) => paper._start?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const byPoster = (paper) => {
    const raw = String(paper.poster_position || "");
    const match = raw.match(/\d+/);
    return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
  };
  return papers.sort((a, b) => {
    if (filters.sort === "session") return byTime(a) - byTime(b) || collator.compare(a.title, b.title);
    if (filters.sort === "badge") {
      return Number(b.has_oral) - Number(a.has_oral)
        || Number(b.is_spotlight) - Number(a.is_spotlight)
        || byTime(a) - byTime(b)
        || collator.compare(a.title, b.title);
    }
    if (filters.sort === "title") return collator.compare(a.title, b.title);
    if (filters.sort === "topic") return collator.compare(a.topic || "", b.topic || "") || collator.compare(a.title, b.title);
    if (filters.sort === "poster") return byPoster(a) - byPoster(b) || collator.compare(a.title, b.title);
    return scorePaper(b, filters) - scorePaper(a, filters) || byTime(a) - byTime(b) || collator.compare(a.title, b.title);
  });
}

function filteredPapers() {
  const filters = getFilters();
  return sortPapers(state.papers.filter((paper) => paperMatches(paper, filters)), filters);
}

function render() {
  computeSessionStatus();
  renderClock();
  renderKeywords();
  renderSelectedKeywords();
  const papers = filteredPapers();
  els.resultCount.textContent = papers.length.toLocaleString(DISPLAY_LOCALE);
  els.plannedCount.textContent = state.plannedIds.size.toLocaleString(DISPLAY_LOCALE);
  els.currentSessionCount.textContent = state.currentSessions.size.toLocaleString(DISPLAY_LOCALE);
  renderSessionNow();
  if (state.view === "sessions") renderSessionsView(papers);
  else if (state.view === "plan") renderPlanView(papers);
  else renderPaperView(papers);
}

function renderClock() {
  const now = new Intl.DateTimeFormat(DISPLAY_LOCALE, {
    timeZone: DISPLAY_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
  els.clockLabel.textContent = `${now} ${DISPLAY_TIME_ZONE_LABEL}`;
}

function renderSelectedKeywords() {
  const queryChips = [...state.selectedKeywordQueries]
    .sort()
    .map((query) => `<button class="keyword-chip active query" type="button" aria-pressed="true" data-selected="true" data-keyword-query="${escapeHtml(query)}">contains: ${escapeHtml(query)}</button>`);
  const keywordChips = [...state.selectedKeywords]
    .sort()
    .map((keyword) => `<button class="keyword-chip active" type="button" aria-pressed="true" data-selected="true" data-keyword="${escapeHtml(keyword)}">${escapeHtml(keyword)}</button>`);
  const chips = [...queryChips, ...keywordChips];
  const total = chips.length;
  if (!total) {
    state.selectedKeywordsExpanded = false;
    els.selectedKeywords.dataset.expanded = "false";
    els.selectedKeywords.innerHTML = "";
    return;
  }
  if (total <= SELECTED_KEYWORD_PREVIEW_LIMIT) state.selectedKeywordsExpanded = false;
  const isCollapsed = total > SELECTED_KEYWORD_PREVIEW_LIMIT && !state.selectedKeywordsExpanded;
  const visibleChips = isCollapsed ? chips.slice(0, SELECTED_KEYWORD_PREVIEW_LIMIT) : chips;
  const hiddenCount = total - visibleChips.length;
  const summary = `<span class="selected-summary">${total.toLocaleString(DISPLAY_LOCALE)} selected</span>`;
  const toggle = total > SELECTED_KEYWORD_PREVIEW_LIMIT
    ? `<button class="selected-toggle mini-button" type="button" data-selected-keywords-toggle="true">${isCollapsed ? `Show all (${hiddenCount.toLocaleString(DISPLAY_LOCALE)} more)` : "Show fewer"}</button>`
    : "";
  els.selectedKeywords.dataset.expanded = state.selectedKeywordsExpanded ? "true" : "false";
  els.selectedKeywords.innerHTML = [summary, ...visibleChips, toggle].join("");
}

function getKeywordMatches() {
  const needle = normalizeKeyword(els.keywordSearch.value);
  const all = [...state.keywordCounts.entries()]
    .filter(([keyword]) => !needle || keyword.includes(needle))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    needle,
    all,
    visible: all.slice(0, KEYWORD_RENDER_LIMIT),
  };
}

function renderKeywords() {
  const { needle, all, visible } = getKeywordMatches();
  const selected = state.selectedKeywords;
  const selectedShown = visible.filter(([keyword]) => selected.has(keyword)).length;
  const unselectedShown = visible.length - selectedShown;
  if (needle && all.length) {
    const selectedText = selectedShown ? ` · ${selectedShown.toLocaleString(DISPLAY_LOCALE)} selected` : "";
    els.keywordMatchSummary.textContent = `${all.length.toLocaleString(DISPLAY_LOCALE)} matches · ${visible.length.toLocaleString(DISPLAY_LOCALE)} shown${selectedText}`;
  } else if (needle) {
    els.keywordMatchSummary.textContent = "No keyword matches";
  } else {
    const selectedTotal = selected.size + state.selectedKeywordQueries.size;
    const selectedText = selectedTotal ? ` · ${selectedTotal.toLocaleString(DISPLAY_LOCALE)} selected` : "";
    els.keywordMatchSummary.textContent = `Popular keywords${selectedText}`;
  }
  els.applyKeywordSearch.disabled = !needle || state.selectedKeywordQueries.has(needle);
  els.applyKeywordSearch.textContent = needle && state.selectedKeywordQueries.has(needle) ? "Search applied" : "Apply search";
  els.addKeywordMatches.disabled = !needle || !unselectedShown;
  if (!needle) els.addKeywordMatches.textContent = "Add shown";
  else if (unselectedShown) els.addKeywordMatches.textContent = `Add shown (${unselectedShown.toLocaleString(DISPLAY_LOCALE)})`;
  else els.addKeywordMatches.textContent = "Shown selected";
  els.keywordList.innerHTML = visible
    .map(([keyword, count]) => {
      const isSelected = selected.has(keyword);
      const active = isSelected ? " active" : "";
      return `<button class="keyword-chip${active}" type="button" aria-pressed="${isSelected ? "true" : "false"}" data-selected="${isSelected ? "true" : "false"}" data-keyword="${escapeHtml(keyword)}">${escapeHtml(keyword)} ${count}</button>`;
    })
    .join("");
}

function renderSessionNow() {
  const current = state.sessions.filter((session) => state.currentSessions.has(session.session)).sort(compareSessionsByTime);
  const next = state.nextSessions;
  const cards = [];
  const currentVisible = state.sessionNowExpanded ? current : current.slice(0, SESSION_NOW_PREVIEW_LIMIT);
  const nextVisible = state.sessionNowExpanded ? next : next.slice(0, SESSION_NOW_PREVIEW_LIMIT);
  for (const session of currentVisible) {
    cards.push(nowCard(session, "current"));
  }
  for (const session of nextVisible) {
    cards.push(nowCard(session, "next"));
  }
  const hiddenCount = current.length + next.length - currentVisible.length - nextVisible.length;
  if (hiddenCount > 0 || state.sessionNowExpanded) {
    cards.push(nowToggleCard(hiddenCount));
  }
  els.sessionNow.innerHTML = cards.join("");
}

function nowCard(session, kind) {
  const label = kind === "current" ? "Now" : "Next";
  return `
    <div class="now-card ${kind}">
      <div class="timeline-mark"></div>
      <div>
        <strong>${label}: ${escapeHtml(session.session)}</strong>
        <div class="session-meta">${escapeHtml(formatRange(session.starttime_utc || session.starttime, session.endtime_utc || session.endtime))} · ${escapeHtml(session.room_name || "")}</div>
      </div>
      <div class="session-meta">${session.count || (session.papers || []).length} papers</div>
    </div>`;
}

function nowToggleCard(hiddenCount) {
  const label = state.sessionNowExpanded
    ? "Show fewer sessions"
    : `Show all concurrent sessions (${hiddenCount.toLocaleString(DISPLAY_LOCALE)} more)`;
  return `
    <button class="now-toggle-card" type="button" data-session-now-toggle="true" aria-expanded="${state.sessionNowExpanded ? "true" : "false"}">
      ${escapeHtml(label)}
    </button>`;
}

function renderPaperView(papers) {
  const visible = papers.slice(0, state.visibleLimit);
  els.paperList.innerHTML = visible.length
    ? visible.map(renderPaperCard).join("")
    : `<div class="empty-state">No papers match the current filters.</div>`;
  els.loadMore.classList.toggle("visible", papers.length > visible.length);
}

function renderPlanView(papers) {
  if (!state.plannedIds.size) {
    els.paperList.innerHTML = `<div class="empty-state">No planned papers yet.</div>`;
    els.loadMore.classList.remove("visible");
    return;
  }
  renderSessionsView(papers, true);
}

function renderSessionsView(filtered, plannedOnly = false) {
  const allowed = new Set(filtered.map((paper) => paper.id));
  const paperMap = new Map(state.papers.map((paper) => [paper.id, paper]));
  const sessionCards = [];
  for (const session of state.sessions) {
    const papers = (session.papers || [])
      .map((entry) => paperMap.get(entry.id))
      .filter(Boolean)
      .filter((paper) => allowed.has(paper.id))
      .filter((paper) => !plannedOnly || state.plannedIds.has(paper.id));
    if (!papers.length) continue;
    sessionCards.push(renderSessionCard(session, papers));
  }
  const unscheduled = filtered
    .filter((paper) => !paper.session && !paper.starttime)
    .filter((paper) => !plannedOnly || state.plannedIds.has(paper.id));
  if (unscheduled.length) {
    sessionCards.push(renderUnscheduledCard(unscheduled));
  }
  els.paperList.innerHTML = sessionCards.length
    ? sessionCards.join("")
    : `<div class="empty-state">No sessions match the current filters.</div>`;
  els.loadMore.classList.remove("visible");
}

function renderSessionCard(session, papers) {
  const isNext = state.nextSessions.some((nextSession) => nextSession.session === session.session);
  const status = state.currentSessions.has(session.session) ? " current" : isNext ? " next" : "";
  return `
    <article class="session-card${status}">
      <div class="session-header">
        <div>
          <h2 class="session-title">${escapeHtml(session.session)}</h2>
          <div class="session-meta">${escapeHtml(formatRange(session.starttime_utc || session.starttime, session.endtime_utc || session.endtime))} · ${escapeHtml(session.room_name || "")}</div>
        </div>
        <div class="session-meta">${papers.length} shown / ${session.count || papers.length}</div>
      </div>
      <div class="session-paper-list">
        ${papers.map(renderSessionPaper).join("")}
      </div>
    </article>`;
}

function renderUnscheduledCard(papers) {
  return `
    <article class="session-card">
      <div class="session-header">
        <div>
          <h2 class="session-title">Unscheduled</h2>
          <div class="session-meta">No poster time in the ICML source data</div>
        </div>
        <div class="session-meta">${papers.length} papers</div>
      </div>
      <div class="session-paper-list">${papers.map(renderSessionPaper).join("")}</div>
    </article>`;
}

function sessionRangeLabel(session) {
  return formatRange(session.starttime_utc || session.starttime, session.endtime_utc || session.endtime);
}

function roomLabel(roomName) {
  return roomName ? ` · ${roomName}` : "";
}

function renderPaperSchedule(paper) {
  const oralChips = (paper._oralSessions || []).map(({ session }) => {
    const sessionRange = session ? sessionRangeLabel(session) : "Unscheduled";
    const label = `Oral session: ${sessionRange}${roomLabel(session?.room_name)} · ${session?.session || "Oral"}`;
    return `<span class="schedule-chip oral-time">${escapeHtml(label)}</span>`;
  });
  if (oralChips.length) {
    const posterParts = [
      paper.session || "Poster",
      formatRange(paper.starttime_utc || paper.starttime, paper.endtime_utc || paper.endtime),
      paper.room_name,
      paper.poster_position,
    ].filter(Boolean);
    return [
      ...oralChips,
      `<span class="schedule-chip poster-time">${escapeHtml(`Poster: ${posterParts.join(" · ")}`)}</span>`,
    ].join("");
  }
  const chunks = [
    `<span>${escapeHtml(paper.session || "Unscheduled")}</span>`,
    `<span>${escapeHtml(`${formatRange(paper.starttime_utc || paper.starttime, paper.endtime_utc || paper.endtime)}${roomLabel(paper.room_name)}`)}</span>`,
  ];
  if (paper.poster_position) chunks.push(`<span>${escapeHtml(paper.poster_position)}</span>`);
  return chunks.join("");
}

function renderSessionPaper(paper) {
  return `
    <div class="session-paper">
      <strong>${escapeHtml(paper.title)}</strong>
      <div class="paper-meta">${escapeHtml(paper._authorsText)}</div>
      <div class="paper-submeta">
        ${renderBadges(paper)}
        <span>${escapeHtml(paper.topic || "No topic")}</span>
        ${renderPaperSchedule(paper)}
      </div>
      <div class="card-actions">
        <button class="small-button ${state.plannedIds.has(paper.id) ? "active" : ""}" type="button" data-action="plan" data-id="${paper.id}">${state.plannedIds.has(paper.id) ? "Planned" : "Plan"}</button>
        ${paper.virtual_url ? `<a class="small-button" href="${escapeHtml(paper.virtual_url)}" target="_blank" rel="noreferrer">ICML</a>` : ""}
        ${paper.paper_url ? `<a class="small-button" href="${escapeHtml(paper.paper_url)}" target="_blank" rel="noreferrer">OpenReview</a>` : ""}
      </div>
    </div>`;
}

function renderPaperCard(paper) {
  const isOpen = state.openIds.has(paper.id);
  const isCurrent = paper._sessions.some((session) => state.currentSessions.has(session));
  const planned = state.plannedIds.has(paper.id);
  const keywords = paper._keywords.slice(0, 8);
  return `
    <article class="paper-card${isOpen ? " open" : ""}${planned ? " is-planned" : ""}${isCurrent ? " is-current" : ""}">
      <div class="paper-head">
        <div>
          <button class="paper-title" type="button" data-action="toggle" data-id="${paper.id}">${escapeHtml(paper.title)}</button>
          <div class="paper-meta">${escapeHtml(paper._authorsText)}</div>
          <div class="paper-submeta">
            <span>${escapeHtml(paper.topic || "No topic")}</span>
            ${renderPaperSchedule(paper)}
          </div>
        </div>
        <div class="badges">${renderBadges(paper)}</div>
      </div>
      <div class="chip-row" style="padding: 0 16px 10px;">
        ${keywords.map((keyword) => `<button class="keyword-chip" type="button" data-keyword="${escapeHtml(keyword)}">${escapeHtml(keyword)}</button>`).join("")}
      </div>
      <div class="paper-body">
        <p class="abstract">${escapeHtml(paper.abstract || "No abstract available.")}</p>
      </div>
      <div class="card-actions">
        <button class="small-button ${planned ? "active" : ""}" type="button" data-action="plan" data-id="${paper.id}">${planned ? "Planned" : "Plan"}</button>
        <button class="small-button" type="button" data-action="toggle" data-id="${paper.id}">${isOpen ? "Hide abstract" : "Abstract"}</button>
        ${paper.virtual_url ? `<a class="small-button primary" href="${escapeHtml(paper.virtual_url)}" target="_blank" rel="noreferrer">ICML page</a>` : ""}
        ${paper.paper_url ? `<a class="small-button" href="${escapeHtml(paper.paper_url)}" target="_blank" rel="noreferrer">OpenReview</a>` : ""}
      </div>
    </article>`;
}

function renderBadges(paper) {
  const badges = [];
  if (paper.is_spotlight) badges.push(`<span class="badge spotlight">Spotlight</span>`);
  if (paper.has_oral) badges.push(`<span class="badge oral">Oral</span>`);
  if (state.plannedIds.has(paper.id)) badges.push(`<span class="badge">Planned</span>`);
  return badges.join("");
}

async function init() {
  bindElements();
  const savedTheme = localStorage.getItem("icml2026.theme");
  setTheme(savedTheme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  bindEvents();
  try {
    await loadData();
    populateFilters();
    render();
    setInterval(() => {
      computeSessionStatus();
      renderClock();
      els.currentSessionCount.textContent = state.currentSessions.size.toLocaleString(DISPLAY_LOCALE);
      renderSessionNow();
    }, 30000);
  } catch (error) {
    els.dataStatus.textContent = "Data failed to load";
    els.paperList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

init();
