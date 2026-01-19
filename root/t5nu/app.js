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
  straight: "/t5/assets/t5measure_D.jpg", // 일자
  L: "/t5/assets/t5measure_R.jpg", // ㄱ자
  square: "/t5/assets/t5measure_M.jpg", // ㅁ자
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
    if (t && t.tagName === "INPUT" && t.type === "text") {
      // type="text"로 변경
      e.preventDefault();
      onCalculate();
    }
  }
}

// ── 여기부터 추가 ──
// 천 단위 쉼표 추가
function addComma(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// 쉼표 제거
function removeComma(str) {
  return str.replace(/,/g, "");
}
// ── 여기까지 추가 ──

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
    <div class="input-group">
      <label for="lengthInput1">A 길이 (mm)</label>
      <input type="text" id="lengthInput1" inputmode="numeric" placeholder="길이를 입력해주세요" />
    </div>
  `;
  } else if (type === "L") {
    dynInputs.innerHTML = `
    <div class="input-group">
      <label for="lengthInput1">A 길이 (mm)</label>
      <input type="text" id="lengthInput1" inputmode="numeric" placeholder="길이를 입력해주세요" />
    </div>
    <div class="input-group">
      <label for="lengthInput2">B 길이 (mm)</label>
      <input type="text" id="lengthInput2" inputmode="numeric" placeholder="길이를 입력해주세요" />
    </div>
  `;
  } else {
    dynInputs.innerHTML = `
    <div class="input-group">
      <label for="lengthInput1">A 길이 (mm)</label>
      <input type="text" id="lengthInput1" inputmode="numeric" placeholder="길이를 입력해주세요" />
    </div>
    <div class="input-group">
      <label for="lengthInput2">B 길이 (mm)</label>
      <input type="text" id="lengthInput2" inputmode="numeric" placeholder="길이를 입력해주세요" />
    </div>
    <div class="input-group">
      <label for="lengthInput3">C 길이 (mm)</label>
      <input type="text" id="lengthInput3" inputmode="numeric" placeholder="길이를 입력해주세요" />
    </div>
    <div class="input-group">
      <label for="lengthInput4">D 길이 (mm)</label>
      <input type="text" id="lengthInput4" inputmode="numeric" placeholder="길이를 입력해주세요" />
    </div>
  `;
  }

  // 엔터핸들러 부착
  dynInputs.removeEventListener("keydown", handleEnterKey);
  dynInputs.addEventListener("keydown", handleEnterKey);

  // 쉼표 포맷팅 이벤트 추가
  dynInputs.addEventListener("input", (e) => {
    const input = e.target;
    if (input && input.tagName === "INPUT" && input.type === "text") {
      let value = removeComma(input.value);
      // 숫자만 허용
      value = value.replace(/[^0-9]/g, "");
      if (value) {
        input.value = addComma(value);
      } else {
        input.value = "";
      }
    }
  });
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
      b.used - a.used,
  );
}

// ── 변 리스트 렌더
function renderSelectableSide(list, sideId, title) {
  sideLists[sideId] = list;
  if (!(sideId in selections)) selections[sideId] = 0;

  const selectedIndex = selections[sideId];
  const selectedItem = list[selectedIndex];
  const selectedCm = comboToCounts(selectedItem);
  const selectedPrice = new Intl.NumberFormat("ko-KR").format(
    priceFromCounts(selectedCm),
  );
  const selectedRealLines = order
    .filter((l) => selectedCm[l] > 0)
    .map((l) => `${realMap[l]}mm x ${selectedCm[l]}`)
    .join(", ");

  let html = `
    <div class="card combo-selector">
      <div class="rank-title" style="margin-bottom: 10px;">${title}</div>
      <div class="selected-display">
        <div class="rank-title">선택${selectedIndex + 1}</div>
        <div class="counts">${formatCounts(selectedCm)}</div>
        <div class="muted">(실제: ${selectedRealLines})</div>
        <div style="margin-top:6px;">
          <span class="remaining-box">여유치수 ${selectedItem.remaining}mm</span>
          <span class="muted">/ 총 사용 ${selectedItem.used}mm</span>
        </div>
        <div style="margin-top:4px;"><strong>예상 비용</strong> ₩${selectedPrice}</div>
      </div>
      <button class="change-btn" onclick="openComboModal('${sideId}', '${title}')">변경</button>
    </div>`;

  return html;
}

// 모달 열기
window.openComboModal = function (sideId, title) {
  const list = sideLists[sideId];
  const selectedIndex = selections[sideId];

  let modalContent = `
    <div class="modal-header">
      <h3>${title}</h3>
      <button class="modal-close" onclick="closeComboModal()">✕</button>
    </div>
    <div class="modal-body">`;

  list.forEach((item, idx) => {
    const cm = comboToCounts(item);
    const price = new Intl.NumberFormat("ko-KR").format(priceFromCounts(cm));
    const realLines = order
      .filter((l) => cm[l] > 0)
      .map((l) => `${realMap[l]}mm x ${cm[l]}`)
      .join(", ");
    const activeClass = idx === selectedIndex ? "active" : "";

    modalContent += `
      <div class="modal-option ${activeClass}" onclick="selectComboFromModal('${sideId}', ${idx})">
        <div class="rank-title">선택${idx + 1}</div>
        <div class="counts">${formatCounts(cm)}</div>
        <div class="muted">(실제: ${realLines})</div>
        <div style="margin-top:6px;">
          <span class="remaining-box">여유치수 ${item.remaining}mm</span>
          <span class="muted">/ 총 사용 ${item.used}mm</span>
        </div>
        <div style="margin-top:4px;"><strong>예상 비용</strong> ₩${price}</div>
      </div>`;
  });

  modalContent += `</div>`;

  const modal = document.getElementById("comboModal");
  const modalContentDiv = modal.querySelector(".modal-content");
  modalContentDiv.innerHTML = modalContent;
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
};

// 모달에서 선택
window.selectComboFromModal = function (sideId, idx) {
  selections[sideId] = idx;
  closeComboModal();

  // 해당 카드만 업데이트
  updateComboDisplay(sideId);

  // 합계 업데이트
  renderTotals();
};

// 조합 표시 업데이트
function updateComboDisplay(sideId) {
  const list = sideLists[sideId];
  const selectedIndex = selections[sideId];
  const selectedItem = list[selectedIndex];
  const selectedCm = comboToCounts(selectedItem);
  const selectedPrice = new Intl.NumberFormat("ko-KR").format(
    priceFromCounts(selectedCm),
  );
  const selectedRealLines = order
    .filter((l) => selectedCm[l] > 0)
    .map((l) => `${realMap[l]}mm x ${selectedCm[l]}`)
    .join(", ");

  // 해당 sideId의 카드 찾기
  const cards = document.querySelectorAll(".combo-selector");
  cards.forEach((card) => {
    const changeBtn = card.querySelector(".change-btn");
    if (changeBtn && changeBtn.getAttribute("onclick").includes(sideId)) {
      const display = card.querySelector(".selected-display");
      display.innerHTML = `
        <div class="rank-title">선택${selectedIndex + 1}</div>
        <div class="counts">${formatCounts(selectedCm)}</div>
        <div class="muted">(실제: ${selectedRealLines})</div>
        <div style="margin-top:6px;">
          <span class="remaining-box">여유치수 ${selectedItem.remaining}mm</span>
          <span class="muted">/ 총 사용 ${selectedItem.used}mm</span>
        </div>
        <div style="margin-top:4px;"><strong>예상 비용</strong> ₩${selectedPrice}</div>`;
    }
  });
}

// 모달 닫기
window.closeComboModal = function () {
  const modal = document.getElementById("comboModal");
  modal.style.display = "none";
  document.body.style.overflow = "";
};

// 모달 배경 클릭시 닫기
window.onclick = function (event) {
  const modal = document.getElementById("comboModal");
  if (event.target === modal) {
    closeComboModal();
  }
};

// 드롭다운 토글
window.toggleComboList = function (sideId) {
  const list = document.getElementById(`combo-list-${sideId}`);
  const arrow = event.currentTarget.querySelector(".dropdown-arrow");

  if (list.style.display === "none") {
    // 다른 열린 목록 모두 닫기
    document.querySelectorAll(".combo-list").forEach((l) => {
      l.style.display = "none";
    });
    document.querySelectorAll(".dropdown-arrow").forEach((a) => {
      a.textContent = "▼";
    });

    list.style.display = "block";
    arrow.textContent = "▲";
  } else {
    list.style.display = "none";
    arrow.textContent = "▼";
  }
};

// 조합 선택
window.selectCombo = function (sideId, idx) {
  selections[sideId] = idx;

  // 해당 변의 UI만 다시 렌더링
  const card = document
    .getElementById(`combo-list-${sideId}`)
    .closest(".combo-selector");
  const list = sideLists[sideId];
  const selectedItem = list[idx];
  const selectedCm = comboToCounts(selectedItem);
  const selectedPrice = new Intl.NumberFormat("ko-KR").format(
    priceFromCounts(selectedCm),
  );
  const selectedRealLines = order
    .filter((l) => selectedCm[l] > 0)
    .map((l) => `${realMap[l]}mm x ${selectedCm[l]}`)
    .join(", ");

  // 선택된 항목 업데이트
  const selectedCombo = card.querySelector(".selected-combo");
  selectedCombo.innerHTML = `
    <div class="row">
      <span class="rank-title">선택${idx + 1}</span>
      <span class="dropdown-arrow">▼</span>
    </div>
    <div class="counts">${formatCounts(selectedCm)}</div>
    <div class="muted">(실제: ${selectedRealLines})</div>
    <div style="margin-top:6px;">
      <span class="remaining-box">여유치수 ${selectedItem.remaining}mm</span>
      <span class="muted">/ 총 사용 ${selectedItem.used}mm</span>
    </div>
    <div style="margin-top:4px;"><strong>예상 비용</strong> ₩${selectedPrice}</div>`;

  // onclick 다시 연결
  selectedCombo.onclick = () => toggleComboList(sideId);

  // 목록 닫기
  document.getElementById(`combo-list-${sideId}`).style.display = "none";

  // 합계 업데이트
  renderTotals();
};

window.onPick = function (sideId, idx) {
  selections[sideId] = idx;
  renderTotals();
};

// 토글 함수 추가
window.toggleDetail = function (element) {
  const detail = element.querySelector(".detail-content");
  if (detail.style.display === "none") {
    detail.style.display = "";
    element.classList.add("expanded");
  } else {
    detail.style.display = "none";
    element.classList.remove("expanded");
  }
};

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
  const totalsBox = document.getElementById("totalsBox");
  if (totalsBox) {
    totalsBox.innerHTML = "";
  }
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

  const totalsBox = document.getElementById("totalsBox");
  if (!totalsBox) return;

  if (!any) {
    totalsBox.innerHTML = "";
    return;
  }

  const cost = new Intl.NumberFormat("ko-KR").format(
    priceFromCounts(totalCounts),
  );
  const html = `
    <div class="card totals" style="margin-bottom:16px;">
      <div class="rank-title">총 필요 수량 & 비용 (선택 조합 합산)</div>
      <div class="counts">${formatCounts(totalCounts)}</div>
      <div style="margin-top:4px;"><strong>예상 비용</strong> ₩${cost}</div>
    </div>`;

  totalsBox.innerHTML = html;
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
    const L = parseInt(
      removeComma(document.getElementById("lengthInput1")?.value || ""),
    );
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
      '<div class="card" style="margin-bottom:16px;"><strong>기본적으로 가장 저렴한 조합이 선택되어 있습니다.<br>아래 목록을 누르면 <br>여유 치수와 비용이 다른 <br>다양한 조합을 확인하실 수 있습니다.<br>모든 옵션은 설치가 가능합니다.</strong><br><br>💡 선택 팁<br>• 전원선 직접 연결: 여유 치수 70mm 이상 필수<br>• 커넥터 분리 후 연결: 모든 사이즈 자유 선택 가능</div>';
    html += '<div id="totalsBox"></div>';
    html += renderSelectableSide(list, "STRAIGHT", "일자 조합 리스트");
    resultArea.innerHTML = html;
    renderTotals();
    return;
  }

  if (type === "L") {
    const A = parseInt(
      removeComma(document.getElementById("lengthInput1")?.value || ""),
    );
    const B = parseInt(
      removeComma(document.getElementById("lengthInput2")?.value || ""),
    );
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
      '<div class="card" style="margin-bottom:16px;"><strong>기본적으로 가장 저렴한 조합이 선택되어 있습니다.<br>아래 목록을 누르면 <br>여유 치수와 비용이 다른 <br>다양한 조합을 확인하실 수 있습니다.<br>모든 옵션은 설치가 가능합니다.</strong><br><br>💡 선택 팁<br>• 전원선 직접 연결: 여유 치수 70mm 이상 필수<br>• 커넥터 분리 후 연결: 모든 사이즈 자유 선택 가능</div>';
    html += '<div id="totalsBox"></div>';
    html += renderSelectableSide(listA, "A", "A 조합 리스트");
    html += renderSelectableSide(listB, "B", "B 조합 리스트");
    resultArea.innerHTML = html;
    renderTotals();
    return;
  }

  if (type === "square") {
    const S1 = parseInt(
      removeComma(document.getElementById("lengthInput1")?.value || ""),
    );
    const S2 = parseInt(
      removeComma(document.getElementById("lengthInput2")?.value || ""),
    );
    const S3 = parseInt(
      removeComma(document.getElementById("lengthInput3")?.value || ""),
    );
    const S4 = parseInt(
      removeComma(document.getElementById("lengthInput4")?.value || ""),
    );
    if ([S1, S2, S3, S4].some((v) => isNaN(v) || v <= 0)) {
      resultArea.innerHTML =
        '<p class="no-data">4개 변 길이를 모두 올바르게 입력해주세요.</p>';
      hideFloatingTotals();
      return;
    }
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
      '<div class="card" style="margin-bottom:16px;"><strong>기본적으로 가장 저렴한 조합이 선택되어 있습니다.<br>아래 목록을 누르면 <br>여유 치수와 비용이 다른 <br>다양한 조합을 확인하실 수 있습니다.<br>모든 옵션은 설치가 가능합니다.</strong><br><br>💡 선택 팁<br>• 전원선 직접 연결: 여유 치수 70mm 이상 필수<br>• 커넥터 분리 후 연결: 모든 사이즈 자유 선택 가능</div>';
    html += '<div id="totalsBox"></div>';
    html += renderSelectableSide(lists[0], "S1", "A 조합 리스트");
    html += renderSelectableSide(lists[1], "S2", "B 조합 리스트");
    html += renderSelectableSide(lists[2], "S3", "C 조합 리스트");
    html += renderSelectableSide(lists[3], "S4", "D 조합 리스트");
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
    "*",
  );
}

function chooseType(type) {
  pauseYoutube();
  typeSelect.value = type;
  typeChooser.style.display = "none";
  calcArea.style.display = "";

  const src = typeImageSrc[type] || "";
  if (src) {
    imgEl.src = src;
    imgWrap.style.display = "";
  } else {
    imgWrap.style.display = "none";
  }
  renderInputs();
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
