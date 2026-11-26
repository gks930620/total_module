/// 서비스 계층이 던지는 오류.
///
/// 서비스에는 `BuildContext` 가 없어 화면에 보일 문장을 만들 수 없다.
/// 그래서 **왜 실패했는지([reason])만 담아 던지고, 문장은 UI 가 만든다**
/// (`AppErrorText.of(l10n, error)`). 서비스에 한국어 문장을 박으면
/// 다른 언어에서 그대로 새어 나온다.
class AppException implements Exception {
  const AppException(
    this.reason, {
    this.statusCode,
    this.serverMessage,
    this.errorCode,
    this.cause,
  });

  final AppErrorReason reason;

  /// [AppErrorReason.server] 일 때의 HTTP 상태코드.
  final int? statusCode;

  /// 서버가 내려준 메시지. 우리가 아는 사유로 번역할 수 없을 때만 마지막으로 쓴다.
  final String? serverMessage;

  /// 서버가 내려준 기계용 코드(예: `CARD_LIMIT_EXCEEDED`).
  ///
  /// 문장이 아니라 **분기 조건**으로 쓰라고 있는 값이다. 메시지 문자열을 비교해
  /// 분기하면 서버 문구가 바뀌거나 번역되는 순간 조용히 깨진다.
  final String? errorCode;

  /// 원인 예외 — 로그용. 화면에 보여주지 않는다.
  final Object? cause;

  @override
  String toString() =>
      'AppException($reason, statusCode: $statusCode, errorCode: $errorCode, '
      'serverMessage: $serverMessage, cause: $cause)';
}

/// 사용자에게 설명할 수 있는 실패 사유. l10n 키와 1:1로 대응한다.
enum AppErrorReason {
  /// 응답이 제한 시간 안에 오지 않았다.
  timeout,

  /// Railway App Sleeping 콜드스타트 (502/503/504).
  serverWaking,

  /// 네트워크에 닿지 못했다.
  network,

  /// 그 밖의 서버 오류 — [AppException.statusCode] 를 같이 보여준다.
  server,

  /// 지원하지 않는 이미지 확장자.
  unsupportedImage,

  /// 이미지 내려받기 실패.
  imageDownload,

  /// 기기 저장소에 접근할 수 없다.
  storageDenied,

  /// 무료 플랜의 명함 등록 한도를 넘겼다. 화면은 이걸 보고 결제 안내를 띄운다.
  cardLimitExceeded,

  /// 스토어(Google Play / App Store)에 결제 확인을 못 했다. 잠시 후 재시도 안내.
  storeUnavailable,

  /// 이 기기에서 인앱결제를 쓸 수 없다(스토어 앱 없음·정책 제한 등).
  purchaseUnavailable,

  /// 스토어가 상품 정보를 주지 않았다(콘솔 미등록·심사 중·국가 미출시).
  productNotFound,

  /// 결제는 접수됐지만 승인 대기 중이다(계좌이체 등). 권한은 아직 없다.
  purchasePending,

  /// 분류하지 못한 오류.
  unknown,
}
