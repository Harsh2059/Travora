class Disruption {
  final int id;
  final int tripId;
  final String disruptionType;
  final String description;
  final int? affectedItemId;
  final String status;
  final DateTime createdAt;

  Disruption({
    required this.id,
    required this.tripId,
    required this.disruptionType,
    required this.description,
    this.affectedItemId,
    required this.status,
    required this.createdAt,
  });

  factory Disruption.fromJson(Map<String, dynamic> json) {
    final metadata = json['event_metadata'] as Map<String, dynamic>? ?? {};
    return Disruption(
      id: json['id'] ?? 0,
      tripId: json['trip_id'] ?? 0,
      disruptionType: json['event_type'] ?? json['type'] ?? 'UNKNOWN',
      description: metadata['reason'] ?? 'Disruption detected',
      affectedItemId: json['affected_node_id'] ?? json['entity_id'],
      status: json['status'] ?? 'ACTIVE',
      createdAt: json['timestamp'] != null ? DateTime.parse(json['timestamp']) : DateTime.now(),
    );
  }
}
