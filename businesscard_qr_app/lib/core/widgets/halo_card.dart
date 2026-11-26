import 'package:flutter/material.dart';

import '../theme/halo_theme.dart';
import '../theme/halo_flourish.dart';

/// ① 읽는 면은 불투명 + ④ 카드 윗변 그라디언트 선 — Halo 의 서명.
///
/// 평소엔 거의 안 보이다가(0.16) 누르면 또렷해진다(0.85).
/// 웹 킷의 hover 자리를 모바일에서는 눌림 상태가 대신한다.
class HaloCard extends StatefulWidget {
  const HaloCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(HaloSpace.lg),
    this.showTopLine = true,
    this.expand = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final bool showTopLine;

  /// 카드는 패널이라 기본은 가로 꽉 채움. 내용만큼만 줄이려면 false.
  final bool expand;

  @override
  State<HaloCard> createState() => _HaloCardState();
}

class _HaloCardState extends State<HaloCard> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final t = context.halo;
    final f = context.flourish;
    final active = _pressed && widget.onTap != null;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      curve: Curves.easeOut,
      width: widget.expand ? double.infinity : null,
      decoration: BoxDecoration(
        // 읽는 면 — 불투명. 그라디언트·유리 금지.
        color: t.surface,
        borderRadius: HaloShape.card,
        boxShadow: active ? f.shLg : f.sh,
      ),
      child: ClipRRect(
        borderRadius: HaloShape.card,
        child: Stack(
          children: [
            Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: widget.onTap,
                onTapDown: (_) => _setPressed(true),
                onTapUp: (_) => _setPressed(false),
                onTapCancel: () => _setPressed(false),
                highlightColor: t.pointSoft.withValues(alpha: 0.4),
                splashColor: t.pointSoft,
                child: Padding(padding: widget.padding, child: widget.child),
              ),
            ),
            if (widget.showTopLine)
              Positioned(
                top: 0,
                // 좌우를 띄우는 게 핵심 — 끝까지 채우면 촌스러워진다.
                left: HaloShape.topLineInset,
                right: HaloShape.topLineInset,
                child: IgnorePointer(
                  child: AnimatedOpacity(
                    duration: const Duration(milliseconds: 200),
                    opacity: active
                        ? HaloShape.topLineActiveOpacity
                        : HaloShape.topLineIdleOpacity,
                    child: Container(
                      height: HaloShape.topLineHeight,
                      decoration: BoxDecoration(
                        gradient: f.grad,
                        borderRadius: const BorderRadius.vertical(
                          bottom: Radius.circular(3),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// ② 그라디언트는 초점에만 — 화면당 **1개**. 가장 화려한 단 한 블록.
class HaloHero extends StatelessWidget {
  const HaloHero({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.trailing,
    this.footer,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? trailing;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    final f = context.flourish;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(HaloSpace.xl),
      decoration: BoxDecoration(
        gradient: f.gradHero,
        borderRadius: HaloShape.hero,
        boxShadow: f.shHero,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (icon != null) ...[
                Container(
                  width: HaloShape.badge,
                  height: HaloShape.badge,
                  decoration: BoxDecoration(
                    // 히어로 위에서는 흰 반투명 배지가 맞다 — 그라디언트 위 그라디언트 금지.
                    color: f.onGrad.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(HaloShape.badgeRadius),
                  ),
                  child: Icon(icon, color: f.onGrad, size: 22),
                ),
                const SizedBox(width: HaloSpace.md),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: HaloType.hero.copyWith(color: f.onGrad)),
                    if (subtitle != null) ...[
                      const SizedBox(height: HaloSpace.sm),
                      Text(
                        subtitle!,
                        style: HaloType.body.copyWith(
                          color: f.onGrad.withValues(alpha: 0.86),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
          if (footer != null) ...[
            const SizedBox(height: HaloSpace.xl),
            footer!,
          ],
        ],
      ),
    );
  }
}

/// 섹션 헤딩 — 작고 단단한 라벨. 카드 위에 얹어 그룹을 나눈다.
class HaloSectionHeading extends StatelessWidget {
  const HaloSectionHeading(this.label, {super.key, this.icon});

  final String label;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final t = context.halo;

    return Padding(
      padding: const EdgeInsets.only(left: HaloSpace.xs, bottom: HaloSpace.md),
      child: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, size: 16, color: t.muted2),
            const SizedBox(width: HaloSpace.sm),
          ],
          Text(label, style: HaloType.sectionHeading.copyWith(color: t.muted2)),
        ],
      ),
    );
  }
}

/// 라벨 + 값 한 줄. 표의 행처럼 읽히게 라벨은 [HaloTokens.muted2], 값은 [HaloTokens.text].
class HaloInfoRow extends StatelessWidget {
  const HaloInfoRow({
    super.key,
    required this.label,
    required this.value,
    this.isLast = false,
  });

  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final t = context.halo;

    return Container(
      padding: EdgeInsets.only(bottom: isLast ? 0 : HaloSpace.md),
      margin: EdgeInsets.only(bottom: isLast ? 0 : HaloSpace.md),
      decoration: isLast
          ? null
          // 테두리는 표의 행 구분선처럼 꼭 필요한 곳에만.
          : BoxDecoration(
              border: Border(bottom: BorderSide(color: t.border)),
            ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: HaloType.label.copyWith(color: t.muted2)),
          const SizedBox(height: HaloSpace.xs),
          SelectableText(value, style: HaloType.value.copyWith(color: t.text)),
        ],
      ),
    );
  }
}

/// 아이콘 배지 — ② 가 허용하는 그라디언트 자리.
/// 목록처럼 여러 번 반복되는 자리에는 [soft] 를 켜서 조용하게 둔다.
class HaloIconBadge extends StatelessWidget {
  const HaloIconBadge({
    super.key,
    this.icon,
    this.label,
    this.size = HaloShape.badge,
    this.soft = false,
  }) : assert(icon != null || label != null, 'icon 이나 label 중 하나는 필요하다');

  final IconData? icon;
  final String? label;
  final double size;
  final bool soft;

  @override
  Widget build(BuildContext context) {
    final t = context.halo;
    final f = context.flourish;
    final radius = size >= HaloShape.badgeLg
        ? HaloShape.badgeLgRadius
        : HaloShape.badgeRadius;
    final fg = soft ? t.point : f.onGrad;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: soft ? t.pointSoft : null,
        gradient: soft ? null : f.grad,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: soft ? null : f.shAcc,
      ),
      alignment: Alignment.center,
      child: icon != null
          ? Icon(icon, color: fg, size: size * 0.46)
          : Text(
              label!,
              style: TextStyle(
                color: fg,
                fontSize: size * 0.4,
                fontWeight: FontWeight.w700,
              ),
            ),
    );
  }
}
