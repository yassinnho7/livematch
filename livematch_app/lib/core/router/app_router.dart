import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../features/home/domain/entities/match.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/player/presentation/screens/player_screen.dart';

/// App router configuration
class AppRouter {
  static final GlobalKey<NavigatorState> _rootNavigatorKey =
      GlobalKey<NavigatorState>(debugLabel: 'root');
  
  static final GoRouter router = GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/',
    debugLogDiagnostics: true,
    routes: [
      GoRoute(
        path: '/',
        name: 'home',
        builder: (context, state) => const MainScreen(),
      ),
      GoRoute(
        path: '/match/:id',
        name: 'match',
        builder: (context, state) {
          final match = state.extra as Match?;
          final matchId = state.pathParameters['id'] ?? '';
          
          if (match != null) {
            return PlayerScreen(match: match);
          }
          
          // If no match object, show placeholder
          return Scaffold(
            backgroundColor: const Color(0xFF0D0D0D),
            body: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(
                    color: Color(0xFF00E676),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Loading match $matchId...',
                    style: const TextStyle(color: Color(0xFFB3B3B3)),
                  ),
                ],
              ),
            ),
          );
        },
      ),
      GoRoute(
        path: '/player',
        name: 'player',
        builder: (context, state) {
          final match = state.extra as Match?;
          if (match == null) {
            return const Scaffold(
              backgroundColor: Color(0xFF0D0D0D),
              body: Center(
                child: Text(
                  'No match selected',
                  style: TextStyle(color: Color(0xFFB3B3B3)),
                ),
              ),
            );
          }
          return PlayerScreen(match: match);
        },
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      backgroundColor: const Color(0xFF0D0D0D),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.error_outline,
              size: 64,
              color: Color(0xFFFF5252),
            ),
            const SizedBox(height: 16),
            Text(
              'Page not found',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              state.error?.toString() ?? 'Unknown error',
              style: const TextStyle(color: Color(0xFF808080)),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.go('/'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF00E676),
              ),
              child: const Text('Go Home'),
            ),
          ],
        ),
      ),
    ),
  );
}
