import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/theme/app_theme.dart';
import 'routing/app_router.dart';
import 'providers/trip_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/auth_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => TripProvider()..fetchDashboardData()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
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


