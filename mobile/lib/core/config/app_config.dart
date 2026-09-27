class AppConfig {
  static const String apiBaseUrl = 'https://travora-dqgn.onrender.com';
  
  // Authentication state - set after successful authentication
  // NEVER use the placeholder for authenticated API requests
  static String? currentUserId;
}
