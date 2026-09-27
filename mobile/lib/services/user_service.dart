import '../models/user.dart';
import '../core/network/api_client.dart';
import '../core/network/api_endpoints.dart';

class UserService {
  final ApiClient _apiClient = ApiClient();

  Future<User> getUserProfile(String userId) async {
    final response = await _apiClient.get(ApiEndpoints.userProfile(userId));
    return User.fromJson(response);
  }

  Future<User> updateUserProfile(String userId, Map<String, dynamic> updates) async {
    final response = await _apiClient.patch(
      ApiEndpoints.userProfile(userId),
      body: updates,
    );
    return User.fromJson(response);
  }
}
