import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';
import 'package:kakao_flutter_sdk/kakao_flutter_sdk.dart' as kakao;
import '../api_config.dart';
import '../models/business_card.dart';

class BusinessCardService {
  static const Duration _requestTimeout = Duration(seconds: 20);
  static const Duration _uploadTimeout = Duration(seconds: 60);
  static const String _timeoutMessage = '서버 응답이 없습니다. 잠시 후 다시 시도해주세요.';

  static String? _backendAccessToken;
  static String? _backendRefreshToken;
  static DateTime? _backendAccessTokenExpiresAt;

  Future<void> syncUser(kakao.User _) async {
    await _ensureBackendAccessToken(forceRefresh: true);
  }

  /// 명함 목록 페이징 조회 (최신 등록순). 무한스크롤로 page 를 올려가며 이어 붙인다.
  Future<BusinessCardPage> getBusinessCards({int page = 0, int size = 20}) async {
    final response = await _sendWithAuthRetry(
      (accessToken) => http
          .get(
            ApiConfig.uri(
              '/api/business-cards',
              queryParameters: {'page': '$page', 'size': '$size'},
            ),
            headers: _authorizedHeaders(accessToken),
          )
          .timeout(_requestTimeout),
    );

    final data = _extractData(response);
    if (data is! Map<String, dynamic>) {
      throw Exception('Invalid business card list response format.');
    }
    return BusinessCardPage.fromJson(data);
  }

  Future<BusinessCard> getBusinessCard(String id) async {
    final response = await _sendWithAuthRetry(
      (accessToken) => http
          .get(
            ApiConfig.uri('/api/business-cards/$id'),
            headers: _authorizedHeaders(accessToken),
          )
          .timeout(_requestTimeout),
    );

    final data = _extractData(response);
    if (data is! Map<String, dynamic>) {
      throw Exception('Invalid business card response format.');
    }
    return BusinessCard.fromJson(data);
  }

  Future<String> saveBusinessCard({
    required BusinessCard businessCard,
    XFile? businessCardImage,
  }) async {
    final isUpdate = businessCard.id != null && businessCard.id!.isNotEmpty;
    final path = isUpdate
        ? '/api/business-cards/${businessCard.id}'
        : '/api/business-cards';

    final payload = Map<String, dynamic>.from(businessCard.toJson())
      ..removeWhere((key, value) => value == null);

    // 업로드 전에 이미지 형식을 검증한다.
    // (백엔드는 image/* Content-Type과 jpg/jpeg/png/gif/bmp/webp 확장자만 허용)
    final MediaType? imageContentType = businessCardImage != null
        ? _imageMediaTypeForPath(businessCardImage.path)
        : null;

    final response = await _sendWithAuthRetry((accessToken) async {
      // 멀티파트 요청은 재전송이 불가능하므로 재시도마다 새로 생성한다.
      final request = http.MultipartRequest(
        isUpdate ? 'PUT' : 'POST',
        ApiConfig.uri(path),
      );
      request.headers.addAll(_authorizedHeaders(accessToken));
      request.fields['payload'] = jsonEncode(payload);

      if (businessCardImage != null) {
        request.files.add(
          await http.MultipartFile.fromPath(
            'businessCardImage',
            businessCardImage.path,
            contentType: imageContentType,
          ),
        );
      }

      final streamedResponse = await request.send().timeout(_uploadTimeout);
      return http.Response.fromStream(streamedResponse).timeout(_uploadTimeout);
    });

    final data = _extractData(response);
    if (data is! Map<String, dynamic> || data['id'] == null) {
      throw Exception('Invalid save response format.');
    }
    return data['id'].toString();
  }

  /// 명함 삭제. 성공 시 호출부가 목록 캐시에서 해당 명함만 제거한다 (목록 재조회 없음).
  Future<void> deleteBusinessCard(String id) async {
    final response = await _sendWithAuthRetry(
      (accessToken) => http
          .delete(
            ApiConfig.uri('/api/business-cards/$id'),
            headers: _authorizedHeaders(accessToken),
          )
          .timeout(_requestTimeout),
    );
    _extractData(response);
  }

  // TODO: UI 연결 예정
  Future<void> incrementViewCount(String id) async {
    final response = await _sendWithAuthRetry(
      (accessToken) => http
          .post(
            ApiConfig.uri('/api/business-cards/$id/view-count'),
            headers: _authorizedHeaders(accessToken),
          )
          .timeout(_requestTimeout),
    );
    _extractData(response);
  }

  Future<String> generateVcfDownloadToken(String cardId) async {
    final response = await _sendWithAuthRetry(
      (accessToken) => http
          .get(
            ApiConfig.uri('/api/business-cards/$cardId/vcf-download-url'),
            headers: _authorizedHeaders(accessToken),
          )
          .timeout(_requestTimeout),
    );
    return _extractDownloadUrl(response);
  }

  Future<String> generateImageDownloadToken(String cardId) async {
    final response = await _sendWithAuthRetry(
      (accessToken) => http
          .get(
            ApiConfig.uri('/api/business-cards/$cardId/image-download-url'),
            headers: _authorizedHeaders(accessToken),
          )
          .timeout(_requestTimeout),
    );
    return _extractDownloadUrl(response);
  }

  String _extractDownloadUrl(http.Response response) {
    final data = _extractData(response);
    if (data is! Map<String, dynamic> || data['url'] == null) {
      throw Exception('Invalid download URL response format.');
    }
    return data['url'].toString();
  }

  /// 파일 확장자를 기반으로 업로드에 사용할 이미지 Content-Type을 결정한다.
  /// 지원하지 않는 확장자(.heic 등)는 업로드 전에 명확한 오류를 던진다.
  MediaType _imageMediaTypeForPath(String filePath) {
    final extension = filePath.split('.').last.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return MediaType('image', 'jpeg');
      case 'png':
        return MediaType('image', 'png');
      case 'gif':
        return MediaType('image', 'gif');
      case 'bmp':
        return MediaType('image', 'bmp');
      case 'webp':
        return MediaType('image', 'webp');
      default:
        throw Exception('지원하지 않는 이미지 형식입니다 (jpg/png/gif/bmp/webp)');
    }
  }

  Map<String, String> _authorizedHeaders(String accessToken) {
    return {
      'Accept': 'application/json',
      'Authorization': 'Bearer $accessToken',
    };
  }

  /// 인증이 필요한 요청을 보내고, 401이 오면 토큰을 갱신해 정확히 한 번만 재시도한다.
  /// 갱신 순서: refresh token → (실패 시) 카카오 토큰 기반 재로그인.
  Future<http.Response> _sendWithAuthRetry(
    Future<http.Response> Function(String accessToken) send,
  ) async {
    final accessToken = await _ensureBackendAccessToken();
    final response = await _guardTimeout(() => send(accessToken));
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
    final retryAccessToken = refreshedAccessToken ??
        await _ensureBackendAccessToken(forceRefresh: true);

    // 단 한 번만 재시도 (무한 루프 방지)
    return _guardTimeout(() => send(retryAccessToken));
  }

  Future<T> _guardTimeout<T>(Future<T> Function() run) async {
    try {
      return await run();
    } on TimeoutException {
      throw Exception(_timeoutMessage);
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
          .timeout(_requestTimeout);

      final data = _extractData(response);
      if (data is! Map<String, dynamic>) {
        return null;
      }
      return _cacheBackendTokens(data);
    } catch (_) {
      _backendRefreshToken = null;
      return null;
    }
  }

  Future<String> _ensureBackendAccessToken({bool forceRefresh = false}) async {
    final now = DateTime.now();
    final isTokenUsable =
        !forceRefresh &&
        _backendAccessToken != null &&
        _backendAccessTokenExpiresAt != null &&
        _backendAccessTokenExpiresAt!.isAfter(now.add(const Duration(seconds: 10)));

    if (isTokenUsable) {
      return _backendAccessToken!;
    }

    final kakaoAccessToken = await _requireKakaoAccessToken();
    final response = await _guardTimeout(
      () => http
          .post(
            ApiConfig.uri('/api/auth/kakao'),
            headers: const {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'kakaoAccessToken': kakaoAccessToken}),
          )
          .timeout(_requestTimeout),
    );

    final data = _extractData(response);
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
    _backendAccessTokenExpiresAt =
        DateTime.now().add(Duration(seconds: expiresIn));
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

  dynamic _extractData(http.Response response) {
    final statusCode = response.statusCode;

    // Railway/게이트웨이 인프라 오류 (콜드 스타트, 재배포 중 등) - HTML/텍스트 응답
    if (statusCode == 502 || statusCode == 503 || statusCode == 504) {
      throw Exception('서버가 깨어나는 중입니다. 잠시 후 다시 시도해주세요.');
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
      throw Exception('서버 오류 ($statusCode)');
    }

    if (statusCode < 200 || statusCode >= 300) {
      throw Exception(
        body['message']?.toString() ?? '서버 오류 ($statusCode)',
      );
    }

    if (body['success'] != true) {
      throw Exception(body['message']?.toString() ?? 'Request failed');
    }

    return body['data'];
  }
}
