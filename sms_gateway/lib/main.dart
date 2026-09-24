import 'package:flutter/material.dart';

import 'config/app_config.dart';
import 'screens/gateway_screen.dart';
import 'services/gateway_controller.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load configuration from local preferences
  final config = await AppConfig.load();
  final controller = GatewayController(config);
  await controller.init();

  runApp(TravoraSmsGatewayApp(controller: controller));
}

class TravoraSmsGatewayApp extends StatelessWidget {
  final GatewayController controller;

  const TravoraSmsGatewayApp({
    super.key,
    required this.controller,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Travora SMS Gateway',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0F172A),
          brightness: Brightness.light,
        ),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0F172A),
          foregroundColor: Colors.white,
          elevation: 2,
        ),
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0F172A),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF0F172A),
          foregroundColor: Colors.white,
          elevation: 2,
        ),
      ),
      themeMode: ThemeMode.system,
      home: GatewayScreen(controller: controller),
    );
  }
}
