import 'package:flutter_dotenv/flutter_dotenv.dart';

class ApiConfig {
  // businesscard_qr 서비스의 자기 공개 도메인 (게이트웨이 은퇴 — 설계/아키텍처_방향결정.md)
  static const String _defaultBaseUrl =
      'https://businesscardqr-production.up.railway.app';

  static String get baseUrl {
    final configured =
        dotenv.env['BACKEND_BASE_URL'] ?? dotenv.env['GATEWAY_BASE_URL'];
    if (configured != null && configured.isNotEmpty) {
      return configured;
    }
    return _defaultBaseUrl;
  }

  static Uri uri(String path, {Map<String, String>? queryParameters}) {
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$baseUrl$normalizedPath').replace(queryParameters: queryParameters);
  }
}
