// =============================================================================
// Halo — Flutter 토큰
// "화려함을 한 곳에 모은다"
//
// ⚠ 자동 생성 파일이다. kits/halo/tokens.json 을 고치고 node tools/build.mjs.
//
// 쓰는 법:
//   import 'kit_theme.dart';
//   import 'tokens.dart';
//
//   MaterialApp(
//     theme:     HaloKit.light,
//     darkTheme: HaloKit.dark,
//     themeMode: ThemeMode.system,
//   );
//
//   final t = KitTokens.of(context);   // 위젯에서 색 꺼내기
// =============================================================================

import 'package:flutter/material.dart';
import 'kit_theme.dart';

class HaloKit {
  const HaloKit._();

  static const String id = 'halo';
  static const String label = 'Halo';
  static const List<String> modes = ['light', 'dark'];

  /// 치수 — CSS 의 --r / --sp-4 … 와 이름·값이 같다
  static const double rSm = 13;
  static const double r = 14;
  static const double rLg = 20;
  static const double rPill = 999;
  static const double bw = 1;
  static const double sp1 = 4;
  static const double sp2 = 8;
  static const double sp3 = 12;
  static const double sp4 = 16;
  static const double sp5 = 20;
  static const double sp6 = 24;
  static const double sp8 = 32;
  static const double sp10 = 40;
  static const double navH = 64;
  static const double sidebarW = 216;
  static const double contentMax = 1180;
  static const double tabH = 62;
  static const double touch = 46;

  /// 타이포 크기·행간 — CSS 의 --t-md / --lh … 와 같다
  static const double tXs = 11.5;
  static const double tSm = 13;
  static const double tMd = 14.5;
  static const double tLg = 17;
  static const double tXl = 21;
  static const double t2xl = 28;
  static const double t3xl = 36;
  static const double lhTight = 1.3;
  static const double lh = 1.65;
  static const double lhRelaxed = 1.8;

  /// 굵기 — CSS 의 --w-bold … 와 같다
  static const FontWeight wNormal = FontWeight.w400;
  static const FontWeight wMedium = FontWeight.w500;
  static const FontWeight wBold = FontWeight.w600;
  static const FontWeight wHeavy = FontWeight.w800;

  static const BorderRadius brSm = BorderRadius.all(Radius.circular(rSm));
  static const BorderRadius br = BorderRadius.all(Radius.circular(r));
  static const BorderRadius brLg = BorderRadius.all(Radius.circular(rLg));
  static const BorderRadius brPill = BorderRadius.all(Radius.circular(999));

  static const KitTokens lightTokens = KitTokens(
    bg: Color(0xFFF8F7FD),
    bgSunken: Color(0xFFF0EEFB),
    surface: Color(0xFFFFFFFF),
    surfaceAlt: Color(0xFFF5F4FF),
    surfaceHover: Color(0xFFF0EEFB),
    text: Color(0xFF2B2745),
    muted: Color(0xFF63608A),
    muted2: Color(0xFF9491B4),
    point: Color(0xFF6D5EFC),
    pointHover: Color(0xFF5A49F0),
    pointSoft: Color(0xFFEEECFF),
    pointText: Color(0xFF5A49F0),
    onPoint: Color(0xFFFFFFFF),
    point2: Color(0xFFF472B6),
    border: Color(0xFFEEEDFA),
    borderStrong: Color(0xFFDDD9F2),
    ok: Color(0xFF0B8F76),
    okSoft: Color(0xFFE7FAF5),
    okText: Color(0xFF0B8F76),
    warn: Color(0xFFA86A06),
    warnSoft: Color(0xFFFDF3E0),
    warnText: Color(0xFF8D5804),
    err: Color(0xFFD63A52),
    errSoft: Color(0xFFFDECEF),
    errText: Color(0xFFB52C42),
    overlay: Color(0x732B2745),
    focus: Color(0xFF6D5EFC),
    radiusSm: rSm, radius: r, radiusLg: rLg, borderWidth: bw,
    fontFamily: null,
  );

  static const KitTokens darkTokens = KitTokens(
    bg: Color(0xFF14121F),
    bgSunken: Color(0xFF100E1A),
    surface: Color(0xFF1C1930),
    surfaceAlt: Color(0xFF221E38),
    surfaceHover: Color(0xFF2A2544),
    text: Color(0xFFE8E6F5),
    muted: Color(0xFFA5A0C4),
    muted2: Color(0xFF7A7599),
    point: Color(0xFF8B7DFF),
    pointHover: Color(0xFFA394FF),
    pointSoft: Color(0xFF262041),
    pointText: Color(0xFFA99DFF),
    onPoint: Color(0xFFFFFFFF),
    point2: Color(0xFFF472B6),
    border: Color(0xFF2C2844),
    borderStrong: Color(0xFF3D3760),
    ok: Color(0xFF2EE0BD),
    okSoft: Color(0xFF10322C),
    okText: Color(0xFF4FE3C4),
    warn: Color(0xFFF7B955),
    warnSoft: Color(0xFF3A2C11),
    warnText: Color(0xFFF9C877),
    err: Color(0xFFFF7A8C),
    errSoft: Color(0xFF3B1E26),
    errText: Color(0xFFFF9AA8),
    overlay: Color(0x99000000),
    focus: Color(0xFF8B7DFF),
    radiusSm: rSm, radius: r, radiusLg: rLg, borderWidth: bw,
    fontFamily: null,
  );

  static ThemeData get light => buildKitTheme(lightTokens, Brightness.light);
  static ThemeData get dark => buildKitTheme(darkTokens, Brightness.dark);
}
