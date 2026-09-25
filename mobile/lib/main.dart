import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'core/theme/app_theme.dart';
import 'routing/app_router.dart';
import 'providers/trip_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => TripProvider()..fetchDashboardData()),
      ],
      child: const TravoraApp(),
    ),
  );
}

class TravoraApp extends StatelessWidget {
  const TravoraApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Travora',
      theme: AppTheme.lightTheme,
      routerConfig: appRouter,
    );
  }
}


