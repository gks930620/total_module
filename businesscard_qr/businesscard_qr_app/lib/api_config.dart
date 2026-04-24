import 'package:flutter_dotenv/flutter_dotenv.dart';

class ApiConfig {
  static const String _defaultGatewayBaseUrl =
      'https://distapigateway-production.up.railway.app';

  static String get baseUrl {
    final configured =
        dotenv.env['GATEWAY_BASE_URL'] ?? dotenv.env['BACKEND_BASE_URL'];
    if (configured != null && configured.isNotEmpty) {
      return configured;
    }
    return _defaultGatewayBaseUrl;
  }

  static Uri uri(String path, {Map<String, String>? queryParameters}) {
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$baseUrl$normalizedPath').replace(queryParameters: queryParameters);
  }
}
