"""
ML training script for the AI Smart Public Toilet Monitoring System.

Reads all records from /toilets/toilet_01/history, computes the rule-based
score as the target label, trains a RandomForestRegressor, prints MAE and
feature importances, and saves the model to urgency_model.joblib.

Run AFTER the ESP32 has accumulated some history (at least ~50 records is
recommended for a meaningful split).
"""

import json
import os
import sys
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, db
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

try:
    from config import FIREBASE_CRED_PATH, FIREBASE_DB_URL, TOILET_ID
except ImportError:
    from .config import FIREBASE_CRED_PATH, FIREBASE_DB_URL, TOILET_ID  # type: ignore

MODEL_PATH = os.path.join(os.path.dirname(__file__), "urgency_model.joblib")


def compute_urgency_rule(ammonia: float, usage: int, bin_fill: float) -> float:
    urgency = (
        (ammonia / 100.0) * 0.5
        + (min(usage, 20) / 20.0) * 0.3
        + (bin_fill / 100.0) * 0.2
    )
    return max(0.0, min(10.0, urgency))


def main() -> None:
    if not os.path.exists(FIREBASE_CRED_PATH):
        print(f"ERROR: service account key not found at '{FIREBASE_CRED_PATH}'.")
        sys.exit(1)
    if FIREBASE_DB_URL.startswith("https://YOUR_PROJECT"):
        print("ERROR: fill in FIREBASE_DB_URL in config.py first.")
        sys.exit(1)

    cred = credentials.Certificate(FIREBASE_CRED_PATH)
    firebase_admin.initialize_app(cred, {"databaseURL": FIREBASE_DB_URL})

    print("Downloading history from Firebase ...")
    history = db.ref(f"/toilets/{TOILET_ID}/history").get()
    if not history:
        print(f"No history found at /toilets/{TOILET_ID}/history. "
              "Run the ESP32 node first to accumulate data.")
        sys.exit(1)

    # Flatten Firebase push records
    records = []
    if isinstance(history, list):
        items = [(i, r) for i, r in enumerate(history) if r]
    else:
        items = list(history.items())

    for _, record in items:
        if not isinstance(record, dict):
            continue
        records.append({
            "ammonia_ppm": float(record.get("ammonia_ppm", 0) or 0),
            "usage_count": int(record.get("usage_count", 0) or 0),
            "bin_fill_percent": float(record.get("bin_fill_percent", 0) or 0),
            "timestamp": float(record.get("timestamp", 0) or 0),
        })

    df = pd.DataFrame(records).sort_values("timestamp").reset_index(drop=True)
    print(f"Loaded {len(df)} history records")

    # Feature: last_cleaned_hours_ago — approximate from timestamp gaps.
    # usage_count resets on cleaning, so a drop in usage_count marks a clean;
    # fall back to a 24 h cap when no reset is visible.
    now_epoch = datetime.now(timezone.utc).timestamp()
    hours_ago_cleaned = []
    last_reset_ts = None
    for _, row in df.iterrows():
        if last_reset_ts is None:
            hours_ago_cleaned.append(min(24.0, (row["timestamp"] - df["timestamp"].iloc[0]) / 3600.0))
        else:
            hours_ago_cleaned.append(min(24.0, (row["timestamp"] - last_reset_ts) / 3600.0))
        # Detect a cleaning event: usage count went DOWN compared to previous row
        if len(hours_ago_cleaned) > 1 and row["usage_count"] < df["usage_count"].iloc[len(hours_ago_cleaned) - 2]:
            last_reset_ts = row["timestamp"]
    df["last_cleaned_hours_ago"] = hours_ago_cleaned

    df["hour_of_day"] = pd.to_datetime(df["timestamp"], unit="s").dt.hour

    # Target label: rule-based score
    df["urgency"] = df.apply(
        lambda r: compute_urgency_rule(r["ammonia_ppm"], r["usage_count"], r["bin_fill_percent"]),
        axis=1,
    )

    features = ["ammonia_ppm", "usage_count", "bin_fill_percent",
                "last_cleaned_hours_ago", "hour_of_day"]
    X = df[features]
    y = df["urgency"]

    test_size = 0.2 if len(df) >= 10 else 0.25
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=42
    )

    model = RandomForestRegressor(n_estimators=100, max_depth=5, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    print(f"\nMAE: {mae:.3f}")
    print("\nFeature importances:")
    for name, importance in sorted(zip(features, model.feature_importances_),
                                   key=lambda t: -t[1]):
        print(f"  {name:24s} {importance:.3f}")

    joblib.dump(model, MODEL_PATH)
    print(f"\nModel saved to {MODEL_PATH}")


if __name__ == "__main__":
    main()
