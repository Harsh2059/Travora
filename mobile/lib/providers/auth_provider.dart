import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../core/config/app_config.dart';

enum AuthState {
  checkingSession,
  unauthenticated,
  authenticating,
  authenticated,
  authenticationError
}

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();
  
  AuthState _state = AuthState.checkingSession;
  AuthState get state => _state;
  
  String? _errorMessage;
  String? get errorMessage => _errorMessage;

  String? _userId;
  String? get userId => _userId;

  AuthProvider() {
    _initSession();
  }

  Future<void> _initSession() async {
    _state = AuthState.checkingSession;
    notifyListeners();

    final result = await _authService.verifySession();
    if (result['valid'] == true) {
      _userId = result['userId'];
      if (_userId != null) AppConfig.currentUserId = _userId!;
      _state = AuthState.authenticated;
    } else {
      _state = AuthState.unauthenticated;
    }
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _state = AuthState.authenticating;
    _errorMessage = null;
    notifyListeners();

    final result = await _authService.login(email, password);
    
    if (result['success'] == true) {
      _userId = result['userId'];
      if (_userId != null) AppConfig.currentUserId = _userId!;
      _state = AuthState.authenticated;
      notifyListeners();
      return true;
    } else {
      _state = AuthState.authenticationError;
      _errorMessage = result['message'];
      notifyListeners();
      return false;
    }
  }

  Future<bool> register(String name, String email, String password, String phone, String whatsappPhone) async {
    _state = AuthState.authenticating;
    _errorMessage = null;
    notifyListeners();

    final result = await _authService.register(name, email, password, phone, whatsappPhone);
    
    if (result['success'] == true) {
      if (result['requiresLogin'] == true) {
        _state = AuthState.unauthenticated;
        notifyListeners();
        return true; 
      }
      _userId = result['userId'];
      if (_userId != null) AppConfig.currentUserId = _userId!;
      _state = AuthState.authenticated;
      notifyListeners();
      return true;
    } else {
      _state = AuthState.authenticationError;
      _errorMessage = result['message'];
      notifyListeners();
      return false;
    }
  }

  Future<bool> loginWithProvider(String providerName) async {
    _state = AuthState.authenticating;
    _errorMessage = null;
    notifyListeners();

    // In a real implementation we would call GoogleSignIn().signIn() here,
    // get the token, and send it to the backend. We will mock the provider token here
    // since the backend has a mock OAuth endpoint configured.
    final provider = providerName.toLowerCase().split(' ')[0]; // 'google', 'facebook', 'phone'
    
    try {
      final response = await _authService.loginProvider(provider);
      if (response['success'] == true) {
        _userId = response['userId'];
        if (_userId != null) AppConfig.currentUserId = _userId!;
        _state = AuthState.authenticated;
        notifyListeners();
        return true;
      } else {
        _state = AuthState.authenticationError;
        _errorMessage = response['message'];
        notifyListeners();
        return false;
      }
    } catch (e) {
      _state = AuthState.authenticationError;
      _errorMessage = 'Unable to connect. Please check your internet connection.';
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _authService.clearSession();
    _userId = null;
    _state = AuthState.unauthenticated;
    notifyListeners();
  }

  Future<bool> forgotPassword(String email) async {
    _state = AuthState.authenticating;
    _errorMessage = null;
    notifyListeners();

    final result = await _authService.forgotPassword(email);
    
    if (result['success'] == true) {
      _state = AuthState.unauthenticated;
      notifyListeners();
      return true;
    } else {
      _state = AuthState.authenticationError;
      _errorMessage = result['message'];
      notifyListeners();
      return false;
    }
  }
}
