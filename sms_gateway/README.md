# Travora Android Flutter SMS Gateway

An isolated, lightweight Android Flutter application dedicated to acting as an on-premise hardware SMS Gateway for the Travora / HackCelestial platform.

```
                    ┌─────────────────────────┐
                    │     Travora Backend     │
                    │  (Recovery / Disrupt)   │
                    └────────────┬────────────┘
                                 │
                     REST API Polling / Claiming
                                 │
                                 v
                    ┌─────────────────────────┐
                    │   X's Android Phone     │
                    │ (SMS Gateway Flutter)   │
                    └────────────┬────────────┘
                                 │
                         Android SmsManager
                                 │
                                 v
                    ┌─────────────────────────┐
                    │      Physical SIM       │
                    └────────────┬────────────┘
                                 │
                         GSM / Carrier SMS
                                 │
                                 v
                    ┌─────────────────────────┐
                    │   Traveler Y's Phone    │
                    │      (Receives SMS)     │
                    └─────────────────────────┘
```

---

## Key Features

- **Direct SIM SMS Transmission**: Utilizes native Android `SmsManager` via Flutter `MethodChannel`. No third-party SMS providers (Twilio, MSG91, AWS SNS) are required.
- **Atomic Job Claiming**: Prevents duplicate sends across multiple gateway devices using the backend's `/api/sms-gateway/jobs` contract.
- **Strict State Lifecycle**: Respects the backend state transitions: `PENDING -> CLAIMED -> SENDING -> SENT / FAILED`.
- **Fault-Tolerant Polling**: Handles temporary backend network outages gracefully without crashing, resuming automatically when connectivity returns.
- **Configurable Backend Host**: Easily point to local development computers (`http://10.0.2.2:8000` for Android emulator or LAN IP `http://192.168.x.x:8000` for physical phone on Wi-Fi).

---

## Project Structure

```
sms_gateway/
├── android/
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml   # SEND_SMS and INTERNET permissions
│   │   │   └── kotlin/.../MainActivity.kt  # Native SmsManager MethodChannel
│   │   └── build.gradle
│   └── build.gradle
├── lib/
│   ├── config/
│   │   └── app_config.dart          # Backend URL & device settings
│   ├── models/
│   │   ├── sms_job.dart             # Backend SMS job schema model
│   │   └── gateway_stats.dart       # Telemetry stats model
│   ├── services/
│   │   ├── sms_service.dart         # Direct SIM SMS dispatcher
│   │   ├── permission_service.dart  # Android runtime permission handler
│   │   ├── backend_service.dart     # HTTP client for /api/sms-gateway
│   │   └── gateway_controller.dart  # Background polling & lifecycle coordinator
│   ├── screens/
│   │   └── gateway_screen.dart      # Real-time monitoring & control dashboard
│   └── main.dart                    # App entry point
└── pubspec.yaml
```

---

## Setup & Running Instructions

### 1. Prerequisites
- Flutter SDK installed (`>=3.0.0`)
- Android device or Android emulator with USB debugging enabled
- Physical SIM card installed with active SMS plan (for physical device)

### 2. Configure Backend Connectivity

1. Start the Travora backend:
   ```bash
   cd backend
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

2. Note the host URL:
   - **Android Emulator**: `http://10.0.2.2:8000`
   - **Physical Android Phone on same Wi-Fi**: `http://<YOUR_COMPUTER_LOCAL_IP>:8000` (e.g. `http://192.168.1.105:8000`)

### 3. Run the SMS Gateway App

Navigate to the `sms_gateway/` directory:

```bash
cd sms_gateway
flutter pub get
flutter run -d <device-id>
```

### 4. Operational Steps on Device

1. **Grant Permissions**: Upon launch, tap **"Grant"** to authorize `SEND_SMS` permission.
2. **Configure Host**: Tap the **Settings icon** (top right) and enter your backend URL (e.g., `http://192.168.1.105:8000`) and Device ID (`SMS_GATEWAY_01`).
3. **Start Dispatching**: Tap **"START GATEWAY"**. The status indicator turns green (`ONLINE`).
4. The gateway will poll every 5 seconds, claim pending SMS jobs, transmit them directly via the phone's SIM, and report `SENT` / `FAILED` back to the backend.

---

## Testing Real SMS Dispatch

1. Trigger a disruption in Travora:
   ```bash
   curl -X POST http://localhost:8000/api/trips/1/simulate \
     -H "Content-Type: application/json" \
     -d '{"scenario_type": "FLIGHT_CANCEL"}'
   ```
2. The backend creates a pending SMS job.
3. The Android Gateway polls the backend, claims the job, and dispatches the SMS via the SIM card.
4. The traveler's phone receives the real SMS text message.
5. The gateway updates the job status on the backend to `SENT`.
