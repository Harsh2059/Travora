import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  Future<void> _login() async {
    if (_emailController.text.isEmpty || _passwordController.text.isEmpty) return;
    
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.login(_emailController.text, _passwordController.text);
    if (success && mounted) {
      context.go('/');
    }
  }

  Future<void> _providerLogin(String provider) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final success = await auth.loginWithProvider(provider);
    if (success && mounted) {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.flight_takeoff, size: 64, color: Theme.of(context).colorScheme.primary),
                SizedBox(height: 24),
                Text('Welcome to Travora', style: Theme.of(context).textTheme.displayMedium),
                SizedBox(height: 8),
                Text('Your journey, recovered.', style: Theme.of(context).textTheme.bodyMedium),
                SizedBox(height: 48),

                if (auth.errorMessage != null)
                  Container(
                    margin: EdgeInsets.only(bottom: 24),
                    padding: EdgeInsets.all(12),
                    decoration: BoxDecoration(color: Colors.red.shade50, borderRadius: BorderRadius.circular(8), border: Border.all(color: Colors.red.shade200)),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline, color: Colors.red),
                        SizedBox(width: 12),
                        Expanded(child: Text(auth.errorMessage!, style: TextStyle(color: Colors.red.shade900))),
                      ],
                    ),
                  ),

                // Social Logins
                _buildSocialButton(Icons.g_mobiledata, 'Continue with Google', () => _providerLogin('Google')),
                SizedBox(height: 16),
                _buildSocialButton(Icons.facebook, 'Continue with Facebook', () => _providerLogin('Facebook')),
                SizedBox(height: 16),
                _buildSocialButton(Icons.phone, 'Continue with Phone', () => _providerLogin('Phone OTP')),
                
                SizedBox(height: 32),
                Row(
                  children: [
                    Expanded(child: Divider()),
                    Padding(padding: EdgeInsets.symmetric(horizontal: 16), child: Text('OR', style: TextStyle(color: Colors.grey))),
                    Expanded(child: Divider()),
                  ],
                ),
                SizedBox(height: 32),

                // Email Login
                TextField(
                  controller: _emailController,
                  decoration: InputDecoration(
                    labelText: 'Email Address',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                ),
                SizedBox(height: 16),
                TextField(
                  controller: _passwordController,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                ),
                SizedBox(height: 24),
                
                SizedBox(
                  width: double.infinity,
                  height: 56,
                  child: ElevatedButton(
                    onPressed: auth.state == AuthState.authenticating ? null : _login,
                    child: auth.state == AuthState.authenticating
                        ? CircularProgressIndicator(color: Colors.white)
                        : Text('Sign In', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSocialButton(IconData icon, String label, VoidCallback onTap) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 24),
        label: Text(label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
        style: OutlinedButton.styleFrom(
          foregroundColor: Theme.of(context).textTheme.bodyLarge?.color,
          side: BorderSide(color: Colors.grey.shade300),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }
}
