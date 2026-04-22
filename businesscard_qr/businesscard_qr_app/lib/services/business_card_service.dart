import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:kakao_flutter_sdk/kakao_flutter_sdk.dart' as kakao;
import '../api_config.dart';
import '../models/business_card.dart';

class BusinessCardService {
  Future<void> syncUser(kakao.User kakaoUser) async {
    final userId = 'kakao_${kakaoUser.id}';
    final response = await http.post(
      ApiConfig.uri('/api/users/sync'),
      headers: _headers(),
      body: jsonEncode({
        'id': userId,
        'email': kakaoUser.kakaoAccount?.email,
        'nickname': kakaoUser.kakaoAccount?.profile?.nickname,
        'provider': 'kakao',
      }),
    );

    _extractData(response);
  }

  Future<List<BusinessCard>> getAllBusinessCards() async {
    final userId = await _requireCurrentUserId();
    final response = await http.get(
      ApiConfig.uri('/api/business-cards'),
      headers: _headers(userId: userId, includeJsonContentType: false),
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
    final userId = await _requireCurrentUserId();
    final response = await http.get(
      ApiConfig.uri('/api/business-cards/$id'),
      headers: _headers(userId: userId, includeJsonContentType: false),
    );

    final data = _extractData(response);
    if (data is! Map<String, dynamic>) {
      throw Exception('명함 응답 형식이 올바르지 않습니다.');
    }
    return BusinessCard.fromJson(data);
  }

  Future<String> saveBusinessCard({
    required BusinessCard businessCard,
    XFile? businessCardImage,
  }) async {
    final userId = await _requireCurrentUserId();
    final isUpdate = businessCard.id != null && businessCard.id!.isNotEmpty;
    final path = isUpdate
        ? '/api/business-cards/${businessCard.id}'
        : '/api/business-cards';

    final request = http.MultipartRequest(
      isUpdate ? 'PUT' : 'POST',
      ApiConfig.uri(path),
    );
    request.headers.addAll(
      _headers(userId: userId, includeJsonContentType: false),
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
      throw Exception('저장 응답 형식이 올바르지 않습니다.');
    }
    return data['id'].toString();
  }

  Future<void> deleteBusinessCard(String id) async {
    final userId = await _requireCurrentUserId();
    final response = await http.delete(
      ApiConfig.uri('/api/business-cards/$id'),
      headers: _headers(userId: userId, includeJsonContentType: false),
    );
    _extractData(response);
  }

  Future<void> incrementViewCount(String id) async {
    final userId = await _requireCurrentUserId();
    final response = await http.post(
      ApiConfig.uri('/api/business-cards/$id/view-count'),
      headers: _headers(userId: userId, includeJsonContentType: false),
    );
    _extractData(response);
  }

  Future<String> generateVcfDownloadToken(String cardId) async {
    final userId = await _requireCurrentUserId();
    final response = await http.get(
      ApiConfig.uri('/api/business-cards/$cardId/vcf-download-url'),
      headers: _headers(userId: userId, includeJsonContentType: false),
    );
    return _extractDownloadUrl(response);
  }

  Future<String> generateImageDownloadToken(String cardId) async {
    final userId = await _requireCurrentUserId();
    final response = await http.get(
      ApiConfig.uri('/api/business-cards/$cardId/image-download-url'),
      headers: _headers(userId: userId, includeJsonContentType: false),
    );
    return _extractDownloadUrl(response);
  }

  String _extractDownloadUrl(http.Response response) {
    final data = _extractData(response);
    if (data is! Map<String, dynamic> || data['url'] == null) {
      throw Exception('다운로드 URL 응답 형식이 올바르지 않습니다.');
    }
    return data['url'].toString();
  }

  Map<String, String> _headers({
    String? userId,
    bool includeJsonContentType = true,
  }) {
    final headers = <String, String>{'Accept': 'application/json'};
    if (includeJsonContentType) {
      headers['Content-Type'] = 'application/json';
    }
    if (userId != null && userId.isNotEmpty) {
      headers['X-User-Id'] = userId;
    }
    return headers;
  }

  dynamic _extractData(http.Response response) {
    final bodyText = utf8.decode(response.bodyBytes);
    Map<String, dynamic> body;

    try {
      body = jsonDecode(bodyText) as Map<String, dynamic>;
    } catch (_) {
      throw Exception('서버 응답을 읽을 수 없습니다. (${response.statusCode})');
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception(
        body['message']?.toString() ?? '요청 실패 (${response.statusCode})',
      );
    }

    if (body['success'] != true) {
      throw Exception(body['message']?.toString() ?? '요청 실패');
    }

    return body['data'];
  }

  Future<String> _requireCurrentUserId() async {
    final userId = await _getCurrentUserId();
    if (userId == null || userId.isEmpty) {
      throw Exception('로그인이 필요합니다.');
    }
    return userId;
  }

  Future<String?> _getCurrentUserId() async {
    try {
      if (await kakao.AuthApi.instance.hasToken()) {
        final user = await kakao.UserApi.instance.me();
        return 'kakao_${user.id}';
      }
      return null;
    } catch (_) {
      return null;
    }
  }
}
