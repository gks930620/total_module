// 텍스트 diff — 전부 클라이언트(NFR-02).
// 줄 단위 LCS(최장 공통 부분수열)로 비교한다. 큰 입력에서 O(n·m) 메모리가 터지지 않도록
// 앞뒤 공통 구간을 먼저 잘라내고(대부분의 실제 diff 는 이걸로 크게 줄어든다) 상한을 둔다.

const MAX_LCS_CELLS = 4_000_000; // 약 2000×2000 줄

/** 비교 전 정규화 — 개행 통일 + 옵션(공백/대소문자 무시). */
export function normalizeForDiff(text, { ignoreWhitespace = false, ignoreCase = false } = {}) {
  let s = String(text ?? "").replace(/\r\n?/g, "\n");
  if (ignoreWhitespace) s = s.replace(/[ \t]+/g, " ").replace(/[ \t]+$/gm, "").trim();
  if (ignoreCase) s = s.toLowerCase();
  return s;
}

function lcsMatrix(a, b) {
  const m = a.length;
  const n = b.length;
  // (m+1)×(n+1) Uint32 테이블
  const table = new Uint32Array((m + 1) * (n + 1));
  const idx = (i, j) => i * (n + 1) + j;
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      table[idx(i, j)] =
        a[i] === b[j]
          ? table[idx(i + 1, j + 1)] + 1
          : Math.max(table[idx(i + 1, j)], table[idx(i, j + 1)]);
    }
  }
  return { table, idx };
}

/**
 * 줄 단위 diff.
 * 반환: [{ type: "=" | "+" | "-", text, leftNo, rightNo }]
 *   "=" 동일 / "+" 오른쪽에만 있음(추가) / "-" 왼쪽에만 있음(삭제)
 */
export function diffLines(leftText, rightText, options = {}) {
  const left = normalizeForDiff(leftText, options).split("\n");
  const right = normalizeForDiff(rightText, options).split("\n");

  const rows = [];
  let leftNo = 1;
  let rightNo = 1;

  // 앞쪽 공통 구간
  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) {
    rows.push({ type: "=", text: left[start], leftNo: leftNo++, rightNo: rightNo++ });
    start++;
  }

  // 뒤쪽 공통 구간
  let endL = left.length;
  let endR = right.length;
  const tail = [];
  while (endL > start && endR > start && left[endL - 1] === right[endR - 1]) {
    endL--;
    endR--;
    tail.unshift({ text: left[endL] });
  }

  const a = left.slice(start, endL);
  const b = right.slice(start, endR);

  if ((a.length + 1) * (b.length + 1) > MAX_LCS_CELLS) {
    // 너무 크면 정확한 LCS 대신 통삭제/통추가로 표시(브라우저 보호)
    for (const line of a) rows.push({ type: "-", text: line, leftNo: leftNo++, rightNo: null });
    for (const line of b) rows.push({ type: "+", text: line, leftNo: null, rightNo: rightNo++ });
  } else {
    const { table, idx } = lcsMatrix(a, b);
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) {
        rows.push({ type: "=", text: a[i], leftNo: leftNo++, rightNo: rightNo++ });
        i++;
        j++;
      } else if (table[idx(i + 1, j)] >= table[idx(i, j + 1)]) {
        rows.push({ type: "-", text: a[i], leftNo: leftNo++, rightNo: null });
        i++;
      } else {
        rows.push({ type: "+", text: b[j], leftNo: null, rightNo: rightNo++ });
        j++;
      }
    }
    while (i < a.length) rows.push({ type: "-", text: a[i++], leftNo: leftNo++, rightNo: null });
    while (j < b.length) rows.push({ type: "+", text: b[j++], leftNo: null, rightNo: rightNo++ });
  }

  for (const t of tail) {
    rows.push({ type: "=", text: t.text, leftNo: leftNo++, rightNo: rightNo++ });
  }
  return rows;
}

/** 추가·삭제·동일 줄 수 통계 */
export function diffStats(rows) {
  let added = 0;
  let removed = 0;
  let equal = 0;
  for (const r of rows) {
    if (r.type === "+") added++;
    else if (r.type === "-") removed++;
    else equal++;
  }
  return { added, removed, equal, changed: added + removed > 0 };
}

/**
 * 좌우 비교(IDE 의 "Compare With")용으로 줄을 짝지운다.
 *
 * <p>{@link diffLines} 는 삭제와 추가를 따로 늘어놓는다(unified diff). 그대로 두 칸에 나누면
 * 같은 자리에서 바뀐 줄이 서로 다른 높이에 놓여 무엇이 무엇으로 바뀌었는지 안 보인다.
 * 그래서 이어진 삭제 묶음과 추가 묶음을 순서대로 마주 붙인다.
 *
 * 반환: [{ type: "=" | "~" | "-" | "+", left, right }]
 *   "=" 양쪽 같음 / "~" 바뀜(양쪽 다 있음) / "-" 왼쪽만 / "+" 오른쪽만
 *   left·right 는 diffLines 의 행 그대로이고, 비는 쪽은 null 이다.
 */
export function toSideBySide(rows) {
  const out = [];
  let i = 0;
  while (i < rows.length) {
    if (rows[i].type === "=") {
      out.push({ type: "=", left: rows[i], right: rows[i] });
      i++;
      continue;
    }
    const dels = [];
    const adds = [];
    while (i < rows.length && rows[i].type === "-") dels.push(rows[i++]);
    while (i < rows.length && rows[i].type === "+") adds.push(rows[i++]);
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k++) {
      const left = dels[k] ?? null;
      const right = adds[k] ?? null;
      out.push({ type: left && right ? "~" : left ? "-" : "+", left, right });
    }
  }
  return out;
}
