# 🚻 AI Smart Public Toilet Monitoring System

An end-to-end IoT pipeline that monitors a public toilet, computes a
**0–10 cleaning urgency score** with AI (rule-based + Random Forest),
sends **Telegram alerts** to cleaners, and shows everything on a
**real-time web dashboard** with a "Mark as Cleaned" action.

## Architecture

```
 ┌──────────────────────┐        ┌───────────────────────────────┐
 │  ESP32 + Sensors     │        │  Firebase Realtime Database   │
 │  ─────────────────   │  WiFi  │  ───────────────────────────  │
 │  MQ-135  (ammonia)   │ ─────► │  /toilets/toilet_01/latest    │
 │  PIR     (motion)    │ every  │  /toilets/toilet_01/history   │
 │  Float   (water)     │ 30 s   │  /toilets/toilet_01/last_     │
 │  HC-SR04 (bin level) │        │      cleaned / last_alert_    │
 └──────────────────────┘        │      sent                     │
                                 └───────┬──────────────┬────────┘
                                         │              │
                        reads / writes   │              │  real-time
                                         ▼              ▼
                        ┌──────────────────────┐  ┌────────────────────┐
                        │  Python Urgency      │  │  Web Dashboard     │
                        │  Engine              │  │  (index.html)      │
                        │  ──────────────────  │  │  ───────────────── │
                        │  score = ML or rule  │  │  live status card  │
                        │  urgency > 7 ?       │  │  4 metric cards    │
                        │    → Telegram alert  │  │  ammonia chart     │
                        └──────────┬───────────┘  │  Mark as Cleaned   │
                                   │              └────────────────────┘
                                   ▼
                        ┌──────────────────────┐
                        │  Telegram Bot API    │
                        │  "Toilet needs       │
                        │   cleaning!"         │
                        └──────────────────────┘
```

## Project Structure

```
public-toilet-ai/
├── esp32/
│   └── toilet_sensor.ino       # ESP32 firmware: reads sensors → Firebase
├── python/
│   ├── config.py               # Central configuration (fill in credentials)
│   ├── urgency_engine.py       # Main loop: score + alert
│   ├── train_model.py          # Trains Random Forest from history
│   └── telegram_alert.py       # Telegram alert sender
├── dashboard/
│   └── index.html              # Real-time web dashboard
├── requirements.txt            # Python dependencies
├── README.md
└── .gitignore
```

## Setup

### 1. Firebase Project

1. Go to https://console.firebase.google.com and click **Add project**.
2. In the console: **Build → Realtime Database → Create Database** (start in
   test mode while experimenting, then lock rules down later).
3. Copy the database URL — it looks like
   `https://YOUR_PROJECT-default-rtdb.firebaseio.com`.
4. **Service account key (for the Python engine):**
   Project Settings → Service accounts → **Generate new private key**.
   Save the downloaded JSON as `public-toilet-ai/python/serviceAccountKey.json`.
5. **Web app config (for the dashboard):**
   Project Settings → General → Your apps → **Web app (</>)** → copy the
   `firebaseConfig` values into the dashboard's `firebaseConfig` object.
6. **Anonymous sign-in (for ESP32):**
   Authentication → Sign-in method → enable **Anonymous**.

### 2. Telegram Bot

1. In Telegram, message **@BotFather** → send `/newbot` → follow the prompts.
2. Copy the bot token (looks like `123456789:AAE...`).
3. Send any message to your new bot, then open:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
   and find `"chat":{"id": ...}` — that number is your chat id.
4. Put the token and chat id into `python/config.py`.

### 3. ESP32 Firmware

1. Arduino IDE → **Tools → Board** → install ESP32 board support
   (Boards Manager → "esp32 by Espressif").
2. **Library Manager** → install
   **"Firebase Arduino Client Library for ESP8266 and ESP32"** (by Mobizt).
3. Open `esp32/toilet_sensor.ino` and fill in:
   - `WIFI_SSID`, `WIFI_PASSWORD`
   - `API_KEY` (Firebase → Project Settings → General → Web API key)
   - `DATABASE_URL`
4. Wire the sensors:

   | Sensor      | Pin        |
   |-------------|------------|
   | MQ-135 AO   | GPIO 34    |
   | PIR OUT     | GPIO 27    |
   | Float switch| GPIO 26    |
   | HC-SR04 TRIG| GPIO 25    |
   | HC-SR04 ECHO| GPIO 33    |
   | All GND/VCC | GND / 5V*  |

   \* HC-SR04 ECHO outputs 5 V — use a voltage divider (1 kΩ / 2 kΩ) to
   protect the 3.3 V GPIO pin.

5. Upload the sketch and open the Serial Monitor at **115200 baud**.

### 4. Python Environment

```bash
cd public-toilet-ai
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Fill in `python/config.py` with your Firebase and Telegram credentials.

## Running

```bash
# 1. (Optional) Train the ML model once some history exists
#    The rule-based engine works fine without it.
python python/train_model.py

# 2. Start the urgency engine (keep it running, e.g. in tmux/screen)
python python/urgency_engine.py

# 3. Open the dashboard
python -m http.server --directory dashboard 8000
#    → http://localhost:8000

# 4. Power the ESP32 — it starts pushing sensor data every 30 s
```

Test Telegram alone:

```bash
python python/telegram_alert.py
```

## Urgency Score

| Score  | Meaning                            |
|--------|------------------------------------|
| 0–3.9  | 🟢 Clean — no action needed        |
| 4–7    | 🟡 Getting dirty — plan a clean    |
| > 7    | 🔴 Cleaning required — alert sent  |

**Rule-based** (used until a model is trained):

```
urgency = (ammonia/100)*0.5 + (min(usage,20)/20)*0.3 + (bin_fill/100)*0.2
```

**ML model** — a `RandomForestRegressor` trained on your own history with
the rule-based score as the label, adding two extra features the rule can't
use: `last_cleaned_hours_ago` and `hour_of_day`. Retrain periodically:

```bash
python python/train_model.py
```

## Security Notes

- `serviceAccountKey.json` and any downloaded key files are git-ignored —
  never commit them.
- Before going to production, replace the Realtime Database test-mode rules
  with real ones (at minimum: public read, authenticated write).
- Add a GitHub Actions cron job or a systemd timer to keep
  `urgency_engine.py` running around the clock.
