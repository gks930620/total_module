import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:kakao_flutter_sdk/kakao_flutter_sdk.dart' as kakao;
import 'dart:io';
import 'models/business_card.dart';
import 'services/business_card_service.dart';
import 'services/image_cache_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 화면 회전 비활성화 (세로 모드만 허용)
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // .env 파일 로드 (실패해도 앱은 뜨도록 방어)
  String? kakaoNativeAppKey;
  try {
    await dotenv.load(fileName: ".env");
    kakaoNativeAppKey = dotenv.env['KAKAO_NATIVE_APP_KEY'];
  } catch (e) {
    print('[BOOT] .env 로드 실패: $e');
  }

  if (kakaoNativeAppKey == null || kakaoNativeAppKey.isEmpty) {
    // 설정 누락 시 크래시 대신 에러 화면 표시
    runApp(
      const ConfigErrorApp(
        message: 'KAKAO_NATIVE_APP_KEY가 설정되지 않았습니다 (.env 확인)',
      ),
    );
    return;
  }

  // 카카오 SDK 초기화
  kakao.KakaoSdk.init(nativeAppKey: kakaoNativeAppKey);

  runApp(const BusinessCardApp());
}

/// 필수 설정이 없을 때 크래시 대신 보여주는 간단한 에러 화면
class ConfigErrorApp extends StatelessWidget {
  final String message;

  const ConfigErrorApp({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '명함 QR코드',
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 64, color: Colors.red),
                const SizedBox(height: 16),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 16),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class BusinessCardApp extends StatelessWidget {
  const BusinessCardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '명함 QR코드',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2196F3),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            textStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
      home: const HomeScreen(),
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final BusinessCardService _businessCardService = BusinessCardService();
  bool _isChecking = true;

  @override
  void initState() {
    super.initState();
    _checkLoginStatus();
  }

  // 로그인 상태 체크
  Future<void> _checkLoginStatus() async {
    try {
      print('[AUTO_LOGIN] 로그인 상태 확인 중...');
      // 카카오 토큰이 있는지 확인
      if (await kakao.AuthApi.instance.hasToken()) {
        print('[AUTO_LOGIN] 토큰 발견! 사용자 정보 확인 중...');
        try {
          // 토큰으로 사용자 정보 조회 (토큰 유효성 검증)
          kakao.User user = await kakao.UserApi.instance.me();
          print('[AUTO_LOGIN] 로그인 유효! 사용자 ID: ${user.id}');

          // 자동 로그인 성공 - 목록 화면으로 이동
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (context) => const BusinessCardListScreen(),
              ),
            );
          }
          return;
        } catch (e) {
          print('[AUTO_LOGIN] 토큰 만료 또는 유효하지 않음: $e');
          // 토큰이 유효하지 않으면 로그인 화면 표시
        }
      } else {
        print('[AUTO_LOGIN] 저장된 토큰 없음');
      }
    } catch (e) {
      print('[AUTO_LOGIN] 로그인 상태 확인 실패: $e');
    }

    // 로그인 필요 - 현재 화면(로그인 화면) 유지
    if (mounted) {
      setState(() {
        _isChecking = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // 로그인 상태 체크 중이면 로딩 표시
    if (_isChecking) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      body: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(32),
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFF8F9FA), Color(0xFFE9ECEF)],
          ),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.qr_code, size: 120, color: Color(0xFF2196F3)),
            const SizedBox(height: 32),
            const Text(
              '명함 QR코드',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: Color(0xFF212529),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'QR코드로 간편하게 명함을 공유하세요',
              style: TextStyle(fontSize: 16, color: Color(0xFF6C757D)),
            ),
            const SizedBox(height: 64),
            ElevatedButton(
              onPressed: () async {
                await _loginWithKakao(context);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFEE500),
                foregroundColor: Colors.black,
                padding: const EdgeInsets.symmetric(
                  horizontal: 40,
                  vertical: 16,
                ),
              ),
              child: const Text(
                '카카오로 로그인',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _loginWithKakao(BuildContext context) async {
    try {
      print('[LOGIN] 카카오 로그인 시작');

      // 카카오 로그인
      bool isInstalled = await kakao.isKakaoTalkInstalled();
      print('[LOGIN] 카카오톡 설치 여부: $isInstalled');

      kakao.OAuthToken token;
      if (isInstalled) {
        print('[LOGIN] 카카오톡으로 로그인 시도');
        token = await kakao.UserApi.instance.loginWithKakaoTalk();
      } else {
        print('[LOGIN] 카카오 계정으로 로그인 시도');
        token = await kakao.UserApi.instance.loginWithKakaoAccount();
      }

      print('[LOGIN] 카카오 로그인 성공: ${token.accessToken.substring(0, 10)}...');

      // 카카오 사용자 정보 가져오기
      print('[LOGIN] 사용자 정보 가져오는 중...');
      kakao.User user = await kakao.UserApi.instance.me();
      print('[LOGIN] 사용자 정보 획득 성공: ${user.id}');

      print('[LOGIN] 백엔드 사용자 정보 동기화 중...');
      await _syncUserToBackend(user);
      print('[LOGIN] 백엔드 동기화 완료');

      // 명함 목록 화면으로 이동
      print('[LOGIN] 명함 목록 화면으로 이동 중...');
      if (context.mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => const BusinessCardListScreen(),
          ),
        );
        print('[LOGIN] 네비게이션 완료');
      }
    } catch (error, stackTrace) {
      print('[LOGIN] 카카오 로그인 실패: $error');
      print('[LOGIN] 스택트레이스: $stackTrace');
      if (context.mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('로그인 실패: $error')));
      }
    }
  }

  Future<void> _syncUserToBackend(kakao.User kakaoUser) async {
    try {
      await _businessCardService.syncUser(kakaoUser);

      print('사용자 정보 백엔드 동기화 완료');
    } catch (e) {
      print('백엔드 사용자 동기화 실패: $e');
      throw Exception('사용자 정보 동기화에 실패했습니다: $e');
    }
  }
}

class BusinessCardListScreen extends StatefulWidget {
  const BusinessCardListScreen({super.key});

  @override
  State<BusinessCardListScreen> createState() => _BusinessCardListScreenState();
}

class _BusinessCardListScreenState extends State<BusinessCardListScreen> {
  // 캐시 전략: 목록은 페이지 단위(무한스크롤)로 이어 붙여 메모리에 유지하고,
  // 등록/수정/삭제 후에는 목록 API 재조회 없이 캐시만 갱신한 뒤 맨 위(1페이지)부터 보여준다.
  static const int _pageSize = 20;

  final BusinessCardService _businessCardService = BusinessCardService();
  final ScrollController _scrollController = ScrollController();
  List<BusinessCard> _businessCards = [];
  bool _isLoading = true; // 첫 페이지 로딩
  bool _isLoadingMore = false; // 다음 페이지 로딩
  bool _hasMore = true; // 더 가져올 페이지가 있는지
  int _nextPage = 0; // 다음에 요청할 페이지 번호

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadFirstPage();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_isLoading || _isLoadingMore || !_hasMore) return;
    // 바닥 근처(200px)에 오면 다음 페이지 로드
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      _loadNextPage();
    }
  }

  /// 첫 페이지 로드(진입 시 1회). 당겨서 새로고침 시에도 여기로 리셋된다.
  Future<void> _loadFirstPage() async {
    try {
      print('[UI] 명함 목록 1페이지 로딩 시작');
      final page = await _businessCardService.getBusinessCards(
        page: 0,
        size: _pageSize,
      );
      if (!mounted) return;
      setState(() {
        _businessCards = page.cards;
        _hasMore = !page.last;
        _nextPage = 1;
        _isLoading = false;
      });
      print('[UI] 1페이지 로딩 성공: ${page.cards.length}개 (hasMore=$_hasMore)');
    } catch (e) {
      print('[UI] 명함 목록 로딩 에러: $e');
      if (!mounted) return;
      setState(() {
        _isLoading = false;
      });
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('명함을 불러오는데 실패했습니다: $e')));
    }
  }

  /// 스크롤이 바닥에 닿으면 다음 페이지를 이어 붙인다.
  Future<void> _loadNextPage() async {
    setState(() {
      _isLoadingMore = true;
    });
    try {
      final page = await _businessCardService.getBusinessCards(
        page: _nextPage,
        size: _pageSize,
      );
      if (!mounted) return;
      setState(() {
        _businessCards.addAll(page.cards);
        _hasMore = !page.last;
        _nextPage += 1;
        _isLoadingMore = false;
      });
    } catch (e) {
      print('[UI] 다음 페이지 로딩 에러: $e');
      if (!mounted) return;
      setState(() {
        _isLoadingMore = false; // 실패해도 스크롤 재시도 가능
      });
    }
  }

  /// 등록/수정/삭제 후 캐시 기준으로 목록 맨 위(1페이지)부터 보여준다.
  void _showFromFirstPage() {
    if (_scrollController.hasClients) {
      _scrollController.jumpTo(0);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('내 명함'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () async {
              // 로그아웃 확인 다이얼로그
              final confirm = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('로그아웃'),
                  content: const Text('로그아웃 하시겠습니까?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('취소'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('로그아웃'),
                    ),
                  ],
                ),
              );

              if (confirm == true && context.mounted) {
                try {
                  // 카카오 로그아웃
                  await kakao.UserApi.instance.logout();
                  print('[LOGOUT] 카카오 로그아웃 성공');

                  // 로그인 화면으로 이동
                  if (context.mounted) {
                    Navigator.pushReplacement(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const HomeScreen(),
                      ),
                    );
                  }
                } catch (e) {
                  print('[LOGOUT] 로그아웃 실패: $e');
                  if (context.mounted) {
                    ScaffoldMessenger.of(
                      context,
                    ).showSnackBar(SnackBar(content: Text('로그아웃 실패: $e')));
                  }
                }
              }
            },
          ),
          // 새로고침 버튼 없음(의도): 목록은 진입 시 1회 로드 후 메모리 유지하고,
          // 등록/수정/삭제 결과가 돌아올 때만 갱신한다 (서버 재조회 최소화).
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: [
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: () async {
                  final result = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const BusinessCardFormScreen(),
                    ),
                  );
                  if (!mounted) return;
                  if (result is String) {
                    // 추가: 등록 API 성공 후 새 명함만 조회해 캐시 최상단에 추가 (목록 재조회 없음)
                    try {
                      final newCard = await _businessCardService
                          .getBusinessCard(result);
                      if (!mounted) return;
                      setState(() {
                        _businessCards.insert(0, newCard);
                      });
                      _showFromFirstPage(); // 1페이지(맨 위)부터 보여주기
                    } catch (e) {
                      print('[목록] 새 명함 조회 실패: $e');
                      _loadFirstPage(); // 실패 시 폴백: 1페이지 재조회
                    }
                  } else if (result == true) {
                    _loadFirstPage(); // 폴백
                  }
                },
                icon: const Icon(Icons.add),
                label: const Text(
                  '명함 추가하기',
                  style: TextStyle(
                    fontSize: 22.4, // 16 * 1.4 = 22.4 (40% 증가)
                    fontWeight: FontWeight.w600,
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  foregroundColor: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 24),
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _businessCards.isEmpty
                  ? const Center(
                      child: Text(
                        '아직 등록된 명함이 없습니다.\n위의 버튼을 눌러 명함을 추가해보세요!',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 16,
                          color: Color(0xFF6C757D),
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _loadFirstPage,
                      child: ListView.builder(
                        controller: _scrollController,
                        // 더 가져올 페이지가 있으면 마지막에 로딩 행 1개 추가
                        itemCount: _businessCards.length + (_hasMore ? 1 : 0),
                        padding: const EdgeInsets.only(
                          bottom: 80,
                        ), // 네비게이션 바 여백
                        itemBuilder: (context, index) {
                          // 무한스크롤 로딩 행
                          if (index >= _businessCards.length) {
                            return const Padding(
                              padding: EdgeInsets.symmetric(vertical: 16),
                              child: Center(child: CircularProgressIndicator()),
                            );
                          }
                          final card = _businessCards[index];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: InkWell(
                              onTap: () async {
                                final result = await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) =>
                                        BusinessCardViewScreen(
                                          businessCard: card,
                                        ),
                                  ),
                                );
                                if (!mounted) return;
                                if (result is BusinessCard) {
                                  // 수정: 수정 API 성공 후 해당 명함만 캐시에서 교체 (목록 재조회 없음)
                                  setState(() {
                                    final index = _businessCards.indexWhere(
                                      (c) => c.id == result.id,
                                    );
                                    if (index != -1) {
                                      _businessCards[index] = result;
                                    }
                                  });
                                  _showFromFirstPage();
                                } else if (result is Map &&
                                    result['deletedId'] is String) {
                                  // 삭제: 삭제 API 성공 후 해당 명함만 캐시에서 제거 (목록 재조회 없음)
                                  setState(() {
                                    _businessCards.removeWhere(
                                      (c) => c.id == result['deletedId'],
                                    );
                                  });
                                  _showFromFirstPage();
                                } else if (result == true) {
                                  _loadFirstPage(); // 전체 새로고침 (폴백)
                                }
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 20,
                                  horizontal: 16,
                                ),
                                child: Center(
                                  child: Text(
                                    card.fullName,
                                    style: const TextStyle(
                                      fontSize:
                                          22.4, // 16 * 1.4 = 22.4 (40% 증가)
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class BusinessCardFormScreen extends StatefulWidget {
  final BusinessCard? businessCard;

  const BusinessCardFormScreen({super.key, this.businessCard});

  @override
  State<BusinessCardFormScreen> createState() => _BusinessCardFormScreenState();
}

class _BusinessCardFormScreenState extends State<BusinessCardFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fnController = TextEditingController();
  final _orgController = TextEditingController();
  final _titleController = TextEditingController();
  final _telController = TextEditingController();
  final _emailController = TextEditingController();
  final _urlController = TextEditingController();
  final _adrController = TextEditingController();
  final _noteController = TextEditingController();

  final ImagePicker _picker = ImagePicker();
  final BusinessCardService _businessCardService = BusinessCardService();
  XFile? _businessCardImage;
  bool _isLoading = false;
  bool _isEditMode = false;

  @override
  void initState() {
    super.initState();
    _isEditMode = widget.businessCard != null;
    if (_isEditMode) {
      _loadExistingData();
    }
  }

  void _loadExistingData() {
    final card = widget.businessCard!;
    _fnController.text = card.fullName;
    _orgController.text = card.organization ?? '';
    _titleController.text = card.title ?? '';
    _telController.text = card.phone ?? '';
    _emailController.text = card.email ?? '';
    _urlController.text = card.website ?? '';
    _adrController.text = card.address ?? '';
    _noteController.text = card.note ?? '';
  }

  @override
  void dispose() {
    _fnController.dispose();
    _orgController.dispose();
    _titleController.dispose();
    _telController.dispose();
    _emailController.dispose();
    _urlController.dispose();
    _adrController.dispose();
    _noteController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditMode ? '명함 수정' : '명함 등록'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          _isLoading
              ? const Padding(
                  padding: EdgeInsets.all(16),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : TextButton(
                  onPressed: _saveBusinessCard,
                  child: const Text(
                    '저장',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 명함 이미지 업로드 (최상단)
              const Text(
                '명함 이미지',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),

              GestureDetector(
                onTap: _pickBusinessCardImage,
                child: Container(
                  width: double.infinity,
                  height: 240,
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey[300]!),
                  ),
                  child: _businessCardImage != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.file(
                            File(_businessCardImage!.path),
                            width: double.infinity,
                            height: 240,
                            fit: BoxFit.contain,
                          ),
                        )
                      : (_isEditMode &&
                            widget.businessCard!.businessCardImageUrl != null)
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(
                            widget.businessCard!.businessCardImageUrl!,
                            width: double.infinity,
                            height: 240,
                            fit: BoxFit.contain,
                          ),
                        )
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.image,
                              size: 60,
                              color: Colors.grey,
                            ),
                            const SizedBox(height: 8),
                            TextButton.icon(
                              onPressed: _pickBusinessCardImage,
                              icon: const Icon(Icons.add_photo_alternate),
                              label: const Text('명함 이미지 추가'),
                            ),
                          ],
                        ),
                ),
              ),

              if (_businessCardImage != null ||
                  (_isEditMode &&
                      widget.businessCard!.businessCardImageUrl != null))
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: TextButton.icon(
                    onPressed: _pickBusinessCardImage,
                    icon: const Icon(Icons.edit),
                    label: const Text('이미지 변경'),
                  ),
                ),

              const SizedBox(height: 32),

              const Text(
                '기본 정보',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),

              _buildTextField(
                controller: _fnController,
                label: '성명 (연락처에 저장될 이름) *',
                hint: '홍길동',
                validator: (value) =>
                    value?.isEmpty ?? true ? '성명을 입력해주세요' : null,
              ),

              const SizedBox(height: 24),

              const Text(
                '연락처 정보',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),

              _buildTextField(
                controller: _telController,
                label: '전화번호 *',
                hint: '01012345678',
                keyboardType: TextInputType.number,
                validator: (value) =>
                    value?.isEmpty ?? true ? '전화번호를 입력해주세요' : null,
              ),

              _buildTextField(
                controller: _emailController,
                label: '이메일',
                hint: 'example@email.com',
                keyboardType: TextInputType.emailAddress,
              ),

              _buildTextField(
                controller: _urlController,
                label: '웹사이트',
                hint: 'https://example.com',
                keyboardType: TextInputType.url,
              ),

              const SizedBox(height: 24),

              const Text(
                '조직 정보',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),

              _buildTextField(
                controller: _orgController,
                label: '조직/회사',
                hint: '(주)예시회사',
              ),

              _buildTextField(
                controller: _titleController,
                label: '직책',
                hint: '개발팀장',
              ),

              const SizedBox(height: 24),

              const Text(
                '주소 정보',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),

              _buildTextField(
                controller: _adrController,
                label: '주소',
                hint: '서울특별시 강남구 테헤란로 123',
                maxLines: 2,
              ),

              const SizedBox(height: 24),

              const Text(
                '추가 정보',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),

              _buildTextField(
                controller: _noteController,
                label: '메모',
                hint: '추가 정보나 특별한 메시지',
                maxLines: 3,
              ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    String? hint,
    String? helperText,
    TextInputType? keyboardType,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          helperText: helperText,
          border: const OutlineInputBorder(),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 12,
          ),
        ),
        keyboardType: keyboardType,
        maxLines: maxLines,
        validator: validator,
      ),
    );
  }

  Future<void> _pickBusinessCardImage() async {
    showModalBottomSheet(
      context: context,
      builder: (BuildContext context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Icon(Icons.camera),
                title: const Text('카메라'),
                onTap: () async {
                  Navigator.pop(context);
                  final image = await _picker.pickImage(
                    source: ImageSource.camera,
                    imageQuality: 85, // iOS에서 HEIC 대신 JPEG로 재인코딩
                  );
                  if (!mounted) return;
                  if (image != null) {
                    setState(() {
                      _businessCardImage = image;
                    });
                  }
                },
              ),
              ListTile(
                leading: const Icon(Icons.photo_library),
                title: const Text('갤러리'),
                onTap: () async {
                  Navigator.pop(context);
                  final image = await _picker.pickImage(
                    source: ImageSource.gallery,
                    imageQuality: 85, // iOS에서 HEIC 대신 JPEG로 재인코딩
                  );
                  if (!mounted) return;
                  if (image != null) {
                    setState(() {
                      _businessCardImage = image;
                    });
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _saveBusinessCard() async {
    print('=== 명함 저장 시작 ===');

    if (_formKey.currentState!.validate()) {
      setState(() {
        _isLoading = true;
      });

      try {
        print('명함 데이터 생성 중...');
        final businessCard = BusinessCard(
          id: _isEditMode ? widget.businessCard!.id : null,
          fullName: _fnController.text,
          phone: _telController.text.isNotEmpty ? _telController.text : null,
          email: _emailController.text.isNotEmpty
              ? _emailController.text
              : null,
          website: _urlController.text.isNotEmpty ? _urlController.text : null,
          organization: _orgController.text.isNotEmpty
              ? _orgController.text
              : null,
          title: _titleController.text.isNotEmpty
              ? _titleController.text
              : null,
          address: _adrController.text.isNotEmpty ? _adrController.text : null,
          note: _noteController.text.isNotEmpty ? _noteController.text : null,
          businessCardImageUrl: _isEditMode
              ? widget.businessCard!.businessCardImageUrl
              : null,
        );

        print(
          '명함 정보: ${businessCard.fullName}, 명함이미지: ${_businessCardImage?.path}',
        );

        print('BusinessCardService.saveBusinessCard 호출 중...');
        final savedCardId = await _businessCardService.saveBusinessCard(
          businessCard: businessCard,
          businessCardImage: _businessCardImage,
        );

        print('명함 저장 성공! ID: $savedCardId');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                _isEditMode ? '명함이 성공적으로 수정되었습니다' : '명함이 성공적으로 저장되었습니다',
              ),
            ),
          );
          // 등록 시: cardId 반환, 수정 시: true 반환
          Navigator.pop(context, _isEditMode ? true : savedCardId);
        }
      } catch (e, stackTrace) {
        print('=== 명함 저장 에러 ===');
        print('에러: $e');
        print('스택트레이스: $stackTrace');
        print('========================');

        if (mounted) {
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('저장 중 오류가 발생했습니다: $e')));
        }
      } finally {
        if (mounted) {
          setState(() {
            _isLoading = false;
          });
        }
        print('=== 명함 저장 완료 ===');
      }
    } else {
      print('폼 유효성 검사 실패');
    }
  }
}

class BusinessCardViewScreen extends StatefulWidget {
  final BusinessCard businessCard;

  const BusinessCardViewScreen({super.key, required this.businessCard});

  @override
  State<BusinessCardViewScreen> createState() => _BusinessCardViewScreenState();
}

class _BusinessCardViewScreenState extends State<BusinessCardViewScreen> {
  final BusinessCardService _businessCardService = BusinessCardService();
  final ImageCacheService _imageCacheService = ImageCacheService();
  File? _cachedBusinessCardImage;
  bool _wasModified = false;

  @override
  void initState() {
    super.initState();
    // 명함 이미지 캐시 로드
    _loadBusinessCardImage();
  }

  Future<void> _loadBusinessCardImage() async {
    if (widget.businessCard.businessCardImageUrl != null) {
      final cachedImage = await _imageCacheService.getCachedImage(
        widget.businessCard.businessCardImageUrl!,
      );
      if (mounted) {
        setState(() {
          _cachedBusinessCardImage = cachedImage;
        });
      }
    }
  }

  Future<String> _getVcfDownloadUrl() async {
    return await _businessCardService.generateVcfDownloadToken(
      widget.businessCard.id!,
    );
  }

  Future<String> _getImageDownloadUrl() async {
    return await _businessCardService.generateImageDownloadToken(
      widget.businessCard.id!,
    );
  }

  void _showBusinessCardImageDialog() {
    final imageUrl = widget.businessCard.businessCardImageUrl;
    if (imageUrl == null || imageUrl.isEmpty) {
      return;
    }

    showDialog(
      context: context,
      builder: (BuildContext context) {
        final imageWidget = _cachedBusinessCardImage != null
            ? Image.file(_cachedBusinessCardImage!, fit: BoxFit.contain)
            : Image.network(imageUrl, fit: BoxFit.contain);

        return Dialog(
          insetPadding: const EdgeInsets.all(16),
          child: InteractiveViewer(
            minScale: 0.8,
            maxScale: 4.0,
            child: imageWidget,
          ),
        );
      },
    );
  }

  void _showQrCodeDialog({
    required String url,
    required String title,
    required String description,
  }) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          child: Container(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  description,
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: Colors.grey[600],
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey[300]!),
                  ),
                  child: QrImageView(
                    data: url,
                    version: QrVersions.auto,
                    size: 200.0,
                    backgroundColor: Colors.white,
                  ),
                ),
                const SizedBox(height: 24),
                Center(
                  child: ElevatedButton.icon(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                    label: const Text(
                      '닫기',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.primary,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(200, 50),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final card = widget.businessCard;

    return Scaffold(
      appBar: AppBar(
        title: Text(card.fullName),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            Navigator.pop(context, _wasModified);
          },
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.edit),
            onPressed: () async {
              final result = await Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) =>
                      BusinessCardFormScreen(businessCard: widget.businessCard),
                ),
              );
              if (result == true && context.mounted) {
                // 수정 완료 후 현재 화면을 새로운 데이터로 완전히 교체
                _wasModified = true;
                try {
                  final updatedCard = await _businessCardService
                      .getBusinessCard(widget.businessCard.id!);
                  print('[View] 수정된 데이터 로드 완료');
                  if (!context.mounted) return;
                  // 기존 상세 화면을 제거하고, 수정된 데이터로 새 상세 화면 열기
                  // updatedCard를 목록 화면에 전달하여 부분 업데이트
                  Navigator.pop(context, updatedCard); // 수정된 명함 데이터 전달
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) =>
                          BusinessCardViewScreen(businessCard: updatedCard),
                    ),
                  );
                } catch (e) {
                  print('[View] 데이터 새로고침 실패: $e');
                  if (!context.mounted) return;
                  ScaffoldMessenger.of(
                    context,
                  ).showSnackBar(SnackBar(content: Text('데이터 새로고침 실패: $e')));
                }
              }
            },
          ),
          IconButton(
            icon: const Icon(Icons.delete),
            onPressed: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('명함 삭제'),
                  content: Text('\'${card.fullName}\' 명함을 삭제하시겠습니까?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('취소'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text(
                        '삭제',
                        style: TextStyle(color: Colors.red),
                      ),
                    ),
                  ],
                ),
              );
              if (confirm != true || !context.mounted) return;

              try {
                // 삭제 API 성공 후 목록 화면이 캐시에서 이 명함만 제거한다 (목록 재조회 없음)
                await _businessCardService.deleteBusinessCard(card.id!);
                if (!context.mounted) return;
                Navigator.pop(context, {'deletedId': card.id});
              } catch (e) {
                print('[View] 명함 삭제 실패: $e');
                if (!context.mounted) return;
                ScaffoldMessenger.of(
                  context,
                ).showSnackBar(SnackBar(content: Text('명함 삭제 실패: $e')));
              }
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 명함 이미지 (최상단)
            if (widget.businessCard.businessCardImageUrl != null &&
                widget.businessCard.businessCardImageUrl!.isNotEmpty) ...[
              const Text(
                '명함 이미지',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: _showBusinessCardImageDialog,
                child: Container(
                  width: double.infinity,
                  height: 280,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey[300]!),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: _cachedBusinessCardImage != null
                        ? Image.file(
                            _cachedBusinessCardImage!,
                            width: double.infinity,
                            height: 280,
                            fit: BoxFit.contain,
                          )
                        : Image.network(
                            card.businessCardImageUrl!,
                            width: double.infinity,
                            height: 280,
                            fit: BoxFit.contain,
                            loadingBuilder: (context, child, loadingProgress) {
                              if (loadingProgress == null) return child;
                              return Container(
                                height: 280,
                                child: Center(
                                  child: CircularProgressIndicator(
                                    value:
                                        loadingProgress.expectedTotalBytes !=
                                            null
                                        ? loadingProgress
                                                  .cumulativeBytesLoaded /
                                              loadingProgress
                                                  .expectedTotalBytes!
                                        : null,
                                  ),
                                ),
                              );
                            },
                          ),
                  ),
                ),
              ),
              const SizedBox(height: 32),
            ],

            // 기본 정보
            _buildInfoSection('기본 정보', [
              if (card.fullName.isNotEmpty) _buildInfoItem('성명', card.fullName),
            ]),

            // 연락처 정보
            if (card.phone != null ||
                card.email != null ||
                card.website != null)
              _buildInfoSection('연락처 정보', [
                if (card.phone != null) _buildInfoItem('전화번호', card.phone!),
                if (card.email != null) _buildInfoItem('이메일', card.email!),
                if (card.website != null) _buildInfoItem('웹사이트', card.website!),
              ]),

            // 조직 정보
            if (card.organization != null || card.title != null)
              _buildInfoSection('조직 정보', [
                if (card.organization != null)
                  _buildInfoItem('회사/조직', card.organization!),
                if (card.title != null) _buildInfoItem('직책', card.title!),
              ]),

            // 주소 정보
            if (card.address != null)
              _buildInfoSection('주소', [_buildInfoItem('주소', card.address!)]),

            // 추가 정보
            if (card.note != null)
              _buildInfoSection('메모', [_buildInfoItem('메모', card.note!)]),

            const SizedBox(height: 32),

            // VCF 다운로드 QR코드
            const Text(
              'VCF 다운로드',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),

            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.green[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.green[200]!),
              ),
              child: Column(
                children: [
                  const Text(
                    '📱 연락처 정보를 휴대폰에 저장하세요',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: () async {
                      try {
                        final vcfUrl = await _getVcfDownloadUrl();
                        if (!mounted) return;
                        _showQrCodeDialog(
                          url: vcfUrl,
                          title: 'VCF 다운로드 QR코드',
                          description: 'QR코드를 스캔하여 연락처 정보를 다운로드하세요 (5분간 유효)',
                        );
                      } catch (e) {
                        if (!context.mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('QR코드 생성 실패: $e')),
                        );
                      }
                    },
                    icon: const Icon(Icons.qr_code),
                    label: const Text(
                      'VCF QR코드 보기',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.primary,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(double.infinity, 50),
                    ),
                  ),
                ],
              ),
            ),

            // 이미지 다운로드 QR코드 (명함 이미지가 있는 경우에만)
            if (widget.businessCard.businessCardImageUrl != null &&
                widget.businessCard.businessCardImageUrl!.isNotEmpty) ...[
              const SizedBox(height: 32),
              const Text(
                '이미지 다운로드',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 16),

              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.blue[200]!),
                ),
                child: Column(
                  children: [
                    const Text(
                      '📸 명함 이미지를 갤러리에 저장하세요',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton.icon(
                      onPressed: () async {
                        try {
                          final imageUrl = await _getImageDownloadUrl();
                          if (!mounted) return;
                          _showQrCodeDialog(
                            url: imageUrl,
                            title: '이미지 다운로드 QR코드',
                            description: 'QR코드를 스캔하여 명함 이미지를 다운로드하세요 (5분간 유효)',
                          );
                        } catch (e) {
                          if (!context.mounted) return;
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('QR코드 생성 실패: $e')),
                          );
                        }
                      },
                      icon: const Icon(Icons.qr_code),
                      label: const Text(
                        '이미지 QR코드 보기',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Theme.of(
                          context,
                        ).colorScheme.secondary,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 50),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // 등록일 정보
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey[200]!),
              ),
              child: Center(
                child: Column(
                  children: [
                    Text(
                      card.createdAt != null
                          ? '${card.createdAt!.year}.${card.createdAt!.month}.${card.createdAt!.day}'
                          : '-',
                      style: const TextStyle(
                        fontSize: 19,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const Text(
                      '등록일',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w600,
                        color: Color(0xFF6C757D),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // 네비게이션 바와 겹치지 않도록 하단 여백 추가
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoSection(String title, List<Widget> children) {
    if (children.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 16),
        ...children,
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildInfoItem(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 80,
            child: Text(
              label,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Color(0xFF6C757D),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}
