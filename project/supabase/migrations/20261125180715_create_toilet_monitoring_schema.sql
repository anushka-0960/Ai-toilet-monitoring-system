/*
# Create AI Smart Public Toilet Monitoring schema

1. Plain-English summary
   This migration creates the database backbone for the toilet monitoring
   system. It stores which toilets exist, every sensor reading they report,
   the urgency score computed for each reading, and when a toilet was last
   cleaned or an alert was last sent. A single demo toilet ("toilet_01")
   is seeded automatically.

2. New Tables
   - `toilets`
     - `id` (text, primary key) — stable identifier such as "toilet_01"
     - `name` (text) — human-friendly display name
     - `location` (text, nullable) — optional description of where it is
     - `last_cleaned_at` (timestamptz, nullable) — set by "Mark as Cleaned"
     - `last_alert_sent_at` (timestamptz, nullable) — alert rate-limit marker
     - `created_at` (timestamptz, default now())
   - `sensor_readings`
     - `id` (uuid, primary key, auto-generated)
     - `toilet_id` (text, foreign key to `toilets`, cascade on delete)
     - `ammonia_ppm` (double precision, not null) — MQ-135 reading, 0-100
     - `usage_count` (integer, not null) — PIR motion count since last clean
     - `water_level` (text, not null) — "OK" or "LOW" (float switch)
     - `bin_fill_percent` (double precision, not null) — HC-SR04 fill, 0-100
     - `recorded_at` (timestamptz, not null) — device timestamp of the reading
     - `created_at` (timestamptz, default now())
   - `urgency_scores`
     - `id` (uuid, primary key, auto-generated)
     - `toilet_id` (text, foreign key to `toilets`, cascade on delete)
     - `score` (double precision, not null) — computed urgency, 0-10
     - `method` (text, not null) — "rule" (rule-based) or "ml" (Random Forest)
     - `created_at` (timestamptz, default now())

3. Modified Tables
   - None. All tables are new.

4. Indexes
   - `sensor_readings_toilet_recorded_idx` on (`toilet_id`, `recorded_at` desc)
     so the dashboard can quickly fetch the latest reading and 24 h history.
   - `urgency_scores_toilet_created_idx` on (`toilet_id`, `created_at` desc)
     so the latest score is a fast lookup.

5. Security
   - Row Level Security is ENABLED on all three tables.
   - This app has NO sign-in screen: it is a single-tenant monitoring
     dashboard. All policies therefore target `anon, authenticated`, and
     `USING (true)` / `WITH CHECK (true)` is used intentionally because the
     sensor data is shared/public by design — anyone with the site can view
     it and mark a toilet as cleaned.
   - Privileges granted explicitly:
     - `anon`, `authenticated`: SELECT + INSERT + UPDATE on all three tables
       (the dashboard reads data, ingests readings, writes urgency scores,
       and updates `last_cleaned_at`). DELETE is intentionally NOT granted —
       history must never be lost.
     - `service_role`: full CRUD for server-side jobs (urgency engine /
       edge functions), which bypass RLS but still need grants.

6. Notes
   - The seed insert for "toilet_01" uses ON CONFLICT DO NOTHING so the
     migration is safe to re-run and never duplicates the row.
   - A CHECK constraint limits `water_level` to "OK" or "LOW" and keeps
     scores within their documented ranges at the database level.
*/

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS toilets (
  id text PRIMARY KEY,
  name text NOT NULL,
  location text,
  last_cleaned_at timestamptz,
  last_alert_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  toilet_id text NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
  ammonia_ppm double precision NOT NULL CHECK (ammonia_ppm >= 0 AND ammonia_ppm <= 1000),
  usage_count integer NOT NULL CHECK (usage_count >= 0),
  water_level text NOT NULL CHECK (water_level IN ('OK', 'LOW')),
  bin_fill_percent double precision NOT NULL CHECK (bin_fill_percent >= 0 AND bin_fill_percent <= 100),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS urgency_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  toilet_id text NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
  score double precision NOT NULL CHECK (score >= 0 AND score <= 10),
  method text NOT NULL CHECK (method IN ('rule', 'ml')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS sensor_readings_toilet_recorded_idx
  ON sensor_readings (toilet_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS urgency_scores_toilet_created_idx
  ON urgency_scores (toilet_id, created_at DESC);

-- ---------------------------------------------------------------------
-- Seed the demo toilet (idempotent, stable id)
-- ---------------------------------------------------------------------
INSERT INTO toilets (id, name, location)
VALUES ('toilet_01', 'Toilet 01', 'Main entrance')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------
-- Row Level Security
-- Single-tenant monitoring app with NO sign-in: data is intentionally
-- shared/public, so policies target anon + authenticated.
-- ---------------------------------------------------------------------
ALTER TABLE toilets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE urgency_scores ENABLE ROW LEVEL SECURITY;

-- toilets
DROP POLICY IF EXISTS "toilets_select" ON toilets;
CREATE POLICY "toilets_select" ON toilets FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "toilets_insert" ON toilets;
CREATE POLICY "toilets_insert" ON toilets FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "toilets_update" ON toilets;
CREATE POLICY "toilets_update" ON toilets FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

-- sensor_readings
DROP POLICY IF EXISTS "sensor_readings_select" ON sensor_readings;
CREATE POLICY "sensor_readings_select" ON sensor_readings FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sensor_readings_insert" ON sensor_readings;
CREATE POLICY "sensor_readings_insert" ON sensor_readings FOR INSERT
TO anon, authenticated WITH CHECK (true);

-- urgency_scores
DROP POLICY IF EXISTS "urgency_scores_select" ON urgency_scores;
CREATE POLICY "urgency_scores_select" ON urgency_scores FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "urgency_scores_insert" ON urgency_scores;
CREATE POLICY "urgency_scores_insert" ON urgency_scores FOR INSERT
TO anon, authenticated WITH CHECK (true);

-- ---------------------------------------------------------------------
-- Grants (Data API access)
-- SELECT/INSERT/UPDATE only — history must never be deleted.
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON toilets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON sensor_readings TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON urgency_scores TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON toilets, sensor_readings, urgency_scores TO service_role;
