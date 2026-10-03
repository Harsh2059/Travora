# 📱 Travora Mobile Application

The **Travora Mobile App** is a cross-platform mobile application built with **Flutter** for iOS and Android. It puts real-time itinerary monitoring, instant disruption alerts, weather risk telemetry, and 1-tap recovery execution directly into the traveler's hands.

---

## 📱 Features

- ✈️ **Live Journey Companion**: Real-time timeline view of active trip segments (flights, hotels, transfers, events) with live status badges.
- 🚨 **Push Disruption Alerts**: Instant notifications when flight delays, gate changes, hotel cancellations, or extreme weather impact your journey.
- 📊 **Cascading Impact Breakdown**: Clear visual analysis of how a single delayed flight affects downstream hotel check-ins and transfers.
- ⚡ **1-Tap Recovery Execution**: Compare 3 AI-ranked recovery options (*Best Value*, *Lowest Cost*, *Fastest Arrival*) and execute rebooking in seconds with updated PNR generation.
- 🌦️ **Mobile Digital Twin View**: Monitor live weather risk scores along flight corridors.
- 🔒 **Secure User Authentication**: JWT-based login/signup with secure token storage.

---

## 🏗️ Architecture & Project Structure

```
mobile/
├── lib/
│   ├── config/                # App theme, constants, and API endpoints
│   ├── core/                  # Core utilities, HTTP helpers, and error handlers
│   ├── models/                # Data models (Trip, Booking, Disruption, RecoveryPlan, User)
│   ├── providers/             # State management providers (Riverpod / Provider)
│   ├── routing/               # Navigation & GoRouter routes
│   ├── screens/               # Mobile UI Screens
│   │   ├── auth/              # Login & Registration screens
│   │   ├── home_screen.dart   # Main traveler dashboard
│   │   ├── my_trips_screen.dart # Active & past trips list
│   │   ├── journey_screen.dart # Detailed journey timeline
│   │   ├── disruption_screen.dart # Disruption alert breakdown
│   │   ├── impact_screen.dart # Cascading impact visualizer
│   │   ├── recovery_options_screen.dart # 3-card recovery plan options
│   │   ├── recovery_confirmed_screen.dart # Success confirmation with updated ticket
│   │   ├── create_trip_screen.dart # Trip builder screen
│   │   ├── notifications_screen.dart # Notification center
│   │   └── profile_screen.dart # User profile & preferences
│   ├── services/              # API services & HTTP communication layer
│   ├── widgets/               # Reusable Flutter widgets (Cards, Badges, Buttons)
│   └── main.dart              # Flutter application entry point
├── pubspec.yaml               # Flutter package configuration & assets
└── android/ & ios/            # Native platform project wrappers
```

---

## 🛠️ Tech Stack & Dependencies

- **Framework**: Flutter (Dart SDK `>=3.0.0`)
- **Navigation**: `go_router`
- **Networking**: `http` / `dio`
- **State Management**: `flutter_riverpod` / `provider`
- **Storage**: `flutter_secure_storage` / `shared_preferences`
- **Iconography**: `lucide_icons` / `cupertino_icons`

---

## 🚀 Getting Started

### Prerequisites

- **Flutter SDK**: `>=3.0.0` (Verify with `flutter --version`)
- **Android Studio** (for Android development/emulator) or **Xcode** (for iOS simulator, macOS required)

### 1. Installation

Navigate to the `mobile/` directory and fetch dependencies:

```bash
cd mobile
flutter pub get
```

### 2. Configure Backend Endpoint

Open `lib/config/app_config.dart` (or environment configuration) to set the backend URL:

- **Android Emulator**: `http://10.0.2.2:8000/api`
- **iOS Simulator**: `http://127.0.0.1:8000/api`
- **Physical Device on Wi-Fi**: `http://<YOUR_COMPUTER_IP>:8000/api` (e.g. `http://192.168.1.105:8000/api`)

### 3. Run the App

Run on a connected device or emulator:

```bash
# List available target devices
flutter devices

# Run app on target device
flutter run -d <device-id>
```

### 4. Build Release Binaries

- **Android APK**:
  ```bash
  flutter build apk --release
  ```
- **iOS App Bundle**:
  ```bash
  flutter build ios --release
  ```
