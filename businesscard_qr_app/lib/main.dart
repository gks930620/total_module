import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:kakao_flutter_sdk/kakao_flutter_sdk.dart' as kakao;
import 'dart:async';
import 'dart:io';
import 'l10n/app_localizations.dart';
import 'core/app_error_text.dart';
import 'core/theme/halo_theme.dart';
import 'core/theme/halo_flourish.dart';
import 'core/widgets/halo_buttons.dart';
import 'core/widgets/halo_card.dart';
import 'core/widgets/halo_field.dart';
import 'core/widgets/halo_scaffold.dart';
import 'models/business_card.dart';
import 'models/entitlement.dart';
import 'screens/pro_screen.dart';
import 'services/account_service.dart';
import 'services/api_client.dart';
import 'services/billing_service.dart';
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
    runApp(const ConfigErrorApp());
    return;
  }

  // 카카오 SDK 초기화
  kakao.KakaoSdk.init(nativeAppKey: kakaoNativeAppKey);

  runApp(const BusinessCardApp());
}

/// 다국어 배선 — 두 MaterialApp 이 같은 설정을 쓰도록 한 곳에 모은다.
/// 지원 언어는 lib/l10n/*.arb 가 결정한다(AppLocalizations.supportedLocales).
const _localizationsDelegates = <LocalizationsDelegate<Object>>[
  AppLocalizations.delegate,
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
];

/// 필수 설정이 없을 때 크래시 대신 보여주는 간단한 에러 화면
class ConfigErrorApp extends StatelessWidget {
  const ConfigErrorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      debugShowCheckedModeBanner: false,
      theme: HaloTheme.light(),
      darkTheme: HaloTheme.dark(),
      localizationsDelegates: _localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Builder(
        builder: (context) {
          final t = context.halo;
          final l10n = AppLocalizations.of(context);
          return HaloScaffold(
            body: Center(
              child: Padding(
                padding: const EdgeInsets.all(HaloSpace.xxl),
                child: HaloCard(
                  padding: const EdgeInsets.all(HaloSpace.xl),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: HaloShape.badgeLg,
                        height: HaloShape.badgeLg,
                        decoration: BoxDecoration(
                          color: t.errSoft,
                          borderRadius: BorderRadius.circular(
                            HaloShape.badgeLgRadius,
                          ),
                        ),
                        child: Icon(
                          Icons.error_outline,
                          size: 28,
                          color: t.errText,
                        ),
                      ),
                      const SizedBox(height: HaloSpace.lg),
                      Text(
                        l10n.configErrorTitle,
                        style: HaloType.cardTitle.copyWith(color: t.text),
                      ),
                      const SizedBox(height: HaloSpace.sm),
                      Text(
                        l10n.configErrorKakaoKeyMissing,
                        textAlign: TextAlign.center,
                        style: HaloType.body.copyWith(color: t.muted),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class BusinessCardApp extends StatelessWidget {
  const BusinessCardApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      // 작업 전환기에 뜨는 이름 — 기기 언어에 따라 바뀌므로 상수가 아니라 콜백이다.
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      debugShowCheckedModeBanner: false,
      // 디자인: Halo — 색·그림자·둥글기의 단일 출처는 core/theme/halo_flourish.dart
      theme: HaloTheme.light(),
      darkTheme: HaloTheme.dark(),
      themeMode: ThemeMode.system,
      localizationsDelegates: _localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
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
  bool _isLoggingIn = false;

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
    final t = context.halo;
    final l10n = AppLocalizations.of(context);

    // 로그인 상태 체크 중이면 로딩 표시
    if (_isChecking) {
      return const HaloScaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return HaloScaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: HaloSpace.screen),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // ② 이 화면의 유일한 그라디언트 — 초점은 여기 하나뿐이다.
              const Center(
                child: HaloIconBadge(
                  icon: Icons.qr_code_2,
                  size: HaloShape.badgeLg,
                ),
              ),
              const SizedBox(height: HaloSpace.xl),
              Text(
                l10n.appTitle,
                textAlign: TextAlign.center,
                style: HaloType.hero.copyWith(color: t.text),
              ),
              const SizedBox(height: HaloSpace.md),
              Text(
                l10n.loginTagline,
                textAlign: TextAlign.center,
                style: HaloType.body.copyWith(color: t.muted),
              ),
              const SizedBox(height: HaloSpace.xxl * 2),
              HaloKakaoButton(
                loading: _isLoggingIn,
                onPressed: () async {
                  await _loginWithKakao(context);
                },
              ),
              const SizedBox(height: HaloSpace.lg),
              Text(
                l10n.loginKakaoNotice,
                textAlign: TextAlign.center,
                style: HaloType.label.copyWith(color: t.muted2),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _loginWithKakao(BuildContext context) async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _isLoggingIn = true;
    });
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(l10n.loginFailed(AppErrorText.of(l10n, error))),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoggingIn = false;
        });
      }
    }
  }

  Future<void> _syncUserToBackend(kakao.User kakaoUser) async {
    try {
      await _businessCardService.syncUser(kakaoUser);

      print('사용자 정보 백엔드 동기화 완료');
    } catch (e) {
      print('백엔드 사용자 동기화 실패: $e');
      // 여기서 한국어 문장으로 감싸면 다른 언어에서 그대로 새어 나온다.
      // 원인 오류(AppException)를 그대로 올려 보내 호출부가 번역하게 둔다.
      rethrow;
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
  final BillingService _billingService = BillingService();
  final AccountService _accountService = AccountService();
  final ScrollController _scrollController = ScrollController();
  List<BusinessCard> _businessCards = [];
  bool _isLoading = true; // 첫 페이지 로딩
  bool _isLoadingMore = false; // 다음 페이지 로딩
  bool _hasMore = true; // 더 가져올 페이지가 있는지
  int _nextPage = 0; // 다음에 요청할 페이지 번호

  /// 서버에 물어보기 전에는 보수적으로 잡는다 — 낙관적으로 열어 두면
  /// 등록 버튼을 눌렀다가 서버에서 막히는 경험이 된다.
  Entitlement _entitlement = Entitlement.unknown;
  StreamSubscription<Entitlement>? _entitlementSub;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    // 앱이 꺼져 있는 동안 끝난 결제도 이 스트림으로 들어온다 — 목록에 들어오자마자 듣기 시작한다.
    _billingService.start();
    // 결제가 검증될 때마다(이 화면에서든 결제 화면에서든) 자격이 흘러들어온다.
    // 화면이 돌아올 때마다 다시 조회하는 것보다 정확하고 호출도 적다.
    _entitlementSub = _billingService.entitlementStream.listen((entitlement) {
      if (mounted) setState(() => _entitlement = entitlement);
    });
    _loadFirstPage();
    _loadEntitlement();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _entitlementSub?.cancel();
    _billingService.dispose();
    super.dispose();
  }

  /// 지금 프로인지·몇 장 남았는지. 실패해도 화면을 막지 않는다(등록 시 서버가 다시 판정한다).
  Future<void> _loadEntitlement() async {
    try {
      final entitlement = await _billingService.fetchEntitlement();
      if (!mounted) return;
      setState(() => _entitlement = entitlement);
    } catch (e) {
      print('[UI] 자격 조회 실패: $e');
    }
  }

  /// 결제 화면을 연다. 구매가 성사되면 [BillingService.entitlementStream] 으로
  /// 자격이 흘러들어오므로 여기서 결과를 받아 처리하지 않는다.
  Future<void> _openProScreen({bool limitReached = false}) {
    return Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => ProScreen(
          billingService: _billingService,
          initialEntitlement: _entitlement,
          limitReached: limitReached,
        ),
      ),
    );
  }

  Future<void> _deleteAccount() async {
    final l10n = AppLocalizations.of(context);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.deleteAccountTitle),
        content: Text(l10n.deleteAccountMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l10n.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(
              l10n.deleteAccountConfirm,
              // 되돌릴 수 없는 동작이라 색으로도 구분한다.
              style: TextStyle(color: context.halo.err),
            ),
          ),
        ],
      ),
    );

    if (confirm != true || !mounted) return;
    try {
      await _accountService.deleteAccount();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.deleteAccountSucceeded)),
      );
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const HomeScreen()),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.deleteAccountFailed(AppErrorText.of(l10n, e)))),
      );
    }
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
    final l10n = AppLocalizations.of(context);
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.cardsLoadFailed(AppErrorText.of(l10n, e)))),
      );
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

  Future<void> _openAddScreen() async {
    // 한도를 넘겼으면 폼을 다 채운 뒤 거절하지 않고 먼저 알린다.
    // (서버도 등록 시 한 번 더 막으므로, 이건 UX 를 위한 앞단 검사일 뿐이다)
    if (!_entitlement.canAddCard) {
      await _openProScreen(limitReached: true);
      if (!mounted || !_entitlement.canAddCard) return;
    }

    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const BusinessCardFormScreen()),
    );
    if (!mounted) return;
    if (result is String) {
      // 추가: 등록 API 성공 후 새 명함만 조회해 캐시 최상단에 추가 (목록 재조회 없음)
      try {
        final newCard = await _businessCardService.getBusinessCard(result);
        if (!mounted) return;
        setState(() {
          _businessCards.insert(0, newCard);
          // 남은 장수 표시가 바로 줄어들도록 캐시도 같이 올린다(재조회 없음).
          _entitlement = _entitlement.withCardCount(_entitlement.cardCount + 1);
        });
        _showFromFirstPage(); // 1페이지(맨 위)부터 보여주기
      } catch (e) {
        print('[목록] 새 명함 조회 실패: $e');
        _loadFirstPage(); // 실패 시 폴백: 1페이지 재조회
      }
    } else if (result == true) {
      _loadFirstPage(); // 폴백
    }
  }

  Future<void> _openCard(BusinessCard card) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BusinessCardViewScreen(businessCard: card),
      ),
    );
    if (!mounted) return;
    if (result is BusinessCard) {
      // 수정: 수정 API 성공 후 해당 명함만 캐시에서 교체 (목록 재조회 없음)
      setState(() {
        final index = _businessCards.indexWhere((c) => c.id == result.id);
        if (index != -1) {
          _businessCards[index] = result;
        }
      });
      _showFromFirstPage();
    } else if (result is Map && result['deletedId'] is String) {
      // 삭제: 삭제 API 성공 후 해당 명함만 캐시에서 제거 (목록 재조회 없음)
      setState(() {
        _businessCards.removeWhere((c) => c.id == result['deletedId']);
        // 삭제한 만큼 한도가 다시 열린다(서버도 활성 명함만 센다).
        _entitlement = _entitlement.withCardCount(_entitlement.cardCount - 1);
      });
      _showFromFirstPage();
    } else if (result == true) {
      _loadFirstPage(); // 전체 새로고침 (폴백)
    }
  }

  Future<void> _logout() async {
    final l10n = AppLocalizations.of(context);
    // 로그아웃 확인 다이얼로그
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.actionLogout),
        content: Text(l10n.logoutConfirmMessage),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l10n.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(l10n.actionLogout),
          ),
        ],
      ),
    );

    if (confirm != true || !mounted) return;
    try {
      // 백엔드 세션 토큰을 먼저 버린다. 카카오만 로그아웃하고 이걸 남겨 두면
      // 아직 만료되지 않은 앞사람 토큰으로 요청이 나가 남의 명함이 보일 수 있다.
      ApiClient().clearSession();

      // 카카오 로그아웃
      await kakao.UserApi.instance.logout();
      print('[LOGOUT] 카카오 로그아웃 성공');

      // 로그인 화면으로 이동
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const HomeScreen()),
      );
    } catch (e) {
      print('[LOGOUT] 로그아웃 실패: $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.logoutFailed(AppErrorText.of(l10n, e)))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.halo;
    final topInset = HaloScaffold.contentTopInset(context);

    return HaloScaffold(
      appBar: HaloAppBar(
        title: l10n.myCards,
        automaticallyImplyLeading: false,
        actions: [
          HaloAppBarAction(
            // 프로면 상태 확인용, 아니면 업그레이드 입구.
            icon: _entitlement.pro
                ? Icons.workspace_premium
                : Icons.auto_awesome_outlined,
            tooltip: _entitlement.pro ? l10n.proActive : l10n.upgradeToPro,
            onPressed: _openProScreen,
          ),
          // 로그아웃·회원탈퇴는 자주 쓰지 않고 되돌리기 어려워 메뉴 안에 둔다.
          PopupMenuButton<_AccountMenuAction>(
            icon: Icon(Icons.more_vert, color: t.muted),
            tooltip: l10n.actionClose,
            onSelected: (action) => switch (action) {
              _AccountMenuAction.logout => _logout(),
              _AccountMenuAction.deleteAccount => _deleteAccount(),
            },
            itemBuilder: (context) => [
              PopupMenuItem(
                value: _AccountMenuAction.logout,
                child: Text(l10n.actionLogout),
              ),
              PopupMenuItem(
                value: _AccountMenuAction.deleteAccount,
                child: Text(
                  l10n.deleteAccountAction,
                  style: TextStyle(color: t.err),
                ),
              ),
            ],
          ),
          const SizedBox(width: HaloSpace.sm),
        ],
        // 새로고침 버튼 없음(의도): 목록은 진입 시 1회 로드 후 메모리 유지하고,
        // 등록/수정/삭제 결과가 돌아올 때만 갱신한다 (서버 재조회 최소화).
      ),
      body: RefreshIndicator(
        onRefresh: _loadFirstPage,
        edgeOffset: topInset,
        color: t.point,
        backgroundColor: t.surface,
        child: CustomScrollView(
          controller: _scrollController,
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverPadding(
              padding: EdgeInsets.fromLTRB(
                HaloSpace.screen,
                topInset,
                HaloSpace.screen,
                HaloSpace.xl,
              ),
              // ② 이 화면의 유일한 히어로 — 페이지당 1개.
              sliver: SliverToBoxAdapter(
                child: HaloHero(
                  title: l10n.myCards,
                  // 무료 사용자에게는 남은 장수를, 프로에게는 그냥 개수를 보여준다.
                  subtitle: _isLoading
                      ? l10n.statusLoading
                      : _entitlement.cardLimit == null
                      ? l10n.cardsShareSubtitle(_businessCards.length)
                      : l10n.cardCountUsage(
                          _entitlement.cardCount,
                          _entitlement.cardLimit!,
                        ),
                  icon: Icons.badge_outlined,
                  footer: HaloOnHeroButton(
                    label: l10n.addCard,
                    icon: Icons.add,
                    onPressed: _openAddScreen,
                  ),
                ),
              ),
            ),
            if (_isLoading)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_businessCards.isEmpty)
              const SliverFillRemaining(
                hasScrollBody: false,
                child: _EmptyCardList(),
              )
            else
              SliverPadding(
                padding: EdgeInsets.fromLTRB(
                  HaloSpace.screen,
                  0,
                  HaloSpace.screen,
                  HaloScaffold.contentBottomInset(context) + HaloSpace.xxl,
                ),
                sliver: SliverList.separated(
                  // 더 가져올 페이지가 있으면 마지막에 로딩 행 1개 추가
                  itemCount: _businessCards.length + (_hasMore ? 1 : 0),
                  separatorBuilder: (context, index) =>
                      const SizedBox(height: HaloSpace.gap),
                  itemBuilder: (context, index) {
                    // 무한스크롤 로딩 행
                    if (index >= _businessCards.length) {
                      return const Padding(
                        padding: EdgeInsets.symmetric(vertical: HaloSpace.lg),
                        child: Center(child: CircularProgressIndicator()),
                      );
                    }
                    final card = _businessCards[index];
                    return _BusinessCardTile(
                      card: card,
                      onTap: () => _openCard(card),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// 앱바 메뉴의 항목. 되돌리기 어려운 동작이라 아이콘 버튼 대신 메뉴에 넣는다.
enum _AccountMenuAction { logout, deleteAccount }

/// 목록의 한 줄. 반복되는 자리라 아이콘 배지는 조용한(soft) 쪽을 쓴다 —
/// 그라디언트 배지를 줄마다 깔면 한 화면에 8개가 넘어 원칙 ②를 깬다.
class _BusinessCardTile extends StatelessWidget {
  const _BusinessCardTile({required this.card, required this.onTap});

  final BusinessCard card;
  final VoidCallback onTap;

  String get _initial {
    final trimmed = card.fullName.trim();
    if (trimmed.isEmpty) return '?';
    return String.fromCharCode(trimmed.runes.first);
  }

  String? get _subtitle {
    final parts = [
      card.organization,
      card.title,
    ].where((v) => v != null && v.isNotEmpty).cast<String>();
    return parts.isEmpty ? null : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final t = context.halo;
    final subtitle = _subtitle;

    return HaloCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
        horizontal: HaloSpace.lg,
        vertical: HaloSpace.lg,
      ),
      child: Row(
        children: [
          HaloIconBadge(label: _initial, soft: true),
          const SizedBox(width: HaloSpace.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  card.fullName,
                  overflow: TextOverflow.ellipsis,
                  style: HaloType.cardTitle.copyWith(color: t.text),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    overflow: TextOverflow.ellipsis,
                    style: HaloType.label.copyWith(color: t.muted2),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: HaloSpace.sm),
          Icon(Icons.chevron_right, color: t.muted2, size: 22),
        ],
      ),
    );
  }
}

class _EmptyCardList extends StatelessWidget {
  const _EmptyCardList();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.halo;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        HaloSpace.screen,
        0,
        HaloSpace.screen,
        HaloSpace.xxl * 2,
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const HaloIconBadge(
            icon: Icons.badge_outlined,
            size: HaloShape.badgeLg,
            soft: true,
          ),
          const SizedBox(height: HaloSpace.lg),
          Text(
            l10n.emptyCardsTitle,
            style: HaloType.cardTitle.copyWith(color: t.text),
          ),
          const SizedBox(height: HaloSpace.sm),
          Text(
            l10n.emptyCardsBody,
            textAlign: TextAlign.center,
            style: HaloType.body.copyWith(color: t.muted),
          ),
        ],
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
    final l10n = AppLocalizations.of(context);
    final topInset = HaloScaffold.contentTopInset(context);

    return HaloScaffold(
      appBar: HaloAppBar(
        title: _isEditMode ? l10n.formTitleEdit : l10n.formTitleCreate,
        actions: [
          // ② 이 화면의 유일한 그라디언트 — 주 동작은 저장 하나다.
          Padding(
            padding: const EdgeInsets.symmetric(
              vertical: HaloSpace.sm,
              horizontal: HaloSpace.md,
            ),
            child: HaloPrimaryButton(
              label: l10n.actionSave,
              expand: false,
              loading: _isLoading,
              onPressed: _saveBusinessCard,
            ),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            HaloSpace.screen,
            topInset,
            HaloSpace.screen,
            HaloScaffold.contentBottomInset(context),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 명함 이미지 업로드 (최상단)
              HaloSectionHeading(
                l10n.sectionCardImage,
                icon: Icons.image_outlined,
              ),
              HaloCard(
                padding: const EdgeInsets.all(HaloSpace.md),
                child: Column(
                  children: [
                    _BusinessCardImagePicker(
                      pickedImage: _businessCardImage,
                      existingImageUrl: _isEditMode
                          ? widget.businessCard!.businessCardImageUrl
                          : null,
                      onTap: _pickBusinessCardImage,
                    ),
                    if (_businessCardImage != null ||
                        (_isEditMode &&
                            widget.businessCard!.businessCardImageUrl != null))
                      Padding(
                        padding: const EdgeInsets.only(top: HaloSpace.md),
                        child: HaloSecondaryButton(
                          label: l10n.changeImage,
                          icon: Icons.edit_outlined,
                          onPressed: _pickBusinessCardImage,
                        ),
                      ),
                  ],
                ),
              ),

              const SizedBox(height: HaloSpace.xxl),

              HaloSectionHeading(
                l10n.sectionBasicInfo,
                icon: Icons.person_outline,
              ),
              HaloCard(
                padding: const EdgeInsets.fromLTRB(
                  HaloSpace.lg,
                  HaloSpace.xl,
                  HaloSpace.lg,
                  HaloSpace.xs,
                ),
                child: HaloTextField(
                  controller: _fnController,
                  label: l10n.fieldFullName,
                  hint: l10n.hintFullName,
                  required: true,
                  validator: (value) => value?.isEmpty ?? true
                      ? l10n.validationFullNameRequired
                      : null,
                ),
              ),

              const SizedBox(height: HaloSpace.xxl),

              HaloSectionHeading(
                l10n.sectionContactInfo,
                icon: Icons.call_outlined,
              ),
              HaloCard(
                padding: const EdgeInsets.fromLTRB(
                  HaloSpace.lg,
                  HaloSpace.xl,
                  HaloSpace.lg,
                  HaloSpace.xs,
                ),
                child: Column(
                  children: [
                    HaloTextField(
                      controller: _telController,
                      label: l10n.fieldPhone,
                      hint: '01012345678',
                      required: true,
                      keyboardType: TextInputType.number,
                      validator: (value) => value?.isEmpty ?? true
                          ? l10n.validationPhoneRequired
                          : null,
                    ),
                    HaloTextField(
                      controller: _emailController,
                      label: l10n.fieldEmail,
                      hint: 'example@email.com',
                      keyboardType: TextInputType.emailAddress,
                    ),
                    HaloTextField(
                      controller: _urlController,
                      label: l10n.fieldWebsite,
                      hint: 'https://example.com',
                      keyboardType: TextInputType.url,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: HaloSpace.xxl),

              HaloSectionHeading(
                l10n.sectionOrgInfo,
                icon: Icons.apartment_outlined,
              ),
              HaloCard(
                padding: const EdgeInsets.fromLTRB(
                  HaloSpace.lg,
                  HaloSpace.xl,
                  HaloSpace.lg,
                  HaloSpace.xs,
                ),
                child: Column(
                  children: [
                    HaloTextField(
                      controller: _orgController,
                      label: l10n.fieldOrganization,
                      hint: l10n.hintOrganization,
                    ),
                    HaloTextField(
                      controller: _titleController,
                      label: l10n.fieldJobTitle,
                      hint: l10n.hintJobTitle,
                    ),
                  ],
                ),
              ),

              const SizedBox(height: HaloSpace.xxl),

              HaloSectionHeading(
                l10n.sectionAddressInfo,
                icon: Icons.place_outlined,
              ),
              HaloCard(
                padding: const EdgeInsets.fromLTRB(
                  HaloSpace.lg,
                  HaloSpace.xl,
                  HaloSpace.lg,
                  HaloSpace.xs,
                ),
                child: HaloTextField(
                  controller: _adrController,
                  label: l10n.fieldAddress,
                  hint: l10n.hintAddress,
                  maxLines: 2,
                ),
              ),

              const SizedBox(height: HaloSpace.xxl),

              HaloSectionHeading(
                l10n.sectionExtraInfo,
                icon: Icons.sticky_note_2_outlined,
              ),
              HaloCard(
                padding: const EdgeInsets.fromLTRB(
                  HaloSpace.lg,
                  HaloSpace.xl,
                  HaloSpace.lg,
                  HaloSpace.xs,
                ),
                child: HaloTextField(
                  controller: _noteController,
                  label: l10n.fieldNote,
                  hint: l10n.hintNote,
                  maxLines: 3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _pickBusinessCardImage() async {
    showModalBottomSheet(
      context: context,
      builder: (BuildContext context) {
        final l10n = AppLocalizations.of(context);
        final t = context.halo;
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              HaloSpace.md,
              HaloSpace.md,
              HaloSpace.md,
              HaloSpace.lg,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: HaloSpace.lg),
                  decoration: BoxDecoration(
                    color: t.border,
                    borderRadius: HaloShape.round,
                  ),
                ),
                ListTile(
                  leading: const HaloIconBadge(
                    icon: Icons.photo_camera_outlined,
                    soft: true,
                  ),
                  title: Text(l10n.sourceCamera),
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
                  leading: const HaloIconBadge(
                    icon: Icons.photo_library_outlined,
                    soft: true,
                  ),
                  title: Text(l10n.sourceGallery),
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
          ),
        );
      },
    );
  }

  Future<void> _saveBusinessCard() async {
    final l10n = AppLocalizations.of(context);
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
              content: Text(_isEditMode ? l10n.cardUpdated : l10n.cardSaved),
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
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(l10n.saveFailed(AppErrorText.of(l10n, e)))),
          );
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

/// 명함 이미지 자리 — 비었을 때는 [HaloTokens.soft] 면에 조용한 배지 하나.
class _BusinessCardImagePicker extends StatelessWidget {
  const _BusinessCardImagePicker({
    required this.pickedImage,
    required this.existingImageUrl,
    required this.onTap,
  });

  final XFile? pickedImage;
  final String? existingImageUrl;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.halo;
    final hasImage = pickedImage != null || existingImageUrl != null;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        height: 240,
        decoration: BoxDecoration(
          color: t.surfaceAlt,
          borderRadius: HaloShape.input,
        ),
        clipBehavior: Clip.antiAlias,
        child: hasImage
            ? (pickedImage != null
                  ? Image.file(
                      File(pickedImage!.path),
                      width: double.infinity,
                      height: 240,
                      fit: BoxFit.contain,
                    )
                  : Image.network(
                      existingImageUrl!,
                      width: double.infinity,
                      height: 240,
                      fit: BoxFit.contain,
                    ))
            : Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const HaloIconBadge(
                    icon: Icons.add_photo_alternate_outlined,
                    size: HaloShape.badgeLg,
                    soft: true,
                  ),
                  const SizedBox(height: HaloSpace.md),
                  Text(
                    l10n.imagePickerTitle,
                    style: HaloType.button.copyWith(color: t.point),
                  ),
                  const SizedBox(height: HaloSpace.xs),
                  Text(
                    l10n.imagePickerBody,
                    style: HaloType.label.copyWith(color: t.muted2),
                  ),
                ],
              ),
      ),
    );
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
          insetPadding: const EdgeInsets.all(HaloSpace.lg),
          clipBehavior: Clip.antiAlias,
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
        final l10n = AppLocalizations.of(context);
        final t = context.halo;
        final f = context.flourish;
        return Dialog(
          child: Padding(
            padding: const EdgeInsets.all(HaloSpace.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  textAlign: TextAlign.center,
                  style: HaloType.cardTitle.copyWith(color: t.text),
                ),
                const SizedBox(height: HaloSpace.sm),
                Text(
                  description,
                  style: HaloType.body.copyWith(color: t.muted),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: HaloSpace.xl),
                Container(
                  padding: const EdgeInsets.all(HaloSpace.lg),
                  decoration: BoxDecoration(
                    // QR 은 스캔이 되어야 하므로 다크 모드에서도 바탕이 흰색이다.
                    color: f.qrSurface,
                    borderRadius: HaloShape.input,
                    boxShadow: f.sh,
                  ),
                  child: QrImageView(
                    data: url,
                    version: QrVersions.auto,
                    size: 200.0,
                    backgroundColor: f.qrSurface,
                  ),
                ),
                const SizedBox(height: HaloSpace.xl),
                HaloPrimaryButton(
                  label: l10n.actionClose,
                  icon: Icons.close,
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _editCard() async {
    final l10n = AppLocalizations.of(context);
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) =>
            BusinessCardFormScreen(businessCard: widget.businessCard),
      ),
    );
    if (result != true || !mounted) return;

    // 수정 완료 후 현재 화면을 새로운 데이터로 완전히 교체
    _wasModified = true;
    try {
      final updatedCard = await _businessCardService.getBusinessCard(
        widget.businessCard.id!,
      );
      print('[View] 수정된 데이터 로드 완료');
      if (!mounted) return;
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
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.refreshFailed(AppErrorText.of(l10n, e)))),
      );
    }
  }

  Future<void> _deleteCard() async {
    final l10n = AppLocalizations.of(context);
    final card = widget.businessCard;
    final t = context.halo;
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(l10n.deleteCardTitle),
        content: Text(l10n.deleteCardMessage(card.fullName)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l10n.actionCancel),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(l10n.actionDelete, style: TextStyle(color: t.errText)),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;

    try {
      // 삭제 API 성공 후 목록 화면이 캐시에서 이 명함만 제거한다 (목록 재조회 없음)
      await _businessCardService.deleteBusinessCard(card.id!);
      if (!mounted) return;
      Navigator.pop(context, {'deletedId': card.id});
    } catch (e) {
      print('[View] 명함 삭제 실패: $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n.deleteCardFailed(AppErrorText.of(l10n, e))),
        ),
      );
    }
  }

  Future<void> _openVcfQrCode() async {
    final l10n = AppLocalizations.of(context);
    try {
      final vcfUrl = await _getVcfDownloadUrl();
      if (!mounted) return;
      _showQrCodeDialog(
        url: vcfUrl,
        title: l10n.vcfQrTitle,
        description: l10n.vcfQrDescription,
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.qrCreateFailed(AppErrorText.of(l10n, e)))),
      );
    }
  }

  Future<void> _openImageQrCode() async {
    final l10n = AppLocalizations.of(context);
    try {
      final imageUrl = await _getImageDownloadUrl();
      if (!mounted) return;
      _showQrCodeDialog(
        url: imageUrl,
        title: l10n.imageQrTitle,
        description: l10n.imageQrDescription,
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.qrCreateFailed(AppErrorText.of(l10n, e)))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.halo;
    final card = widget.businessCard;
    final topInset = HaloScaffold.contentTopInset(context);
    final hasImage =
        card.businessCardImageUrl != null &&
        card.businessCardImageUrl!.isNotEmpty;

    final heroSubtitleParts = [
      card.organization,
      card.title,
    ].where((v) => v != null && v.isNotEmpty).cast<String>();

    return HaloScaffold(
      appBar: HaloAppBar(
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          tooltip: l10n.actionBack,
          onPressed: () {
            Navigator.pop(context, _wasModified);
          },
        ),
        actions: [
          HaloAppBarAction(
            icon: Icons.edit_outlined,
            tooltip: l10n.actionEdit,
            onPressed: _editCard,
          ),
          HaloAppBarAction(
            icon: Icons.delete_outline,
            tooltip: l10n.actionDelete,
            tone: t.errText,
            onPressed: _deleteCard,
          ),
          const SizedBox(width: HaloSpace.sm),
        ],
      ),
      body: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          HaloSpace.screen,
          topInset,
          HaloSpace.screen,
          HaloScaffold.contentBottomInset(context),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ② 이 화면의 히어로 — 페이지당 1개.
            HaloHero(
              title: card.fullName,
              subtitle: heroSubtitleParts.isEmpty
                  ? null
                  : heroSubtitleParts.join(' · '),
              icon: Icons.badge_outlined,
            ),

            // 명함 이미지
            if (hasImage) ...[
              const SizedBox(height: HaloSpace.xxl),
              HaloSectionHeading(
                l10n.sectionCardImage,
                icon: Icons.image_outlined,
              ),
              HaloCard(
                onTap: _showBusinessCardImageDialog,
                padding: const EdgeInsets.all(HaloSpace.md),
                child: Container(
                  width: double.infinity,
                  height: 280,
                  decoration: BoxDecoration(
                    color: t.surfaceAlt,
                    borderRadius: HaloShape.input,
                  ),
                  clipBehavior: Clip.antiAlias,
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
                            return Center(
                              child: CircularProgressIndicator(
                                value:
                                    loadingProgress.expectedTotalBytes != null
                                    ? loadingProgress.cumulativeBytesLoaded /
                                          loadingProgress.expectedTotalBytes!
                                    : null,
                              ),
                            );
                          },
                        ),
                ),
              ),
            ],

            // 기본 정보
            _InfoGroup(
              title: l10n.infoBasic,
              icon: Icons.person_outline,
              rows: [
                if (card.fullName.isNotEmpty)
                  (l10n.labelFullName, card.fullName),
              ],
            ),

            // 연락처 정보
            _InfoGroup(
              title: l10n.infoContact,
              icon: Icons.call_outlined,
              rows: [
                if (card.phone != null) (l10n.fieldPhone, card.phone!),
                if (card.email != null) (l10n.fieldEmail, card.email!),
                if (card.website != null) (l10n.fieldWebsite, card.website!),
              ],
            ),

            // 조직 정보
            _InfoGroup(
              title: l10n.infoOrg,
              icon: Icons.apartment_outlined,
              rows: [
                if (card.organization != null)
                  (l10n.labelCompany, card.organization!),
                if (card.title != null) (l10n.labelJobTitle, card.title!),
              ],
            ),

            // 주소 정보
            _InfoGroup(
              title: l10n.infoAddress,
              icon: Icons.place_outlined,
              rows: [
                if (card.address != null) (l10n.fieldAddress, card.address!),
              ],
            ),

            // 추가 정보
            _InfoGroup(
              title: l10n.infoNote,
              icon: Icons.sticky_note_2_outlined,
              rows: [if (card.note != null) (l10n.fieldNote, card.note!)],
            ),

            const SizedBox(height: HaloSpace.xxl),

            // VCF 다운로드 QR코드
            HaloSectionHeading(l10n.sectionShare, icon: Icons.qr_code_2),
            HaloCard(
              padding: const EdgeInsets.all(HaloSpace.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const HaloIconBadge(
                        icon: Icons.contact_phone_outlined,
                        soft: true,
                      ),
                      const SizedBox(width: HaloSpace.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              l10n.saveAsContactTitle,
                              style: HaloType.value.copyWith(color: t.text),
                            ),
                            Text(
                              l10n.saveAsContactBody,
                              style: HaloType.label.copyWith(color: t.muted2),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: HaloSpace.lg),
                  // ② 이 화면의 유일한 주 버튼.
                  HaloPrimaryButton(
                    label: l10n.viewVcfQr,
                    icon: Icons.qr_code,
                    onPressed: _openVcfQrCode,
                  ),

                  // 이미지 다운로드 QR코드 (명함 이미지가 있는 경우에만)
                  if (hasImage) ...[
                    const SizedBox(height: HaloSpace.xl),
                    Row(
                      children: [
                        const HaloIconBadge(
                          icon: Icons.image_outlined,
                          soft: true,
                        ),
                        const SizedBox(width: HaloSpace.md),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                l10n.sendCardImageTitle,
                                style: HaloType.value.copyWith(color: t.text),
                              ),
                              Text(
                                l10n.sendCardImageBody,
                                style: HaloType.label.copyWith(color: t.muted2),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: HaloSpace.lg),
                    HaloSecondaryButton(
                      label: l10n.viewImageQr,
                      icon: Icons.qr_code,
                      tone: t.point,
                      onPressed: _openImageQrCode,
                    ),
                  ],
                ],
              ),
            ),

            // 등록일 정보
            const SizedBox(height: HaloSpace.xl),
            Center(
              child: Text(
                card.createdAt != null
                    ? l10n.createdOn(card.createdAt!)
                    : l10n.createdOnUnknown,
                style: HaloType.label.copyWith(color: t.muted2),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 라벨-값 묶음 한 덩어리. 값이 하나도 없으면 통째로 사라진다.
class _InfoGroup extends StatelessWidget {
  const _InfoGroup({
    required this.title,
    required this.icon,
    required this.rows,
  });

  final String title;
  final IconData icon;
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: HaloSpace.xxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          HaloSectionHeading(title, icon: icon),
          HaloCard(
            padding: const EdgeInsets.all(HaloSpace.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < rows.length; i++)
                  HaloInfoRow(
                    label: rows[i].$1,
                    value: rows[i].$2,
                    isLast: i == rows.length - 1,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
