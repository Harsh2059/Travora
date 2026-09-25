import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../core/theme/app_theme.dart';

class ReviewTripScreen extends StatefulWidget {
  final String title;
  final List<String> locations;
  final DateTime startDate;

  const ReviewTripScreen({
    super.key,
    required this.title,
    required this.locations,
    required this.startDate,
  });

  @override
  State<ReviewTripScreen> createState() => _ReviewTripScreenState();
}

class _ReviewTripScreenState extends State<ReviewTripScreen> {
  bool _isCreating = false;

  Future<void> _createTrip() async {
    setState(() => _isCreating = true);

    // Build items (A -> B, B -> C)
    List<Map<String, dynamic>> items = [];
    DateTime currentTime = widget.startDate;

    for (int i = 0; i < widget.locations.length - 1; i++) {
      final origin = widget.locations[i];
      final destination = widget.locations[i + 1];
      
      final endTime = currentTime.add(const Duration(hours: 2));

      items.add({
        "type": "FLIGHT",
        "provider": "Travora Airlines",
        "origin": origin,
        "destination": destination,
        "start_time": currentTime.toIso8601String(),
        "end_time": endTime.toIso8601String(),
        "cost": 0.0,
        "currency": "INR",
        "priority": "MEDIUM",
        "flexibility": "FLEXIBLE",
        "status": "CONFIRMED",
      });

      // Add 2 hours gap for next flight/stop
      currentTime = endTime.add(const Duration(hours: 2));
    }

    final provider = context.read<TripProvider>();
    final success = await provider.createNewTrip(widget.title, items);

    if (success && mounted) {
      // Go back to root and then push to journey screen
      context.go('/journey');
    } else if (mounted) {
      setState(() => _isCreating = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.errorMessage ?? 'Failed to create trip')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Review Trip'),
      ),
      body: _isCreating
          ? const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Building your journey...', style: TextStyle(fontSize: 16)),
                ],
              ),
            )
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(widget.title, style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                Text('Departure: ${widget.startDate.day}/${widget.startDate.month}/${widget.startDate.year}', style: const TextStyle(color: AppColors.textSecondary)),
                const SizedBox(height: 24),
                const Text('Route Overview', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: List.generate(widget.locations.length, (index) {
                        final loc = widget.locations[index];
                        final isLast = index == widget.locations.length - 1;
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Column(
                              children: [
                                const Icon(Icons.circle, size: 12, color: AppColors.primary),
                                if (!isLast)
                                  Container(
                                    width: 2,
                                    height: 30,
                                    color: AppColors.primary.withValues(alpha: 0.3),
                                  ),
                              ],
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Padding(
                                padding: const EdgeInsets.only(bottom: 24),
                                child: Text(loc, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                              ),
                            ),
                          ],
                        );
                      }),
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.pop(context),
                        child: const Text('Edit'),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 16),
                        ),
                        onPressed: _createTrip,
                        child: const Text('Create Trip', style: TextStyle(fontSize: 16)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
    );
  }
}
