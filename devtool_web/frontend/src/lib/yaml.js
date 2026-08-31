// JSON ↔ YAML 상호 변환 — 전부 클라이언트(NFR-02), 외부 라이브러리 없음(NFR-04 경량화).
//
// 지원 범위(실무에서 쓰는 부분집합): 매핑·시퀀스·스칼라·중첩 들여쓰기·따옴표 문자열·
// flow 표기([1,2] / {a:1})·주석(#)·문서 구분자(---)·블록 스칼라(| , |- , > , >-).
// 미지원: 앵커/별칭(&, *), 태그(!!), 복합 키(?), 멀티 문서(첫 문서만 사용).

// ── JSON → YAML ────────────────────────────────────────────────

// 따옴표 없이 써도 안전한 문자열인지. 숫자/불리언/null 처럼 보이면 따옴표가 필요하다
// (안 그러면 되읽을 때 타입이 바뀐다).
function needsQuote(s) {
  if (s === "") return true;
  if (/^[\s]|[\s]$/.test(s)) return true; // 앞뒤 공백
  if (/[:#\-?,[\]{}&*!|>'"%@`]/.test(s.slice(0, 1))) return true; // 첫 글자가 지시문자
  if (/:\s|\s#/.test(s)) return true; // "key: value" 로 오해되는 형태
  if (/^(true|false|null|yes|no|on|off|~)$/i.test(s)) return true;
  // 탭·제어문자가 그대로 나가면 우리가 만든 YAML 을 우리가 못 읽는다(줄바꿈은 블록 스칼라가 맡는다).
  // 제어문자를 찾는 것이 목적이라 규칙을 끈다 — \n 은 일부러 뺐다.
  // eslint-disable-next-line no-control-regex
  if (/[\t\r\x00-\x08\x0b\x0c\x0e-\x1f]/.test(s)) return true;
  if (/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s)) return true; // 숫자로 보임
  return false;
}

function quote(s) {
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\t/g, "\\t")
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n");
  return `"${escaped}"`;
}

function scalarToYaml(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : quote(String(v));
  const s = String(v);
  return needsQuote(s) ? quote(s) : s;
}

function isScalar(v) {
  return v === null || v === undefined || typeof v !== "object";
}

const INDENT = "  ";

function emit(value, depth, lines) {
  const pad = INDENT.repeat(depth);

  if (Array.isArray(value)) {
    if (value.length === 0) return; // 호출부에서 [] 처리
    for (const item of value) {
      if (isScalar(item)) {
        lines.push(`${pad}- ${scalarToYaml(item)}`);
      } else if (Array.isArray(item)) {
        if (item.length === 0) {
          lines.push(`${pad}- []`);
        } else {
          lines.push(`${pad}-`);
          emit(item, depth + 1, lines);
        }
      } else {
        // 객체 항목: 첫 키를 "- " 뒤에 붙이고 나머지는 같은 깊이로
        const keys = Object.keys(item);
        if (keys.length === 0) {
          lines.push(`${pad}- {}`);
          continue;
        }
        const sub = [];
        emit(item, depth + 1, sub);
        sub[0] = `${pad}- ${sub[0].slice((depth + 1) * INDENT.length)}`;
        lines.push(...sub);
      }
    }
    return;
  }

  // 객체
  for (const [k, v] of Object.entries(value)) {
    const key = needsQuote(k) ? quote(k) : k;
    if (typeof v === "string" && v.includes("\n")) {
      // 여러 줄 문자열 → 블록 스칼라(끝 개행 보존 안 함 = |-)
      lines.push(`${pad}${key}: |-`);
      for (const line of v.split("\n")) lines.push(`${pad}${INDENT}${line}`);
    } else if (isScalar(v)) {
      lines.push(`${pad}${key}: ${scalarToYaml(v)}`);
    } else if (Array.isArray(v)) {
      if (v.length === 0) lines.push(`${pad}${key}: []`);
      else {
        lines.push(`${pad}${key}:`);
        emit(v, depth + 1, lines);
      }
    } else {
      if (Object.keys(v).length === 0) lines.push(`${pad}${key}: {}`);
      else {
        lines.push(`${pad}${key}:`);
        emit(v, depth + 1, lines);
      }
    }
  }
}

/** JSON 값 → YAML 문자열 */
export function toYaml(value) {
  if (isScalar(value)) return scalarToYaml(value);
  if (Array.isArray(value) && value.length === 0) return "[]";
  if (!Array.isArray(value) && Object.keys(value).length === 0) return "{}";
  const lines = [];
  emit(value, 0, lines);
  return lines.join("\n");
}

// ── YAML → JSON ────────────────────────────────────────────────

// 따옴표 밖의 # 주석만 제거한다.
function stripComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble) {
      // 줄 시작이거나 앞이 공백일 때만 주석으로 본다
      if (i === 0 || /\s/.test(line[i - 1])) return line.slice(0, i);
    }
  }
  return line;
}

function parseFlow(text) {
  // [1, 2] / {a: 1, b: x} 를 JSON 으로 근사 변환해 파싱한다.
  const json = text.replace(/([{,[]\s*)([A-Za-z_$][\w$.-]*)\s*:/g, '$1"$2":');
  try {
    return JSON.parse(json);
  } catch {
    // 따옴표 없는 스칼라가 섞인 경우: 수동 분해
    return parseFlowManual(text);
  }
}

function parseFlowManual(text) {
  const inner = text.slice(1, -1).trim();
  if (inner === "") return text[0] === "[" ? [] : {};
  const parts = splitTopLevel(inner);
  if (text[0] === "[") return parts.map((p) => parseScalar(p.trim()));
  const obj = {};
  for (const p of parts) {
    const i = p.indexOf(":");
    if (i < 0) continue;
    obj[unquote(p.slice(0, i).trim())] = parseScalar(p.slice(i + 1).trim());
  }
  return obj;
}

function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  let q = null;
  for (const c of s) {
    if (q) {
      cur += c;
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === "[" || c === "{") depth++;
    if (c === "]" || c === "}") depth--;
    if (c === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim() !== "") out.push(cur);
  return out;
}

function unquote(s) {
  if (s.length >= 2 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) {
    const body = s.slice(1, -1);
    // 한 번에 훑는다 — 순서대로 치환하면 \\t 가 이스케이프된 역슬래시 뒤의 t 인지 구분이 안 된다
    return s[0] === '"'
      ? body.replace(/\\(["\\ntr])/g, (_, c) => ({ '"': '"', "\\": "\\", n: "\n", t: "\t", r: "\r" })[c])
      : body;
  }
  return s;
}

function parseScalar(raw) {
  const s = raw.trim();
  if (s === "") return null;
  if ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'"))) return unquote(s);
  if (s[0] === "[" || s[0] === "{") return parseFlow(s);
  if (/^(null|~)$/i.test(s)) return null;
  if (/^(true|yes|on)$/i.test(s)) return true;
  if (/^(false|no|off)$/i.test(s)) return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  if (/^-?\d*\.\d+([eE][-+]?\d+)?$/.test(s) || /^-?\d+[eE][-+]?\d+$/.test(s)) return Number(s);
  return s;
}

function splitKey(content) {
  // "key: value" 에서 따옴표 밖의 첫 ": " 또는 끝의 ":" 를 찾는다.
  let q = null;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (q) { if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === ":" && (i === content.length - 1 || /\s/.test(content[i + 1]))) {
      return { key: unquote(content.slice(0, i).trim()), rest: content.slice(i + 1).trim() };
    }
  }
  return null;
}

/** YAML 문자열 → JSON 값. 형식 오류 시 예외를 던진다. */
export function fromYaml(text) {
  const raw = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");

  // (indent, content) 목록으로 정규화. 빈 줄·주석·문서 구분자 제거.
  const lines = [];
  for (let i = 0; i < raw.length; i++) {
    const original = raw[i];
    // 탭이 금지된 건 **들여쓰기**뿐이다. 인용된 문자열 안의 탭은 정상이라 막지 않는다.
    if (/^[ ]*\t/.test(original)) {
      throw new Error(`${i + 1}행: YAML 들여쓰기에 탭을 쓸 수 없습니다. 공백을 사용하세요.`);
    }
    const stripped = stripComment(original);
    const content = stripped.trim();
    if (content === "" || content === "---" || content === "...") continue;
    lines.push({ indent: stripped.length - stripped.trimStart().length, content, no: i + 1, original });
  }
  if (lines.length === 0) return null;

  let pos = 0;

  function parseBlockScalar(header, indent) {
    const fold = header[0] === ">";
    const chomp = header.includes("-") ? "strip" : header.includes("+") ? "keep" : "clip";
    const parts = [];
    while (pos < lines.length && lines[pos].indent > indent) {
      parts.push(lines[pos].original.slice(indent + 2));
      pos++;
    }
    let out = fold ? parts.join(" ") : parts.join("\n");
    if (chomp === "keep") out += "\n";
    return out;
  }

  function parseBlock(indent) {
    const first = lines[pos];
    if (first.content.startsWith("- ") || first.content === "-") return parseSeq(indent);
    return parseMap(indent);
  }

  function parseSeq(indent) {
    const out = [];
    while (pos < lines.length && lines[pos].indent === indent) {
      const line = lines[pos];
      if (!line.content.startsWith("- ") && line.content !== "-") break;
      const rest = line.content === "-" ? "" : line.content.slice(2).trim();
      pos++;
      if (rest === "") {
        // 다음 줄부터 중첩 블록
        if (pos < lines.length && lines[pos].indent > indent) out.push(parseBlock(lines[pos].indent));
        else out.push(null);
        continue;
      }
      const kv = splitKey(rest);
      if (kv) {
        // "- key: value" → 이 항목은 매핑. 항목 내부 들여쓰기는 (indent + 2)
        const itemIndent = indent + 2;
        const obj = {};
        assign(obj, kv, itemIndent);
        while (pos < lines.length && lines[pos].indent === itemIndent) {
          const sub = splitKey(lines[pos].content);
          if (!sub) break;
          pos++;
          assign(obj, sub, itemIndent);
        }
        out.push(obj);
      } else {
        out.push(parseScalar(rest));
      }
    }
    return out;
  }

  function assign(obj, kv, indent) {
    if (kv.rest === "") {
      if (pos < lines.length && lines[pos].indent > indent) {
        obj[kv.key] = parseBlock(lines[pos].indent);
      } else {
        obj[kv.key] = null;
      }
    } else if (/^[|>][-+]?$/.test(kv.rest)) {
      obj[kv.key] = parseBlockScalar(kv.rest, indent);
    } else {
      obj[kv.key] = parseScalar(kv.rest);
    }
  }

  function parseMap(indent) {
    const obj = {};
    while (pos < lines.length && lines[pos].indent === indent) {
      const line = lines[pos];
      const kv = splitKey(line.content);
      if (!kv) {
        throw new Error(`${line.no}행: "키: 값" 형태가 아닙니다 → ${line.content}`);
      }
      pos++;
      // 값이 비어 있고 다음 줄이 같은 깊이의 "- " 면 시퀀스(YAML 허용 표기)
      if (kv.rest === "" && pos < lines.length && lines[pos].indent === indent &&
          (lines[pos].content.startsWith("- ") || lines[pos].content === "-")) {
        obj[kv.key] = parseSeq(indent);
        continue;
      }
      assign(obj, kv, indent);
    }
    return obj;
  }

  const baseIndent = lines[0].indent;
  const result = parseBlock(baseIndent);

  if (pos < lines.length) {
    const l = lines[pos];
    throw new Error(`${l.no}행: 들여쓰기가 어긋났습니다 → ${l.content}`);
  }
  return result;
}
