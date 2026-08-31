// 코드 생성 — JSON → 타입 정의 / cURL → HTTP 클라이언트 코드.
// 전부 클라이언트(NFR-02). 붙여넣은 API 응답·토큰이 서버로 가지 않는다는 게 핵심이다.

// ══════════════════════════════════════════════════════════
// 1. JSON → 타입 정의 (TypeScript / Java / Kotlin)
// ══════════════════════════════════════════════════════════

const RESERVED = new Set(["class", "interface", "enum", "package", "public", "private", "new", "int", "long", "double", "boolean", "String", "Object"]);

/** 키 → 타입 이름 (PascalCase) */
function typeName(key) {
  const base = String(key || "Root")
    .replace(/[^\w가-힣]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("") || "Root";
  // 복수형 키에서 온 요소 타입은 단수로
  return RESERVED.has(base) ? `${base}Type` : base;
}

function singular(name) {
  if (/ies$/i.test(name)) return name.slice(0, -3) + "y";
  if (/(s|List|Array)$/i.test(name)) return name.replace(/(s|List|Array)$/i, "");
  return name + "Item";
}

/** 값 → 내부 타입 표현 */
function inferType(value, keyHint, ctx) {
  if (value === null || value === undefined) return { kind: "null" };
  if (Array.isArray(value)) {
    if (!value.length) return { kind: "array", of: { kind: "unknown" } };
    // 배열 원소 타입을 병합한다(전부 같은 모양이 아닐 수 있으므로)
    const merged = value.map((v) => inferType(v, singular(typeName(keyHint)), ctx)).reduce(mergeType);
    return { kind: "array", of: merged };
  }
  if (typeof value === "object") {
    const name = ctx.register(typeName(keyHint), value, ctx);
    return { kind: "object", name };
  }
  if (typeof value === "number") return { kind: Number.isInteger(value) ? "int" : "double" };
  if (typeof value === "boolean") return { kind: "boolean" };
  // 날짜처럼 보이는 문자열은 표시만 해 둔다(타입은 string)
  if (typeof value === "string") {
    const isDate = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/.test(value);
    return { kind: "string", hint: isDate ? "date" : undefined };
  }
  return { kind: "unknown" };
}

function mergeType(a, b) {
  if (a.kind === b.kind) {
    if (a.kind === "array") return { kind: "array", of: mergeType(a.of, b.of) };
    if (a.kind === "object") return a.name === b.name ? a : { kind: "unknown" };
    return a;
  }
  if (a.kind === "null") return { ...b, nullable: true };
  if (b.kind === "null") return { ...a, nullable: true };
  if ((a.kind === "int" && b.kind === "double") || (a.kind === "double" && b.kind === "int")) return { kind: "double" };
  return { kind: "unknown" };
}

/** 객체를 훑어 타입 목록을 만든다 */
function collect(json, rootName) {
  const types = [];       // { name, fields: [{ key, type }] }
  const byShape = new Map();

  const ctx = {
    register(name, obj) {
      // 같은 키 집합이면 같은 타입으로 재사용한다(중복 정의 방지)
      const shape = Object.keys(obj).sort().join("|");
      if (byShape.has(shape)) return byShape.get(shape);

      let unique = name;
      let n = 2;
      while (types.some((t) => t.name === unique)) unique = `${name}${n++}`;

      const entry = { name: unique, fields: [] };
      types.push(entry);
      byShape.set(shape, unique);

      for (const [k, v] of Object.entries(obj)) {
        entry.fields.push({ key: k, type: inferType(v, k, ctx) });
      }
      return unique;
    },
  };

  const rootType = inferType(json, rootName, ctx);
  return { types, rootType };
}

// ── 언어별 렌더러 ──────────────────────────────────────────

const TS_MAP = { int: "number", double: "number", string: "string", boolean: "boolean", null: "null", unknown: "unknown" };

function renderTs(types, rootType, { optionalNullable = true } = {}) {
  const tsType = (t) => {
    if (t.kind === "array") return `${tsType(t.of)}[]`;
    if (t.kind === "object") return t.name;
    return TS_MAP[t.kind] || "unknown";
  };
  const out = types.map((t) => {
    const lines = [`export interface ${t.name} {`];
    for (const f of t.fields) {
      const q = optionalNullable && f.type.nullable ? "?" : "";
      const nullSuffix = !optionalNullable && f.type.nullable ? " | null" : "";
      const safeKey = /^[A-Za-z_$][\w$]*$/.test(f.key) ? f.key : JSON.stringify(f.key);
      lines.push(`  ${safeKey}${q}: ${tsType(f.type)}${nullSuffix};`);
    }
    lines.push("}");
    return lines.join("\n");
  });
  if (rootType.kind === "array") {
    out.push(`export type Root = ${tsType(rootType)};`);
  }
  return out.join("\n\n");
}

const JAVA_MAP = { int: "Integer", double: "Double", string: "String", boolean: "Boolean", null: "Object", unknown: "Object" };

/** 코드컨벤션 §0: DTO 는 record 가 아니라 Lombok class */
function renderJava(types, { lombok = true } = {}) {
  const javaType = (t) => {
    if (t.kind === "array") return `List<${javaType(t.of)}>`;
    if (t.kind === "object") return t.name;
    return JAVA_MAP[t.kind] || "Object";
  };
  return types
    .map((t) => {
      const lines = [];
      if (lombok) lines.push("@Getter", "@NoArgsConstructor(access = AccessLevel.PROTECTED)");
      lines.push(`public class ${t.name} {`);
      for (const f of t.fields) {
        const name = toCamel(f.key);
        if (name !== f.key) lines.push(`    @JsonProperty("${f.key}")`);
        lines.push(`    private ${javaType(f.type)} ${name};`);
      }
      lines.push("}");
      return lines.join("\n");
    })
    .join("\n\n");
}

/**
 * Java 16+ record. 위의 Lombok class 와 나란히 둔다 —
 * 이 프로젝트의 DTO 규칙(코드컨벤션 §0)은 class 지만, 이 도구를 쓰는 사람의 규칙까지
 * 정해 줄 이유는 없다. 불변 응답 타입에는 record 가 짧다.
 */
function renderJavaRecord(types) {
  const javaType = (t) => {
    if (t.kind === "array") return `List<${javaType(t.of)}>`;
    if (t.kind === "object") return t.name;
    return JAVA_MAP[t.kind] || "Object";
  };
  return types
    .map((t) => {
      // 컴포넌트가 없으면 record Root() {} — 괄호만 비워도 문법상 유효하다
      if (!t.fields.length) return `public record ${t.name}() {}`;
      const components = t.fields.map((f) => {
        const name = toCamel(f.key);
        const anno = name !== f.key ? `@JsonProperty("${f.key}") ` : "";
        return `    ${anno}${javaType(f.type)} ${name}`;
      });
      return `public record ${t.name}(\n${components.join(",\n")}\n) {}`;
    })
    .join("\n\n");
}

const KOTLIN_MAP = { int: "Int", double: "Double", string: "String", boolean: "Boolean", null: "Any?", unknown: "Any?" };

function renderKotlin(types) {
  const ktType = (t) => {
    let base;
    if (t.kind === "array") base = `List<${ktType(t.of)}>`;
    else if (t.kind === "object") base = t.name;
    else base = KOTLIN_MAP[t.kind] || "Any?";
    return t.nullable && !base.endsWith("?") ? `${base}?` : base;
  };
  return types
    .map((t) => {
      const fields = t.fields.map((f) => {
        const name = toCamel(f.key);
        const anno = name !== f.key ? `@SerialName("${f.key}") ` : "";
        return `    ${anno}val ${name}: ${ktType(f.type)}`;
      });
      return `data class ${t.name}(\n${fields.join(",\n")}\n)`;
    })
    .join("\n\n");
}

function toCamel(key) {
  const parts = String(key).split(/[_\-.\s]+/).filter(Boolean);
  if (!parts.length) return "field";
  const camel = parts[0].charAt(0).toLowerCase() + parts[0].slice(1) +
    parts.slice(1).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return safeIdentifier(camel);
}

/**
 * 자바·코틀린이 받아 주는 이름으로 다듬는다.
 *
 * <p>JSON 키에는 아무 글자나 올 수 있지만 식별자는 아니다 — {@code "2nd"} 는 숫자로 시작해
 * 컴파일이 안 되고 {@code "a@b"} 의 골뱅이는 쓸 수 없다. 한글은 두 언어 모두 유효해서 그대로 둔다.
 * 이름을 바꾸면 호출부가 @JsonProperty·@SerialName 으로 원래 키를 남긴다.
 */
function safeIdentifier(name) {
  const cleaned = String(name).replace(/[^\p{L}\p{N}_$]/gu, "");
  if (!cleaned) return "field";
  return /^\p{N}/u.test(cleaned) ? `_${cleaned}` : cleaned;
}

export const CODEGEN_LANGS = [
  { key: "ts", label: "TypeScript interface" },
  { key: "java", label: "Java (Lombok DTO)" },
  { key: "record", label: "Java record" },
  { key: "kotlin", label: "Kotlin data class" },
];

/** JSON 문자열 → 타입 정의 코드 */
export function jsonToTypes(jsonText, { lang = "ts", rootName = "Root", optionalNullable = true } = {}) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return { ok: false, reason: `JSON 파싱 실패: ${e.message}` };
  }
  if (parsed === null || typeof parsed !== "object") {
    return { ok: false, reason: "객체 또는 배열이어야 타입을 만들 수 있습니다." };
  }

  const { types, rootType } = collect(parsed, rootName);
  if (!types.length) return { ok: false, reason: "타입을 만들 객체를 찾지 못했습니다." };

  let code;
  if (lang === "java") code = renderJava(types);
  else if (lang === "record") code = renderJavaRecord(types);
  else if (lang === "kotlin") code = renderKotlin(types);
  else code = renderTs(types, rootType, { optionalNullable });

  return { ok: true, code, typeCount: types.length, typeNames: types.map((t) => t.name) };
}

// ══════════════════════════════════════════════════════════
// 2. cURL → 코드
// ══════════════════════════════════════════════════════════

/** 셸 따옴표를 존중하며 토큰으로 쪼갠다 */
function shellSplit(cmd) {
  const out = [];
  let cur = "";
  let quote = null;
  let has = false;
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && cmd[i + 1]) { cur += cmd[++i]; }
      else cur += c;
      has = true;
    } else if (c === "'" || c === '"') {
      quote = c; has = true;
    } else if (c === "\\" && (cmd[i + 1] === "\n" || cmd[i + 1] === "\r")) {
      i++; if (cmd[i] === "\r" && cmd[i + 1] === "\n") i++;
    } else if (/\s/.test(c)) {
      if (has || cur) { out.push(cur); cur = ""; has = false; }
    } else {
      cur += c; has = true;
    }
  }
  if (has || cur) out.push(cur);
  return out;
}

/** cURL 명령 파싱 → { method, url, headers, body, ... } */
export function parseCurl(command) {
  const raw = String(command ?? "").trim().replace(/\r\n?/g, "\n");
  if (!raw) return { ok: false, reason: "cURL 명령을 붙여넣어 주세요." };
  const tokens = shellSplit(raw);
  if (!tokens.length || !/^curl$/i.test(tokens[0])) {
    return { ok: false, reason: "curl 로 시작하는 명령이어야 합니다." };
  }

  const result = { method: null, url: "", headers: {}, body: null, contentType: null, insecure: false, form: [] };

  for (let i = 1; i < tokens.length; i++) {
    const t = tokens[i];
    const next = () => tokens[++i] ?? "";

    if (t === "-X" || t === "--request") result.method = next().toUpperCase();
    else if (t === "-H" || t === "--header") {
      const h = next();
      const idx = h.indexOf(":");
      if (idx > 0) result.headers[h.slice(0, idx).trim()] = h.slice(idx + 1).trim();
    } else if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary" || t === "--data-ascii") {
      const v = next();
      result.body = result.body === null ? v : `${result.body}&${v}`;
    } else if (t === "--json") {
      result.body = next();
      result.headers["Content-Type"] = result.headers["Content-Type"] || "application/json";
    } else if (t === "-F" || t === "--form") {
      const v = next();
      const eq = v.indexOf("=");
      if (eq > 0) result.form.push({ name: v.slice(0, eq), value: v.slice(eq + 1) });
    } else if (t === "-u" || t === "--user") {
      const v = next();
      result.headers.Authorization = `Basic ${btoa(v)}`;
    } else if (t === "-k" || t === "--insecure") result.insecure = true;
    else if (t === "-L" || t === "--location" || t === "-s" || t === "--silent" || t === "-i" || t === "--include" || t === "-v" || t === "--verbose" || t === "--compressed") {
      /* 무시해도 되는 플래그 */
    } else if (t.startsWith("-")) {
      // 값을 받는 알 수 없는 옵션은 한 칸 건너뛴다
      if (!t.startsWith("--") && t.length === 2 && tokens[i + 1] && !tokens[i + 1].startsWith("-")) i++;
    } else if (!result.url) {
      result.url = t;
    }
  }

  if (!result.url) return { ok: false, reason: "URL 을 찾지 못했습니다." };
  if (!result.method) result.method = result.body !== null || result.form.length ? "POST" : "GET";

  const ct = Object.keys(result.headers).find((k) => k.toLowerCase() === "content-type");
  result.contentType = ct ? result.headers[ct] : (result.body && looksJson(result.body) ? "application/json" : null);

  return { ok: true, ...result };
}

function looksJson(s) {
  const t = String(s).trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
}

const q = (s) => `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

export const CURL_TARGETS = [
  { key: "fetch", label: "JavaScript (fetch)" },
  { key: "axios", label: "JavaScript (axios)" },
  { key: "java", label: "Java (HttpClient)" },
  { key: "python", label: "Python (requests)" },
];

/** 파싱 결과 → 각 언어 코드 */
export function curlToCode(parsed, target = "fetch") {
  if (!parsed || !parsed.ok) return "";
  const { method, url, headers, body, form } = parsed;
  const headerEntries = Object.entries(headers);
  const jsonBody = body && looksJson(body);

  if (target === "fetch") {
    const lines = [`const res = await fetch(${q(url)}, {`, `  method: ${q(method)},`];
    if (headerEntries.length) {
      lines.push("  headers: {");
      headerEntries.forEach(([k, v]) => lines.push(`    ${q(k)}: ${q(v)},`));
      lines.push("  },");
    }
    if (form.length) {
      lines.unshift(
        "const form = new FormData();",
        ...form.map((f) => `form.append(${q(f.name)}, ${q(f.value)});`),
        ""
      );
      lines.push("  body: form,");
    } else if (body) {
      lines.push(jsonBody ? `  body: JSON.stringify(${body}),` : `  body: ${q(body)},`);
    }
    lines.push("});", "const data = await res.json();");
    return lines.join("\n");
  }

  if (target === "axios") {
    const cfg = [`  method: ${q(method.toLowerCase())},`, `  url: ${q(url)},`];
    if (headerEntries.length) {
      cfg.push("  headers: {");
      headerEntries.forEach(([k, v]) => cfg.push(`    ${q(k)}: ${q(v)},`));
      cfg.push("  },");
    }
    if (body) cfg.push(jsonBody ? `  data: ${body},` : `  data: ${q(body)},`);
    return `const { data } = await axios({\n${cfg.join("\n")}\n});`;
  }

  if (target === "java") {
    const lines = [
      "HttpClient client = HttpClient.newHttpClient();",
      "HttpRequest request = HttpRequest.newBuilder()",
      `        .uri(URI.create("${url}"))`,
    ];
    headerEntries.forEach(([k, v]) => lines.push(`        .header("${k}", "${v.replace(/"/g, '\\"')}")`));
    if (body) {
      const escaped = body.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "");
      lines.push(`        .method("${method}", HttpRequest.BodyPublishers.ofString("${escaped}"))`);
    } else {
      lines.push(method === "GET" ? "        .GET()" : `        .method("${method}", HttpRequest.BodyPublishers.noBody())`);
    }
    lines.push("        .build();", "", "HttpResponse<String> response =", "        client.send(request, HttpResponse.BodyHandlers.ofString());");
    return lines.join("\n");
  }

  // python
  const py = [`url = "${url}"`];
  if (headerEntries.length) {
    py.push("headers = {");
    headerEntries.forEach(([k, v]) => py.push(`    "${k}": "${v.replace(/"/g, '\\"')}",`));
    py.push("}");
  }
  if (body) py.push(jsonBody ? `payload = ${body}` : `payload = ${JSON.stringify(body)}`);
  const args = ["url"];
  if (headerEntries.length) args.push("headers=headers");
  if (body) args.push(jsonBody ? "json=payload" : "data=payload");
  py.push("", `response = requests.${method.toLowerCase()}(${args.join(", ")})`, "print(response.json())");
  return py.join("\n");
}
