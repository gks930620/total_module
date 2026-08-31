// 데이터 뷰어 — 붙여넣은 데이터를 화면이 그릴 수 있는 모양으로 눕힌다. 전부 클라이언트(NFR-02).
//
// 읽는 일은 변환기(lib/convert.js)가 이미 한다. 여기서 다시 파서를 쓰지 않는 이유는
// 형식이 하나 늘 때마다 두 곳을 고쳐야 하기 때문이다 — 뷰어는 읽어낸 **값**만 다룬다.

import { parseInput, detectFormat, INPUT_FORMATS } from "./convert.js";

export { INPUT_FORMATS };

/**
 * 트리에 눕힐 노드 수 상한.
 *
 * <p>워커 없이 메인 스레드에서 눕히므로 상한이 필요하다. 수십만 노드를 한 번에 만들면
 * 화면이 잠깐 멈춘다. 넘치면 잘라 내고 잘랐다고 알린다 — 조용히 일부만 보여 주면
 * 사용자는 데이터가 그것뿐인 줄 안다.
 */
export const MAX_NODES = 50000;

/**
 * 형식별 예시. "예시 넣기" 는 **지금 고른 형식**의 예시를 넣어야 한다 —
 * 무엇을 고르든 JSON 이 나오면 형식 선택이 무슨 뜻인지 알 수 없다.
 * 중첩이 있는 형식(JSON·YAML)은 트리로 접었다 펴는 맛이 나게, 표 형식은 표로 보이게 짰다.
 */
export const SAMPLES = {
  json: `{
  "order": "ORD-20260813-001",
  "customer": { "name": "김철수", "grade": "GOLD", "phone": null },
  "items": [
    { "sku": "A-1", "name": "무선 마우스", "qty": 2, "price": 29000 },
    { "sku": "B-7", "name": "기계식 키보드", "qty": 1, "price": 158000 }
  ],
  "paid": true,
  "총액": 216000
}`,
  yaml: `order: ORD-20260813-001
customer:
  name: 김철수
  grade: GOLD
  phone: null
items:
  - sku: A-1
    name: 무선 마우스
    qty: 2
    price: 29000
  - sku: B-7
    name: 기계식 키보드
    qty: 1
    price: 158000
paid: true
총액: 216000`,
  csv: `sku,name,qty,price
A-1,무선 마우스,2,29000
B-7,기계식 키보드,1,158000
C-3,모니터 암,1,74500`,
  // 탭은 이스케이프로 적는다 — 소스에 진짜 탭이 있으면 편집기가 공백으로 바꿔 놓기 쉽다
  tsv: [
    "sku\tname\tqty\tprice",
    "A-1\t무선 마우스\t2\t29000",
    "B-7\t기계식 키보드\t1\t158000",
    "C-3\t모니터 암\t1\t74500",
  ].join("\n"),
  markdown: `| sku | name          | qty | price  |
| --- | ------------- | --- | ------ |
| A-1 | 무선 마우스   | 2   | 29000  |
| B-7 | 기계식 키보드 | 1   | 158000 |
| C-3 | 모니터 암     | 1   | 74500  |`,
};

/** 붙여넣은 텍스트를 읽어 JS 값으로. format 을 주지 않으면 내용을 보고 알아낸다. */
export function readData(text, format) {
  const s = String(text ?? "");
  if (!s.trim()) return { ok: false, reason: "볼 데이터가 없습니다." };

  const guessed = format || detectFormat(s);
  if (!guessed) {
    return {
      ok: false,
      reason: "무슨 형식인지 알아보지 못했습니다. 위에서 직접 골라 주세요.",
      format: null,
    };
  }

  const r = parseInput(s, guessed, {});
  if (!r.ok) return { ok: false, reason: r.reason, format: guessed };
  return { ok: true, value: r.value, format: guessed, table: r.table };
}

function kindOf(v) {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

function scalarPreview(v, kind) {
  if (kind === "string") return JSON.stringify(v);
  if (kind === "null") return "null";
  return String(v);
}

/**
 * 값을 트리 행 배열로 눕힌다. 각 노드는
 * { id, depth, key, kind, hasChildren, childCount, preview, path }.
 *
 * <p>가상 스크롤이 보이는 행만 그리려면 "펼쳐진 전체 목록"이 배열로 있어야 한다.
 * 그래서 재귀 구조를 그대로 두지 않고 한 번 눕혀 둔다.
 */
export function flattenValue(root) {
  const flat = [];
  let id = 0;
  let truncated = false;

  const walk = (value, key, depth, path) => {
    if (flat.length >= MAX_NODES) { truncated = true; return; }

    const kind = kindOf(value);
    const isContainer = kind === "object" || kind === "array";
    let entries = null;
    let childCount = 0;

    if (kind === "array") {
      childCount = value.length;
      entries = value.map((v, i) => [i, v]);
    } else if (kind === "object") {
      const keys = Object.keys(value);
      childCount = keys.length;
      entries = keys.map((k) => [k, value[k]]);
    }

    flat.push({
      id: id++,
      depth,
      key,
      kind,
      hasChildren: isContainer && childCount > 0,
      childCount,
      preview: isContainer
        ? (kind === "array" ? `[${childCount}]` : `{${childCount}}`)
        : scalarPreview(value, kind),
      path,
    });

    if (entries) {
      for (const [k, v] of entries) {
        walk(v, k, depth + 1, kind === "array" ? `${path}[${k}]` : `${path}.${k}`);
      }
    }
  };

  walk(root, null, 0, "$");
  flat.truncated = truncated;
  return flat;
}

/**
 * 값을 표로. 표로 볼 수 있는 데이터(객체 배열·객체 하나·원시값 배열)일 때만 성공한다.
 * 셀은 원본 값 그대로 둔다 — 화면이 NULL 과 빈 문자열을 다르게 그릴 수 있어야 한다.
 */
export function toTableView(value) {
  if (Array.isArray(value)) {
    if (!value.length) return { ok: true, header: [], rows: [] };

    if (value.every((v) => v && typeof v === "object" && !Array.isArray(v))) {
      const header = [];
      for (const item of value) {
        for (const k of Object.keys(item)) if (!header.includes(k)) header.push(k);
      }
      const rows = value.map((item) => header.map((k) => cell(item[k])));
      return { ok: true, header, rows };
    }

    // 원시값 배열은 한 열짜리 표로 본다
    if (value.every((v) => v === null || typeof v !== "object")) {
      return { ok: true, header: ["value"], rows: value.map((v) => [cell(v)]) };
    }
    return { ok: false, reason: "배열 안의 모양이 제각각이라 표로 볼 수 없습니다. 트리로 보세요." };
  }

  if (value && typeof value === "object") {
    const header = Object.keys(value);
    return { ok: true, header, rows: [header.map((k) => cell(value[k]))] };
  }
  return { ok: false, reason: "표로 보려면 객체나 배열이어야 합니다. 지금은 값 하나뿐입니다." };
}

/** 표의 한 칸 — 중첩은 JSON 문자열로 눕히고, NULL 은 NULL 로 남긴다 */
function cell(v) {
  if (v === null || v === undefined) return null;
  return typeof v === "object" ? JSON.stringify(v) : v;
}
