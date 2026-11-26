import 'package:kakao_flutter_sdk/kakao_flutter_sdk.dart' as kakao;

import 'api_client.dart';

/// 계정 관리 — 지금은 회원 탈퇴 하나다.
///
/// **왜 있어야 하나:** Google Play 는 계정을 만들 수 있는 앱에
/// **앱 안에서의 계정 삭제 수단**을 요구한다. 없으면 심사에서 막힌다.
class AccountService {
  final ApiClient _api = ApiClient();

  /// 회원 탈퇴. 서버에서 계정·명함·이미지를 파기하고, 기기에 남은 세션도 정리한다.
  ///
  /// 파기 범위는 개인정보처리방침 §3 과 같다 —
  /// 결제 기록은 전자상거래법상 5년 보관 의무가 있어 서버에 남는다.
  Future<void> deleteAccount() async {
    await _api.deleteJson('/api/users/me');

    // 서버가 계정을 지우면 남은 토큰은 즉시 무효가 된다(백엔드가 사용자 존재를 확인한다).
    // 그래도 기기에 남겨 두면 다음 로그인 화면에서 옛 세션으로 오동작할 수 있어 지운다.
    _api.clearSession();
    await _unlinkKakao();
  }

  /// 카카오 연결 끊기. 실패해도 탈퇴 자체는 이미 끝났으므로 막지 않는다
  /// (연결이 남아 있어도 우리 서버에는 계정이 없다).
  Future<void> _unlinkKakao() async {
    try {
      await kakao.UserApi.instance.unlink();
    } catch (_) {
      // 무시 — 서버 계정 삭제가 본질이고, 카카오 연결은 사용자가 직접 해제할 수도 있다.
    }
  }
}
