class GatewayStats {
  final int pending;
  final int claimed;
  final int sending;
  final int sent;
  final int failed;
  final int total;

  GatewayStats({
    this.pending = 0,
    this.claimed = 0,
    this.sending = 0,
    this.sent = 0,
    this.failed = 0,
    this.total = 0,
  });

  factory GatewayStats.fromJson(Map<String, dynamic> json) {
    return GatewayStats(
      pending: json['pending'] as int? ?? 0,
      claimed: json['claimed'] as int? ?? 0,
      sending: json['sending'] as int? ?? 0,
      sent: json['sent'] as int? ?? 0,
      failed: json['failed'] as int? ?? 0,
      total: json['total'] as int? ?? 0,
    );
  }
}
