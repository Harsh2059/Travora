import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../core/theme/app_theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          TextButton(
            onPressed: () => _showEditProfileModal(context),
            child: const Text('Edit Profile', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          final user = provider.currentUser;
          if (user == null) {
            return const Center(child: CircularProgressIndicator());
          }

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  const CircleAvatar(
                    radius: 40,
                    backgroundColor: AppColors.primary,
                    child: Icon(Icons.person, size: 40, color: Colors.white),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user.name, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                        Text(user.email, style: const TextStyle(color: AppColors.textSecondary)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 32),

              const Text('CONTACT INFO', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              Card(
                child: ListTile(
                  leading: const Icon(Icons.phone, color: AppColors.primary),
                  title: const Text('Mobile Number'),
                  subtitle: Text(user.whatsappPhone != null && user.whatsappPhone!.isNotEmpty ? _maskPhone(user.whatsappPhone!) : 'Add your mobile number to receive travel alerts.'),
                  trailing: user.whatsappPhone == null || user.whatsappPhone!.isEmpty
                      ? TextButton(onPressed: () => _showEditProfileModal(context), child: const Text('Add Number'))
                      : null,
                ),
              ),
              const SizedBox(height: 24),

              const Text('TRAVEL NOTIFICATIONS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              Card(
                child: Column(
                  children: [
                    SwitchListTile(
                      activeThumbColor: AppColors.primary,
                      title: const Text('SMS'),
                      value: user.smsEnabled,
                      onChanged: (bool value) {
                        provider.updateUserProfile({'sms_enabled': value});
                      },
                    ),
                    const Divider(height: 1),
                    SwitchListTile(
                      activeThumbColor: AppColors.primary,
                      title: const Text('WhatsApp'),
                      value: user.whatsappEnabled,
                      onChanged: (bool value) {
                        provider.updateUserProfile({'whatsapp_enabled': value});
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              const Text('ACCOUNT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              Card(
                child: Column(
                  children: [
                    ListTile(
                      leading: const Icon(Icons.info_outline),
                      title: const Text('About Travora'),
                      onTap: () {},
                    ),
                    const Divider(height: 1),
                    ListTile(
                      leading: const Icon(Icons.article_outlined),
                      title: const Text('Terms & Privacy'),
                      onTap: () => context.push('/privacy'),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  String _maskPhone(String phone) {
    if (phone.length < 5) return phone;
    final last4 = phone.substring(phone.length - 4);
    final prefix = phone.substring(0, phone.length - 4);
    return '${prefix.replaceAll(RegExp(r'[0-9]'), '*')} $last4';
  }

  void _showEditProfileModal(BuildContext context) {
    final provider = Provider.of<TripProvider>(context, listen: false);
    final user = provider.currentUser;
    if (user == null) return;

    String currentPhone = user.whatsappPhone ?? '';
    if (currentPhone.startsWith('+91')) {
      currentPhone = currentPhone.substring(3);
    }
    
    final TextEditingController phoneController = TextEditingController(text: currentPhone);
    bool isSaving = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return Padding(
              padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Edit Profile', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 24),
                  
                  const Text('Mobile Number', style: TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                        decoration: BoxDecoration(
                          color: AppColors.background,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: const Text('+91', style: TextStyle(fontSize: 16)),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: phoneController,
                          keyboardType: TextInputType.phone,
                          decoration: InputDecoration(
                            hintText: 'Phone Number',
                            filled: true,
                            fillColor: AppColors.background,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton(
                      onPressed: isSaving ? null : () async {
                        setState(() => isSaving = true);
                        String rawNumber = phoneController.text.replaceAll(' ', '').trim();
                        if (rawNumber.isNotEmpty && !rawNumber.startsWith('+91')) {
                          rawNumber = '+91$rawNumber';
                        }
                        
                        final success = await provider.updateUserProfile({'whatsapp_phone': rawNumber});
                        if (context.mounted) {
                          Navigator.pop(context);
                          if (success) {
                            ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Profile updated successfully!')));
                          }
                        }
                      },
                      child: isSaving ? const CircularProgressIndicator(color: Colors.white) : const Text('Save Changes'),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
