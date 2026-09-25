import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../providers/trip_provider.dart';
import '../models/trip.dart';
import '../widgets/travora_card.dart';
import '../widgets/status_badge.dart';

class MyTripsScreen extends StatelessWidget {
  const MyTripsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('My Trips', style: Theme.of(context).textTheme.headlineLarge),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
        centerTitle: false,
      ),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          if (provider.state == ProviderState.loading) {
            return Center(child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary));
          }
          if (provider.state == ProviderState.error) {
            return _buildErrorState(context, provider);
          }
          
          final trips = provider.userTrips;
          
          return RefreshIndicator(
            color: Theme.of(context).colorScheme.primary,
            onRefresh: () => provider.fetchDashboardData(),
            child: ListView(
              padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              children: [
                if (trips.isEmpty)
                  _buildEmptyState(context)
                else
                  ...trips.map((trip) => _buildTripCard(context, provider, trip)),
                  
                SizedBox(height: 32),
                ElevatedButton.icon(
                  onPressed: () => context.push('/create-trip'),
                  icon: Icon(Icons.add),
                  label: Text('Plan New Trip'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: (Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF1E293B)),
                    side: BorderSide(color: Colors.grey.shade300),
                  ),
                ),
                SizedBox(height: 40),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildTripCard(BuildContext context, TripProvider provider, Trip trip) {
    final isActive = provider.activeTripId == trip.id;
    
    String dates = '';
    String mainDestination = trip.title; 
    String route = '';

    if (trip.items.isNotEmpty) {
      final items = List.from(trip.items)..sort((a, b) => (a.startTime ?? DateTime.now()).compareTo(b.startTime ?? DateTime.now()));
      final first = items.first;
      final last = items.last;
      
      if (first.startTime != null) {
        dates = DateFormat('dd MMM').format(first.startTime!);
        if (last.endTime != null || last.startTime != null) {
          final endDt = last.endTime ?? last.startTime;
          if (endDt != null) dates += ' — ${DateFormat('dd MMM').format(endDt)}';
        }
      }
      
      if (first.origin != null && last.destination != null) {
        route = '${first.origin} → ${last.destination}';
        mainDestination = last.destination!.toUpperCase();
      }
    }

    return TravoraCard(
      padding: EdgeInsets.zero,
      onTap: () async {
        await provider.selectTrip(trip.id);
        if (context.mounted) context.push('/journey');
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(child: Text(mainDestination, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), letterSpacing: 1.2))),
                    if (isActive) StatusBadge(status: 'ACTIVE'),
                  ],
                ),
                SizedBox(height: 12),
                Text(route.isNotEmpty ? route : trip.title, style: Theme.of(context).textTheme.displayMedium),
                SizedBox(height: 8),
                Text(dates, style: Theme.of(context).textTheme.bodyLarge),
                SizedBox(height: 16),
                Text('${trip.items.length} itinerary item${trip.items.length != 1 ? 's' : ''}', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)))),
              ],
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('View trip details', style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold)),
                Icon(Icons.arrow_forward_ios, size: 16, color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.5)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(top: 80.0, bottom: 40.0),
      child: Column(
        children: [
          Container(
            padding: EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.luggage, size: 64, color: Theme.of(context).colorScheme.primary),
          ),
          SizedBox(height: 32),
          Text('No journeys yet', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: (Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF1E293B)))),
          SizedBox(height: 12),
          Text('Plan your first journey with Travora.', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 16)),
        ],
      ),
    );
  }

  Widget _buildErrorState(BuildContext context, TripProvider provider) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.error_outline, size: 64, color: Colors.grey),
            SizedBox(height: 24),
            Text('Something went wrong', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            SizedBox(height: 12),
            Text('We couldn\'t load your trips right now.', textAlign: TextAlign.center, style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 16)),
            SizedBox(height: 32),
            ElevatedButton(
              onPressed: () => provider.fetchDashboardData(),
              child: Text('Try Again'),
            ),
          ],
        ),
      ),
    );
  }
}
