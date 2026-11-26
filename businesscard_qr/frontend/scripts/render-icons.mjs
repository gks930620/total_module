// PWA 아이콘·링크 미리보기 이미지 PNG 를 SVG 원본에서 뽑는다. 원본을 고쳤을 때만 손으로 돌린다(빌드에 넣지 않는다):
//   node scripts/render-icons.mjs
//
// 원본은 셋이다 — public/icons/favicon.svg(둥근 사각형), scripts/icon-maskable.svg(꽉 찬 배경),
// scripts/og-default.svg(명함 사진이 없는 명함의 카톡 미리보기 이미지, 1200x630).
// 크기별 PNG 를 손으로 따로 그리면 반드시 어긋나서, 헤드리스 크롬으로 원본을 그대로 그린다.
//
// 스크린샷(--screenshot)으로 찍지 않는 이유: 헤드리스 크롬에는 최소 창 너비(약 500px)가 있어서
// 180px 처럼 작게 찍으면 그림이 창 가운데에 그려지고 화면 왼쪽 일부만 잘려 나온다.
// 대신 페이지 안의 캔버스에 목표 크기로 그린 뒤 PNG data URL 을 DOM 으로 꺼낸다.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const icons = resolve(here, "../public/icons");

const BROWSERS = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const browser = BROWSERS.find((path) => existsSync(path));
if (!browser) {
  console.error("크롬/엣지를 찾지 못했다. BROWSERS 에 경로를 추가할 것.");
  process.exit(1);
}

const ROUNDED = resolve(icons, "favicon.svg");
const MASKABLE = resolve(here, "icon-maskable.svg");
const OG_DEFAULT = resolve(here, "og-default.svg");

const TARGETS = [
  // 브라우저 탭
  { source: ROUNDED, size: 32, out: "favicon-32.png" },
  // 설치 아이콘(purpose: any) — 모서리가 둥글고 바깥은 투명
  { source: ROUNDED, size: 192, out: "icon-192.png" },
  { source: ROUNDED, size: 512, out: "icon-512.png" },
  // 설치 아이콘(purpose: maskable) — OS 가 제 모양으로 자른다
  { source: MASKABLE, size: 512, out: "icon-maskable-512.png" },
  // iOS 홈 화면 — iOS 가 모서리를 직접 깎으므로 투명 없이 꽉 차야 한다
  { source: MASKABLE, size: 180, out: "apple-touch-icon.png" },
  // 링크 미리보기(og:image) — 서버 PublicCardPageRenderer 가 명함 사진이 없을 때 쓴다.
  // 그라데이션은 PNG 로 600KB 가 넘어 JPEG 로 뽑는다(메신저 수집기가 가볍게 받게).
  { source: OG_DEFAULT, width: 1200, height: 630, out: "og-default.jpg" },
];

// 일부만 다시 뽑을 수 있다: node scripts/render-icons.mjs og-default.png
// (바뀌지 않은 아이콘까지 다시 뽑으면 크롬 버전에 따라 바이트가 달라져 쓸데없는 변경이 생긴다)
const only = process.argv.slice(2);
const targets = only.length ? TARGETS.filter(({ out }) => only.includes(out)) : TARGETS;
if (targets.length === 0) {
  console.error(`그런 대상이 없다: ${only.join(", ")} — 가능한 것: ${TARGETS.map(({ out }) => out).join(", ")}`);
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "bq-icons-"));
try {
  for (const { source, size, width = size, height = size, out } of targets) {
    const type = out.endsWith(".jpg") ? "image/jpeg" : "image/png";
    // SVG 를 data URL 로 넣는다 — file:// 이미지를 캔버스에 그리면 캔버스가 오염돼 toDataURL 이 막힌다.
    const svgDataUrl = `data:image/svg+xml;base64,${readFileSync(source).toString("base64")}`;
    const page = join(work, `${out}.html`);
    writeFileSync(
      page,
      `<!doctype html><body><script>
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = ${width};
          c.height = ${height};
          const g = c.getContext("2d");
          g.imageSmoothingQuality = "high";
          g.drawImage(img, 0, 0, ${width}, ${height});
          document.body.textContent = "IMG:" + c.toDataURL("${type}", 0.9);
        };
        img.onerror = () => { document.body.textContent = "ERROR:svg"; };
        img.src = ${JSON.stringify(svgDataUrl)};
      </script></body>`,
    );

    const dom = execFileSync(
      browser,
      ["--headless=new", "--disable-gpu", "--virtual-time-budget=5000", "--dump-dom", pathToFileURL(page).href],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const match = dom.match(/IMG:data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)/);
    if (!match) {
      throw new Error(`${out}: 렌더링 실패 — SVG 가 깨졌는지 확인할 것 (${dom.includes("ERROR:svg") ? "SVG 로드 실패" : "결과 없음"})`);
    }
    const target = resolve(icons, out);
    writeFileSync(target, Buffer.from(match[1], "base64"));
    console.log(`${out.padEnd(24)} ${width}x${height}  ${statSync(target).size} bytes`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
