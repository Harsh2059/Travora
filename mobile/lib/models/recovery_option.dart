class RecoveryOption {
  final String id;
  final int tripId;
  final String optionType;
  final double cost;
  final String currency;
  final List<String> description;
  final Map<String, dynamic> metadata;

  RecoveryOption({
    required this.id,
    required this.tripId,
    required this.optionType,
    required this.cost,
    required this.currency,
    required this.description,
    required this.metadata,
  });

  factory RecoveryOption.fromJson(Map<String, dynamic> json) {
    List<String> descList = [];
    if (json['explanation'] != null) {
      descList.add(json['explanation'].toString());
    }
    
    return RecoveryOption(
      id: json['plan_id']?.toString() ?? '',
      tripId: json['trip_id'] ?? 0,
      optionType: json['title'] ?? 'DEFAULT',
      cost: (json['estimated_additional_cost'] ?? 0).toDouble(),
      currency: json['cost_estimate']?['currency'] ?? 'INR',
      description: descList,
      metadata: json,
    );
  }
}

class RecoveryExecution {
  final String id;
  final String status;
  final String? errorMessage;
  final DateTime executedAt;

  RecoveryExecution({
    required this.id,
    required this.status,
    this.errorMessage,
    required this.executedAt,
  });

  factory RecoveryExecution.fromJson(Map<String, dynamic> json) {
    return RecoveryExecution(
      id: json['id']?.toString() ?? '',
      status: json['status'] ?? 'PENDING',
      errorMessage: json['error_message'],
      executedAt: json['executed_at'] != null ? DateTime.parse(json['executed_at']) : DateTime.now(),
    );
  }
}
