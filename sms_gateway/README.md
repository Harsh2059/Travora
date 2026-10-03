# 📡 Travora Android SMS Gateway

The **Travora SMS Gateway** is an isolated, lightweight Android Flutter application that serves as an on-premise hardware SMS Gateway for the Travora ecosystem. It eliminates the need for expensive third-party SMS APIs (such as Twilio or MSG91) by leveraging native Android SIM hardware to dispatch real SMS recovery notifications directly to travelers' phones.

---

## 💡 Architecture & How It Works

```
┌─────────────────────────┐
│     Travora Backend     │
│  (FastAPI + SQLite)     │
└────────────┬────────────┘
             │ REST API Polling / Claiming (/api/sms-gateway/jobs)
             v
┌─────────────────────────┐
│   Android Phone (SIM)   │
│ (Travora SMS Gateway)   │
└────────────┬────────────┘
             │ Native Android SmsManager MethodChannel
             v
┌─────────────────────────┐
│     GSM / Carrier       │
└────────────┬────────────┘
             │ Cellular Network
             v
┌─────────────────────────┐
│   Traveler's Phone      │
│ (Receives SMS Alert)    │
└─────────────────────────┘
```

---

## ✨ Key Capabilities

- 📱 **Direct SIM Transmission**: Utilizes native Android `SmsManager` via Flutter `MethodChannel` to send SMS messages using standard cell carrier SIM subscriptions.
- 🔒 **Atomic Job Claiming**: Prevents duplicate SMS sends across multiple gateway devices using stateful job locking on the backend.
- 🔄 **Strict State Lifecycle**: Enforces backend job state transitions: `PENDING` ➔ `CLAIMED` ➔ `SENDING` ➔ `SENT` / `FAILED`.
- 🛡️ **Fault-Tolerant Polling**: Gracefully handles temporary network drops, automatically retrying when Wi-Fi or cellular connectivity is restored.
- ⚙️ **Configurable Host & Device ID**: Dynamically set host server IP (`http://192.168.x.x:8000`) and device identifier directly from the in-app settings modal.

---

## 🏗️ Project Structure

```
sms_gateway/
├── android/
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml          # SEND_SMS & INTERNET permissions
│   │   └── kotlin/.../MainActivity.kt  # Native Android SmsManager MethodChannel
├── lib/
│   ├── config/app_config.dart          # Default backend host & polling configuration
│   ├── models/
│   │   ├── sms_job.dart                # Job schema model (phone number, message, job_id)
│   │   └── gateway_stats.dart          # Telemetry statistics model
│   ├── services/
│   │   ├── sms_service.dart            # Direct SIM SMS dispatcher
│   │   ├── permission_service.dart     # Android runtime permission handler
│   │   ├── backend_service.dart        # HTTP client for /api/sms-gateway
│   │   └── gateway_controller.dart     # Background polling coordinator
│   ├── screens/
│   │   └── gateway_screen.dart         # Monitoring dashboard UI & logs
│   └── main.dart                       # App entry point
└── pubspec.yaml
```

---

## 🚀 Setup & Execution

### Prerequisites

- **Flutter SDK**: `>=3.0.0`
- **Android Device**: Physical Android smartphone with an active SIM card & SMS plan (or Android Emulator for development testing).
- **USB Debugging**: Enabled on the device.

### 1. Start Travora Backend

Ensure the Travora backend is running and accessible on your local network:

```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Configure & Run SMS Gateway

Navigate to `sms_gateway/` and launch the app on your Android device:

```bash
cd sms_gateway
flutter pub get
flutter run -d <device-id>
```

### 3. In-App Configuration

1. **Grant Permissions**: On first launch, tap **Grant** to authorize `SEND_SMS` permissions.
2. **Set Backend Host**: Tap the **Settings** icon and enter your computer's local IP address (e.g. `http://192.168.1.105:8000`).
3. **Start Dispatching**: Tap **START GATEWAY**. The status pill will change to `ONLINE`.

---

## 🧪 Testing Real SMS Dispatch

1. Inject a disruption in the Travora Web Dashboard or via API:
   ```bash
   curl -X POST http://localhost:8000/api/trips/1/simulate \
     -H "Content-Type: application/json" \
     -d '{"scenario_type": "FLIGHT_CANCEL"}'
   ```
2. The backend generates a pending SMS job in the queue.
3. The Android Gateway claims the job, dispatches the SMS via SIM card, and updates the backend job status to `SENT`.
4. The traveler receives a real-time SMS alert on their mobile device!
