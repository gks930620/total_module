import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../core/app_error_text.dart';
import '../core/theme/halo_flourish.dart';
import '../core/theme/halo_theme.dart';
import '../core/widgets/halo_buttons.dart';
import '../core/widgets/halo_card.dart';
import '../core/widgets/halo_scaffold.dart';
import '../l10n/app_localizations.dart';
import '../models/entitlement.dart';
import '../services/billing_service.dart';

/// 프로 구독 화면(페이월).
///
/// 두 경로로 들어온다:
///   ① 사용자가 직접 연다 → 현재 상태와 상품을 보여준다.
///   ② 무료 한도를 넘겨 명함 등록이 막혔다 → [limitReached] 로 이유를 먼저 알린다.
///
/// 닫힐 때 **갱신된 [Entitlement]** 를 돌려준다(구매하지 않았으면 처음 값 그대로).
class ProScreen extends StatefulWidget {
  const ProScreen({
    super.key,
    required this.billingService,
    this.initialEntitlement,
    this.limitReached = false,
  });

  final BillingService billingService;

  /// 이미 알고 있는 자격이 있으면 넘겨준다 — 화면이 빈 채로 깜빡이지 않게.
  final Entitlement? initialEntitlement;

  /// 한도 초과로 밀려 들어온 경우.
  final bool limitReached;

  @override
  State<ProScreen> createState() => _ProScreenState();
}

class _ProScreenState extends State<ProScreen> {
  Entitlement? _entitlement;
  ProductDetails? _product;

  bool _loading = true;
  bool _busy = false;

  /// 상품을 못 불러왔을 때의 사유. 화면 안에 조용히 표시한다.
  Object? _productError;

  @override
  void initState() {
    super.initState();
    _entitlement = widget.initialEntitlement;
    _load();
  }

  Future<void> _load() async {
    // 자격과 상품 정보는 서로 독립이라 한쪽이 실패해도 다른 쪽은 보여준다.
    // 특히 상품 조회는 스토어 콘솔 설정에 따라 자주 실패하는데,
    // 그렇다고 "지금 몇 장 썼는지"까지 못 보여줄 이유는 없다.
    final results = await Future.wait([
      widget.billingService.fetchEntitlement().then<Object?>((v) => v).catchError((Object e) => e),
      widget.billingService.loadProProduct().then<Object?>((v) => v).catchError((Object e) => e),
    ]);

    if (!mounted) return;
    setState(() {
      if (results[0] is Entitlement) _entitlement = results[0] as Entitlement;
      if (results[1] is ProductDetails) {
        _product = results[1] as ProductDetails;
        _productError = null;
      } else {
        _productError = results[1];
      }
      _loading = false;
    });
  }

  Future<void> _buy() async {
    final product = _product;
    if (product == null || _busy) return;

    setState(() => _busy = true);
    await _runPurchase(
      () => widget.billingService.purchasePro(product),
      successMessage: (l10n) => l10n.purchaseSucceeded,
    );
  }

  Future<void> _restore() async {
    if (_busy) return;
    setState(() => _busy = true);
    await _runPurchase(
      widget.billingService.restorePurchases,
      successMessage: (l10n) => l10n.purchaseRestored,
      nothingMessage: (l10n) => l10n.purchaseNothingToRestore,
    );
  }

  /// 구매·복원 공통 처리 — 결과에 따라 스낵바를 띄우고 자격을 갱신한다.
  Future<void> _runPurchase(
    Future<Entitlement?> Function() action, {
    required String Function(AppLocalizations) successMessage,
    String Function(AppLocalizations)? nothingMessage,
  }) async {
    final l10n = AppLocalizations.of(context);
    try {
      final result = await action();
      if (!mounted) return;

      if (result == null) {
        // 사용자가 스토어 창을 닫았다. 오류가 아니므로 조용히 안내만 한다.
        _showSnack(nothingMessage?.call(l10n) ?? l10n.purchaseCancelled);
        return;
      }
      setState(() => _entitlement = result);
      _showSnack(successMessage(l10n));
    } catch (e) {
      if (!mounted) return;
      _showSnack(l10n.purchaseFailed(AppErrorText.of(l10n, e)));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final t = context.halo;
    final entitlement = _entitlement;
    final isPro = entitlement?.pro ?? false;

    return PopScope(
      canPop: !_busy, // 결제 진행 중에 화면이 사라지면 결과를 못 받는다.
      child: HaloScaffold(
        appBar: HaloAppBar(title: l10n.proTitle),
        body: ListView(
          padding: EdgeInsets.fromLTRB(
            HaloSpace.screen,
            HaloScaffold.contentTopInset(context),
            HaloSpace.screen,
            HaloScaffold.contentBottomInset(context),
          ),
          children: [
            // ② 이 화면의 유일한 히어로.
            HaloHero(
              title: isPro ? l10n.proActive : l10n.upgradeToPro,
              subtitle: _heroSubtitle(l10n, entitlement, isPro),
              icon: isPro ? Icons.workspace_premium : Icons.auto_awesome,
            ),
            const SizedBox(height: HaloSpace.xl),

            if (widget.limitReached && !isPro) ...[
              _Notice(
                title: l10n.cardLimitReachedTitle(entitlement?.cardLimit ?? 0),
                body: l10n.cardLimitReachedBody,
              ),
              const SizedBox(height: HaloSpace.lg),
            ],

            HaloCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  HaloSectionHeading(l10n.proTitle, icon: Icons.check_circle_outline),
                  const SizedBox(height: HaloSpace.md),
                  Row(
                    children: [
                      Icon(Icons.all_inclusive, size: 20, color: t.point),
                      const SizedBox(width: HaloSpace.sm),
                      Expanded(
                        child: Text(
                          l10n.proBenefitUnlimited,
                          style: HaloType.body.copyWith(color: t.text),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: HaloSpace.xl),

            if (_loading)
              const Center(child: CircularProgressIndicator())
            else if (isPro)
              // 이미 프로다. 다시 사게 만들지 않는다.
              Text(
                _expiryText(l10n, entitlement),
                textAlign: TextAlign.center,
                style: HaloType.label.copyWith(color: t.muted),
              )
            else ...[
              HaloPrimaryButton(
                // 가격은 스토어가 준 문자열을 그대로 쓴다 — 나라마다 통화·금액이 다르다.
                label: _product == null
                    ? l10n.upgradeToPro
                    : '${l10n.upgradeToPro} · ${_product!.price}',
                icon: Icons.auto_awesome,
                loading: _busy,
                onPressed: _product == null || _busy ? null : _buy,
              ),
              if (_productError != null) ...[
                const SizedBox(height: HaloSpace.md),
                Text(
                  AppErrorText.of(l10n, _productError!),
                  textAlign: TextAlign.center,
                  style: HaloType.label.copyWith(color: t.muted2),
                ),
              ],
            ],

            const SizedBox(height: HaloSpace.md),
            // 구매 복원은 iOS 심사 요구사항이다 — 구독 앱에 없으면 리젝된다.
            HaloSecondaryButton(
              label: l10n.restorePurchases,
              icon: Icons.restore,
              onPressed: _busy ? null : _restore,
            ),
          ],
        ),
      ),
    );
  }

  String _heroSubtitle(AppLocalizations l10n, Entitlement? entitlement, bool isPro) {
    if (entitlement == null) return l10n.statusLoading;
    if (isPro) return l10n.proBenefitUnlimited;
    final limit = entitlement.cardLimit;
    if (limit == null) return l10n.proBenefitUnlimited;
    return l10n.cardCountUsage(entitlement.cardCount, limit);
  }

  String _expiryText(AppLocalizations l10n, Entitlement? entitlement) {
    final expiresAt = entitlement?.expiresAt;
    if (expiresAt == null) return l10n.proActive;
    final date = MaterialLocalizations.of(context).formatFullDate(expiresAt);
    return '${l10n.proActive} · $date';
  }
}

/// 한도 초과로 들어왔을 때 이유를 먼저 알리는 알림 블록.
class _Notice extends StatelessWidget {
  const _Notice({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final t = context.halo;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(HaloSpace.lg),
      decoration: BoxDecoration(
        color: t.warnSoft,
        borderRadius: HaloShape.input,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: HaloType.value.copyWith(color: t.warnText, fontSize: 16),
          ),
          const SizedBox(height: HaloSpace.xs),
          Text(body, style: HaloType.label.copyWith(color: t.warnText)),
        ],
      ),
    );
  }
}
