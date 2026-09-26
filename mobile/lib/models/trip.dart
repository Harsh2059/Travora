class Trip {
  final int id;
  final String userId;
  final String title;
  final int version;
  final List<ItineraryItem> items;

  Trip({
    required this.id,
    required this.userId,
    required this.title,
    required this.version,
    required this.items,
  });

  factory Trip.fromJson(Map<String, dynamic> json) {
    var itemsList = json['items'] as List? ?? [];
    return Trip(
      id: json['id'] ?? 0,
      userId: json['user_id']?.toString() ?? '',
      title: json['title'] ?? 'Unknown Trip',
      version: json['version'] ?? 1,
      items: itemsList.map((e) => ItineraryItem.fromJson(e)).toList(),
    );
  }
}

class ItineraryItem {
  final int id;
  final int tripId;
  final String type;
  final String provider;
  final String? origin;
  final String? destination;
  final String? location;
  final DateTime? startTime;
  final DateTime? endTime;
  final double cost;
  final String currency;
  final String status;
  final String? bookingId;
  final Map<String, dynamic> itemMetadata;

  ItineraryItem({
    required this.id,
    required this.tripId,
    required this.type,
    required this.provider,
    this.origin,
    this.destination,
    this.location,
    this.startTime,
    this.endTime,
    required this.cost,
    required this.currency,
    required this.status,
    this.bookingId,
    required this.itemMetadata,
  });

  factory ItineraryItem.fromJson(Map<String, dynamic> json) {
    return ItineraryItem(
      id: json['id'],
      tripId: json['trip_id'],
      type: json['type'],
      provider: json['provider'],
      origin: json['origin'],
      destination: json['destination'],
      location: json['location'],
      startTime: json['start_time'] != null ? DateTime.tryParse(json['start_time']) : null,
      endTime: json['end_time'] != null ? DateTime.tryParse(json['end_time']) : null,
      cost: (json['cost'] ?? 0).toDouble(),
      currency: json['currency'] ?? 'INR',
      status: json['status'] ?? 'CONFIRMED',
      bookingId: json['booking_id'],
      itemMetadata: json['item_metadata'] ?? {},
    );
  }
}
