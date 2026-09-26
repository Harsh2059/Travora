import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../providers/trip_provider.dart';
import '../models/trip.dart';
import '../widgets/travora_card.dart';
import '../widgets/transport_icon.dart';
import '../widgets/status_badge.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          if (provider.state == ProviderState.loading) {
            return Center(child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary));
          }
          if (provider.state == ProviderState.error) {
            return _buildErrorState(context, provider);
          }
          
          final trip = provider.activeTrip;
          if (trip == null) {
            return _buildEmptyState(context);
          }
          
          final disruptions = provider.activeDisruptions;

          return RefreshIndicator(
            color: Theme.of(context).colorScheme.primary,
            onRefresh: () => provider.fetchDashboardData(),
            child: CustomScrollView(
              slivers: [
                SliverAppBar(
                  expandedHeight: 120.0,
                  floating: false,
                  pinned: true,
                  backgroundColor: Theme.of(context).scaffoldBackgroundColor,
                  flexibleSpace: FlexibleSpaceBar(
                    titlePadding: EdgeInsets.only(left: 24, bottom: 16),
                    title: Builder(
                      builder: (context) {
                        final hour = DateTime.now().hour;
                        String greeting = 'Good morning';
                        if (hour >= 12 && hour < 17) {
                          greeting = 'Good afternoon';
                        } else if (hour >= 17) {
                          greeting = 'Good evening';
                        }
                        return Text(
                          '$greeting, ${provider.currentUser?.name.split(' ').first ?? 'Traveler'}',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.bold, fontSize: 20),
                        );
                      }
                    ),
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (disruptions.isNotEmpty) _buildDisruptionAlert(context, disruptions.length),
                        if (disruptions.isEmpty) SizedBox(height: 8),
                        
                        Text('UPCOMING JOURNEY', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                        SizedBox(height: 12),
                        _buildHeroCard(context, trip),
                        
                        SizedBox(height: 32),
                        Text('NEXT UP', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.bold, letterSpacing: 1.2)),
                        SizedBox(height: 12),
                        _buildNextItemCard(context, trip),
                        
                        SizedBox(height: 32),
                        _buildQuickActions(context),
                        SizedBox(height: 48),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildDisruptionAlert(BuildContext context, int count) {
    return Padding(
      padding: EdgeInsets.only(bottom: 24),
      child: GestureDetector(
        onTap: () => context.push('/disruption'),
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: const Color(0xFFD32F2F), // Solid red
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFD32F2F).withValues(alpha: 0.3),
                blurRadius: 8,
                offset: const Offset(0, 4),
              )
            ]
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: EdgeInsets.fromLTRB(16, 16, 16, 12),
                child: Row(
                  children: [
                    Icon(Icons.warning_rounded, color: Colors.white, size: 20),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text('CRITICAL TRIP DISRUPTION DETECTED', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12, letterSpacing: 0.5)),
                    ),
                    Icon(Icons.arrow_forward, color: Colors.white70, size: 16),
                  ],
                ),
              ),
              Container(
                width: double.infinity,
                padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.only(bottomLeft: Radius.circular(12), bottomRight: Radius.circular(12)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFB71C1C),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text('RIPPLE IMPACT', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                    ),
                    SizedBox(width: 12),
                    Expanded(
                      child: Text('$count travel disruption${count > 1 ? 's' : ''} detected. Tap to resolve.', style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w500)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeroCard(BuildContext context, Trip trip) {
    String dates = '';
    if (trip.items.isNotEmpty) {
      final first = trip.items.first.startTime;
      final last = trip.items.last.endTime ?? trip.items.last.startTime;
      if (first != null) {
        dates = DateFormat('dd MMM').format(first);
        if (last != null) {
          dates += ' — ${DateFormat('dd MMM').format(last)}';
        }
      }
    }

    int flightCount = trip.items.where((i) => i.type == 'FLIGHT').length;
    int trainCount = trip.items.where((i) => i.type == 'TRAIN').length;
    int hotelCount = trip.items.where((i) => i.type == 'HOTEL').length;

    return TravoraCard(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          Padding(
            padding: EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(child: Text(trip.title, style: Theme.of(context).textTheme.displayMedium)),
                    StatusBadge(status: 'CONFIRMED'),
                  ],
                ),
                SizedBox(height: 8),
                Text(dates, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)))),
                SizedBox(height: 24),
                Row(
                  children: [
                    if (flightCount > 0) _buildModeBadge(context, Icons.flight, '$flightCount Flight${flightCount > 1 ? 's' : ''}'),
                    if (trainCount > 0) _buildModeBadge(context, Icons.train, '$trainCount Train${trainCount > 1 ? 's' : ''}'),
                    if (hotelCount > 0) _buildModeBadge(context, Icons.hotel, '$hotelCount Stay${hotelCount > 1 ? 's' : ''}'),
                  ],
                ),
              ],
            ),
          ),
          InkWell(
            onTap: () => context.push('/journey'),
            child: Container(
              width: double.infinity,
              padding: EdgeInsets.symmetric(vertical: 16),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.05),
                borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(16), bottomRight: Radius.circular(16)),
              ),
              child: Center(
                child: Text('View Journey Details →', style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold)),
              ),
            ),
          )
        ],
      ),
    );
  }
  
  Widget _buildModeBadge(BuildContext context, IconData icon, String label) {
    return Padding(
      padding: EdgeInsets.only(right: 16),
      child: Row(
        children: [
          Icon(icon, size: 18, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B))),
          SizedBox(width: 6),
          Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)))),
        ],
      ),
    );
  }

  Widget _buildNextItemCard(BuildContext context, Trip trip) {
    if (trip.items.isEmpty) return SizedBox.shrink();
    
    // Sort and find first item in future, or just first item
    final items = List.from(trip.items)..sort((a, b) => (a.startTime ?? DateTime.now()).compareTo(b.startTime ?? DateTime.now()));
    final nextItem = items.first; // Simplified for now
    
    final timeStr = nextItem.startTime != null ? DateFormat('hh:mm a').format(nextItem.startTime!) : '--:--';
    
    return TravoraCard(
      padding: EdgeInsets.all(20),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: TransportIcon(type: nextItem.type, color: Theme.of(context).colorScheme.primary, size: 28),
          ),
          SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(timeStr, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                SizedBox(height: 4),
                if (nextItem.origin != null && nextItem.destination != null)
                  Text('${nextItem.origin} → ${nextItem.destination}', style: Theme.of(context).textTheme.bodyMedium)
                else if (nextItem.location != null)
                  Text(nextItem.location!, style: Theme.of(context).textTheme.bodyMedium),
                SizedBox(height: 2),
                Text('${nextItem.provider} ${nextItem.bookingId ?? ''}', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 13)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _buildActionBtn(context, Icons.luggage, 'My Trips', '/trips')),
        SizedBox(width: 12),
        Expanded(child: _buildActionBtn(context, Icons.notifications_none, 'Alerts', '/alerts')),
        SizedBox(width: 12),
        Expanded(child: _buildActionBtn(context, Icons.add, 'New Trip', '/create-trip')),
      ],
    );
  }
  
  Widget _buildActionBtn(BuildContext context, IconData icon, String label, String route) {
    return InkWell(
      onTap: () => context.push(route),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: EdgeInsets.symmetric(vertical: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(
          children: [
            Icon(icon, color: Theme.of(context).colorScheme.primary),
            SizedBox(height: 8),
            Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.flight_takeoff, size: 64, color: Theme.of(context).colorScheme.primary),
          ),
          SizedBox(height: 32),
          Text('No journeys yet', style: Theme.of(context).textTheme.headlineLarge),
          SizedBox(height: 12),
          Text('Start planning your next adventure.', style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 16)),
          SizedBox(height: 32),
          ElevatedButton(
            onPressed: () => context.push('/create-trip'),
            child: Text('Create Journey'),
          ),
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
            Icon(Icons.cloud_off, size: 64, color: Colors.grey),
            SizedBox(height: 24),
            Text('Something went wrong', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            SizedBox(height: 12),
            Text(provider.errorMessage ?? 'We couldn\'t load your journey right now.', textAlign: TextAlign.center, style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 16)),
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
