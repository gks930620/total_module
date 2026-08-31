// 도구별 <title>/meta description 처리 (COM-02, NFR-05 보완)
// SPA 클라이언트 라우팅에서 문서 메타를 갱신한다. 정적 크롤러용 기본 메타는 index.html에 존재.
import { useEffect } from "react";

const SITE = "개발자 유틸 모음";

function setMetaTag(attr, name, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(path) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", window.location.origin + path);
}

export function useMeta({ title, description, path, keywords } = {}) {
  useEffect(() => {
    if (title) document.title = title;
    if (description) {
      setMetaTag("name", "description", description);
      setMetaTag("property", "og:description", description);
    }
    if (title) setMetaTag("property", "og:title", title);
    setMetaTag("property", "og:type", "website");
    setMetaTag("property", "og:site_name", SITE);
    if (keywords) setMetaTag("name", "keywords", keywords);
    if (path) {
      setCanonical(path);
      setMetaTag("property", "og:url", window.location.origin + path);
    }
  }, [title, description, path, keywords]);
}
