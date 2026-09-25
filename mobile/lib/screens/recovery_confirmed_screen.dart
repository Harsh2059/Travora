import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../core/theme/app_theme.dart';

class RecoveryConfirmedScreen extends StatelessWidget {
  const RecoveryConfirmedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Recovery Confirmed'),
        automaticallyImplyLeading: false,
      ),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.check_circle, size: 80, color: AppColors.successGreen),
                  const SizedBox(height: 24),
                  const Text('Recovery Confirmed', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24)),
                  const SizedBox(height: 12),
                  const Text('Your journey has been updated. SMS and WhatsApp notifications have been scheduled automatically by the backend.', textAlign: TextAlign.center, style: TextStyle(fontSize: 16)),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () => context.go('/trips'),
                      child: const Text('View Updated Journey'),
                    ),
                  )
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
