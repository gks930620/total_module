/// "지금 이 사용자가 프로인가, 명함을 몇 장 더 만들 수 있나".
///
/// 백엔드 `GET /api/billing/entitlement` 응답과 1:1이다
/// (계약: `businesscard_qr/설계/인앱결제_설계.md` §3-1).
class Entitlement {
  const Entitlement({
    required this.pro,
    required this.cardCount,
    this.cardLimit,
    this.store,
    this.productId,
    this.expiresAt,
  });

  final bool pro;

  /// 지금 살아 있는(삭제되지 않은) 명함 수.
  final int cardCount;

  /// **null 이면 무제한**(프로). 숫자면 그 수까지만 만들 수 있다.
  final int? cardLimit;

  final String? store;
  final String? productId;
  final DateTime? expiresAt;

  /// 아직 명함을 더 만들 수 있는지. 화면이 등록 버튼을 열지 막을지 정할 때 쓴다.
  bool get canAddCard => cardLimit == null || cardCount < cardLimit!;

  /// 남은 장수. 무제한이면 null.
  int? get remaining {
    final limit = cardLimit;
    if (limit == null) return null;
    final left = limit - cardCount;
    return left < 0 ? 0 : left;
  }

  /// 명함을 등록·삭제한 직후 화면 표시를 맞추기 위한 것.
  /// 자격(pro·만료)은 서버만 정하므로 여기서 바꾸지 않는다 — 개수만 손댄다.
  Entitlement withCardCount(int newCount) {
    return Entitlement(
      pro: pro,
      cardCount: newCount < 0 ? 0 : newCount,
      cardLimit: cardLimit,
      store: store,
      productId: productId,
      expiresAt: expiresAt,
    );
  }

  /// 서버에 물어보기 전 첫 화면에서 쓸 값. **보수적으로 무료 0장**으로 둔다 —
  /// 낙관적으로 잡았다가 등록 버튼을 눌렀는데 막히는 것보다 낫다.
  static const Entitlement unknown = Entitlement(pro: false, cardCount: 0, cardLimit: 0);

  factory Entitlement.fromJson(Map<String, dynamic> json) {
    final expiresAtRaw = json['expires_at']?.toString();
    return Entitlement(
      pro: json['pro'] == true,
      cardCount: int.tryParse(json['card_count']?.toString() ?? '') ?? 0,
      // 키 자체가 없으면(=무제한) null 이다. 0 으로 떨어뜨리면 프로가 등록을 못 하게 된다.
      cardLimit: json.containsKey('card_limit')
          ? int.tryParse(json['card_limit']?.toString() ?? '')
          : null,
      store: json['store']?.toString(),
      productId: json['product_id']?.toString(),
      expiresAt: expiresAtRaw == null ? null : DateTime.tryParse(expiresAtRaw),
    );
  }
}
