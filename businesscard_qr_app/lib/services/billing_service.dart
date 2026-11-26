import 'dart:async';
import 'dart:io';

import 'package:in_app_purchase/in_app_purchase.dart';

import '../models/entitlement.dart';
import 'api_client.dart';
import 'app_exception.dart';

/// 인앱결제 — 스토어 구매와 백엔드 검증을 잇는다.
///
/// 계약: `businesscard_qr/설계/인앱결제_설계.md`
///
/// **핵심 원칙:** 스토어가 "샀다"고 해도 그것만 믿고 기능을 열지 않는다.
/// 반드시 백엔드가 스토어 서버에 직접 확인한 결과([Entitlement])를 받아서 연다.
/// 기기에서만 판정하면 위조된 결제로 프로가 뚫린다.
class BillingService {
  /// 양 스토어에 같은 ID로 등록한다. 서버의 `app.billing.pro-product-ids` 와 같아야 한다.
  static const String proProductId = 'pro_monthly';

  final ApiClient _api = ApiClient();
  final InAppPurchase _iap = InAppPurchase.instance;

  StreamSubscription<List<PurchaseDetails>>? _subscription;

  /// 구매 결과를 기다리는 쪽에 넘겨줄 통로.
  ///
  /// 스토어 구매는 "요청"과 "결과"가 분리돼 있다(결과는 스트림으로 온다).
  /// 앱이 꺼져 있는 동안 끝난 결제도 다음 실행에서 이 스트림으로 들어오므로,
  /// 기다리는 사람이 없어도 리스너는 항상 검증을 마쳐야 한다.
  Completer<Entitlement>? _pendingPurchase;

  /// 리스너가 검증을 마칠 때마다 최신 자격을 흘려보낸다. 화면이 구독해 배지를 갱신한다.
  final StreamController<Entitlement> _entitlementController =
      StreamController<Entitlement>.broadcast();

  Stream<Entitlement> get entitlementStream => _entitlementController.stream;

  /// 앱 시작 시 한 번 부른다. 스토어 결과 스트림을 듣기 시작한다.
  void start() {
    _subscription ??= _iap.purchaseStream.listen(
      _onPurchaseUpdated,
      onError: (Object error) {
        _failPending(AppException(AppErrorReason.unknown, cause: error));
      },
    );
  }

  Future<void> dispose() async {
    await _subscription?.cancel();
    _subscription = null;
    await _entitlementController.close();
  }

  // ── 백엔드 ───────────────────────────────────────────────

  /// 지금 자격을 서버에 물어본다. 앱 시작·결제 후·명함 등록 실패 시 호출한다.
  Future<Entitlement> fetchEntitlement() async {
    final data = await _api.getJson('/api/billing/entitlement');
    if (data is! Map<String, dynamic>) {
      throw Exception('Invalid entitlement response format.');
    }
    return Entitlement.fromJson(data);
  }

  // ── 스토어 ───────────────────────────────────────────────

  /// 스토어에서 프로 상품 정보(가격·통화 포함)를 읽는다.
  ///
  /// 가격은 **절대 앱에 하드코딩하지 않는다** — 나라마다 통화·금액이 다르고
  /// 스토어 콘솔에서 언제든 바뀐다. 항상 스토어가 준 [ProductDetails.price] 를 보여준다.
  Future<ProductDetails> loadProProduct() async {
    if (!await _iap.isAvailable()) {
      throw const AppException(AppErrorReason.purchaseUnavailable);
    }

    final response = await _iap.queryProductDetails({proProductId});
    if (response.productDetails.isEmpty) {
      // 콘솔에 상품이 없거나, 심사 전이거나, 이 나라에 출시되지 않았다.
      throw AppException(
        AppErrorReason.productNotFound,
        cause: response.error ?? response.notFoundIDs,
      );
    }
    return response.productDetails.first;
  }

  /// 프로 구독을 구매하고, **백엔드 검증까지 끝난 뒤** 자격을 돌려준다.
  ///
  /// 사용자가 스토어 창을 닫으면 null 을 돌려준다(오류가 아니라 취소다 — 에러를 띄우지 않는다).
  Future<Entitlement?> purchasePro(ProductDetails product) {
    return _awaitPurchase(
      () => _iap.buyNonConsumable(purchaseParam: PurchaseParam(productDetails: product)),
    );
  }

  /// 기기를 바꿨거나 앱을 지웠다 깐 사용자를 위한 "구매 복원".
  ///
  /// iOS 는 **심사 요구사항**이다 — 구독 앱에 복원 수단이 없으면 리젝된다.
  Future<Entitlement?> restorePurchases() {
    return _awaitPurchase(() => _iap.restorePurchases());
  }

  /// 스토어 동작을 걸고 스트림으로 결과가 올 때까지 기다린다.
  Future<Entitlement?> _awaitPurchase(Future<void> Function() action) async {
    if (!await _iap.isAvailable()) {
      throw const AppException(AppErrorReason.purchaseUnavailable);
    }

    final completer = Completer<Entitlement>();
    _pendingPurchase = completer;

    try {
      await action();
    } catch (e) {
      _pendingPurchase = null;
      throw AppException(AppErrorReason.unknown, cause: e);
    }

    try {
      // 스토어 창이 열린 채 사용자가 한참 머물 수 있으므로 넉넉히 기다린다.
      // 그래도 안 오면 영원히 매달리지 않게 끊는다(다음 실행에서 스트림으로 복구된다).
      return await completer.future.timeout(const Duration(minutes: 5));
    } on _PurchaseCanceled {
      return null;
    } on TimeoutException {
      throw const AppException(AppErrorReason.timeout);
    } finally {
      _pendingPurchase = null;
    }
  }

  // ── 스토어 결과 처리 ──────────────────────────────────────

  Future<void> _onPurchaseUpdated(List<PurchaseDetails> purchases) async {
    for (final purchase in purchases) {
      switch (purchase.status) {
        case PurchaseStatus.purchased:
        case PurchaseStatus.restored:
          await _verifyAndComplete(purchase);

        case PurchaseStatus.pending:
          // 계좌이체 등 승인 대기. 아직 권한을 주지 않는다.
          _failPending(const AppException(AppErrorReason.purchasePending));

        case PurchaseStatus.canceled:
          _cancelPending();

        case PurchaseStatus.error:
          // 스토어 창을 닫은 것도 여기로 오는 기기가 있어 취소와 구분해 다룬다.
          _failPending(AppException(AppErrorReason.unknown, cause: purchase.error));
          await _finishIfNeeded(purchase);
      }
    }
  }

  Future<void> _verifyAndComplete(PurchaseDetails purchase) async {
    try {
      final entitlement = await _verifyOnBackend(purchase);

      // ⚠️ 검증에 성공한 뒤에 완료 처리한다. 이걸 빠뜨리면 Google 이 3일 뒤 자동 환불하고,
      //    Apple 은 앱을 켤 때마다 같은 거래를 계속 다시 던진다.
      await _finishIfNeeded(purchase);

      _entitlementController.add(entitlement);
      _completePending(entitlement);
    } on AppException catch (e) {
      // 검증 실패 시 완료 처리하지 않는다 — 완료해 버리면 영수증이 사라져
      // 돈은 냈는데 권한은 없는 상태를 되돌릴 방법이 없어진다.
      // 미완료로 두면 다음 실행에서 스트림이 다시 던져 재검증된다.
      _failPending(e);
    } catch (e) {
      _failPending(AppException(AppErrorReason.unknown, cause: e));
    }
  }

  /// 스토어 영수증을 백엔드에 보내 검증받는다.
  Future<Entitlement> _verifyOnBackend(PurchaseDetails purchase) async {
    final data = await _api.postJson('/api/billing/purchases/verify', {
      'store': Platform.isIOS ? 'APP_STORE' : 'GOOGLE_PLAY',
      'productId': purchase.productID,
      'purchaseToken': _receiptTokenOf(purchase),
    });
    if (data is! Map<String, dynamic>) {
      throw Exception('Invalid verify response format.');
    }
    return Entitlement.fromJson(data);
  }

  /// 서버가 스토어에 되물을 때 쓸 식별자.
  ///
  /// - Android: `serverVerificationData` 가 곧 Google 의 purchaseToken 이다.
  /// - iOS: 거래 식별자([PurchaseDetails.purchaseID])를 보낸다. App Store Server API 의
  ///   구독 조회는 그 구독에 속한 **어떤 거래 ID로도** 조회되므로 이걸로 충분하다
  ///   (영수증 전체를 보낼 필요가 없다).
  String _receiptTokenOf(PurchaseDetails purchase) {
    if (Platform.isIOS) {
      final transactionId = purchase.purchaseID;
      if (transactionId != null && transactionId.isNotEmpty) {
        return transactionId;
      }
    }
    return purchase.verificationData.serverVerificationData;
  }

  Future<void> _finishIfNeeded(PurchaseDetails purchase) async {
    if (purchase.pendingCompletePurchase) {
      await _iap.completePurchase(purchase);
    }
  }

  // ── 대기 중인 요청 깨우기 ──────────────────────────────────

  void _completePending(Entitlement entitlement) {
    final pending = _pendingPurchase;
    _pendingPurchase = null;
    if (pending != null && !pending.isCompleted) {
      pending.complete(entitlement);
    }
  }

  void _failPending(Object error) {
    final pending = _pendingPurchase;
    _pendingPurchase = null;
    if (pending != null && !pending.isCompleted) {
      pending.completeError(error);
    }
  }

  void _cancelPending() {
    final pending = _pendingPurchase;
    _pendingPurchase = null;
    if (pending != null && !pending.isCompleted) {
      pending.completeError(const _PurchaseCanceled());
    }
  }
}

/// 사용자가 스토어 창을 닫은 경우. 오류가 아니라서 [AppException] 을 쓰지 않는다 —
/// 화면에 빨간 스낵바를 띄우면 안 되기 때문이다.
class _PurchaseCanceled implements Exception {
  const _PurchaseCanceled();
}
