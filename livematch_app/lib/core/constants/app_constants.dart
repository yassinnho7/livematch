/// App-wide constants
class AppConstants {
  // API Configuration
  static const String apiBaseUrl = 'https://livematch.pages.dev';
  static const String workerUrl = 'https://livematch-worker.your-subdomain.workers.dev';
  
  // Cache durations
  static const Duration cacheDuration = Duration(minutes: 5);
  static const Duration streamCacheDuration = Duration(minutes: 4);
  
  // Pagination
  static const int defaultPageSize = 20;
  
  // Timeouts
  static const Duration connectionTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 30);
  
  // App Info
  static const String appName = 'LiveMatch';
  static const String appVersion = '1.0.0';
  
  // AdMob IDs (replace with actual IDs)
  static const String admobAppId = 'ca-app-pub-xxxxxxxxxxxxxxxx~yyyyyyyyyy';
  static const String admobInterstitialId = 'ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz';
  static const String admobRewardedId = 'ca-app-pub-xxxxxxxxxxxxxxxx/wwwwwwwwww';
  static const String admobBannerId = 'ca-app-pub-xxxxxxxxxxxxxxxx/vvvvvvvvvv';
  
  // Start.io App ID
  static const String startIoAppId = 'your_start_io_app_id';
  
  // Unity Ads
  static const String unityGameId = 'your_unity_game_id';
  static const bool unityTestMode = true;
}
