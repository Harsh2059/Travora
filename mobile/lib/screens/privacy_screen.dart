import 'package:flutter/material.dart';
import '../core/theme/app_theme.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Terms & Privacy')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Privacy Policy', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.primary)),
          const SizedBox(height: 16),
          const Text(
            'At Travora, we prioritize the protection of your personal information. '
            'This Privacy Policy explains what data we collect, how it\'s used, and your rights regarding your data.',
            style: TextStyle(fontSize: 16, height: 1.5),
          ),
          const SizedBox(height: 24),
          const Text('Information We Process', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text(
            '• Name and contact information\n'
            '• Phone/WhatsApp number when WhatsApp communication is used\n'
            '• Trip and itinerary information\n'
            '• Travel disruption and recovery information\n'
            '• Messages sent through the WhatsApp integration\n'
            '• Technical information needed to operate the service',
            style: TextStyle(fontSize: 16, height: 1.5),
          ),
          const SizedBox(height: 24),
          const Text('How We Use Your Information', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text(
            '• Provide travel recovery assistance during disruptions\n'
            '• Communicate disruption and recovery options to you in real time\n'
            '• Process recovery actions and rebookings automatically\n'
            '• Operate, secure, and improve our services and algorithms',
            style: TextStyle(fontSize: 16, height: 1.5),
          ),
          const SizedBox(height: 24),
          const Text('Data Deletion Requests', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          const Text(
            'You have the right to request the deletion of your personal data stored by Travora at any time. '
            'Click the button below to submit a data deletion request to our administrators.',
            style: TextStyle(fontSize: 16, height: 1.5),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Your data deletion request has been submitted to the administration team.'))
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.alertRed),
            child: const Text('Request Data Deletion'),
          ),
          const SizedBox(height: 32),
          const Center(
            child: Text('© 2026 Travora. All rights reserved.', style: TextStyle(color: Colors.grey)),
          )
        ],
      ),
    );
  }
}
