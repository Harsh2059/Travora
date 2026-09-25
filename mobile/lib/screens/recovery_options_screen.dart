import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../models/recovery_option.dart';
import '../core/theme/app_theme.dart';

class RecoveryOptionsScreen extends StatelessWidget {
  const RecoveryOptionsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recovery Options')),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          if (provider.state == ProviderState.loading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (provider.state == ProviderState.error) {
            return Center(child: Text(provider.errorMessage ?? 'Error fetching options'));
          }

          final options = provider.recoveryOptions;
          if (options.isEmpty) {
            return const Center(child: Text('No recovery options available.'));
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: options.length,
            itemBuilder: (context, index) {
              final option = options[index];
              return Card(
                margin: const EdgeInsets.only(bottom: 16),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Option ${index + 1}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppColors.primary)),
                          Text('${option.currency} ${option.cost.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      ...option.description.map((desc) => Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.check_circle_outline, size: 20, color: AppColors.secondary),
                            const SizedBox(width: 8),
                            Expanded(child: Text(desc)),
                          ],
                        ),
                      )),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () => _confirmRecovery(context, provider, option),
                          child: const Text('Select Option'),
                        ),
                      )
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _confirmRecovery(BuildContext context, TripProvider provider, RecoveryOption option) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Confirm Recovery'),
        content: Text('Are you sure you want to execute Option with additional cost ${option.currency} ${option.cost.toStringAsFixed(2)}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              final success = await provider.executeRecovery(option.id);
              if (success && context.mounted) {
                context.push('/confirmed');
              } else if (context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(provider.errorMessage ?? 'Execution failed')));
              }
            },
            child: const Text('Confirm'),
          )
        ],
      ),
    );
  }
}
