class AppConfig {
  static const String productionApiUrl = 'https://travora-dqgn.onrender.com';
  // Fallback to local during dev if needed, but use production for now
  static String baseUrl = productionApiUrl;
}
