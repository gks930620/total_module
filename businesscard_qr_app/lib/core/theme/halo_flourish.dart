import 'package:flutter/material.dart';

import 'kit/kit_theme.dart';
import 'kit/tokens.dart';

/// Halo 킷의 **고유 표현** — 킷이 Flutter 로 내보내지 않는 값만 담는다.
///
/// 킷 폴더의 `tokens.dart` 는 면·글자·강조·의미색까지만 내보내고,
/// Halo 의 서명인 그라디언트·그림자·오로라·유리는 웹 쪽 `tokens.css` 에만 있다
/// (`--card-accent` `--btn-bg` `--hero-bg` `--sh-2` `--page-bg-image` …).
/// 그 값들을 Flutter 로 옮긴 것이 이 확장이다. **값은 tokens.css 와 1:1로 같다.**
///
/// 원칙(킷 `사용법.md` §이 킷의 성격):
///   ① 읽는 면(카드·패널·본문)은 [KitTokens.surface] 불투명. 그라디언트를 깔지 않는다.
///   ② 그라디언트는 초점(주 버튼·활성 항목·아이콘 배지·히어로)에만.
///   ③ 유리(blur)는 헤더 하나만.
///   ④ 카드 윗변에 1px 그라디언트 선.
///
/// 면·글자·강조색은 여기서 다시 정의하지 않는다. 그건 항상 `KitTokens.of(context)` 다.
@immutable
class HaloFlourish extends ThemeExtension<HaloFlourish> {
  const HaloFlourish({
    required this.gradStart,
    required this.gradEnd,
    required this.gradHotEnd,
    required this.gradHeroMid,
    required this.gradHeroEnd,
    required this.auroraSky,
    required this.glass,
    required this.glassEdge,
    required this.shColor,
    required this.shOpacity,
  });

  /// 그라디언트 램프 — `--card-accent` / `--btn-bg` / `--hero-bg` 의 색 정거장.
  ///
  /// [gradStart] 는 라이트에서 `--point` 와 같지만 다크에서는 다르다(`#7a6bfa` vs `--point #8b7dff`).
  /// 그래서 파생하지 않고 킷 CSS 값을 그대로 옮긴다.
  final Color gradStart;
  final Color gradEnd;

  /// `--btn-hover-bg` 의 끝 색. 킷의 `--point-2` 와 같은 값이다.
  final Color gradHotEnd;

  /// `--hero-bg` 의 가운데·끝 정거장.
  final Color gradHeroMid;
  final Color gradHeroEnd;

  /// `--page-bg-image` 세 번째 블롭. 강조 계열이 아니라 별도 값이다.
  final Color auroraSky;

  /// ③ 유리 헤더 — 킷 CSS 의 `--glass-edge` 대응. 앱 전용(웹 킷은 헤더가 반투명 배경).
  final Color glass;
  final Color glassEdge;

  /// `--sh-1` `--sh-2` `--sh-3` 의 재료. 라이트는 보랏빛 옅게, 다크는 검정 진하게.
  final Color shColor;
  final double shOpacity;

  /// `--card-accent` / `--btn-bg` / `--active-bg`
  /// = `linear-gradient(135deg, gradStart, gradEnd)`
  LinearGradient get grad => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [gradStart, gradEnd],
  );

  /// `--btn-hover-bg` = `linear-gradient(135deg, gradStart, point-2)`
  LinearGradient get gradHot => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [gradStart, gradHotEnd],
  );

  /// `--hero-bg` = `linear-gradient(135deg, gradStart 0%, #8b5cf6 45%, #f472b6 100%)`
  /// — 화면에서 가장 화려한 단 한 블록.
  LinearGradient get gradHero => LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [gradStart, gradHeroMid, gradHeroEnd],
    stops: const [0.0, 0.45, 1.0],
  );

  /// `--sh-2` — 면을 띄우는 기본 그림자. 테두리 대신 이걸 쓴다.
  List<BoxShadow> get sh => [
    BoxShadow(
      color: shColor.withValues(alpha: shOpacity),
      blurRadius: 22,
      offset: const Offset(0, 6),
    ),
    BoxShadow(
      color: shColor.withValues(alpha: shOpacity * 0.62),
      blurRadius: 3,
      offset: const Offset(0, 1),
    ),
  ];

  /// `--sh-3` — 눌림·강조 시 떠오름.
  List<BoxShadow> get shLg => [
    BoxShadow(
      color: shColor.withValues(alpha: shOpacity * 1.9),
      blurRadius: 42,
      offset: const Offset(0, 16),
    ),
  ];

  /// `--sh-point` — 그라디언트 요소 전용(색 있는 그림자).
  /// 그라디언트 위에 [sh] 를 쓰면 뜨지 않는다.
  List<BoxShadow> get shAcc => [
    BoxShadow(
      color: gradStart.withValues(alpha: 0.32),
      blurRadius: 22,
      offset: const Offset(0, 8),
    ),
  ];

  /// 히어로 전용 그림자 — 다크에서는 검정으로 눌러야 색이 뭉개지지 않는다.
  List<BoxShadow> get shHero => [
    BoxShadow(
      color: shOpacity > 0.2
          ? const Color(0xFF000000).withValues(alpha: 0.5)
          : gradStart.withValues(alpha: 0.34),
      blurRadius: 48,
      offset: const Offset(0, 20),
    ),
  ];

  /// `--page-bg-image` 첫 번째 블롭. 라이트 `rgba(167,139,250,.5)` = [gradEnd] 50%,
  /// 다크 `rgba(122,107,250,.22)` = [gradStart] 22%.
  Color get auroraViolet => shOpacity > 0.2
      ? gradStart.withValues(alpha: 0.22)
      : gradEnd.withValues(alpha: 0.50);

  /// `--page-bg-image` 두 번째 블롭 — 라이트 36%, 다크 14%.
  Color get auroraPink =>
      gradHotEnd.withValues(alpha: shOpacity > 0.2 ? 0.14 : 0.36);

  /// 그라디언트 위에 얹는 것들(글자·아이콘·흰 알약)의 색.
  /// 그라디언트는 라이트/다크가 거의 같은 보라라서 두 테마에서 동일하다.
  Color get onGrad => const Color(0xFFFFFFFF);

  /// QR 코드 바탕 — **스캔이 되어야 하므로 다크 모드에서도 항상 흰색이다.**
  /// 킷 토큰을 쓰면 다크에서 어두워져 카메라가 못 읽는다. 의도된 예외.
  Color get qrSurface => const Color(0xFFFFFFFF);

  /// 카카오 브랜드 색 — 브랜드 규정상 고정값(테마 무관). 킷 토큰 대상이 아니다.
  Color get kakaoYellow => const Color(0xFFFEE500);
  Color get kakaoLabel => const Color(0xFF191600);

  /// 라이트 — 킷 `tokens.css` `:root` 의 Halo 값.
  static const HaloFlourish light = HaloFlourish(
    gradStart: Color(0xFF6D5EFC),
    gradEnd: Color(0xFFA78BFA),
    gradHotEnd: Color(0xFFF472B6),
    gradHeroMid: Color(0xFF8B5CF6),
    gradHeroEnd: Color(0xFFF472B6),
    auroraSky: Color(0x424CB8F5),
    glass: Color(0xB8FFFFFF),
    glassEdge: Color(0xE6FFFFFF),
    shColor: Color(0xFF4C4096),
    shOpacity: 0.08,
  );

  /// 다크 — 킷 `tokens.css` `[data-theme="dark"]` 의 Halo 값.
  /// 오로라를 훨씬 약하게 깐다 — 안 그러면 화면이 탁해 보인다.
  static const HaloFlourish dark = HaloFlourish(
    gradStart: Color(0xFF7A6BFA),
    gradEnd: Color(0xFFA78BFA),
    gradHotEnd: Color(0xFFF472B6),
    gradHeroMid: Color(0xFF8B5CF6),
    gradHeroEnd: Color(0xFFF472B6),
    auroraSky: Color(0x1F4CB8F5),
    glass: Color(0xBD1C1930),
    glassEdge: Color(0x14FFFFFF),
    shColor: Color(0xFF000000),
    shOpacity: 0.35,
  );

  @override
  HaloFlourish copyWith({
    Color? gradStart,
    Color? gradEnd,
    Color? gradHotEnd,
    Color? gradHeroMid,
    Color? gradHeroEnd,
    Color? auroraSky,
    Color? glass,
    Color? glassEdge,
    Color? shColor,
    double? shOpacity,
  }) {
    return HaloFlourish(
      gradStart: gradStart ?? this.gradStart,
      gradEnd: gradEnd ?? this.gradEnd,
      gradHotEnd: gradHotEnd ?? this.gradHotEnd,
      gradHeroMid: gradHeroMid ?? this.gradHeroMid,
      gradHeroEnd: gradHeroEnd ?? this.gradHeroEnd,
      auroraSky: auroraSky ?? this.auroraSky,
      glass: glass ?? this.glass,
      glassEdge: glassEdge ?? this.glassEdge,
      shColor: shColor ?? this.shColor,
      shOpacity: shOpacity ?? this.shOpacity,
    );
  }

  @override
  HaloFlourish lerp(ThemeExtension<HaloFlourish>? other, double v) {
    if (other is! HaloFlourish) return this;
    return HaloFlourish(
      gradStart: Color.lerp(gradStart, other.gradStart, v)!,
      gradEnd: Color.lerp(gradEnd, other.gradEnd, v)!,
      gradHotEnd: Color.lerp(gradHotEnd, other.gradHotEnd, v)!,
      gradHeroMid: Color.lerp(gradHeroMid, other.gradHeroMid, v)!,
      gradHeroEnd: Color.lerp(gradHeroEnd, other.gradHeroEnd, v)!,
      auroraSky: Color.lerp(auroraSky, other.auroraSky, v)!,
      glass: Color.lerp(glass, other.glass, v)!,
      glassEdge: Color.lerp(glassEdge, other.glassEdge, v)!,
      shColor: Color.lerp(shColor, other.shColor, v)!,
      shOpacity: shOpacity + (other.shOpacity - shOpacity) * v,
    );
  }
}

/// 킷 토큰과 Halo 표현을 꺼내는 통로.
///
/// - 면·글자·강조·의미색 → [halo] (킷의 [KitTokens]. 여기가 색의 단일 출처)
/// - 그라디언트·그림자·오로라·유리 → [flourish]
extension HaloThemeAccess on BuildContext {
  /// 킷 토큰. `KitTokens.of(this)` 와 같다 — 짧게 쓰려고 둔 별칭.
  KitTokens get halo => KitTokens.of(this);

  /// Halo 고유 표현. 테마에 없으면 라이트를 쓴다.
  HaloFlourish get flourish =>
      Theme.of(this).extension<HaloFlourish>() ?? HaloFlourish.light;
}

/// 형태 — 킷 [HaloKit] 의 치수를 앱에서 쓰는 이름으로 묶은 것.
/// **값을 새로 만들지 않는다.** 전부 킷에서 가져온다.
abstract final class HaloShape {
  /// 카드·패널 — 킷 `--r-lg`
  static const double radius = HaloKit.rLg;

  /// 입력창·작은 요소 — 킷 `--r-sm`
  static const double radiusSm = HaloKit.rSm;

  /// 히어로 — 카드보다 조금 더 크게. 킷에 없는 앱 전용 치수.
  static const double radiusHero = 26;

  /// 버튼·칩·배지는 알약형. 예외 없음. 킷 `--r-pill`
  static const double pill = HaloKit.rPill;

  /// 아이콘 배지 (카드용 / 화면 제목용)
  static const double badge = 40;
  static const double badgeLg = 56;
  static const double badgeRadius = HaloKit.rSm;
  static const double badgeLgRadius = 19;

  /// ④ 카드 윗변 선 — 끝까지 채우면 촌스러워지므로 좌우로 띄운다.
  static const double topLineInset = HaloKit.sp4;
  static const double topLineHeight = 2;
  static const double topLineIdleOpacity = 0.16;

  /// 킷 `extras.css` 의 `.k-card::before { opacity: .85 }`
  static const double topLineActiveOpacity = 0.85;

  static BorderRadius get card => HaloKit.brLg;
  static BorderRadius get input => HaloKit.brSm;
  static BorderRadius get hero => BorderRadius.circular(radiusHero);
  static BorderRadius get round => HaloKit.brPill;
}

/// 간격 — 킷 [HaloKit] 의 `--sp-*` 를 앱에서 쓰는 이름으로 묶은 것.
abstract final class HaloSpace {
  static const double xs = HaloKit.sp1;
  static const double sm = HaloKit.sp2;
  static const double md = HaloKit.sp3;
  static const double lg = HaloKit.sp4;
  static const double xl = HaloKit.sp6;
  static const double xxl = HaloKit.sp8;

  /// 화면 좌우 여백 — 킷 `--sp-5`
  static const double screen = HaloKit.sp5;

  /// 목록 카드 사이 간격. 킷 눈금 사이(12~16)의 앱 전용 값.
  static const double gap = 14;
}
