import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:kakao_flutter_sdk/kakao_flutter_sdk.dart' as kakao;
import '../api_config.dart';
import '../models/business_card.dart';

class BusinessCardService {
  static String? _backendAccessToken;
  static DateTime? _backendAccessTokenExpiresAt;

  Future<void> syncUser(kakao.User _) async {
    await _ensureBackendAccessToken(forceRefresh: true);
  }

  Future<List<BusinessCard>> getAllBusinessCards() async {
    final response = await http.get(
      ApiConfig.uri('/api/business-cards'),
      headers: await _authorizedHeaders(includeJsonContentType: false),
    );

    final data = _extractData(response);
    if (data is! List) {
      return [];
    }

    return data
        .whereType<Map<String, dynamic>>()
        .map((item) => BusinessCard.fromJson(item))
        .toList();
  }

  Future<BusinessCard> getBusinessCard(String id) async {
    final response = await http.get(
      ApiConfig.uri('/api/business-cards/$id'),
      headers: await _authorizedHeaders(includeJsonContentType: false),
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

    final request = http.MultipartRequest(
      isUpdate ? 'PUT' : 'POST',
      ApiConfig.uri(path),
    );
    request.headers.addAll(
      await _authorizedHeaders(includeJsonContentType: false),
    );

    final payload = Map<String, dynamic>.from(businessCard.toJson())
      ..removeWhere((key, value) => value == null);
    request.fields['payload'] = jsonEncode(payload);

    if (businessCardImage != null) {
      request.files.add(
        await http.MultipartFile.fromPath(
          'businessCardImage',
          businessCardImage.path,
        ),
      );
    }

    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    final data = _extractData(response);

    if (data is! Map<String, dynamic> || data['id'] == null) {
      throw Exception('Invalid save response format.');
    }
    return data['id'].toString();
  }

  Future<void> deleteBusinessCard(String id) async {
    final response = await http.delete(
      ApiConfig.uri('/api/business-cards/$id'),
      headers: await _authorizedHeaders(includeJsonContentType: false),
    );
    _extractData(response);
  }

  Future<void> incrementViewCount(String id) async {
    final response = await http.post(
      ApiConfig.uri('/api/business-cards/$id/view-count'),
      headers: await _authorizedHeaders(includeJsonContentType: false),
    );
    _extractData(response);
  }

  Future<String> generateVcfDownloadToken(String cardId) async {
    final response = await http.get(
      ApiConfig.uri('/api/business-cards/$cardId/vcf-download-url'),
      headers: await _authorizedHeaders(includeJsonContentType: false),
    );
    return _extractDownloadUrl(response);
  }

  Future<String> generateImageDownloadToken(String cardId) async {
    final response = await http.get(
      ApiConfig.uri('/api/business-cards/$cardId/image-download-url'),
      headers: await _authorizedHeaders(includeJsonContentType: false),
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

  Future<Map<String, String>> _authorizedHeaders({
    bool includeJsonContentType = true,
  }) async {
    final accessToken = await _ensureBackendAccessToken();
    final headers = <String, String>{
      'Accept': 'application/json',
      'Authorization': 'Bearer $accessToken',
    };
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
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
    final response = await http.post(
      ApiConfig.uri('/api/auth/kakao'),
      headers: const {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: jsonEncode({'kakaoAccessToken': kakaoAccessToken}),
    );

    final data = _extractData(response);
    if (data is! Map<String, dynamic>) {
      throw Exception('Invalid auth response format.');
    }

    final accessToken = data['accessToken']?.toString();
    final expiresIn = int.tryParse(data['expiresIn']?.toString() ?? '');
    if (accessToken == null || accessToken.isEmpty || expiresIn == null) {
      throw Exception('Auth token payload is invalid.');
    }

    _backendAccessToken = accessToken;
    _backendAccessTokenExpiresAt = now.add(Duration(seconds: expiresIn));
    return _backendAccessToken!;
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
    final bodyText = utf8.decode(response.bodyBytes);
    Map<String, dynamic> body;

    try {
      body = jsonDecode(bodyText) as Map<String, dynamic>;
    } catch (_) {
      throw Exception('Server response is not valid JSON. (${response.statusCode})');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        body['message']?.toString() ?? 'Request failed (${response.statusCode})',
      );
    }

    if (body['success'] != true) {
      throw Exception(body['message']?.toString() ?? 'Request failed');
    }

    return body['data'];
  }
}
