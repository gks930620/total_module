// 외부 CDN 스크립트/스타일 동적 로더
//  - React SPA 에서 Quill(리치 에디터), DOMPurify(XSS 방어)를 필요 시점에만 로드한다.
//  - 원본 Thymeleaf 페이지가 <script src> 로 불러오던 것을 그대로 재현한다.

const jsCache = {}

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

function loadJs(src) {
  if (jsCache[src]) return jsCache[src]
  jsCache[src] = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`)
    if (existing) {
      if (existing.dataset.loaded) resolve()
      else {
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', reject)
      }
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => {
      s.dataset.loaded = '1'
      resolve()
    }
    s.onerror = reject
    document.body.appendChild(s)
  })
  return jsCache[src]
}

/** Quill 1.3.6 (snow 테마) 로드 후 전역 Quill 생성자 반환 */
export async function loadQuill() {
  loadCss('https://cdn.quilljs.com/1.3.6/quill.snow.css')
  await loadJs('https://cdn.quilljs.com/1.3.6/quill.js')
  return window.Quill
}

/** DOMPurify 3.0.6 로드 후 전역 DOMPurify 반환 */
export async function loadDOMPurify() {
  await loadJs('https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js')
  return window.DOMPurify
}
