class ImpactResult {
  final int tripId;
  final int disruptionId;
  final List<AffectedItem> affectedItems;
  final double estimatedCost;
  final bool recoveryNeeded;

  ImpactResult({
    required this.tripId,
    required this.disruptionId,
    required this.affectedItems,
    required this.estimatedCost,
    required this.recoveryNeeded,
  });

  factory ImpactResult.fromJson(Map<String, dynamic> json) {
    var nodes = json['nodes'] as List? ?? [];
    int disruptionId = 0;
    if (json['disruption_ids'] is List && (json['disruption_ids'] as List).isNotEmpty) {
      disruptionId = (json['disruption_ids'] as List).first;
    }
    
    return ImpactResult(
      tripId: json['trip_id'] ?? 0,
      disruptionId: disruptionId,
      affectedItems: nodes.map((e) => AffectedItem.fromJson(e)).toList(),
      estimatedCost: 0.0,
      recoveryNeeded: json['journey_status'] == 'DISRUPTED',
    );
  }
}

class AffectedItem {
  final int itemId;
  final String impactType;
  final String description;

  AffectedItem({
    required this.itemId,
    required this.impactType,
    required this.description,
  });

  factory AffectedItem.fromJson(Map<String, dynamic> json) {
    return AffectedItem(
      itemId: int.tryParse(json['node_id']?.toString() ?? '0') ?? 0,
      impactType: json['status'] ?? 'UNKNOWN',
      description: json['reason'] ?? '',
    );
  }
}
