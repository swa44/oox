(function () {
  // ===== 연결 방식 상태 =====
  // 'serial' | 'parallel'
  let connectionType = null;

  const chooser = document.getElementById('connectChooser');
  const pickSerialBtn = document.getElementById('pickSerial');
  const pickParallelBtn = document.getElementById('pickParallel');
  const calcArea = document.getElementById('calcArea');
  const connectionInfo = document.getElementById('connectionInfo');
  const connectionTypeText = document.getElementById('connectionTypeText');
  const lengthInputsArea = document.getElementById('lengthInputsArea');

  function renderLengthInputs() {
    if (connectionType === 'serial') {
      lengthInputsArea.innerHTML = `
              <label for="lengthInput">전체 길이 (mm)</label>
              <input
                type="number"
                id="lengthInput"
                placeholder="설치공간의 길이를 입력해주세요. (예: 2835)"
                min="1"
                step="1"
              />
            `;
    } else {
      lengthInputsArea.innerHTML = `
              <label for="lengthInputA">A변 길이 (mm)</label>
              <input
                type="number"
                id="lengthInputA"
                placeholder="설치공간의 길이를 입력해주세요. (예: 2835)"
                min="1"
                step="1"
              />
              <label for="lengthInputB">B변 길이 (mm)</label>
              <input
                type="number"
                id="lengthInputB"
                placeholder="설치공간의 길이를 입력해주세요. (예: 2835)"
                min="1"
                step="1"
              />
            `;
    }
  }

  function chooseConnection(type) {
    connectionType = type; // 'serial' or 'parallel'
    chooser.style.display = 'none';
    calcArea.style.display = '';
    connectionInfo.style.display = '';
    connectionTypeText.textContent =
      type === 'serial' ? '직렬연결' : '병렬연결';
    renderLengthInputs();
  }

  pickSerialBtn.addEventListener('click', () => chooseConnection('serial'));
  pickParallelBtn.addEventListener('click', () => chooseConnection('parallel'));

  // ===== 기본 데이터(12V 고유 규격/가격/남는공간) =====
  const sizes = [1000, 500, 400, 300, 200, 100, 50]; // mm

  // 블럭바 단가(12V 기존가 유지)
  const basePrices = {
    50: 1700,
    100: 1800,
    200: 2100,
    300: 2700,
    400: 3700,
    500: 4600,
    1000: 8800,
  };
  const MID_1000_PRICE = 10700; // 중간연결형 1000mm 단가

  // 소비전력(W)
  const watts = {
    50: 0.75,
    100: 1.5,
    200: 3,
    300: 4.5,
    400: 6,
    500: 7.5,
    1000: 15,
  };

  // 부속품 단가
  const ACC_PRICE_SCREW = 120; // 고정클립(피스형)/개
  const ACC_PRICE_TAPE = 200; // 고정클립(양면테이프형)/개
  const POWER_LINE_PRICE = 1450; // 전원 연결선 (2M)

  // 아크릴 커버 (1M 단위)
  const ACRYLIC_COVER_PRICE = 1600; // /1M

  // 코너각대 (1.2M 단위) 및 전용 클립
  const CORNER_ANGLE_PRICE = 2300; // /1.2M
  const CORNER_CLIP_PRICE = 120; // /개
  const CORNER_CLIP_PER_UNIT = 3; // 각대 1개당 3개

  // SMPS (W) 및 가격(12V 기존가 유지)
  const SMPS_OPTIONS = [60, 100, 200, 300];
  const SMPS_PRICES = { 60: 12800, 100: 21000, 200: 27000, 300: 29500 };
  const LOAD_LIMIT = 0.7; // 70%

  // 12V: 50mm 단위
  const unit = 50;

  // DOM
  const midChk = document.getElementById('midConnect');
  const coverChk = document.getElementById('acrylicCover');
  const cornerChk = document.getElementById('cornerAngle');
  const calcBtn = document.getElementById('calcBtn');
  const resetBtn = document.getElementById('resetBtn');
  const resultArea = document.getElementById('resultArea');

  function getNumberValue(id) {
    const el = document.getElementById(id);
    if (!el) return NaN;
    return parseInt(el.value, 10);
  }

  // 모달 DOM
  const lenModal = document.getElementById('lenModal');
  function openModal() {
    lenModal.setAttribute('aria-hidden', 'false');
    lenModal.classList.add('is-open');
  }
  function closeModal() {
    lenModal.setAttribute('aria-hidden', 'true');
    lenModal.classList.remove('is-open');
  }
  // 모달 닫기 (백드롭/버튼)
  lenModal.addEventListener('click', (e) => {
    if (e.target.matches('[data-close-modal]')) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lenModal.classList.contains('is-open')) {
      closeModal();
    }
  });

  // 상호 제어: 중간연결형 체크 시 코너각대 비활성화
  midChk.addEventListener('change', () => {
    cornerChk.disabled = midChk.checked;
    if (midChk.checked) cornerChk.checked = false;
  });

  // Enter로 계산 (동적 입력 대응)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const active = document.activeElement;
      if (active && active.tagName === 'INPUT' && active.type === 'number') {
        e.preventDefault();
        calculate();
      }
    }
  });
  calcBtn.addEventListener('click', calculate);

  // ===== 12V 남는공간 정책: 항상 50~99mm =====
  function pickUsedLen12V(totalLength) {
    if (totalLength < 50) return { used: 0, leftover: totalLength };
    const remainder = totalLength % unit; // 0~49
    const leftover = 50 + remainder; // 50~99
    const used = totalLength - leftover; // 사용 길이(50의 배수)
    return { used, leftover };
  }

  // DP 조합 -> counts 얻기 (50mm 단위)
  function dpDecompose(usedLen) {
    const usedUnits = Math.floor(usedLen / unit);
    const denomsUnits = sizes.map((s) => s / unit); // [20,10,8,6,4,2,1]
    const dp = Array(usedUnits + 1).fill(Infinity);
    const prev = Array(usedUnits + 1).fill(-1);
    const via = Array(usedUnits + 1).fill(-1);
    dp[0] = 0;

    for (let i = 1; i <= usedUnits; i++) {
      for (let j = 0; j < denomsUnits.length; j++) {
        const c = denomsUnits[j];
        if (i >= c && dp[i - c] + 1 < dp[i]) {
          dp[i] = dp[i - c] + 1;
          prev[i] = i - c;
          via[i] = j;
        }
      }
    }

    const counts = {};
    sizes.forEach((s) => (counts[s] = 0));
    if (usedUnits > 0 && dp[usedUnits] < Infinity) {
      let u = usedUnits;
      while (u > 0) {
        const j = via[u];
        if (j === -1) break;
        counts[sizes[j]] += 1;
        u = prev[u];
      }
    }
    return counts;
  }

  // counts -> 라인들 & 소계 (중간연결형 1000mm 1개 적용)
  function blockbarLinesAndSubtotal(counts, isMid) {
    let subtotal = 0;
    const lines = [];

    // 1000mm 처리
    if ((counts[1000] || 0) > 0 && isMid) {
      const midCnt = 1;
      const normCnt = counts[1000] - 1;

      const midPrice = midCnt * MID_1000_PRICE;
      subtotal += midPrice;
      lines.push(`중간연결형1000mm × ${midCnt}개 — ₩${fmt(midPrice)}`);

      if (normCnt > 0) {
        const normPrice = normCnt * basePrices[1000];
        subtotal += normPrice;
        lines.push(`1000mm × ${normCnt}개 — ₩${fmt(normPrice)}`);
      }
    } else if ((counts[1000] || 0) > 0) {
      const price = counts[1000] * basePrices[1000];
      subtotal += price;
      lines.push(`1000mm × ${counts[1000]}개 — ₩${fmt(price)}`);
    }

    // 나머지 규격(50~500mm)
    [500, 400, 300, 200, 100, 50].forEach((s) => {
      if ((counts[s] || 0) > 0) {
        const price = counts[s] * basePrices[s];
        subtotal += price;
        lines.push(`${s}mm × ${counts[s]}개 — ₩${fmt(price)}`);
      }
    });

    return { lines, subtotal };
  }

  function sumCounts(a, b) {
    const out = {};
    sizes.forEach((s) => (out[s] = (a[s] || 0) + (b[s] || 0)));
    return out;
  }

  function sumWatt(counts) {
    return sizes.reduce((w, s) => w + (counts[s] || 0) * (watts[s] || 0), 0);
  }

  function countsToSummaryText(counts) {
    const parts = [];
    [1000, 500, 400, 300, 200, 100, 50].forEach((s) => {
      const c = counts[s] || 0;
      if (c > 0) parts.push(`${s}mm × ${c}개`);
    });
    return parts.length ? parts.join(', ') : '없음';
  }

  function calculate() {
    const isMid = midChk.checked;
    const useCover = coverChk.checked;
    const useCorner = cornerChk.checked;

    if (!connectionType) {
      alert('먼저 연결 방식을 선택해주세요. (직렬연결 또는 병렬연결)');
      return;
    }

    // ===== 입력값 처리
    let totalLength = NaN;
    let lenA = NaN,
      lenB = NaN;

    if (connectionType === 'serial') {
      totalLength = getNumberValue('lengthInput');
      if (isNaN(totalLength) || totalLength <= 0) {
        alert('길이를 올바르게 입력해주세요.');
        return;
      }
      // 3M 초과(직렬 경고)
      if (totalLength > 3000) openModal();
    } else {
      lenA = getNumberValue('lengthInputA');
      lenB = getNumberValue('lengthInputB');
      if ([lenA, lenB].some((v) => isNaN(v) || v <= 0)) {
        alert('A변과 B변 길이를 모두 올바르게 입력해주세요.');
        return;
      }
      // ✅ 병렬에서도 A/B 중 하나라도 3000mm 초과 시 동일 팝업
      if (lenA > 3000 || lenB > 3000) openModal();
    }

    // ===== 사용 길이/남는공간 결정 (12V 규칙: 50~99mm 고정)
    let usedLen = 0,
      leftover = 0;
    let usedA = 0,
      leftA = 0,
      usedB = 0,
      leftB = 0;

    if (connectionType === 'serial') {
      const r = pickUsedLen12V(totalLength);
      usedLen = r.used;
      leftover = r.leftover;
    } else {
      const ra = pickUsedLen12V(lenA);
      const rb = pickUsedLen12V(lenB);
      usedA = ra.used;
      leftA = ra.leftover;
      usedB = rb.used;
      leftB = rb.leftover;
    }

    // ===== DP로 최소 개수 조합 (50 단위)
    let countsSerial = {};
    let countsA = {};
    let countsB = {};

    if (connectionType === 'serial') {
      countsSerial = dpDecompose(usedLen);
    } else {
      countsA = dpDecompose(usedA);
      countsB = dpDecompose(usedB);
    }

    // ===== 블럭바 소계/라인
    let blockbarSubtotal = 0;
    const usedLinesSerial = [];
    const usedLinesA = [];
    const usedLinesB = [];

    if (connectionType === 'serial') {
      const res = blockbarLinesAndSubtotal(countsSerial, isMid);
      blockbarSubtotal += res.subtotal;
      usedLinesSerial.push(...res.lines);
    } else {
      const resA = blockbarLinesAndSubtotal(countsA, isMid);
      const resB = blockbarLinesAndSubtotal(countsB, isMid);
      blockbarSubtotal += resA.subtotal + resB.subtotal;
      usedLinesA.push(...resA.lines);
      usedLinesB.push(...resB.lines);
    }

    // ===== 총 개수 (부속품 계산용)
    const totalsCounts =
      connectionType === 'serial' ? countsSerial : sumCounts(countsA, countsB);

    const totalPieces = Object.values(totalsCounts).reduce((a, b) => a + b, 0);

    // ===== 부속품 수량/소계 =====
    let screwClips = useCorner ? 0 : totalPieces * 2;

    // 병렬이면 -2, 직렬이면 -1 (최소 0 보정)
    let tapeClips;
    if (useCorner) {
      tapeClips = 0;
    } else {
      const minus = connectionType === 'parallel' ? 2 : 1;
      tapeClips = Math.max(totalPieces - minus, 0);
    }

    let accSubtotal = screwClips * ACC_PRICE_SCREW + tapeClips * ACC_PRICE_TAPE;

    // 전원 연결선 (중간연결형 미체크 시 자동 포함)
    let powerLineCount = 0;
    let powerLineSubtotal = 0;
    if (!isMid) {
      powerLineCount = connectionType === 'parallel' ? 2 : 1;
      powerLineSubtotal = powerLineCount * POWER_LINE_PRICE;
      accSubtotal += powerLineSubtotal;
    }

    // 아크릴 커버 (체크 시, 설치 길이 1,000mm 단위 올림)
    let coverCount = 0,
      coverSubtotal = 0;
    const coverBaseLen = connectionType === 'serial' ? usedLen : usedA + usedB;
    if (useCover && coverBaseLen > 0) {
      coverCount = Math.ceil(coverBaseLen / 1000);
      coverSubtotal = coverCount * ACRYLIC_COVER_PRICE;
      accSubtotal += coverSubtotal;
    }

    // 코너각대 (체크 시, 설치 길이 1,200mm 단위 올림) + 전용 클립
    let cornerCount = 0,
      cornerSubtotal = 0,
      cornerClipCount = 0,
      cornerClipSubtotal = 0;
    if (useCorner && coverBaseLen > 0) {
      cornerCount = Math.ceil(coverBaseLen / 1200);
      cornerSubtotal = cornerCount * CORNER_ANGLE_PRICE;
      cornerClipCount = cornerCount * CORNER_CLIP_PER_UNIT;
      cornerClipSubtotal = cornerClipCount * CORNER_CLIP_PRICE;
      accSubtotal += cornerSubtotal + cornerClipSubtotal;
    }

    // ===== 소비전력 & SMPS =====
    const totalWatt =
      connectionType === 'serial'
        ? sumWatt(countsSerial)
        : sumWatt(totalsCounts);

    // SMPS 선정(70% 규칙 내 최소)
    let recommended = null;
    for (const cap of SMPS_OPTIONS) {
      if (totalWatt <= cap * LOAD_LIMIT) {
        recommended = cap;
        break;
      }
    }

    // SMPS 소계
    let smpsSubtotal = 0;
    if (recommended !== null && totalWatt > 0)
      smpsSubtotal = SMPS_PRICES[recommended] || 0;

    // ===== 총 가격 =====
    const grandTotal = blockbarSubtotal + accSubtotal + smpsSubtotal;

    // ===== 출력 =====
    let html = '';

    if (connectionType === 'serial') {
      html += card(`
              <div class="rank-title">사용한 블럭바</div>
              <div class="muted" style="margin-bottom:6px;">
                설치길이 합계: ${fmt(usedLen)} mm / 남는공간: ${fmt(
        leftover
      )} mm
              </div>
              ${
                usedLinesSerial.length
                  ? usedLinesSerial.join('<br/>')
                  : '사용한 블럭바 없음'
              }
            `);
    } else {
      html += card(`
              <div class="rank-title">사용한 블럭바 (A변)</div>
              <div class="muted" style="margin-bottom:6px;">
                설치길이 합계: ${fmt(usedA)} mm / 남는공간: ${fmt(leftA)} mm
              </div>
              ${
                usedLinesA.length
                  ? usedLinesA.join('<br/>')
                  : '사용한 블럭바 없음'
              }
            `);

      html += card(`
              <div class="rank-title">사용한 블럭바 (B변)</div>
              <div class="muted" style="margin-bottom:6px;">
                설치길이 합계: ${fmt(usedB)} mm / 남는공간: ${fmt(leftB)} mm
              </div>
              ${
                usedLinesB.length
                  ? usedLinesB.join('<br/>')
                  : '사용한 블럭바 없음'
              }
            `);
    }

    html += card(renderSmps(totalWatt, recommended, smpsSubtotal));

    const partsLines = [];
    if (!useCorner) {
      const sc = screwClips;
      const tc = tapeClips;
      if (sc > 0)
        partsLines.push(
          `고정클립(피스형) × ${fmt(sc)}개 — ₩${fmt(sc * ACC_PRICE_SCREW)}`
        );
      if (tc > 0)
        partsLines.push(
          `고정클립(양면테이프형) × ${fmt(tc)}개 — ₩${fmt(tc * ACC_PRICE_TAPE)}`
        );
    }
    if (powerLineCount > 0) {
      partsLines.push(
        `전원 연결선 (2M) × ${fmt(powerLineCount)}개 — ₩${fmt(
          powerLineSubtotal
        )}`
      );
    }
    if (useCover && coverCount > 0) {
      partsLines.push(
        `아크릴 커버 (1M) × ${fmt(coverCount)}개 — ₩${fmt(coverSubtotal)}`
      );
    }
    if (useCorner && cornerCount > 0) {
      partsLines.push(
        `코너각대 (1.2M) × ${fmt(cornerCount)}개 — ₩${fmt(cornerSubtotal)}`
      );
      partsLines.push(
        `코너각대 고정클립 × ${fmt(cornerClipCount)}개 — ₩${fmt(
          cornerClipSubtotal
        )}`
      );
    }

    let partsHtml = `
            <div class="rank-title">필요 부속품</div>
            ${partsLines.length ? partsLines.join('<br/>') : '추가 부속품 없음'}
          `;
    if (useCorner) {
      partsHtml += `<div class="muted" style="margin-top:6px;">※ 코너각대 사용으로 기본 고정클립(피스/양면)은 포함되지 않습니다.</div>`;
    }
    html += card(partsHtml);

    const blockbarSummaryText =
      connectionType === 'serial'
        ? countsToSummaryText(countsSerial)
        : countsToSummaryText(totalsCounts);

    const accSummaryParts = [];
    if (!useCorner) {
      if (screwClips > 0)
        accSummaryParts.push(`고정클림(피스형) × ${fmt(screwClips)}개`);
      if (tapeClips > 0)
        accSummaryParts.push(`고정클림(양면테이프형) × ${fmt(tapeClips)}개`);
    }
    if (powerLineCount > 0)
      accSummaryParts.push(`전원연결선(2M) × ${fmt(powerLineCount)}개`);
    if (useCover && coverCount > 0)
      accSummaryParts.push(`아크릴커버(1M) × ${fmt(coverCount)}개`);
    if (useCorner && cornerCount > 0)
      accSummaryParts.push(
        `코너각대(1.2M) × ${fmt(cornerCount)}개, 코너각대 고정클립 × ${fmt(
          cornerClipCount
        )}개`
      );

    const smpsSummaryText =
      recommended !== null && totalWatt > 0
        ? `${recommended}W × 1대`
        : '해당 없음';

    html += card(
      `
            <div><strong>계(블럭바):</strong> ₩${fmt(blockbarSubtotal)}</div>
            <div class="muted">• ${blockbarSummaryText}</div>
            <div style="margin-top:6px;"><strong>계(부속품):</strong> ₩${fmt(
              accSubtotal
            )}</div>
            <div class="muted">• ${
              accSummaryParts.length ? accSummaryParts.join(', ') : '없음'
            }</div>
            <div style="margin-top:6px;"><strong>계(SMPS):</strong> ₩${fmt(
              smpsSubtotal
            )}</div>
            <div class="muted">• ${smpsSummaryText}</div>
            <div class="total-line" style="margin-top:10px;"><strong>총 가격:</strong> ₩${fmt(
              grandTotal
            )}</div>
          `,
      'totals'
    );

    resultArea.innerHTML = html;
  }

  function renderSmps(totalW, rec, smpsSubtotal) {
    let out = `<div class="rank-title">SMPS 권장</div>`;
    out += `<div>총 소비전력: ${totalW.toFixed(2)} W</div>`;
    if (totalW === 0) {
      out += `<div class="muted">블럭바가 없어 전원 공급 불필요</div>`;
    } else if (rec !== null) {
      const pct = (totalW / rec) * 100;
      out += `<div>권장 SMPS: ${rec} W (부하 ${pct.toFixed(
        1
      )}% / 70% 기준 충족)</div>`;
      out += `<div>권장 SMPS 가격: ₩${fmt(smpsSubtotal)}</div>`;
    } else {
      const maxCap = 300,
        limitW = (maxCap * 0.7).toFixed(1);
      out += `<div>권장 SMPS: 단일 SMPS로 70% 기준 충족 불가</div>`;
      out += `<div class="muted">총 소비전력 ${totalW.toFixed(
        2
      )} W → 300W × 70% = ${limitW} W 초과</div>`;
      out += `<div class="muted">옵션: ① 규격/수량 조정 ② SMPS 2대 이상 분산</div>`;
    }
    return out;
  }

  function card(inner, extraClass = '') {
    return `<div class="card ${extraClass}">${inner}</div>`;
  }
  function fmt(n) {
    return n.toLocaleString('ko-KR');
  }

  // ===== "처음으로" 버튼: 초기 화면으로 복귀 =====
  resetBtn.addEventListener('click', goHome);
  function goHome() {
    resultArea.innerHTML = '';
    lengthInputsArea.innerHTML = '';
    midChk.checked = false;
    coverChk.checked = false;
    cornerChk.checked = false;
    cornerChk.disabled = false;
    closeModal();
    connectionType = null;
    connectionTypeText.textContent = '-';
    connectionInfo.style.display = 'none';
    calcArea.style.display = 'none';
    chooser.style.display = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
})();
