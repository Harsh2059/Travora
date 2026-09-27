import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;

import 'core/theme/app_theme.dart';
import 'routing/app_router.dart';
import 'providers/trip_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/auth_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  await Supabase.initialize(
    url: 'https://frsxpvkwzttzcqksgnnp.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyc3hwdmt3enR0emNxa3Nnbm5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNTg0NjIsImV4cCI6MjEwNTgzNDQ2Mn0.uq_0D0oKmb2ZvDAfNkaWwFEpoCtX6K_GIHjg4ofbFEY',
  );
  
  // Create AuthProvider first so it can initialize session
  final authProvider = AuthProvider();
  await authProvider.initSessionForStartup();
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: authProvider),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        // TripProvider will be created lazily when auth is authenticated
        ChangeNotifierProxyProvider<AuthProvider, TripProvider>(
          create: (_) => TripProvider(),
          update: (_, auth, previous) {
            // Only fetch dashboard when auth becomes authenticated
            if (auth.state == AuthState.authenticated) {
              previous?.fetchDashboardData();
            } else if (auth.state == AuthState.unauthenticated) {
              previous?.clearData();
            }
            return previous ?? TripProvider();
          },
        ),
      ],
      child: const TravoraApp(),
    ),
  );
}

class TravoraApp extends StatelessWidget {
  const TravoraApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'Travora',
      themeMode: themeProvider.themeMode,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      routerConfig: createRouter(authProvider),
    );
  }
}


