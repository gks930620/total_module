// 데이터 뷰어 계약 테스트 — 구현 전 선작성(Red).
//
// 뷰어는 "무슨 형식이든 읽어서 보기 좋게 눕힌다"가 전부다. 읽는 일은 변환기(lib/convert.js)가
// 이미 하므로 여기서는 **읽어낸 값을 화면이 그릴 수 있는 모양으로 바꾸는 것**만 책임진다.
import { describe, it, expect } from "vitest";
import { readData, flattenValue, toTableView, MAX_NODES, SAMPLES, INPUT_FORMATS } from "../dataView.js";

describe("readData — 무슨 형식이든 읽는다", () => {
  it("붙여넣은 형식을 알아본다", () => {
    expect(readData('{"a":1}').format).toBe("json");
    expect(readData("a: 1\nb: 2").format).toBe("yaml");
    expect(readData("id,name\n1,김철수").format).toBe("csv");
    expect(readData("id\tname\n1\t김철수").format).toBe("tsv");
    expect(readData("| a | b |\n|---|---|\n| 1 | 2 |").format).toBe("markdown");
  });

  it("형식을 지정하면 그대로 읽는다", () => {
    const r = readData("a: 1", "yaml");
    expect(r.ok).toBe(true);
    expect(r.value).toEqual({ a: 1 });
  });

  it("빈 입력은 조용히 비어 있다고 알린다", () => {
    const r = readData("   ");
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("깨진 입력은 이유를 알려 준다", () => {
    const r = readData("{ 이건 JSON 이 아니다", "json");
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("무엇인지 못 알아보면 그대로 말한다", () => {
    expect(readData("!@#$%^&*").ok).toBe(false);
  });
});

describe("flattenValue — 트리로 눕히기", () => {
  const value = { a: 1, nested: { x: "hi", arr: [1, 2] } };

  it("노드마다 깊이·키·종류·경로를 갖는다", () => {
    const flat = flattenValue(value);
    const root = flat[0];
    expect(root.depth).toBe(0);
    expect(root.kind).toBe("object");
    expect(root.path).toBe("$");

    const x = flat.find((n) => n.key === "x");
    expect(x.depth).toBe(2);
    expect(x.kind).toBe("string");
    expect(x.path).toBe("$.nested.x");
  });

  it("배열 경로는 대괄호로 적는다", () => {
    const flat = flattenValue(value);
    expect(flat.some((n) => n.path === "$.nested.arr[0]")).toBe(true);
  });

  it("컨테이너는 자식 수를 미리 보여 준다", () => {
    const flat = flattenValue({ arr: [1, 2, 3] });
    const arr = flat.find((n) => n.key === "arr");
    expect(arr.hasChildren).toBe(true);
    expect(arr.childCount).toBe(3);
    expect(arr.preview).toBe("[3]");
  });

  it("문자열 미리보기는 따옴표로 감싸 빈 값과 구분한다", () => {
    const flat = flattenValue({ s: "", n: null });
    expect(flat.find((n) => n.key === "s").preview).toBe('""');
    expect(flat.find((n) => n.key === "n").preview).toBe("null");
  });

  it("노드가 아주 많으면 잘라 내고 잘랐다고 알린다", () => {
    const big = Array.from({ length: MAX_NODES + 500 }, (_, i) => i);
    const flat = flattenValue(big);
    expect(flat.length).toBeLessThanOrEqual(MAX_NODES);
    expect(flat.truncated).toBe(true);
  });

  it("보통 크기에는 잘림 표시가 없다", () => {
    expect(flattenValue({ a: 1 }).truncated).toBe(false);
  });

  it("스칼라 하나도 노드 하나로 눕힌다", () => {
    const flat = flattenValue(42);
    expect(flat).toHaveLength(1);
    expect(flat[0].kind).toBe("number");
  });
});

describe("toTableView — 표로 볼 수 있는가", () => {
  it("객체 배열은 표가 된다", () => {
    const t = toTableView([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
    expect(t.ok).toBe(true);
    expect(t.header).toEqual(["a", "b"]);
    expect(t.rows).toHaveLength(2);
  });

  it("행마다 키가 달라도 열을 합친다", () => {
    const t = toTableView([{ a: 1 }, { b: 2 }]);
    expect(t.header).toEqual(["a", "b"]);
  });

  it("객체 하나는 한 행짜리 표다", () => {
    expect(toTableView({ a: 1 }).rows).toHaveLength(1);
  });

  it("중첩 값은 한 칸에 JSON 으로 담는다", () => {
    const t = toTableView([{ a: { x: 1 } }]);
    expect(t.rows[0][0]).toBe('{"x":1}');
  });

  it("표로 만들 수 없으면 이유와 함께 거절한다", () => {
    expect(toTableView(42).ok).toBe(false);
    expect(toTableView([1, 2, 3]).ok).toBe(true); // 원시값 배열은 한 열짜리 표
    expect(toTableView(42).reason).toBeTruthy();
  });

  it("NULL 은 빈 칸이 아니라 표시가 남는다", () => {
    const t = toTableView([{ a: null }]);
    expect(t.rows[0][0]).toBe(null);
  });
});

describe("SAMPLES — 형식마다 자기 예시가 있다", () => {
  it("읽을 수 있는 형식 전부에 예시가 있다", () => {
    for (const f of INPUT_FORMATS) {
      expect(SAMPLES[f.key], f.key).toBeTruthy();
    }
  });

  it("예시는 자기 형식으로 읽힌다 (예시 넣기가 형식과 어긋나면 안 된다)", () => {
    for (const [key, text] of Object.entries(SAMPLES)) {
      const r = readData(text);
      expect(r.ok, key).toBe(true);
      expect(r.format, key).toBe(key);
    }
  });

  it("예시는 지정한 형식으로도 읽힌다", () => {
    for (const [key, text] of Object.entries(SAMPLES)) {
      expect(readData(text, key).ok, key).toBe(true);
    }
  });
});
