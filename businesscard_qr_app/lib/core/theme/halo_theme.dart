import 'package:flutter/material.dart';

import 'halo_flourish.dart';
import 'kit/kit_theme.dart';
import 'kit/tokens.dart';

/// Halo 타이포 — 킷의 `--t-*` 치수 규칙을 모바일에 맞춰 옮긴 것.
///
/// 웹 킷의 본문은 `--t-md 14.5px` 이지만 이 앱은 손에 들고 읽는 물건이라 한 단계 키웠다.
/// **큰 글자는 자간을 좁힌다**(-.02em ~ -.03em)는 킷 규칙은 그대로 지킨다.
abstract final class HaloType {
  /// 히어로 제목 — 32 / w800 / -.03em (킷 `--t-3xl` 36 을 모바일로 한 단계 낮춤)
  static const TextStyle hero = TextStyle(
    fontSize: 32,
    fontWeight: HaloKit.wHeavy,
    letterSpacing: -0.96,
    height: HaloKit.lhTight,
  );

  /// 화면 제목 — 25 / w700 / -.025em
  static const TextStyle pageTitle = TextStyle(
    fontSize: 25,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.63,
    height: HaloKit.lhTight,
  );

  /// 카드 제목·목록 이름 — 22 / w700 / -.02em
  static const TextStyle cardTitle = TextStyle(
    fontSize: 22,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.44,
    height: 1.35,
  );

  /// 값·강조 본문 — 19 / w600
  static const TextStyle value = TextStyle(
    fontSize: 19,
    fontWeight: HaloKit.wBold,
    height: 1.45,
  );

  /// 본문 — 16 / 1.55
  static const TextStyle body = TextStyle(fontSize: 16, height: 1.55);

  /// 버튼 라벨 — 17 / w700
  static const TextStyle button = TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.2,
  );

  /// 라벨·캡션 — 13.5 (색은 muted2)
  static const TextStyle label = TextStyle(fontSize: 13.5, height: 1.4);

  /// 섹션 헤딩 — 웹 킷은 11px uppercase 지만 한글엔 대문자가 없어
  /// 크기·굵기·자간으로 같은 "작고 단단한 라벨" 인상을 만든다.
  static const TextStyle sectionHeading = TextStyle(
    fontSize: HaloKit.tSm,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.3,
  );
}

/// Halo 테마 조립.
///
/// 골격은 **킷의 [buildKitTheme] 가 만든다** — Material 기본 위젯이 킷 토큰을 따르게 하는 곳.
/// 여기서는 그 위에 이 앱만의 결정을 얹는다:
///   - 버튼은 전부 알약(킷은 `--r` 14, 이 앱은 `--r-pill`)
///   - 앱바는 투명 + blur (원칙 ③ — 실제 유리는 `HaloAppBar` 가 건다)
///   - 입력창은 테두리 없이 `surfaceAlt` 면으로, 포커스에서만 테를 준다
///   - 모바일 타이포([HaloType])
///
/// **색을 새로 만들지 않는다.** 전부 [KitTokens] 에서 꺼낸다.
abstract final class HaloTheme {
  static ThemeData light() =>
      _apply(HaloKit.light, HaloKit.lightTokens, HaloFlourish.light);

  static ThemeData dark() =>
      _apply(HaloKit.dark, HaloKit.darkTokens, HaloFlourish.dark);

  static ThemeData _apply(ThemeData base, KitTokens t, HaloFlourish f) {
    return base.copyWith(
      // buildKitTheme 이 KitTokens 를 넣어 뒀다. 덮어쓰므로 둘 다 다시 넣는다.
      extensions: <ThemeExtension<dynamic>>[t, f],
      textTheme: base.textTheme.apply(bodyColor: t.text, displayColor: t.text),
      // ③ 유리는 앱바에만 — 배경을 비워 두고 HaloAppBar 가 blur 를 건다.
      appBarTheme: base.appBarTheme.copyWith(
        backgroundColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        foregroundColor: t.text,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        shape: const Border(),
        titleTextStyle: HaloType.pageTitle.copyWith(color: t.text),
        iconTheme: IconThemeData(color: t.muted, size: 24),
        actionsIconTheme: IconThemeData(color: t.muted, size: 24),
      ),
      // ① 읽는 면은 불투명. 테두리 대신 그림자를 쓰므로 HaloCard 를 쓴다.
      cardTheme: base.cardTheme.copyWith(
        shape: RoundedRectangleBorder(borderRadius: HaloShape.card),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: t.surfaceAlt,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: HaloSpace.lg,
          vertical: HaloSpace.lg,
        ),
        border: OutlineInputBorder(
          borderRadius: HaloShape.input,
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: HaloShape.input,
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: HaloShape.input,
          borderSide: BorderSide(color: t.point, width: 1.6),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: HaloShape.input,
          borderSide: BorderSide(color: t.err, width: 1.4),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: HaloShape.input,
          borderSide: BorderSide(color: t.err, width: 1.6),
        ),
        labelStyle: HaloType.body.copyWith(color: t.muted),
        floatingLabelStyle: HaloType.label.copyWith(
          color: t.point,
          fontWeight: HaloKit.wBold,
        ),
        hintStyle: HaloType.body.copyWith(color: t.muted2),
        helperStyle: HaloType.label.copyWith(color: t.muted2),
        errorStyle: HaloType.label.copyWith(color: t.errText),
      ),
      // 버튼은 전부 알약(--r-pill). 예외 없음.
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: t.point,
          textStyle: HaloType.button,
          shape: RoundedRectangleBorder(borderRadius: HaloShape.round),
          padding: const EdgeInsets.symmetric(
            horizontal: HaloSpace.lg,
            vertical: HaloSpace.md,
          ),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: t.surface,
          foregroundColor: t.muted,
          elevation: 0,
          textStyle: HaloType.button,
          shape: RoundedRectangleBorder(borderRadius: HaloShape.round),
          padding: const EdgeInsets.symmetric(
            horizontal: HaloSpace.xl,
            vertical: HaloSpace.lg,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: t.text,
          backgroundColor: t.surface,
          side: BorderSide(color: t.borderStrong, width: t.borderWidth),
          textStyle: HaloType.button,
          shape: RoundedRectangleBorder(borderRadius: HaloShape.round),
          padding: const EdgeInsets.symmetric(
            horizontal: HaloSpace.xl,
            vertical: HaloSpace.lg,
          ),
        ),
      ),
      dialogTheme: base.dialogTheme.copyWith(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: HaloShape.card),
        titleTextStyle: HaloType.cardTitle.copyWith(color: t.text),
        contentTextStyle: HaloType.body.copyWith(color: t.muted),
      ),
      bottomSheetTheme: base.bottomSheetTheme.copyWith(
        elevation: 0,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(HaloShape.radius),
          ),
        ),
      ),
      snackBarTheme: base.snackBarTheme.copyWith(
        contentTextStyle: HaloType.body.copyWith(
          color: t.bg,
          fontWeight: HaloKit.wBold,
        ),
        behavior: SnackBarBehavior.floating,
        insetPadding: const EdgeInsets.all(HaloSpace.lg),
        shape: RoundedRectangleBorder(borderRadius: HaloShape.input),
        elevation: 0,
      ),
      listTileTheme: ListTileThemeData(
        iconColor: t.point,
        textColor: t.text,
        titleTextStyle: HaloType.value.copyWith(color: t.text),
        shape: RoundedRectangleBorder(borderRadius: HaloShape.input),
      ),
      progressIndicatorTheme: base.progressIndicatorTheme.copyWith(
        circularTrackColor: t.surfaceAlt,
      ),
      iconTheme: IconThemeData(color: t.muted),
      splashFactory: InkSparkle.splashFactory,
    );
  }
}
