import { describe, it, expect } from "vitest";
import { jsonToTypes, parseCurl, curlToCode } from "../codegen.js";

const SAMPLE = JSON.stringify({
  orderId: "ORD-1",
  totalPrice: 158000,
  paid: true,
  memo: null,
  customer: { name: "홍길동", grade: "GOLD" },
  items: [{ sku: "A-1", qty: 1, price: 89000.5 }],
});

describe("jsonToTypes — TypeScript", () => {
  it("중첩 객체를 별도 인터페이스로 뽑는다", () => {
    const r = jsonToTypes(SAMPLE, { lang: "ts" });
    expect(r.ok).toBe(true);
    expect(r.code).toContain("export interface Root {");
    expect(r.code).toContain("export interface Customer {");
    expect(r.typeNames).toContain("Customer");
  });

  it("기본 타입을 매핑한다", () => {
    const r = jsonToTypes(SAMPLE, { lang: "ts" });
    expect(r.code).toContain("orderId: string;");
    expect(r.code).toContain("totalPrice: number;");
    expect(r.code).toContain("paid: boolean;");
  });

  it("배열 원소 타입을 단수 이름으로 만든다", () => {
    const r = jsonToTypes(SAMPLE, { lang: "ts" });
    expect(r.typeNames).toContain("Item");
    expect(r.code).toContain("Item[]");
  });

  it("null 은 선택 필드(?)로 표시한다", () => {
    const r = jsonToTypes('{"memo":null,"name":"a"}', { lang: "ts" });
    expect(r.code).toMatch(/memo\??: (null|unknown)/);
  });

  it("같은 모양의 객체는 타입을 재사용한다", () => {
    const r = jsonToTypes('{"a":{"x":1},"b":{"x":2}}', { lang: "ts" });
    expect(r.typeCount).toBe(2); // Root + 공유 타입 1개
  });

  it("식별자로 못 쓰는 키는 따옴표로 감싼다", () => {
    const r = jsonToTypes('{"content-type":"json"}', { lang: "ts" });
    expect(r.code).toContain('"content-type"');
  });

  it("빈 배열은 unknown[] 로 둔다", () => {
    const r = jsonToTypes('{"list":[]}', { lang: "ts" });
    expect(r.code).toContain("unknown[]");
  });
});

describe("jsonToTypes — Java", () => {
  it("코드컨벤션대로 record 가 아니라 Lombok class 를 만든다", () => {
    const r = jsonToTypes(SAMPLE, { lang: "java" });
    expect(r.code).toContain("public class Root {");
    expect(r.code).toContain("@Getter");
    expect(r.code).not.toContain("record ");
  });

  it("래퍼 타입을 쓴다", () => {
    const r = jsonToTypes(SAMPLE, { lang: "java" });
    expect(r.code).toContain("private String orderId;");
    expect(r.code).toContain("private Integer totalPrice;");
    expect(r.code).toContain("private Boolean paid;");
  });

  it("스네이크 케이스 키는 camelCase 로 바꾸고 @JsonProperty 를 붙인다", () => {
    const r = jsonToTypes('{"user_name":"a"}', { lang: "java" });
    expect(r.code).toContain('@JsonProperty("user_name")');
    expect(r.code).toContain("private String userName;");
  });

  it("배열은 List<T>", () => {
    const r = jsonToTypes(SAMPLE, { lang: "java" });
    expect(r.code).toContain("List<Item>");
  });
});

describe("jsonToTypes — Java record", () => {
  it("record 선언을 만든다", () => {
    const r = jsonToTypes(SAMPLE, { lang: "record" });
    expect(r.ok).toBe(true);
    expect(r.code).toContain("public record Root(");
    expect(r.code).toContain(") {}");
    expect(r.code).not.toContain("@Getter");
    expect(r.code).not.toContain("private ");
  });

  it("컴포넌트는 타입 이름 순서다 (필드 선언이 아니다)", () => {
    const r = jsonToTypes(SAMPLE, { lang: "record" });
    expect(r.code).toContain("String orderId");
    expect(r.code).toContain("Integer totalPrice");
    expect(r.code).toContain("Boolean paid");
    expect(r.code).not.toContain("String orderId;");
  });

  it("중첩 객체는 별도 record 로 뽑는다", () => {
    const r = jsonToTypes(SAMPLE, { lang: "record" });
    expect(r.code).toContain("public record Customer(");
    expect(r.code).toContain("public record Item(");
    expect(r.code).toContain("List<Item> items");
  });

  it("컴포넌트는 쉼표로 잇고 마지막에는 안 붙인다", () => {
    const r = jsonToTypes('{"a":1,"b":"x"}', { lang: "record" });
    expect(r.code).toContain("Integer a,");
    expect(r.code).not.toMatch(/,\s*\)/);
  });

  it("스네이크 케이스 키는 camelCase 로 바꾸고 @JsonProperty 를 붙인다", () => {
    const r = jsonToTypes('{"user_name":"a"}', { lang: "record" });
    expect(r.code).toContain('@JsonProperty("user_name") String userName');
  });

  it("컴포넌트가 없는 객체도 유효한 record 다", () => {
    const r = jsonToTypes("{}", { lang: "record" });
    if (r.ok) expect(r.code).toContain("public record Root() {}");
  });

  it("Lombok class 출력은 그대로 남아 있다", () => {
    const cls = jsonToTypes(SAMPLE, { lang: "java" });
    expect(cls.code).toContain("public class Root {");
    expect(cls.code).not.toContain("record ");
  });
});

describe("jsonToTypes — Kotlin", () => {
  it("data class 를 만든다", () => {
    const r = jsonToTypes(SAMPLE, { lang: "kotlin" });
    expect(r.code).toContain("data class Root(");
    expect(r.code).toContain("val orderId: String");
  });
});

describe("jsonToTypes — 입력 검증", () => {
  it("깨진 JSON 은 사유를 준다", () => {
    const r = jsonToTypes("{");
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("JSON 파싱 실패");
  });
  it("스칼라는 거부한다", () => {
    expect(jsonToTypes('"문자열"').ok).toBe(false);
  });
});

describe("parseCurl", () => {
  it("기본 GET", () => {
    const r = parseCurl("curl https://api.example.com/users");
    expect(r.ok).toBe(true);
    expect(r.method).toBe("GET");
    expect(r.url).toBe("https://api.example.com/users");
  });

  it("헤더와 본문을 읽는다", () => {
    const r = parseCurl(`curl -X POST https://api.example.com/orders -H 'Content-Type: application/json' -H 'Authorization: Bearer abc' -d '{"id":1}'`);
    expect(r.method).toBe("POST");
    expect(r.headers["Content-Type"]).toBe("application/json");
    expect(r.headers.Authorization).toBe("Bearer abc");
    expect(r.body).toBe('{"id":1}');
  });

  it("-d 만 있으면 POST 로 본다", () => {
    expect(parseCurl(`curl https://a.com -d 'x=1'`).method).toBe("POST");
  });

  it("역슬래시 줄바꿈을 처리한다", () => {
    const r = parseCurl("curl https://a.com \\\n  -H 'X-Test: 1'");
    expect(r.headers["X-Test"]).toBe("1");
  });

  it("큰따옴표와 이스케이프를 처리한다", () => {
    const r = parseCurl(`curl https://a.com -d "{\\"k\\":\\"v\\"}"`);
    expect(r.body).toBe('{"k":"v"}');
  });

  it("-u 는 Basic 인증 헤더로 바꾼다", () => {
    const r = parseCurl("curl https://a.com -u user:pass");
    expect(r.headers.Authorization).toMatch(/^Basic /);
  });

  it("-F 는 폼 필드로 모은다", () => {
    const r = parseCurl("curl https://a.com -F 'name=hong' -F 'age=30'");
    expect(r.form).toHaveLength(2);
    expect(r.method).toBe("POST");
  });

  it("무시해도 되는 플래그를 건너뛴다", () => {
    const r = parseCurl("curl -sSL --compressed https://a.com");
    expect(r.url).toBe("https://a.com");
  });

  it("curl 로 시작하지 않으면 실패", () => {
    expect(parseCurl("wget https://a.com").ok).toBe(false);
    expect(parseCurl("").ok).toBe(false);
  });

  it("URL 이 없으면 실패", () => {
    expect(parseCurl("curl -X POST").ok).toBe(false);
  });
});

describe("curlToCode", () => {
  const parsed = parseCurl(`curl -X POST https://api.example.com/orders -H 'Content-Type: application/json' -d '{"id":1}'`);

  it("fetch 코드를 만든다", () => {
    const code = curlToCode(parsed, "fetch");
    expect(code).toContain("await fetch(");
    expect(code).toContain("method: 'POST'");
    expect(code).toContain("JSON.stringify({\"id\":1})");
  });

  it("axios 코드를 만든다", () => {
    const code = curlToCode(parsed, "axios");
    expect(code).toContain("await axios({");
    expect(code).toContain("method: 'post'");
  });

  it("Java HttpClient 코드를 만든다", () => {
    const code = curlToCode(parsed, "java");
    expect(code).toContain("HttpClient.newHttpClient()");
    expect(code).toContain('URI.create("https://api.example.com/orders")');
    expect(code).toContain('.header("Content-Type"');
  });

  it("Python requests 코드를 만든다", () => {
    const code = curlToCode(parsed, "python");
    expect(code).toContain("requests.post(");
    expect(code).toContain("json=payload");
  });

  it("GET 은 본문 없이 만든다", () => {
    const g = parseCurl("curl https://a.com");
    expect(curlToCode(g, "java")).toContain(".GET()");
    expect(curlToCode(g, "fetch")).not.toContain("body:");
  });

  it("파싱 실패면 빈 문자열", () => {
    expect(curlToCode({ ok: false }, "fetch")).toBe("");
  });
});
