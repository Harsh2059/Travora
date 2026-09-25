import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/trip_provider.dart';
import '../providers/theme_provider.dart';
import '../widgets/travora_card.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Profile', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        elevation: 0,
      ),
      body: Consumer<TripProvider>(
        builder: (context, provider, child) {
          final user = provider.currentUser;
          if (user == null) {
            return Center(child: CircularProgressIndicator(color: Theme.of(context).colorScheme.primary));
          }

          return ListView(
            padding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            children: [
              // HEADER
              Row(
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Center(child: Icon(Icons.person, size: 36, color: Theme.of(context).colorScheme.primary)),
                  ),
                  SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(user.name, style: Theme.of(context).textTheme.displayMedium),
                        SizedBox(height: 4),
                        Text(user.email, style: TextStyle(color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), fontSize: 16)),
                      ],
                    ),
                  ),
                ],
              ),
              SizedBox(height: 40),

              // CONTACT
              Text('CONTACT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), letterSpacing: 1.5)),
              SizedBox(height: 12),
              TravoraCard(
                padding: EdgeInsets.zero,
                child: ListTile(
                  contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                  title: Text('Mobile Number', style: TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(user.whatsappPhone != null && user.whatsappPhone!.isNotEmpty ? _maskPhone(user.whatsappPhone!) : 'Add your number'),
                  trailing: TextButton(
                    onPressed: () => _showEditProfileModal(context),
                    child: Text('Edit', style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold)),
                  ),
                ),
              ),
              SizedBox(height: 24),

              // NOTIFICATIONS
              Text('NOTIFICATIONS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), letterSpacing: 1.5)),
              SizedBox(height: 12),
              TravoraCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    SwitchListTile(
                      contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                      activeThumbColor: Theme.of(context).colorScheme.primary,
                      title: Text('SMS', style: TextStyle(fontWeight: FontWeight.w600)),
                      value: user.smsEnabled,
                      onChanged: (bool value) => provider.updateUserProfile({'sms_enabled': value}),
                    ),
                    const Divider(height: 1),
                    SwitchListTile(
                      contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                      activeThumbColor: Theme.of(context).colorScheme.primary,
                      title: Text('WhatsApp', style: TextStyle(fontWeight: FontWeight.w600)),
                      value: user.whatsappEnabled,
                      onChanged: (bool value) => provider.updateUserProfile({'whatsapp_enabled': value}),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 24),

              Text('TRAVEL PREFERENCES', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), letterSpacing: 1.5)),
              SizedBox(height: 12),
              TravoraCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    ListTile(
                      contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      title: Text('Preferred Recovery', style: TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('Balanced'),
                      trailing: Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey),
                      onTap: () {},
                    ),
                    const Divider(height: 1),
                    Consumer<ThemeProvider>(
                      builder: (context, themeProvider, child) {
                        return SwitchListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                          activeThumbColor: Theme.of(context).colorScheme.primary,
                          title: const Text('Dark Mode', style: TextStyle(fontWeight: FontWeight.w600)),
                          value: themeProvider.themeMode == ThemeMode.dark,
                          onChanged: (bool value) => themeProvider.toggleTheme(value),
                        );
                      }
                    ),
                  ],
                ),
              ),
              SizedBox(height: 24),

              // WALLET
              Text('WALLET', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), letterSpacing: 1.5)),
              SizedBox(height: 12),
              TravoraCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    ListTile(
                      contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                      title: Text('Wallet Balance', style: TextStyle(fontWeight: FontWeight.w600)),
                      subtitle: Text('₹14,500', style: TextStyle(color: Theme.of(context).colorScheme.primary, fontWeight: FontWeight.bold, fontSize: 18)),
                      trailing: TextButton.icon(
                        onPressed: () => _showAddMoneyModal(context),
                        icon: Icon(Icons.add, size: 16),
                        label: Text('Add Money'),
                        style: TextButton.styleFrom(
                          foregroundColor: Theme.of(context).colorScheme.primary,
                          backgroundColor: Theme.of(context).colorScheme.primary.withValues(alpha: 0.1),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 24),

              // ACCOUNT
              Text('ACCOUNT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), letterSpacing: 1.5)),
              SizedBox(height: 12),
              TravoraCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    ListTile(
                      contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                      title: Text('About Travora', style: TextStyle(fontWeight: FontWeight.w600)),
                      trailing: Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey),
                      onTap: () {},
                    ),
                    const Divider(height: 1),
                    ListTile(
                      contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                      title: Text('Terms & Privacy', style: TextStyle(fontWeight: FontWeight.w600)),
                      trailing: Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey),
                      onTap: () => context.push('/privacy'),
                    ),
                    const Divider(height: 1),
                    Consumer<AuthProvider>(
                      builder: (context, auth, _) => ListTile(
                        contentPadding: EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                        title: Text('Log Out', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.red)),
                        trailing: Icon(Icons.logout, size: 16, color: Colors.red),
                        onTap: () {
                          auth.logout();
                        },
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(height: 48),
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
    return '${prefix.replaceAll(RegExp(r'[0-9]'), '•')} $last4';
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
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return Padding(
              padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Update Contact Info', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                  SizedBox(height: 32),
                  Text('Mobile Number', style: TextStyle(fontWeight: FontWeight.bold, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)))),
                  SizedBox(height: 8),
                  Row(
                    children: [
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                        decoration: BoxDecoration(
                          color: Theme.of(context).scaffoldBackgroundColor,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: Text('+91', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                      SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: phoneController,
                          keyboardType: TextInputType.phone,
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                          decoration: InputDecoration(
                            hintText: 'Enter your number',
                            filled: true,
                            fillColor: Theme.of(context).scaffoldBackgroundColor,
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
                            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey.shade300)),
                            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Theme.of(context).colorScheme.primary, width: 2)),
                          ),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 40),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
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
                      child: isSaving ? const CircularProgressIndicator(color: Colors.white) : Text('Save Changes', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  SizedBox(height: 32),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showAddMoneyModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 24, right: 24, top: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Add Money to Wallet', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
              SizedBox(height: 24),
              TextField(
                keyboardType: TextInputType.number,
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                decoration: InputDecoration(
                  prefixText: '₹ ',
                  prefixStyle: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Theme.of(context).textTheme.bodyLarge?.color),
                  hintText: '0',
                  filled: true,
                  fillColor: Theme.of(context).cardTheme.color,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              SizedBox(height: 32),
              Text('PAYMENT METHOD', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B)), letterSpacing: 1.5)),
              SizedBox(height: 12),
              ListTile(
                leading: Icon(Icons.credit_card, color: Theme.of(context).colorScheme.primary),
                title: Text('Credit / Debit Card', style: TextStyle(fontWeight: FontWeight.w600)),
                trailing: Icon(Icons.arrow_forward_ios, size: 16, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B))),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: (Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : Colors.grey.shade200))),
                onTap: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payment gateway simulation (Credit Card)')));
                },
              ),
              SizedBox(height: 12),
              ListTile(
                leading: Icon(Icons.qr_code_scanner, color: Theme.of(context).colorScheme.primary),
                title: Text('UPI / QR Code', style: TextStyle(fontWeight: FontWeight.w600)),
                trailing: Icon(Icons.arrow_forward_ios, size: 16, color: (Theme.of(context).brightness == Brightness.dark ? Colors.grey.shade400 : const Color(0xFF64748B))),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: (Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : Colors.grey.shade200))),
                onTap: () {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Payment gateway simulation (UPI)')));
                },
              ),
              SizedBox(height: 48),
            ],
          ),
        );
      },
    );
  }
}
