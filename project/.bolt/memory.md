# Project memory

## Product intent & audience

- IoT smart-toilet monitoring system: tracks cleanliness/urgency via sensors (ammonia, usage count, water level, bin fill).
- Urgency scored 0–10 via both rule-based and ML methods.
- Audience: facility/maintenance teams needing real-time toilet status and cleaning prioritization.

## Brand personality & voice

- Technical but accessible; production-grade and confident.
- Succinct, confirmation-oriented communication.

## Visual design & UX direction

- Dashboard UI (inferred from app + Firebase/Supabase pipeline); no concrete visual decisions captured yet.
- Stack: Vite + React (JSX), Tailwind CSS, Lucide icons, `@/` path alias (per `.bolt/prompt`).
- Aesthetic goal: beautiful, non-cookie-cutter, production-worthy (per `.bolt/prompt`).

## Decisions, constraints & rationale

- Backend: Supabase (Postgres); migrations live in `supabase/migrations/` and rebuild identically anywhere.
- Tables:
  - `toilets` — per-device record (demo row `toilet_01`), last-cleaned & last-alert timestamps.
  - `sensor_readings` — time-series measurements: ammonia (0–1000), usage count, water level, bin fill (0–100%); indexed lookups.
  - `urgency_scores` — 0–10 score, flagged by method (rule-based vs ML).
  - All tables linked to parent toilet; history not deletable via web app.
- Existing pipeline (ESP32 firmware, Python scripts, dashboard) currently talks to Firebase, not yet Supabase — migration is pending and offered as next step.

## Open questions & assumptions

- Firebase → Supabase integration for ESP32/Python/dashboard not yet started; awaiting user go-ahead.
- ML model details (training, features, deployment) unspecified.
- Dashboard UI/UX specifics (layout, charts, alerts) not yet defined.