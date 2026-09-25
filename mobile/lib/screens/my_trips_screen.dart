import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../core/theme/app_theme.dart';

class MyTripsScreen extends StatelessWidget {
  const MyTripsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('My Trips', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
      ),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          if (provider.state == ProviderState.loading) {
            return const Center(child: CircularProgressIndicator());
          }
          
          final trips = provider.userTrips;
          
          return RefreshIndicator(
            onRefresh: () => provider.fetchDashboardData(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                ElevatedButton.icon(
                  icon: const Icon(Icons.add),
                  label: const Text('Plan New Trip'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  onPressed: () => context.push('/create-trip'),
                ),
                const SizedBox(height: 24),
                if (trips.isEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 64.0),
                    child: Column(
                      children: [
                        const Icon(Icons.luggage, size: 64, color: Colors.grey),
                        const SizedBox(height: 16),
                        const Text('No Saved Trips', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                        const SizedBox(height: 8),
                        const Text('Your planned trips will appear here.', style: TextStyle(color: AppColors.textSecondary)),
                      ],
                    ),
                  )
                else
                  ...trips.map((trip) {
                    final isActive = provider.activeTripId == trip.id;
                    final isDefault = provider.defaultTripId == trip.id;
                    return Card(
                      margin: const EdgeInsets.only(bottom: 16),
                      shape: RoundedRectangleBorder(
                        side: isActive ? const BorderSide(color: AppColors.primary, width: 2) : BorderSide.none,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: InkWell(
                        onTap: () async {
                          await provider.selectTrip(trip.id);
                          if (context.mounted) context.push('/journey');
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      trip.title,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  if (isActive)
                                    const Padding(
                                      padding: EdgeInsets.only(right: 8.0),
                                      child: Chip(
                                        label: Text('Active', style: TextStyle(color: Colors.white, fontSize: 10)),
                                        backgroundColor: AppColors.primary,
                                      ),
                                    ),
                                  IconButton(
                                    icon: Icon(
                                      isDefault ? Icons.star : Icons.star_border,
                                      color: isDefault ? Colors.amber : Colors.grey,
                                    ),
                                    tooltip: isDefault ? 'Default Trip' : 'Set as Default',
                                    onPressed: () {
                                      provider.setDefaultTrip(trip.id);
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('${trip.title} set as default trip')),
                                      );
                                    },
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text('${trip.items.length} items in itinerary', style: const TextStyle(color: AppColors.textSecondary)),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
              ],
            ),
          );
        },
      ),
    );
  }
}
