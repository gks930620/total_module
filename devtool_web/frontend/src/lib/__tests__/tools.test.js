// 도구 레지스트리 정합성 — CLAUDE.md 의 "라우트 추가 시 4+1곳" 규칙을 자동으로 지킨다.
// 백엔드 두 곳이 어긋나면 운영에서 403 이 나므로(SpaRouteApiIntegrationTest 와 짝),
// 프론트 쪽에서도 등록 누락을 즉시 잡는다.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TOOLS, TOOL_GROUPS, groupedTools, getToolBySlug, getToolByPath } from "../tools.js";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = join(here, "..", "..", "..");
const repoRoot = join(frontend, "..");
const read = (p) => readFileSync(p, "utf8");

// 사이드바에는 안 보이지만 살아 있는 URL — 검색 유입을 잃지 않으려고 유지한다.
// /json·/yaml·/csv·/json-to-type 는 /convert 페이지를
// 시작 형식만 바꿔 연다. TOOLS 에는 항목이 없고 라우트와 백엔드 화이트리스트에만 있다.
const ALIAS_PATHS = ["/json", "/yaml", "/csv", "/json-to-type"];

describe("도구 레지스트리", () => {
  it("슬러그와 경로가 중복되지 않는다", () => {
    const slugs = TOOLS.map((t) => t.slug);
    const paths = TOOLS.map((t) => t.path);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("경로는 슬러그와 일치한다", () => {
    for (const t of TOOLS) expect(t.path).toBe(`/${t.slug}`);
  });

  it("모든 도구가 정의된 그룹에 속한다", () => {
    const keys = new Set(TOOL_GROUPS.map((g) => g.key));
    for (const t of TOOLS) expect(keys.has(t.group), `${t.slug} 의 그룹 ${t.group}`).toBe(true);
  });

  it("SEO 필드가 비어 있지 않다", () => {
    for (const t of TOOLS) {
      for (const f of ["name", "short", "desc", "icon", "title", "metaDescription", "keywords"]) {
        expect(String(t[f] ?? "").trim(), `${t.slug}.${f}`).not.toBe("");
      }
    }
  });

  it("조회 함수가 동작한다", () => {
    expect(getToolBySlug("convert")?.path).toBe("/convert");
    expect(getToolByPath("/convert")?.slug).toBe("convert");
    expect(getToolBySlug("없는도구")).toBeNull();
    expect(groupedTools().flatMap((g) => g.tools)).toHaveLength(TOOLS.length);
  });
});

describe("라우트 등록 (4+1곳 동기화)", () => {
  const routePaths = (src) => new Set([...src.matchAll(/path="(\/[a-z0-9-]*)"/g)].map((m) => m[1]));

  it("App.jsx 에 모든 도구 라우트가 있다", () => {
    const routes = routePaths(read(join(frontend, "src", "App.jsx")));
    for (const t of TOOLS) expect(routes.has(t.path), `App.jsx 에 ${t.path} 누락`).toBe(true);
  });

  it("sitemap.xml 에 모든 도구가 있다", () => {
    const xml = read(join(frontend, "public", "sitemap.xml"));
    const locs = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
    for (const t of TOOLS) expect(locs.has(t.path), `sitemap.xml 에 ${t.path} 누락`).toBe(true);
  });

  it("HomeController 와 SecurityConfig 가 도구 목록과 일치한다", () => {
    const quoted = (file, from) => {
      const src = read(file);
      const body = src.slice(src.indexOf(from));
      return new Set([...body.matchAll(/"(\/[a-z0-9-]*)"/g)].map((m) => m[1]));
    };
    const controller = quoted(
      join(repoRoot, "src/main/java/com/test/test/HomeController.java"),
      "@GetMapping"
    );
    const security = quoted(
      join(repoRoot, "src/main/java/com/test/test/common/config/SecurityConfig.java"),
      "authorizeHttpRequests"
    );

    for (const t of TOOLS) {
      expect(controller.has(t.path), `HomeController 에 ${t.path} 누락`).toBe(true);
      expect(security.has(t.path), `SecurityConfig 에 ${t.path} 누락 → 운영에서 403`).toBe(true);
    }
    for (const alias of ALIAS_PATHS) {
      expect(controller.has(alias)).toBe(true);
      expect(security.has(alias)).toBe(true);
    }
  });

  it("SpaRouteApiIntegrationTest 가 모든 도구 경로를 검증한다", () => {
    const src = read(join(repoRoot, "src/test/java/com/test/test/integration/SpaRouteApiIntegrationTest.java"));
    const covered = new Set([...src.matchAll(/"(\/[a-z0-9-]*)"/g)].map((m) => m[1]));
    for (const t of TOOLS) expect(covered.has(t.path), `회귀 테스트에 ${t.path} 누락`).toBe(true);
  });
});
