// QR 코드 생성기 (ISO/IEC 18004) — 전부 클라이언트(NFR-02), 외부 라이브러리 없음.
//
// 지원 범위: **바이트 모드(UTF-8)**, 오류정정 L/M/Q/H, **버전 1~6**(21×21 ~ 41×41).
// 버전 7 이상은 버전 정보 블록(18비트)이 추가로 필요해 의도적으로 제외했다 —
// 로컬 개발 서버 주소·URL 공유라는 실사용 목적에는 버전 6(최대 136바이트)으로 충분하다.
//
// 정확성 검증: 리드-솔로몬 부호어의 신드롬이 0인지( qr.test.js )로 수학적 정당성을 확인한다.

// ── GF(256) 산술 (원시 다항식 0x11D) ───────────────────────────

const gfExp = new Uint8Array(512);
const gfLog = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    gfExp[i] = x;
    gfLog[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) gfExp[i] = gfExp[i - 255];
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return gfExp[gfLog[a] + gfLog[b]];
}

/** 생성 다항식 g(x) = ∏(x - α^i), i=0..n-1 — 계수 배열(길이 n+1) */
function rsGenerator(n) {
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], gfExp[i]);
    }
    poly = next;
  }
  return poly;
}

/** 데이터 코드워드 → EC 코드워드 n개 */
function rsEncode(data, n) {
  const gen = rsGenerator(n);
  const remainder = new Array(n).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let i = 0; i < n; i++) {
        remainder[i] ^= gfMul(gen[i + 1], factor);
      }
    }
  }
  return remainder;
}

// ── 용량 테이블 (버전 1~6) ─────────────────────────────────────
// [ecPerBlock, group1Blocks, group1DataCount, group2Blocks, group2DataCount]

const CAPACITY = {
  1: { L: [7, 1, 19, 0, 0], M: [10, 1, 16, 0, 0], Q: [13, 1, 13, 0, 0], H: [17, 1, 9, 0, 0] },
  2: { L: [10, 1, 34, 0, 0], M: [16, 1, 28, 0, 0], Q: [22, 1, 22, 0, 0], H: [28, 1, 16, 0, 0] },
  3: { L: [15, 1, 55, 0, 0], M: [26, 1, 44, 0, 0], Q: [18, 2, 17, 0, 0], H: [22, 2, 13, 0, 0] },
  4: { L: [20, 1, 80, 0, 0], M: [18, 2, 32, 0, 0], Q: [26, 2, 24, 0, 0], H: [16, 4, 9, 0, 0] },
  5: { L: [26, 1, 108, 0, 0], M: [24, 2, 43, 0, 0], Q: [18, 2, 15, 2, 16], H: [22, 2, 11, 2, 12] },
  6: { L: [18, 2, 68, 0, 0], M: [16, 4, 27, 0, 0], Q: [24, 4, 19, 0, 0], H: [28, 4, 15, 0, 0] },
};

const MAX_VERSION = 6;
const ALIGN_CENTER = { 1: null, 2: 18, 3: 22, 4: 26, 5: 30, 6: 34 };
const EC_LEVEL_BITS = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

export const QR_ERROR_LEVELS = [
  { key: "L", label: "L (7% 복원)", hint: "가장 많이 담김" },
  { key: "M", label: "M (15% 복원)", hint: "일반적 선택" },
  { key: "Q", label: "Q (25% 복원)", hint: "인쇄물·야외" },
  { key: "H", label: "H (30% 복원)", hint: "로고 삽입·훼손 대비" },
];

function capacityOf(version, level = "M") {
  const [ecPerBlock, g1, g1n, g2, g2n] = CAPACITY[version][level];
  return {
    ecPerBlock,
    blocks: g1 + g2,
    group1Blocks: g1,
    group1Data: g1n,
    group2Blocks: g2,
    group2Data: g2n,
    dataCodewords: g1 * g1n + g2 * g2n,
  };
}

// ── 비트스트림 → 데이터 코드워드 ───────────────────────────────

function buildDataCodewords(text, version, level = "M") {
  const bytes = new TextEncoder().encode(text);
  const cap = capacityOf(version, level);

  const bits = [];
  const push = (value, length) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };

  push(0b0100, 4); // 바이트 모드
  push(bytes.length, 8); // 문자 수 지시자 (버전 1~9 바이트 모드는 8비트)
  for (const b of bytes) push(b, 8);

  // 종단자 0000 (남은 공간만큼만)
  const capacityBits = cap.dataCodewords * 8;
  for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
  // 바이트 경계 정렬
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
    codewords.push(v);
  }
  // 패딩 바이트 0xEC, 0x11 교대
  const PAD = [0xec, 0x11];
  let p = 0;
  while (codewords.length < cap.dataCodewords) codewords.push(PAD[p++ % 2]);

  return codewords;
}

/** 블록 분할 → RS → 인터리브 → 최종 코드워드 열 */
function buildFinalCodewords(dataCodewords, version, level) {
  const cap = capacityOf(version, level);
  const blocks = [];
  let cursor = 0;
  for (let i = 0; i < cap.group1Blocks; i++) {
    blocks.push(dataCodewords.slice(cursor, cursor + cap.group1Data));
    cursor += cap.group1Data;
  }
  for (let i = 0; i < cap.group2Blocks; i++) {
    blocks.push(dataCodewords.slice(cursor, cursor + cap.group2Data));
    cursor += cap.group2Data;
  }

  const ecBlocks = blocks.map((b) => rsEncode(b, cap.ecPerBlock));

  const out = [];
  const maxData = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const b of blocks) if (i < b.length) out.push(b[i]);
  }
  for (let i = 0; i < cap.ecPerBlock; i++) {
    for (const e of ecBlocks) out.push(e[i]);
  }
  return out;
}

// ── 매트릭스 구성 ──────────────────────────────────────────────

function placeFinder(matrix, reserved, row, col) {
  for (let i = -1; i <= 7; i++) {
    for (let j = -1; j <= 7; j++) {
      const r = row + i;
      const c = col + j;
      if (r < 0 || c < 0 || r >= matrix.length || c >= matrix.length) continue;
      const ring = Math.max(Math.abs(i - 3), Math.abs(j - 3));
      matrix[r][c] = i >= 0 && i <= 6 && j >= 0 && j <= 6 && ring !== 2 ? 1 : 0;
      reserved[r][c] = 1;
    }
  }
}

function placeAlignment(matrix, reserved, center) {
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      const ring = Math.max(Math.abs(i), Math.abs(j));
      matrix[center + i][center + j] = ring === 1 ? 0 : 1;
      reserved[center + i][center + j] = 1;
    }
  }
}

function buildBaseMatrix(version) {
  const size = version * 4 + 17;
  const matrix = Array.from({ length: size }, () => new Array(size).fill(0));
  const reserved = Array.from({ length: size }, () => new Array(size).fill(0));

  placeFinder(matrix, reserved, 0, 0);
  placeFinder(matrix, reserved, 0, size - 7);
  placeFinder(matrix, reserved, size - 7, 0);

  const center = ALIGN_CENTER[version];
  if (center) placeAlignment(matrix, reserved, center);

  // 타이밍 패턴 (6행 / 6열)
  for (let i = 8; i < size - 8; i++) {
    const v = i % 2 === 0 ? 1 : 0;
    matrix[6][i] = v;
    reserved[6][i] = 1;
    matrix[i][6] = v;
    reserved[i][6] = 1;
  }

  // 다크 모듈 (항상 1)
  matrix[4 * version + 9][8] = 1;
  reserved[4 * version + 9][8] = 1;

  // 포맷 정보 영역 예약
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      reserved[8][i] = 1;
      reserved[i][8] = 1;
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = 1;
    reserved[size - 1 - i][8] = 1;
  }

  return { matrix, reserved, size };
}

function placeData(matrix, reserved, codewords, size) {
  const bits = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1);
  }

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5; // 6열(타이밍)은 건너뛴다
    for (let step = 0; step < size; step++) {
      const row = upward ? size - 1 - step : step;
      for (let k = 0; k < 2; k++) {
        const col = right - k;
        if (reserved[row][col]) continue;
        matrix[row][col] = bitIndex < bits.length ? bits[bitIndex] : 0;
        bitIndex++;
      }
    }
    upward = !upward;
  }
}

const MASK_FN = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

function applyMask(matrix, reserved, maskIndex, size) {
  const out = matrix.map((row) => row.slice());
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (!reserved[i][j] && MASK_FN[maskIndex](i, j)) out[i][j] ^= 1;
    }
  }
  return out;
}

// 포맷 정보: 5비트(EC 2 + 마스크 3) + BCH(15,5), 최종 0x5412 로 XOR
function formatBits(level, maskIndex) {
  const data = (EC_LEVEL_BITS[level] << 3) | maskIndex;
  let value = data << 10;
  for (let i = 4; i >= 0; i--) {
    if ((value >> (i + 10)) & 1) value ^= 0x537 << i;
  }
  return ((data << 10) | value) ^ 0x5412;
}

function placeFormat(matrix, level, maskIndex, size) {
  const bits = formatBits(level, maskIndex);
  const bit = (i) => (bits >> i) & 1;

  for (let i = 0; i <= 5; i++) matrix[8][i] = bit(i);
  matrix[8][7] = bit(6);
  matrix[8][8] = bit(7);
  matrix[7][8] = bit(8);
  for (let i = 9; i <= 14; i++) matrix[14 - i][8] = bit(i);

  for (let i = 0; i <= 7; i++) matrix[size - 1 - i][8] = bit(i);
  for (let i = 8; i <= 14; i++) matrix[8][size - 15 + i] = bit(i);

  matrix[4 * ((size - 17) / 4) + 9][8] = 1; // 다크 모듈 복원
}

// ── 마스크 평가(penalty) — 규칙 1~4 ────────────────────────────

function penalty(matrix, size) {
  let score = 0;

  // 규칙 1: 같은 색 5개 이상 연속
  const scanLine = (get) => {
    let run = 1;
    for (let k = 1; k < size; k++) {
      if (get(k) === get(k - 1)) {
        run++;
      } else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    if (run >= 5) score += 3 + (run - 5);
  };
  for (let i = 0; i < size; i++) {
    scanLine((k) => matrix[i][k]);
    scanLine((k) => matrix[k][i]);
  }

  // 규칙 2: 2×2 동색 블록
  for (let i = 0; i < size - 1; i++) {
    for (let j = 0; j < size - 1; j++) {
      const v = matrix[i][j];
      if (v === matrix[i][j + 1] && v === matrix[i + 1][j] && v === matrix[i + 1][j + 1]) score += 3;
    }
  }

  // 규칙 3: 1:1:3:1:1 패턴 + 4모듈 여백
  const P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const matchAt = (get, start) => {
    let ok1 = true;
    let ok2 = true;
    for (let k = 0; k < 11; k++) {
      const v = get(start + k);
      if (v !== P1[k]) ok1 = false;
      if (v !== P2[k]) ok2 = false;
    }
    return ok1 || ok2;
  };
  for (let i = 0; i < size; i++) {
    for (let j = 0; j + 11 <= size; j++) {
      if (matchAt((k) => matrix[i][k], j)) score += 40;
      if (matchAt((k) => matrix[k][i], j)) score += 40;
    }
  }

  // 규칙 4: 어두운 모듈 비율의 50% 이탈
  let dark = 0;
  for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) dark += matrix[i][j];
  const percent = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return score;
}

// ── 공개 API ───────────────────────────────────────────────────

/**
 * QR 매트릭스를 만든다.
 * @returns { ok, matrix(0/1 2차원), size, version, level, byteLength } 또는 { ok:false, error }
 */
export function generateQr(text, { level = "M" } = {}) {
  const input = String(text ?? "");
  if (!input) return { ok: false, error: "내용을 입력해 주세요." };
  if (!CAPACITY[1][level]) return { ok: false, error: `알 수 없는 오류정정 레벨: ${level}` };

  const byteLength = new TextEncoder().encode(input).length;

  // 담을 수 있는 가장 작은 버전 선택
  let version = 0;
  for (let v = 1; v <= MAX_VERSION; v++) {
    // 모드(4) + 길이(8) + 데이터(8n) 비트가 들어가야 한다
    if (4 + 8 + byteLength * 8 <= capacityOf(v, level).dataCodewords * 8) {
      version = v;
      break;
    }
  }
  if (!version) {
    const max = capacityOf(MAX_VERSION, level).dataCodewords - 2;
    return {
      ok: false,
      error: `내용이 너무 깁니다. 오류정정 ${level} 기준 최대 ${max}바이트까지 담을 수 있습니다 (현재 ${byteLength}바이트). 레벨을 L 로 낮추거나 내용을 줄여 주세요.`,
    };
  }

  const dataCodewords = buildDataCodewords(input, version, level);
  const finalCodewords = buildFinalCodewords(dataCodewords, version, level);

  const { matrix, reserved, size } = buildBaseMatrix(version);
  placeData(matrix, reserved, finalCodewords, size);

  // 마스크 8종 중 penalty 최소를 고른다
  let best = null;
  for (let m = 0; m < 8; m++) {
    const candidate = applyMask(matrix, reserved, m, size);
    placeFormat(candidate, level, m, size);
    const score = penalty(candidate, size);
    if (!best || score < best.score) best = { matrix: candidate, score, mask: m };
  }

  return {
    ok: true,
    matrix: best.matrix,
    size,
    version,
    level,
    mask: best.mask,
    byteLength,
    capacity: capacityOf(version, level).dataCodewords - 2,
  };
}

/** 매트릭스 → SVG 문자열 (다운로드·복사용) */
export function toSvg(qr, { moduleSize = 8, quietZone = 4, dark = "#000000", light = "#ffffff" } = {}) {
  if (!qr || !qr.ok) return "";
  const total = (qr.size + quietZone * 2) * moduleSize;
  const rects = [];
  for (let i = 0; i < qr.size; i++) {
    for (let j = 0; j < qr.size; j++) {
      if (qr.matrix[i][j]) {
        const x = (j + quietZone) * moduleSize;
        const y = (i + quietZone) * moduleSize;
        rects.push(`<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}"/>`);
      }
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${total}" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">` +
    `<rect width="${total}" height="${total}" fill="${light}"/>` +
    `<g fill="${dark}">${rects.join("")}</g></svg>`
  );
}

// 테스트 전용 내부 노출
export const _internals = {
  gfExp,
  gfLog,
  gfMul,
  rsGenerator,
  rsEncode,
  buildDataCodewords,
  buildFinalCodewords,
  capacityOf,
};
