function parseExcludedProblems(text) {
  if (!text || !text.trim()) return new Set();

  return new Set(
    text
      .split(/[\s,]+/)
      .map((v) => v.trim())
      .filter((v) => v !== "")
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v))
  );
}

function buildRange(start, end) {
  const arr = [];
  for (let i = start; i <= end; i++) {
    arr.push(i);
  }
  return arr;
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function splitCounts(total, groups) {
  const base = Math.floor(total / groups);
  const remainder = total % groups;
  const counts = Array(groups).fill(base);

  for (let i = 0; i < remainder; i++) {
    counts[i]++;
  }

  return counts;
}

function chunkByCounts(items, counts) {
  const result = [];
  let start = 0;

  for (const count of counts) {
    result.push(items.slice(start, start + count));
    start += count;
  }

  return result;
}

function formatList(arr) {
  if (!arr || arr.length === 0) {
    return '<span class="empty">(없음)</span>';
  }
  return arr.join(", ");
}

function validateInputs(numPeople, startProblem, endProblem, numGroups) {
  const errors = [];

  if (!Number.isInteger(numPeople) || numPeople <= 0) {
    errors.push("인원 수는 1 이상의 정수여야 합니다.");
  }

  if (!Number.isInteger(numGroups) || numGroups <= 0) {
    errors.push("조 개수는 1 이상의 정수여야 합니다.");
  }

  if (!Number.isInteger(startProblem) || !Number.isInteger(endProblem)) {
    errors.push("문제 시작 번호와 끝 번호는 정수여야 합니다.");
  }

  if (
    Number.isInteger(startProblem) &&
    Number.isInteger(endProblem) &&
    startProblem > endProblem
  ) {
    errors.push("문제 시작 번호는 끝 번호보다 클 수 없습니다.");
  }

  if (
    Number.isInteger(numPeople) &&
    Number.isInteger(numGroups) &&
    numGroups > numPeople
  ) {
    errors.push("조 개수는 인원 수보다 많을 수 없습니다.");
  }

  return errors;
}

function getInputValues() {
  const numPeople = Number(document.getElementById("numPeople").value);
  const numGroups = Number(document.getElementById("numGroups").value);
  const startProblem = Number(document.getElementById("startProblem").value);
  const endProblem = Number(document.getElementById("endProblem").value);
  const excludedText = document.getElementById("excludedProblems").value;

  return {
    numPeople,
    numGroups,
    startProblem,
    endProblem,
    excludedSet: parseExcludedProblems(excludedText)
  };
}

function assignGroupsAndProblems(numPeople, startProblem, endProblem, excludedSet, numGroups) {
  const errors = validateInputs(numPeople, startProblem, endProblem, numGroups);

  if (errors.length > 0) {
    return { errors };
  }

  const allProblems = buildRange(startProblem, endProblem);
  const filteredProblems = allProblems.filter((p) => !excludedSet.has(p));

  if (filteredProblems.length < numGroups) {
    return {
      errors: [
        `사용 가능한 문제 수(${filteredProblems.length})가 조 개수(${numGroups})보다 적습니다.`,
        "각 조에 최소 1문제씩 배정하려면 문제를 더 확보하거나 조 개수를 줄여야 합니다."
      ]
    };
  }

  const people = Array.from({ length: numPeople }, (_, i) => `${i + 1}`);

  const shuffledPeople = shuffle(people);
  const shuffledProblems = shuffle(filteredProblems);

  const peopleCounts = splitCounts(numPeople, numGroups);

  // 문제 수가 딱 떨어지면 완전 균등
  // 딱 안 떨어질 때만 앞쪽(=인원 많은 조)부터 1문제씩 추가
  const problemCounts = splitCounts(shuffledProblems.length, numGroups);

  const groupedPeople = chunkByCounts(shuffledPeople, peopleCounts);
  const groupedProblems = chunkByCounts(shuffledProblems, problemCounts);

  const groups = [];
  
  for (let i = 0; i < numGroups; i++) {
  const sortedMembers = [...groupedPeople[i]].sort((a, b) => Number(a) - Number(b));
  const sortedProblems = [...groupedProblems[i]].sort((a, b) => a - b);

  groups.push({
    groupName: `${i + 1}조`,
    members: sortedMembers,
    problems: sortedProblems,
    memberCount: sortedMembers.length,
    problemCount: sortedProblems.length
  });
}

  return {
    errors: [],
    allProblems,
    filteredProblems,
    shuffledProblems,
    groups,
    peopleCounts,
    problemCounts
  };
}

function buildResultText(data) {
  if (!data || data.errors?.length) return "";

  const lines = [];
  lines.push("랜덤 조 배치 & 문제 배정 결과");
  lines.push("");

  data.groups.forEach((group) => {
    lines.push(
      `${group.groupName} (인원 ${group.memberCount}명 / 문제 ${group.problemCount}개)`
    );
    lines.push(`- 조원: ${group.members.join(", ")}`);
    lines.push(`- 문제: ${group.problems.join(", ")}`);
    lines.push("");
  });

  return lines.join("\n").trim();
}

function renderMessage(html) {
  const messageEl = document.getElementById("message");
  messageEl.innerHTML = html;
}

function renderResult(data, infoType = "assigned") {
  const resultEl = document.getElementById("result");
  resultEl.innerHTML = "";

  if (data.errors && data.errors.length > 0) {
    renderMessage(`<div class="status error">${data.errors.join("\n")}</div>`);
    return;
  }

  let statusTitle = "배정이 완료되었습니다.";
  if (infoType === "reshuffled") {
    statusTitle = "같은 입력값으로 다시 셔플했습니다.";
  } else if (infoType === "copied") {
    statusTitle = "결과를 클립보드에 복사했습니다.";
  }

  renderMessage(`
    <div class="status success">${statusTitle}</div>
    <div class="summary">
      전체 사용 문제 수: <strong>${data.filteredProblems.length}</strong><br>
      인원 분배: <strong>[${data.peopleCounts.join(", ")}]</strong><br>
      문제 분배: <strong>[${data.problemCounts.join(", ")}]</strong><br>
      조원과 문제는 모두 랜덤 셔플 후 배정됩니다.
    </div>
  `);

  data.groups.forEach((group) => {
    const div = document.createElement("div");
    div.className = "result-group";
    div.innerHTML = `
      <h3>${group.groupName}</h3>
      <div class="meta">
        인원 수 <span class="badge">${group.memberCount}명</span>
        문제 수 <span class="badge">${group.problemCount}개</span>
      </div>
      <div class="result-line"><strong>조원:</strong> ${formatList(group.members)}</div>
      <div class="result-line"><strong>문제:</strong> ${formatList(group.problems)}</div>
    `;
    resultEl.appendChild(div);
  });
}

let latestResult = null;

function runAssignment(mode = "assigned") {
  const { numPeople, numGroups, startProblem, endProblem, excludedSet } = getInputValues();

  latestResult = assignGroupsAndProblems(
    numPeople,
    startProblem,
    endProblem,
    excludedSet,
    numGroups
  );

  renderResult(latestResult, mode);
}

document.getElementById("assignBtn").addEventListener("click", () => {
  runAssignment("assigned");
});

document.getElementById("reshuffleBtn").addEventListener("click", () => {
  runAssignment("reshuffled");
});

document.getElementById("copyBtn").addEventListener("click", async () => {
  if (!latestResult || latestResult.errors?.length) {
    renderMessage(
      `<div class="status error">복사할 결과가 없습니다. 먼저 조 배치를 실행해 주세요.</div>`
    );
    return;
  }

  const text = buildResultText(latestResult);

  try {
    await navigator.clipboard.writeText(text);
    renderResult(latestResult, "copied");
  } catch (error) {
    renderMessage(
      `<div class="status error">브라우저에서 클립보드 복사를 허용하지 않았습니다. 수동으로 복사해 주세요.</div>`
    );
  }
});
