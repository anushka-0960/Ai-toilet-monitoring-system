/*
# Revoke DELETE from client roles on monitoring tables

1. Plain-English summary
   The platform's default privileges had granted the public web roles the
   ability to request row deletions. This migration removes that grant so
   sensor history and scores can never be deleted through the web app.
   Row Level Security already blocked deletes (no DELETE policy exists);
   this also removes the table privilege for defense in depth.

2. Modified Tables
   - `toilets`, `sensor_readings`, `urgency_scores`: REVOKE DELETE from
     `anon` and `authenticated`. No data or columns are changed.

3. Security
   - Deletes remain possible only for `service_role` (server-side jobs).
*/

REVOKE DELETE ON toilets FROM anon, authenticated;
REVOKE DELETE ON sensor_readings FROM anon, authenticated;
REVOKE DELETE ON urgency_scores FROM anon, authenticated;
