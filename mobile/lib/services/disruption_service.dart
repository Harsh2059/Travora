import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/disruption.dart';
import '../models/impact_result.dart';

class DisruptionService {
  final ApiClient _apiClient = ApiClient();

  Future<List<Disruption>> getTripDisruptions(int tripId) async {
    final response = await _apiClient.get(ApiEndpoints.tripDisruptions(tripId));
    if (response is List) {
      return response.map((e) => Disruption.fromJson(e)).toList();
    } else if (response is Map<String, dynamic> && response['disruptions'] != null) {
      // Backend might return an object with a list inside
       return (response['disruptions'] as List).map((e) => Disruption.fromJson(e)).toList();
    }
    return [];
  }

  Future<ImpactResult?> getTripImpact(int tripId) async {
    try {
      final response = await _apiClient.get(ApiEndpoints.tripImpact(tripId));
      if (response == null || response.isEmpty) return null;
      return ImpactResult.fromJson(response);
    } catch (e) {
      return null; // Ignore 404 or empty impact
    }
  }

  Future<ImpactResult> analyzeImpact(int tripId) async {
    final response = await _apiClient.post(ApiEndpoints.tripImpact(tripId).replaceAll('/impact', '/impact/analyze'));
    return ImpactResult.fromJson(response);
  }
}
