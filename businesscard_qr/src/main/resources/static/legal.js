// 정적 문서(개인정보처리방침·계정 삭제 안내)의 한국어/영어 전환.
//
// 인라인 <script> 로 두지 않는 이유: CSP 가 script-src 'self' 라 인라인 스크립트는 실행되지 않는다
// (SecurityConfig.CSP). 'unsafe-inline' 을 열면 XSS 방어가 거의 사라지므로 파일로 뺐다.
// defer 로 싣기 때문에 실행 시점엔 문서가 다 그려져 있다.
(function () {
  var SUPPORTED = ["ko", "en"];

  function pick() {
    var query = new URLSearchParams(location.search).get("lang");
    if (SUPPORTED.indexOf(query) >= 0) return query;
    // 스토어 심사자·해외 이용자를 위해 브라우저 언어를 따른다. 한국어가 아니면 영어.
    var nav = (navigator.language || "ko").toLowerCase();
    return nav.indexOf("ko") === 0 ? "ko" : "en";
  }

  function apply(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll("[data-lang]").forEach(function (el) {
      el.hidden = el.dataset.lang !== lang;
    });
    document.querySelectorAll("[data-set-lang]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(btn.dataset.setLang === lang));
    });
  }

  document.querySelectorAll("[data-set-lang]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var lang = btn.dataset.setLang;
      apply(lang);
      // 스토어 콘솔에 언어별 URL 을 넣을 수 있도록 주소에도 반영한다.
      history.replaceState(null, "", "?lang=" + lang);
    });
  });

  apply(pick());
})();
