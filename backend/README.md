# ⚙️ Travora Backend Service

The **Travora Backend** is a high-performance Python FastAPI service that powers the autonomous travel disruption prediction, dependency graph modeling, impact propagation, recovery plan generation, and multi-channel messaging engines.

---

## 💡 Overview

When travel disruptions occur (flight delays, hotel cancellations, severe weather), traditional travel platforms leave travelers to manually figure out downstream impacts. The Travora backend solves this by:

1. **Modeling Itineraries as Directed Acyclic Graphs (DAGs)**: Every flight, hotel, transfer, and conference meeting is stored as a graph node with temporal and spatial constraints.
2. **Predictive Weather Telemetry**: Integrating live weather data and what-if simulation parameters to calculate disruption risk scores.
3. **Graph Impact Propagation**: Automatically traversing graph edges to calculate cascading delay scores, broken connection windows, and budget impacts.
4. **Algorithmic Recovery Plan Generation**: Ranking candidate alternative flights, hotels, and ground transport into 3 Pareto-optimal recovery plans (*Best Overall*, *Lowest Cost*, *Fastest Arrival*).
5. **Interactive 2-Way Messaging**: Integrated WhatsApp Webhooks (Meta API) and custom SMS Gateway integration allowing travelers to view options and confirm rebookings by simply replying `1`, `2`, or `3` on WhatsApp or SMS.

---

## 🏗️ Architecture & Core Components

```
backend/
├── main.py                     # FastAPI application entrypoint & API routes
├── database.py                 # SQLAlchemy database session & engine setup
├── models.py                   # ORM models (Trips, Bookings, Disruptions, Executions, SMS Jobs)
├── schemas.py                  # Pydantic schemas & request/response contracts
├── crud.py                     # Database CRUD helper functions
├── seed.py                     # Database seeder for demo journeys
├── routers/                    # Modular API router endpoints
│   ├── auth.py                 # Authentication & JWT endpoints
│   └── ...
└── services/                   # Core Logic Modules
    ├── graph/                  # NetworkX DAG Builder & Temporal Query Engine
    ├── impact/                 # Cascading Impact & Severity Engine
    ├── recovery/               # Recovery Generator & Execution Engine
    ├── ml/                     # Disruption & Downstream Risk ML Models
    ├── events/                 # Disruption Event Ingestion & Simulation
    ├── notifications/          # Multi-channel Notification Dispatcher
    ├── whatsapp/               # WhatsApp Webhook Handler & Meta API Integration
    ├── versioning/             # Itinerary State Versioning & Diffing Engine
    └── demo/                   # Demo Reset & Scenario Drivers
```

### Key Subsystems

| Module | Responsibility |
|---|---|
| **Graph Engine (`services/graph`)** | Constructs NetworkX DAGs from trip bookings and evaluates temporal dependencies between flights, transfers, and hotels. |
| **Impact Engine (`services/impact`)** | Calculates cascading delay minutes, broken connection windows, and affected booking counts upon disruption injection. |
| **Recovery Engine (`services/recovery`)** | Queries candidate flights/hotels, evaluates constraint satisfaction, and ranks options into 3 distinct Pareto plans. |
| **ML Risk Scoring (`services/ml`)** | Predicts node failure probabilities based on weather metrics (rain, wind, visibility) and flight corridor risk. |
| **WhatsApp Handler (`services/whatsapp`)** | Receives inbound WhatsApp webhooks, parses traveler reply selections (`1`, `2`, `3`), and triggers automated atomic rebooking. |
| **SMS Gateway Dispatcher (`services/notifications`)** | Pushes SMS jobs to the pending queue for execution by the physical Android SMS Gateway app. |

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.10+** (Python 3.11 or 3.12 recommended)
- **pip** and **virtualenv**

### 1. Environment Setup

Navigate to the `backend/` directory:

```bash
cd backend
```

Create and activate a virtual environment:

- **Windows (PowerShell)**:
  ```powershell
  python -m venv venv
  .\venv\Scripts\Activate.ps1
  ```
- **macOS / Linux**:
  ```bash
  python3 -m venv venv
  source venv/bin/activate
  ```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment Configuration

Copy the sample `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Configure your environment variables in `.env` (optional for local mock run, required for live WhatsApp/Weather integration):
- `DATABASE_URL`: Defaults to `sqlite:///./travel_engine.db`
- `SECRET_KEY`: JWT secret key
- `WHATSAPP_PHONE_NUMBER_ID` & `WHATSAPP_ACCESS_TOKEN`: Meta WhatsApp Cloud API credentials
- `OPENWEATHER_API_KEY`: Weather telemetry API key

### 4. Seed the Database

Initialize the SQLite database schema and load default demo trips:

```bash
python seed.py
```

### 5. Run the Development Server

Start Uvicorn with auto-reload:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend server will start at `http://localhost:8000`.

---

## 📡 Interactive API Documentation

Once the server is running, explore and test the endpoints directly:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Key API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/trips` | List all traveler journeys |
| `GET` | `/api/trips/{id}/graph` | Fetch NetworkX DAG structure & dependency edges |
| `POST` | `/api/trips/{id}/simulate` | Inject a disruption event (e.g. flight delay, hotel cancellation) |
| `GET` | `/api/trips/{id}/digital-twin` | Get Weather Digital Twin telemetry & disruption risk metrics |
| `GET` | `/api/trips/{id}/impact` | Calculate cascading itinerary disruption impact |
| `GET` | `/api/trips/{id}/recovery-plans` | Generate 3 ranked recovery plans |
| `POST` | `/api/trips/{id}/execute` | Atomically apply selected recovery plan |
| `POST` | `/api/whatsapp/webhook` | Webhook endpoint for Meta WhatsApp inbound messages & replies |
| `GET` | `/api/sms-gateway/jobs` | Poll/Claim pending SMS jobs (used by Android SMS Gateway) |

---

## 🧪 Testing

Run backend test suites:

```bash
pytest
```

To run individual scenario test scripts:

```bash
python test_flow.py
python test_whatsapp_sms.py
```
