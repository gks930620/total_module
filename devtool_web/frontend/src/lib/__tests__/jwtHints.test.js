// 서명이 맞지 않을 때 "무엇을 먼저 의심할지" 를 짚어 주는 진단 — 구현 전 선작성(Red).
//
// 왜 필요한가: 서명 실패의 상당수는 키 값이 틀린 게 아니라 **눈에 안 보이는 공백**이다.
// 환경변수·YAML·터미널에서 복사하면 앞뒤 공백이나 줄 끝 개행이 딸려 온다.
// 화면에는 똑같아 보이는데 서명은 완전히 달라진다. "서명이 맞지 않습니다" 만 띄우면
// 사용자는 키 자체를 의심하며 시간을 버린다.
//
// 중요: **값을 말없이 고쳐 주지 않는다.** 공백이 들어간 키가 진짜 키일 수도 있다.
// 알려만 주고 고칠지는 사용자가 정한다.
import { describe, it, expect } from "vitest";
import { inspectWhitespace, signatureHints } from "../jwt.js";

describe("inspectWhitespace — 눈에 안 보이는 공백 찾기", () => {
  it("공백이 없으면 has 가 false 다", () => {
    expect(inspectWhitespace("secret").has).toBe(false);
    expect(inspectWhitespace("").has).toBe(false);
    expect(inspectWhitespace(null).has).toBe(false);
  });

  it("앞 공백을 잡는다", () => {
    const r = inspectWhitespace(" secret");
    expect(r.has).toBe(true);
    expect(r.leading).toBe(true);
    expect(r.trailing).toBe(false);
  });

  it("뒤 공백을 잡는다", () => {
    const r = inspectWhitespace("secret ");
    expect(r.has).toBe(true);
    expect(r.trailing).toBe(true);
  });

  it("줄 끝 개행을 잡는다 — 파일에서 복사할 때 가장 흔하다", () => {
    const r = inspectWhitespace("secret\n");
    expect(r.has).toBe(true);
    expect(r.trailing).toBe(true);
    expect(r.newline).toBe(true);
  });

  it("가운데 공백을 앞뒤 공백과 구분한다", () => {
    const r = inspectWhitespace("my secret");
    expect(r.has).toBe(true);
    expect(r.inner).toBe(true);
    expect(r.leading).toBe(false);
    expect(r.trailing).toBe(false);
  });

  it("탭도 공백이다", () => {
    expect(inspectWhitespace("\tsecret").leading).toBe(true);
  });

  it("사람이 읽을 설명을 준다", () => {
    expect(inspectWhitespace(" secret ").label).toBeTruthy();
    expect(inspectWhitespace("secret").label).toBe("");
  });
});

describe("signatureHints — 서명 실패 시 먼저 볼 곳", () => {
  const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc";

  it("아무 이상이 없으면 빈 배열", () => {
    expect(signatureHints({ token: TOKEN, secret: "secret" })).toEqual([]);
  });

  it("비밀키 앞뒤 공백을 짚어 준다", () => {
    const hints = signatureHints({ token: TOKEN, secret: "secret " });
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.join(" ")).toContain("공백");
  });

  it("공백이 몇 글자인지 알려 준다 — 눈으로는 셀 수 없다", () => {
    const hints = signatureHints({ token: TOKEN, secret: "  secret" });
    expect(hints.join(" ")).toMatch(/2/);
  });

  it("토큰 안의 줄바꿈을 짚어 준다 — 붙여넣다 줄이 접힌 경우", () => {
    const hints = signatureHints({ token: "eyJhbGciOiJIUzI1NiJ9.\neyJzdWIiOiIxIn0.abc", secret: "secret" });
    expect(hints.join(" ")).toContain("토큰");
  });

  it("토큰 앞뒤 공백은 짚지 않는다 — 검증할 때 어차피 잘라내기 때문이다", () => {
    expect(signatureHints({ token: `  ${TOKEN}  `, secret: "secret" })).toEqual([]);
  });

  it("키가 base64 처럼 생겼는데 옵션이 꺼져 있으면 알려 준다", () => {
    // 서버가 Decoders.BASE64.decode(secret) 로 읽는 흔한 경우
    const hints = signatureHints({ token: TOKEN, secret: "c2VjcmV0LWtleS12YWx1ZQ==", secretIsBase64: false });
    // 화면 문구는 "Base64" 로 쓰므로 대소문자를 가리지 않는다
    expect(hints.join(" ").toLowerCase()).toContain("base64");
  });

  it("옵션이 켜져 있으면 base64 얘기를 또 하지 않는다", () => {
    const hints = signatureHints({ token: TOKEN, secret: "c2VjcmV0LWtleS12YWx1ZQ==", secretIsBase64: true });
    expect(hints.join(" ")).not.toContain("base64 로 읽어야");
  });

  it("공개키 PEM 에는 공백 경고를 하지 않는다 — 줄바꿈이 정상이다", () => {
    const pem = "-----BEGIN PUBLIC KEY-----\nMIIB\n-----END PUBLIC KEY-----\n";
    expect(signatureHints({ token: TOKEN, secret: pem })).toEqual([]);
  });
});
