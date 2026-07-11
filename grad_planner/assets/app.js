(function () {
  "use strict";

  const DATA = window.CURRICULUM_DATA;
  const Engine = window.GraduationEngine;
  if (!DATA || !Engine) throw new Error("교육과정 데이터 또는 판정 엔진을 불러오지 못했습니다.");

  const STORAGE_KEY = "dgist-graduation-planner:v1";
  const THEME_KEY = "dgist-graduation-planner:theme";
  const courseMap = Engine.buildCourseMap(DATA);
  const semesterOrder = [1, 2];
  const classificationPools = [
    { id: "basicRequired", label: "기초필수", description: "기초 필수영역과 지정과목에 인정" },
    { id: "basicElective", label: "기초선택", description: "총학점에만 반영하고 기초필수에는 미포함" },
    { id: "advancedRequired", label: "심화필수", description: "트랙·비트랙/융합·UGRP·인턴십 필수영역" },
    { id: "advancedElective", label: "심화선택", description: "심화 총학점에 인정하되 필수영역은 대체하지 않음" }
  ];
  const catalogCategoryGroups = [
    { id: "basic_math", label: "기초과학 · 수학", description: "수학 9학점 필수영역", categories: ["math"] },
    { id: "basic_elective", label: "기초 · 선택", description: "기초필수 학점에는 포함하지 않음", categories: ["basicElective"] },
    { id: "basic_physics", label: "기초과학 · 물리", description: "이론과 실험 선택군", categories: ["physicsBasic"] },
    { id: "basic_chemistry", label: "기초과학 · 화학", description: "이론·실험 및 트랙 기초", categories: ["chemistryBasic"] },
    { id: "basic_biology", label: "기초과학 · 생명과학", description: "진로별 이론 선택과 실험", categories: ["biologyBasic"] },
    { id: "basic_computing", label: "기초공학 · 컴퓨터공학", description: "프로그래밍·데이터사이언스·인공지능", categories: ["computingBasic"] },
    {
      id: "engineering_choice", label: "기초공학 · 공학선택", description: "창의기계설계 / 회로이론·실습 세트 / 화학공학개론 중 한 경로",
      courseIds: ["creative_mechanical_design", "circuit_theory", "circuit_lab", "intro_chemical_engineering"]
    },
    { id: "general_humanities", label: "교양 · 인문사회", description: "글쓰기·읽기와 인문사회 선택", categories: ["humanities"] },
    { id: "general_english", label: "교양 · 영어", description: "글로벌커뮤니케이션 영어", categories: ["english"] },
    { id: "general_korean", label: "교양 · 한국어", description: "외국인 학생 한국어", categories: ["korean"] },
    { id: "general_arts", label: "교양 · 예체능", description: "음악과 체육", categories: ["arts"] },
    { id: "advanced_nontrack", label: "심화 · 비트랙/융합", description: "필수 영역 6학점을 채우는 선택 교과", categories: ["nontrack"] },
    { id: "advanced_ugrp", label: "심화 · UGRP", description: "UGRPⅠ·Ⅱ 6학점 필수", categories: ["ugrp"] },
    { id: "advanced_internship", label: "심화 · 인턴십", description: "학번별 필수학점과 인정 상한 적용", categories: ["internship"] },
    { id: "advanced_startup", label: "심화선택 · 창업", description: "심화 인정 최대 6학점", categories: ["startup"] },
    { id: "advanced_research_elective", label: "심화선택 · 연구", description: "URP 최대 4학점 · Thesis 최대 2학점", categories: ["urp", "thesis"] },
    { id: "other", label: "기타 · 자유선택", description: "영역 외 또는 직접 관리 교과", categories: ["advancedOther", "general"] }
  ];
  const catalogGroupOpenState = new Map();
  let pendingCourseId = "";
  let draggedInstanceId = "";
  let draggedCourseId = "";
  let currentView = "planner";

  const defaultState = () => ({
    version: 4,
    cohort: 2025,
    degree: "engineering",
    primaryTrack: "",
    secondaryMode: "none",
    secondaryTrack: "",
    foreignStudent: false,
    koreanExempt: false,
    extraYears: 0,
    parityToggles: [],
    entries: []
  });

  function normalizeExtraYears(value, entries = []) {
    const configured = Math.min(2, Math.max(0, Math.trunc(Number(value) || 0)));
    const latestAssignedYear = entries.reduce((latest, entry) => Math.max(latest, Number(entry.year) || 0), 4);
    return Math.max(configured, Math.min(2, Math.max(0, latestAssignedYear - 4)));
  }

  function migrateEntry(entry) {
    const oldTerm = entry.term || "spring";
    const session = entry.session || (["summer", "winter"].includes(oldTerm) ? oldTerm : "regular");
    const category = entry.custom ? DATA.categories[entry.custom.category] : null;
    const legacyClassification = category
      ? Engine.classificationKey(category.level, category.requirement || "elective") : "";
    return {
      ...entry,
      semester: session === "summer" ? 1 : session === "winter" ? 2 : Number(entry.semester || (oldTerm === "spring" ? 1 : 2)),
      session,
      ...(entry.custom ? { custom: { ...entry.custom, classification: entry.custom.classification || legacyClassification } } : {})
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !Array.isArray(saved.entries)) return defaultState();
      const entries = saved.entries.map(migrateEntry);
      return {
        ...defaultState(),
        ...saved,
        version: 4,
        extraYears: normalizeExtraYears(saved.extraYears, entries),
        parityToggles: Array.isArray(saved.parityToggles) ? saved.parityToggles : [],
        entries
      };
    } catch (_) {
      return defaultState();
    }
  }

  let state = loadState();

  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const formatCredit = (value) => Number.isInteger(Number(value)) ? String(Number(value)) : String(Number(value).toFixed(1));
  const uid = () => window.crypto?.randomUUID?.() || `entry-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const trackName = (id) => DATA.tracks.find((track) => track.id === id)?.name || "";
  const categoryLabel = (id) => DATA.categories[id]?.label || "기타";
  const classificationLabel = (id) => classificationPools.find((pool) => pool.id === id)?.label || "자유선택";
  const termLabel = (id) => DATA.terms[id] || id;
  const normalized = (value) => String(value || "").toLocaleLowerCase("ko-KR").replace(/\s+/g, "");

  const semesterKey = (year, semester) => `${Number(year)}-${Number(semester)}`;
  const semesterIndex = (year, semester) => ((Number(year) - 1) * 2) + (Number(semester) - 1);
  const plannerYearCount = () => 4 + normalizeExtraYears(state.extraYears, state.entries);
  const plannerYears = () => Array.from({ length: plannerYearCount() }, (_, index) => index + 1);
  function effectiveRegularTerm(year, semester) {
    const index = semesterIndex(year, semester);
    const flips = (state.parityToggles || []).filter((key) => {
      const [toggleYear, toggleSemester] = key.split("-").map(Number);
      return semesterIndex(toggleYear, toggleSemester) <= index;
    }).length;
    const normal = index % 2 === 0 ? "spring" : "fall";
    if (flips % 2 === 0) return normal;
    return normal === "spring" ? "fall" : "spring";
  }

  function actualEntryTerm(entry) {
    if (["summer", "winter"].includes(entry.session)) return entry.session;
    return effectiveRegularTerm(entry.year, entry.semester);
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      toast("브라우저 저장 공간에 계획을 저장하지 못했습니다.", "error");
    }
  }

  function resolvedCourse(entry) {
    return Engine.effectiveCourse(entry, courseMap, state.cohort, DATA, { foreignStudent: state.foreignStudent });
  }

  function audit() {
    return Engine.audit(state, DATA);
  }

  function initializeTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    const dark = saved ? saved === "dark" : window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    document.documentElement.toggleAttribute("data-theme", Boolean(dark));
    if (dark) document.documentElement.setAttribute("data-theme", "dark");
    document.querySelector('meta[name="theme-color"]').content = dark ? "#0f1117" : "#f7f9fc";
  }

  function populateControls() {
    $("#cohortSelect").innerHTML = Array.from({ length: 7 }, (_, index) => 2020 + index)
      .map((year) => `<option value="${year}">${year}학번</option>`).join("");

    const trackOptions = `<option value="">미정 / 전공표기 안 함</option>` + DATA.tracks
      .map((track) => `<option value="${track.id}">${escapeHtml(track.name)}</option>`).join("");
    $("#primaryTrackSelect").innerHTML = trackOptions;
    $("#secondaryTrackSelect").innerHTML = `<option value="">트랙 선택</option>` + DATA.tracks
      .map((track) => `<option value="${track.id}">${escapeHtml(track.name)}</option>`).join("");
    $("#customTrack").innerHTML = `<option value="">트랙 미지정</option>` + DATA.tracks
      .map((track) => `<option value="${track.id}">${escapeHtml(track.name)}</option>`).join("");

    const basicCategories = Object.entries(DATA.categories).filter(([, item]) => item.level === "basic");
    const advancedCategories = Object.entries(DATA.categories).filter(([, item]) => item.level === "advanced");
    $("#categoryFilter").innerHTML = [
      `<option value="">전체 영역</option>`,
      `<optgroup label="기초">${basicCategories.map(([id, item]) => `<option value="${id}">${escapeHtml(item.label)}</option>`).join("")}</optgroup>`,
      `<optgroup label="심화">${advancedCategories.filter(([id]) => id !== "track").map(([id, item]) => `<option value="${id}">${escapeHtml(item.label)}</option>`).join("")}</optgroup>`,
      `<optgroup label="전공 트랙">${DATA.tracks.map((track) => `<option value="track:${track.id}">${escapeHtml(track.name)}</option>`).join("")}</optgroup>`
    ].join("");

    updateCustomClassificationControls();

    syncControlsFromState();
  }

  function updateCustomClassificationControls() {
    const classification = $("#customClassification").value || "basicRequired";
    const level = classification.startsWith("basic") ? "basic" : "advanced";
    const requirement = classification.endsWith("Required") ? "required" : "elective";
    const categorySelect = $("#customCategory");
    const previousCategory = categorySelect.value;
    const categories = Object.entries(DATA.categories).filter(([, item]) => item.level === level && item.requirement === requirement);
    categorySelect.innerHTML = categories.map(([id, item]) => `<option value="${id}">${escapeHtml(item.label)}</option>`).join("");
    if (categories.some(([id]) => id === previousCategory)) categorySelect.value = previousCategory;

    const equivalentSelect = $("#customEquivalent");
    const previousEquivalent = equivalentSelect.value;
    const mayReplaceRequired = requirement === "required";
    const equivalentOptions = mayReplaceRequired ? DATA.equivalentCourseIds
      .map((id) => courseMap.get(id)).filter(Boolean)
      .map((course) => ({ course, effective: resolvedCourse({ courseId: course.id }) }))
      .filter(({ effective }) => effective.classification === classification)
      .sort((a, b) => a.course.name.localeCompare(b.course.name, "ko"))
      .map(({ course }) => `<option value="${course.id}">${escapeHtml(course.name)}</option>`).join("") : "";
    equivalentSelect.innerHTML = `<option value="">지정필수 대체 아님</option>${equivalentOptions}`;
    equivalentSelect.disabled = !mayReplaceRequired;
    if (mayReplaceRequired && [...equivalentSelect.options].some((option) => option.value === previousEquivalent)) {
      equivalentSelect.value = previousEquivalent;
    }

    updateCustomTrackField();
    const help = {
      basicRequired: "기초필수 학점과 선택한 기초 필수영역에 반영됩니다. 지정과목 대체 인정은 공식 승인된 교과목에 한해 적용됩니다.",
      basicElective: "졸업 총학점에만 반영하며 기초필수 학점과 지정영역에는 반영하지 않습니다.",
      advancedRequired: "심화 총학점과 선택한 심화 필수영역에 반영합니다. 트랙을 선택한 경우 해당 트랙 학점에도 반영합니다.",
      advancedElective: "심화 총학점에 반영하지만 트랙·비트랙/융합·UGRP·인턴십 필수영역은 대신하지 않습니다. 영역별 상한을 적용합니다."
    };
    $("#customRecognitionHelp").textContent = help[classification] || "";
  }

  function updateCustomTrackField() {
    const isTrack = $("#customCategory").value === "track";
    $("#customTrackRow").hidden = !isTrack;
    $("#customTrack").required = isTrack;
    if (!isTrack) $("#customTrack").value = "";
  }

  function syncYearControls() {
    const years = plannerYears();
    [$("#targetYear"), $("#customYear")].forEach((select) => {
      const previous = Number(select.value) || 1;
      select.innerHTML = years.map((year) => `<option value="${year}">${year}학년${year > 4 ? " · 초과학기" : ""}</option>`).join("");
      select.value = String(Math.min(previous, years.length));
    });
    const button = $("#addExtraYearButton");
    const nextYear = years.length + 1;
    button.disabled = years.length >= 6;
    button.textContent = years.length >= 6 ? "6학년까지 생성됨" : `${nextYear}학년 초과학기 추가`;
  }

  function syncControlsFromState() {
    syncYearControls();
    $("#cohortSelect").value = String(state.cohort);
    $("#degreeSelect").value = state.degree;
    $("#primaryTrackSelect").value = state.primaryTrack;
    $("#secondaryModeSelect").value = state.secondaryMode;
    $("#secondaryTrackSelect").value = state.secondaryTrack;
    $("#foreignStudent").checked = Boolean(state.foreignStudent);
    $("#koreanExempt").checked = Boolean(state.koreanExempt);
    $("#secondaryTrackField").hidden = state.secondaryMode === "none";
    $("#exemptionSetting").hidden = !(Number(state.cohort) >= 2025 && state.foreignStudent);
  }

  function selectedEquivalentIds() {
    const ids = new Set();
    state.entries.forEach((entry) => {
      if (!entry.custom && entry.courseId) ids.add(entry.courseId);
      if (entry.custom?.equivalentId && entry.custom.classification?.endsWith("Required")) ids.add(entry.custom.equivalentId);
    });
    return ids;
  }

  function trackRequirementBlocks(trackId, mode, prefix) {
    if (!trackId) return [];
    const rule = DATA.trackRules[trackId];
    if (!rule) return [];
    const name = trackName(trackId);
    const isMinor = mode === "minor";
    const blocks = [];
    if (rule.foundationRequired?.length) {
      blocks.push({
        id: `${prefix}_foundation`, label: `${name} 기초 지정`, description: `${rule.foundationRequired.length}과목 모두`,
        courseIds: rule.foundationRequired, requiredCount: rule.foundationRequired.length, programOnly: true
      });
    }
    const required = isMinor ? (rule.minorRequired || []) : (rule.majorRequired || []);
    if (required.length) {
      blocks.push({
        id: `${prefix}_required`, label: `${name} ${isMinor ? "부전공" : "전공"} 지정`, description: `${required.length}과목 모두`,
        courseIds: required, requiredCount: required.length, programOnly: true
      });
    }
    const anyGroups = isMinor ? (rule.minorAnyOf || []) : (rule.majorAnyOf || []);
    anyGroups.forEach((ids, index) => blocks.push({
      id: `${prefix}_choice_${index}`, label: `${name} ${isMinor ? "부전공" : "전공"} 선택`, description: `${ids.length}과목 중 1과목`,
      courseIds: ids, requiredCount: 1, programOnly: true
    }));
    const choose = isMinor ? rule.minorChoose : rule.majorChoose;
    if (choose) blocks.push({
      id: `${prefix}_choose`, label: `${name} ${isMinor ? "부전공" : "전공"} 선택`, description: `${choose.ids.length}과목 중 ${choose.count}과목`,
      courseIds: choose.ids, requiredCount: choose.count, programOnly: true
    });
    return blocks;
  }

  function activeRequirementBlocks() {
    const cohort = Number(state.cohort);
    const baseBlocks = DATA.requirementBlocks.filter((block) => {
      if (block.minCohort && cohort < block.minCohort) return false;
      if (block.maxCohort && cohort > block.maxCohort) return false;
      if (block.cohorts && !block.cohorts.includes(cohort)) return false;
      if (block.foreignOnly && !state.foreignStudent) return false;
      return true;
    });
    return [
      ...baseBlocks,
      ...trackRequirementBlocks(state.primaryTrack, "major", "primary"),
      ...(state.secondaryMode !== "none" ? trackRequirementBlocks(state.secondaryTrack, state.secondaryMode, "secondary") : [])
    ];
  }

  function blockStatus(block) {
    const selected = selectedEquivalentIds();
    if (block.id === "korean_foreign" && state.koreanExempt) return { met: true, current: 1, required: 1 };
    if (block.pathways) {
      const customEngineeringCredits = block.id === "engineering_choice"
        ? state.entries.filter((entry) => entry.custom?.category === "engineeringChoice" && entry.custom.classification === "basicRequired")
          .reduce((sum, entry) => sum + (Number(entry.custom.credits) || 0), 0)
        : 0;
      const met = block.pathways.some((path) => path.every((id) => selected.has(id))) || customEngineeringCredits >= 3;
      return { met, current: met ? 1 : 0, required: 1 };
    }
    const current = block.courseIds.filter((id) => selected.has(id)).length;
    return { met: current >= block.requiredCount, current, required: block.requiredCount };
  }

  function courseBlockMembership(courseId) {
    return activeRequirementBlocks().filter((block) => block.courseIds.includes(courseId));
  }

  function catalogCourses() {
    const query = normalized($("#courseSearch").value);
    const category = $("#categoryFilter").value;
    const classification = $("#classificationFilter").value;
    const term = $("#termFilter").value;
    return DATA.courses
      .map((course) => {
        const effective = resolvedCourse({ courseId: course.id });
        return { course, effective };
      })
      .filter(({ course, effective }) => {
        const haystack = normalized([course.name, course.code, categoryLabel(effective.category), classificationLabel(effective.classification), ...(effective.tracks || []).map(trackName)].join(" "));
        if (query && !haystack.includes(query)) return false;
        if (classification && effective.classification !== classification) return false;
        if (category.startsWith("track:")) {
          const selectedTrack = category.split(":")[1];
          if (effective.category !== "track" || !(effective.tracks || []).includes(selectedTrack)) return false;
        } else if (category && effective.category !== category) return false;
        if (term && !Engine.isOffered(course, term)) return false;
        return true;
      })
      .sort((a, b) => {
        const aBlocks = courseBlockMembership(a.course.id).length;
        const bBlocks = courseBlockMembership(b.course.id).length;
        if (aBlocks !== bBlocks) return bBlocks - aBlocks;
        if (a.effective.level !== b.effective.level) return a.effective.level === "basic" ? -1 : 1;
        return (a.course.year - b.course.year) || a.course.name.localeCompare(b.course.name, "ko");
      });
  }

  function blockRoleBadge(block) {
    const isChoice = Boolean(block.pathways) || block.requiredCount < block.courseIds.length;
    if (block.programOnly) {
      return { text: isChoice ? `${block.label} · ${block.description}` : block.label, type: isChoice ? "program-choice" : "program" };
    }
    return {
      text: isChoice ? `${block.label} · ${block.description}` : `${block.label} · 개별 필수`,
      type: isChoice ? "choice" : "required"
    };
  }

  function trackRoleBadge(courseId, trackId) {
    const rule = DATA.trackRules[trackId] || {};
    const secondary = trackId === state.secondaryTrack && state.secondaryMode !== "none" && trackId !== state.primaryTrack;
    const mode = secondary ? state.secondaryMode : "major";
    const minor = mode === "minor";
    const programLabel = minor ? "부전공" : mode === "double" ? "복수전공" : "전공";
    const required = minor ? (rule.minorRequired || []) : (rule.majorRequired || []);
    const anyOf = minor ? (rule.minorAnyOf || []) : (rule.majorAnyOf || []);
    const choose = minor ? rule.minorChoose : rule.majorChoose;
    if (required.includes(courseId)) return { text: `${programLabel} 지정`, type: "program" };
    const anyGroup = anyOf.find((ids) => ids.includes(courseId));
    if (anyGroup) return { text: `${programLabel} 지정군 · ${anyGroup.length}중 1`, type: "program-choice" };
    if (choose?.ids.includes(courseId)) return { text: `${programLabel} 지정군 · ${choose.ids.length}중 ${choose.count}`, type: "program-choice" };
    return { text: `${trackName(trackId)} 트랙 선택`, type: "optional" };
  }

  function fallbackRoleBadge(effective) {
    const humanitiesRequired = Number(state.cohort) >= 2025 ? 18 : 15;
    const internshipRequired = Number(state.cohort) >= 2023 ? 1 : 2;
    const roles = {
      math: ["기초 영역 선택", "optional"], basicElective: ["기초 선택", "optional"],
      physicsBasic: ["기초과학 영역 선택", "optional"], chemistryBasic: ["기초과학 영역 선택", "optional"],
      biologyBasic: ["기초과학 영역 선택", "optional"], computingBasic: ["기초공학 영역 선택", "optional"],
      engineeringChoice: ["공학선택 경로", "choice"], humanities: [`필수영역 선택 · 총 ${humanitiesRequired}학점`, "choice"],
      english: ["교양 영역 선택", "optional"], arts: ["교양 영역 선택", "optional"], korean: ["교양 영역 선택", "optional"],
      nontrack: ["필수영역 선택 · 총 6학점", "choice"], startup: ["선택 · 심화 최대 6학점", "cap"],
      ugrp: ["연구 영역 선택", "optional"], urp: ["선택 · 심화 최대 4학점", "cap"],
      thesis: ["선택 · 심화 최대 2학점", "cap"], internship: [`필수영역 선택 · ${internshipRequired}학점 이상`, "choice"],
      advancedOther: ["심화 선택", "optional"], general: ["자유선택 · 총학점만", "optional"]
    };
    const [text, type] = roles[effective.category] || ["선택", "optional"];
    return { text, type };
  }

  function courseRoleBadges(course, effective, context = {}) {
    if (context.trackId) return [trackRoleBadge(course.id, context.trackId)];
    const blocks = context.block ? [context.block] : courseBlockMembership(course.id);
    const badges = blocks.length ? blocks.map(blockRoleBadge) : [fallbackRoleBadge(effective)];
    const seen = new Set();
    return badges.filter((badge) => {
      const key = `${badge.type}:${badge.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function paletteCourseCard(course, effective, compact = false, context = {}) {
    const selected = state.entries.some((entry) => !entry.custom && entry.courseId === course.id);
    const standardTerms = course.terms.map(termLabel).join(" · ");
    const tracks = (effective.tracks || []).map(trackName).filter(Boolean).join(" · ");
    const roleBadges = courseRoleBadges(course, effective, context);
    return `
      <article class="catalog-card ${compact ? "compact" : ""} ${selected ? "selected" : ""}"
        data-course-id="${course.id}" draggable="${selected ? "false" : "true"}" tabindex="${selected ? "-1" : "0"}">
        <div>
          <h3>${escapeHtml(course.name)}${course.code ? ` <span class="course-code">${escapeHtml(course.code)}</span>` : ""}</h3>
          <div class="course-role-badges">
            <span class="role-badge classification ${effective.classification}">${escapeHtml(classificationLabel(effective.classification))}</span>
            ${roleBadges.map((badge) => `<span class="role-badge ${badge.type}">${escapeHtml(badge.text)}</span>`).join("")}
          </div>
          <div class="catalog-meta">
            <span>${formatCredit(effective.recognizedCredits)}학점</span>
            ${compact ? "" : `<span>${escapeHtml(categoryLabel(effective.category))}</span>`}
            <span>${course.year}학년 · ${escapeHtml(standardTerms)}</span>
            ${!compact && tracks && !context.trackId ? `<span>${escapeHtml(tracks)}</span>` : ""}
            ${!compact && effective.note ? `<span class="course-note">${escapeHtml(effective.note)}</span>` : ""}
          </div>
        </div>
        <button class="add-course-button" type="button" data-add-course="${course.id}" ${selected ? "disabled" : ""}>${selected ? "추가됨" : "추가"}</button>
      </article>`;
  }

  function renderRequirementBlocks() {
    const blocks = activeRequirementBlocks();
    const complete = blocks.filter((block) => blockStatus(block).met).length;
    $("#blockProgress").textContent = `${complete}/${blocks.length}`;
    $("#requirementBlockList").innerHTML = blocks.map((block) => {
      const status = blockStatus(block);
      const courses = block.courseIds.map((id) => courseMap.get(id)).filter(Boolean);
      return `
        <article class="requirement-block ${status.met ? "complete" : ""} ${block.programOnly ? "program-block" : ""}">
          <header class="requirement-block-header">
            <div><strong>${escapeHtml(block.label)}</strong><span>${escapeHtml(block.description)}${block.programOnly ? " · 전공표기" : ""}</span></div>
            <b>${status.met ? "✓" : `${status.current}/${status.required}`}</b>
          </header>
          <div class="block-course-list">${courses.map((course) => paletteCourseCard(course, resolvedCourse({ courseId: course.id }), true, { block })).join("")}</div>
        </article>`;
    }).join("");
  }

  function groupedCatalog(results) {
    const trackGroups = DATA.tracks.map((track) => ({
      id: `track_${track.id}`,
      label: `트랙 · ${track.name}`,
      description: "전공·부전공 지정과 트랙 선택",
      trackId: track.id
    }));
    const definitionLevel = (group) => {
      const categoryLevel = (group.categories || []).map((category) => DATA.categories[category]?.level).find(Boolean);
      if (categoryLevel) return categoryLevel;
      return (group.courseIds || []).map((id) => courseMap.get(id)?.level).find(Boolean) || "advanced";
    };
    const basicDefinitions = catalogCategoryGroups.filter((group) => definitionLevel(group) === "basic");
    const advancedDefinitions = catalogCategoryGroups.filter((group) => !basicDefinitions.includes(group));
    const definitions = [...basicDefinitions, ...trackGroups, ...advancedDefinitions];
    const definitionMap = new Map(definitions.map((definition) => [definition.id, definition]));
    const groups = new Map();
    const categoryGroup = new Map();
    const courseGroup = new Map();
    catalogCategoryGroups.forEach((group) => {
      (group.categories || []).forEach((category) => categoryGroup.set(category, group.id));
      (group.courseIds || []).forEach((courseId) => courseGroup.set(courseId, group.id));
    });

    const addToGroup = (groupId, entry) => {
      const definition = definitionMap.get(groupId);
      if (!definition) return;
      const key = `${entry.effective.classification}:${groupId}`;
      if (!groups.has(key)) groups.set(key, { ...definition, classification: entry.effective.classification, entries: [] });
      groups.get(key).entries.push(entry);
    };

    results.forEach((entry) => {
      if (entry.effective.category === "track") {
        const trackIds = (entry.effective.tracks || []).filter((trackId) => definitionMap.has(`track_${trackId}`));
        (trackIds.length ? trackIds : ["autonomous"]).forEach((trackId) => addToGroup(`track_${trackId}`, entry));
        return;
      }
      const groupId = courseGroup.get(entry.course.id) || categoryGroup.get(entry.effective.category) || "other";
      addToGroup(groupId, entry);
    });
    const definitionOrder = new Map(definitions.map((definition, index) => [definition.id, index]));
    return [...groups.values()].sort((a, b) => (definitionOrder.get(a.id) || 0) - (definitionOrder.get(b.id) || 0));
  }

  function renderCatalog() {
    renderRequirementBlocks();
    const filterActive = Boolean($("#courseSearch").value.trim() || $("#classificationFilter").value || $("#categoryFilter").value || $("#termFilter").value);
    const results = catalogCourses();
    const groups = groupedCatalog(results);
    $("#catalogCount").textContent = `${results.length}과목`;
    $("#catalogListTitle").textContent = filterActive ? "검색 결과" : "전체 교과목";
    const pools = classificationPools.map((pool) => {
      const poolGroups = groups.filter((group) => group.classification === pool.id);
      const uniqueCount = new Set(poolGroups.flatMap((group) => group.entries.map(({ course }) => course.id))).size;
      return { ...pool, groups: poolGroups, uniqueCount };
    }).filter((pool) => pool.groups.length);
    const searchActive = Boolean($("#courseSearch").value.trim());
    const categoryFilter = $("#categoryFilter").value;
    const renderGroup = (group) => {
      const header = `
        <span class="catalog-group-copy"><strong>${escapeHtml(group.label)}</strong><small>${escapeHtml(group.description)}</small></span>
        <b>${group.entries.length}</b>`;
      const courses = `<div class="catalog-group-courses">${group.entries.map(({ course, effective }) => paletteCourseCard(course, effective, false, { trackId: group.trackId || "" })).join("")}</div>`;
      const collapsibleGeneralGroup = group.id === "general_humanities";
      if (group.trackId || collapsibleGeneralGroup) {
        const selectedTrack = group.trackId === state.primaryTrack || group.trackId === state.secondaryTrack;
        const filteredGroup = searchActive || (group.trackId
          ? categoryFilter === `track:${group.trackId}`
          : (group.categories || []).includes(categoryFilter));
        const preferredOpen = catalogGroupOpenState.has(group.id) ? catalogGroupOpenState.get(group.id) : selectedTrack;
        const open = filteredGroup || preferredOpen;
        return `
          <details class="catalog-group catalog-toggle-group ${group.trackId ? "track-catalog-group" : "general-catalog-group"}"
            data-catalog-group="${group.id}" ${group.trackId ? `data-track-group="${group.trackId}"` : ""} ${open ? "open" : ""}>
            <summary class="catalog-group-header">${header}</summary>
            ${courses}
          </details>`;
      }
      return `
        <section class="catalog-group" data-catalog-group="${group.id}">
          <header class="catalog-group-header">${header}</header>
          ${courses}
        </section>`;
    };
    $("#catalogList").innerHTML = pools.length ? pools.map((pool) => `
      <section class="catalog-pool" data-course-pool="${pool.id}">
        <header class="catalog-pool-header">
          <div><h3>${escapeHtml(pool.label)}</h3><p>${escapeHtml(pool.description)}</p></div>
          <b>${pool.uniqueCount}과목</b>
        </header>
        <div class="catalog-pool-groups">${pool.groups.map(renderGroup).join("")}
        </div>
      </section>`).join("") : `<div class="empty-state">조건에 맞는 과목이 없습니다.<br />필터 조건을 조정하거나 직접 입력 교과목을 등록할 수 있습니다.</div>`;
  }

  function renderSummary(result) {
    const cards = [
      [result.credits.total, result.rule.totalCredits, "총 이수학점"],
      [result.credits.base, result.rule.baseCredits, "기초필수"],
      [result.credits.advanced, result.rule.advancedCredits, "심화 인정학점"],
      [result.canGraduate ? "충족" : `${result.unmet.length}개`, "", result.canGraduate ? "졸업요건" : "미충족 요건"]
    ];
    $("#summaryStrip").innerHTML = cards.map(([current, required, label], index) => `
      <div class="summary-card ${index === 3 && result.canGraduate ? "success" : ""}">
        <strong>${escapeHtml(current)}${required ? `<small class="sr-only"> / </small><span class="inline-required"> / ${required}</span>` : ""}</strong>
        <span>${escapeHtml(label)}</span>
        ${required ? `<small>${Engine.progress(current, required)}% 충족</small>` : `<small>${result.completion}% 요건 충족</small>`}
      </div>`).join("");
  }

  function renderBoard() {
    $("#yearBoard").innerHTML = plannerYears().map((year) => {
      const yearEntries = state.entries.filter((entry) => Number(entry.year) === year);
      const yearCredits = yearEntries.reduce((sum, entry) => sum + (resolvedCourse(entry)?.recognizedCredits || 0), 0);
      const regularSlots = semesterOrder.map((semester) => {
        const key = semesterKey(year, semester);
        const entries = yearEntries.filter((entry) => (entry.session || "regular") === "regular" && Number(entry.semester) === semester);
        const credits = entries.reduce((sum, entry) => sum + (resolvedCourse(entry)?.recognizedCredits || 0), 0);
        const regularTerm = effectiveRegularTerm(year, semester);
        const parityActive = (state.parityToggles || []).includes(key);
        return `
          <section class="term-zone regular-slot" data-drop-year="${year}" data-drop-semester="${semester}" data-drop-session="regular" aria-label="${year}학년 ${semester}학기 ${termLabel(regularTerm)}">
            <div class="term-heading">
              <div class="semester-name"><strong>${semester}학기</strong><span class="season-chip ${regularTerm}">${termLabel(regularTerm)}</span></div>
              <span>${formatCredit(credits)}학점</span>
            </div>
            <button class="parity-toggle ${parityActive ? "active" : ""}" type="button" data-toggle-parity="${key}" aria-pressed="${parityActive}">
              ${parityActive ? "엇학기 해제" : "이 학기부터 엇학기"}
            </button>
            <div class="course-stack">
              ${entries.length ? entries.map(renderPlannedCourse).join("") : `<div class="empty-term">목록의 과목을<br />여기로 끌어다 놓으세요</div>`}
            </div>
          </section>`;
      });
      const seasonalSlots = [
        { session: "summer", semester: 1, label: "여름" },
        { session: "winter", semester: 2, label: "겨울" }
      ].map((slot) => {
        const entries = yearEntries.filter((entry) => entry.session === slot.session);
        const credits = entries.reduce((sum, entry) => sum + (resolvedCourse(entry)?.recognizedCredits || 0), 0);
        return `
          <section class="term-zone seasonal-slot ${slot.session}-slot" data-drop-year="${year}" data-drop-semester="${slot.semester}" data-drop-session="${slot.session}" aria-label="${year}학년 ${slot.label} 계절학기">
            <div class="term-heading">
              <div class="semester-name"><strong>${slot.label}</strong><span class="season-chip ${slot.session}">계절</span></div>
              <span>${formatCredit(credits)}학점</span>
            </div>
            <div class="course-stack">
              ${entries.length ? entries.map(renderPlannedCourse).join("") : `<div class="empty-term">계절학기 과목을<br />끌어다 놓으세요</div>`}
            </div>
          </section>`;
      });
      return `
        <article class="year-card ${year > 4 ? "extra-year-card" : ""}" data-planner-year="${year}">
          <header class="year-header">
            <div class="year-title"><h2>${year}학년</h2>${year > 4 ? `<span>초과학기</span>` : ""}</div>
            <span class="year-credit">${formatCredit(yearCredits)}학점</span>
          </header>
          <div class="term-grid">${[...regularSlots, ...seasonalSlots].join("")}</div>
        </article>`;
    }).join("");
  }

  function renderPlannedCourse(entry) {
    const course = resolvedCourse(entry);
    if (!course) return "";
    const original = entry.custom ? course : courseMap.get(entry.courseId);
    const actualTerm = actualEntryTerm(entry);
    const offTerm = !entry.custom && !Engine.isOffered(original, actualTerm);
    const roleCourse = entry.custom?.equivalentId && course.requirement === "required"
      ? courseMap.get(entry.custom.equivalentId) : (entry.custom ? course : original);
    const roleEffective = roleCourse && !roleCourse.custom ? resolvedCourse({ courseId: roleCourse.id }) : course;
    const roleTracks = roleEffective?.tracks || [];
    const contextTrack = roleTracks.includes(state.primaryTrack) ? state.primaryTrack
      : roleTracks.includes(state.secondaryTrack) ? state.secondaryTrack : roleTracks[0];
    const roles = roleCourse
      ? courseRoleBadges(roleCourse, roleEffective, contextTrack ? { trackId: contextTrack } : {}).slice(0, 2)
      : [fallbackRoleBadge(course)];
    return `
      <article class="planned-course ${offTerm ? "off-term" : ""}" data-level="${course.level}" data-instance-id="${entry.instanceId}" draggable="true" tabindex="0">
        <h3>${escapeHtml(course.name)}</h3>
        <div class="planned-role-badges">
          <span class="role-badge classification ${course.classification}">${escapeHtml(classificationLabel(course.classification))}</span>
          ${roles.map((badge) => `<span class="role-badge ${badge.type}">${escapeHtml(badge.text)}</span>`).join("")}
        </div>
        <div class="planned-course-meta">${formatCredit(course.recognizedCredits)}학점 · ${escapeHtml(termLabel(actualTerm))} · ${escapeHtml(categoryLabel(course.category))}${entry.custom ? " · 직접입력" : ""}</div>
        ${offTerm ? `<span class="term-warning">표준 개설학기와 다름</span>` : ""}
        <button class="course-remove" type="button" data-remove-entry="${entry.instanceId}" aria-label="${escapeHtml(course.name)} 삭제">×</button>
      </article>`;
  }

  function renderSnapshot(result) {
    const unmet = result.unmet.slice(0, 4);
    $("#snapshotContent").innerHTML = `
      <div class="status-banner ${result.canGraduate ? "success" : ""}">
        <span class="status-dot" aria-hidden="true"></span>
        <div>
          <strong>${result.canGraduate ? "졸업요건 충족" : "미충족 졸업요건이 있습니다."}</strong>
          <p>${escapeHtml(result.degreeLabel)} · ${result.cohort}학번 기준</p>
        </div>
        <span class="status-score">${result.completion}%</span>
      </div>
      ${unmet.length ? `<div class="compact-missing">${unmet.map((item) => `
        <div class="compact-requirement"><strong>${escapeHtml(item.label)}</strong><span>${formatCredit(item.current)} / ${formatCredit(item.required)} ${item.unit}${item.missing.length ? ` · ${escapeHtml(item.missing[0])}` : ""}</span></div>`).join("")}</div>` : ""}`;
  }

  function auditSection(title, items) {
    return `
      <section class="audit-section">
        <header class="audit-section-header"><h3>${escapeHtml(title)}</h3></header>
        <div class="audit-list">${items.map((item) => `
          <article class="audit-item ${item.met ? "met" : ""} ${item.severity === "program" ? "program" : ""}">
            <span class="audit-mark" aria-hidden="true">${item.met ? "✓" : "!"}</span>
            <div class="audit-copy">
              <strong>${escapeHtml(item.label)}</strong>
              <p>${escapeHtml(item.detail)}</p>
              ${item.missing.length ? `<div class="audit-missing">부족: ${escapeHtml(item.missing.join(" · "))}</div>` : ""}
              <div class="progress-track" aria-hidden="true"><div class="progress-fill" style="width:${Engine.progress(item.current, item.required)}%"></div></div>
            </div>
            <div class="audit-value">${formatCredit(item.current)} / ${formatCredit(item.required)} ${escapeHtml(item.unit)}</div>
          </article>`).join("")}</div>
      </section>`;
  }

  function renderDiagnosis(result) {
    const secondary = state.secondaryMode === "minor" ? "부전공" : state.secondaryMode === "double" ? "복수전공" : "";
    const plannedPrograms = [
      state.primaryTrack ? `${trackName(state.primaryTrack)} 전공 ${result.programs.primary?.met ? "충족" : "계획 중"}` : "",
      secondary && state.secondaryTrack ? `${trackName(state.secondaryTrack)} ${secondary} ${result.programs.secondary?.met ? "충족" : "계획 중"}` : ""
    ].filter(Boolean).join(" · ");
    $("#reportProfile").textContent = `${state.cohort}학번 · ${result.degreeLabel}${plannedPrograms ? ` · ${plannedPrograms}` : ""}`;
    const summaryCards = [
      [result.canGraduate ? "충족" : "미충족", "최종 판정", result.canGraduate],
      [`${formatCredit(result.credits.total)} / ${result.rule.totalCredits}`, "총학점", result.credits.total >= result.rule.totalCredits],
      [`${formatCredit(result.credits.base)} / ${result.rule.baseCredits}`, "기초필수", result.baseMet],
      [`${formatCredit(result.credits.advanced)} / ${result.rule.advancedCredits}`, "심화 인정", result.advancedMet]
    ];
    $("#reportSummary").innerHTML = summaryCards.map(([value, label, met]) => `
      <div class="summary-card ${met ? "success" : ""}"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span><small>${met ? "기준 충족" : "확인 필요"}</small></div>`).join("");

    const warningHtml = result.warnings.length ? `
      <section class="warning-section">
        <header class="audit-section-header"><h3>주의 및 확인사항</h3></header>
        <div class="warning-list">${result.warnings.map((warning) => `
          <article class="warning-card"><strong>${escapeHtml(warning.label)}</strong><p>${escapeHtml(warning.detail)}</p></article>`).join("")}</div>
      </section>` : "";
    $("#reportGrid").innerHTML = [
      auditSection("기초 이수요건", result.requirements.base),
      auditSection("심화 및 전공표기 요건", result.requirements.advanced),
      auditSection("총 졸업학점", result.requirements.overall),
      warningHtml
    ].join("");
    renderPrintTable();
  }

  function renderPrintTable() {
    const rows = [];
    for (const year of plannerYears()) {
      const slots = [
        ...semesterOrder.map((semester) => ({ session: "regular", semester, label: `${semester}학기 · ${termLabel(effectiveRegularTerm(year, semester))}` })),
        { session: "summer", semester: 1, label: "여름 계절학기" },
        { session: "winter", semester: 2, label: "겨울 계절학기" }
      ];
      slots.forEach((slot) => {
        const entries = state.entries.filter((entry) => Number(entry.year) === year
          && (entry.session || "regular") === slot.session
          && (slot.session !== "regular" || Number(entry.semester) === slot.semester));
        const credits = entries.reduce((sum, entry) => sum + (resolvedCourse(entry)?.recognizedCredits || 0), 0);
        rows.push(`
          <tr>
            <th scope="row">${year}학년${year > 4 ? " (초과학기)" : ""}</th><td>${escapeHtml(slot.label)}</td>
            <td>${entries.length ? `<ul>${entries.map((entry) => {
              const course = resolvedCourse(entry);
              return `<li>${escapeHtml(course?.name || "알 수 없는 과목")} (${formatCredit(course?.recognizedCredits || 0)}, ${escapeHtml(classificationLabel(course?.classification))}, ${escapeHtml(termLabel(actualEntryTerm(entry)))})</li>`;
            }).join("")}</ul>` : "—"}</td>
            <td class="credit-cell">${formatCredit(credits)}</td>
          </tr>`);
      });
    }
    $("#printPlanTable").classList.toggle("extended-plan", plannerYearCount() > 4);
    $("#printPlanTable").innerHTML = `
      <table class="plan-table">
        <thead><tr><th>학년</th><th>학기</th><th>교과목 (학점)</th><th>소계</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>`;
  }

  function renderGuide() {
    const cohortRows = Object.values(DATA.cohortRules).map((rule) => `
      <tr><th>${escapeHtml(rule.label)}</th><td>${rule.baseCredits}</td><td>${rule.advancedCredits}</td><td>${rule.totalCredits}</td><td>${rule.computingCredits}</td><td>${rule.humanitiesCredits}</td></tr>`).join("");
    const trackRows = DATA.tracks.map((track) => {
      const rule = DATA.trackRules[track.id];
      return `<tr><th>${escapeHtml(track.name)}</th><td>${rule?.majorCredits ?? 27}</td><td>${rule?.minorCredits ?? 18}</td><td>${escapeHtml(rule?.note || "별도 승인 요건 확인")}</td></tr>`;
    }).join("");
    $("#guideContent").innerHTML = `
      <section class="guide-card wide">
        <h3>학번별 표준이수학점</h3>
        <div class="print-plan-table-wrap"><table class="rule-table"><thead><tr><th>학번</th><th>기초</th><th>심화</th><th>총학점</th><th>기초 컴공</th><th>인문사회</th></tr></thead><tbody>${cohortRows}</tbody></table></div>
      </section>
      <section class="guide-card">
        <h3>자동 판정 항목</h3>
        <ul>
          <li>영역별 최소학점뿐 아니라 공학수학Ⅰ, 다변수 미적분학, 영어 2과목 등 지정필수 과목</li>
          <li>선택 트랙에 따른 일반물리Ⅱ·일반화학Ⅱ·일반생물학Ⅱ 추가 조건</li>
          <li>2025학번 이후 인공지능기초의 심화 컴퓨터공학 트랙 전환</li>
          <li>트랙 지정과목, 복수전공·부전공 학점 및 두 트랙 간 중복 인정 최대 6학점</li>
          <li>트랙 지정과목 미충족 시 전공 표기는 불가하지만, 기본 졸업요건 충족 시 융복합 이학사·공학사 학위 수여 가능</li>
          <li>UGRP, 비트랙/융합, 인턴십 및 2025학번 이후 외국인 학생 한국어 요건</li>
        </ul>
      </section>
      <section class="guide-card">
        <h3>필수·선택 구분</h3>
        <ul>
          <li><strong>기초필수</strong>: 기초필수 총학점과 해당 기초영역에 반영됩니다.</li>
          <li><strong>기초선택</strong>: 졸업 총학점에만 반영되고 기초필수에는 포함되지 않습니다.</li>
          <li><strong>심화필수</strong>: 심화 총학점과 트랙·비트랙/융합·UGRP·인턴십 필수영역에 반영됩니다.</li>
          <li><strong>심화선택</strong>: 심화 총학점에는 반영되지만 필수영역은 대신하지 않으며 영역별 상한을 적용합니다.</li>
          <li><strong>개별 필수</strong>: 해당 과목 자체를 이수해야 하는 졸업 필수입니다.</li>
          <li><strong>필수 선택군</strong>: 표시된 블록 안에서 정해진 수만큼 선택하면 됩니다.</li>
          <li><strong>전공·부전공 지정</strong>: 졸업 자체와 분리된 트랙 표기 요건입니다.</li>
          <li><strong>트랙/영역 선택</strong>: 해당 영역의 최소학점을 채우는 선택 교과입니다.</li>
          <li><strong>인정 상한</strong>: 수강학점과 별개로 심화 합산에 반영되는 최대치가 있습니다.</li>
        </ul>
      </section>
      <section class="guide-card">
        <h3>직접 입력 교과목</h3>
        <ul>
          <li>계절학기, 교환학생, 타 대학 및 대체 인정 교과목을 직접 등록할 수 있습니다.</li>
          <li>필수·선택 구분에 따라 등록 가능한 인정영역이 구분됩니다.</li>
          <li>선택 교과목은 필수영역을 대체하지 않으며, 지정필수 대체 인정은 필수 구분에서만 적용됩니다.</li>
          <li>대체 인정은 공식 승인 내역을 기준으로 하며 관련 근거를 메모에 기록할 수 있습니다.</li>
        </ul>
      </section>
      <section class="guide-card wide">
        <h3>트랙 전공·부전공 기준</h3>
        <div class="print-plan-table-wrap"><table class="rule-table"><thead><tr><th>트랙</th><th>전공</th><th>부전공</th><th>지정과목 요약</th></tr></thead><tbody>${trackRows}</tbody></table></div>
      </section>
      <section class="guide-card">
        <h3>개설학기 확인</h3>
        <p>교육과정표의 표준 개설학기와 다른 시기에 배정하는 경우 확인 절차를 거쳐 계획에 포함됩니다.</p>
      </section>
      <section class="guide-card">
        <h3>엇학기 설정</h3>
        <p>엇학기 설정 시 선택한 시점 이후의 정규학기 봄·가을 순서가 반전됩니다. 이후 시점에서 다시 설정하면 해당 시점부터 기존 순서가 적용되며 계절학기는 영향을 받지 않습니다.</p>
      </section>
      <section class="guide-card">
        <h3>자동 판정 제외 항목</h3>
        <p>선수과목, 학점 중복의 개별 예외, 폐지·대체교과목의 적용 연도, 재수강 및 학위연계과정 등 개인별 행정사항은 자동 판정에 포함되지 않습니다.</p>
      </section>`;
  }

  function renderAll() {
    const result = audit();
    syncControlsFromState();
    renderCatalog();
    renderSummary(result);
    renderBoard();
    renderSnapshot(result);
    renderDiagnosis(result);
  }

  function openAddDialog(courseId) {
    if (state.entries.some((entry) => !entry.custom && entry.courseId === courseId)) {
      toast("이미 계획에 들어 있는 과목입니다.", "warning");
      return;
    }
    const course = courseMap.get(courseId);
    if (!course) return;
    pendingCourseId = courseId;
    $("#selectedCoursePreview").innerHTML = `
      <strong>${escapeHtml(course.name)}</strong>
      <span>${formatCredit(resolvedCourse({ courseId }).recognizedCredits)}학점 · ${escapeHtml(categoryLabel(resolvedCourse({ courseId }).category))} · 표준 ${course.year}학년 ${escapeHtml(course.terms.map(termLabel).join(" · "))}</span>`;
    $("#targetYear").value = String(course.year || 1);
    let semester = semesterOrder.find((value) => course.terms.includes(effectiveRegularTerm(course.year || 1, value))) || 1;
    let session = "regular";
    if (!semesterOrder.some((value) => course.terms.includes(effectiveRegularTerm(course.year || 1, value)))) {
      if (course.terms.includes("summer")) { semester = 1; session = "summer"; }
      else if (course.terms.includes("winter")) { semester = 2; session = "winter"; }
    }
    $("#targetSemester").value = String(semester);
    $("#targetSession").value = session;
    updateTargetSemesterPreview();
    $("#addCourseDialog").showModal();
  }

  function selectedPlacementTerm(year, semester, session) {
    return ["summer", "winter"].includes(session) ? session : effectiveRegularTerm(year, semester);
  }

  function normalizedPlacementSemester(semester, session) {
    if (session === "summer") return 1;
    if (session === "winter") return 2;
    return Number(semester);
  }

  function placementLabel(year, semester, session) {
    if (session === "summer") return `${year}학년 여름 계절학기`;
    if (session === "winter") return `${year}학년 겨울 계절학기`;
    return `${year}학년 ${semester}학기(${termLabel(effectiveRegularTerm(year, semester))})`;
  }

  function updateTargetSemesterPreview() {
    const year = Number($("#targetYear").value);
    const session = $("#targetSession").value;
    const semesterSelect = $("#targetSemester");
    if (session === "summer") semesterSelect.value = "1";
    if (session === "winter") semesterSelect.value = "2";
    semesterSelect.disabled = session !== "regular";
    const semester = normalizedPlacementSemester(semesterSelect.value, session);
    const actualTerm = selectedPlacementTerm(year, semester, session);
    $("#targetSemesterPreview").textContent = session === "regular"
      ? `${year}학년 ${semester}학기 · 적용 계절: ${termLabel(actualTerm)}`
      : `${placementLabel(year, semester, session)} · 엇학기 설정 제외`;
  }

  async function addCatalogCourse(courseId, year, semester, session = "regular") {
    const course = courseMap.get(courseId);
    if (!course) return false;
    if (state.entries.some((entry) => !entry.custom && entry.courseId === courseId)) {
      toast("이미 계획에 들어 있는 과목입니다.", "warning");
      return false;
    }
    semester = normalizedPlacementSemester(semester, session);
    const actualTerm = selectedPlacementTerm(year, semester, session);
    if (!Engine.isOffered(course, actualTerm)) {
      const offered = course.terms.map(termLabel).join("·");
      const confirmed = await askConfirm(
        "개설학기 확인",
        `${course.name}은(는) 교육과정표상 보통 ${offered}에 개설됩니다. ${placementLabel(year, semester, session)}에 정말 넣으시겠습니까?`
      );
      if (!confirmed) return false;
    }
    state.entries.push({ instanceId: uid(), courseId, year: Number(year), semester: Number(semester), session });
    saveState();
    renderAll();
    toast(`${course.name}을(를) ${placementLabel(year, semester, session)}에 추가했습니다.`);
    return true;
  }

  async function moveEntry(instanceId, year, semester, session = "regular") {
    const entry = state.entries.find((item) => item.instanceId === instanceId);
    if (!entry) return;
    const course = resolvedCourse(entry);
    const original = entry.custom ? null : courseMap.get(entry.courseId);
    semester = normalizedPlacementSemester(semester, session);
    const actualTerm = selectedPlacementTerm(year, semester, session);
    if (original && !Engine.isOffered(original, actualTerm)) {
      const confirmed = await askConfirm(
        "개설학기 확인",
        `${course.name}은(는) 교육과정표상 보통 ${original.terms.map(termLabel).join("·")}에 개설됩니다. ${placementLabel(year, semester, session)}로 정말 옮기시겠습니까?`
      );
      if (!confirmed) return;
    }
    entry.year = Number(year);
    entry.semester = Number(semester);
    entry.session = session;
    saveState();
    renderAll();
    toast(`${course.name}을(를) ${placementLabel(year, semester, session)}로 옮겼습니다.`);
  }

  function toggleParity(key) {
    const toggles = new Set(state.parityToggles || []);
    if (toggles.has(key)) toggles.delete(key);
    else toggles.add(key);
    state.parityToggles = [...toggles].sort((a, b) => {
      const [ay, as] = a.split("-").map(Number);
      const [by, bs] = b.split("-").map(Number);
      return semesterIndex(ay, as) - semesterIndex(by, bs);
    });
    saveState();
    renderAll();
    toast(toggles.has(key) ? `${key.replace("-", "학년 ")}학기부터 봄·가을을 반전했습니다.` : `${key.replace("-", "학년 ")}학기 엇학기를 해제했습니다.`);
  }

  function addExtraYear() {
    const currentYearCount = plannerYearCount();
    if (currentYearCount >= 6) return;
    const addedYear = currentYearCount + 1;
    state.extraYears = addedYear - 4;
    saveState();
    renderAll();
    toast(`${addedYear}학년 초과학기를 생성했습니다.`);
  }

  function removeEntry(instanceId) {
    const index = state.entries.findIndex((entry) => entry.instanceId === instanceId);
    if (index < 0) return;
    const [removed] = state.entries.splice(index, 1);
    const name = resolvedCourse(removed)?.name || "과목";
    saveState();
    renderAll();
    toast(`${name}을(를) 계획에서 삭제했습니다.`);
  }

  function openCustomDialog() {
    $("#customCourseForm").reset();
    $("#customCredits").value = "3";
    $("#customClassification").value = "basicRequired";
    updateCustomClassificationControls();
    $("#customYear").value = "1";
    $("#customSemester").value = "1";
    $("#customSession").value = "regular";
    updateCustomSemesterControl();
    $("#customCourseDialog").showModal();
    setTimeout(() => $("#customName").focus(), 0);
  }

  function updateCustomSemesterControl() {
    const session = $("#customSession").value;
    const semester = $("#customSemester");
    if (session === "summer") semester.value = "1";
    if (session === "winter") semester.value = "2";
    semester.disabled = session !== "regular";
  }

  function addCustomCourse() {
    const form = $("#customCourseForm");
    if (!form.reportValidity()) return false;
    const name = $("#customName").value.trim();
    const credits = Number($("#customCredits").value);
    const category = $("#customCategory").value;
    const classification = $("#customClassification").value;
    if (!name || !Number.isFinite(credits) || credits < 0) return false;
    const customId = `custom-${uid()}`;
    const session = $("#customSession").value;
    state.entries.push({
      instanceId: uid(),
      year: Number($("#customYear").value),
      semester: normalizedPlacementSemester($("#customSemester").value, session),
      session,
      custom: {
        id: customId,
        name,
        credits,
        category,
        classification,
        track: category === "track" ? $("#customTrack").value : "",
        equivalentId: classification.endsWith("Required") ? $("#customEquivalent").value : "",
        note: $("#customNote").value.trim()
      }
    });
    saveState();
    renderAll();
    toast(`${name}을(를) 직접 입력으로 추가했습니다.`);
    return true;
  }

  function askConfirm(title, message) {
    const dialog = $("#confirmDialog");
    $("#confirmTitle").textContent = title;
    $("#confirmMessage").textContent = message;
    return new Promise((resolve) => {
      const done = () => {
        dialog.removeEventListener("close", done);
        resolve(dialog.returnValue === "confirm");
      };
      dialog.addEventListener("close", done);
      dialog.showModal();
    });
  }

  function toast(message, type = "") {
    const item = document.createElement("div");
    item.className = `toast ${type}`;
    item.textContent = message;
    $("#toastRegion").append(item);
    setTimeout(() => item.remove(), 3200);
  }

  function setView(view) {
    currentView = view;
    $$(".tab").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    $$(".view-panel").forEach((panel) => { panel.hidden = panel.dataset.panel !== view; });
    if (view === "diagnosis") renderDiagnosis(audit());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function printReport() {
    setView("diagnosis");
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  }

  function exportPlan() {
    const payload = {
      app: "DGIST Graduation Planner",
      exportedAt: new Date().toISOString(),
      curriculumRevision: DATA.meta.revisedAt,
      state
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dgist-graduation-plan-${state.cohort}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function importPlan(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const imported = parsed.state || parsed;
        if (!imported || !Array.isArray(imported.entries)) throw new Error("entries missing");
        const entries = imported.entries.map(migrateEntry);
        state = {
          ...defaultState(),
          ...imported,
          version: 4,
          extraYears: normalizeExtraYears(imported.extraYears, entries),
          parityToggles: Array.isArray(imported.parityToggles) ? imported.parityToggles : [],
          entries
        };
        if (state.cohort < 2020 || state.cohort > 2100) throw new Error("invalid cohort");
        saveState();
        renderAll();
        toast("계획을 성공적으로 불러왔습니다.");
      } catch (_) {
        toast("올바른 졸업 계획 JSON 파일이 아닙니다.", "error");
      }
      $("#importInput").value = "";
    };
    reader.readAsText(file);
  }

  function bindEvents() {
    $("#themeToggle").addEventListener("click", () => {
      const dark = document.documentElement.getAttribute("data-theme") !== "dark";
      document.documentElement.toggleAttribute("data-theme", dark);
      if (dark) document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
      document.querySelector('meta[name="theme-color"]').content = dark ? "#0f1117" : "#f7f9fc";
    });

    $$(".tab").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
    document.addEventListener("click", (event) => {
      const close = event.target.closest("[data-close-dialog]");
      if (close) {
        const dialog = document.getElementById(close.dataset.closeDialog);
        if (dialog?.open) dialog.close(close.dataset.dialogValue || "cancel");
        return;
      }
      const go = event.target.closest("[data-go-view]");
      if (go) { event.preventDefault(); setView(go.dataset.goView); }
      const add = event.target.closest("[data-add-course]");
      if (add && !add.disabled) openAddDialog(add.dataset.addCourse);
      const remove = event.target.closest("[data-remove-entry]");
      if (remove) removeEntry(remove.dataset.removeEntry);
      const parity = event.target.closest("[data-toggle-parity]");
      if (parity) toggleParity(parity.dataset.toggleParity);
    });

    $("#filterToggle").addEventListener("click", () => {
      const open = $("#filtersPanel").classList.toggle("open");
      $("#filterToggle").setAttribute("aria-expanded", String(open));
    });

    ["#courseSearch", "#classificationFilter", "#categoryFilter", "#termFilter"].forEach((selector) => {
      $(selector).addEventListener(selector === "#courseSearch" ? "input" : "change", () => {
        renderCatalog();
      });
    });
    $("#catalogList").addEventListener("click", (event) => {
      const summary = event.target.closest(".catalog-toggle-group > summary");
      if (!summary) return;
      const group = summary.parentElement;
      requestAnimationFrame(() => catalogGroupOpenState.set(group.dataset.catalogGroup, group.open));
    });

    const settingMap = {
      cohortSelect: "cohort", degreeSelect: "degree", primaryTrackSelect: "primaryTrack",
      secondaryModeSelect: "secondaryMode", secondaryTrackSelect: "secondaryTrack"
    };
    Object.entries(settingMap).forEach(([elementId, stateKey]) => {
      $(`#${elementId}`).addEventListener("change", (event) => {
        state[stateKey] = stateKey === "cohort" ? Number(event.target.value) : event.target.value;
        if (stateKey === "secondaryMode" && state.secondaryMode === "none") state.secondaryTrack = "";
        if (stateKey === "primaryTrack" && state.primaryTrack === state.secondaryTrack) state.secondaryTrack = "";
        saveState();
        renderAll();
      });
    });
    $("#foreignStudent").addEventListener("change", (event) => { state.foreignStudent = event.target.checked; saveState(); renderAll(); });
    $("#koreanExempt").addEventListener("change", (event) => { state.koreanExempt = event.target.checked; saveState(); renderAll(); });

    $("#confirmAddCourse").addEventListener("click", async (event) => {
      event.preventDefault();
      const added = await addCatalogCourse(
        pendingCourseId,
        Number($("#targetYear").value),
        Number($("#targetSemester").value),
        $("#targetSession").value
      );
      if (added) $("#addCourseDialog").close();
    });
    ["#targetYear", "#targetSemester", "#targetSession"].forEach((selector) => {
      $(selector).addEventListener("change", updateTargetSemesterPreview);
    });

    $("#openCustomCourse").addEventListener("click", openCustomDialog);
    $("#customClassification").addEventListener("change", updateCustomClassificationControls);
    $("#customCategory").addEventListener("change", updateCustomTrackField);
    $("#customSession").addEventListener("change", updateCustomSemesterControl);
    $("#confirmCustomCourse").addEventListener("click", (event) => {
      event.preventDefault();
      if (addCustomCourse()) $("#customCourseDialog").close();
    });

    $("#filtersPanel").addEventListener("dragstart", (event) => {
      const card = event.target.closest("[data-course-id]");
      if (!card || card.getAttribute("draggable") === "false") return;
      draggedCourseId = card.dataset.courseId;
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("application/x-course-id", draggedCourseId);
      event.dataTransfer.setData("text/plain", `course:${draggedCourseId}`);
      card.classList.add("dragging");
    });
    $("#filtersPanel").addEventListener("dragend", (event) => {
      event.target.closest("[data-course-id]")?.classList.remove("dragging");
      draggedCourseId = "";
      $$(".term-zone.drag-over").forEach((item) => item.classList.remove("drag-over"));
    });

    $("#yearBoard").addEventListener("dragstart", (event) => {
      const card = event.target.closest("[data-instance-id]");
      if (!card) return;
      draggedInstanceId = card.dataset.instanceId;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("application/x-plan-entry", draggedInstanceId);
      event.dataTransfer.setData("text/plain", `entry:${draggedInstanceId}`);
    });
    $("#yearBoard").addEventListener("dragover", (event) => {
      const zone = event.target.closest("[data-drop-session]");
      if (!zone) return;
      event.preventDefault();
      zone.classList.add("drag-over");
    });
    $("#yearBoard").addEventListener("dragleave", (event) => {
      const zone = event.target.closest("[data-drop-session]");
      if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove("drag-over");
    });
    $("#yearBoard").addEventListener("drop", async (event) => {
      const zone = event.target.closest("[data-drop-session]");
      if (!zone) return;
      event.preventDefault();
      $$(".term-zone.drag-over").forEach((item) => item.classList.remove("drag-over"));
      const courseId = event.dataTransfer.getData("application/x-course-id") || draggedCourseId;
      const instanceId = event.dataTransfer.getData("application/x-plan-entry") || draggedInstanceId;
      const session = zone.dataset.dropSession || "regular";
      if (courseId) await addCatalogCourse(courseId, Number(zone.dataset.dropYear), Number(zone.dataset.dropSemester), session);
      else if (instanceId) await moveEntry(instanceId, Number(zone.dataset.dropYear), Number(zone.dataset.dropSemester), session);
      draggedInstanceId = "";
      draggedCourseId = "";
    });
    $("#yearBoard").addEventListener("dragend", () => {
      $$(".term-zone.drag-over").forEach((item) => item.classList.remove("drag-over"));
      draggedInstanceId = "";
    });

    $("#addExtraYearButton").addEventListener("click", addExtraYear);
    $("#exportButton").addEventListener("click", exportPlan);
    $("#importInput").addEventListener("change", (event) => { if (event.target.files[0]) importPlan(event.target.files[0]); });
    $("#printButton").addEventListener("click", printReport);
    $("#reportPrintButton").addEventListener("click", printReport);
    $("#resetButton").addEventListener("click", () => {
      if (!window.confirm("학생 설정과 모든 과목 배정을 초기화할까요?")) return;
      state = defaultState();
      saveState();
      renderAll();
      toast("계획을 초기화했습니다.");
    });
  }

  initializeTheme();
  populateControls();
  bindEvents();
  renderGuide();
  renderAll();
})();
