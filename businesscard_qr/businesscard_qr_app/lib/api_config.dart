import 'dart:io';
import 'package:flutter_dotenv/flutter_dotenv.dart';

class ApiConfig {
  static String get baseUrl {
    final configured =
        dotenv.env['GATEWAY_BASE_URL'] ?? dotenv.env['BACKEND_BASE_URL'];
    if (configured != null && configured.isNotEmpty) {
      return configured;
    }

    if (Platform.isAndroid) {
      return 'http://10.0.2.2:8080';
    }
    return 'http://localhost:8080';
  }

  static Uri uri(String path, {Map<String, String>? queryParameters}) {
    final normalizedPath = path.startsWith('/') ? path : '/$path';
    return Uri.parse('$baseUrl$normalizedPath').replace(queryParameters: queryParameters);
  }
}
