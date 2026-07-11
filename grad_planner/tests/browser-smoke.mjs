import assert from "node:assert/strict";
import fs from "node:fs";

const port = Number(process.env.CDP_PORT || 9222);
const targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const target = targets.find((item) => item.type === "page" && item.url.includes("127.0.0.1:8000"));
assert.ok(target, "Start Chrome with remote debugging on port 9222 and open the local app first.");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
const exceptions = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text);
});

function command(method, params = {}) {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, timeout = 3000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

await command("Runtime.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await evaluate("localStorage.clear(); true");
await command("Page.reload", { ignoreCache: true });
await waitFor("document.readyState === 'complete' && document.querySelectorAll('.catalog-card').length > 0");

const initial = await evaluate(`({
  catalog: document.querySelectorAll('.catalog-card').length,
  catalogGroups: document.querySelectorAll('.catalog-group').length,
  trackGroups: document.querySelectorAll('.track-catalog-group').length,
  openTrackGroups: document.querySelectorAll('.track-catalog-group[open]').length,
  generalGroups: document.querySelectorAll('.general-catalog-group').length,
  openGeneralGroups: document.querySelectorAll('.general-catalog-group[open]').length,
  catalogPools: document.querySelectorAll('.catalog-pool').length,
  uniqueCatalogCourses: new Set([...document.querySelectorAll('#catalogList [data-course-id]')].map((item) => item.dataset.courseId)).size,
  years: document.querySelectorAll('.year-card').length,
  terms: document.querySelectorAll('.term-zone').length,
  regularTerms: document.querySelectorAll('.regular-slot').length,
  seasonalTerms: document.querySelectorAll('.seasonal-slot').length,
  parityButtons: document.querySelectorAll('.parity-toggle').length,
  blocks: document.querySelectorAll('.requirement-block').length,
  summary: document.querySelectorAll('#summaryStrip .summary-card').length,
  cohort: document.querySelector('#cohortSelect').value,
  degree: document.querySelector('#degreeSelect').value,
  staleSaveCopy: document.body.textContent.includes('이 브라우저에 자동 저장'),
  cacheButtonPresent: Boolean(document.querySelector('#cacheResetButton')),
  headerLinks: [...document.querySelectorAll('.profile-links a')].map((link) => {
    const rect = link.getBoundingClientRect();
    return { text: link.textContent.trim(), top: rect.top, height: rect.height };
  }),
  versionedAssets: [...document.querySelectorAll('link[href*="assets/"], script[src*="assets/"]')]
    .every((item) => (item.getAttribute('href') || item.getAttribute('src')).includes('?v=')),
  headerBackground: getComputedStyle(document.querySelector('.topbar')).backgroundColor,
  title: document.querySelector('h1').textContent
})`);
assert.ok(initial.catalog > 20);
assert.ok(initial.catalogGroups > 15);
assert.equal(initial.trackGroups, 9);
assert.equal(initial.openTrackGroups, 0);
assert.equal(initial.generalGroups, 4);
assert.equal(initial.openGeneralGroups, 0);
assert.equal(initial.catalogPools, 4);
assert.equal(initial.uniqueCatalogCourses, 269);
assert.equal(initial.years, 4);
assert.equal(initial.terms, 16);
assert.equal(initial.regularTerms, 8);
assert.equal(initial.seasonalTerms, 8);
assert.equal(initial.parityButtons, 8);
assert.ok(initial.blocks > 10);
assert.equal(initial.summary, 4);
assert.equal(initial.cohort, "2025");
assert.equal(initial.degree, "engineering");
assert.equal(initial.staleSaveCopy, false);
assert.equal(initial.cacheButtonPresent, false);
assert.equal(initial.versionedAssets, true);
assert.equal(initial.headerLinks.find((item) => item.text === "제작자 웹사이트")?.height, 20);
assert.equal(new Set(initial.headerLinks.map((item) => item.top)).size, 1);
assert.equal(new Set(initial.headerLinks.map((item) => item.height)).size, 1);
assert.equal(initial.title, "DGIST Graduation Planner");

await evaluate("document.querySelector('#themeToggle').click(); true");
assert.equal(await evaluate("document.documentElement.getAttribute('data-theme')"), "dark");
assert.match(await evaluate("getComputedStyle(document.body).backgroundColor"), /15, 17, 23/);
await evaluate("document.querySelector('#themeToggle').click(); true");

const physicsLabBlock = await evaluate(`(() => {
  const block = [...document.querySelectorAll('.requirement-block')].find((item) => item.textContent.includes('물리 실험'));
  return { text: block.textContent, courses: block.querySelectorAll('[data-course-id]').length };
})()`);
assert.match(physicsLabBlock.text, /실험Ⅰ·Ⅱ 중 1과목/);
assert.equal(physicsLabBlock.courses, 2);
assert.match(physicsLabBlock.text, /물리 실험 · 실험Ⅰ·Ⅱ 중 1과목/);
assert.equal(await evaluate(`document.querySelectorAll('.requirement-block .role-badge.required').length > 0`), true);
assert.equal(await evaluate(`(() => {
  const block = [...document.querySelectorAll('.requirement-block')].find((item) => item.textContent.includes('물리 실험'));
  return block.querySelectorAll('.role-badge.choice').length === 2 && block.querySelectorAll('.role-badge.required').length === 0;
})()`), true);

const groupedCatalog = await evaluate(`(() => {
  const labels = [...document.querySelectorAll('.catalog-group-header strong')].map((item) => item.textContent);
  const physicsRequired = document.querySelector('[data-catalog-group="track_physics"] [data-course-id="analytical_mechanics_1"] .role-badge.program')?.textContent;
  const physicsChoice = document.querySelector('[data-catalog-group="track_physics"] [data-course-id="solid_state_physics_1"] .role-badge.optional')?.textContent;
  const cards = [...document.querySelectorAll('.catalog-group .catalog-card')];
  return {
    labels,
    physicsRequired,
    physicsChoice,
    poolLabels: [...document.querySelectorAll('.catalog-pool-header h3')].map((item) => item.textContent),
    allHaveRole: cards.every((card) => card.querySelector('.role-badge.classification')),
    allNonToggleGroupsVisible: [...document.querySelectorAll('.catalog-group:not(.catalog-toggle-group)')]
      .every((group) => group.getClientRects().length > 0),
    collapsedGeneralHidden: !document.querySelector('[data-catalog-group="general_humanities"] .catalog-card').checkVisibility(),
    basicElectiveCount: new Set([...document.querySelectorAll('[data-course-pool="basicElective"] [data-course-id]')].map((item) => item.dataset.courseId)).size,
    advancedElectiveCount: new Set([...document.querySelectorAll('[data-course-pool="advancedElective"] [data-course-id]')].map((item) => item.dataset.courseId)).size,
    engineeringChoiceBlock: [...document.querySelectorAll('[data-catalog-group="engineering_choice"] [data-course-id]')].map((item) => item.dataset.courseId),
    computingFamily: [...document.querySelectorAll('[data-catalog-group="basic_computing"] [data-course-id]')].map((item) => item.dataset.courseId),
    filterScroll: (() => {
      const filter = document.querySelector('#filtersPanel');
      const rect = filter.getBoundingClientRect();
      return {
        overflow: getComputedStyle(filter).overflowY,
        overscroll: getComputedStyle(filter).overscrollBehaviorY,
        scrollable: filter.scrollHeight > filter.clientHeight,
        withinViewport: rect.bottom <= innerHeight + 1
      };
    })(),
    firstYearOrder: [...document.querySelector('.year-card .term-grid').children].map((item) => item.dataset.dropSession),
    seasonalHasParity: Boolean(document.querySelector('.seasonal-slot .parity-toggle')),
    regularMin: parseFloat(getComputedStyle(document.querySelector('.regular-slot')).minHeight),
    seasonalMin: parseFloat(getComputedStyle(document.querySelector('.seasonal-slot')).minHeight),
    yearRadius: parseFloat(getComputedStyle(document.querySelector('.year-card')).borderRadius)
  };
})()`);
assert.ok(groupedCatalog.labels.includes("교양 · 인문사회"));
assert.ok(groupedCatalog.labels.includes("심화 · 비트랙/융합"));
assert.ok(groupedCatalog.labels.includes("트랙 · 물리학"));
assert.deepEqual(groupedCatalog.poolLabels, ["기초필수", "기초선택", "심화필수", "심화선택"]);
assert.match(groupedCatalog.physicsRequired, /전공 지정/);
assert.match(groupedCatalog.physicsChoice, /트랙 선택/);
assert.equal(groupedCatalog.allHaveRole, true);
assert.equal(groupedCatalog.allNonToggleGroupsVisible, true);
assert.equal(groupedCatalog.collapsedGeneralHidden, true);
assert.equal(groupedCatalog.basicElectiveCount, 7);
assert.equal(groupedCatalog.advancedElectiveCount, 10);
assert.deepEqual(groupedCatalog.engineeringChoiceBlock.sort(), [
  "circuit_lab", "circuit_theory", "creative_mechanical_design", "intro_chemical_engineering"
]);
assert.deepEqual(groupedCatalog.computingFamily.sort(), ["data_science_basics", "programming"]);
assert.equal(groupedCatalog.filterScroll.overflow, "auto");
assert.equal(groupedCatalog.filterScroll.overscroll, "contain");
assert.equal(groupedCatalog.filterScroll.scrollable, true);
assert.equal(groupedCatalog.filterScroll.withinViewport, true);
assert.deepEqual(groupedCatalog.firstYearOrder, ["regular", "regular", "summer", "winter"]);
assert.equal(groupedCatalog.seasonalHasParity, false);
assert.ok(groupedCatalog.seasonalMin < groupedCatalog.regularMin);
assert.ok(groupedCatalog.yearRadius <= 8);

await evaluate(`new Promise((resolve) => {
  document.querySelector('[data-track-group="physics"] > summary').click();
  requestAnimationFrame(() => resolve(true));
})`);
assert.equal(await evaluate("document.querySelector('[data-track-group=\"physics\"]').open"), true);
assert.equal(await evaluate("document.querySelector('[data-track-group=\"physics\"] [data-course-id=\"solid_state_physics_1\"]').getClientRects().length > 0"), true);
await evaluate(`new Promise((resolve) => {
  document.querySelector('[data-catalog-group="general_humanities"] > summary').click();
  requestAnimationFrame(() => resolve(true));
})`);
assert.equal(await evaluate("document.querySelector('[data-catalog-group=\"general_humanities\"]').open"), true);
assert.equal(await evaluate("document.querySelector('[data-catalog-group=\"general_humanities\"] .catalog-card').getClientRects().length > 0"), true);

// Drag a course from the full catalog pool directly into a semester slot.
await evaluate(`(() => {
  const card = document.querySelector('[data-course-id="eng_math_1"]');
  const zone = document.querySelector('[data-drop-year="1"][data-drop-semester="1"][data-drop-session="regular"]');
  const transfer = new DataTransfer();
  card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
  zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
  return true;
})()`);
await waitFor("document.querySelectorAll('[data-instance-id]').length === 1");
assert.equal(await evaluate("document.querySelector('[data-track-group=\"physics\"]').open"), true);
assert.equal(await evaluate("document.querySelector('[data-catalog-group=\"general_humanities\"]').open"), true);
assert.match(await evaluate("document.querySelector('[data-drop-year=\"1\"][data-drop-semester=\"1\"][data-drop-session=\"regular\"]').textContent"), /공학수학Ⅰ/);
assert.match(await evaluate("document.querySelector('[data-drop-year=\"1\"][data-drop-semester=\"1\"][data-drop-session=\"regular\"] .planned-role-badges').textContent"), /개별 필수/);
assert.match(await evaluate("document.querySelector('[data-drop-year=\"1\"][data-drop-semester=\"1\"][data-drop-session=\"regular\"] .planned-role-badges').textContent"), /기초필수/);

// General Physics I is a spring-only course. Deliberately assign it to fall
// and verify that the explicit confirmation dialog appears before it is added.
await evaluate(`(() => {
  document.querySelector('[data-add-course="general_physics_1"]').click();
  document.querySelector('#targetYear').value = '1';
  document.querySelector('#targetSemester').value = '2';
  document.querySelector('#targetSession').value = 'regular';
  document.querySelector('#confirmAddCourse').click();
  return true;
})()`);
await waitFor("document.querySelector('#confirmDialog').open");
const confirmation = await evaluate("document.querySelector('#confirmMessage').textContent");
assert.match(confirmation, /정말 넣으시겠습니까/);
await evaluate("document.querySelector('#confirmDialog [value=confirm]').click(); true");
await waitFor("document.querySelectorAll('[data-instance-id]').length === 2");
assert.equal(await evaluate("document.querySelectorAll('.planned-course.off-term').length"), 1);

// Cancel and close must work even when required custom fields are empty.
await evaluate("document.querySelector('#openCustomCourse').click(); true");
await waitFor("document.querySelector('#customCourseDialog').open");
assert.equal(await evaluate("document.querySelector('#customClassification').value"), "basicRequired");
await evaluate("document.querySelector('[data-close-dialog=customCourseDialog]').click(); true");
await waitFor("document.querySelector('#customCourseDialog').open === false");

// The four direct-entry classifications constrain areas and required-course equivalence.
const customClassificationControls = await evaluate(`(() => {
  document.querySelector('#openCustomCourse').click();
  const classification = document.querySelector('#customClassification');
  classification.value = 'advancedElective';
  classification.dispatchEvent(new Event('change'));
  const advancedElectiveCategories = [...document.querySelector('#customCategory').options].map((option) => option.value);
  const equivalentDisabled = document.querySelector('#customEquivalent').disabled;
  classification.value = 'advancedRequired';
  classification.dispatchEvent(new Event('change'));
  const advancedRequiredCategories = [...document.querySelector('#customCategory').options].map((option) => option.value);
  document.querySelector('[data-close-dialog=customCourseDialog]').click();
  return { advancedElectiveCategories, advancedRequiredCategories, equivalentDisabled };
})()`);
assert.deepEqual(customClassificationControls.advancedElectiveCategories, ["startup", "urp", "thesis", "advancedOther"]);
assert.deepEqual(customClassificationControls.advancedRequiredCategories, ["track", "nontrack", "ugrp", "internship"]);
assert.equal(customClassificationControls.equivalentDisabled, true);

// Add a summer custom course and ensure the chosen classification is retained.
await evaluate(`(() => {
  document.querySelector('#openCustomCourse').click();
  document.querySelector('#customName').value = '교환학생 인정과목';
  document.querySelector('#customCredits').value = '3';
  document.querySelector('#customCategory').value = 'humanities';
  document.querySelector('#customCategory').dispatchEvent(new Event('change'));
  document.querySelector('#customYear').value = '2';
  document.querySelector('#customSemester').value = '1';
  document.querySelector('#customSession').value = 'summer';
  document.querySelector('#confirmCustomCourse').click();
  return true;
})()`);
await waitFor("document.querySelectorAll('[data-instance-id]').length === 3");
assert.match(await evaluate("document.querySelector('[data-drop-year=\"2\"][data-drop-session=\"summer\"]').textContent"), /교환학생 인정과목/);
assert.match(await evaluate("document.querySelector('[data-drop-year=\"2\"][data-drop-session=\"summer\"] .planned-role-badges').textContent"), /기초필수/);

// Planned courses can also be dragged between regular and seasonal slots.
await evaluate(`(() => {
  const card = [...document.querySelectorAll('[data-instance-id]')].find((item) => item.textContent.includes('교환학생 인정과목'));
  const zone = document.querySelector('[data-drop-year="2"][data-drop-session="winter"]');
  const transfer = new DataTransfer();
  card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer }));
  zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  zone.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  card.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: transfer }));
  return true;
})()`);
await waitFor("document.querySelector('[data-drop-year=\"2\"][data-drop-session=\"winter\"]').textContent.includes('교환학생 인정과목')");
assert.doesNotMatch(await evaluate("document.querySelector('[data-drop-year=\"2\"][data-drop-session=\"summer\"]').textContent"), /교환학생 인정과목/);

// Odd-semester toggles apply from their slot forward and compose cumulatively.
await evaluate("document.querySelector('[data-toggle-parity=\"1-2\"]').click(); true");
assert.match(await evaluate("document.querySelector('[data-drop-year=\"1\"][data-drop-semester=\"2\"][data-drop-session=\"regular\"] .season-chip').textContent"), /봄학기/);
assert.match(await evaluate("document.querySelector('[data-drop-year=\"2\"][data-drop-semester=\"1\"][data-drop-session=\"regular\"] .season-chip').textContent"), /가을학기/);
await evaluate("document.querySelector('[data-toggle-parity=\"2-1\"]').click(); true");
assert.match(await evaluate("document.querySelector('[data-drop-year=\"2\"][data-drop-semester=\"1\"][data-drop-session=\"regular\"] .season-chip').textContent"), /봄학기/);
assert.match(await evaluate("document.querySelector('[data-drop-year=\"2\"][data-drop-semester=\"2\"][data-drop-session=\"regular\"] .season-chip').textContent"), /가을학기/);

// Header usage link must activate the guide panel.
await evaluate("document.querySelector('[data-go-view=guide]').click(); true");
await waitFor("document.querySelector('#guideView').hidden === false");
assert.match(await evaluate("document.querySelector('#guideView').textContent"), /엇학기 설정/);

// Diagnosis view and print stylesheet must both be populated.
await evaluate("document.querySelector('[data-view=diagnosis]').click(); true");
await waitFor("document.querySelector('#diagnosisView').hidden === false");
assert.ok(await evaluate("document.querySelectorAll('.audit-item').length") > 10);
assert.equal(await evaluate("document.querySelectorAll('.plan-table tbody tr').length"), 16);

const pdf = await command("Page.printToPDF", { landscape: true, printBackground: true, paperWidth: 11.69, paperHeight: 8.27 });
const pdfPath = "/tmp/dgist-graduation-planner-smoke.pdf";
fs.writeFileSync(pdfPath, Buffer.from(pdf.data, "base64"));
assert.ok(fs.statSync(pdfPath).size > 10_000);

assert.deepEqual(exceptions, [], `Browser exceptions: ${exceptions.join("; ")}`);
console.log(`OK: aligned header, track/general toggles, 269 courses, strict entries, Z-layout, and PDF (${fs.statSync(pdfPath).size} bytes).`);
socket.close();
