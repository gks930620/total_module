// 코드 → 다이어그램 모델.
//
// 이 도구가 더하는 값이 여기 있다. mermaid 문법을 배우게 하면 mermaid.live 와 다를 게 없다.
// **이미 갖고 있는 코드를 붙여넣으면 그림이 나오는 것** 이 우리 몫이다.
//
// lib/dummy.js 의 parseSchema 와 겹쳐 보이지만 다른 물건이다 —
// 저쪽은 **한 테이블**을 더미데이터용으로 읽고(nullPercent·params 같은 생성 파라미터),
// 이쪽은 **여러 엔티티와 그 사이의 관계**를 읽는다. 관계가 없으면 다이어그램이 아니다.
//
// 완벽한 파서를 만들지 않는다. 정식 문법 분석기는 이 화면에 과하고,
// 실제로 붙여넣는 것은 대개 한 파일 분량의 평범한 코드다. 못 읽은 것은 조용히 버리지 않고
// warnings 로 알린다 — 그림에 빠진 게 있는데 모르는 것이 제일 나쁘다.

/**
 * @typedef {object} DiagramField
 * @property {string} name
 * @property {string} type
 * @property {boolean} [pk] @property {boolean} [fk] @property {boolean} [unique]
 * @property {boolean} [nullable] @property {"+"|"-"|"#"|"~"} [visibility]
 */
/**
 * @typedef {object} DiagramEntity
 * @property {string} name
 * @property {"table"|"class"|"interface"|"enum"|"record"|"abstract"} kind
 * @property {DiagramField[]} fields
 * @property {Array<{name:string, returns:string, params:string, visibility:string, static?:boolean}>} [methods]
 */
/**
 * @typedef {object} DiagramRelation
 * @property {string} from @property {string} to
 * @property {"fk"|"extends"|"implements"|"association"|"composition"} kind
 * @property {string} [label] @property {string} [fromCard] @property {string} [toCard]
 */
/** @typedef {{entities:DiagramEntity[], relations:DiagramRelation[], warnings:string[]}} DiagramModel */

const empty = (warning) => ({ entities: [], relations: [], warnings: warning ? [warning] : [] });

/** 방언마다 다른 따옴표를 벗긴다 — MySQL `x` · 표준 "x" · SQL Server [x] */
const unquote = (s) => String(s ?? "").trim().replace(/^[`"[]|[`"\]]$/g, "").trim();

/** schema.table 로 온 것은 테이블 이름만 쓴다 */
const bareName = (s) => unquote(String(s ?? "").split(".").pop());

/** 주석을 지운다. 문자열 리터럴 안의 // 까지 살리지는 않는다 — 여기선 그 정도면 충분하다 */
function stripComments(src) {
  return String(src ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

// ── SQL DDL ────────────────────────────────────────────────

/** 괄호 깊이를 세며 최상위 쉼표로만 자른다. DECIMAL(12,2) 의 쉼표에 속지 않기 위해서다. */
function splitTopLevel(body) {
  const out = [];
  let depth = 0;
  let buf = "";
  for (const ch of body) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) { out.push(buf); buf = ""; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/** CREATE TABLE ... ( 여기 ) 의 괄호 안을 짝을 맞춰 꺼낸다 */
function balancedBody(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return text.slice(openIndex + 1, i);
    }
  }
  return null;
}

const CONSTRAINT_LINE = /^\s*(?:CONSTRAINT\s+\S+\s+)?(?:PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|KEY|INDEX|EXCLUDE)\b/i;

/**
 * CREATE TABLE 들을 읽어 테이블과 FK 관계를 만든다.
 * ALTER TABLE ... ADD ... FOREIGN KEY 도 함께 본다.
 * @param {string} sql
 * @returns {DiagramModel}
 */
export function parseDdl(sql) {
  const text = stripComments(sql).replace(/--[^\n]*/g, " ");
  if (!/CREATE\s+TABLE/i.test(text)) {
    return empty("CREATE TABLE 문을 찾지 못했습니다. 테이블 정의를 붙여넣어 주세요.");
  }

  const entities = [];
  const pending = [];   // {fromTable, toTable, column} — 테이블을 다 읽은 뒤에 이어 준다
  const warnings = [];

  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?(?:GLOBAL\s+TEMPORARY\s+|TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"[]?[\w.$가-힣]+[`"\]]?)\s*\(/gi;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const name = bareName(m[1]);
    const body = balancedBody(text, m.index + m[0].length - 1);
    if (body === null) { warnings.push(`${name}: 괄호가 닫히지 않아 건너뛰었습니다.`); continue; }

    const fields = [];
    const pkNames = new Set();
    const uniqueNames = new Set();

    for (const raw of splitTopLevel(body)) {
      const line = raw.trim();
      if (!line) continue;

      if (CONSTRAINT_LINE.test(line)) {
        // 테이블 끝에 몰아 쓴 제약들 — 어느 컬럼에 걸리는지만 꺼낸다
        const pk = line.match(/PRIMARY\s+KEY\s*\(([^)]*)\)/i);
        if (pk) pk[1].split(",").forEach((c) => pkNames.add(unquote(c)));

        const uq = line.match(/^\s*(?:CONSTRAINT\s+\S+\s+)?UNIQUE\s*(?:KEY\s+\S+\s*)?\(([^)]*)\)/i);
        if (uq) uq[1].split(",").forEach((c) => uniqueNames.add(unquote(c)));

        const fk = line.match(/FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+([`"[]?[\w.$가-힣]+[`"\]]?)/i);
        if (fk) pending.push({ fromTable: bareName(fk[2]), toTable: name, column: unquote(fk[1].split(",")[0]) });
        continue;
      }

      const col = line.match(/^([`"[]?[\w$가-힣]+[`"\]]?)\s+([A-Za-z_][\w]*(?:\s+(?:VARYING|PRECISION))?)\s*(\([^)]*\))?/);
      if (!col) continue;

      const fname = unquote(col[1]);
      const type = (col[2].trim() + (col[3] || "")).replace(/\s+/g, " ");
      fields.push({
        name: fname,
        type,
        pk: /\bPRIMARY\s+KEY\b/i.test(line),
        unique: /\bUNIQUE\b/i.test(line),
        // NOT NULL 이 없고 PK 도 아니면 NULL 을 허용한다
        nullable: !/\bNOT\s+NULL\b/i.test(line) && !/\bPRIMARY\s+KEY\b/i.test(line),
      });

      // 컬럼 줄에 바로 쓴 REFERENCES
      const ref = line.match(/REFERENCES\s+([`"[]?[\w.$가-힣]+[`"\]]?)/i);
      if (ref) pending.push({ fromTable: bareName(ref[1]), toTable: name, column: fname });
    }

    for (const f of fields) {
      if (pkNames.has(f.name)) { f.pk = true; f.nullable = false; }
      if (uniqueNames.has(f.name)) f.unique = true;
    }
    entities.push({ name, kind: "table", fields });
  }

  // ALTER TABLE b ADD CONSTRAINT ... FOREIGN KEY (a_id) REFERENCES a (id)
  const alter = /ALTER\s+TABLE\s+(?:ONLY\s+)?([`"[]?[\w.$가-힣]+[`"\]]?)[\s\S]{0,200}?FOREIGN\s+KEY\s*\(([^)]*)\)\s*REFERENCES\s+([`"[]?[\w.$가-힣]+[`"\]]?)/gi;
  for (let m = alter.exec(text); m; m = alter.exec(text)) {
    pending.push({ fromTable: bareName(m[3]), toTable: bareName(m[1]), column: unquote(m[2].split(",")[0]) });
  }

  const known = new Set(entities.map((e) => e.name));
  const relations = [];
  const seen = new Set();
  for (const p of pending) {
    if (!known.has(p.fromTable)) {
      warnings.push(`${p.toTable}.${p.column} 이 가리키는 ${p.fromTable} 테이블의 정의가 없어 선을 잇지 않았습니다.`);
      continue;
    }
    if (!known.has(p.toTable)) continue;

    const owner = entities.find((e) => e.name === p.toTable);
    const field = owner?.fields.find((f) => f.name === p.column);
    if (field) field.fk = true;

    const key = `${p.fromTable}>${p.toTable}>${p.column}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // 부모 1 — 자식 N. FK 를 들고 있는 쪽이 N 이다.
    relations.push({ from: p.fromTable, to: p.toTable, kind: "fk", fromCard: "1", toCard: "N", label: p.column });
  }

  if (!entities.length) warnings.push("테이블을 하나도 읽지 못했습니다.");
  return { entities, relations, warnings };
}

// ── Java ───────────────────────────────────────────────────

/** 관계로 이을 가치가 없는 타입들 — 이걸 안 거르면 String 상자가 한가운데 생긴다 */
const JAVA_BUILTIN = new Set([
  "byte", "short", "int", "long", "float", "double", "boolean", "char", "void", "var",
  "Byte", "Short", "Integer", "Long", "Float", "Double", "Boolean", "Character", "String",
  "Object", "Number", "BigDecimal", "BigInteger", "UUID", "Class", "Optional",
  "List", "ArrayList", "LinkedList", "Set", "HashSet", "LinkedHashSet", "TreeSet",
  "Map", "HashMap", "LinkedHashMap", "TreeMap", "Collection", "Iterable", "Stream",
  "Date", "LocalDate", "LocalDateTime", "LocalTime", "Instant", "ZonedDateTime",
  "OffsetDateTime", "Duration", "Period", "Timestamp", "Serializable", "Comparable",
]);

const VIS = { public: "+", private: "-", protected: "#" };

/** List<Order> · Map<String, Order> 에서 관계로 이을 만한 알맹이 타입만 꺼낸다 */
function referencedTypes(type) {
  const out = [];
  const inner = String(type ?? "").match(/<([^<>]*(?:<[^<>]*>)?[^<>]*)>/);
  const candidates = inner ? inner[1].split(",") : [String(type ?? "")];
  for (const c of candidates) {
    const t = c.replace(/\[\]/g, "").replace(/<.*>/, "").trim();
    if (/^[A-Z][\w$]*$/.test(t) && !JAVA_BUILTIN.has(t)) out.push(t);
  }
  return out;
}

/** 클래스 본문에서 필드와 메서드를 갈라 읽는다 */
function parseMembers(body, kind) {
  const fields = [];
  const methods = [];

  // 애너테이션은 앞줄에 따로 오는 일이 많아 멤버 단위로 묶어서 본다
  for (const chunk of body.split(";")) {
    const seg = chunk.trim();
    if (!seg) continue;

    // 메서드 — 괄호가 있고 그 앞이 이름이다. 본문 { } 는 이미 아래에서 걷어냈다.
    const meth = seg.match(/(?:^|\s)(public|private|protected)?\s*(?:static\s+)?(?:final\s+|abstract\s+|synchronized\s+|default\s+)*([\w.$<>[\]]+)\s+([\w$]+)\s*\(([^)]*)\)\s*$/);
    if (meth) {
      methods.push({
        name: meth[3],
        returns: meth[2],
        params: meth[4].trim(),
        visibility: VIS[meth[1]] || "~",
        static: /\bstatic\b/.test(seg),
      });
      continue;
    }

    const fld = seg.match(/(?:^|\s)(public|private|protected)?\s*(?:static\s+)?(?:final\s+|transient\s+|volatile\s+)*([\w.$]+(?:<[^;{}]*>)?(?:\[\])?)\s+([\w$]+)\s*(?:=[^;]*)?$/);
    if (!fld) continue;
    const type = fld[2].replace(/\s+/g, "");
    if (JAVA_BUILTIN.has(fld[3]) || /^(class|interface|enum|record|return|new|import|package)$/.test(fld[3])) continue;

    fields.push({
      name: fld[3],
      type,
      visibility: VIS[fld[1]] || (kind === "interface" ? "+" : "~"),
      pk: /@Id\b/.test(seg),
      // @Column(nullable = false) 가 없으면 자바 쪽에서는 알 수 없다 — 모르면 표시하지 않는다
      nullable: /@Column\([^)]*nullable\s*=\s*false/.test(seg) ? false : undefined,
      unique: /@Column\([^)]*unique\s*=\s*true/.test(seg) ? true : undefined,
      _annotations: seg.match(/@\w+/g) || [],
    });
  }
  return { fields, methods };
}

/** 선언 뒤 { 부터 짝이 맞는 } 까지 */
function classBody(text, braceIndex) {
  let depth = 0;
  for (let i = braceIndex; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(braceIndex + 1, i);
    }
  }
  return text.slice(braceIndex + 1);
}

/** 메서드·초기화 블록의 본문 { } 를 걷어내 멤버 선언만 남긴다 */
function stripNestedBlocks(body) {
  let out = "";
  let depth = 0;
  for (const ch of body) {
    if (ch === "{") { depth += 1; if (depth === 1) continue; }
    if (ch === "}") { depth -= 1; if (depth === 0) { out += ";"; continue; } }
    if (depth === 0) out += ch;
  }
  return out;
}

const JPA_REL = [
  [/@OneToMany/, "OneToMany", "1", "N"],
  [/@ManyToOne/, "ManyToOne", "1", "N"],
  [/@OneToOne/, "OneToOne", "1", "1"],
  [/@ManyToMany/, "ManyToMany", "N", "N"],
];

/**
 * 자바 소스에서 타입·멤버·관계를 읽는다.
 * @param {string} src
 * @returns {DiagramModel}
 */
export function parseJavaSource(src) {
  const text = stripComments(src);
  const entities = [];
  const relations = [];
  const warnings = [];
  const relKey = new Set();
  const addRel = (r) => {
    const k = `${r.from}>${r.to}>${r.kind}>${r.label || ""}`;
    if (relKey.has(k)) return;
    relKey.add(k);
    relations.push(r);
  };

  // record 는 괄호 안이 곧 필드다 — 본문과 규칙이 달라 따로 읽는다
  const recRe = /(?:public\s+|final\s+|static\s+)*record\s+([\w$]+)\s*\(([^)]*)\)/g;
  for (let m = recRe.exec(text); m; m = recRe.exec(text)) {
    const fields = m[2].split(",").map((p) => p.trim()).filter(Boolean).map((p) => {
      const parts = p.replace(/@\w+(\([^)]*\))?/g, "").trim().split(/\s+/);
      return { name: parts[parts.length - 1], type: parts.slice(0, -1).join(" ") || "?", visibility: "+" };
    });
    entities.push({ name: m[1], kind: "record", fields, methods: [] });
  }

  const declRe = /(?:@\w+(?:\([^)]*\))?\s*)*(?:public|protected|private)?\s*(?:static\s+)?(?:final\s+)?(abstract\s+)?(class|interface|enum)\s+([\w$]+)(?:\s*<[^{]*>)?\s*(?:extends\s+([\w$.<>,\s]+?))?\s*(?:implements\s+([\w$.<>,\s]+?))?\s*\{/g;
  for (let m = declRe.exec(text); m; m = declRe.exec(text)) {
    const [, isAbstract, keyword, name, ext, impl] = m;
    const kind = keyword === "class" && isAbstract ? "abstract" : keyword;

    const brace = text.indexOf("{", m.index + m[0].length - 1);
    const rawBody = classBody(text, brace);

    let fields = [];
    let methods = [];
    if (keyword === "enum") {
      // enum 은 첫 세미콜론(또는 전부) 앞이 상수 목록이다
      const consts = rawBody.split(";")[0].split(",")
        .map((s) => s.replace(/\([^)]*\)/g, "").trim())
        .filter((s) => /^[A-Z_][A-Z0-9_]*$/.test(s));
      fields = consts.map((c) => ({ name: c, type: "", visibility: "+" }));
    } else {
      const parsed = parseMembers(stripNestedBlocks(rawBody), keyword);
      fields = parsed.fields;
      methods = parsed.methods;
    }

    // _annotations 는 아래에서 관계를 고를 때만 쓰는 작업용 값이라 모델에는 남기지 않는다
    entities.push({
      name, kind, methods,
      fields: fields.map((f) => { const c = { ...f }; delete c._annotations; return c; }),
    });

    // 상속·구현. 부모가 소스에 없어도 그린다 — 어디서 왔는지가 정보다.
    if (ext) {
      for (const p of ext.split(",").map((s) => s.trim().replace(/<.*>/, "")).filter(Boolean)) {
        addRel({ from: p, to: name, kind: "extends" });
      }
    }
    if (impl) {
      for (const p of impl.split(",").map((s) => s.trim().replace(/<.*>/, "")).filter(Boolean)) {
        addRel({ from: p, to: name, kind: "implements" });
      }
    }

    // 필드가 가리키는 타입 → 연관. JPA 애너테이션이 있으면 방향과 개수를 그대로 쓴다.
    for (const f of fields) {
      const ann = (f._annotations || []).join(" ");
      const jpa = JPA_REL.find(([re]) => re.test(ann));
      for (const t of referencedTypes(f.type)) {
        addRel({
          from: name, to: t, kind: "association",
          label: jpa ? jpa[1] : f.name,
          fromCard: jpa ? jpa[2] : undefined,
          toCard: jpa ? jpa[3] : undefined,
        });
      }
    }
  }

  if (!entities.length) {
    return empty("클래스·인터페이스·enum·record 선언을 찾지 못했습니다. 자바 소스를 붙여넣어 주세요.");
  }

  // 소스에 없는 타입을 가리키는 연관은 상자만 늘릴 뿐이라 버린다(상속은 남긴다 — 출처가 정보다)
  const known = new Set(entities.map((e) => e.name));
  const kept = relations.filter((r) => {
    if (r.kind === "association" && !known.has(r.to)) return false;
    return true;
  });

  return { entities, relations: kept, warnings };
}
