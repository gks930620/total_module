// 사업자 정보 — 유료 서비스를 파는 화면에 표시해야 한다(전자상거래법 제10조·제13조).
// 토스페이먼츠 가맹 심사도 사이트 하단에서 이 정보를 확인한다.
//
// ⚠️ 출시(실결제) 전에 채울 것. public/privacy.html · terms.html · account-deletion.html 의
//    [[...]] 자리표시자와 같은 값이다 — 한 곳만 고치면 문서와 화면이 서로 다른 말을 한다.
export const BUSINESS = Object.freeze({
  name: "[[사업자명]]",
  representative: "[[대표자]]",
  registrationNo: "[[사업자등록번호]]",
  mailOrderNo: "[[통신판매업 신고번호]]",
  address: "[[사업자주소]]",
  email: "[[연락처 이메일]]",
});
