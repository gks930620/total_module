// 프론트 ↔ 백엔드 계약. 필드 이름이 하나만 어긋나도 서버는 조용히 무시하거나(@JsonIgnoreProperties)
// "full_name은 필수입니다" 로 거절한다. 그런 어긋남을 빌드 단계에서 잡는다.
import { describe, it, expect } from "vitest";
import { toPayload, publicVcfUrl, KAKAO_LOGIN_URL } from "../api.js";

describe("toPayload", () => {
  it("서버 DTO(BusinessCardUpsertRequest)의 필드 이름으로 바꾼다", () => {
    expect(
      toPayload({
        fullName: "홍길동",
        phone: "010",
        email: "a@b.c",
        website: "a.com",
        organization: "회사",
        title: "팀장",
        address: "서울",
        note: "메모",
      }),
    ).toEqual({
      full_name: "홍길동",
      phone: "010",
      email: "a@b.c",
      website: "a.com",
      organization: "회사",
      title: "팀장",
      address: "서울",
      note: "메모",
    });
  });

  it("앞뒤 공백을 지우고, 빈 값은 아예 보내지 않는다", () => {
    expect(toPayload({ fullName: "  홍길동  ", phone: "   ", email: "" })).toEqual({ full_name: "홍길동" });
  });

  it("화면에만 있는 값(id 등)은 보내지 않는다 — 클라이언트가 id 를 정하면 남의 명함을 덮을 수 있다", () => {
    expect(toPayload({ fullName: "a", id: "x", userId: "y" })).toEqual({ full_name: "a" });
  });
});

describe("endpoint paths", () => {
  it("공개 vCard 는 토큰 없는 공개 경로다", () => {
    expect(publicVcfUrl("abc")).toBe("/api/business-cards/abc/public/vcf");
  });

  it("id 는 인코딩된다 — 경로 조작 차단", () => {
    expect(publicVcfUrl("../x")).toBe("/api/business-cards/..%2Fx/public/vcf");
  });

  it("로그인은 서버 OAuth 시작점으로 이동한다(브라우저에 키가 나가지 않는다)", () => {
    expect(KAKAO_LOGIN_URL).toBe("/api/auth/kakao/authorize");
  });
});
