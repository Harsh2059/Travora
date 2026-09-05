# Live Demonstration Script — Travel Recovery Engine (Phase 4)

## Target Audience: Hackathon Judges, Product Evaluators & Travel Operations

### Pre-requisites
- Backend running on `http://localhost:8000`
- Frontend running on `http://localhost:5173`
- Demo reset baseline loaded: click **"Reset Demo State"** on the top navigation bar.

---

## Act 1: The Human Journey — "My Trip" (Baseline State)
1. **Open the App**: Notice the default view is the **Traveler Experience (Human Flow)**.
2. **Point out Multi-Modal Components**:
   - ✈️ Flight: Air India BOM $\rightarrow$ DEL
   - ✈️ Flight: British Airways DEL $\rightarrow$ LHR
   - 🚕 Transfer: Heathrow Express LHR $\rightarrow$ London City
   - 🏨 Hotel: Marriott London
   - 🎤 Critical Event: **Tech Conference 2026** (marked with a gold star: ★ Critical Event)
3. **Key Narrative**: Explain that the traveler is an executive speaking at Tech Conference 2026 tomorrow at 9:00 AM. Missing this presentation is unacceptable.

---

## Act 2: Inject Disruption — "What Happened?"
1. Under **Step 2 (What Happened?)**, click **"✈️ 4h Flight Delay"** (or in the simulator bar).
2. **Observe Real-Time Reaction**:
   - The alert turns amber/red: *"Flight A delayed 240 mins. Breaks Delhi connection & triggers cascade."*
   - In Step 1, Flight A turns red (`⚠️ Delayed by 240m`), and British Airways turns red (`⚠️ Connection departure is 120m before inbound flight arrives`).
3. **Check Step 3 (What Does This Affect?)**:
   - Plain English breakdown explains: connecting flight BA202 to London is broken.
   - Reassurance: *"Protected! Our recovery engine prioritizes your arrival before 9:00 AM."*

---

## Act 3: Evaluated Choices — "Recovery Choices"
1. Scroll to **Step 4 (Recovery Choices)**:
   - Three clear cards are displayed:
     - ⭐ **Best for You**: AI-recommended option balancing time and carrier policy.
     - 💰 **Cheapest Option**: Minimizes out-of-pocket cost with maximum refund recovery.
     - ⚡ **Fastest / Direct Upgrade**: Minimizes total delay with direct routing.
2. **Point out Decision Clarity**:
   - Every card explicitly states:
     - **What you gain** (e.g. Preserves Tech Conference, arrives in time for keynote).
     - **What you give up** (e.g. Fare difference or later arrival).
     - **Net Cost Impact** (e.g. + ₹4,500).

---

## Act 4: Review Changes & Rebook — "Back on Track ✓"
1. Click **"Review & Choose This Plan"** on the Best for You card.
2. The **Step 5 Review & Confirm** modal opens:
   - Shows clean before-and-after diff (Removed Air India/BA $\rightarrow$ Rebooked direct flight).
   - Full financial breakdown showing ticket cost, airline refund credits, and net fee.
   - Shows the guarantee: *"Constraint Invariant Guarantee: Tech Conference 2026 arrival is guaranteed."*
3. Click **"Confirm Recovery & Update Itinerary"**.
4. **Observe the Celebration**:
   - **"Back on Track! ✓"** green banner confirms successful atomic rebooking.
   - Trip is updated to **Trip Version 2**.
   - All itinerary cards refresh with confirmed status badges.

---

## Act 5: Progressive Disclosure — The Engineering Digital Twin
1. Click **"View Technical Details (DAG & ML)"** button or toggle the top switcher to **"System Engineering"**.
2. **Highlight Under-the-Hood Capabilities**:
   - **Interactive NetworkX Graph**: Show the topological nodes, dependency edges, and acyclic verification.
   - **ML Disruption & Downstream Risk Card**: Explain the ML disruption probability and downstream delay prediction models.
   - **Multi-Objective Solver Objective Weights**: Drag the **Time Minimization** and **Cost Minimization** sliders to demonstrate real-time candidate re-ranking.
   - **Version History & Diff**: Click **"Version History"** in the top navbar to see the immutable audit trail from v1 to v2.

---

## Act 6: Multi-Modal Disruption Demo
1. In the Disruption Simulator or Quick Buttons, trigger:
   - **🚕 Heathrow Transfer Strike**: Observe immediate generation of Executive Cab Dispatch and Shuttle alternatives.
   - **🏨 Marriott Unavailable**: Observe immediate generation of Heritage Grand Palace Partner and Courtyard Hotel rebooking without affecting the conference.
2. Click **"Reset Demo State"** to restore pristine baseline for next judge or test run.
