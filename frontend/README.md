# 💻 Travora Web Frontend

The **Travora Frontend** is a modern, responsive single-page web application built with **React 19**, **TypeScript**, **Vite**, and **Tailwind CSS**. It provides an intuitive dashboard for travelers and travel administrators to visualize itineraries, monitor weather risks in real time via a **Digital Twin**, simulate disruptions, and execute 1-click itinerary recovery plans.

---

## 🌟 Features & Highlights

### 🌦️ Weather Digital Twin & What-If Simulator
- **Live Telemetry & Observation**: Real-time weather monitoring (temperature, wind speed, rainfall, visibility) along flight and ground transport corridors.
- **What-If Simulation Sliders**: Adjust weather parameters (Rainfall mm, Wind Speed km/h, Visibility km, Temperature °C) to simulate severe storm impacts before they happen.
- **Preset Stress Tests**: 1-click stress test presets including *Clear Skies*, *Moderate Monsoon*, *Severe Storm Benchmark*, and *Cyclone Stress Test*.
- **Predictive Risk Indicators**: Gauges for Disruption Risk %, Estimated Delay (minutes), Transport Impact %, Hotel Impact %, and Model Confidence Score.
- **Interactive Route Map**: Leaflet map visualizing flight corridors, route nodes, and disruption points.

### 📅 Traveler Journey & Disruption Management
- **Visual Itinerary Timeline**: Segment-by-segment view of flights, hotel bookings, ground transfers, and meetings with live status tags.
- **Interactive Disruption Simulator**: Trigger real-world emergency scenarios (e.g. flight delayed 4 hours, hotel overbooked, severe weather lockdown).
- **Impact Assessment Matrix**: Instant visual feedback on which itinerary segments remain protected vs. breached.
- **3 Ranked Recovery Plans**: Side-by-side comparison of candidate recovery options:
  - 🏆 **Best for You**: Balanced optimization of time, cost, and convenience.
  - 💰 **Lowest Cost**: Budget-focused option minimizing rebooking fees.
  - ⚡ **Fastest Arrival**: Time-optimized plan to preserve critical meetings.
- **1-Click Execution & Rollback**: Confirm a recovery plan to update your itinerary instantly, with full capability to toggle back to the original plan.

---

## 🏗️ Project Structure

```
frontend/
├── src/
│   ├── components/            # UI Components
│   │   ├── Navbar.tsx         # Top navigation header & active trip badge
│   │   ├── TravelerJourneyView.tsx  # Interactive journey timeline & recovery UI
│   │   ├── WeatherDigitalTwin.tsx   # Weather Digital Twin & What-If Simulator
│   │   ├── DigitalTwinRouteMap.tsx  # Map visualization component
│   │   ├── DisruptionSimulatorModal.tsx # Simulation trigger modal
│   │   ├── RecoveryPlansModal.tsx   # 3-card recovery plan comparison view
│   │   └── ...
│   ├── screens/               # Main Page Screens
│   │   ├── HomeScreen.tsx     # Landing page & destination highlights
│   │   ├── SkyWayTimelineScreen.tsx # Detailed traveler itinerary timeline
│   │   ├── AdminConsoleScreen.tsx   # Admin trip selector & disruption trigger
│   │   ├── DigitalTwinScreen.tsx    # Weather Digital Twin dashboard
│   │   └── TripBuilderScreen.tsx    # Custom itinerary creation tool
│   ├── services/              # API Communication & Data Layer
│   │   ├── api.ts             # Axios REST client for FastAPI backend
│   │   └── mockData.ts        # Offline fallback dataset for seamless offline demos
│   ├── types/                 # TypeScript interfaces & type definitions
│   └── App.tsx                # App routing & main layout wrapper
├── index.html                 # Entry HTML file
├── vite.config.ts             # Vite bundler configuration
└── package.json               # Project dependencies & scripts
```

---

## 🛠️ Technology Stack

- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS
- **Iconography**: Lucide React
- **Mapping**: Leaflet / React-Leaflet
- **HTTP Client**: Axios

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm** or **yarn**

### 1. Installation

Navigate to the `frontend/` directory and install dependencies:

```bash
cd frontend
npm install
```

### 2. Environment Configuration (Optional)

Create a `.env` file in the `frontend/` root if you need to point to a custom backend URL:

```env
VITE_API_BASE_URL=http://localhost:8000/api
```

*(If omitted, Vite defaults to proxies or `http://localhost:8000/api`)*

### 3. Run Development Server

```bash
npm run dev
```

The application will start at `http://localhost:5173`.

### 4. Build for Production

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

---

## 💡 Offline Demo / Fallback Mode

If the backend server is offline or unreachable, the frontend automatically switches to local fallback mode using pre-configured mock data (`src/services/mockData.ts`). This guarantees a flawless demo experience even without an active backend connection.
