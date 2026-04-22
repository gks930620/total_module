import 'dart:io';
import 'dart:typed_data';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:crypto/crypto.dart';
import 'dart:convert';

class ImageCacheService {
  static final ImageCacheService _instance = ImageCacheService._internal();
  factory ImageCacheService() => _instance;
  ImageCacheService._internal();

  static const String _cacheFolderName = 'image_cache';
  static const Duration _cacheExpiration = Duration(days: 7);

  /// 캐시된 이미지 파일 경로를 반환하거나 네트워크에서 다운로드
  Future<File?> getCachedImage(String imageUrl) async {
    try {
      final cacheFile = await _getCacheFile(imageUrl);
      
      // 캐시된 파일이 존재하고 만료되지 않았다면 반환
      if (await cacheFile.exists()) {
        final stat = await cacheFile.stat();
        if (DateTime.now().difference(stat.modified) < _cacheExpiration) {
          return cacheFile;
        } else {
          // 만료된 캐시 파일 삭제
          await cacheFile.delete();
        }
      }

      // 네트워크에서 이미지 다운로드
      return await _downloadAndCacheImage(imageUrl, cacheFile);
    } catch (e) {
      print('이미지 캐시 처리 실패: $e');
      return null;
    }
  }

  /// 특정 이미지를 디바이스에 다운로드 (갤러리에 저장)
  Future<String> downloadImageToGallery(String imageUrl, String fileName) async {
    try {
      final response = await http.get(Uri.parse(imageUrl));
      if (response.statusCode != 200) {
        throw Exception('이미지 다운로드 실패: ${response.statusCode}');
      }

      // Downloads 디렉토리 가져오기
      final directory = await getExternalStorageDirectory();
      if (directory == null) {
        throw Exception('저장소 접근 권한이 없습니다');
      }

      // Downloads 폴더 생성
      final downloadsDir = Directory('${directory.path}/Downloads');
      if (!await downloadsDir.exists()) {
        await downloadsDir.create(recursive: true);
      }

      // 파일 저장
      final file = File('${downloadsDir.path}/$fileName');
      await file.writeAsBytes(response.bodyBytes);

      return file.path;
    } catch (e) {
      throw Exception('이미지 다운로드 실패: $e');
    }
  }

  /// 캐시 파일 경로 생성
  Future<File> _getCacheFile(String imageUrl) async {
    final cacheDir = await _getCacheDirectory();
    final fileName = _generateFileName(imageUrl);
    return File('${cacheDir.path}/$fileName');
  }

  /// 캐시 디렉토리 가져오기/생성
  Future<Directory> _getCacheDirectory() async {
    final appDir = await getApplicationDocumentsDirectory();
    final cacheDir = Directory('${appDir.path}/$_cacheFolderName');
    
    if (!await cacheDir.exists()) {
      await cacheDir.create(recursive: true);
    }
    
    return cacheDir;
  }

  /// URL을 기반으로 캐시 파일명 생성
  String _generateFileName(String url) {
    final bytes = utf8.encode(url);
    final digest = sha256.convert(bytes);
    final extension = url.split('.').last.split('?').first;
    return '${digest.toString()}.${extension.isNotEmpty ? extension : 'jpg'}';
  }

  /// 네트워크에서 이미지 다운로드 및 캐시
  Future<File?> _downloadAndCacheImage(String imageUrl, File cacheFile) async {
    try {
      final response = await http.get(Uri.parse(imageUrl));
      if (response.statusCode == 200) {
        await cacheFile.writeAsBytes(response.bodyBytes);
        return cacheFile;
      }
    } catch (e) {
      print('이미지 다운로드 실패: $e');
    }
    return null;
  }

  /// 캐시 크기 가져오기
  Future<int> getCacheSize() async {
    try {
      final cacheDir = await _getCacheDirectory();
      int totalSize = 0;
      
      await for (final entity in cacheDir.list()) {
        if (entity is File) {
          final stat = await entity.stat();
          totalSize += stat.size;
        }
      }
      
      return totalSize;
    } catch (e) {
      return 0;
    }
  }

  /// 캐시 정리 (만료된 파일들 삭제)
  Future<void> clearExpiredCache() async {
    try {
      final cacheDir = await _getCacheDirectory();
      
      await for (final entity in cacheDir.list()) {
        if (entity is File) {
          final stat = await entity.stat();
          if (DateTime.now().difference(stat.modified) > _cacheExpiration) {
            await entity.delete();
          }
        }
      }
    } catch (e) {
      print('캐시 정리 실패: $e');
    }
  }

  /// 전체 캐시 삭제
  Future<void> clearAllCache() async {
    try {
      final cacheDir = await _getCacheDirectory();
      
      await for (final entity in cacheDir.list()) {
        await entity.delete();
      }
    } catch (e) {
      print('캐시 삭제 실패: $e');
    }
  }
}