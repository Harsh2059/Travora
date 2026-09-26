import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';
import '../models/trip.dart';

class TripService {
  final ApiClient _apiClient = ApiClient();

  Future<List<Trip>> getUserTrips(String userId) async {
    final response = await _apiClient.get(ApiEndpoints.userTrips(userId));
    if (response is List) {
      return response.map((e) => Trip.fromJson(e)).toList();
    }
    return [];
  }

  Future<Trip> getTripDetails(int tripId) async {
    final response = await _apiClient.get(ApiEndpoints.tripDetails(tripId));
    return Trip.fromJson(response);
  }

  Future<Trip> createTrip(String userId, String title) async {
    final response = await _apiClient.post(
      ApiEndpoints.userTrips(userId),
      body: {'title': title},
    );
    return Trip.fromJson(response);
  }

  Future<void> addTripItem(int tripId, Map<String, dynamic> payload) async {
    await _apiClient.post(
      ApiEndpoints.tripItems(tripId),
      body: payload,
    );
  }
}
