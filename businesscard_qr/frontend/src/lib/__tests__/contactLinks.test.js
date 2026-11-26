// 명함의 연락처를 링크로 바꾸는 규칙 — 보안 경계다.
// 공개 명함(/c/:id)은 **남이 입력한 값**을 받는 사람의 브라우저에 링크로 보여준다.
// 웹사이트 칸에 javascript:... 를 넣으면 받는 사람 쪽에서 스크립트가 도는 저장형 XSS 가 된다.
import { describe, it, expect } from "vitest";
import { websiteHref, telHref, mailtoHref, mapHref } from "../contactLinks.js";

describe("websiteHref", () => {
  it("http/https 주소는 그대로 쓴다", () => {
    expect(websiteHref("https://example.com/a?b=1")).toBe("https://example.com/a?b=1");
    expect(websiteHref("http://example.com")).toBe("http://example.com/");
  });

  it("스킴 없이 적은 주소는 https 로 보완한다 — 명함엔 보통 'example.com' 처럼 적는다", () => {
    expect(websiteHref("example.com")).toBe("https://example.com/");
    expect(websiteHref("  www.example.com/path  ")).toBe("https://www.example.com/path");
  });

  it("javascript: 는 링크로 만들지 않는다 (저장형 XSS 차단)", () => {
    expect(websiteHref("javascript:alert(1)")).toBeNull();
    expect(websiteHref("JaVaScRiPt:alert(1)")).toBeNull();
    expect(websiteHref(" javascript:alert(1)")).toBeNull();
    expect(websiteHref("java\tscript:alert(1)")).toBeNull();
  });

  it("data:/vbscript:/file: 같은 다른 스킴도 막는다", () => {
    expect(websiteHref("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(websiteHref("vbscript:msgbox(1)")).toBeNull();
    expect(websiteHref("file:///etc/passwd")).toBeNull();
  });

  it("주소로 볼 수 없는 값은 링크로 만들지 않는다", () => {
    expect(websiteHref("")).toBeNull();
    expect(websiteHref(null)).toBeNull();
    expect(websiteHref("그냥 글자")).toBeNull();
  });
});

describe("telHref", () => {
  it("숫자·+·구분 기호만 남겨 tel: 링크를 만든다", () => {
    expect(telHref("010-1234-5678")).toBe("tel:010-1234-5678");
    expect(telHref("+82 10 1234 5678")).toBe("tel:+821012345678");
  });

  it("숫자가 없으면 링크로 만들지 않는다", () => {
    expect(telHref("연락주세요")).toBeNull();
    expect(telHref("")).toBeNull();
  });

  it("다른 스킴이 섞여 들어가지 않는다", () => {
    expect(telHref("javascript:alert(1)")).toBe("tel:1");
  });
});

describe("mailtoHref", () => {
  it("이메일 모양이면 mailto: 링크를 만든다", () => {
    expect(mailtoHref("me@example.com")).toBe("mailto:me@example.com");
  });

  it("헤더를 덧붙이는 문자(?, &, 줄바꿈)는 거절한다 — 메일 헤더 주입 차단", () => {
    expect(mailtoHref("me@example.com?bcc=victim@example.com")).toBeNull();
    expect(mailtoHref("me@example.com\nBcc: x@y.z")).toBeNull();
  });

  it("이메일 모양이 아니면 링크로 만들지 않는다", () => {
    expect(mailtoHref("not-an-email")).toBeNull();
  });
});

describe("mapHref", () => {
  it("한국어 사용자는 카카오맵, 나머지는 구글 지도로 연다", () => {
    expect(mapHref("서울 강남구", "ko")).toMatch(/^https:\/\/map\.kakao\.com\//);
    expect(mapHref("Berlin", "de")).toMatch(/^https:\/\/www\.google\.com\/maps\//);
  });

  it("주소는 인코딩해서 쿼리로만 넣는다", () => {
    expect(mapHref("a&b=c", "en")).toContain(encodeURIComponent("a&b=c"));
  });

  it("빈 주소는 링크로 만들지 않는다", () => {
    expect(mapHref("  ", "ko")).toBeNull();
  });
});
