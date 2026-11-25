"""
AI Smart Public Toilet Monitoring System - Urgency Engine.

Every CHECK_INTERVAL_SECONDS:
  1. Read the latest sensor snapshot from Firebase.
  2. Compute a 0-10 urgency score (ML model if trained, rule-based otherwise).
  3. Write the score back to Firebase.
  4. Send a Telegram alert when the score exceeds the threshold
     (rate-limited to one alert per ALERT_COOLDOWN_SECONDS).
"""

import json
import os
import sys
import time
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, db

try:
    from config import (
        FIREBASE_CRED_PATH,
        FIREBASE_DB_URL,
        TOILET_ID,
        URGENCY_THRESHOLD,
        CHECK_INTERVAL_SECONDS,
        ALERT_COOLDOWN_SECONDS,
    )
    from telegram_alert import send_alert
except ImportError:
    from .config import (  # type: ignore
        FIREBASE_CRED_PATH,
        FIREBASE_DB_URL,
        TOILET_ID,
        URGENCY_THRESHOLD,
        CHECK_INTERVAL_SECONDS,
        ALERT_COOLDOWN_SECONDS,
    )
    from .telegram_alert import send_alert  # type: ignore

MODEL_PATH = os.path.join(os.path.dirname(__file__), "urgency_model.joblib")

FEATURE_ORDER = ["ammonia_ppm", "usage_count", "bin_fill_percent",
                 "last_cleaned_hours_ago", "hour_of_day"]


# ----------------------------------------------------------------------
# Firebase
# ----------------------------------------------------------------------
def init_firebase() -> None:
    if not os.path.exists(FIREBASE_CRED_PATH):
        print(
            f"ERROR: service account key not found at '{FIREBASE_CRED_PATH}'.\n"
            "Download it from Firebase Console > Project Settings > "
            "Service accounts > Generate new private key, then save it as "
            "serviceAccountKey.json next to config.py."
        )
        sys.exit(1)
    if FIREBASE_DB_URL.startswith("https://YOUR_PROJECT"):
        print("ERROR: fill in FIREBASE_DB_URL in config.py first.")
        sys.exit(1)

    cred = credentials.Certificate(FIREBASE_CRED_PATH)
    firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_DB_URL})
    print("[firebase] Admin SDK initialised")


def toilet_ref(child: str = ""):
    return db.ref(f"/toilets/{TOILET_ID}{child}")


# ----------------------------------------------------------------------
# Urgency scoring
# ----------------------------------------------------------------------
def compute_urgency_rule(latest: dict, last_cleaned_hours_ago: float) -> float:
    """Rule-based score: weighted sum of the three sensor signals, 0-10."""
    ammonia = float(latest.get("ammonia_ppm", 0) or 0)
    usage = int(latest.get("usage_count", 0) or 0)
    bin_fill = float(latest.get("bin_fill_percent", 0) or 0)

    urgency = (
        (ammonia / 100.0) * 0.5
        + (min(usage, 20) / 20.0) * 0.3
        + (bin_fill / 100.0) * 0.2
    )
    return max(0.0, min(10.0, urgency))


def load_model():
    if not os.path.exists(MODEL_PATH):
        return None
    try:
        import joblib
        return joblib.load(MODEL_PATH)
    except Exception as exc:
        print(f"[ml] Failed to load model ({exc}); falling back to rule-based.")
        return None


def compute_urgency_ml(model, latest: dict, last_cleaned_hours_ago: float) -> float:
    hour_of_day = datetime.now(timezone.utc).hour
    features = [[
        float(latest.get("ammonia_ppm", 0) or 0),
        int(latest.get("usage_count", 0) or 0),
        float(latest.get("bin_fill_percent", 0) or 0),
        last_cleaned_hours_ago,
        hour_of_day,
    ]]
    prediction = model.predict(features)[0]
    return max(0.0, min(10.0, float(prediction)))


# ----------------------------------------------------------------------
# Main loop
# ----------------------------------------------------------------------
def main() -> None:
    init_firebase()
    model = load_model()
    if model is not None:
        print("[ml] urgency_model.joblib loaded — using ML predictions")
    else:
        print("[ml] No urgency_model.joblib found — using rule-based scoring")

    while True:
        try:
            latest = toilet_ref("/latest").get()
            if not latest:
                print(f"[warn] No data at /toilets/{TOILET_ID}/latest yet "
                      "(is the ESP32 online?)")
                time.sleep(CHECK_INTERVAL_SECONDS)
                continue

            # Last cleaned
            last_cleaned = toilet_ref("/last_cleaned").get() or 0
            now_epoch = time.time()
            if last_cleaned:
                last_cleaned_hours_ago = max(0.0, (now_epoch - float(last_cleaned)) / 3600.0)
            else:
                last_cleaned_hours_ago = 9999.0

            # Score
            if model is not None:
                score = compute_urgency_ml(model, latest, last_cleaned_hours_ago)
                method = "ml"
            else:
                score = compute_urgency_rule(latest, last_cleaned_hours_ago)
                method = "rule"

            toilet_ref("/urgency_score").set({
                "score": round(score, 2),
                "timestamp": int(now_epoch),
                "method": method,
            })

            # Alert (rate-limited)
            alert_sent = "no"
            last_alert = toilet_ref("/last_alert_sent").get() or 0
            if score > URGENCY_THRESHOLD:
                if now_epoch - float(last_alert) > ALERT_COOLDOWN_SECONDS:
                    ok = send_alert(TOILET_ID, score, {
                        "ammonia_ppm": latest.get("ammonia_ppm"),
                        "bin_fill_percent": latest.get("bin_fill_percent"),
                        "last_cleaned_hours_ago": last_cleaned_hours_ago,
                    })
                    if ok:
                        toilet_ref("/last_alert_sent").set(int(now_epoch))
                        alert_sent = "yes"
                else:
                    alert_sent = "cooldown"

            ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
            print(f"[{ts}] Toilet {TOILET_ID} | Score: {score:.1f} | "
                  f"Method: {method} | Alert: {alert_sent}")

        except Exception as exc:
            print(f"[error] {exc}", file=sys.stderr)

        time.sleep(CHECK_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
