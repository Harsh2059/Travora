import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../screens/home_screen.dart';
import '../screens/my_trips_screen.dart';
import '../screens/journey_screen.dart';
import '../screens/disruption_screen.dart';
import '../screens/impact_screen.dart';
import '../screens/recovery_options_screen.dart';
import '../screens/recovery_confirmed_screen.dart';
import '../screens/notifications_screen.dart';
import '../screens/create_trip_screen.dart';
import '../screens/add_item_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/privacy_screen.dart';
import '../screens/main_shell.dart';

import '../screens/auth/splash_screen.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../providers/auth_provider.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<NavigatorState> _shellNavigatorKey = GlobalKey<NavigatorState>();

GoRouter createRouter(AuthProvider authProvider) {
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: '/splash',
    refreshListenable: authProvider,
    redirect: (context, state) {
      final authState = authProvider.state;
      final isGoingToAuth = state.matchedLocation == '/login' || state.matchedLocation == '/splash';
      
      if (authState == AuthState.checkingSession && state.matchedLocation != '/splash') {
        return '/splash';
      }
      
      if (authState == AuthState.unauthenticated && !isGoingToAuth) {
        return '/login';
      }
      
      if (authState == AuthState.authenticated && isGoingToAuth) {
        return '/';
      }
      
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
    ShellRoute(
      navigatorKey: _shellNavigatorKey,
      builder: (context, state, child) {
        return MainShell(child: child);
      },
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const HomeScreen(),
        ),
        GoRoute(
          path: '/trips',
          builder: (context, state) => const MyTripsScreen(),
        ),
        GoRoute(
          path: '/alerts',
          builder: (context, state) => const NotificationsScreen(),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileScreen(),
        ),
      ],
    ),
    GoRoute(
      path: '/create-trip',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const CreateTripScreen(),
    ),
    GoRoute(
      path: '/journey',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const JourneyScreen(),
    ),
    GoRoute(
      path: '/add-item',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const AddItemScreen(),
    ),
    GoRoute(
      path: '/disruption',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const DisruptionScreen(),
    ),
    GoRoute(
      path: '/impact',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const ImpactScreen(),
    ),
    GoRoute(
      path: '/recovery',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const RecoveryOptionsScreen(),
    ),
    GoRoute(
      path: '/confirmed',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const RecoveryConfirmedScreen(),
    ),
    GoRoute(
      path: '/privacy',
      parentNavigatorKey: _rootNavigatorKey,
      builder: (context, state) => const PrivacyScreen(),
    ),
  ],
);
}
