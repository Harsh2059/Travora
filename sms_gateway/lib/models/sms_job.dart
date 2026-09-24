class SmsJob {
  final String id;
  final String recipient;
  final String message;
  final String status;
  final int? tripId;
  final String? notificationType;
  final String? idempotencyKey;
  final String? errorMessage;
  final String? gatewayDeviceId;
  final DateTime? claimedAt;
  final DateTime? sentAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  SmsJob({
    required this.id,
    required this.recipient,
    required this.message,
    required this.status,
    this.tripId,
    this.notificationType,
    this.idempotencyKey,
    this.errorMessage,
    this.gatewayDeviceId,
    this.claimedAt,
    this.sentAt,
    this.createdAt,
    this.updatedAt,
  });

  factory SmsJob.fromJson(Map<String, dynamic> json) {
    return SmsJob(
      id: json['id'] as String? ?? '',
      recipient: (json['recipient'] ?? json['recipient_phone'] ?? '') as String,
      message: json['message'] as String? ?? '',
      status: (json['status'] as String? ?? 'PENDING').toUpperCase(),
      tripId: json['trip_id'] as int?,
      notificationType: json['notification_type'] as String?,
      idempotencyKey: json['idempotency_key'] as String?,
      errorMessage: json['error_message'] as String?,
      gatewayDeviceId: json['gateway_device_id'] as String?,
      claimedAt: json['claimed_at'] != null ? DateTime.tryParse(json['claimed_at']) : null,
      sentAt: json['sent_at'] != null ? DateTime.tryParse(json['sent_at']) : null,
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at']) : null,
      updatedAt: json['updated_at'] != null ? DateTime.tryParse(json['updated_at']) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'recipient': recipient,
      'recipient_phone': recipient,
      'message': message,
      'status': status,
      'trip_id': tripId,
      'notification_type': notificationType,
      'idempotency_key': idempotencyKey,
      'error_message': errorMessage,
      'gateway_device_id': gatewayDeviceId,
      'claimed_at': claimedAt?.toIso8601String(),
      'sent_at': sentAt?.toIso8601String(),
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
    };
  }

  @override
  String toString() {
    return 'SmsJob(id: $id, recipient: $recipient, status: $status, trip: $tripId)';
  }
}
