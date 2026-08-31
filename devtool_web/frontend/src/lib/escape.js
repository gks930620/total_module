// 문자열 이스케이프/언이스케이프 — 전부 클라이언트(NFR-02).
// 코드에 문자열을 박아 넣을 때(JSON·SQL·HTML·정규식) 매번 손으로 하던 치환을 모아둔다.

const HTML_ENTITIES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

const HTML_REVERSE = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  // &nbsp; 는 일반 공백(U+0020)이 아니라 줄바꿈 없는 공백(U+00A0)이다.
  // 눈으로는 구분되지 않지만 문자열 비교·정규식에서 다르게 동작하므로 정확히 복원한다.
  nbsp: " ",
};

const JSON_ESCAPES = {
  "\\": "\\\\", '"': '\\"', "\b": "\\b", "\f": "\\f",
  "\n": "\\n", "\r": "\\r", "\t": "\\t",
};

const JSON_UNESCAPES = {
  "\\": "\\", '"': '"', "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t",
};

export const ESCAPE_MODES = [
  { key: "json", label: "JSON 문자열", hint: '" \\ 개행·탭을 \\" \\\\ \\n \\t 로' },
  { key: "html", label: "HTML 엔티티", hint: "< > & \" ' 를 엔티티로" },
  { key: "sql", label: "SQL 문자열", hint: "작은따옴표를 두 번(' → '')" },
  { key: "regex", label: "정규식 리터럴", hint: ". * + ? 등 메타문자 이스케이프" },
  { key: "unicode", label: "유니코드 \\u", hint: "비ASCII 를 \\uXXXX 로" },
  { key: "backslash", label: "역슬래시(개행만)", hint: "개행·탭만 \\n \\t 로" },
];

/** 이스케이프 */
export function escapeText(text, mode) {
  const s = String(text ?? "");
  switch (mode) {
    case "json":
      return s.replace(/[\\"\b\f\n\r\t]/g, (c) => JSON_ESCAPES[c]);

    case "html":
      return s.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);

    case "sql":
      return s.replace(/'/g, "''");

    case "regex":
      return s.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&");

    case "unicode":
      return Array.from(s)
        .map((ch) => {
          const cp = ch.codePointAt(0);
          if (cp < 128) return ch;
          // BMP 밖은 서로게이트 쌍 두 개로 표기(JS 문자열 리터럴 규약)
          return ch
            .split("")
            .map((u) => `\\u${u.charCodeAt(0).toString(16).padStart(4, "0")}`)
            .join("");
        })
        .join("");

    case "backslash":
      return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");

    default:
      return s;
  }
}

/** 언이스케이프 (escapeText 의 역변환) */
export function unescapeText(text, mode) {
  const s = String(text ?? "");
  switch (mode) {
    case "json":
      return s.replace(/\\u([0-9a-fA-F]{4})|\\(.)/g, (m, hex, ch) => {
        if (hex) return String.fromCharCode(parseInt(hex, 16));
        return JSON_UNESCAPES[ch] !== undefined ? JSON_UNESCAPES[ch] : ch;
      });

    case "html":
      return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body) => {
        if (body[0] === "#") {
          const code = body[1] === "x" || body[1] === "X"
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10);
          return Number.isNaN(code) ? m : String.fromCodePoint(code);
        }
        const v = HTML_REVERSE[body.toLowerCase()];
        return v === undefined ? m : v;
      });

    case "sql":
      return s.replace(/''/g, "'");

    case "regex":
      return s.replace(/\\([.*+?^${}()|[\]\\/-])/g, "$1");

    case "unicode":
      return s.replace(/\\u([0-9a-fA-F]{4})/g, (m, hex) => String.fromCharCode(parseInt(hex, 16)));

    case "backslash":
      return s.replace(/\\(.)/g, (m, ch) =>
        ({ n: "\n", r: "\r", t: "\t", "\\": "\\" })[ch] ?? ch
      );

    default:
      return s;
  }
}
