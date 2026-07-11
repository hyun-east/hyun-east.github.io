"use strict";

const assert = require("node:assert/strict");
const data = require("../assets/curriculum-data.js");
const engine = require("../assets/graduation-engine.js");

let sequence = 0;
const entry = (courseId, year = 1, term = "spring") => ({ instanceId: `e-${sequence += 1}`, courseId, year, term });
const custom = (name, credits, category, options = {}) => ({
  instanceId: `c-${sequence += 1}`,
  year: options.year || 4,
  term: options.term || "fall",
  custom: {
    id: `custom-${sequence}`,
    name,
    credits,
    category,
    classification: options.classification || "",
    track: options.track || "",
    equivalentId: options.equivalentId || ""
  }
});

function baseState(cohort = 2025) {
  return {
    cohort,
    degree: "science",
    primaryTrack: "",
    secondaryMode: "none",
    secondaryTrack: "",
    foreignStudent: false,
    koreanExempt: false,
    entries: []
  };
}

function complete2025State() {
  const state = baseState(2025);
  const baseIds = [
    "eng_math_1", "multivariable_calculus", "linear_algebra",
    "general_physics_1", "general_physics_lab_1", "general_physics_2",
    "general_chemistry_1", "general_chemistry_lab_1", "general_chemistry_2",
    "intro_biology", "general_biology_lab",
    "programming", "data_science_basics", "creative_mechanical_design",
    "academic_writing", "future_literacy", "career_exploration_1", "career_exploration_2",
    "comparative_history", "law_society", "understanding_novel", "intro_economics",
    "academic_english_speaking", "academic_english_research"
  ];
  const trackIds = [
    "analytical_mechanics_1", "modern_physics", "electrodynamics_1", "analytical_mechanics_2",
    "quantum_mechanics_1", "mathematical_physics", "electrodynamics_2", "solid_state_physics_1", "quantum_mechanics_2"
  ];
  state.entries = [
    ...baseIds.map((id) => entry(id)),
    ...trackIds.map((id) => entry(id, 3, "spring")),
    entry("design_thinking", 1, "spring"), entry("design_planning_strategy", 2, "fall"),
    entry("ugrp_1", 3, "spring"), entry("ugrp_2", 3, "fall"),
    entry("domestic_intern_1", 2, "summer"),
    custom("심화 자유선택 보충", 32, "advancedOther")
  ];
  return state;
}

function run() {
  assert.equal(data.courses.length, new Set(data.courses.map((course) => course.id)).size, "course ids must be unique");
  data.courses.forEach((course) => assert.ok(["required", "elective"].includes(course.requirement), `missing requirement type: ${course.id}`));
  for (const [trackId, rule] of Object.entries(data.trackRules)) {
    assert.ok(data.tracks.some((track) => track.id === trackId), `unknown track rule: ${trackId}`);
    const refs = [
      ...(rule.majorRequired || []), ...(rule.minorRequired || []),
      ...(rule.majorAnyOf || []).flat(), ...(rule.minorAnyOf || []).flat(),
      ...(rule.majorChoose?.ids || []), ...(rule.minorChoose?.ids || [])
    ];
    refs.forEach((id) => assert.ok(data.courses.some((course) => course.id === id), `unknown course reference: ${id}`));
  }

  assert.equal(engine.cohortKey(2020), "2020");
  assert.equal(engine.cohortKey(2024), "2021-2024");
  assert.equal(engine.cohortKey(2025), "2025+");

  const empty = engine.audit(baseState(2025), data);
  assert.equal(empty.canGraduate, false);
  assert.equal(empty.rule.totalCredits, 130);
  assert.ok(empty.unmet.length > 10);

  const cohort2020 = engine.audit(baseState(2020), data);
  assert.equal(cohort2020.rule.baseCredits, 62);
  assert.equal(cohort2020.rule.totalCredits, 134);
  assert.ok(cohort2020.requirements.base.some((item) => item.id === "arts"));
  const arts2020 = engine.audit({ ...baseState(2020), entries: [entry("music_1")] }, data);
  const arts2025 = engine.audit({ ...baseState(2025), entries: [entry("music_1")] }, data);
  assert.equal(arts2020.entries[0].course.classification, "basicRequired");
  assert.equal(arts2025.entries[0].course.classification, "basicElective");

  const ai2024 = engine.audit({ ...baseState(2024), entries: [entry("ai_basics")] }, data);
  assert.equal(ai2024.credits.computing, 3);
  assert.equal(ai2024.credits.trackAny, 0);
  const ai2025 = engine.audit({ ...baseState(2025), entries: [entry("ai_basics")] }, data);
  assert.equal(ai2025.credits.computing, 0);
  assert.equal(ai2025.credits.trackAny, 3);

  assert.equal(engine.isOffered(data.courses.find((course) => course.id === "general_physics_1"), "spring"), true);
  assert.equal(engine.isOffered(data.courses.find((course) => course.id === "general_physics_1"), "fall"), false);
  assert.equal(engine.isOffered(data.courses.find((course) => course.id === "domestic_intern_1"), "summer"), true);

  const basicElective = engine.audit({
    ...baseState(2025),
    entries: [custom("기초선택 인정과목", 9, "math", { classification: "basicElective" })]
  }, data);
  assert.equal(basicElective.credits.total, 9);
  assert.equal(basicElective.credits.base, 0, "basic electives must not count toward required basic credits");
  assert.equal(basicElective.credits.math, 0, "basic electives must not satisfy a required basic area");

  const electiveCannotReplace = engine.audit({
    ...baseState(2025),
    entries: [custom("공학수학 선택 대체", 3, "math", { classification: "basicElective", equivalentId: "eng_math_1" })]
  }, data);
  assert.equal(electiveCannotReplace.requirements.base.find((item) => item.id === "math").missing.includes("공학수학Ⅰ"), true,
    "an elective custom entry must not replace a designated required course");

  const advancedElective = engine.audit({
    ...baseState(2025),
    entries: [custom("심화선택 인정과목", 3, "nontrack", { classification: "advancedElective" })]
  }, data);
  assert.equal(advancedElective.credits.advanced, 3);
  assert.equal(advancedElective.credits.nontrack, 0, "advanced electives must not satisfy required nontrack credits");
  const advancedRequired = engine.audit({
    ...baseState(2025),
    entries: [custom("심화필수 인정과목", 3, "nontrack", { classification: "advancedRequired" })]
  }, data);
  assert.equal(advancedRequired.credits.nontrack, 3);

  const complete = engine.audit(complete2025State(), data);
  assert.equal(complete.credits.base, 58, "complete fixture should have exactly 58 basic credits");
  assert.equal(complete.credits.advanced, 72, "complete fixture should have exactly 72 advanced credits");
  assert.equal(complete.credits.total, 130);
  assert.equal(complete.canGraduate, true, complete.unmet.map((item) => item.label).join(", "));

  const missingWritingState = complete2025State();
  missingWritingState.entries = missingWritingState.entries.filter((item) => item.courseId !== "academic_writing");
  missingWritingState.entries.push(custom("인문사회 선택 보충", 3, "humanities"));
  const missingWriting = engine.audit(missingWritingState, data);
  assert.equal(missingWriting.requirements.base.find((item) => item.id === "humanities").met, false, "credits alone must not replace named writing core");

  const equivalentState = complete2025State();
  equivalentState.entries = equivalentState.entries.filter((item) => item.courseId !== "eng_math_1");
  equivalentState.entries.push(custom("공학수학Ⅰ 대체 인정", 3, "math", { equivalentId: "eng_math_1" }));
  const equivalent = engine.audit(equivalentState, data);
  assert.equal(equivalent.requirements.base.find((item) => item.id === "math").met, true, "approved custom equivalence should satisfy named core");

  const foreign = complete2025State();
  foreign.foreignStudent = true;
  let foreignAudit = engine.audit(foreign, data);
  assert.equal(foreignAudit.requirements.base.find((item) => item.id === "korean").met, false);
  foreign.koreanExempt = true;
  foreignAudit = engine.audit(foreign, data);
  assert.equal(foreignAudit.requirements.base.find((item) => item.id === "korean").met, true);
  const koreanOptional = engine.audit({ ...baseState(2025), entries: [entry("korean_1")] }, data);
  const koreanRequired = engine.audit({ ...baseState(2025), foreignStudent: true, entries: [entry("korean_1")] }, data);
  assert.equal(koreanOptional.entries[0].course.classification, "basicElective");
  assert.equal(koreanRequired.entries[0].course.classification, "basicRequired");

  const internship10 = engine.audit({ ...baseState(2025), entries: [entry("domestic_intern_5")] }, data);
  assert.equal(internship10.credits.internship, 2, "10 registered-credit internship must count as 2 recognized credits");

  const intern2022 = engine.audit({ ...baseState(2022), entries: [entry("domestic_intern_1")] }, data);
  const intern2023 = engine.audit({ ...baseState(2023), entries: [entry("domestic_intern_1")] }, data);
  assert.equal(intern2022.requirements.advanced.find((item) => item.id === "internship").met, false);
  assert.equal(intern2023.requirements.advanced.find((item) => item.id === "internship").met, true);

  const startupCap = engine.audit({
    ...baseState(2025),
    entries: [entry("entrepreneurship_responsibility"), entry("management_principles"), entry("hightech_marketing")]
  }, data);
  assert.equal(startupCap.credits.total, 9);
  assert.equal(startupCap.credits.advanced, 6, "startup courses must be capped at 6 advanced credits");
  assert.equal(startupCap.warnings.some((warning) => warning.id === "recognition_cap_startup"), true);

  const urpCap = engine.audit({
    ...baseState(2025),
    entries: [
      entry("urp_1"), entry("urp_2"),
      custom("추가 URP 인정과목", 3, "urp", { classification: "advancedElective" })
    ]
  }, data);
  assert.equal(urpCap.credits.total, 7);
  assert.equal(urpCap.credits.advanced, 4, "URP must be capped at 4 advanced credits");
  assert.equal(urpCap.warnings.some((warning) => warning.id === "recognition_cap_urp"), true);

  const thesisCap = engine.audit({
    ...baseState(2025),
    entries: [
      entry("thesis_1"), entry("thesis_2"),
      custom("추가 Thesis 인정과목", 2, "thesis", { classification: "advancedElective" })
    ]
  }, data);
  assert.equal(thesisCap.credits.total, 4);
  assert.equal(thesisCap.credits.advanced, 2, "Thesis must be capped at 2 advanced credits");
  assert.equal(thesisCap.warnings.some((warning) => warning.id === "recognition_cap_thesis"), true);

  const internshipCap = engine.audit({
    ...baseState(2025),
    entries: [entry("domestic_intern_3"), entry("domestic_intern_4"), entry("overseas_intern_2")]
  }, data);
  assert.equal(internshipCap.credits.total, 6);
  assert.equal(internshipCap.credits.advanced, 4, "internships must be capped at 4 advanced credits");
  assert.equal(internshipCap.warnings.some((warning) => warning.id === "recognition_cap_internship"), true);

  const simultaneousResearch = engine.audit({
    ...baseState(2025),
    entries: [entry("ugrp_1", 3, "spring"), entry("urp_2", 3, "spring")]
  }, data);
  assert.equal(simultaneousResearch.warnings.some((warning) => warning.id.startsWith("ugrp_urp_")), true,
    "UGRP and URP in the same scheduled semester must raise a warning");

  const biologyLabCap = engine.audit({
    ...baseState(2025),
    primaryTrack: "biology",
    entries: [entry("cell_biology_lab"), entry("genetics_lab"), entry("molecular_biology_lab")]
  }, data);
  assert.equal(biologyLabCap.credits.trackById.biology, 6, "biology experiments must be capped at 6 track credits");

  const computerMath = engine.audit({
    ...baseState(2025),
    primaryTrack: "computer",
    entries: [entry("eng_math_1"), entry("multivariable_calculus"), entry("eng_math_2")]
  }, data);
  assert.equal(computerMath.requirements.base.find((item) => item.id === "math").met, true, "the graduation math block accepts its listed choice group");
  assert.equal(computerMath.requirements.advanced.find((item) => item.id === "major_computer").missing.includes("선형대수학"), true, "linear algebra belongs to the Computer Science program block");

  const electricalChoice = engine.audit({
    ...baseState(2025),
    primaryTrack: "electrical",
    entries: [entry("creative_mechanical_design")]
  }, data);
  assert.equal(electricalChoice.requirements.base.find((item) => item.id === "engineering_choice").met, true, "creative mechanical design satisfies the graduation engineering-choice block");
  assert.equal(electricalChoice.requirements.advanced.find((item) => item.id === "major_electrical").missing.some((name) => name.includes("회로이론")), true, "the circuit pair belongs to the Electrical Engineering program block");

  const physicsProgram = engine.audit({
    ...baseState(2025),
    primaryTrack: "physics",
    entries: [
      "analytical_mechanics_1", "electrodynamics_1", "quantum_mechanics_1", "thermal_stat_physics",
      "general_physics_2", "advanced_physics_lab", "modern_physics", "analytical_mechanics_2", "mathematical_physics", "electrodynamics_2", "solid_state_physics_1"
    ].map((id) => entry(id, 3, "spring"))
  }, data);
  assert.equal(physicsProgram.requirements.advanced.find((item) => item.id === "major_physics").met, true);

  const overlap = engine.audit({
    ...baseState(2025),
    primaryTrack: "computer",
    secondaryMode: "double",
    secondaryTrack: "electrical",
    entries: ["data_structures", "discrete_math", "object_oriented_programming", "computer_architecture"].map((id) => entry(id, 3, "spring"))
  }, data);
  assert.equal(overlap.credits.overlap, 12);
  assert.equal(overlap.credits.secondaryRecognized, 6);
  assert.equal(overlap.credits.advanced, 12, "cross-listed courses must count once in the overall advanced total");
  assert.equal(overlap.warnings.some((warning) => warning.id === "track_overlap"), true);

  const overlapExactlySix = engine.audit({
    ...baseState(2025),
    primaryTrack: "computer",
    secondaryMode: "minor",
    secondaryTrack: "electrical",
    entries: ["data_structures", "discrete_math"].map((id) => entry(id, 3, "spring"))
  }, data);
  assert.equal(overlapExactlySix.credits.overlap, 6);
  assert.equal(overlapExactlySix.credits.secondaryRecognized, 6);
  assert.equal(overlapExactlySix.warnings.some((warning) => warning.id === "track_overlap"), false,
    "exactly 6 overlapping credits are fully recognized without a warning");

  const electricalFoundations = ["general_physics_2", "circuit_theory", "circuit_lab"];
  const fourShared = ["data_structures", "discrete_math", "object_oriented_programming", "computer_architecture"];
  const electricalRequiredAndUnique = [
    "signals_systems", "electronic_circuit_1", "electronic_device_theory", "digital_logic", "communications_basics"
  ];
  const cappedDouble = engine.audit({
    ...baseState(2025),
    primaryTrack: "computer",
    secondaryMode: "double",
    secondaryTrack: "electrical",
    entries: [...electricalFoundations, ...fourShared, ...electricalRequiredAndUnique].map((id) => entry(id, 3, "spring"))
  }, data);
  assert.equal(cappedDouble.credits.trackById.electrical, 27);
  assert.equal(cappedDouble.credits.secondaryRecognized, 21);
  assert.equal(cappedDouble.programs.secondary.missing.length, 0, "all Electrical designated courses should be present");
  assert.equal(cappedDouble.programs.secondary.met, false,
    "a raw 27-credit second major must fail when overlap above 6 leaves only 21 recognized credits");

  const enoughUniqueForDouble = engine.audit({
    ...baseState(2025),
    primaryTrack: "computer",
    secondaryMode: "double",
    secondaryTrack: "electrical",
    entries: [
      ...electricalFoundations, ...fourShared, ...electricalRequiredAndUnique,
      "analog_electronics", "digital_communications"
    ].map((id) => entry(id, 3, "spring"))
  }, data);
  assert.equal(enoughUniqueForDouble.credits.trackById.electrical, 33);
  assert.equal(enoughUniqueForDouble.credits.secondaryRecognized, 27);
  assert.equal(enoughUniqueForDouble.programs.secondary.met, true,
    "the second major should pass after adding enough unique credits beyond the 6-credit overlap allowance");

  const broadDegreeFallbackState = complete2025State();
  broadDegreeFallbackState.primaryTrack = "physics";
  const broadDegreeFallback = engine.audit(broadDegreeFallbackState, data);
  assert.equal(broadDegreeFallback.canGraduate, true, "an incomplete major notation must not block the interdisciplinary degree");
  assert.equal(broadDegreeFallback.programs.primary.met, false);
  assert.equal(broadDegreeFallback.degreeLabel, "융복합 이학사");

  const physicsLabBlock = data.requirementBlocks.find((block) => block.id === "physics_lab");
  assert.deepEqual(physicsLabBlock.courseIds, ["general_physics_lab_1", "general_physics_lab_2"]);
  assert.equal(physicsLabBlock.requiredCount, 1, "physics lab I must not be presented as individually mandatory");
  const physicsWithLab2 = engine.audit({
    ...baseState(2025),
    entries: [entry("general_physics_1"), entry("general_physics_lab_2")]
  }, data);
  assert.equal(physicsWithLab2.requirements.base.find((item) => item.id === "physics").met, true, "either physics lab must satisfy the physics experiment block");

  console.log(`OK: ${data.courses.length} courses, graduation engine rules validated.`);
}

run();
