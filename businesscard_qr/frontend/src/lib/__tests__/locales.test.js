// 6개 언어 메시지 파일의 정합성. 한 언어에만 키를 추가하면 그 언어 사용자에게
// 영어가 섞여 나오거나 키 이름이 그대로 보인다. 그걸 빌드 전에 잡는다.
import { describe, it, expect } from "vitest";
import ko from "../../locales/ko.json";
import en from "../../locales/en.json";
import ja from "../../locales/ja.json";
import zh from "../../locales/zh.json";
import es from "../../locales/es.json";
import de from "../../locales/de.json";

const ALL = { ko, en, ja, zh, es, de };

/** 복수형 접미사(_one/_other)는 언어마다 필요한 게 달라서 기준 키로 묶는다. */
function baseKeys(messages) {
  return [...new Set(Object.keys(messages).map((k) => k.replace(/_(one|other)$/, "")))].sort();
}

function placeholders(text) {
  return [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("locales", () => {
  it("모든 언어가 같은 키를 갖는다 (한국어 기준)", () => {
    const expected = baseKeys(ko);
    for (const [lang, messages] of Object.entries(ALL)) {
      expect(baseKeys(messages), `${lang} 의 키가 한국어와 다르다`).toEqual(expected);
    }
  });

  it("빈 문장이 없다", () => {
    for (const [lang, messages] of Object.entries(ALL)) {
      for (const [key, value] of Object.entries(messages)) {
        expect(String(value).trim(), `${lang}.${key} 가 비어 있다`).not.toBe("");
      }
    }
  });

  it("자리표시자가 언어마다 같다 — 하나라도 빠지면 값이 안 들어간 문장이 나간다", () => {
    for (const key of Object.keys(ko)) {
      const expected = placeholders(ko[key]);
      for (const [lang, messages] of Object.entries(ALL)) {
        const actualKey = messages[key] !== undefined ? key : key.replace(/_other$/, "_one");
        if (messages[actualKey] === undefined) continue; // 복수형 변형은 위 테스트가 본다
        expect(placeholders(messages[actualKey]), `${lang}.${key}`).toEqual(expected);
      }
    }
  });

  it("복수형을 쓰는 키는 other 를 반드시 갖는다 — 모든 언어의 기본 형태다", () => {
    for (const [lang, messages] of Object.entries(ALL)) {
      for (const key of Object.keys(messages).filter((k) => k.endsWith("_one"))) {
        const other = key.replace(/_one$/, "_other");
        expect(messages[other], `${lang}.${other} 가 없다`).toBeDefined();
      }
    }
  });

  it("앱 이름 규칙: 한국어만 '명함QR', 나머지는 영문 브랜드명", () => {
    expect(ko.appTitle).toBe("명함QR");
    for (const lang of ["en", "ja", "zh", "es", "de"]) {
      expect(ALL[lang].appTitle, lang).toBe("Businesscard QR");
    }
  });
});
