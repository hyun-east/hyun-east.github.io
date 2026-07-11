(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  root.CURRICULUM_DATA = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Source: 2025.11.17. 융복합대학 기초학부 교육과정표(2020학번 이후)
  // `terms` is the standard semester shown in the table, not a guarantee that
  // a lecture will actually open. `year` is the recommended/standard year.
  // `requirement` follows the PDF's 필수/선택 column. It describes whether a
  // course can fill a required curriculum area; individually designated
  // courses and choice groups remain separate in requirementBlocks/trackRules.
  const courses = [];
  const add = (id, name, credits, level, category, year, terms, extra = {}) => {
    const requirement = extra.requirement || categories[category]?.requirement || "elective";
    courses.push({ id, name, credits, level, category, requirement, year, terms, ...extra });
  };
  const B = "basic";
  const A = "advanced";
  const BOTH = ["spring", "fall"];

  const tracks = [
    { id: "physics", name: "물리학", degree: "science" },
    { id: "chemistry", name: "화학", degree: "science" },
    { id: "biology", name: "생명과학", degree: "science" },
    { id: "brain", name: "뇌과학", degree: "science" },
    { id: "mechanical", name: "기계공학", degree: "engineering" },
    { id: "materials", name: "재료공학", degree: "engineering" },
    { id: "electrical", name: "전자공학", degree: "engineering" },
    { id: "computer", name: "컴퓨터공학", degree: "engineering" },
    { id: "chemical", name: "화학공학", degree: "engineering" },
    { id: "autonomous", name: "자율", degree: "either" }
  ];

  const categories = {
    math: { label: "기초과학 · 수학", level: B, requirement: "required" },
    basicElective: { label: "기초 · 선택", level: B, requirement: "elective" },
    physicsBasic: { label: "기초과학 · 물리", level: B, requirement: "required" },
    chemistryBasic: { label: "기초과학 · 화학", level: B, requirement: "required" },
    biologyBasic: { label: "기초과학 · 생명과학", level: B, requirement: "required" },
    computingBasic: { label: "기초공학 · 컴퓨터공학", level: B, requirement: "required" },
    engineeringChoice: { label: "기초공학 · 공학선택", level: B, requirement: "required" },
    humanities: { label: "인문사회 · 쓰기/읽기", level: B, requirement: "required" },
    english: { label: "글로벌커뮤니케이션 · 영어", level: B, requirement: "required" },
    arts: { label: "예체능 · 음악/체육", level: B, requirement: "required" },
    korean: { label: "한국어", level: B, requirement: "required" },
    track: { label: "심화 · 전공 트랙", level: A, requirement: "required" },
    nontrack: { label: "심화 · 비트랙/융합", level: A, requirement: "required" },
    startup: { label: "심화 · 창업", level: A, requirement: "elective" },
    ugrp: { label: "심화 · 연구 UGRP", level: A, requirement: "required" },
    urp: { label: "심화 · 연구 URP", level: A, requirement: "elective" },
    thesis: { label: "심화 · 연구 Thesis", level: A, requirement: "elective" },
    internship: { label: "심화 · 현장 인턴십", level: A, requirement: "required" },
    advancedOther: { label: "심화 · 기타 선택", level: A, requirement: "elective" },
    general: { label: "일반/자유선택 · 총학점만", level: "general", requirement: "elective" }
  };

  // ---------------------------------------------------------------------------
  // 기초: pages 3–7, standard credit tables pages 20–22
  // ---------------------------------------------------------------------------
  add("eng_math_1", "공학수학Ⅰ", 3, B, "math", 1, BOTH, { code: "BS102a", core: true });
  add("multivariable_calculus", "다변수 미적분학", 3, B, "math", 1, BOTH, { code: "BS101", core: true });
  add("single_variable_calculus", "일변수 미적분학", 3, B, "basicElective", 1, BOTH, { code: "BS120", note: "수학 9학점 필수에는 미포함" });
  add("linear_algebra", "선형대수학", 3, B, "math", 2, BOTH, { code: "BS203" });
  add("eng_math_2", "공학수학Ⅱ", 3, B, "math", 2, BOTH, { code: "BS201a" });
  add("probability_statistics", "확률과 통계 및 실습", 3, B, "math", 2, BOTH);

  add("general_physics_1", "일반물리Ⅰ", 3, B, "physicsBasic", 1, ["spring"], { core: true });
  add("general_physics_lab_1", "일반물리실험Ⅰ", 1, B, "physicsBasic", 1, ["spring"], { core: true });
  add("general_physics_2", "일반물리Ⅱ", 3, B, "physicsBasic", 1, ["fall"]);
  add("general_physics_lab_2", "일반물리실험Ⅱ", 1, B, "physicsBasic", 1, ["fall"]);

  add("general_chemistry_1", "일반화학Ⅰ", 3, B, "chemistryBasic", 1, ["spring"], { core: true });
  add("general_chemistry_lab_1", "일반화학실험Ⅰ", 1, B, "chemistryBasic", 1, BOTH, { code: "BS113", core: true });
  add("general_chemistry_2", "일반화학Ⅱ", 3, B, "chemistryBasic", 1, ["fall"]);

  add("general_biology_1", "일반생물학Ⅰ", 3, B, "biologyBasic", 1, BOTH);
  add("intro_biology", "생명과학개론", 3, B, "biologyBasic", 1, BOTH);
  add("general_biology_2", "일반생물학Ⅱ", 3, B, "biologyBasic", 1, ["fall"], { code: "BS117" });
  add("general_biology_lab", "일반생물학 실험", 1, B, "biologyBasic", 1, BOTH, { core: true });

  add("programming", "프로그래밍", 3, B, "computingBasic", 1, BOTH, { code: "BE101a", core: true, note: "2026학년도부터 1·2학기 개설" });
  add("data_science_basics", "데이터사이언스기초", 3, B, "computingBasic", 2, ["spring"], { code: "BE202", core: true });
  add("ai_basics", "인공지능기초", 3, B, "computingBasic", 2, ["fall"], { code: "BE201/CSE204", core: true, cohortNote: "2025학번부터 심화 트랙(컴퓨터공학)으로 인정" });

  add("circuit_theory", "회로이론과 계측법(이론)", 2, B, "engineeringChoice", 2, ["spring"]);
  add("circuit_lab", "회로이론과 계측법(실습)", 1, B, "engineeringChoice", 2, ["fall"], { note: "2026학년도부터 2학기 개설" });
  add("creative_mechanical_design", "창의기계설계", 3, B, "engineeringChoice", 2, ["spring"]);
  add("intro_chemical_engineering", "화학공학개론", 3, B, "engineeringChoice", 2, ["fall"]);

  const humanitiesYear1 = [
    ["comparative_history", "비교역사학", 3], ["law_society", "법과 사회", 3], ["understanding_novel", "소설의 이해", 3],
    ["intro_economics", "경제학 입문", 3], ["global_culture_communication", "글로벌 문화와 의사소통", 3], ["intro_linguistics", "언어학 입문", 3],
    ["modern_society_ethics", "현대 사회와 윤리", 3], ["science_technology_modern_society", "과학기술과 현대사회", 3], ["comparative_politics", "비교정치학", 3],
    ["understanding_korean_politics", "한국정치의 이해", 3], ["understanding_korean_society", "한국사회의 이해", 3], ["understanding_sociology", "사회학의 이해", 3],
    ["intro_geography", "지리학 입문", 3, ["spring"]], ["journey_psychology", "심리학으로의 여행", 3], ["understanding_anthropology", "인류학의 이해", 3],
    ["human_religion", "인간과 종교", 3], ["traditional_korean_culture", "Introduction to Traditional Korean Culture", 2], ["intro_philosophy_en", "Introduction to Philosophy", 2]
  ];
  humanitiesYear1.forEach(([id, name, credits, terms = BOTH]) => add(id, name, credits, B, "humanities", 1, terms));
  add("academic_writing", "학술 글쓰기", 3, B, "humanities", 1, BOTH, { core: true });
  add("future_literacy", "미래소양강좌", 1, B, "humanities", 1, BOTH, { code: "HSS118", coreFrom: 2025 });
  add("career_exploration_1", "진로탐색 및 전공설계Ⅰ", 1, B, "humanities", 1, ["spring"], { code: "HSS119", coreFrom: 2025 });
  add("career_exploration_2", "진로탐색 및 전공설계Ⅱ", 1, B, "humanities", 1, ["fall"], { code: "HSS120", coreFrom: 2025 });
  const humanitiesYear2 = [
    ["understanding_philosophical_classics", "철학 고전의 이해"], ["modern_society_thought", "근대 사회와 사상"], ["scitech_history_scenes", "과학기술사의 주요 장면"],
    ["communication_special", "커뮤니케이션 특강"], ["east_west_literature", "동서양문학의 이해"], ["global_political_economy", "글로벌 정치경제"],
    ["issues_philosophy_science", "과학철학의 쟁점"], ["english_literature_text", "영어 문학 텍스트 : 주제적 접근 읽기"], ["gender_society", "젠더와 사회"],
    ["walk_classics", "고전의 산책"], ["general_change_rights", "권리변동의 일반"], ["literature_film", "문학과 영화"],
    ["urban_geography", "도시지리학", ["spring"]], ["organizational_psychology", "조직 심리학의 이해와 적용"], ["culture_economy", "문화와 경제"],
    ["intro_world_religions", "세계종교입문"], ["humanities_special_1", "인문학 특강Ⅰ"], ["humanities_special_2", "인문학 특강Ⅱ"],
    ["social_science_special_1", "사회과학 특강Ⅰ"], ["social_science_special_2", "사회과학 특강Ⅱ"], ["philosophy_mind", "심리철학", ["spring"]],
    ["joy_reading_poetry", "시 읽기의 즐거움", ["fall"]]
  ];
  humanitiesYear2.forEach(([id, name, terms = BOTH]) => add(id, name, 3, B, "humanities", 2, terms));
  add("scientific_writing", "Scientific Writing", 3, B, "humanities", 3, BOTH, { core: true });

  add("academic_english_speaking", "Academic English: Speaking and Correspondence", 2, B, "english", 1, ["spring"], { code: "GC101", core: true });
  add("academic_english_research", "Academic English: Research and Writing", 2, B, "english", 1, ["fall"], { code: "GC102", core: true });
  add("music_1", "음악Ⅰ", 1, B, "arts", 1, ["spring"], { coreFor: [2020] });
  add("physical_education_1", "체육Ⅰ", 1, B, "arts", 1, ["spring"], { coreFor: [2020] });
  add("music_2", "음악Ⅱ", 1, B, "arts", 1, ["fall"], { coreFor: [2020] });
  add("physical_education_2", "체육Ⅱ", 1, B, "arts", 1, ["fall"], { coreFor: [2020] });
  add("korean_1", "한국어Ⅰ", 0, B, "korean", 1, BOTH, { coreForForeignFrom: 2025, note: "제공된 교육과정표에 학점 미기재: 총학점에는 자동 산입하지 않음" });
  add("korean_2", "한국어Ⅱ", 0, B, "korean", 1, BOTH, { coreForForeignFrom: 2025, note: "제공된 교육과정표에 학점 미기재: 총학점에는 자동 산입하지 않음" });

  // ---------------------------------------------------------------------------
  // 심화 전공 트랙: pages 8–17
  // ---------------------------------------------------------------------------
  const trackCourse = (id, name, credits, trackList, year, terms, extra = {}) =>
    add(id, name, credits, A, "track", year, terms, { tracks: trackList, ...extra });

  // 물리학
  trackCourse("analytical_mechanics_1", "해석역학Ⅰ", 3, ["physics"], 2, ["spring"], { coreTracks: ["physics"] });
  trackCourse("modern_physics", "현대물리", 3, ["physics"], 2, ["spring"]);
  trackCourse("electrodynamics_1", "전기역학Ⅰ", 3, ["physics"], 2, ["fall"], { coreTracks: ["physics"] });
  trackCourse("analytical_mechanics_2", "해석역학Ⅱ", 3, ["physics"], 2, ["fall"]);
  trackCourse("advanced_physics_lab", "고급물리 실험", 2, ["physics"], 3, ["spring"]);
  trackCourse("quantum_mechanics_1", "양자역학Ⅰ", 3, ["physics"], 3, ["spring"], { coreTracks: ["physics"] });
  trackCourse("mathematical_physics", "수리물리", 3, ["physics"], 3, ["spring"]);
  trackCourse("electrodynamics_2", "전기역학Ⅱ", 3, ["physics"], 3, ["spring"]);
  trackCourse("semiconductor_properties", "반도체물성 개론", 3, ["physics", "electrical", "chemical"], 3, ["spring"]);
  trackCourse("solid_state_physics_1", "고체물리Ⅰ", 3, ["physics"], 3, ["fall"]);
  trackCourse("quantum_mechanics_2", "양자역학Ⅱ", 3, ["physics"], 3, ["fall"]);
  trackCourse("applied_physics_lab", "응용물리 실험", 2, ["physics"], 3, ["fall"]);
  trackCourse("thermal_stat_physics", "열 및 통계 물리", 3, ["physics"], 3, ["fall"], { coreTracks: ["physics"] });
  trackCourse("intro_materials_thermo", "재료열역학 개론", 3, ["physics", "materials"], 3, ["fall"], { coreTracks: ["materials"] });
  trackCourse("applied_fluid_mechanics", "응용물리특론", 3, ["physics"], 3, ["fall"]);
  trackCourse("differential_geometry_relativity", "미분기하학과 일반상대론", 3, ["physics"], 3, ["fall"]);
  trackCourse("solid_state_physics_2", "고체물리Ⅱ", 3, ["physics"], 4, ["spring"]);
  trackCourse("modern_optics", "현대광학", 3, ["physics"], 4, ["spring"]);
  trackCourse("biophysics", "생물물리학", 3, ["physics"], 4, ["spring"]);
  trackCourse("computational_physics", "전산물리", 3, ["physics"], 4, ["spring"]);
  trackCourse("atomic_molecular_physics", "원자분자물리학", 3, ["physics"], 4, ["spring"]);
  trackCourse("decision_rotation", "결정학 및 회절", 3, ["physics", "chemistry", "materials"], 4, ["fall"]);
  trackCourse("quantum_computing_intro", "양자 컴퓨팅 개론", 3, ["physics"], 4, ["fall"]);

  // 화학
  trackCourse("general_chem_lab_2_advanced", "일반화학실험Ⅱ", 1, ["chemistry"], 2, ["spring"]);
  trackCourse("organic_chem_1", "유기화학Ⅰ", 3, ["chemistry", "materials", "chemical"], 2, ["spring"], { coreTracks: ["chemistry", "chemical"] });
  trackCourse("analytical_chemistry", "분석화학", 3, ["chemistry", "materials", "chemical"], 2, ["spring"], { coreTracks: ["chemistry"] });
  trackCourse("inorganic_chem_1", "무기화학Ⅰ", 3, ["chemistry", "materials", "chemical"], 2, ["fall"], { coreTracks: ["chemistry", "chemical"] });
  trackCourse("physical_chem_1", "물리화학Ⅰ", 3, ["chemistry", "materials", "chemical"], 2, ["fall"], { coreTracks: ["chemistry"] });
  trackCourse("organic_chem_2", "유기화학Ⅱ", 3, ["chemistry", "chemical"], 2, ["fall"]);
  trackCourse("physical_chem_2", "물리화학Ⅱ", 3, ["chemistry", "chemical"], 3, ["spring"]);
  trackCourse("inorganic_chem_2", "무기화학Ⅱ", 3, ["chemistry", "chemical"], 3, ["spring"]);
  trackCourse("advanced_chem_lab_1", "심화화학실험Ⅰ", 2, ["chemistry"], 3, ["spring"]);
  trackCourse("advanced_chem_lab_2", "심화화학실험Ⅱ", 2, ["chemistry"], 3, ["fall"]);
  trackCourse("organic_chem_3", "유기화학Ⅲ", 3, ["chemistry", "chemical"], 3, ["fall"]);
  trackCourse("physical_chem_3", "물리화학Ⅲ", 3, ["chemistry", "chemical"], 3, ["fall"]);
  trackCourse("polymer_intro", "고분자개론", 3, ["chemistry", "chemical"], 4, ["spring"]);
  trackCourse("computational_chemistry", "계산화학", 3, ["chemistry"], 4, ["spring"]);
  trackCourse("solid_state_chemistry_1", "고체화학Ⅰ", 3, ["chemistry"], 4, ["spring"]);
  trackCourse("mineral_physical_chemistry", "광물리화학 개론", 3, ["chemistry"], 4, ["fall"]);
  trackCourse("organometallic_chemistry", "유기금속화학", 3, ["chemistry"], 4, ["fall"]);
  trackCourse("electrochemistry", "전기화학", 3, ["chemistry", "chemical"], 4, ["fall"]);

  // 생명과학
  trackCourse("cell_biology", "세포생물학", 3, ["biology", "brain"], 2, ["spring"], { coreTracks: ["biology"] });
  trackCourse("cell_biology_lab", "세포생물학 실험", 3, ["biology", "brain"], 2, ["spring"]);
  trackCourse("biology_field_lab", "생물학 야외실습", 1, ["biology"], 2, ["spring", "summer"]);
  trackCourse("genetics", "유전학", 3, ["biology", "brain"], 2, ["fall"], { coreTracks: ["biology"] });
  trackCourse("genetics_lab", "유전학 실험", 3, ["biology", "brain"], 2, ["fall"]);
  trackCourse("bioanalytical_chemistry", "생명분석화학", 3, ["biology"], 2, ["fall"]);
  trackCourse("biochemistry_1", "생화학Ⅰ", 3, ["biology", "brain"], 3, ["spring"], { coreTracks: ["biology", "brain"] });
  trackCourse("organism_diversity", "생명체의 다양성과 유기적 관계", 3, ["biology"], 3, ["spring"]);
  trackCourse("neuroscience_1", "신경과학Ⅰ", 3, ["biology", "brain"], 3, ["spring"], { coreTracks: ["brain"] });
  trackCourse("pharmaceutical_engineering", "의약품공학", 3, ["biology"], 3, ["spring"]);
  trackCourse("great_biology_discoveries", "생명과학 노벨상 수상의 위대한 발견", 3, ["biology"], 3, ["spring"]);
  trackCourse("molecular_biology", "분자생물학", 3, ["biology", "brain"], 3, ["fall"], { coreTracks: ["biology"] });
  trackCourse("biochemistry_2", "생화학Ⅱ", 3, ["biology", "brain"], 3, ["fall"]);
  trackCourse("quantitative_biology", "정량 생명과학", 3, ["biology", "brain"], 3, ["fall"]);
  trackCourse("anatomy_physiology", "해부생리학", 3, ["biology"], 3, ["fall"]);
  trackCourse("neuroscience_2", "신경과학Ⅱ", 3, ["biology", "brain"], 3, ["fall"], { coreTracks: ["brain"] });
  trackCourse("biology_society", "생명과학과 사회", 3, ["biology"], 3, ["fall"]);
  trackCourse("molecular_biology_lab", "분자생물학 실험", 3, ["biology"], 3, ["fall"]);
  trackCourse("developmental_biology", "발생 및 발달생물학", 3, ["biology", "brain"], 4, ["spring"]);
  trackCourse("integrative_biology", "융합생명과학", 3, ["biology"], 4, ["spring"]);
  trackCourse("medicinal_chemistry", "의생명공학", 3, ["biology"], 4, ["spring"]);
  trackCourse("bioinformatics", "생물정보학", 3, ["biology"], 4, ["spring"]);
  trackCourse("modern_microbiology", "현대 미생물학", 3, ["biology"], 4, ["spring"]);
  trackCourse("human_physiology", "인체생리학", 3, ["biology"], 4, ["spring"]);
  trackCourse("computational_neuroscience", "계산뇌과학입문", 3, ["biology", "brain"], 4, ["spring"]);
  trackCourse("brain_disease", "뇌질환", 3, ["biology", "brain"], 4, ["spring"]);
  trackCourse("optical_microscopy", "광학현미경", 3, ["biology"], 4, ["spring"]);
  trackCourse("immunology", "면역학", 3, ["biology"], 4, ["fall"]);
  trackCourse("circadian_biology", "일주기 생체리듬", 3, ["biology"], 4, ["fall"]);
  trackCourse("plant_biology", "식물 생명과학", 3, ["biology"], 4, ["fall"]);
  trackCourse("cancer_biology", "암생물학", 3, ["biology"], 4, ["fall"]);
  trackCourse("stem_cell_biology", "줄기세포생물학", 3, ["biology"], 4, ["fall"]);

  // 뇌과학
  trackCourse("brain_lab_1", "뇌과학실험Ⅰ", 3, ["brain"], 3, ["spring"]);
  trackCourse("brain_engineering_intro", "뇌공학개론", 3, ["brain"], 3, ["fall"]);
  trackCourse("brain_lab_2", "뇌과학실험Ⅱ", 3, ["brain"], 3, ["fall"]);
  trackCourse("neural_regeneration", "신경재생 및 퇴행", 3, ["brain"], 4, ["spring"]);
  trackCourse("learning_memory", "학습과 기억", 3, ["brain"], 4, ["spring"]);
  trackCourse("cognitive_neuroscience", "인지뇌과학개론", 3, ["brain"], 4, ["fall"]);
  trackCourse("neurophysiology", "신경생리학", 3, ["brain"], 4, ["fall"]);

  // 기계공학
  trackCourse("statics", "고체역학", 3, ["mechanical"], 2, ["spring"], { coreTracks: ["mechanical"] });
  trackCourse("dynamics", "동역학", 3, ["mechanical"], 2, ["fall"], { coreTracks: ["mechanical"] });
  trackCourse("mechanical_thermodynamics", "기계열역학", 3, ["mechanical"], 2, ["fall"], { coreTracks: ["mechanical"] });
  trackCourse("biomedical_engineering_intro", "의공학개론", 3, ["mechanical", "electrical"], 2, ["fall"]);
  trackCourse("fluid_mechanics", "유체역학", 3, ["mechanical", "chemical"], 3, ["spring"], { coreTracks: ["mechanical"] });
  trackCourse("automatic_control", "자동제어시스템", 3, ["mechanical", "electrical"], 3, ["spring"], { coreTracks: ["mechanical"] });
  trackCourse("human_robotics", "인간과 공학", 3, ["mechanical"], 3, ["spring"]);
  trackCourse("vibration_engineering", "진동공학", 3, ["mechanical"], 3, ["spring"]);
  trackCourse("robot_electronics", "로봇전자공학", 3, ["mechanical"], 3, ["spring"]);
  trackCourse("ai_intro_track", "인공지능개론", 3, ["mechanical"], 3, ["fall"], { coreTracks: ["mechanical"] });
  trackCourse("integrated_system_modeling", "시스템의 통합적 모델링", 3, ["mechanical", "electrical"], 3, ["fall"]);
  trackCourse("mechanisms", "기구학", 3, ["mechanical"], 3, ["fall"]);
  trackCourse("mechatronics", "메카트로닉스", 3, ["mechanical"], 3, ["fall"]);
  trackCourse("heat_transfer", "열전달", 3, ["mechanical"], 4, ["spring"]);
  trackCourse("robot_dynamics_control", "로봇동역학 및 제어", 3, ["mechanical"], 4, ["spring"]);
  trackCourse("micro_nano_engineering", "마이크로/나노공학", 3, ["mechanical"], 4, ["spring"]);
  trackCourse("mobility_engineering", "모빌리티공학개론", 3, ["mechanical"], 4, ["spring"]);
  trackCourse("creative_engineering_design", "창의공학설계", 3, ["mechanical"], 4, ["fall"]);
  trackCourse("mechanical_materials", "기계재료학", 3, ["mechanical"], 4, ["fall"]);

  // 재료공학
  trackCourse("materials_intro_1", "재료공학개론Ⅰ", 3, ["materials", "chemistry"], 3, ["spring"], { coreTracks: ["materials"] });
  trackCourse("materials_lab", "재료공학실험", 3, ["materials"], 3, ["spring"], { coreTracks: ["materials"] });
  trackCourse("materials_intro_2", "재료공학개론Ⅱ", 3, ["materials"], 3, ["fall"], { coreTracks: ["materials"] });
  trackCourse("nanomaterials", "나노재료학", 3, ["materials", "chemical"], 3, ["fall"], { coreTracks: ["materials"] });
  trackCourse("materials_phase", "재료상변태", 3, ["materials", "physics"], 4, ["spring"], { coreTracks: ["materials"] });
  trackCourse("electronic_properties_materials", "전자물성학", 3, ["materials"], 4, ["spring"]);
  trackCourse("mechanical_behavior_materials", "재료의 기계적 거동", 3, ["materials"], 4, ["spring"]);
  trackCourse("electronic_materials", "전자재료학", 3, ["materials", "chemical"], 4, ["fall"]);
  // decision_rotation is also a materials designated course.

  // 전자공학
  trackCourse("data_structures", "자료구조", 3, ["electrical", "computer"], 2, ["spring"], { coreTracks: ["computer"] });
  trackCourse("discrete_math", "이산수학", 3, ["electrical", "computer"], 2, ["fall"], { coreTracks: ["computer"] });
  trackCourse("object_oriented_programming", "객체지향 프로그래밍", 3, ["electrical", "computer"], 2, ["fall"], { coreTracks: ["computer"] });
  trackCourse("digital_logic", "디지털 논리회로", 3, ["electrical"], 2, ["fall"]);
  trackCourse("signals_systems", "신호 및 시스템", 3, ["electrical"], 3, ["spring"], { coreTracks: ["electrical"] });
  trackCourse("computer_architecture", "컴퓨터구조", 3, ["electrical", "computer"], 3, ["spring"], { coreTracks: ["computer"] });
  trackCourse("electronic_circuit_1", "전자회로 이론", 3, ["electrical"], 3, ["spring"], { coreTracks: ["electrical"] });
  trackCourse("electronic_device_theory", "전자소자개론", 3, ["electrical"], 3, ["fall"], { coreTracks: ["electrical"] });
  trackCourse("operating_systems_electrical", "운영체제", 3, ["electrical", "computer"], 3, ["fall"], { coreTracks: ["computer"] });
  trackCourse("communications_basics", "통신의 기초", 3, ["electrical"], 3, ["fall"]);
  trackCourse("deep_learning_intro", "딥러닝개론", 3, ["electrical", "computer"], 3, ["fall"]);
  trackCourse("analog_electronics", "아날로그 전자회로", 3, ["electrical"], 3, ["fall"]);
  trackCourse("machine_learning", "강화학습", 3, ["electrical", "computer"], 4, ["spring"]);
  trackCourse("digital_communications", "디지털통신", 3, ["electrical"], 4, ["spring"]);
  trackCourse("intelligent_control", "지능형제어시스템", 3, ["electrical"], 4, ["spring"]);
  trackCourse("semiconductor_process_intro", "반도체공정개론", 3, ["electrical"], 4, ["spring"]);
  trackCourse("digital_signal_processing", "디지털 신호처리", 3, ["electrical", "computer"], 4, ["spring", "summer"]);
  trackCourse("digital_ic_design", "디지털집적회로설계", 3, ["electrical"], 4, ["spring"]);
  trackCourse("semiconductor_process_lab", "반도체공정실습", 3, ["electrical"], 4, ["fall"]);
  trackCourse("computer_network", "컴퓨터 네트워크", 3, ["electrical", "computer"], 4, ["fall"]);
  trackCourse("digital_image_processing", "디지털 영상처리", 3, ["electrical", "computer"], 4, ["fall"]);
  trackCourse("digital_system_design", "디지털 시스템 설계", 3, ["electrical"], 4, ["fall"]);

  // 컴퓨터공학
  trackCourse("systems_programming", "시스템 프로그래밍", 3, ["computer"], 3, ["spring"], { coreTracks: ["computer"] });
  trackCourse("machine_learning_intro", "기계학습개론", 3, ["computer"], 3, ["spring"]);
  trackCourse("programming_languages", "프로그래밍 언어", 3, ["computer"], 3, ["spring"]);
  trackCourse("computer_algorithms", "컴퓨터 알고리즘", 3, ["computer"], 3, ["fall"], { coreTracks: ["computer"] });
  trackCourse("computer_vision", "컴퓨터 비전 개론", 3, ["computer"], 4, ["spring"]);
  trackCourse("computer_security", "컴퓨터보안개론", 3, ["computer"], 4, ["spring"]);
  trackCourse("database_intro", "데이터베이스개론", 3, ["computer"], 4, ["fall"]);

  // 화학공학
  trackCourse("chemical_engineering_lab", "화학공학기초실험", 3, ["chemical"], 2, ["fall"]);
  trackCourse("chem_eng_thermo", "화학공학열역학", 3, ["chemical"], 3, ["spring"], { coreTracks: ["chemical"] });
  trackCourse("reaction_engineering", "반응공학", 3, ["chemical"], 3, ["fall"], { coreTracks: ["chemical"] });
  trackCourse("transport_phenomena", "이동현상개론", 3, ["chemical"], 3, ["fall"], { coreTracks: ["chemical"] });
  trackCourse("chemical_products_process", "화학 제품 및 공정설계", 3, ["chemical"], 4, ["spring"]);

  // ---------------------------------------------------------------------------
  // 비트랙/융합, 창업, 연구, 인턴십: pages 18–19
  // ---------------------------------------------------------------------------
  const simple = (rows, category) => rows.forEach(([id, name, credits, year, terms, extra = {}]) => add(id, name, credits, A, category, year, terms, extra));
  simple([
    ["design_thinking", "디자인사고", 3, 1, BOTH],
    ["urban_air_mobility", "도심항공교통개론", 3, 2, ["spring"]],
    ["design_planning_strategy", "디자인 기획과 전략", 3, 2, ["fall"]],
    ["understanding_life_data", "생명에 대한 융합적 이해", 3, 3, ["spring"]],
    ["intro_spectral_life", "학부생을 위한 해석학 개론", 3, 3, ["spring"]],
    ["modern_math_intro", "현대대수학 개론", 3, 3, ["spring"]],
    ["communication_modern_society", "커뮤니케이션과 현대사회", 3, 3, BOTH],
    ["industry_law", "산업과 법", 3, 3, BOTH],
    ["game_theory", "게임이론", 3, 3, BOTH],
    ["ux_design", "UX디자인", 3, 3, BOTH],
    ["sensibility_design", "감성공학과 디자인", 3, 3, BOTH],
    ["adaptive_fluid_dynamics", "적응의 유체역학", 3, 3, ["fall"]],
    ["topology_intro", "위상수학개론", 3, 3, ["fall"]],
    ["geometry_intro", "기하학 개론", 3, 4, ["spring"]],
    ["tensor_geometry", "텐서들의 기하학과 그 응용", 3, 4, ["spring"]],
    ["single_molecule_biophysics", "단분자 생물물리학 개론", 3, 4, ["fall"]]
  ], "nontrack");

  simple([
    ["entrepreneurship_responsibility", "기업가 정신과 사회적 책임", 3, 3, BOTH],
    ["management_principles", "경영학원론", 3, 3, BOTH],
    ["hightech_marketing", "하이테크 마케팅", 3, 3, BOTH],
    ["organization_management", "조직관리론", 3, 3, BOTH],
    ["strategic_decision", "경영전략 의사결정", 3, 3, ["fall"]],
    ["accounting_principles", "회계학 원론", 3, 3, ["spring"]]
  ], "startup");

  simple([
    ["ugrp_1", "UGRPⅠ", 3, 3, ["spring"], { core: true }],
    ["ugrp_2", "UGRPⅡ", 3, 3, ["fall"], { core: true }]
  ], "ugrp");
  simple([
    ["urp_1", "URP", 2, 2, ["fall"]],
    ["urp_2", "URP", 2, 4, ["spring"]]
  ], "urp");
  simple([
    ["thesis_1", "Thesis", 1, 4, ["spring"]],
    ["thesis_2", "Thesis", 1, 4, ["fall"]]
  ], "thesis");

  const ALL_TERMS = ["spring", "summer", "fall", "winter"];
  simple([
    ["domestic_intern_1", "국내 인턴십Ⅰ", 1, 2, ALL_TERMS, { code: "INT201" }],
    ["domestic_intern_2", "국내 인턴십Ⅱ", 1, 2, ALL_TERMS, { code: "INT202" }],
    ["domestic_intern_3", "국내 인턴십Ⅲ", 2, 2, ALL_TERMS, { code: "INT203" }],
    ["domestic_intern_4", "국내 인턴십Ⅳ", 2, 2, ALL_TERMS, { code: "INT204" }],
    ["domestic_intern_5", "국내 인턴십Ⅴ", 10, 3, ALL_TERMS, { recognizedCredits: 2 }],
    ["domestic_intern_6", "국내 인턴십Ⅵ", 10, 3, ALL_TERMS, { recognizedCredits: 2 }],
    ["domestic_intern_7", "국내 인턴십Ⅶ", 2, 2, ["summer", "winter"]],
    ["overseas_intern_1", "해외 인턴십Ⅰ", 1, 2, ["summer"]],
    ["overseas_intern_2", "해외 인턴십Ⅱ", 2, 2, ["summer"]],
    ["overseas_intern_3", "해외 인턴십Ⅲ", 1, 2, ["winter"]],
    ["overseas_intern_4", "해외 인턴십Ⅳ", 2, 2, ["winter"]],
    ["overseas_intern_5", "해외 인턴십Ⅴ", 10, 3, BOTH, { recognizedCredits: 2 }],
    ["overseas_intern_6", "해외 인턴십Ⅵ", 10, 3, BOTH, { recognizedCredits: 2 }],
    ["overseas_intern_7", "해외 인턴십Ⅶ", 10, 3, BOTH, { recognizedCredits: 2 }],
    ["overseas_intern_8", "해외 인턴십Ⅷ", 10, 3, BOTH, { recognizedCredits: 2 }],
    ["research_hq_intern_1", "연구본부 인턴 프로그램Ⅰ", 1, 2, ["summer", "winter"]],
    ["research_hq_intern_2", "연구본부 인턴 프로그램Ⅱ", 1, 2, ["summer", "winter"]],
    ["graduate_intern_1", "대학원 인턴 프로그램Ⅰ", 1, 2, ["summer", "winter"]],
    ["graduate_intern_2", "대학원 인턴 프로그램Ⅱ", 1, 2, ["summer", "winter"]],
    ["online_intern_1", "온라인 인턴십Ⅰ", 1, 2, BOTH],
    ["online_intern_2", "온라인 인턴십Ⅱ", 1, 2, BOTH],
    ["online_intern_3", "온라인 인턴십Ⅲ", 1, 2, ["summer", "winter"]],
    ["online_intern_4", "온라인 인턴십Ⅳ", 1, 2, ["summer", "winter"]]
  ], "internship");

  // Track-designated course rules are intentionally separate from courses so
  // curriculum maintainers can update graduation logic without editing the UI.
  const trackRules = {
    physics: {
      majorCredits: 27,
      minorCredits: 18,
      foundationRequired: ["general_physics_2"],
      majorRequired: ["analytical_mechanics_1", "electrodynamics_1", "quantum_mechanics_1", "thermal_stat_physics"],
      minorRequired: ["analytical_mechanics_1", "electrodynamics_1", "quantum_mechanics_1"],
      majorAnyOf: [["advanced_physics_lab", "applied_physics_lab"]],
      note: "전공은 지정 4과목과 물리 실험 2과목 중 1과목 필수"
    },
    chemistry: {
      majorCredits: 27,
      minorCredits: 18,
      foundationRequired: ["general_chemistry_2"],
      majorRequired: ["organic_chem_1", "analytical_chemistry", "inorganic_chem_1", "physical_chem_1"],
      minorRequired: ["organic_chem_1", "analytical_chemistry", "inorganic_chem_1", "physical_chem_1"],
      majorAnyOf: [["advanced_chem_lab_1", "advanced_chem_lab_2"]],
      note: "전공은 지정 4과목과 심화화학실험 2과목 중 1과목 필수"
    },
    biology: {
      majorCredits: 27,
      minorCredits: 18,
      foundationRequired: ["general_biology_1"],
      majorRequired: ["general_biology_2", "cell_biology", "genetics", "biochemistry_1", "molecular_biology"],
      minorRequired: ["general_biology_2", "cell_biology", "genetics", "biochemistry_1", "molecular_biology"],
      note: "일반생물학Ⅱ와 지정 4과목 필수; 실험 3과목은 트랙 인정 최대 6학점"
    },
    brain: {
      majorCredits: 27,
      minorCredits: 18,
      foundationRequired: [],
      majorRequired: ["neuroscience_1", "neuroscience_2", "biochemistry_1"],
      minorRequired: ["neuroscience_1", "neuroscience_2"],
      note: "전공은 지정 3과목, 부전공은 지정 2과목 필수"
    },
    mechanical: {
      majorCredits: 27,
      minorCredits: 18,
      foundationRequired: ["creative_mechanical_design"],
      majorRequired: ["statics", "dynamics", "mechanical_thermodynamics", "fluid_mechanics", "automatic_control", "ai_intro_track"],
      minorRequired: ["statics", "dynamics", "mechanical_thermodynamics", "fluid_mechanics", "automatic_control", "ai_intro_track"],
      note: "전공·부전공 모두 지정 6과목 필수"
    },
    materials: {
      majorCredits: 27,
      minorCredits: 18,
      foundationRequired: ["general_chemistry_2"],
      majorRequired: ["materials_intro_1", "materials_lab", "materials_intro_2", "nanomaterials", "intro_materials_thermo", "materials_phase", "decision_rotation"],
      minorChoose: { ids: ["materials_intro_1", "materials_lab", "materials_intro_2", "nanomaterials", "intro_materials_thermo", "materials_phase", "decision_rotation"], count: 6 },
      note: "전공은 지정 7과목, 부전공은 지정 교과 중 6과목 선택"
    },
    electrical: {
      majorCredits: 27,
      minorCredits: 18,
      foundationRequired: ["general_physics_2", "circuit_theory", "circuit_lab"],
      majorRequired: ["signals_systems", "electronic_circuit_1", "electronic_device_theory"],
      minorRequired: ["signals_systems", "electronic_circuit_1", "electronic_device_theory"],
      note: "전공·부전공 모두 지정 3과목 필수"
    },
    computer: {
      majorCredits: 27,
      minorCredits: 18,
      foundationRequired: ["linear_algebra"],
      majorRequired: ["data_structures", "discrete_math", "object_oriented_programming", "computer_architecture", "systems_programming", "computer_algorithms", "operating_systems_electrical"],
      minorChoose: { ids: ["data_structures", "discrete_math", "object_oriented_programming", "computer_architecture", "systems_programming", "computer_algorithms", "operating_systems_electrical"], count: 6 },
      note: "전공은 지정 7과목, 부전공은 지정 교과 중 6과목 선택"
    },
    chemical: {
      majorCredits: 27,
      minorCredits: 18,
      foundationRequired: ["intro_chemical_engineering"],
      majorRequired: ["organic_chem_1", "inorganic_chem_1", "chem_eng_thermo", "reaction_engineering", "transport_phenomena"],
      minorRequired: ["chem_eng_thermo", "reaction_engineering", "transport_phenomena"],
      note: "전공은 지정 5과목, 부전공은 지정 3과목 필수"
    },
    autonomous: {
      majorCredits: 27,
      minorCredits: 18,
      foundationRequired: [],
      majorRequired: [],
      minorRequired: [],
      note: "자율 트랙의 세부 승인 요건은 지도교수·학사팀 확인 필요"
    }
  };

  const cohortRules = {
    "2020": { label: "2020학번", baseCredits: 62, advancedCredits: 72, totalCredits: 134, computingCredits: 9, humanitiesCredits: 15, artsCredits: 4 },
    "2021-2024": { label: "2021~2024학번", baseCredits: 58, advancedCredits: 72, totalCredits: 130, computingCredits: 9, humanitiesCredits: 15, artsCredits: 0 },
    "2025+": { label: "2025학번 이후", baseCredits: 58, advancedCredits: 72, totalCredits: 130, computingCredits: 6, humanitiesCredits: 18, artsCredits: 0 }
  };

  // Named-course requirements are expressed as blocks so a choice group is
  // never presented as if every individual course were mandatory.
  const requirementBlocks = [
    { id: "math_core", label: "수학 핵심", description: "두 과목 모두", courseIds: ["eng_math_1", "multivariable_calculus"], requiredCount: 2 },
    { id: "math_choice", label: "수학 선택", description: "3과목 중 1과목", courseIds: ["linear_algebra", "eng_math_2", "probability_statistics"], requiredCount: 1 },
    { id: "physics_theory", label: "물리 이론", description: "지정 이론 1과목", courseIds: ["general_physics_1"], requiredCount: 1 },
    { id: "physics_lab", label: "물리 실험", description: "실험Ⅰ·Ⅱ 중 1과목", courseIds: ["general_physics_lab_1", "general_physics_lab_2"], requiredCount: 1 },
    { id: "chemistry_theory", label: "화학 이론", description: "지정 이론 1과목", courseIds: ["general_chemistry_1"], requiredCount: 1 },
    { id: "chemistry_lab", label: "화학 실험", description: "지정 실험 1과목", courseIds: ["general_chemistry_lab_1"], requiredCount: 1 },
    { id: "biology_theory", label: "생명과학 이론", description: "진로에 맞는 이론 1과목", courseIds: ["general_biology_1", "intro_biology"], requiredCount: 1 },
    { id: "biology_lab", label: "생명과학 실험", description: "지정 실험 1과목", courseIds: ["general_biology_lab"], requiredCount: 1 },
    { id: "computing_2020", label: "기초 컴퓨터공학", description: "3과목 모두", courseIds: ["programming", "data_science_basics", "ai_basics"], requiredCount: 3, maxCohort: 2024 },
    { id: "computing_2025", label: "기초 컴퓨터공학", description: "2과목 모두", courseIds: ["programming", "data_science_basics"], requiredCount: 2, minCohort: 2025 },
    {
      id: "engineering_choice", label: "공학선택", description: "세 경로 중 1개",
      courseIds: ["creative_mechanical_design", "intro_chemical_engineering", "circuit_theory", "circuit_lab"],
      pathways: [["creative_mechanical_design"], ["intro_chemical_engineering"], ["circuit_theory", "circuit_lab"]]
    },
    { id: "writing", label: "글쓰기", description: "2과목 중 1과목", courseIds: ["academic_writing", "scientific_writing"], requiredCount: 1 },
    { id: "humanities_2025", label: "2025 이후 인문사회 핵심", description: "3과목 모두", courseIds: ["future_literacy", "career_exploration_1", "career_exploration_2"], requiredCount: 3, minCohort: 2025 },
    { id: "english", label: "글로벌커뮤니케이션 영어", description: "2과목 모두", courseIds: ["academic_english_speaking", "academic_english_research"], requiredCount: 2 },
    { id: "arts_2020", label: "음악·체육", description: "2020학번 4과목 모두", courseIds: ["music_1", "physical_education_1", "music_2", "physical_education_2"], requiredCount: 4, cohorts: [2020] },
    { id: "ugrp", label: "연구 UGRP", description: "Ⅰ·Ⅱ 모두", courseIds: ["ugrp_1", "ugrp_2"], requiredCount: 2 },
    { id: "korean_foreign", label: "외국인 학생 한국어", description: "Ⅰ·Ⅱ 중 1과목 또는 면제", courseIds: ["korean_1", "korean_2"], requiredCount: 1, minCohort: 2025, foreignOnly: true }
  ];

  const equivalentCourseIds = [
    "eng_math_1", "multivariable_calculus", "linear_algebra", "eng_math_2", "probability_statistics",
    "general_physics_1", "general_physics_lab_1", "general_physics_lab_2", "general_physics_2",
    "general_chemistry_1", "general_chemistry_lab_1", "general_chemistry_2",
    "general_biology_1", "intro_biology", "general_biology_2", "general_biology_lab",
    "programming", "data_science_basics", "ai_basics", "academic_writing", "scientific_writing",
    "future_literacy", "career_exploration_1", "career_exploration_2", "academic_english_speaking",
    "academic_english_research", "music_1", "music_2", "physical_education_1", "physical_education_2",
    "ugrp_1", "ugrp_2", "korean_1", "korean_2",
    ...Object.values(trackRules).flatMap((rule) => [
      ...(rule.foundationRequired || []),
      ...(rule.majorRequired || []), ...(rule.minorRequired || []),
      ...(rule.majorAnyOf || []).flat(), ...(rule.minorChoose?.ids || [])
    ])
  ];

  return {
    meta: {
      title: "융복합대학 기초학부 교육과정표",
      applicableFrom: 2020,
      revisedAt: "2025-11-17",
      sourceFile: "20251117_융복합대학 기초학부 교육과정표(2020학번 이후).pdf",
      disclaimer: "실제 졸업사정은 학칙, 교육과정 운영 및 이수에 관한 요령과 학사팀 확인을 우선합니다."
    },
    terms: {
      spring: "봄학기", summer: "여름 계절학기", fall: "가을학기", winter: "겨울 계절학기"
    },
    categories,
    tracks,
    cohortRules,
    requirementBlocks,
    trackRules,
    equivalentCourseIds: [...new Set(equivalentCourseIds)],
    courses
  };
});
