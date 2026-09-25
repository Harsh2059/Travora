import 'package:flutter/material.dart';

class PrivacyScreen extends StatelessWidget {
  const PrivacyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Terms & Privacy')),
      body: ListView(
        padding: EdgeInsets.all(16),
        children: [
          Text('Privacy Policy', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary)),
          SizedBox(height: 16),
          Text(
            'At Travora, we prioritize the protection of your personal information. '
            'This Privacy Policy explains what data we collect, how it\'s used, and your rights regarding your data.',
            style: TextStyle(fontSize: 16, height: 1.5),
          ),
          SizedBox(height: 24),
          Text('Information We Process', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Text(
            '• Name and contact information\n'
            '• Phone/WhatsApp number when WhatsApp communication is used\n'
            '• Trip and itinerary information\n'
            '• Travel disruption and recovery information\n'
            '• Messages sent through the WhatsApp integration\n'
            '• Technical information needed to operate the service',
            style: TextStyle(fontSize: 16, height: 1.5),
          ),
          SizedBox(height: 24),
          Text('How We Use Your Information', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Text(
            '• Provide travel recovery assistance during disruptions\n'
            '• Communicate disruption and recovery options to you in real time\n'
            '• Process recovery actions and rebookings automatically\n'
            '• Operate, secure, and improve our services and algorithms',
            style: TextStyle(fontSize: 16, height: 1.5),
          ),
          SizedBox(height: 24),
          Text('Data Deletion Requests', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          SizedBox(height: 8),
          Text(
            'You have the right to request the deletion of your personal data stored by Travora at any time. '
            'Click the button below to submit a data deletion request to our administrators.',
            style: TextStyle(fontSize: 16, height: 1.5),
          ),
          SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Your data deletion request has been submitted to the administration team.'))
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            child: Text('Request Data Deletion'),
          ),
          SizedBox(height: 32),
          Center(
            child: Text('© 2026 Travora. All rights reserved.', style: TextStyle(color: Colors.grey)),
          )
        ],
      ),
    );
  }
}
