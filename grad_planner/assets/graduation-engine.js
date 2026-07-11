(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.GraduationEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const round = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  function cohortKey(cohort) {
    const year = Number(cohort);
    if (year === 2020) return "2020";
    if (year >= 2025) return "2025+";
    return "2021-2024";
  }

  function buildCourseMap(data) {
    return new Map(data.courses.map((course) => [course.id, course]));
  }

  function classificationKey(level, requirement) {
    if (level === "basic") return requirement === "required" ? "basicRequired" : "basicElective";
    if (level === "advanced") return requirement === "required" ? "advancedRequired" : "advancedElective";
    return "generalElective";
  }

  function effectiveCourse(entry, courseMap, cohort, data, context = {}) {
    let course;
    if (entry.custom) {
      const category = data.categories[entry.custom.category] || data.categories.general;
      const fallbackClassification = classificationKey(category.level, category.requirement || "elective");
      const classification = ["basicRequired", "basicElective", "advancedRequired", "advancedElective"].includes(entry.custom.classification)
        ? entry.custom.classification : fallbackClassification;
      const level = classification.startsWith("basic") ? "basic" : classification.startsWith("advanced") ? "advanced" : category.level;
      const requirement = classification.endsWith("Required") ? "required" : "elective";
      course = {
        id: entry.custom.id || entry.instanceId,
        name: entry.custom.name || "직접 입력 과목",
        credits: Number(entry.custom.credits) || 0,
        level,
        category: entry.custom.category || "general",
        requirement,
        classification,
        tracks: entry.custom.track ? [entry.custom.track] : [],
        equivalentId: entry.custom.equivalentId || "",
        custom: true,
        note: entry.custom.note || ""
      };
    } else {
      course = courseMap.get(entry.courseId);
      if (!course) return null;
      course = { ...course };
    }

    // 인공지능기초 is basic computing only through the 2024 cohort. From the
    // 2025 cohort it is an advanced Computer Science track course (PDF p.4/16).
    if (course.id === "ai_basics" && Number(cohort) >= 2025) {
      course.level = "advanced";
      course.category = "track";
      course.requirement = "required";
      course.tracks = ["computer"];
    }
    if (Array.isArray(course.coreFor) && !course.coreFor.includes(Number(cohort))) {
      course.requirement = "elective";
    }
    if (course.coreForForeignFrom) {
      course.requirement = Number(cohort) >= Number(course.coreForForeignFrom) && context.foreignStudent ? "required" : "elective";
    }
    course.requirement = course.requirement || data.categories[course.category]?.requirement || "elective";
    course.classification = classificationKey(course.level, course.requirement);
    course.recognizedCredits = Number(course.recognizedCredits ?? course.credits) || 0;
    return course;
  }

  function audit(state, data) {
    if (!data) throw new Error("Curriculum data is required.");
    const cohort = Number(state.cohort) || 2025;
    const key = cohortKey(cohort);
    const rule = data.cohortRules[key];
    const courseMap = buildCourseMap(data);
    const entries = (state.entries || [])
      .map((entry) => ({ entry, course: effectiveCourse(entry, courseMap, cohort, data, { foreignStudent: state.foreignStudent }) }))
      .filter((item) => item.course);

    const equivalentIds = new Set();
    entries.forEach(({ course }) => {
      if (!course.custom) equivalentIds.add(course.id);
      if (course.equivalentId && course.requirement === "required") equivalentIds.add(course.equivalentId);
    });
    const has = (id) => equivalentIds.has(id);
    const hasAny = (ids) => ids.some(has);
    const all = (ids) => ids.every(has);
    const credit = (predicate) => round(entries.filter(predicate).reduce((sum, item) => sum + item.course.recognizedCredits, 0));
    const categoryRequiredCredit = (category) => credit(({ course }) => course.category === category && course.requirement === "required");
    const categoryAllCredit = (category) => credit(({ course }) => course.category === category);
    const customRequiredCategoryCredit = (category) => credit(({ course }) => course.custom && course.category === category && course.requirement === "required");

    const selectedTracks = [state.primaryTrack, state.secondaryMode !== "none" ? state.secondaryTrack : ""].filter(Boolean);
    const totalCredits = credit(() => true);
    const baseAllCredits = credit(({ course }) => course.level === "basic");
    const baseCredits = credit(({ course }) => course.level === "basic" && course.requirement === "required");
    const rawAdvancedCredits = credit(({ course }) => course.level === "advanced");
    const mathCredits = categoryRequiredCredit("math");
    const physicsCredits = categoryRequiredCredit("physicsBasic");
    const chemistryCredits = categoryRequiredCredit("chemistryBasic");
    const biologyCredits = categoryRequiredCredit("biologyBasic");
    const scienceCredits = round(physicsCredits + chemistryCredits + biologyCredits);
    const computingCredits = categoryRequiredCredit("computingBasic");
    const engineeringChoiceCredits = categoryRequiredCredit("engineeringChoice");
    const humanitiesCredits = categoryRequiredCredit("humanities");
    const englishCredits = categoryRequiredCredit("english");
    const artsCredits = categoryRequiredCredit("arts");
    const trackCreditsAnyRaw = credit(({ course }) => course.category === "track" && course.requirement === "required"
      && (!course.custom || (course.tracks || []).length > 0));
    const nontrackCredits = categoryRequiredCredit("nontrack");
    const ugrpCredits = categoryRequiredCredit("ugrp");
    const internshipCredits = categoryRequiredCredit("internship");
    const startupCredits = categoryAllCredit("startup");
    const urpCredits = categoryAllCredit("urp");
    const thesisCredits = categoryAllCredit("thesis");
    const biologyExperimentCredits = credit(({ course }) => ["cell_biology_lab", "genetics_lab", "molecular_biology_lab"].includes(course.id));
    const biologyExperimentExcess = Math.max(0, biologyExperimentCredits - 6);
    const trackCreditsAny = round(trackCreditsAnyRaw - biologyExperimentExcess);
    const recognitionExcess = {
      startup: Math.max(0, startupCredits - 6),
      urp: Math.max(0, urpCredits - 4),
      thesis: Math.max(0, thesisCredits - 2),
      internship: Math.max(0, internshipCredits - 4),
      biologyExperiment: biologyExperimentExcess
    };
    const advancedCredits = round(rawAdvancedCredits - Object.values(recognitionExcess).reduce((sum, value) => sum + value, 0));

    const trackRawCredits = {};
    data.tracks.forEach((track) => {
      if (track.id === "autonomous") {
        trackRawCredits[track.id] = trackCreditsAny;
      } else {
        const raw = credit(({ course }) => course.category === "track" && course.requirement === "required" && (course.tracks || []).includes(track.id));
        trackRawCredits[track.id] = round(raw - (track.id === "biology" ? biologyExperimentExcess : 0));
      }
    });

    let overlapCredits = 0;
    if (state.primaryTrack && state.secondaryTrack && state.secondaryMode !== "none") {
      overlapCredits = credit(({ course }) => {
        if (course.category !== "track" || course.requirement !== "required") return false;
        const tracks = course.tracks || [];
        return tracks.includes(state.primaryTrack) && tracks.includes(state.secondaryTrack);
      });
    }
    const overlapExcess = Math.max(0, overlapCredits - 6);
    const secondaryRawCredits = state.secondaryTrack ? (trackRawCredits[state.secondaryTrack] || 0) : 0;
    const secondaryRecognizedCredits = round(Math.max(0, secondaryRawCredits - overlapExcess));

    const base = [];
    const advanced = [];
    const overall = [];
    const warnings = [];

    const req = (target, id, label, current, required, detail = "", options = {}) => {
      const met = options.met !== undefined ? Boolean(options.met) : Number(current) >= Number(required);
      const item = {
        id, label, current: round(Number(current) || 0), required: round(Number(required) || 0),
        unit: options.unit || "학점", met, detail, missing: options.missing || [], severity: options.severity || "required"
      };
      target.push(item);
      return item;
    };

    const missingNames = (ids) => ids.filter((id) => !has(id)).map((id) => courseMap.get(id)?.name || id);
    const mathChoiceIds = ["linear_algebra", "eng_math_2", "probability_statistics"];
    req(base, "math", "기초과학 · 수학", mathCredits, 9,
      "공학수학Ⅰ·다변수 미적분학과 선택군 1과목을 모두 충족해야 합니다.", {
        met: mathCredits >= 9 && all(["eng_math_1", "multivariable_calculus"]) && hasAny(mathChoiceIds),
        missing: [
          ...missingNames(["eng_math_1", "multivariable_calculus"]),
          ...(hasAny(mathChoiceIds) ? [] : ["선형대수학 / 공학수학Ⅱ / 확률과 통계 및 실습 중 1과목"])
        ]
      });

    const physicsNamed = has("general_physics_1") && hasAny(["general_physics_lab_1", "general_physics_lab_2"]);
    req(base, "physics", "기초과학 · 물리", physicsCredits, 4,
      "일반물리Ⅰ과 일반물리실험Ⅰ·Ⅱ 중 1과목이 필수입니다.", {
        met: physicsCredits >= 4 && physicsNamed,
        missing: [
          ...missingNames(["general_physics_1"]),
          ...(hasAny(["general_physics_lab_1", "general_physics_lab_2"]) ? [] : ["일반물리실험Ⅰ / Ⅱ 중 1과목"])
        ]
      });

    req(base, "chemistry", "기초과학 · 화학", chemistryCredits, 4,
      "일반화학Ⅰ과 일반화학실험Ⅰ이 필수입니다.", {
        met: chemistryCredits >= 4 && all(["general_chemistry_1", "general_chemistry_lab_1"]),
        missing: missingNames(["general_chemistry_1", "general_chemistry_lab_1"])
      });

    const biologyTheoryMet = hasAny(["intro_biology", "general_biology_1"]);
    req(base, "biology", "기초과학 · 생명과학", biologyCredits, 4,
      "생명과학개론(또는 일반생물학Ⅰ)과 일반생물학 실험이 필수입니다.", {
        met: biologyCredits >= 4 && biologyTheoryMet && has("general_biology_lab"),
        missing: [
          ...(biologyTheoryMet ? [] : ["생명과학개론 / 일반생물학Ⅰ 중 1과목"]),
          ...missingNames(["general_biology_lab"])
        ]
      });

    req(base, "basic_science", "기초과학 · 물리/화학/생명 합계", scienceCredits, 18,
      "세 영역의 지정 이론·실험 12학점에 더해 6학점 이상을 추가 이수합니다.");

    const computingIds = cohort >= 2025
      ? ["programming", "data_science_basics"]
      : ["programming", "data_science_basics", "ai_basics"];
    req(base, "computing", "기초공학 · 컴퓨터공학", computingCredits, rule.computingCredits,
      `${computingIds.map((id) => courseMap.get(id)?.name).join(" · ")} 지정필수`, {
        met: computingCredits >= rule.computingCredits && all(computingIds),
        missing: missingNames(computingIds)
      });

    const circuitPair = all(["circuit_theory", "circuit_lab"]);
    const engineeringChoiceNamed = has("creative_mechanical_design") || has("intro_chemical_engineering") || circuitPair;
    const engineeringChoiceCustom = customRequiredCategoryCredit("engineeringChoice") >= 3;
    req(base, "engineering_choice", "기초공학 · 공학선택", engineeringChoiceCredits, 3,
      "창의기계설계, 화학공학개론 또는 회로이론·실습 세트 중 하나를 이수합니다.", {
        met: engineeringChoiceCredits >= 3 && (engineeringChoiceNamed || engineeringChoiceCustom),
        missing: engineeringChoiceNamed || engineeringChoiceCustom ? [] : ["3학점 선택과목 1개 또는 회로이론(2)+실습(1)"]
      });

    const writingMet = hasAny(["academic_writing", "scientific_writing"]);
    const humanitiesCore2025 = all(["future_literacy", "career_exploration_1", "career_exploration_2"]);
    req(base, "humanities", "인문사회 · 쓰기/읽기", humanitiesCredits, rule.humanitiesCredits,
      cohort >= 2025 ? "글쓰기 선택 1과목과 미래소양·진로탐색 Ⅰ·Ⅱ가 모두 필수입니다." : "학술 글쓰기와 Scientific Writing 중 1과목이 필수입니다.", {
        met: humanitiesCredits >= rule.humanitiesCredits && writingMet && (cohort < 2025 || humanitiesCore2025),
        missing: [
          ...(writingMet ? [] : ["학술 글쓰기 / Scientific Writing 중 1과목"]),
          ...(cohort >= 2025 ? missingNames(["future_literacy", "career_exploration_1", "career_exploration_2"]) : [])
        ]
      });

    const englishIds = ["academic_english_speaking", "academic_english_research"];
    req(base, "english", "글로벌커뮤니케이션 · 영어", englishCredits, 4, "지정된 영어 2과목을 모두 이수합니다.", {
      met: englishCredits >= 4 && all(englishIds), missing: missingNames(englishIds)
    });

    if (cohort === 2020) {
      const artsIds = ["music_1", "physical_education_1", "music_2", "physical_education_2"];
      req(base, "arts", "예체능 · 음악/체육", artsCredits, 4, "2020학번만 지정된 4과목이 필수입니다.", {
        met: artsCredits >= 4 && all(artsIds), missing: missingNames(artsIds)
      });
    }

    if (cohort >= 2025 && state.foreignStudent) {
      const koreanMet = Boolean(state.koreanExempt) || hasAny(["korean_1", "korean_2"]);
      req(base, "korean", "외국인 학생 · 한국어", koreanMet ? 1 : 0, 1,
        "한국어Ⅰ·Ⅱ 중 1과목 또는 TOPIK 3급 이상 등 공식 면제 인정이 필요합니다.", {
          unit: "요건", met: koreanMet,
          missing: koreanMet ? [] : ["한국어Ⅰ / Ⅱ 중 1과목 또는 면제 인정"]
        });
    }

    req(base, "base_total", "기초필수 총학점", baseCredits, rule.baseCredits, `${rule.label} 기준`);
    const baseElectiveCredits = round(baseAllCredits - baseCredits);
    if (baseElectiveCredits > 0) {
      warnings.push({
        id: "basic_elective_not_required",
        label: "기초선택 학점 분리",
        detail: `기초선택 ${baseElectiveCredits}학점은 졸업 총학점에는 포함하지만 기초필수 ${rule.baseCredits}학점에는 포함하지 않았습니다.`
      });
    }

    const checkTrackProgram = (trackId, mode, target, creditValue) => {
      if (!trackId) return null;
      const track = data.tracks.find((item) => item.id === trackId);
      const trackRule = data.trackRules[trackId];
      if (!trackRule) return null;
      const isMinor = mode === "minor";
      const requiredCredits = isMinor ? trackRule.minorCredits : trackRule.majorCredits;
      const requiredIds = [
        ...(trackRule.foundationRequired || []),
        ...(isMinor ? (trackRule.minorRequired || []) : (trackRule.majorRequired || []))
      ];
      const anyOfGroups = isMinor ? (trackRule.minorAnyOf || []) : (trackRule.majorAnyOf || []);
      const choose = isMinor ? trackRule.minorChoose : trackRule.majorChoose;
      const missing = missingNames(requiredIds);
      anyOfGroups.forEach((group) => {
        if (!hasAny(group)) missing.push(`${group.map((id) => courseMap.get(id)?.name || id).join(" / ")} 중 1과목`);
      });
      if (choose) {
        const count = choose.ids.filter(has).length;
        if (count < choose.count) missing.push(`지정 교과 ${choose.count}과목 중 ${choose.count - count}과목 추가`);
      }
      const coresMet = missing.length === 0;
      return req(target, `${mode}_${trackId}`, `${track?.name || trackId} ${isMinor ? "부전공" : "전공"} 표기 요건`,
        creditValue, requiredCredits, trackRule.note || "트랙 지정 교과목을 함께 확인합니다.", {
          met: creditValue >= requiredCredits && coresMet,
          missing,
          severity: "program"
        });
    };

    req(advanced, "track_minimum", "트랙 영역 학점", trackCreditsAny, 27,
      "전공 표기 충족 여부와 별개로 트랙 영역에서 최소 27학점이 필요합니다.");
    const primaryCredit = state.primaryTrack ? (trackRawCredits[state.primaryTrack] || 0) : 0;
    const primaryProgram = state.primaryTrack ? checkTrackProgram(state.primaryTrack, "major", advanced, primaryCredit) : null;

    let secondaryProgram = null;
    if (state.secondaryMode !== "none" && state.secondaryTrack) {
      secondaryProgram = checkTrackProgram(state.secondaryTrack, state.secondaryMode, advanced, secondaryRecognizedCredits);
      if (overlapCredits > 6) {
        warnings.push({
          id: "track_overlap",
          label: "트랙 중복 인정 상한",
          detail: `두 트랙에 함께 속한 ${overlapCredits}학점 중 6학점만 중복 인정하여, 두 번째 트랙에서 ${overlapExcess}학점을 제외했습니다.`
        });
      }
    }

    req(advanced, "nontrack", "비트랙/융합", nontrackCredits, 6, "트랙으로 인정되지 않는 융합 교과 6학점이 필수입니다.");
    req(advanced, "ugrp", "연구 · UGRP", ugrpCredits, 6, "UGRPⅠ·Ⅱ 지정 2과목이 필수입니다.", {
      met: ugrpCredits >= 6 && all(["ugrp_1", "ugrp_2"]), missing: missingNames(["ugrp_1", "ugrp_2"])
    });
    const requiredInternshipCredits = cohort >= 2023 ? 1 : 2;
    req(advanced, "internship", "현장 · 인턴십", Math.min(internshipCredits, 4), requiredInternshipCredits,
      cohort >= 2023 ? "2023학번 이후 1학점 이상 필수" : "2020~2022학번 2학점 이상 필수");
    req(advanced, "advanced_total", "심화 인정 총학점", advancedCredits, rule.advancedCredits, `${rule.label} 공통 기준`);
    req(overall, "total", "졸업 총학점", totalCredits, rule.totalCredits, `${rule.label} 기준`);

    const capLabels = {
      startup: "창업 교과는 심화 최대 6학점",
      urp: "URP는 심화 최대 4학점",
      thesis: "Thesis는 심화 최대 2학점",
      internship: "인턴십은 심화 최대 4학점",
      biologyExperiment: "생명과학 실험 교과는 트랙 최대 6학점"
    };
    Object.entries(recognitionExcess).forEach(([cap, excess]) => {
      if (excess > 0) warnings.push({
        id: `recognition_cap_${cap}`,
        label: "심화 인정학점 상한 적용",
        detail: `${capLabels[cap]}이므로 ${round(excess)}학점을 심화 합계에서 제외하고 총학점에만 반영했습니다.`
      });
    });

    const sameSemester = new Map();
    entries.forEach(({ entry, course }) => {
      const semester = entry.semester || (["spring", "summer"].includes(entry.term) ? 1 : 2);
      const session = entry.session || (["summer", "winter"].includes(entry.term) ? entry.term : "regular");
      const key2 = `${entry.year}-${semester}-${session}`;
      if (!sameSemester.has(key2)) sameSemester.set(key2, new Set());
      sameSemester.get(key2).add(course.category);
    });
    sameSemester.forEach((set, semester) => {
      if (set.has("ugrp") && set.has("urp")) {
        warnings.push({ id: `ugrp_urp_${semester}`, label: "UGRP·URP 동시수강 확인", detail: `${semester}에 UGRP와 URP가 함께 배정되어 있습니다. 교육과정표상 동시수강할 수 없습니다.` });
      }
    });

    if (state.primaryTrack) {
      const track = data.tracks.find((item) => item.id === state.primaryTrack);
      if (track && track.degree !== "either" && state.degree && track.degree !== state.degree) {
        warnings.push({
          id: "degree_track_mismatch", label: "학위 계열과 트랙 확인",
          detail: `${track.name} 트랙의 기본 학위 계열과 선택한 ${state.degree === "science" ? "이학사" : "공학사"} 설정이 다릅니다. 실제 학위 구분을 학사팀에 확인하세요.`
        });
      }
    }

    if (primaryProgram && !primaryProgram.met) {
      warnings.push({
        id: "primary_program_incomplete",
        label: "전공 표기 요건 미충족",
        detail: "졸업 필수요건을 모두 채우면 융복합 이학사/공학사 학위는 받을 수 있지만, 현재 선택한 주 트랙 전공은 표기되지 않습니다."
      });
    }
    if (secondaryProgram && !secondaryProgram.met) {
      warnings.push({
        id: "secondary_program_incomplete",
        label: "추가 전공 표기 요건 미충족",
        detail: "현재 선택한 복수전공/부전공 표기요건이 부족합니다. 이는 기본 학위의 졸업 가능 여부와 별도로 판정됩니다."
      });
    }

    const requirements = [...base, ...advanced, ...overall];
    const graduationRequirements = requirements.filter((item) => item.severity === "required");
    const unmet = graduationRequirements.filter((item) => !item.met);
    const canGraduate = unmet.length === 0;
    const baseMet = base.filter((item) => item.severity === "required").every((item) => item.met);
    const advancedMet = advanced.filter((item) => item.severity === "required").every((item) => item.met);
    const coreMetCount = graduationRequirements.filter((item) => item.met).length;
    const completion = graduationRequirements.length ? Math.round((coreMetCount / graduationRequirements.length) * 100) : 0;

    const selectedTrackName = data.tracks.find((item) => item.id === state.primaryTrack)?.name;
    const degreeBase = state.degree === "engineering" ? "융복합 공학사" : "융복합 이학사";
    const degreeLabel = selectedTrackName && primaryProgram?.met ? `${degreeBase} · ${selectedTrackName} 전공` : degreeBase;

    return {
      cohort,
      cohortKey: key,
      rule,
      credits: {
        total: totalCredits, base: baseCredits, baseAll: baseAllCredits, baseElective: baseElectiveCredits,
        advanced: advancedCredits, advancedRaw: rawAdvancedCredits,
        math: mathCredits, physics: physicsCredits, chemistry: chemistryCredits, biology: biologyCredits,
        science: scienceCredits, computing: computingCredits, engineeringChoice: engineeringChoiceCredits,
        humanities: humanitiesCredits, english: englishCredits, arts: artsCredits,
        trackAny: trackCreditsAny, nontrack: nontrackCredits, ugrp: ugrpCredits, internship: internshipCredits,
        trackById: trackRawCredits, overlap: overlapCredits, secondaryRecognized: secondaryRecognizedCredits,
        recognitionExcess
      },
      requirements: { base, advanced, overall },
      unmet,
      warnings,
      canGraduate,
      baseMet,
      advancedMet,
      completion: clamp(completion, 0, 100),
      degreeLabel,
      programs: { primary: primaryProgram, secondary: secondaryProgram },
      entries
    };
  }

  function isOffered(course, term) {
    if (!course || !term || !Array.isArray(course.terms) || course.terms.length === 0) return true;
    return course.terms.includes(term);
  }

  function progress(current, required) {
    if (!required) return current > 0 ? 100 : 0;
    return clamp(Math.round((Number(current) / Number(required)) * 100), 0, 100);
  }

  return { audit, cohortKey, effectiveCourse, buildCourseMap, classificationKey, isOffered, progress, round };
});
