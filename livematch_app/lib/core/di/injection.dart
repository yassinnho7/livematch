import 'package:get_it/get_it.dart';
import '../network/api_client.dart';
import '../../features/home/data/repositories/match_repository_impl.dart';
import '../../services/ads_service.dart';

/// Service locator instance
final GetIt sl = GetIt.instance;

/// Initialize dependency injection
Future<void> initDI() async {
  // Core
  sl.registerLazySingleton<ApiClient>(() => ApiClient());
  
  // Repositories
  sl.registerLazySingleton<MatchRepositoryImpl>(
    () => MatchRepositoryImpl(sl()),
  );
  
  // Services
  sl.registerLazySingleton<AdsService>(() => AdsService());
}
