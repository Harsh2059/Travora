import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthService {
  final _supabase = Supabase.instance.client;
  final _storage = const FlutterSecureStorage();
  
  static const String _userIdKey = 'user_id';

  Future<String?> getToken() async {
    return _supabase.auth.currentSession?.accessToken;
  }

  Future<void> clearSession() async {
    await _supabase.auth.signOut();
    await _storage.delete(key: _userIdKey);
  }

  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await _supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );

      if (response.user != null) {
        final userId = response.user!.id;
        await _storage.write(key: _userIdKey, value: userId);
        return {'success': true, 'userId': userId};
      } else {
        return {'success': false, 'message': 'Invalid credentials. Please try again.'};
      }
    } on AuthException catch (e) {
      return {'success': false, 'message': e.message};
    } catch (e) {
      return {'success': false, 'message': 'An unexpected error occurred.'};
    }
  }

  Future<Map<String, dynamic>> loginProvider(String providerName) async {
    try {
      OAuthProvider provider;
      switch (providerName.toLowerCase()) {
        case 'google':
          provider = OAuthProvider.google;
          break;
        case 'facebook':
          provider = OAuthProvider.facebook;
          break;
        default:
          return {'success': false, 'message': 'Unsupported provider'};
      }

      await _supabase.auth.signInWithOAuth(provider);
      // OAuth usually redirects, so the actual success handling might depend on deeplinks.
      return {'success': true}; 
    } on AuthException catch (e) {
      return {'success': false, 'message': e.message};
    } catch (e) {
      return {'success': false, 'message': 'An unexpected error occurred.'};
    }
  }

  Future<Map<String, dynamic>> register(String name, String email, String password, String phone, String whatsappPhone) async {
    try {
      final response = await _supabase.auth.signUp(
        email: email,
        password: password,
        data: {
          'name': name,
          'phone_number': phone,
          'whatsapp_phone': whatsappPhone,
        }
      );

      if (response.user != null) {
        if (response.session != null) {
           final userId = response.user!.id;
           await _storage.write(key: _userIdKey, value: userId);
           return {'success': true, 'userId': userId};
        } else {
           // Email confirmation required
           return {'success': true, 'requiresLogin': true, 'message': 'Please check your email to confirm your account.'};
        }
      }
      return {'success': false, 'message': 'Registration failed.'};
    } on AuthException catch (e) {
      return {'success': false, 'message': e.message};
    } catch (e) {
      return {'success': false, 'message': 'An unexpected error occurred.'};
    }
  }

  Future<Map<String, dynamic>> verifySession() async {
    final session = _supabase.auth.currentSession;
    if (session == null) {
      return {'valid': false};
    }

    try {
      final user = session.user;
      return {
        'valid': true, 
        'user': {
          'id': user.id,
          'email': user.email,
          'name': user.userMetadata?['name'] ?? 'Traveler',
        }
      };
    } catch (e) {
      return {'valid': false};
    }
  }

  Future<Map<String, dynamic>> forgotPassword(String email) async {
    try {
      await _supabase.auth.resetPasswordForEmail(email);
      return {'success': true, 'message': 'Password reset link has been sent to your email.'};
    } on AuthException catch (e) {
      return {'success': false, 'message': e.message};
    } catch (e) {
      return {'success': false, 'message': 'An unexpected error occurred.'};
    }
  }
}
