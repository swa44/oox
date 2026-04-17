(function () {
  // ===== 상태 =====
  let connectionType = null; // 'serial' | 'parallel' | 'square'
  let spec = null; // '40' | '60' | null
  let wireType = null; // 'wire1' | 'wire10' | 'mixed' | null

  // ===== DOM =====
  const chooser = document.getElementById("connectChooser");
  const pickSerialBtn = document.getElementById("pickSerial");
  const pickParallelBtn = document.getElementById("pickParallel");
  const pickSquareBtn = document.getElementById("pickSquare");

  const connectionInfo = document.getElementById("connectionInfo");
  const connectionTypeText = document.getElementById("connectionTypeText");

  const lengthSection = document.getElementById("lengthSection");
  const specSelect = document.getElementById("specSelect");
  const wiringSelect = document.getElementById("wiringSelect");
  const lengthInputsArea = document.getElementById("lengthInputsArea");

  const calcBtn = document.getElementById("calcBtn");
  const resetBtn = document.getElementById("resetBtn");
  const resultArea = document.getElementById("resultArea");

  // ===== 가격표 =====
  const PRICES = {
    40: {
      line: {
        100: 4400,
        200: 5900,
        300: 7200,
        400: 8300,
        500: 9600,
        1000: 14000,
      },
      cover: { 5: 27500, 10: 55000, 15: 74500, 20: 80000 },
    },
    60: {
      line: {
        100: 4800,
        200: 7200,
        300: 8700,
        400: 11000,
        500: 13200,
        1000: 17200,
      },
      cover: { 5: 32500, 10: 65000, 15: 92500, 20: 100000 },
    },
  };

  // 공통 부속품
  const BRACKET_SET_PRICE = 2000; // 라인조명 1개당 1세트
  const SIDE_CAP_SET_PRICE = 1000; // 일자 견적은 무조건 1세트

  // 전원선
  const WIRE_PRICES = {
    wire1: 2000, // 전원선 1구(2m)
    wire10: 30000, // 전원선 10구(10.5m)
  };

  // ⚡ SMPS(70% 규칙)
  const SMPS_PRICES = { 60: 12800, 100: 24000, 200: 34000, 300: 38000 };
  const SMPS_OPTIONS = [60, 100, 200, 300]; // 정격(W)
  const LOAD_LIMIT = 0.7; // 70%

  // 🔌 라인조명 소비전력 (W)
  const WATTS = {
    40: { 100: 1.5, 200: 3, 300: 4.5, 400: 6, 500: 7.5, 1000: 15 },
    60: { 100: 3, 200: 6, 300: 9, 400: 12, 500: 15, 1000: 30 },
  };

  // 기역자형 가격/치수
  const L_CORNER_LINE_PRICE = 10000; // 규격 40/60 동일
  const L_CORNER_COVER_PRICE = { 40: 12000, 60: 13000 }; // 규격별
  const L_CORNER_SIZE = { 40: 45, 60: 65 }; // mm
  const L_CORNER_WATT = 1.5; // 기역자형 1개당 소비전력 (W)

  // 사용 규격(내림차순)
  const DENOMS = [1000, 500, 400, 300, 200, 100]; // mm

  // ===== 유틸 =====
  const fmt = (n) => Number(n).toLocaleString("ko-KR");
  const isValidHundreds = (value) =>
    Number.isInteger(value) && value > 0 && value % 100 === 0;

  // 최소 개수 분해 (DP - 코인체인지)
  function decomposeLengthMM(total) {
    const dp = Array(total + 1).fill(Number.POSITIVE_INFINITY);
    const prev = Array(total + 1).fill(null);
    dp[0] = 0;

    for (let i = 100; i <= total; i += 100) {
      for (const d of DENOMS) {
        if (i - d >= 0 && dp[i - d] + 1 < dp[i]) {
          dp[i] = dp[i - d] + 1;
          prev[i] = d;
        }
      }
    }
    if (!Number.isFinite(dp[total])) return null;

    const counts = { 100: 0, 200: 0, 300: 0, 400: 0, 500: 0, 1000: 0 };
    let cur = total;
    while (cur > 0) {
      const d = prev[cur];
      if (d == null) break;
      counts[d] += 1;
      cur -= d;
    }
    return counts;
  }

  // ====== (1) 사용한 라인조명(항목: 가격표시 제거) ======
  function countsToLines(specKey, counts) {
    const table = PRICES[specKey].line;
    const arr = [];
    [1000, 500, 400, 300, 200, 100].forEach((mm) => {
      const c = counts[mm] || 0;
      if (c > 0) {
        const unit = table[mm] || 0;
        void unit;
        arr.push(`${mm}mm × ${fmt(c)}개`);
      }
    });
    return arr;
  }

  function countPieces(counts) {
    return [1000, 500, 400, 300, 200, 100].reduce(
      (s, mm) => s + (counts[mm] || 0),
      0,
    );
  }

  function sumWatts(specKey, counts) {
    return [1000, 500, 400, 300, 200, 100].reduce(
      (w, mm) => w + (counts[mm] || 0) * (WATTS[specKey][mm] || 0),
      0,
    );
  }

  function linesPrice(specKey, counts) {
    const table = PRICES[specKey].line;
    let sum = 0;
    Object.keys(counts).forEach((k) => {
      const mm = parseInt(k, 10);
      const c = counts[mm] || 0;
      if (c > 0) sum += c * (table[mm] || 0);
    });
    return sum;
  }

  function card(innerHtml, extraClass = "") {
    return `<div class="card${
      extraClass ? " " + extraClass : ""
    }">${innerHtml}</div>`;
  }

  // ===== 커버 선택 =====
  function pickCoverPacks(neededMeters, specKey) {
    const coverPrices = PRICES[specKey].cover;
    const packs = [];
    if (neededMeters <= 0) return { packs, subtotal: 0 };

    const full20 = Math.floor(neededMeters / 20);
    const rem = neededMeters % 20;

    if (full20 > 0)
      packs.push({ size: 20, count: full20, price: coverPrices[20] });

    if (rem > 0) {
      let remainderPack = 5;
      if (rem <= 5) remainderPack = 5;
      else if (rem <= 10) remainderPack = 10;
      else if (rem <= 15) remainderPack = 15;
      else remainderPack = 20;
      packs.push({
        size: remainderPack,
        count: 1,
        price: coverPrices[remainderPack],
      });
    }

    const subtotal = packs.reduce((s, p) => s + p.count * p.price, 0);
    return { packs, subtotal };
  }

  // ===== SMPS 조합 추천 (최소 비용, 70% 규칙) =====
  function recommendSmpsCombo(totalW) {
    if (totalW <= 0) return { items: [], subtotal: 0, eff: 0, cap: 0 };

    const units = SMPS_OPTIONS.map((cap) => ({
      cap,
      eff: Math.round(cap * LOAD_LIMIT),
      price: SMPS_PRICES[cap],
    }));

    const target = Math.ceil(totalW);
    const maxEff = Math.max(...units.map((u) => u.eff));
    const DP_SIZE = target + maxEff;

    const dp = Array(DP_SIZE + 1).fill(Infinity);
    const choice = Array(DP_SIZE + 1).fill(null);
    dp[0] = 0;

    for (let w = 0; w <= DP_SIZE; w++) {
      if (!Number.isFinite(dp[w])) continue;
      for (const u of units) {
        const nw = Math.min(DP_SIZE, w + u.eff);
        const ncost = dp[w] + u.price;
        if (ncost < dp[nw]) {
          dp[nw] = ncost;
          choice[nw] = u.cap;
        }
      }
    }

    let bestW = -1,
      bestCost = Infinity;
    for (let w = target; w <= DP_SIZE; w++) {
      if (dp[w] < bestCost) {
        bestCost = dp[w];
        bestW = w;
      }
    }
    if (bestW === -1) return { items: [], subtotal: 0, eff: 0, cap: 0 };

    const counts = {};
    let cur = bestW;
    while (cur > 0 && choice[cur] != null) {
      const cap = choice[cur];
      counts[cap] = (counts[cap] || 0) + 1;
      const eff = Math.round(cap * LOAD_LIMIT);
      cur -= eff;
      if (cur < 0) break;
      while (cur > 0 && choice[cur] == null) cur--;
    }

    const items = SMPS_OPTIONS.filter((c) => counts[c])
      .map((cap) => ({ cap, count: counts[cap], price: SMPS_PRICES[cap] }))
      .sort((a, b) => b.cap - a.cap);

    const subtotal = items.reduce((s, it) => s + it.count * it.price, 0);
    const totalEff = items.reduce(
      (s, it) => s + Math.round(it.cap * LOAD_LIMIT) * it.count,
      0,
    );
    const totalCap = items.reduce((s, it) => s + it.cap * it.count, 0);

    return { items, subtotal: subtotal, eff: totalEff, cap: totalCap };
  }

  function buildComboFromItems(items) {
    const subtotal = items.reduce(
      (s, it) => s + SMPS_PRICES[it.cap] * it.count,
      0,
    );
    const eff = items.reduce(
      (s, it) => s + Math.round(it.cap * LOAD_LIMIT) * it.count,
      0,
    );
    const cap = items.reduce((s, it) => s + it.cap * it.count, 0);
    const normItems = items
      .map((it) => ({
        cap: it.cap,
        count: it.count,
        price: SMPS_PRICES[it.cap],
      }))
      .sort((a, b) => b.cap - a.cap);
    return { items: normItems, subtotal, eff, cap };
  }

  // ===== SMPS 카드 출력 (항목: 가격표시 제거) =====
  function renderSmpsCombo(totalW, combo, extraMsgHTML = "") {
    let out = `<div class="rank-title">SMPS 권장</div>`;
    out += `<div>총 소비전력: ${totalW.toFixed(0)} W</div>`;

    if (!combo.items.length) {
      out += `<div class="muted">라인조명이 없어 전원 공급 불필요</div>`;
      return out;
    }

    let remaining = totalW;
    const effLimitOf = (cap) => cap * LOAD_LIMIT;

    combo.items.forEach((it) => {
      out += `<div>SMPS ${it.cap} W × ${fmt(it.count)}개</div>`;

      for (let i = 0; i < it.count; i++) {
        if (remaining <= 0) {
          out += `<div class="muted" style="margin:2px 0 6px;">[0W사용] (부하 0.0% / 70% 기준 충족)</div>`;
          continue;
        }
        const cap = it.cap;
        const limit = effLimitOf(cap);
        const alloc = Math.max(0, Math.min(remaining, limit));
        const pct = (alloc / cap) * 100;

        out += `<div class="muted" style="margin:2px 0 6px;">[${alloc.toFixed(
          0,
        )}W사용] (부하 ${pct.toFixed(1)}% / 70% 기준 충족)</div>`;
        remaining -= alloc;
      }
    });

    const overallPct =
      combo.cap > 0 ? ((totalW / combo.cap) * 100).toFixed(1) : "0.0";
    out += `<div class="muted" style="margin-top:4px;">(부하 ${overallPct}% / 70% 기준 충족)</div>`;

    if (extraMsgHTML) out += extraMsgHTML;

    return out;
  }

  // ===== UI 렌더 =====
  function renderLengthInputs() {
    const disabledAttr = spec ? "" : "disabled";
    const ph = spec
      ? "설치공간의 길이를 입력해주세요. (예: 2800) — 100단위"
      : "먼저 규격(40/60)을 선택하세요.";

    wiringSelect.disabled = !spec;

    if (connectionType === "serial") {
      lengthInputsArea.innerHTML = `
      <label for="lengthInput">전체 길이 (mm)</label>
      <input type="number" id="lengthInput" placeholder="${ph}" min="100" step="100" ${disabledAttr} />
    `;
    } else if (connectionType === "parallel") {
      lengthInputsArea.innerHTML = `
      <label for="lengthInputA">A변 길이 (mm)</label>
      <input type="number" id="lengthInputA" placeholder="${ph}" min="100" step="100" ${disabledAttr} />
      <label for="lengthInputB">B변 길이 (mm)</label>
      <input type="number" id="lengthInputB" placeholder="${ph}" min="100" step="100" ${disabledAttr} />
    `;
    } else if (connectionType === "square") {
      lengthInputsArea.innerHTML = `
      <label for="lengthInputA">A변 길이 (mm) - 마주보는 2개 변</label>
      <input type="number" id="lengthInputA" placeholder="${ph}" min="100" step="100" ${disabledAttr} />
      <label for="lengthInputB">B변 길이 (mm) - 마주보는 2개 변</label>
      <input type="number" id="lengthInputB" placeholder="${ph}" min="100" step="100" ${disabledAttr} />
    `;
    } else {
      lengthInputsArea.innerHTML = "";
    }
  }

  // ===== 연결 방식 선택 =====
  function chooseConnection(type) {
    connectionType = type;
    spec = null;
    wireType = null;

    chooser.style.display = "none";
    connectionInfo.style.display = "";
    connectionTypeText.textContent =
      type === "serial"
        ? "일자연결"
        : type === "parallel"
          ? "ㄱ자연결"
          : "ㅁ자연결";

    lengthSection.style.display = "block";
    specSelect.value = "";
    wiringSelect.value = "";
    renderLengthInputs();
    resultArea.innerHTML = "";

    // 가이드 이미지 표시
    const specGuideImageDiv = document.getElementById("specGuideImage");
    const wireGuideImageDiv = document.getElementById("wireGuideImage");
    specGuideImageDiv.style.display = "block";
    wireGuideImageDiv.style.display = "block";

    // 샘플 이미지 표시
    const sampleImageDiv = document.getElementById("inputSampleImage");
    const sampleImg = document.getElementById("sampleImg");

    if (type === "serial") {
      sampleImg.src = "/mline/images/sample-serial.jpg"; // 일자연결 이미지 경로
      sampleImageDiv.style.display = "block";
    } else if (type === "parallel") {
      sampleImg.src = "/mline/images/sample-parallel.jpg"; // ㄱ자연결 이미지 경로
      sampleImageDiv.style.display = "block";
    } else if (type === "square") {
      sampleImg.src = "/mline/images/sample-square.jpg"; // ㅁ자연결 이미지 경로
      sampleImageDiv.style.display = "block";
    } else {
      sampleImageDiv.style.display = "none";
    }
  }

  pickSerialBtn.addEventListener("click", () => chooseConnection("serial"));
  pickParallelBtn.addEventListener("click", () => chooseConnection("parallel"));
  pickSquareBtn.addEventListener("click", () => chooseConnection("square"));

  specSelect.addEventListener("change", (e) => {
    spec = e.target.value || null;
    renderLengthInputs();
  });
  wiringSelect.addEventListener("change", (e) => {
    wireType = e.target.value || null;
  });

  // ===== 전원선 혼합형 계산 =====
  function calcWireMixed(pieces) {
    if (pieces <= 0)
      return { label: "전원선 혼합형", countStr: "없음", cost: 0 };
    if (pieces < 5) {
      return {
        label: "전원선 1구(2m)",
        countStr: `${fmt(pieces)}개`,
        cost: pieces * WIRE_PRICES.wire1,
      };
    }
    if (pieces <= 10) {
      return {
        label: "전원선 10구(10.5m)",
        countStr: "1개",
        cost: WIRE_PRICES.wire10,
      };
    }
    if (pieces <= 14) {
      const cost = WIRE_PRICES.wire10 + (pieces - 10) * WIRE_PRICES.wire1;
      return {
        label: "전원선 혼합형(10구+낱개)",
        countStr: `10구 1개 + 1구 ${fmt(pieces - 10)}개`,
        cost,
      };
    }
    const full10 = Math.floor(pieces / 10);
    const rem = pieces % 10;
    const cost =
      full10 * WIRE_PRICES.wire10 + (rem > 0 ? rem * WIRE_PRICES.wire1 : 0);
    const label = rem > 0 ? "전원선 혼합형(10구+낱개)" : "전원선 10구(10.5m)";
    const countStr =
      rem > 0
        ? `10구 ${fmt(full10)}개 + 1구 ${fmt(rem)}개`
        : `10구 ${fmt(full10)}개`;
    return { label, countStr, cost };
  }

  // ===== 계산하기 =====
  function doCalculate() {
    if (!connectionType) {
      alert("먼저 연결 방식을 선택해주세요.");
      return;
    }
    if (!spec) {
      alert("먼저 규격(40/60)을 선택해주세요.");
      return;
    }
    if (!wireType) {
      alert("전원선 종류를 선택해주세요.");
      return;
    }

    let counts, pieces, linesSubtotal, linesArr;
    let bracketSets, bracketSubtotal;
    let sideCapSets = 0,
      sideCapSubtotal = 0;
    let coverPick,
      coverSubtotal = 0;
    let wireLabel = "",
      wireCountStr = "",
      wireSubtotal = 0;
    let lCornerLineUsed = false,
      lCornerCoverUsed = false,
      lCornerCoverPrice = 0;
    let lCornerCount = 0;

    if (connectionType === "serial") {
      // === 일자연결 ===
      const inputEl = document.getElementById("lengthInput");
      const L = inputEl && inputEl.value ? parseInt(inputEl.value, 10) : NaN;
      if (!isValidHundreds(L)) {
        alert("길이는 100 단위로 입력해주세요. (예: 100, 200, 300 …)");
        if (inputEl) inputEl.focus();
        return;
      }

      counts = decomposeLengthMM(L);
      if (!counts) {
        alert("분해에 실패했습니다. 다른 길이로 시도해주세요.");
        return;
      }

      linesSubtotal = linesPrice(spec, counts);
      pieces = countPieces(counts);

      bracketSets = pieces;
      bracketSubtotal = bracketSets * BRACKET_SET_PRICE;
      sideCapSets = 1;
      sideCapSubtotal = SIDE_CAP_SET_PRICE;

      const neededMeters = Math.ceil(L / 1000);
      coverPick = pickCoverPacks(neededMeters, spec);
      coverSubtotal = coverPick.subtotal;

      if (wireType === "wire1") {
        wireLabel = "전원선 1구(2m)";
        wireCountStr = `${fmt(pieces)}개`;
        wireSubtotal = pieces * WIRE_PRICES.wire1;
      } else if (wireType === "wire10") {
        wireLabel = "전원선 10구(10.5m)";
        const packs = Math.ceil(pieces / 10);
        wireCountStr = `${fmt(packs)}개`;
        wireSubtotal = packs * WIRE_PRICES.wire10;
      } else if (wireType === "mixed") {
        const mixed = calcWireMixed(pieces);
        wireLabel = mixed.label;
        wireCountStr = mixed.countStr;
        wireSubtotal = mixed.cost;
      }

      linesArr = countsToLines(spec, counts);

      renderOutput({
        spec,
        counts,
        linesArr,
        linesSubtotal,
        pieces,
        bracketSets,
        bracketSubtotal,
        sideCapSets,
        sideCapSubtotal,
        coverPick,
        wireLabel,
        wireCountStr,
        wireSubtotal,
        lCornerLineUsed,
        lCornerCoverUsed,
        lCornerCoverPrice,
        lCornerCount,
        L_serial: L,
      });
    } else if (connectionType === "parallel") {
      // === ㄱ자연결 ===
      const inputA = document.getElementById("lengthInputA");
      const inputB = document.getElementById("lengthInputB");
      const A = inputA && inputA.value ? parseInt(inputA.value, 10) : NaN;
      const B = inputB && inputB.value ? parseInt(inputB.value, 10) : NaN;

      if (!isValidHundreds(A)) {
        alert("A변 길이는 100 단위로 입력해주세요.");
        if (inputA) inputA.focus();
        return;
      }
      if (!isValidHundreds(B)) {
        alert("B변 길이는 100 단위로 입력해주세요.");
        if (inputB) inputB.focus();
        return;
      }

      const countsA = decomposeLengthMM(A);
      const countsB = decomposeLengthMM(B);
      if (!countsA || !countsB) {
        alert("분해에 실패했습니다. 다른 길이로 시도해주세요.");
        return;
      }

      counts = { 100: 0, 200: 0, 300: 0, 400: 0, 500: 0, 1000: 0 };
      [100, 200, 300, 400, 500, 1000].forEach((mm) => {
        counts[mm] = (countsA[mm] || 0) + (countsB[mm] || 0);
      });

      linesSubtotal = linesPrice(spec, counts) + L_CORNER_LINE_PRICE;
      pieces = countPieces(countsA) + countPieces(countsB) + 1;

      bracketSets = pieces;
      bracketSubtotal = bracketSets * BRACKET_SET_PRICE;

      sideCapSets = 1;
      sideCapSubtotal = SIDE_CAP_SET_PRICE;

      lCornerLineUsed = true;
      lCornerCoverUsed = true;
      lCornerCoverPrice = L_CORNER_COVER_PRICE[spec] || 0;
      lCornerCount = 1;

      const cornerAdd = 65; // ㄱ자연결은 65mm로 통일 (기존: L_CORNER_SIZE[spec])
      const totalCoverLen = A + B + 2 * cornerAdd;
      const straightCoverNeed = Math.max(0, totalCoverLen - 2000);
      const neededMeters = Math.ceil(straightCoverNeed / 1000);
      coverPick = pickCoverPacks(neededMeters, spec);
      coverSubtotal = coverPick.subtotal;

      if (wireType === "wire1") {
        wireLabel = "전원선 1구(2m)";
        wireCountStr = `${fmt(pieces)}개`;
        wireSubtotal = pieces * WIRE_PRICES.wire1;
      } else if (wireType === "wire10") {
        wireLabel = "전원선 10구(10.5m)";
        const packs = Math.ceil(pieces / 10);
        wireCountStr = `${fmt(packs)}개`;
        wireSubtotal = packs * WIRE_PRICES.wire10;
      } else if (wireType === "mixed") {
        const mixed = calcWireMixed(pieces);
        wireLabel = mixed.label;
        wireCountStr = mixed.countStr;
        wireSubtotal = mixed.cost;
      }

      linesArr = countsToLines(spec, counts);
      linesArr.unshift(`기역자형 × 1개`);

      renderOutput({
        spec,
        counts,
        linesArr,
        linesSubtotal,
        pieces,
        bracketSets,
        bracketSubtotal,
        sideCapSets,
        sideCapSubtotal,
        coverPick,
        wireLabel,
        wireCountStr,
        wireSubtotal,
        lCornerLineUsed,
        lCornerCoverUsed,
        lCornerCoverPrice,
        lCornerCount,
        L_serial: null,
        A_len: A,
        B_len: B,
      });
    } else if (connectionType === "square") {
      // === ㅁ자연결 ===
      const inputA = document.getElementById("lengthInputA");
      const inputB = document.getElementById("lengthInputB");
      const A = inputA && inputA.value ? parseInt(inputA.value, 10) : NaN;
      const B = inputB && inputB.value ? parseInt(inputB.value, 10) : NaN;

      if (!isValidHundreds(A)) {
        alert("A변 길이는 100 단위로 입력해주세요.");
        if (inputA) inputA.focus();
        return;
      }
      if (!isValidHundreds(B)) {
        alert("B변 길이는 100 단위로 입력해주세요.");
        if (inputB) inputB.focus();
        return;
      }

      const countsA = decomposeLengthMM(A);
      const countsB = decomposeLengthMM(B);
      if (!countsA || !countsB) {
        alert("분해에 실패했습니다. 다른 길이로 시도해주세요.");
        return;
      }

      // A변 2개 + B변 2개
      counts = { 100: 0, 200: 0, 300: 0, 400: 0, 500: 0, 1000: 0 };
      [100, 200, 300, 400, 500, 1000].forEach((mm) => {
        counts[mm] = (countsA[mm] || 0) * 2 + (countsB[mm] || 0) * 2;
      });

      // 기역자형 4개 추가
      linesSubtotal = linesPrice(spec, counts) + L_CORNER_LINE_PRICE * 4;
      pieces = (countPieces(countsA) + countPieces(countsB)) * 2 + 4;

      bracketSets = pieces;
      bracketSubtotal = bracketSets * BRACKET_SET_PRICE;

      // 사이드캡 제거 (ㅁ자연결은 사이드캡 없음)
      sideCapSets = 0;
      sideCapSubtotal = 0;

      lCornerLineUsed = true;
      lCornerCoverUsed = true;
      lCornerCoverPrice = L_CORNER_COVER_PRICE[spec] || 0;
      lCornerCount = 4; // 기역자형 4개

      // 커버 계산: 4개 모서리 * 2m = 8m 기본 제공, 나머지만 일반 커버
      const cornerAdd = L_CORNER_SIZE[spec] || 0;
      const totalCoverLen = (A + B) * 2 + 4 * 2 * cornerAdd;
      const straightCoverNeed = Math.max(0, totalCoverLen - 8000); // 8m 기본 제공
      const neededMeters = Math.ceil(straightCoverNeed / 1000);
      coverPick = pickCoverPacks(neededMeters, spec);
      coverSubtotal = coverPick.subtotal;

      if (wireType === "wire1") {
        wireLabel = "전원선 1구(2m)";
        wireCountStr = `${fmt(pieces)}개`;
        wireSubtotal = pieces * WIRE_PRICES.wire1;
      } else if (wireType === "wire10") {
        wireLabel = "전원선 10구(10.5m)";
        const packs = Math.ceil(pieces / 10);
        wireCountStr = `${fmt(packs)}개`;
        wireSubtotal = packs * WIRE_PRICES.wire10;
      } else if (wireType === "mixed") {
        const mixed = calcWireMixed(pieces);
        wireLabel = mixed.label;
        wireCountStr = mixed.countStr;
        wireSubtotal = mixed.cost;
      }

      linesArr = countsToLines(spec, counts);
      linesArr.unshift(`기역자형 × 4개`);

      renderOutput({
        spec,
        counts,
        linesArr,
        linesSubtotal,
        pieces,
        bracketSets,
        bracketSubtotal,
        sideCapSets,
        sideCapSubtotal,
        coverPick,
        wireLabel,
        wireCountStr,
        wireSubtotal,
        lCornerLineUsed,
        lCornerCoverUsed,
        lCornerCoverPrice,
        lCornerCount,
        L_serial: null,
        A_len: A,
        B_len: B,
        isSquare: true,
      });
    }
  }

  // ===== 공통 출력 =====
  function renderOutput(payload) {
    const {
      spec,
      counts,
      linesArr,
      linesSubtotal,
      pieces,
      bracketSets,
      bracketSubtotal,
      sideCapSets,
      sideCapSubtotal,
      coverPick,
      wireLabel,
      wireCountStr,
      wireSubtotal,
      lCornerLineUsed,
      lCornerCoverUsed,
      lCornerCoverPrice,
      lCornerCount,
      L_serial,
      A_len,
      B_len,
      C_len,
      D_len,
      isSquare,
    } = payload;

    // ⚡ 총 소비전력 계산 (기역자형 포함)
    const totalWatt = sumWatts(spec, counts) + lCornerCount * L_CORNER_WATT;

    let smpsCombo;
    const eff60 = Math.round(60 * LOAD_LIMIT);
    const eff100 = Math.round(100 * LOAD_LIMIT);
    const eff200 = Math.round(200 * LOAD_LIMIT);
    const eff300 = Math.round(300 * LOAD_LIMIT);

    if (totalWatt <= eff300) {
      let singleCap = 300;
      if (totalWatt <= eff60) singleCap = 60;
      else if (totalWatt <= eff100) singleCap = 100;
      else if (totalWatt <= eff200) singleCap = 200;
      else singleCap = 300;
      smpsCombo = buildComboFromItems([{ cap: singleCap, count: 1 }]);
    } else if (totalWatt <= eff200 * 2) {
      smpsCombo = buildComboFromItems([{ cap: 200, count: 2 }]);
    } else {
      const n300 = Math.max(2, Math.ceil(totalWatt / eff300));
      smpsCombo = buildComboFromItems([{ cap: 300, count: n300 }]);
    }

    const totalUnits = smpsCombo.items.reduce((s, it) => s + it.count, 0);
    let equalizeMsg = "";
    if (totalUnits >= 2) {
      equalizeMsg = `
          <div style="color:#c00; margin-top:6px; font-size:0.95em;">
            조명이 켜지는 속도, SMPS의 효율적인 시공을 위해 <strong>같은 와트수</strong>로 세팅해드립니다.
          </div>`;
    }

    const smpsSubtotal = smpsCombo.subtotal;

    const partsSubtotal =
      bracketSubtotal +
      sideCapSubtotal +
      (lCornerCoverUsed ? lCornerCoverPrice * lCornerCount : 0) +
      wireSubtotal +
      (coverPick ? coverPick.subtotal : 0);
    const grandTotal = linesSubtotal + partsSubtotal + smpsSubtotal;

    const linesListHtml_plain = `<div class="list-plain">${(linesArr.length
      ? linesArr
      : ["없음"]
    )
      .map((s) => `<span class="item">${s}</span>`)
      .join("")}</div>`;
    const usedLinesHtml = card(`
      <div class="rank-title rank-title--plain"><strong>사용한 라인조명</strong></div>
      ${linesListHtml_plain}
    `);

    const partsArr = [];
    if (bracketSets > 0)
      partsArr.push(`고정브라켓(스프링)[4개입] × ${fmt(bracketSets)}세트`);
    if (sideCapSets > 0)
      partsArr.push(`사이드캡[2개] × ${fmt(sideCapSets)}세트`);
    if (lCornerCoverUsed && lCornerCount > 0)
      partsArr.push(`기역자형 커버 1조(좌, 우 1m) × ${lCornerCount}개`);
    if (coverPick && coverPick.packs.length > 0) {
      coverPick.packs.forEach((p) => {
        partsArr.push(`커버 ${p.size}M × ${fmt(p.count)}개`);
      });
    }
    if (wireLabel && wireCountStr)
      partsArr.push(`${wireLabel} × ${wireCountStr}`);

    const partsListHtml_plain = `<div class="list-plain">${partsArr
      .map((s) => `<span class="item">${s}</span>`)
      .join("")}</div>`;
    const partsHtml = card(`
      <div class="rank-title rank-title--plain"><strong>필요 부속품</strong></div>
      ${partsListHtml_plain}
    `);

    const smpsCardHtml = card(
      renderSmpsCombo(totalWatt, smpsCombo, equalizeMsg),
    );

    const linesListHtml_muted = (linesArr.length ? linesArr : ["없음"])
      .map((s) => `<div class="muted">• ${s}</div>`)
      .join("");
    const partsListHtml_muted = partsArr
      .map((s) => `<div class="muted">• ${s}</div>`)
      .join("");
    const smpsItemsMuted =
      smpsCombo.items.length > 0
        ? smpsCombo.items
            .map(
              (it) =>
                `<div class="muted">• SMPS ${it.cap} W × ${fmt(
                  it.count,
                )}개</div>`,
            )
            .join("")
        : `<div class="muted">• 없음</div>`;

    const extraNotice = (function () {
      if (L_serial != null) {
        return `
      <div style="color:red; font-size:0.9em; margin-bottom:16px; padding: 12px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffc107;">
        <strong>📏 시공 안내</strong><br>
        수월한 시공을 위해 사이드캡 공간(양쪽 5mm, 총 10mm)을 고려하여 다음과 같이 설치 공간을 마련해 주세요.<br>
        입력하신 길이(${fmt(L_serial)}mm) + 10mm → <strong>${fmt(
          L_serial + 10,
        )}mm</strong>
      </div>`;
      }
      if (typeof A_len === "number" && typeof B_len === "number" && isSquare) {
        // ㅁ자연결
        const corner = String(spec) === "40" ? 45 : 65;
        const aTot = A_len + 2 * corner;
        const bTot = B_len + 2 * corner;
        return `
      <div style="color:red; font-size:0.9em; margin-bottom:16px; padding: 12px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffc107;">
        <strong>📏 시공 안내</strong><br>
        수월한 시공을 위해 기역자형 길이 ${corner}mm를 고려하여 다음과 같이 설치 공간을 마련해 주세요.<br>
        A변(2개): ${fmt(A_len)}mm + ${fmt(2 * corner)}mm → <strong>${fmt(
          aTot,
        )}mm</strong> 각각<br>
        B변(2개): ${fmt(B_len)}mm + ${fmt(2 * corner)}mm → <strong>${fmt(
          bTot,
        )}mm</strong> 각각
      </div>`;
      }
      if (typeof A_len === "number" && typeof B_len === "number") {
        // ㄱ자연결
        const add = 70; // 기역자 65mm + 사이드캡 5mm = 70mm
        const aTot = A_len + add;
        const bTot = B_len + add;
        const corner = 65;
        return `
      <div style="color:red; font-size:0.9em; margin-bottom:16px; padding: 12px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffc107;">
        <strong>📏 시공 안내</strong><br>
        수월한 시공을 위해 사이드캡 여유공간(각 변 5mm)과 기역자형 길이 65mm를 고려하여 다음과 같이 설치 공간을 마련해 주세요.<br>
        A변: ${fmt(A_len)}mm + ${fmt(add)}mm → <strong>${fmt(
          aTot,
        )}mm</strong><br>
        B변: ${fmt(B_len)}mm + ${fmt(add)}mm → <strong>${fmt(bTot)}mm</strong>
      </div>`;
      }
      return "";
    })();

    const totalsHtml = card(
      `
      <div>계(매립라인조명): ₩${fmt(linesSubtotal)}</div>
      ${linesListHtml_muted}

      <div style="margin-top:8px;">계(부속품): ₩${fmt(partsSubtotal)}</div>
      ${partsListHtml_muted}

      <div style="margin-top:8px;">계(SMPS): ₩${fmt(smpsSubtotal)}</div>
      ${smpsItemsMuted}

      <div class="total-line" style="margin-top:10px;"><strong>총가격:</strong> ₩${fmt(
        grandTotal,
      )}</div>
    `,
      "totals",
    );

    resultArea.innerHTML =
      extraNotice + usedLinesHtml + partsHtml + smpsCardHtml + totalsHtml;
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  calcBtn.addEventListener("click", doCalculate);

  document.addEventListener("keydown", (e) => {
    const active = document.activeElement;
    const isNumInput =
      active && active.tagName === "INPUT" && active.type === "number";
    const isSpecSelect =
      active &&
      active.tagName === "SELECT" &&
      (active.id === "specSelect" || active.id === "wiringSelect");
    if (e.key === "Enter" && (isNumInput || isSpecSelect)) {
      e.preventDefault();
      doCalculate();
    }
  });

  resetBtn.addEventListener("click", () => {
    connectionType = null;
    spec = null;
    wireType = null;

    chooser.style.display = "";
    connectionInfo.style.display = "none";
    lengthSection.style.display = "none";
    connectionTypeText.textContent = "-";
    specSelect.value = "";
    wiringSelect.value = "";
    lengthInputsArea.innerHTML = "";
    resultArea.innerHTML = "";

    // 모든 가이드 이미지 숨기기
    document.getElementById("specGuideImage").style.display = "none";
    document.getElementById("wireGuideImage").style.display = "none";
    document.getElementById("inputSampleImage").style.display = "none";

    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
