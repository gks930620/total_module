import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:image_picker/image_picker.dart';
import 'package:kakao_flutter_sdk/kakao_flutter_sdk.dart' as kakao;

import '../api_config.dart';
import '../models/business_card.dart';
import 'api_client.dart';
import 'app_exception.dart';

/// 명함 도메인 API.
///
/// 인증·재시도·응답 해석은 [ApiClient] 가 맡는다 — 결제·계정 서비스와 같은 세션을 쓰기 위해서다.
class BusinessCardService {
  final ApiClient _api = ApiClient();

  Future<void> syncUser(kakao.User _) async {
    await _api.refreshSession();
  }

  /// 명함 목록 페이징 조회 (최신 등록순). 무한스크롤로 page 를 올려가며 이어 붙인다.
  Future<BusinessCardPage> getBusinessCards({int page = 0, int size = 20}) async {
    final data = await _api.getJson(
      '/api/business-cards',
      queryParameters: {'page': '$page', 'size': '$size'},
    );
    if (data is! Map<String, dynamic>) {
      throw Exception('Invalid business card list response format.');
    }
    return BusinessCardPage.fromJson(data);
  }

  Future<BusinessCard> getBusinessCard(String id) async {
    final data = await _api.getJson('/api/business-cards/$id');
    if (data is! Map<String, dynamic>) {
      throw Exception('Invalid business card response format.');
    }
    return BusinessCard.fromJson(data);
  }

  /// 명함 저장(등록/수정).
  ///
  /// 무료 플랜 한도를 넘겨 등록하면 서버가 `CARD_LIMIT_EXCEEDED` 를 주고,
  /// [ApiClient] 가 그것을 [AppErrorReason.cardLimitExceeded] 로 바꿔 던진다.
  /// 화면은 그 사유를 보고 결제 안내를 띄운다.
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

    final response = await _api.send((accessToken) async {
      // 멀티파트 요청은 재전송이 불가능하므로 재시도마다 새로 생성한다.
      final request = http.MultipartRequest(
        isUpdate ? 'PUT' : 'POST',
        ApiConfig.uri(path),
      );
      request.headers.addAll(_api.authorizedHeaders(accessToken));
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

      final streamedResponse = await request.send().timeout(ApiClient.uploadTimeout);
      return http.Response.fromStream(streamedResponse).timeout(ApiClient.uploadTimeout);
    });

    final data = _api.extractData(response);
    if (data is! Map<String, dynamic> || data['id'] == null) {
      throw Exception('Invalid save response format.');
    }
    return data['id'].toString();
  }

  /// 명함 삭제. 성공 시 호출부가 목록 캐시에서 해당 명함만 제거한다 (목록 재조회 없음).
  Future<void> deleteBusinessCard(String id) async {
    await _api.deleteJson('/api/business-cards/$id');
  }

  // TODO: UI 연결 예정
  Future<void> incrementViewCount(String id) async {
    await _api.postJson('/api/business-cards/$id/view-count', const {});
  }

  Future<String> generateVcfDownloadToken(String cardId) async {
    final data = await _api.getJson('/api/business-cards/$cardId/vcf-download-url');
    return _requireUrl(data);
  }

  Future<String> generateImageDownloadToken(String cardId) async {
    final data = await _api.getJson('/api/business-cards/$cardId/image-download-url');
    return _requireUrl(data);
  }

  String _requireUrl(dynamic data) {
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
        throw const AppException(AppErrorReason.unsupportedImage);
    }
  }
}
