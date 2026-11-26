import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:kakao_flutter_sdk/kakao_flutter_sdk.dart' as kakao;

import '../api_config.dart';
import 'app_exception.dart';

/// 백엔드와 이야기하는 공통 창구 — 인증·재시도·응답 해석을 한 곳에 모은다.
///
/// **왜 따로 있나:** 명함과 결제가 같은 토큰을 써야 한다. 서비스마다 토큰 캐시를 따로
/// 두면 각자 갱신하느라 로그인 요청이 두 배가 되고, 한쪽만 만료를 갱신해 어긋난다.
/// 토큰 캐시를 `static` 으로 둔 것도 같은 이유다 — 인스턴스를 몇 개 만들든 세션은 하나다.
class ApiClient {
  static const Duration requestTimeout = Duration(seconds: 20);
  static const Duration uploadTimeout = Duration(seconds: 60);

  static String? _backendAccessToken;
  static String? _backendRefreshToken;
  static DateTime? _backendAccessTokenExpiresAt;

  /// 진행 중인 토큰 발급. 여러 요청이 동시에 시작해도 로그인은 한 번만 하도록 묶는다.
  ///
  /// 앱을 켜면 명함 목록과 결제 자격 조회가 같이 출발하는데, 이게 없으면 둘 다
  /// 캐시가 빈 것을 보고 각자 `/api/auth/kakao` 를 부른다. Railway 는 App Sleeping 이라
  /// 첫 호출이 콜드스타트로 수십 초 걸릴 수 있어 그 왕복이 두 배가 된다.
  static Future<String>? _inFlightAuth;

  /// 서버가 주는 기계용 오류 코드 → 앱이 아는 사유.
  /// 문장이 아니라 코드로 분기해야 서버 문구가 바뀌어도 안 깨진다.
  static const Map<String, AppErrorReason> _errorCodeReasons = {
    'CARD_LIMIT_EXCEEDED': AppErrorReason.cardLimitExceeded,
    'STORE_UNAVAILABLE': AppErrorReason.storeUnavailable,
  };

  /// 로그인 직후 호출 — 카카오 토큰으로 백엔드 세션을 새로 연다.
  Future<void> refreshSession() async {
    await ensureAccessToken(forceRefresh: true);
  }

  /// 로그아웃·회원탈퇴 뒤 호출 — 남은 토큰으로 다음 사용자가 이어 쓰지 않도록 지운다.
  void clearSession() {
    _backendAccessToken = null;
    _backendRefreshToken = null;
    _backendAccessTokenExpiresAt = null;
    // 진행 중이던 발급도 버린다 — 앞사람 카카오 토큰으로 받은 결과가
    // 다음 사용자에게 흘러가면 남의 데이터가 보인다.
    _inFlightAuth = null;
  }

  Map<String, String> authorizedHeaders(String accessToken) {
    return {'Accept': 'application/json', 'Authorization': 'Bearer $accessToken'};
  }

  // ── 편의 메서드 ─────────────────────────────────────────────

  Future<dynamic> getJson(String path, {Map<String, String>? queryParameters}) async {
    final response = await send(
      (accessToken) => http
          .get(
            ApiConfig.uri(path, queryParameters: queryParameters),
            headers: authorizedHeaders(accessToken),
          )
          .timeout(requestTimeout),
    );
    return extractData(response);
  }

  Future<dynamic> postJson(String path, Object body) async {
    final response = await send(
      (accessToken) => http
          .post(
            ApiConfig.uri(path),
            headers: {
              ...authorizedHeaders(accessToken),
              'Content-Type': 'application/json',
            },
            body: jsonEncode(body),
          )
          .timeout(requestTimeout),
    );
    return extractData(response);
  }

  Future<dynamic> deleteJson(String path) async {
    final response = await send(
      (accessToken) => http
          .delete(ApiConfig.uri(path), headers: authorizedHeaders(accessToken))
          .timeout(requestTimeout),
    );
    return extractData(response);
  }

  // ── 인증·재시도 ─────────────────────────────────────────────

  /// 인증이 필요한 요청을 보내고, 401이 오면 토큰을 갱신해 정확히 한 번만 재시도한다.
  /// 갱신 순서: refresh token → (실패 시) 카카오 토큰 기반 재로그인.
  Future<http.Response> send(
    Future<http.Response> Function(String accessToken) request,
  ) async {
    final accessToken = await ensureAccessToken();
    final response = await guardTimeout(() => request(accessToken));
    if (response.statusCode != 401) {
      return response;
    }

    // 401 응답: 캐시된 액세스 토큰 폐기
    _backendAccessToken = null;
    _backendAccessTokenExpiresAt = null;

    String? refreshedAccessToken;
    final refreshToken = _backendRefreshToken;
    if (refreshToken != null && refreshToken.isNotEmpty) {
      refreshedAccessToken = await _tryRefreshBackendToken(refreshToken);
    }
    final retryAccessToken =
        refreshedAccessToken ?? await ensureAccessToken(forceRefresh: true);

    // 단 한 번만 재시도 (무한 루프 방지)
    return guardTimeout(() => request(retryAccessToken));
  }

  Future<T> guardTimeout<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on TimeoutException {
      throw const AppException(AppErrorReason.timeout);
    } on SocketException catch (e) {
      throw AppException(AppErrorReason.network, cause: e);
    }
  }

  /// refresh token으로 새 액세스 토큰 발급을 시도한다. 실패하면 null을 반환하고
  /// 호출부에서 카카오 토큰 기반 재로그인으로 폴백한다.
  Future<String?> _tryRefreshBackendToken(String refreshToken) async {
    try {
      final response = await http
          .post(
            ApiConfig.uri('/api/auth/refresh'),
            headers: const {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'refreshToken': refreshToken}),
          )
          .timeout(requestTimeout);

      final data = extractData(response);
      if (data is! Map<String, dynamic>) {
        return null;
      }
      return _cacheBackendTokens(data);
    } catch (_) {
      _backendRefreshToken = null;
      return null;
    }
  }

  Future<String> ensureAccessToken({bool forceRefresh = false}) {
    final now = DateTime.now();
    final isTokenUsable =
        !forceRefresh &&
        _backendAccessToken != null &&
        _backendAccessTokenExpiresAt != null &&
        _backendAccessTokenExpiresAt!.isAfter(now.add(const Duration(seconds: 10)));

    if (isTokenUsable) {
      return Future.value(_backendAccessToken!);
    }

    // 이미 누가 발급받는 중이면 그 결과를 같이 기다린다(중복 로그인 방지).
    final inFlight = _inFlightAuth;
    if (inFlight != null && !forceRefresh) {
      return inFlight;
    }

    final request = _issueAccessToken();
    _inFlightAuth = request;
    // 성공이든 실패든 다음 요청이 새로 시도할 수 있게 비운다.
    return request.whenComplete(() {
      if (identical(_inFlightAuth, request)) {
        _inFlightAuth = null;
      }
    });
  }

  Future<String> _issueAccessToken() async {
    final kakaoAccessToken = await _requireKakaoAccessToken();
    final response = await guardTimeout(
      () => http
          .post(
            ApiConfig.uri('/api/auth/kakao'),
            headers: const {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'kakaoAccessToken': kakaoAccessToken}),
          )
          .timeout(requestTimeout),
    );

    final data = extractData(response);
    if (data is! Map<String, dynamic>) {
      throw Exception('Invalid auth response format.');
    }
    return _cacheBackendTokens(data);
  }

  /// 토큰 응답(data)을 파싱해 액세스/리프레시 토큰을 캐시하고 액세스 토큰을 반환한다.
  String _cacheBackendTokens(Map<String, dynamic> data) {
    final accessToken = data['accessToken']?.toString();
    final refreshToken = data['refreshToken']?.toString();
    final expiresIn = int.tryParse(data['expiresIn']?.toString() ?? '');
    if (accessToken == null || accessToken.isEmpty || expiresIn == null) {
      throw Exception('Auth token payload is invalid.');
    }

    _backendAccessToken = accessToken;
    _backendAccessTokenExpiresAt = DateTime.now().add(Duration(seconds: expiresIn));
    if (refreshToken != null && refreshToken.isNotEmpty) {
      _backendRefreshToken = refreshToken;
    }
    return accessToken;
  }

  Future<String> _requireKakaoAccessToken() async {
    if (!await kakao.AuthApi.instance.hasToken()) {
      throw Exception('Login is required.');
    }

    final token = await kakao.TokenManagerProvider.instance.manager.getToken();
    final accessToken = token?.accessToken;
    if (accessToken == null || accessToken.isEmpty) {
      throw Exception('Kakao access token is missing.');
    }
    return accessToken;
  }

  // ── 응답 해석 ──────────────────────────────────────────────

  dynamic extractData(http.Response response) {
    final statusCode = response.statusCode;

    // Railway/게이트웨이 인프라 오류 (콜드 스타트, 재배포 중 등) - HTML/텍스트 응답
    if (statusCode == 502 || statusCode == 503 || statusCode == 504) {
      throw const AppException(AppErrorReason.serverWaking);
    }

    Map<String, dynamic>? body;
    try {
      final decoded = jsonDecode(utf8.decode(response.bodyBytes));
      if (decoded is Map<String, dynamic>) {
        body = decoded;
      }
    } catch (_) {
      body = null;
    }

    if (body == null) {
      // JSON이 아닌 응답 (인프라 오류 페이지 등) - FormatException을 밖으로 내보내지 않는다.
      throw AppException(AppErrorReason.server, statusCode: statusCode);
    }

    final isFailure = statusCode < 200 || statusCode >= 300 || body['success'] != true;
    if (isFailure) {
      final errorCode = body['errorCode']?.toString();
      throw AppException(
        // 아는 코드면 앱이 번역한 문장을 쓰고, 모르는 코드면 서버 메시지로 떨어진다.
        _errorCodeReasons[errorCode] ?? AppErrorReason.server,
        statusCode: statusCode,
        serverMessage: body['message']?.toString(),
        errorCode: errorCode,
      );
    }

    return body['data'];
  }
}
