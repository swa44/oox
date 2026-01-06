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

  // ===== 기본 데이터 (24V: 50mm 제외) =====
  const sizes = [1000, 500, 400, 300, 200, 100];

  // 블럭바 단가 (24V 최신가)
  const basePrices = {
    100: 4000,
    200: 5000,
    300: 6000,
    400: 7000,
    500: 8000,
    1000: 15900,
  };
  const MID_1000_PRICE = 17900; // 중간케이블형 1000

  // 소비전력(W)
  const watts = {
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

  // SMPS (W) 및 가격 (24V 최신가)
  const SMPS_OPTIONS = [60, 100, 200, 300];
  const SMPS_PRICES = { 60: 12800, 100: 24000, 200: 34000, 300: 38000 };
  const LOAD_LIMIT = 0.7; // 70%

  // 조합 단위: 100mm
  const unitDP = 100;

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

  // Enter로 계산
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

  // 남는공간 정책: 40~99 우선, 불가 시 100~140
  function pickUsedLenRounded(totalLength) {
    const rem100 = totalLength % 100;

    // 1) 40~99 그대로 가능한 경우
    if (rem100 >= 40 && rem100 <= 99) {
      return totalLength - rem100; // 100의 배수 사용
    }

    // 2) rem100 < 40 => 100을 더하면 100~139 범위 확보
    if (rem100 < 40) {
      return totalLength - (rem100 + 100);
    }

    // 3) rem100 >= 100 (안전장치)
    return Math.floor(totalLength / 100) * 100;
  }

  // DP 조합 -> counts 얻기
  function dpDecompose(usedLenRounded) {
    const usedUnits = Math.floor(usedLenRounded / unitDP);
    const denomsUnits = sizes.map((s) => s / unitDP); // [10,5,4,3,2,1]
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

  // counts -> 라인들 & 소계
  function blockbarLinesAndSubtotal(counts, isMid) {
    let subtotal = 0;
    const lines = [];

    // 1000mm 처리(중간케이블형 1개만 적용)
    if ((counts[1000] || 0) > 0 && isMid) {
      const midCnt = 1;
      const normCnt = counts[1000] - 1;

      const midPrice = midCnt * MID_1000_PRICE;
      subtotal += midPrice;
      lines.push(`중간케이블형1000mm × ${midCnt}개 — ₩${fmt(midPrice)}`);

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

    // 나머지 규격(100~500mm)
    [500, 400, 300, 200, 100].forEach((s) => {
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
    [1000, 500, 400, 300, 200, 100].forEach((s) => {
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
      // 5M 초과 시 모달
      if (totalLength > 5000) openModal();
    } else {
      lenA = getNumberValue('lengthInputA');
      lenB = getNumberValue('lengthInputB');
      if ([lenA, lenB].some((v) => isNaN(v) || v <= 0)) {
        alert('A변과 B변 길이를 모두 올바르게 입력해주세요.');
        return;
      }
    }

    // ===== 사용 길이/남는공간 결정 (100mm 단위 조합)
    let usedLenRounded = 0,
      displayLeftover = 0;
    let usedLenRoundedA = 0,
      usedLenRoundedB = 0,
      displayLeftoverA = 0,
      displayLeftoverB = 0;

    if (connectionType === 'serial') {
      usedLenRounded = pickUsedLenRounded(totalLength);
      if (usedLenRounded < 0) usedLenRounded = 0;
      displayLeftover = totalLength - usedLenRounded;
    } else {
      usedLenRoundedA = pickUsedLenRounded(lenA);
      usedLenRoundedB = pickUsedLenRounded(lenB);
      if (usedLenRoundedA < 0) usedLenRoundedA = 0;
      if (usedLenRoundedB < 0) usedLenRoundedB = 0;
      displayLeftoverA = lenA - usedLenRoundedA;
      displayLeftoverB = lenB - usedLenRoundedB;
    }

    // ===== DP로 최소 개수 조합 (100 단위)
    let countsSerial = {};
    let countsA = {};
    let countsB = {};

    if (connectionType === 'serial') {
      countsSerial = dpDecompose(usedLenRounded);
    } else {
      countsA = dpDecompose(usedLenRoundedA);
      countsB = dpDecompose(usedLenRoundedB);
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
    // 기본 클립 계산 (코너각대 사용 시 제외)
    let screwClips = useCorner ? 0 : totalPieces * 2;

    // 병렬이면 -2, 직렬이면 -1 (최소 0 보정)
    let tapeClips;
    if (useCorner) {
      tapeClips = 0;
    } else {
      const minus = connectionType === 'parallel' ? 2 : 1;
      tapeClips = Math.max(totalPieces - minus, 0);
    }

    // 부속 소계 시작값
    let accSubtotal = screwClips * ACC_PRICE_SCREW + tapeClips * ACC_PRICE_TAPE;

    // 전원 연결선 (중간연결형 미체크 시 자동 포함)
    let powerLineCount = 0;
    let powerLineSubtotal = 0;
    if (!isMid) {
      powerLineCount = connectionType === 'parallel' ? 2 : 1;
      powerLineSubtotal = powerLineCount * POWER_LINE_PRICE;
      accSubtotal += powerLineSubtotal;
    }

    // 아크릴 커버 (체크 시, 설치 길이 1,000mm 단위 올림) — 병렬이면 합계 기준
    let coverCount = 0,
      coverSubtotal = 0;
    const coverBaseLen =
      connectionType === 'serial'
        ? usedLenRounded
        : usedLenRoundedA + usedLenRoundedB;
    if (coverChk.checked && coverBaseLen > 0) {
      coverCount = Math.ceil(coverBaseLen / 1000);
      coverSubtotal = coverCount * ACRYLIC_COVER_PRICE;
      accSubtotal += coverSubtotal;
    }

    // 코너각대 (체크 시, 설치 길이 1,200mm 단위 올림) + 전용 클립 — 병렬이면 합계 기준
    let cornerCount = 0,
      cornerSubtotal = 0,
      cornerClipCount = 0,
      cornerClipSubtotal = 0;
    if (cornerChk.checked && coverBaseLen > 0) {
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

    // 사용한 블럭바 카드(직렬/병렬)
    if (connectionType === 'serial') {
      const usedLenTxt = usedLenRounded.toLocaleString('ko-KR');
      const leftoverTxt = displayLeftover.toLocaleString('ko-KR');
      html += card(`
              <div class="rank-title">사용한 블럭바</div>
              <div class="muted" style="margin-bottom:6px;">
                설치길이 합계: ${usedLenTxt} mm / 남는공간: ${leftoverTxt} mm
              </div>
              ${
                usedLinesSerial.length
                  ? usedLinesSerial.join('<br/>')
                  : '사용한 블럭바 없음'
              }
            `);
    } else {
      const usedLenTxtA = usedLenRoundedA.toLocaleString('ko-KR');
      const leftoverTxtA = displayLeftoverA.toLocaleString('ko-KR');
      const usedLenTxtB = usedLenRoundedB.toLocaleString('ko-KR');
      const leftoverTxtB = displayLeftoverB.toLocaleString('ko-KR');

      html += card(`
              <div class="rank-title">사용한 블럭바 (A변)</div>
              <div class="muted" style="margin-bottom:6px;">
                설치길이 합계: ${usedLenTxtA} mm / 남는공간: ${leftoverTxtA} mm
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
                설치길이 합계: ${usedLenTxtB} mm / 남는공간: ${leftoverTxtB} mm
              </div>
              ${
                usedLinesB.length
                  ? usedLinesB.join('<br/>')
                  : '사용한 블럭바 없음'
              }
            `);
    }

    // SMPS 권장
    html += card(renderSmps(totalWatt, recommended, smpsSubtotal));

    // 필요 부속품 카드
    const partsLines = [];
    if (!cornerChk.checked) {
      const sc = screwClips;
      const tc = tapeClips;
      partsLines.push(
        `고정클립(피스형) × ${fmt(sc)}개 — ₩${fmt(sc * ACC_PRICE_SCREW)}`
      );
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
    if (coverChk.checked && coverCount > 0) {
      partsLines.push(
        `아크릴 커버 (1M) × ${fmt(coverCount)}개 — ₩${fmt(coverSubtotal)}`
      );
    }
    if (cornerChk.checked && cornerCount > 0) {
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
    if (cornerChk.checked) {
      partsHtml += `<div class="muted" style="margin-top:6px;">※ 코너각대 사용으로 기본 고정클립(피스/양면)은 포함되지 않습니다.</div>`;
    }
    html += card(partsHtml);

    // 하단 소계 (각 카테고리 개수 요약 포함)
    const blockbarSummaryText =
      connectionType === 'serial'
        ? countsToSummaryText(countsSerial)
        : countsToSummaryText(totalsCounts);

    const accSummaryParts = [];
    if (!cornerChk.checked) {
      if (screwClips > 0)
        accSummaryParts.push(`고정클립(피스형) × ${fmt(screwClips)}개`);
      if (tapeClips > 0)
        accSummaryParts.push(`고정클립(양면테이프형) × ${fmt(tapeClips)}개`);
    }
    if (powerLineCount > 0)
      accSummaryParts.push(`전원연결선(2M) × ${fmt(powerLineCount)}개`);
    if (coverChk.checked && coverCount > 0)
      accSummaryParts.push(`아크릴커버(1M) × ${fmt(coverCount)}개`);
    if (cornerChk.checked && cornerCount > 0)
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
    // 입력/결과 초기화
    resultArea.innerHTML = '';
    lengthInputsArea.innerHTML = '';
    // 체크박스 초기화
    midChk.checked = false;
    coverChk.checked = false;
    cornerChk.checked = false;
    cornerChk.disabled = false;

    // 모달 닫기 (열려있을 수 있음)
    closeModal();

    // 상단 안내/선택 상태 초기화
    connectionType = null;
    connectionTypeText.textContent = '-';
    connectionInfo.style.display = 'none';

    // 화면 전환
    calcArea.style.display = 'none';
    chooser.style.display = '';

    // 맨 위로 이동
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
})();
