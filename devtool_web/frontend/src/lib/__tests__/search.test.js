// 도구 검색 — 구현 전 선작성(Red).
//
// 지금까지는 이름·요약·키워드에 대한 단순 부분일치였다. 도구가 51종이 되면서 두 가지가 문제다.
//
//   ① **개념으로 못 찾는다.** "인증" 을 친 사람은 JWT 를 찾는 건데 그 글자가 어디에도 없다.
//   ② **순위가 없다.** 태그를 늘리면 한 검색어에 열 개씩 걸리는데, 어느 게 진짜인지 알 수 없다.
//
// ①만 고치면 ②가 나빠진다. 그래서 태그와 점수를 함께 넣는다.
// 원칙: **이름에 맞은 것이 태그에 맞은 것보다 앞이다.**
import { describe, it, expect } from "vitest";
import { searchTools } from "../search.js";
import { TOOLS } from "../tools.js";

/** 결과에서 슬러그만 */
const slugs = (q) => searchTools(q).map((t) => t.slug);

describe("기본 동작", () => {
  it("빈 검색어면 전부 원래 순서로 돌려준다", () => {
    expect(searchTools("")).toHaveLength(TOOLS.length);
    expect(searchTools("   ")).toHaveLength(TOOLS.length);
    expect(searchTools(null)[0].slug).toBe(TOOLS[0].slug);
  });

  it("이름으로 찾는다", () => {
    expect(slugs("JWT")[0]).toBe("jwt");
  });

  it("슬러그로 찾는다", () => {
    expect(slugs("cidr")[0]).toBe("cidr");
  });

  it("대소문자를 가리지 않는다", () => {
    expect(slugs("jwt")[0]).toBe("jwt");
    expect(slugs("JwT")[0]).toBe("jwt");
  });

  it("걸리는 게 없으면 빈 배열", () => {
    expect(searchTools("존재하지않는말zzz")).toEqual([]);
  });
});

describe("개념으로 찾기 — 도구 이름을 몰라도 닿아야 한다", () => {
  // 이게 이번 작업의 핵심이다. 아래는 전부 "그 도구의 이름이 아닌 말" 이다.
  const cases = [
    ["인증", "jwt"],
    ["로그인", "jwt"],
    ["auth", "jwt"],
    ["비밀번호 저장", "hash"],
    ["개인정보", "image-privacy"],
    ["테스트 데이터", "dummy"],
    ["엑셀", "convert"],
    ["자소서", "char-count"],
    ["방화벽", "cidr"],
    ["db 설계", "erd"],
    ["uml", "class-diagram"],
    ["기본키", "uuid"],
    ["위치정보", "image-privacy"],
    ["포스트맨", "curl"],
  ];

  for (const [query, expected] of cases) {
    it(`"${query}" → ${expected}`, () => {
      expect(slugs(query)).toContain(expected);
    });
  }
});

describe("순위 — 태그를 늘려도 진짜가 앞에 와야 한다", () => {
  it("이름이 맞으면 태그만 맞은 것보다 앞이다", () => {
    const r = slugs("해시");
    expect(r[0]).toBe("hash");
  });

  it("도구 이름을 그대로 치면 그게 1등이다", () => {
    expect(slugs("QR")[0]).toBe("qr");
    expect(slugs("정규식")[0]).toBe("regex");
    expect(slugs("파비콘")[0]).toBe("favicon");
  });

  it("여러 개가 걸려도 결과가 지나치게 많지는 않다", () => {
    // 태그를 넉넉히 넣되 아무 데나 걸리게 두면 검색이 무의미해진다
    expect(slugs("인증").length).toBeLessThan(10);
  });

  // 개념어에서도 "그 개념의 대표 도구" 가 앞이어야 한다.
  // 시퀀스 다이어그램은 keywords 에 "인증 흐름도" 가 있어서 한때 JWT 를 제쳤다.
  it("개념어의 대표 도구가 곁다리보다 앞이다", () => {
    expect(slugs("인증")[0]).toBe("jwt");
    expect(slugs("개인정보")[0]).toBe("image-privacy");
    expect(slugs("계산")[0]).not.toBe("convert");
  });
});

describe("여러 낱말 — 모두 걸려야 한다(AND)", () => {
  it("낱말이 서로 다른 칸에 있어도 찾는다", () => {
    // "jwt" 는 이름에, "검증" 은 키워드/태그에 있다
    expect(slugs("jwt 검증")).toContain("jwt");
  });

  it("한 낱말이라도 없으면 안 나온다", () => {
    expect(slugs("jwt 파비콘")).not.toContain("jwt");
  });

  it("공백이 여러 개여도 된다", () => {
    expect(slugs("  jwt   검증  ")).toContain("jwt");
  });
});

describe("레지스트리 건강 상태", () => {
  it("모든 도구에 태그가 있다 — 하나라도 비면 그 도구는 개념 검색에서 사라진다", () => {
    for (const t of TOOLS) {
      expect(String(t.tags ?? "").trim(), `${t.slug} 의 tags`).not.toBe("");
    }
  });

  it("모든 도구는 자기 이름으로 검색됐을 때 1등이다", () => {
    for (const t of TOOLS) {
      const first = searchTools(t.name)[0];
      expect(first?.slug, `"${t.name}" 검색 1등`).toBe(t.slug);
    }
  });

  it("태그는 SEO 메타로 나가지 않는다 — keywords 와 다른 칸이다", () => {
    for (const t of TOOLS) {
      expect(t.keywords).not.toBe(t.tags);
    }
  });
});
