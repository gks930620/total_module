import '../l10n/app_localizations.dart';
import '../services/app_exception.dart';

/// 서비스가 던진 오류를 화면에 보일 문장으로 바꾼다.
///
/// 오류를 `'$e'` 로 그냥 찍으면 서비스 안의 한국어나 Dart 예외 문자열이
/// 언어와 무관하게 새어 나온다. 스낵바·다이얼로그는 항상 이 함수를 거친다.
abstract final class AppErrorText {
  static String of(AppLocalizations l10n, Object error) {
    if (error is! AppException) return l10n.errorUnknown;

    switch (error.reason) {
      case AppErrorReason.timeout:
        return l10n.errorTimeout;
      case AppErrorReason.serverWaking:
        return l10n.errorServerWaking;
      case AppErrorReason.network:
        return l10n.errorNetwork;
      case AppErrorReason.unsupportedImage:
        return l10n.errorUnsupportedImage;
      case AppErrorReason.imageDownload:
        return l10n.errorImageDownload;
      case AppErrorReason.storageDenied:
        return l10n.errorStorageDenied;
      case AppErrorReason.cardLimitExceeded:
        return l10n.errorCardLimitExceeded;
      case AppErrorReason.storeUnavailable:
        return l10n.storeUnavailable;
      case AppErrorReason.purchaseUnavailable:
        return l10n.errorPurchaseUnavailable;
      case AppErrorReason.productNotFound:
        return l10n.priceLoadFailed;
      case AppErrorReason.purchasePending:
        return l10n.purchasePending;
      case AppErrorReason.server:
        // 서버가 준 설명이 우리 사유보다 구체적일 때만 그대로 쓴다.
        // (백엔드 메시지는 아직 한국어 고정 — 서버 다국어는 별도 과제)
        final message = error.serverMessage;
        if (message != null && message.isNotEmpty) return message;
        final status = error.statusCode;
        return status == null ? l10n.errorUnknown : l10n.errorServer(status);
      case AppErrorReason.unknown:
        return l10n.errorUnknown;
    }
  }
}
