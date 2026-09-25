import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../core/theme/app_theme.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Travora', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0),
            child: ActionChip(
              avatar: const Icon(Icons.account_balance_wallet, color: AppColors.primary, size: 18),
              label: const Text('₹12,500', style: TextStyle(fontWeight: FontWeight.bold)),
              backgroundColor: AppColors.primary.withValues(alpha: 0.1),
              side: BorderSide.none,
              onPressed: () => context.go('/profile'),
            ),
          ),
        ],
      ),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          if (provider.state == ProviderState.loading) {
            return const Center(child: CircularProgressIndicator());
          }
          if (provider.state == ProviderState.error) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text('Unable to connect to Travora'),
                  ElevatedButton(
                    onPressed: () => provider.fetchDashboardData(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }
          
          final trip = provider.activeTrip;
          if (trip == null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.flight_takeoff, size: 64, color: Colors.grey),
                  const SizedBox(height: 16),
                  const Text('No Upcoming Journeys', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                  const SizedBox(height: 8),
                  const Text('Time to plan your next adventure!', style: TextStyle(color: AppColors.textSecondary)),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: () => context.push('/create-trip'),
                    icon: const Icon(Icons.add),
                    label: const Text('Plan New Trip'),
                  ),
                ],
              ),
            );
          }
          
          final disruptions = provider.activeDisruptions;

          return RefreshIndicator(
            onRefresh: () => provider.fetchDashboardData(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text('Good morning, Traveler', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 24),
                const Text('YOUR NEXT JOURNEY', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textSecondary)),
                const SizedBox(height: 12),
                
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(trip.title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: disruptions.isNotEmpty ? AppColors.alertBackground : const Color(0xFFECFDF5),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                disruptions.isNotEmpty ? 'Disrupted' : 'On Track',
                                style: TextStyle(
                                  color: disruptions.isNotEmpty ? AppColors.alertRed : AppColors.successGreen,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        if (disruptions.isNotEmpty) ...[
                          GestureDetector(
                            onTap: () => context.push('/disruption'),
                            child: Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: AppColors.alertBackground,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.alertRed.withValues(alpha: 0.3)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.warning_amber_rounded, color: AppColors.alertRed),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'Action Required: ${disruptions.length} disruption(s) detected.',
                                      style: const TextStyle(color: AppColors.alertRed, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () => context.push('/journey'),
                            child: const Text('View Journey'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: () => context.push('/create-trip'),
                  icon: const Icon(Icons.add),
                  label: const Text('Plan New Trip'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
