// 문자열 이스케이프 계약 테스트 — 구현 전 선작성(Red).
import { describe, it, expect } from "vitest";
import { escapeText, unescapeText, ESCAPE_MODES } from "../escape.js";

describe("json", () => {
  it("따옴표·역슬래시·제어문자를 이스케이프한다", () => {
    expect(escapeText('그는 "안녕"\t이라 했다', "json")).toBe('그는 \\"안녕\\"\\t이라 했다');
    expect(escapeText("a\\b", "json")).toBe("a\\\\b");
    expect(escapeText("줄1\n줄2", "json")).toBe("줄1\\n줄2");
  });

  it("역변환된다", () => {
    expect(unescapeText('a\\"b\\n c', "json")).toBe('a"b\n c');
  });
});

describe("html", () => {
  it("HTML 특수문자를 엔티티로 바꾼다", () => {
    expect(escapeText('<a href="x">&</a>', "html")).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;"
    );
  });

  it("엔티티를 되돌린다", () => {
    // &nbsp; 는 U+00A0(줄바꿈 없는 공백)로 복원돼야 한다 — 일반 공백과 다른 문자다
    expect(unescapeText("&lt;b&gt;&amp;&#39;&nbsp;", "html")).toBe("<b>&'" + " ");
  });

  it("숫자 엔티티(10진·16진)를 되돌린다", () => {
    expect(unescapeText("&#65;&#x42;", "html")).toBe("AB");
  });
});

describe("sql", () => {
  it("작은따옴표를 두 번 쓴다", () => {
    expect(escapeText("O'Reilly", "sql")).toBe("O''Reilly");
  });

  it("역변환된다", () => {
    expect(unescapeText("O''Reilly", "sql")).toBe("O'Reilly");
  });
});

describe("regex", () => {
  it("정규식 메타문자를 이스케이프한다", () => {
    expect(escapeText("a.b*c?", "regex")).toBe("a\\.b\\*c\\?");
    expect(escapeText("(1+1)", "regex")).toBe("\\(1\\+1\\)");
  });

  it("이스케이프한 문자열은 리터럴로 매치된다", () => {
    const src = "1+1=2 (진짜?)";
    expect(new RegExp(escapeText(src, "regex")).test(src)).toBe(true);
  });
});

describe("unicode", () => {
  it("비ASCII 를 \\uXXXX 로 바꾼다", () => {
    expect(escapeText("한A", "unicode")).toBe("\\ud55cA");
  });

  it("역변환된다", () => {
    expect(unescapeText("\\ud55cA", "unicode")).toBe("한A");
  });
});

describe("모드 목록", () => {
  it("모든 모드가 라벨을 가진다", () => {
    expect(ESCAPE_MODES.length).toBeGreaterThanOrEqual(5);
    for (const m of ESCAPE_MODES) {
      expect(m.key).toBeTruthy();
      expect(m.label).toBeTruthy();
    }
  });

  it("모든 모드가 라운드트립한다", () => {
    const sample = `a"b'c<d>e&f\\g.h*i\n한글`;
    for (const m of ESCAPE_MODES) {
      expect(unescapeText(escapeText(sample, m.key), m.key)).toBe(sample);
    }
  });
});
