import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import { ToolboxLayout } from "./components/ToolboxLayout.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { NotFoundPage } from "./pages/NotFoundPage.jsx";
import { getToolBySlug } from "./lib/tools.js";

// 도구 페이지는 전부 라우트 단위로 분할한다(NFR-04: 첫 진입 gzip 200KB 이하).
// 홈과 404 만 초기 번들에 들어가고, 나머지는 해당 URL 로 갈 때 내려받는다.
// Suspense 경계는 ToolboxLayout 의 <main> 안에 있다.
const named = (loader, key) => lazy(() => loader().then((m) => ({ default: m[key] })));

// 데이터 · 포맷
const DummyPage = named(() => import("./pages/DummyPage.jsx"), "DummyPage");
const ConvertPage = named(() => import("./pages/ConvertPage.jsx"), "ConvertPage");
const ViewerPage = named(() => import("./pages/ViewerPage.jsx"), "ViewerPage");

// 인코딩 · 보안
const Base64Page = named(() => import("./pages/Base64Page.jsx"), "Base64Page");
const JwtPage = named(() => import("./pages/JwtPage.jsx"), "JwtPage");
const HashPage = named(() => import("./pages/HashPage.jsx"), "HashPage");
const UuidPage = named(() => import("./pages/UuidPage.jsx"), "UuidPage");
const EscapePage = named(() => import("./pages/EscapePage.jsx"), "EscapePage");

// 텍스트
const RegexPage = named(() => import("./pages/RegexPage.jsx"), "RegexPage");
const DiffPage = named(() => import("./pages/DiffPage.jsx"), "DiffPage");
const CasePage = named(() => import("./pages/CasePage.jsx"), "CasePage");
const TextPage = named(() => import("./pages/TextPage.jsx"), "TextPage");
const UnicodePage = named(() => import("./pages/UnicodePage.jsx"), "UnicodePage");
const CharCountPage = named(() => import("./pages/CharCountPage.jsx"), "CharCountPage");
const LineFixPage = named(() => import("./pages/LineFixPage.jsx"), "LineFixPage");
const ListComparePage = named(() => import("./pages/ListComparePage.jsx"), "ListComparePage");

// 이미지 · 문서
const ImagePage = named(() => import("./pages/ImagePage.jsx"), "ImagePage");
const ImagePrivacyPage = named(() => import("./pages/ImagePrivacyPage.jsx"), "ImagePrivacyPage");
const ImageMergePage = named(() => import("./pages/ImageMergePage.jsx"), "ImageMergePage");
const FaviconPage = named(() => import("./pages/FaviconPage.jsx"), "FaviconPage");
const PdfPage = named(() => import("./pages/PdfPage.jsx"), "PdfPage");

// 계산 · 변환
const TimestampPage = named(() => import("./pages/TimestampPage.jsx"), "TimestampPage");
const CronPage = named(() => import("./pages/CronPage.jsx"), "CronPage");
const NumberBasePage = named(() => import("./pages/NumberBasePage.jsx"), "NumberBasePage");
const BytesPage = named(() => import("./pages/BytesPage.jsx"), "BytesPage");
const ColorPage = named(() => import("./pages/ColorPage.jsx"), "ColorPage");

// 웹 · 네트워크
const UrlPage = named(() => import("./pages/UrlPage.jsx"), "UrlPage");
const CidrPage = named(() => import("./pages/CidrPage.jsx"), "CidrPage");
const QrPage = named(() => import("./pages/QrPage.jsx"), "QrPage");
const CurlPage = named(() => import("./pages/CurlPage.jsx"), "CurlPage");
const UtmPage = named(() => import("./pages/UtmPage.jsx"), "UtmPage");

// 다이어그램 — 화면은 components/DiagramTool.jsx 하나를 나눠 쓴다(설계 10)
const ErdPage = named(() => import("./pages/ErdPage.jsx"), "ErdPage");
const ClassDiagramPage = named(() => import("./pages/ClassDiagramPage.jsx"), "ClassDiagramPage");
const SequencePage = named(() => import("./pages/SequencePage.jsx"), "SequencePage");
const FlowchartPage = named(() => import("./pages/FlowchartPage.jsx"), "FlowchartPage");
const StateDiagramPage = named(() => import("./pages/StateDiagramPage.jsx"), "StateDiagramPage");
const DiagramPage = named(() => import("./pages/DiagramPage.jsx"), "DiagramPage");

// 한국 특화

// /json 은 데이터 뷰어를 열지만 자기 검색어를 갖는다 — "json 포매터" 는 뷰어의 이름이 아니다.
const VIEWER_JSON_META = {
  path: "/json",
  title: "JSON 뷰어 · 포매터 (온라인) | 개발자 유틸 모음",
  metaDescription: "JSON 을 붙여넣으면 트리로 펼쳐 보고, 표로 보고, 보기 좋게 정렬해 줍니다. 키·값·경로 검색. 서버 전송 없음.",
  keywords: "json 뷰어, json 포매터, json 정렬, json 파서, json 예쁘게, json 보기",
};

// 변환기의 URL 별 SEO 메타. 사이드바에는 /convert 하나만 보이지만,
// 검색어가 URL 마다 달라("마크다운 표 만들기" vs "dto 생성기") 제목·키워드는 각각 유지한다.
const CONVERT_META = {
  convert: getToolBySlug("convert"),
  yaml: {
    path: "/yaml",
    title: "JSON YAML 변환기 (양방향) | 개발자 유틸 모음",
    metaDescription: "JSON을 YAML로, YAML을 JSON으로 변환합니다. 쿠버네티스·GitHub Actions·Spring 설정 작업에. 서버 전송 없음.",
    keywords: "json yaml 변환, yaml to json, json to yaml, yaml 변환기",
  },
  csv: {
    path: "/csv",
    title: "CSV JSON 변환기 · 마크다운 표 만들기 | 개발자 유틸 모음",
    metaDescription: "CSV·TSV·JSON·마크다운 표·SQL INSERT 를 서로 변환합니다. 구분자 자동 인식, 따옴표 처리. 서버 전송 없음.",
    keywords: "csv json 변환, 마크다운 표 만들기, csv 변환기, 엑셀 json 변환",
  },
  "json-to-type": {
    path: "/json-to-type",
    title: "JSON to TypeScript · Java DTO 생성기 | 개발자 유틸 모음",
    metaDescription: "JSON 응답을 붙여넣으면 TypeScript interface·Java Lombok 클래스·Kotlin data class 를 만들어 줍니다. 중첩 객체·배열 지원.",
    keywords: "json typescript 변환, json to java class, dto 생성기, json 타입 생성",
  },
};

function App() {
  return (
    <Routes>
      <Route element={<ToolboxLayout />}>
        <Route path="/" element={<HomePage />} />

        {/* 데이터 · 포맷 */}
        <Route path="/dummy" element={<DummyPage />} />
        {/* 변환기는 화면 하나다. 세 URL 은 시작 형식만 다르게 열리며 각자의 검색어를 유지한다
            (검색 유입이 유일한 획득 경로 — 기획서 §6). /base64 와 /jwt 도 같은 방식이다. */}
        <Route path="/convert" element={<ConvertPage from="json" to="yaml" meta={CONVERT_META.convert} />} />
        <Route path="/viewer" element={<ViewerPage />} />
        {/* "json 뷰어"·"json 포매터" 로 들어오는 사람이 원하는 건 변환이 아니라 보기다 */}
        <Route path="/json" element={<ViewerPage meta={VIEWER_JSON_META} />} />
        <Route path="/yaml" element={<ConvertPage from="json" to="yaml" meta={CONVERT_META.yaml} />} />
        <Route path="/csv" element={<ConvertPage from="csv" to="json" meta={CONVERT_META.csv} />} />
        <Route path="/json-to-type" element={<ConvertPage from="json" to="ts" meta={CONVERT_META["json-to-type"]} />} />

        {/* 인코딩 · 보안 */}
        <Route path="/base64" element={<Base64Page />} />
        <Route path="/jwt" element={<JwtPage />} />
        <Route path="/hash" element={<HashPage />} />
        <Route path="/uuid" element={<UuidPage />} />        <Route path="/escape" element={<EscapePage />} />

        {/* 텍스트 */}
        <Route path="/regex" element={<RegexPage />} />
        <Route path="/diff" element={<DiffPage />} />
        <Route path="/case" element={<CasePage />} />
        <Route path="/text" element={<TextPage />} />
        <Route path="/unicode" element={<UnicodePage />} />
        <Route path="/char-count" element={<CharCountPage />} />
        <Route path="/line-fix" element={<LineFixPage />} />
        <Route path="/list-compare" element={<ListComparePage />} />

        {/* 이미지 · 문서 */}
        <Route path="/image" element={<ImagePage />} />
        <Route path="/image-privacy" element={<ImagePrivacyPage />} />
        <Route path="/image-merge" element={<ImageMergePage />} />
        <Route path="/favicon" element={<FaviconPage />} />
        <Route path="/pdf" element={<PdfPage />} />

        {/* 계산 · 변환 */}
        <Route path="/timestamp" element={<TimestampPage />} />
        <Route path="/cron" element={<CronPage />} />
        <Route path="/number-base" element={<NumberBasePage />} />
        <Route path="/bytes" element={<BytesPage />} />
        <Route path="/color" element={<ColorPage />} />

        {/* 웹 · 네트워크 */}
        <Route path="/url" element={<UrlPage />} />
        <Route path="/cidr" element={<CidrPage />} />
        <Route path="/qr" element={<QrPage />} />
        <Route path="/curl" element={<CurlPage />} />
        <Route path="/utm" element={<UtmPage />} />

        {/* 한국 특화 */}
        {/* 다이어그램 — 종류마다 경로를 따로 둔다(검색어가 서로 다르다) */}
        <Route path="/erd" element={<ErdPage />} />
        <Route path="/class-diagram" element={<ClassDiagramPage />} />
        <Route path="/sequence" element={<SequencePage />} />
        <Route path="/flowchart" element={<FlowchartPage />} />
        <Route path="/state-diagram" element={<StateDiagramPage />} />
        <Route path="/diagram" element={<DiagramPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default App;
