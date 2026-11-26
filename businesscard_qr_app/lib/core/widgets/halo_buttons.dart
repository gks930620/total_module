import 'package:flutter/material.dart';

import '../theme/halo_theme.dart';
import '../../l10n/app_localizations.dart';
import '../theme/halo_flourish.dart';

/// 주 버튼 — ② 가 허용하는 그라디언트 자리. **화면당 1~2개**.
/// 세 개 이상 두면 무엇이 주 동작인지 안 보인다.
class HaloPrimaryButton extends StatefulWidget {
  const HaloPrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.expand = true,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;
  final bool loading;

  @override
  State<HaloPrimaryButton> createState() => _HaloPrimaryButtonState();
}

class _HaloPrimaryButtonState extends State<HaloPrimaryButton> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed == value) return;
    setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    final f = context.flourish;
    final enabled = widget.onPressed != null && !widget.loading;

    return Opacity(
      opacity: enabled ? 1 : 0.55,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        width: widget.expand ? double.infinity : null,
        decoration: BoxDecoration(
          // 눌리면 gradHot 으로 강조를 올린다.
          gradient: _pressed && enabled ? f.gradHot : f.grad,
          borderRadius: HaloShape.round,
          // 그라디언트 요소에는 색 있는 그림자를 — 일반 그림자로는 뜨지 않는다.
          boxShadow: enabled ? f.shAcc : null,
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: enabled ? widget.onPressed : null,
            onTapDown: (_) => _setPressed(true),
            onTapUp: (_) => _setPressed(false),
            onTapCancel: () => _setPressed(false),
            borderRadius: HaloShape.round,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: HaloSpace.xl,
                vertical: HaloSpace.lg,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: widget.expand
                    ? MainAxisSize.max
                    : MainAxisSize.min,
                children: [
                  if (widget.loading)
                    SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.2,
                        color: f.onGrad,
                      ),
                    )
                  else if (widget.icon != null)
                    Icon(widget.icon, color: f.onGrad, size: 22),
                  if (widget.loading || widget.icon != null)
                    const SizedBox(width: HaloSpace.sm),
                  Flexible(
                    child: Text(
                      widget.label,
                      overflow: TextOverflow.ellipsis,
                      style: HaloType.button.copyWith(color: f.onGrad),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 보조 버튼 — 조용한 90%. 불투명 면 + 그림자, 그라디언트 없음.
class HaloSecondaryButton extends StatelessWidget {
  const HaloSecondaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.expand = true,
    this.tone,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expand;

  /// 글자·아이콘 색. 기본은 [HaloTokens.muted].
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final t = context.halo;
    final f = context.flourish;
    final fg = tone ?? t.muted;

    return Container(
      width: expand ? double.infinity : null,
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: HaloShape.round,
        boxShadow: f.sh,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: HaloShape.round,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: HaloSpace.xl,
              vertical: HaloSpace.lg,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, color: fg, size: 22),
                  const SizedBox(width: HaloSpace.sm),
                ],
                Flexible(
                  child: Text(
                    label,
                    overflow: TextOverflow.ellipsis,
                    style: HaloType.button.copyWith(color: fg),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 히어로(그라디언트) 위에 얹는 버튼 — 흰 알약. 그라디언트 위 그라디언트를 피한다.
class HaloOnHeroButton extends StatelessWidget {
  const HaloOnHeroButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final f = context.flourish;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(color: f.onGrad, borderRadius: HaloShape.round),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: HaloShape.round,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: HaloSpace.xl,
              vertical: HaloSpace.lg,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (icon != null) ...[
                  Icon(icon, color: f.gradStart, size: 22),
                  const SizedBox(width: HaloSpace.sm),
                ],
                Text(
                  label,
                  style: HaloType.button.copyWith(color: f.gradStart),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 카카오 로그인 — 브랜드 색이 규정으로 정해져 있어 토큰 팔레트 밖이다.
/// 형태(알약·그림자·타이포)만 Halo 를 따른다.
class HaloKakaoButton extends StatelessWidget {
  const HaloKakaoButton({
    super.key,
    required this.onPressed,
    this.loading = false,
  });

  final VoidCallback? onPressed;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final f = context.flourish;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: f.kakaoYellow,
        borderRadius: HaloShape.round,
        boxShadow: f.sh,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: loading ? null : onPressed,
          borderRadius: HaloShape.round,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: HaloSpace.xl,
              vertical: HaloSpace.lg,
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (loading)
                  SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      color: f.kakaoLabel,
                    ),
                  )
                else
                  Icon(Icons.chat_bubble, color: f.kakaoLabel, size: 21),
                const SizedBox(width: HaloSpace.sm),
                Text(
                  AppLocalizations.of(context).loginWithKakao,
                  style: HaloType.button.copyWith(color: f.kakaoLabel),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 앱바에 놓는 아이콘 버튼 — 유리 위에서도 눌리는 자리가 보이도록 알약 배경을 깐다.
class HaloAppBarAction extends StatelessWidget {
  const HaloAppBarAction({
    super.key,
    required this.icon,
    required this.onPressed,
    required this.tooltip,
    this.tone,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String tooltip;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final t = context.halo;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 3),
      child: Material(
        color: t.surfaceAlt,
        shape: RoundedRectangleBorder(borderRadius: HaloShape.round),
        clipBehavior: Clip.antiAlias,
        child: IconButton(
          icon: Icon(icon, size: 21),
          color: tone ?? t.muted,
          tooltip: tooltip,
          onPressed: onPressed,
          constraints: const BoxConstraints.tightFor(width: 42, height: 42),
          padding: EdgeInsets.zero,
        ),
      ),
    );
  }
}
