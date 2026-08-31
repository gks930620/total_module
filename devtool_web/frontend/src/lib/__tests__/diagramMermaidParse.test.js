// 우리가 만든 mermaid 텍스트를 **mermaid 진짜 파서**에 먹여 본다.
//
// 왜 따로 두나: diagramMermaid.test.js 는 문자열 모양만 본다. 그건 통과하는데
// mermaid 는 거부하는 경우가 실제로 있었다 —
// classDiagram 에 주석만 있으면 문법 오류인데(erDiagram 은 받아 준다) 문자열 단언으로는 안 걸렸다.
// "우리 기준으로 맞다" 와 "저쪽이 받아 준다" 는 다른 문제라서, 받는 쪽에 직접 물어본다.
//
// Node 에는 DOM 이 없어 DOMPurify 가 초기화되지 않는다. 렌더가 아니라 **문법**만 볼 것이므로
// 같은 모듈 인스턴스(ESM 캐시)에 no-op 을 채워 그 단계를 지나가게 한다.
// expect 대신 expectParses 가 직접 던진다 — 실패했을 때 생성된 텍스트를 줄번호와 함께 보여 주려고.
import { describe, it, beforeAll } from "vitest";
import { parseDdl, parseJavaSource } from "../diagram/parseCode.js";
import { toErMermaid, toClassMermaid } from "../diagram/toMermaid.js";
import { TEMPLATES } from "../diagram/templates.js";

let mermaid;

beforeAll(async () => {
  const DOMPurify = (await import("dompurify")).default;
  if (typeof DOMPurify.addHook !== "function") {
    DOMPurify.addHook = () => {};
    DOMPurify.removeHook = () => {};
    DOMPurify.removeAllHooks = () => {};
    DOMPurify.sanitize = (s) => String(s ?? "");
    DOMPurify.setConfig = () => {};
    DOMPurify.isSupported = true;
  }
  mermaid = (await import("mermaid")).default;
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
}, 60_000);

/** 통과하면 조용하고, 실패하면 생성된 텍스트를 줄번호와 함께 보여 준다 */
async function expectParses(text, what) {
  try {
    await mermaid.parse(text);
  } catch (e) {
    const numbered = text.split("\n").map((l, i) => `${String(i + 1).padStart(3)}| ${l}`).join("\n");
    throw new Error(`${what} 가 mermaid 문법을 통과하지 못했습니다.\n${e.message}\n\n${numbered}`);
  }
}

const SQL = `
  CREATE TABLE member (
    id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    memo TEXT,
    PRIMARY KEY (id)
  );
  CREATE TABLE orders (
    id BIGINT PRIMARY KEY,
    member_id BIGINT NOT NULL,
    amount DECIMAL(12,2),
    FOREIGN KEY (member_id) REFERENCES member(id)
  );
`;

const JAVA = `
  @Entity public class Member extends BaseEntity implements Serializable {
      @Id private Long id;
      @Column(nullable = false, unique = true) private String email;
      @OneToMany(mappedBy = "member") private List<Order> orders;
      public String getEmail() { return email; }
      protected void rename(String name) { }
  }
  @Entity public class Order implements Payable {
      @Id private Long id;
      @ManyToOne private Member member;
      private Status status;
      public void pay(long amount) { }
  }
  public interface Payable { void pay(long amount); }
  public enum Status { READY, PAID, CANCELLED }
  public record Point(int x, int y) {}
  public abstract class BaseEntity { protected LocalDateTime createdAt; }
`;

describe("만들어진 텍스트를 mermaid 가 받아 주는가", () => {
  it("DDL 로 만든 ERD", async () => {
    await expectParses(toErMermaid(parseDdl(SQL)), "ERD");
  });

  it("자바로 만든 클래스 다이어그램", async () => {
    await expectParses(toClassMermaid(parseJavaSource(JAVA)), "클래스 다이어그램");
  });

  // 빈 입력에서 문법 오류가 나면 화면에 빨간 오류가 먼저 보인다 — 아무것도 안 한 사람에게.
  it("빈 모델도 문법이 성립한다", async () => {
    await expectParses(toErMermaid({ entities: [], relations: [], warnings: [] }), "빈 ERD");
    await expectParses(toClassMermaid({ entities: [], relations: [], warnings: [] }), "빈 클래스 다이어그램");
  });

  it("mermaid 예약어를 이름으로 쓴 클래스", async () => {
    const m = { entities: [{ name: "class", kind: "class", fields: [], methods: [] }], relations: [], warnings: [] };
    await expectParses(toClassMermaid(m), "예약어 이름");
  });

  it("한글 테이블·컬럼", async () => {
    await expectParses(toErMermaid(parseDdl("CREATE TABLE 회원 (번호 INT PRIMARY KEY, 이름 VARCHAR(20));")), "한글 ERD");
  });

  it("중첩 제네릭과 패키지명이 붙은 타입", async () => {
    const m = {
      entities: [{
        name: "com.example.Member", kind: "class",
        fields: [{ name: "map", type: "Map<String, List<Order>>", visibility: "-" }], methods: [],
      }],
      relations: [], warnings: [],
    };
    await expectParses(toClassMermaid(m), "중첩 제네릭");
  });
});

// 화면에서 "예시 넣기" 를 누르면 들어가는 텍스트다. 이게 깨져 있으면 첫인상이 오류 화면이다.
describe("화면에 넣어 둔 예시가 전부 문법을 통과한다", () => {
  for (const t of TEMPLATES) {
    it(`${t.type} — ${t.name}`, async () => {
      await expectParses(t.text, `${t.type}/${t.name}`);
    });
  }
});
