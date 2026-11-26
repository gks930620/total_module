import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/halo_theme.dart';
import '../theme/halo_flourish.dart';

/// 배경 메시(오로라) — Halo 의 "공기".
///
/// 위쪽에 옅게만 깔아 아래로 갈수록 차분해지게 한다. 진하게 키우면 본문 대비가 떨어진다.
/// CSS 의 `background-attachment: fixed` 에 해당 — 스크롤해도 따라 움직이지 않도록
/// 스크롤 뷰 **뒤에** 깐다.
class HaloAurora extends StatelessWidget {
  const HaloAurora({super.key});

  @override
  Widget build(BuildContext context) {
    final f = context.flourish;

    return IgnorePointer(
      child: LayoutBuilder(
        builder: (context, c) {
          final w = c.maxWidth;
          final h = c.maxHeight;
          return Stack(
            children: [
              _blob(f.auroraViolet, w * 1.24, h * 0.44, 0.06, -0.08, w, h),
              _blob(f.auroraPink, w * 1.10, h * 0.40, 0.96, -0.04, w, h),
              _blob(f.auroraSky, w * 1.30, h * 0.48, 0.62, 1.04, w, h),
            ],
          );
        },
      ),
    );
  }

  /// [cx], [cy] 는 화면 대비 비율(CSS 의 `at 6% -8%` 와 같은 뜻).
  Widget _blob(
    Color color,
    double bw,
    double bh,
    double cx,
    double cy,
    double w,
    double h,
  ) {
    return Positioned(
      left: w * cx - bw / 2,
      top: h * cy - bh / 2,
      width: bw,
      height: bh,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            radius: 0.5,
            // 투명은 반드시 같은 색의 알파 0 으로 — Colors.transparent 를 쓰면
            // 가장자리가 검게 죽는다.
            colors: [color, color.withValues(alpha: 0)],
            stops: const [0.0, 0.62],
          ),
        ),
      ),
    );
  }
}

/// ③ 유리는 헤더에만 — 콘텐츠가 실제로 뒤로 스크롤돼 지나가는 유일한 자리다.
class HaloAppBar extends StatelessWidget implements PreferredSizeWidget {
  const HaloAppBar({
    super.key,
    this.title,
    this.leading,
    this.actions,
    this.automaticallyImplyLeading = true,
  });

  final String? title;
  final Widget? leading;
  final List<Widget>? actions;
  final bool automaticallyImplyLeading;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final t = context.halo;
    final f = context.flourish;

    return AppBar(
      // 유리 앱바는 배경이 투명이라 상태바 아이콘 밝기를 직접 정해 준다.
      systemOverlayStyle: Theme.of(context).brightness == Brightness.dark
          ? SystemUiOverlayStyle.light
          : SystemUiOverlayStyle.dark,
      automaticallyImplyLeading: automaticallyImplyLeading,
      leading: leading,
      actions: actions,
      backgroundColor: Colors.transparent,
      title: title == null
          ? null
          : Text(title!, style: HaloType.pageTitle.copyWith(color: t.text)),
      flexibleSpace: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: f.glass,
              border: Border(bottom: BorderSide(color: t.border, width: 1)),
            ),
            child: const SizedBox.expand(),
          ),
        ),
      ),
    );
  }
}

/// Halo 화면의 바탕 — 배경색 + 오로라 + (선택) 유리 앱바.
///
/// 앱바 뒤로 콘텐츠가 지나가야 유리가 의미를 가지므로 `extendBodyBehindAppBar` 를 켠다.
/// 스크롤 뷰를 넣을 때는 상단 여백에 [contentTopInset] 을 더한다.
class HaloScaffold extends StatelessWidget {
  const HaloScaffold({
    super.key,
    required this.body,
    this.appBar,
    this.resizeToAvoidBottomInset,
  });

  final Widget body;
  final PreferredSizeWidget? appBar;
  final bool? resizeToAvoidBottomInset;

  /// 유리 앱바에 가려지지 않도록 스크롤 콘텐츠가 확보해야 할 위쪽 여백.
  static double contentTopInset(BuildContext context) =>
      MediaQuery.paddingOf(context).top + kToolbarHeight + HaloSpace.lg;

  /// 하단 시스템 내비게이션 바에 가려지지 않도록 확보할 아래쪽 여백.
  static double contentBottomInset(BuildContext context) =>
      MediaQuery.paddingOf(context).bottom + HaloSpace.xxl;

  @override
  Widget build(BuildContext context) {
    final t = context.halo;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: appBar,
      extendBodyBehindAppBar: true,
      resizeToAvoidBottomInset: resizeToAvoidBottomInset,
      body: Stack(
        children: [
          const Positioned.fill(child: HaloAurora()),
          body,
        ],
      ),
    );
  }
}
