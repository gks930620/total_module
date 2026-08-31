// 데이터 형식 변환 계약 테스트 — 구현 전 선작성(Red).
//
// JSON·YAML·CSV·TSV·마크다운 표를 읽어들여 그 중 아무 형식으로나 내보낸다.
// SQL INSERT 와 타입 코드(TS/Java/Kotlin)는 "내보내기 전용" 형식이다.
import { describe, it, expect } from "vitest";
import {
  INPUT_FORMATS, OUTPUT_FORMATS, convert, detectFormat,
} from "../convert.js";

const jsonRows = '[{"id":1,"name":"김철수"},{"id":2,"name":"이영희"}]';

describe("형식 목록", () => {
  it("읽을 수 있는 형식과 내보낼 수 있는 형식을 노출한다", () => {
    const inKeys = INPUT_FORMATS.map((f) => f.key);
    const outKeys = OUTPUT_FORMATS.map((f) => f.key);
    for (const k of ["json", "yaml", "csv", "tsv", "markdown"]) {
      expect(inKeys, `입력 ${k}`).toContain(k);
      expect(outKeys, `출력 ${k}`).toContain(k);
    }
    // 내보내기 전용
    for (const k of ["sql", "ts", "java", "kotlin"]) {
      expect(outKeys, `출력 ${k}`).toContain(k);
      expect(inKeys, `${k} 는 입력 형식이 아니다`).not.toContain(k);
    }
  });

  it("표 형태가 필요한 출력 형식은 그렇다고 표시한다", () => {
    const byKey = Object.fromEntries(OUTPUT_FORMATS.map((f) => [f.key, f]));
    expect(byKey.csv.needsTable).toBe(true);
    expect(byKey.markdown.needsTable).toBe(true);
    expect(byKey.sql.needsTable).toBe(true);
    expect(byKey.json.needsTable).toBeFalsy();
    expect(byKey.ts.needsTable).toBeFalsy();
  });
});

describe("detectFormat — 붙여넣은 걸 보고 형식을 짐작한다", () => {
  it("JSON", () => {
    expect(detectFormat('{"a":1}')).toBe("json");
    expect(detectFormat("[1,2,3]")).toBe("json");
  });
  it("마크다운 표", () => {
    expect(detectFormat("| a | b |\n|---|---|\n| 1 | 2 |")).toBe("markdown");
  });
  it("CSV / TSV", () => {
    expect(detectFormat("a,b,c\n1,2,3")).toBe("csv");
    expect(detectFormat("a\tb\tc\n1\t2\t3")).toBe("tsv");
  });
  it("YAML", () => {
    expect(detectFormat("name: 김철수\nage: 30")).toBe("yaml");
  });
  it("빈 입력은 null", () => {
    expect(detectFormat("")).toBeNull();
    expect(detectFormat("   ")).toBeNull();
  });
});

describe("convert — 같은 형식끼리 왕복", () => {
  it("JSON → YAML → JSON 이 값을 보존한다", () => {
    const y = convert(jsonRows, "json", "yaml");
    expect(y.ok).toBe(true);
    const back = convert(y.text, "yaml", "json");
    expect(back.ok).toBe(true);
    expect(JSON.parse(back.text)).toEqual(JSON.parse(jsonRows));
  });

  it("JSON → CSV → JSON 이 값을 보존한다", () => {
    const c = convert(jsonRows, "json", "csv");
    expect(c.ok).toBe(true);
    expect(c.text.split("\n")[0]).toBe("id,name");
    const back = convert(c.text, "csv", "json");
    expect(JSON.parse(back.text)).toEqual(JSON.parse(jsonRows));
  });

  it("CSV → 마크다운 표 → CSV 가 값을 보존한다", () => {
    const csv = "id,name\n1,김철수\n2,이영희";
    const md = convert(csv, "csv", "markdown");
    expect(md.ok).toBe(true);
    expect(md.text).toContain("|");
    const back = convert(md.text, "markdown", "csv");
    expect(back.text.replace(/\s*,\s*/g, ",")).toBe(csv);
  });
});

describe("convert — 지금까지 못 하던 조합", () => {
  it("CSV → YAML", () => {
    const r = convert("id,name\n1,김철수", "csv", "yaml");
    expect(r.ok).toBe(true);
    expect(r.text).toContain("김철수");
  });

  it("YAML → 마크다운 표", () => {
    const r = convert("- id: 1\n  name: 김철수\n- id: 2\n  name: 이영희", "yaml", "markdown");
    expect(r.ok).toBe(true);
    expect(r.text).toContain("| id");
  });

  it("CSV → TypeScript 타입", () => {
    const r = convert("id,name\n1,김철수", "csv", "ts");
    expect(r.ok).toBe(true);
    expect(r.text).toContain("interface");
    expect(r.text).toContain("name");
  });

  it("마크다운 표 → SQL INSERT", () => {
    const r = convert("| id | name |\n|---|---|\n| 1 | 김철수 |", "markdown", "sql", { table: "users" });
    expect(r.ok).toBe(true);
    expect(r.text).toContain("INSERT INTO `users`");
  });

  it("YAML → Java 클래스", () => {
    const r = convert("name: 김철수\nage: 30", "yaml", "java", { rootName: "Member" });
    expect(r.ok).toBe(true);
    expect(r.text).toContain("class Member");
  });
});

describe("convert — 표가 필요한 출력에 표가 아닌 값을 주면", () => {
  it("객체 하나를 CSV 로 내보내면 한 행짜리 표가 된다", () => {
    const r = convert('{"id":1,"name":"김철수"}', "json", "csv");
    expect(r.ok).toBe(true);
    expect(r.text.split("\n")).toHaveLength(2); // 헤더 + 1행
  });

  it("중첩이 깊어 표로 못 만들면 이유를 알려준다", () => {
    const r = convert('{"a":{"b":{"c":1}}}', "json", "sql");
    expect(r.ok).toBe(true); // 중첩 값은 JSON 문자열로 눕혀 담는다
    expect(r.text).toContain("INSERT INTO");
  });

  it("숫자 하나만 주면 표로 못 만든다고 한다", () => {
    const r = convert("123", "json", "csv");
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });
});

describe("convert — 실패 처리", () => {
  it("빈 입력", () => {
    expect(convert("", "json", "yaml").ok).toBe(false);
    expect(convert("   ", "json", "yaml").ok).toBe(false);
  });

  it("깨진 JSON 은 이유를 알려준다", () => {
    const r = convert("{ this is not json", "json", "yaml");
    expect(r.ok).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it("모르는 형식", () => {
    expect(convert("{}", "json", "없는형식").ok).toBe(false);
    expect(convert("{}", "없는형식", "json").ok).toBe(false);
  });

  it("어떤 입력에도 터지지 않는다", () => {
    const junk = ["{", "[[[", "| |", "a,b\n", "\t\t", "---", "null", "- - -"];
    for (const j of junk) {
      for (const to of OUTPUT_FORMATS.map((f) => f.key)) {
        expect(() => convert(j, "json", to), `${JSON.stringify(j)} → ${to}`).not.toThrow();
        expect(() => convert(j, "yaml", to)).not.toThrow();
        expect(() => convert(j, "csv", to)).not.toThrow();
        expect(() => convert(j, "markdown", to)).not.toThrow();
      }
    }
  });
});

describe("convert — 옵션", () => {
  it("JSON 들여쓰기를 고를 수 있다", () => {
    const two = convert(jsonRows, "json", "json", { indent: 2 });
    const four = convert(jsonRows, "json", "json", { indent: 4 });
    expect(four.text.split("\n")[1].match(/^ +/)[0].length)
      .toBeGreaterThan(two.text.split("\n")[1].match(/^ +/)[0].length);
  });

  it("JSON 을 한 줄로 압축할 수 있다", () => {
    const r = convert(jsonRows, "json", "json", { indent: 0 });
    expect(r.text).not.toContain("\n");
  });

  it("TSV 는 탭으로 구분한다", () => {
    const r = convert(jsonRows, "json", "tsv");
    expect(r.text.split("\n")[0]).toBe("id\tname");
  });

  it("SQL 테이블명을 지정할 수 있다", () => {
    const r = convert(jsonRows, "json", "sql", { table: "members" });
    expect(r.text).toContain("INSERT INTO `members`");
  });
});

describe("convert — JSON → SQL 전 과정", () => {
  const SAMPLE = JSON.stringify({ a: "d1", n: null, i: 30, KK: [{ c1: "d2" }] });

  it("사용자가 붙여넣은 모양 그대로 올바른 INSERT 가 나온다", () => {
    const r = convert(SAMPLE, "json", "sql", { table: "sample", dialect: "postgres" });
    expect(r.ok).toBe(true);
    expect(r.text).toBe(
      `INSERT INTO "sample" ("a", "n", "i", "KK") VALUES ('d1', NULL, 30, '[{"c1":"d2"}]');`
    );
  });

  it("중첩을 JSON 문자열로 넣었다는 사실을 알려 준다", () => {
    const r = convert(SAMPLE, "json", "sql", { table: "sample" });
    expect(r.notes?.join(" ")).toContain("KK");
  });

  it("중첩이 없으면 알림도 없다", () => {
    const r = convert('{"a":1}', "json", "sql", {});
    expect(r.notes ?? []).toHaveLength(0);
  });

  it("CSV·마크다운 출력에서도 같은 알림이 나온다", () => {
    for (const to of ["csv", "markdown"]) {
      expect(convert(SAMPLE, "json", to, {}).notes?.join(" "), to).toContain("KK");
    }
  });

  it("방언을 지정하지 않으면 MySQL 로 낸다", () => {
    expect(convert('{"a":1}', "json", "sql", { table: "t" }).text).toBe(
      "INSERT INTO `t` (`a`) VALUES (1);"
    );
  });
});

// ── 표·문서 형식이 자기가 만든 걸 다시 읽을 수 있는가 ──────
// 셀 안의 구분자를 그대로 흘리면 표 구조가 깨진다. 전수 점검에서 나온 것들.
describe("마크다운 표 — 셀 안의 특수문자", () => {
  it("셀 안의 파이프를 이스케이프한다 (안 하면 열이 늘어난다)", () => {
    const md = convert(JSON.stringify([{ a: "x|y", b: 1 }]), "json", "markdown", {}).text;
    const counts = md.trim().split("\n").map((l) => (l.match(/(?<!\\)\|/g) || []).length);
    expect(new Set(counts).size, md).toBe(1);
    expect(md).toContain("x\\|y");
  });

  it("셀 안의 줄바꿈을 <br> 로 바꾼다 (표는 한 줄이 한 행이다)", () => {
    const md = convert(JSON.stringify([{ a: "l1\nl2" }]), "json", "markdown", {}).text;
    expect(md.trim().split("\n")).toHaveLength(3);
    expect(md).toContain("<br>");
  });

  it("파이프·줄바꿈이 왕복한다", () => {
    for (const value of ["x|y", "l1\nl2", "a|b\nc|d"]) {
      const md = convert(JSON.stringify([{ v: value }]), "json", "markdown", {}).text;
      const back = convert(md, "markdown", "json", {});
      expect(back.ok, value).toBe(true);
      expect(JSON.parse(back.text)[0].v, value).toBe(value);
    }
  });
});

describe("YAML — 다시 읽을 수 있는 출력", () => {
  it("탭이 든 문자열을 인용한다 (YAML 은 탭을 싫어한다)", () => {
    const y = convert(JSON.stringify([{ v: "a\tb" }]), "json", "yaml", {}).text;
    const back = convert(y, "yaml", "json", {});
    expect(back.ok, y).toBe(true);
    expect(JSON.parse(back.text)[0].v).toBe("a\tb");
  });

  it("까다로운 문자열이 전부 왕복한다", () => {
    const values = ["a\tb", "key: value", "# c", "- item", "  앞뒤공백  ", "true", "123", "null", "[]", "{}", "@a", "&b", "*c", "|d", ">e", "%f", "`g"];
    for (const v of values) {
      const y = convert(JSON.stringify([{ v }]), "json", "yaml", {}).text;
      const back = convert(y, "yaml", "json", {});
      expect(back.ok, `${JSON.stringify(v)} → ${y}`).toBe(true);
      expect(JSON.parse(back.text)[0].v, JSON.stringify(v)).toBe(v);
    }
  });
});

describe("타입 코드 — 쓸 수 있는 식별자", () => {
  const weird = JSON.stringify([{ "2nd": 1, "user-name": "a", "a@b": true, "한글키": 1 }]);

  it("숫자로 시작하는 이름을 그대로 두지 않는다 (컴파일이 안 된다)", () => {
    for (const lang of ["java", "record", "kotlin"]) {
      const code = convert(weird, "json", lang, {}).text;
      expect(code, lang).not.toMatch(/\b2nd\b(?!")/);
    }
  });

  it("이름을 바꿨으면 원래 키를 애너테이션으로 남긴다", () => {
    const code = convert(weird, "json", "java", {}).text;
    expect(code).toContain('@JsonProperty("2nd")');
    expect(code).toContain('@JsonProperty("a@b")');
  });

  it("한글 필드명은 그대로 쓴다 (자바·코틀린 모두 유효한 식별자다)", () => {
    expect(convert(weird, "json", "java", {}).text).toContain("한글키");
  });

  it("TypeScript 는 따옴표로 감싸므로 키를 바꾸지 않는다", () => {
    const ts = convert(weird, "json", "ts", {}).text;
    expect(ts).toContain('"2nd"');
  });
});

describe("CSV — 앞뒤 공백 (RFC 4180)", () => {
  it("따옴표 안의 공백은 값의 일부다", () => {
    const r = convert('a,b\n"  x  ",1', "csv", "json", {});
    expect(JSON.parse(r.text)[0].a).toBe("  x  ");
  });

  it("따옴표 없는 칸은 다듬는다 (손으로 쓴 'a, b, c' 를 받아 주려고)", () => {
    const r = convert("a,b\n  x  ,1", "csv", "json", {});
    expect(JSON.parse(r.text)[0].a).toBe("x");
  });

  it("앞뒤 공백이 있는 값은 따옴표로 감싸 내보낸다", () => {
    const csv = convert(JSON.stringify([{ v: "  앞뒤공백  " }]), "json", "csv", {}).text;
    expect(csv).toContain('"  앞뒤공백  "');
  });

  it("공백이 왕복한다", () => {
    for (const value of ["  앞뒤공백  ", " x", "x ", "   "]) {
      const csv = convert(JSON.stringify([{ v: value }]), "json", "csv", {}).text;
      const back = convert(csv, "csv", "json", {});
      expect(back.ok, value).toBe(true);
      expect(JSON.parse(back.text)[0].v, JSON.stringify(value)).toBe(value);
    }
  });

  it("TSV 도 같다", () => {
    const tsv = convert(JSON.stringify([{ v: " x " }]), "json", "tsv", {}).text;
    expect(JSON.parse(convert(tsv, "tsv", "json", {}).text)[0].v).toBe(" x ");
  });
});
