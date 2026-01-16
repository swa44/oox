// ===== 기본 데이터 =====
const t5Sizes = [
  { label: "1200", length: 1180 },
  { label: "900", length: 880 },
  { label: "600", length: 580 },
  { label: "400", length: 375 },
  { label: "300", length: 285 },
];
const order = ["1200", "900", "600", "400", "300"];
const priceMap = {
  1200: 4800,
  900: 4600,
  600: 4200,
  400: 4600,
  300: 2800,
};
const realMap = { 1200: 1180, 900: 880, 600: 580, 400: 375, 300: 285 };

// 타입별 이미지 경로
const typeImageSrc = {
  straight: "/t5nu/assets/t5measure_D.jpg", // 일자
  L: "/t5nu/assets/t5measure_R.jpg", // ㄱ자
  square: "/t5nu/assets/t5measure_M.jpg", // ㅁ자
};

const selections = {};
const sideLists = {};

// ── DOM refs
const typeChooser = document.getElementById("typeChooser");
const calcArea = document.getElementById("calcArea");
const typeSelect = document.getElementById("typeSelect");
const dynInputs = document.getElementById("dynamicInputs");
const resultArea = document.getElementById("resultArea");
const floatingBar = document.getElementById("floatingTotals");
const calcBtn = document.getElementById("calcBtn");
const imgWrap = document.getElementById("typeImageContainer");
const imgEl = document.getElementById("typeImage");
const resetBtn = document.getElementById("resetBtn");

// ── 타입 선택 버튼 클릭
typeChooser.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-choose]");
  if (!btn) return;
  const type = btn.getAttribute("data-choose");
  chooseType(type);
});

function chooseType(type) {
  pauseYoutube();
  typeSelect.value = type;
  typeChooser.style.display = "none";
  calcArea.style.display = "";

  // 타입별 이미지 표시
  const src = typeImageSrc[type] || "";
  if (src) {
    imgEl.src = src;
    imgWrap.style.display = "";
  } else {
    imgWrap.style.display = "none";
  }

  renderInputs();
}

// ── 엔터로 계산
function handleEnterKey(e) {
  if (e.key === "Enter") {
    const t = e.target;
    if (t && t.tagName === "INPUT" && t.type === "number") {
      e.preventDefault();
      onCalculate();
    }
  }
}

// ── 입력칸 렌더
function renderInputs() {
  // 상태/결과 초기화
  resultArea.innerHTML = "";
  hideFloatingTotals();
  Object.keys(selections).forEach((k) => delete selections[k]);
  Object.keys(sideLists).forEach((k) => delete sideLists[k]);

  const type = typeSelect.value;

  if (type === "straight") {
    dynInputs.innerHTML = `
            <label for="lengthInput1">설치 공간 길이 (mm)</label>
            <input type="number" id="lengthInput1" min="0" placeholder="설치공간의 길이를 입력해주세요. (예: 2437)" />
          `;
  } else if (type === "L") {
    dynInputs.innerHTML = `
            <label for="lengthInput1">변 A 길이 (mm)</label>
            <input type="number" id="lengthInput1" min="0" placeholder="설치공간의 길이를 입력해주세요. (예: 3000)" />
            <label for="lengthInput2">변 B 길이 (mm)</label>
            <input type="number" id="lengthInput2" min="0" placeholder="설치공간의 길이를 입력해주세요. (예: 2000)" />
          `;
  } else {
    dynInputs.innerHTML = `
            <label for="lengthInput1">변 A 길이 (mm)</label>
            <input type="number" id="lengthInput1" min="0" placeholder="설치공간의 길이를 입력해주세요. (예: 3000)" />
            <label for="lengthInput2">변 B 길이 (mm)</label>
            <input type="number" id="lengthInput2" min="0" placeholder="설치공간의 길이를 입력해주세요. (예: 3000)" />
            <label for="lengthInput3">변 C 길이 (mm)</label>
            <input type="number" id="lengthInput3" min="0" placeholder="설치공간의 길이를 입력해주세요. (예: 3000)" />
            <label for="lengthInput4">변 D 길이 (mm)</label>
            <input type="number" id="lengthInput4" min="0" placeholder="설치공간의 길이를 입력해주세요. (예: 3000)" />
          `;
  }

  // 엔터핸들러 부착
  dynInputs.removeEventListener("keydown", handleEnterKey);
  dynInputs.addEventListener("keydown", handleEnterKey);
}

// ── 유틸
function formatCounts(countMap) {
  const lines = order
    .filter((l) => (countMap[l] || 0) > 0)
    .map((l) => `${l}mm : ${countMap[l]}개`)
    .join("\n");
  return lines || "없음";
}
function comboToCounts(item) {
  const cm = { 1200: 0, 900: 0, 600: 0, 400: 0, 300: 0 };
  item.combo.forEach((c) => {
    cm[c.label] = (cm[c.label] || 0) + 1;
  });
  return cm;
}
function priceFromCounts(counts) {
  return order.reduce((s, l) => s + (counts[l] || 0) * priceMap[l], 0);
}

// ── 조합 생성 (여유 50~100, 같은 여유는 최저가만, 비용 오름차순)
function generateCombos(space, minRem = 50, maxRem = 100) {
  const combos = [];
  function dfs(index, curr, used) {
    if (used > space) return;
    const remaining = space - used;
    if (remaining >= minRem && remaining <= maxRem) {
      combos.push({ combo: [...curr], used, remaining });
    }
    for (let i = index; i < t5Sizes.length; i++) {
      curr.push(t5Sizes[i]);
      dfs(i, curr, used + t5Sizes[i].length);
      curr.pop();
    }
  }
  dfs(0, [], 0);

  // 비용계산
  combos.forEach((it) => {
    it._cost = it.combo.reduce((sum, p) => sum + priceMap[p.label], 0);
  });

  // 여유치수별 최저가 하나만
  const best = new Map();
  for (const it of combos) {
    const key = it.remaining;
    const prev = best.get(key);
    if (
      !prev ||
      it._cost < prev._cost ||
      (it._cost === prev._cost && it.combo.length < prev.combo.length) ||
      (it._cost === prev._cost &&
        it.combo.length === prev.combo.length &&
        it.used > prev.used)
    ) {
      best.set(key, it);
    }
  }

  // 정렬
  return Array.from(best.values()).sort(
    (a, b) =>
      a._cost - b._cost ||
      a.combo.length - b.combo.length ||
      b.remaining - a.remaining ||
      b.used - a.used
  );
}

// ── 변 리스트 렌더
function renderSelectableSide(list, sideId, title) {
  sideLists[sideId] = list;
  if (!(sideId in selections)) selections[sideId] = 0;

  let html = `<div class="card"><div class="side-header"><div class="rank-title">${title}</div></div>`;
  list.forEach((item, idx) => {
    const cm = comboToCounts(item);
    const price = new Intl.NumberFormat("ko-KR").format(priceFromCounts(cm));
    const checked = selections[sideId] === idx ? "checked" : "";
    const realLines = order
      .filter((l) => cm[l] > 0)
      .map((l) => `${realMap[l]}mm x ${cm[l]}`)
      .join(", ");

    html += `
            <div class="divider">
              <div class="row">
                <input class="radio" type="radio" name="pick-${sideId}" id="pick-${sideId}-${idx}" value="${idx}" ${checked}
                       onchange="onPick('${sideId}', ${idx})" />
                <label for="pick-${sideId}-${idx}" class="rank-title">선택${
      idx + 1
    }</label>
              </div>
              <div class="counts">${formatCounts(cm)}</div>
              <div class="muted">(실제: ${realLines})</div>
              <div style="margin-top:6px;">
                <span class="remaining-box">여유치수 ${item.remaining}mm</span>
                <span class="muted">/ 총 사용 ${item.used}mm</span>
              </div>
              <div style="margin-top:4px;"><strong>예상 비용</strong> ₩${price}</div>
            </div>`;
  });
  html += "</div>";
  return html;
}
window.onPick = function (sideId, idx) {
  selections[sideId] = idx;
  renderTotals();
};

// ── 플로팅 합계 바
function showFloatingTotals(html) {
  floatingBar.innerHTML = html;
  floatingBar.classList.add("visible");
  requestAnimationFrame(() => {
    const h = floatingBar.offsetHeight || 0;
    document.body.style.paddingBottom = h + 10 + "px";
  });
}
function hideFloatingTotals() {
  floatingBar.classList.remove("visible");
  floatingBar.innerHTML = "";
  document.body.style.paddingBottom = "";
}
function renderTotals() {
  const totalCounts = { 1200: 0, 900: 0, 600: 0, 400: 0, 300: 0 };
  let any = false;
  for (const sideId in sideLists) {
    const list = sideLists[sideId];
    const pickIndex = selections[sideId];
    if (!list || typeof pickIndex !== "number" || !list[pickIndex]) continue;
    const cm = comboToCounts(list[pickIndex]);
    order.forEach((l) => {
      totalCounts[l] += cm[l] || 0;
    });
    any = true;
  }
  if (!any) {
    hideFloatingTotals();
    return;
  }
  const cost = new Intl.NumberFormat("ko-KR").format(
    priceFromCounts(totalCounts)
  );
  const html = `
          <div class="card totals">
            <div class="rank-title">총 필요 수량 & 비용 (선택 조합 합산)</div>
            <div class="counts">${formatCounts(totalCounts)}</div>
            <div style="margin-top:4px;"><strong>예상 비용</strong> ₩${cost}</div>
          </div>`;
  showFloatingTotals(html);
}

// ── 계산 버튼
calcBtn.addEventListener("click", onCalculate);
function onCalculate() {
  gtag("event", "calculate_button_click", {
    event_category: "interaction",
    event_label: "T5 Calculator",
  });

  const type = typeSelect.value;
  resultArea.innerHTML = "";
  Object.keys(selections).forEach((k) => delete selections[k]);
  Object.keys(sideLists).forEach((k) => delete sideLists[k]);

  if (type === "straight") {
    const L = parseInt(document.getElementById("lengthInput1")?.value);
    if (isNaN(L) || L <= 0) {
      resultArea.innerHTML =
        '<p class="no-data">길이를 올바르게 입력해주세요.</p>';
      hideFloatingTotals();
      return;
    }
    const list = generateCombos(L);
    if (!list.length) {
      resultArea.innerHTML =
        '<p class="no-data">50~100mm 사이로 남는 조합이 없습니다.</p>';
      hideFloatingTotals();
      return;
    }
    let html = "";
    html +=
      '<div class="card" style="margin-bottom:16px;"><strong>일자 조합에서 하나를 선택하시면 <br>맨 밑에 총 개수와 금액이 나타납니다.<br>전원선 연결 하실분은 여유치수 70mm 이상,<br>커넥터 분리 후 연결하실 분들은 <br>자유롭게 선택해주세요.</strong></div>';
    html += renderSelectableSide(list, "STRAIGHT", "일자 조합 리스트");
    html += '<div id="totalsBox"></div>';
    resultArea.innerHTML = html;
    renderTotals();
    return;
  }

  if (type === "L") {
    const A = parseInt(document.getElementById("lengthInput1")?.value);
    const B = parseInt(document.getElementById("lengthInput2")?.value);
    if ([A, B].some((v) => isNaN(v) || v <= 0)) {
      resultArea.innerHTML =
        '<p class="no-data">두 변 길이를 올바르게 입력해주세요.</p>';
      hideFloatingTotals();
      return;
    }
    const listA = generateCombos(A);
    const listB = generateCombos(B);
    if (!listA.length || !listB.length) {
      resultArea.innerHTML =
        '<p class="no-data">50~100mm 사이로 남는 조합이 없는 변이 있습니다.</p>';
      hideFloatingTotals();
      return;
    }
    let html = "";
    html +=
      '<div class="card" style="margin-bottom:16px;"><strong>A,B 각 변의 조합을 하나씩 선택하시면 <br>맨 밑에 총 개수와 금액이 나타납니다.<br>전원선 연결 하실분은 여유치수 70mm 이상,<br>커넥터 분리 후 연결하실 분들은 <br>자유롭게 선택해주세요.</strong></div>';
    html += renderSelectableSide(listA, "A", "변 A 조합 리스트");
    html += renderSelectableSide(listB, "B", "변 B 조합 리스트");
    html += '<div id="totalsBox"></div>';
    resultArea.innerHTML = html;
    renderTotals();
    return;
  }

  if (type === "square") {
    const S1 = parseInt(document.getElementById("lengthInput1")?.value);
    const S2 = parseInt(document.getElementById("lengthInput2")?.value);
    const S3 = parseInt(document.getElementById("lengthInput3")?.value);
    const S4 = parseInt(document.getElementById("lengthInput4")?.value);
    if ([S1, S2, S3, S4].some((v) => isNaN(v) || v <= 0)) {
      resultArea.innerHTML =
        '<p class="no-data">4개 변 길이를 모두 올바르게 입력해주세요.</p>';
      hideFloatingTotals();
      return;
    }
    // 사각은 요청대로 여유 50~120으로 확장
    const lists = [
      generateCombos(S1, 50, 120),
      generateCombos(S2, 50, 120),
      generateCombos(S3, 50, 120),
      generateCombos(S4, 50, 120),
    ];
    if (lists.some((list) => !list.length)) {
      resultArea.innerHTML =
        '<p class="no-data">50~100mm(또는 설정 범위)로 남는 조합이 없는 변이 있습니다.</p>';
      hideFloatingTotals();
      return;
    }
    let html = "";
    html +=
      '<div class="card" style="margin-bottom:16px;"><strong>A,B,C,D 각 변의 조합을 하나씩 선택하시면 <br>맨 밑에 총 개수와 금액이 나타납니다.<br>전원선 연결 하실분은 여유치수 70mm 이상,<br>커넥터 분리 후 연결하실 분들은 <br>자유롭게 선택해주세요.</strong></div>';
    html += renderSelectableSide(lists[0], "S1", "변 A 조합 리스트");
    html += renderSelectableSide(lists[1], "S2", "변 B 조합 리스트");
    html += renderSelectableSide(lists[2], "S3", "변 C 조합 리스트");
    html += renderSelectableSide(lists[3], "S4", "변 D 조합 리스트");
    html += '<div id="totalsBox"></div>';
    resultArea.innerHTML = html;
    renderTotals();
  }
}

// ── 유튜브 일시정지 (초기화/타입변경 시 사용)
function pauseYoutube() {
  const iframe = document.getElementById("ytPlayer");
  if (!iframe) return;
  iframe.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
    "*"
  );
}

// ── "처음으로" 버튼 동작
resetBtn.addEventListener("click", goHome);
function goHome() {
  // 상태 초기화
  resultArea.innerHTML = "";
  dynInputs.innerHTML = "";
  hideFloatingTotals();
  Object.keys(selections).forEach((k) => delete selections[k]);
  Object.keys(sideLists).forEach((k) => delete sideLists[k]);

  // 이미지 숨기고 소스 제거
  imgEl.removeAttribute("src");
  imgWrap.style.display = "none";

  // 화면 전환
  calcArea.style.display = "none";
  typeChooser.style.display = "";

  // 유튜브 정지
  pauseYoutube();

  // 맨 위로
  window.scrollTo({ top: 0, behavior: "smooth" });
}
