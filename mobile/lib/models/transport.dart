class Transport {
  final String mode; // FLIGHT, TRAIN, BUS, etc.
  final String operatorName; // Airline, Train operator, etc.
  final String referenceNumber; // Flight number, Train number
  final String pnr;
  final String origin;
  final String destination;
  final DateTime departureTime;
  final DateTime arrivalTime;
  final String? terminalGatePlatform;

  Transport({
    required this.mode,
    required this.operatorName,
    required this.referenceNumber,
    required this.pnr,
    required this.origin,
    required this.destination,
    required this.departureTime,
    required this.arrivalTime,
    this.terminalGatePlatform,
  });

  factory Transport.fromJson(Map<String, dynamic> json) {
    return Transport(
      mode: json['mode'] ?? 'UNKNOWN',
      operatorName: json['operator'] ?? '',
      referenceNumber: json['reference_number'] ?? '',
      pnr: json['pnr'] ?? '',
      origin: json['origin'] ?? '',
      destination: json['destination'] ?? '',
      departureTime: DateTime.parse(json['departure_time']),
      arrivalTime: DateTime.parse(json['arrival_time']),
      terminalGatePlatform: json['platform_gate'],
    );
  }
}
