# Technical Decisions & Architecture Trade-Offs (Phase 4)

## 1. Multi-Modal Provider Abstraction
- **Decision**: Implemented an abstract base class `AvailabilityProvider` with concrete subclass `MockAvailabilityProvider`.
- **Rationale**: Real travel systems integrate with heterogeneous APIs (Sabre/Amadeus for flights, IRCTC/Trainline for rail, Uber/Careem for cabs, Expedia for hotels). By decoupling inventory search behind an abstract interface, the recovery engine remains 100% agnostic to the upstream provider while enabling zero-latency deterministic automated testing.

## 2. Progressive Disclosure UX
- **Decision**: Separated the interface into a primary **Traveler Journey Mode** and a secondary **Technical Details Drawer / Engineering Mode**.
- **Rationale**: Early feedback revealed that exposing NetworkX graphs, acyclic proofs, ML standard deviations, and raw solver cost functions directly to travelers creates cognitive overload. The primary UI prioritizes clarity, trade-offs ("What you gain" vs "What you give up"), and reassurance, while engineering evaluators retain complete access to the underlying mathematical digital twin via one click.

## 3. Top-3 Categorized Candidate Presentation
- **Decision**: Automatically group candidate recovery plans into 3 distinct traveler archetypes:
  1. **Best for You**: Multi-objective balanced score aligning with personalized traveler preferences.
  2. **Cheapest**: Pure cost-saving focus that prioritizes refund capture.
  3. **Fastest / Direct Upgrade**: Minimizes trip delay through premium or direct routing.
- **Rationale**: Travelers experiencing disruptions are under stress. Presenting a flat list of 6 raw algorithmic plans causes decision paralysis. Grouping into clear trade-off choices drastically reduces time-to-decision.

## 4. Deterministic Invariant Enforcement vs Heuristics
- **Decision**: Strict constraint satisfaction pruning before ranking.
- **Rationale**: Machine learning and LLMs can hallucinate impossible travel itineraries (e.g. negative layovers or skipping a critical event). By placing a deterministic NetworkX and Python constraint validation layer between candidate generation and the user, we mathematically guarantee that any plan marked `feasible` preserves the traveler's hard commitments.

## 5. Idempotent Versioned State Machine
- **Decision**: Trips are strictly versioned ($V_1, V_2, \dots, V_n$). Recovery plans reference `source_itinerary_version`.
- **Rationale**: If a traveler receives a recovery plan for Version 1, but another disruption or background process updates the trip to Version 2 in the meantime, executing the plan could corrupt the state. The execution engine enforces optimistic concurrency control, rejecting stale plans and rolling back cleanly upon any database inconsistency.
