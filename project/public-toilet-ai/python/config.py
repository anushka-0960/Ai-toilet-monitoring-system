"""
Central configuration for the AI Smart Public Toilet Monitoring System.

Fill in the placeholders below before running anything:
  1. FIREBASE_CRED_PATH - path to the service account key JSON you
     downloaded from Firebase Console > Project Settings > Service Accounts.
  2. FIREBASE_DB_URL   - your Realtime Database URL
     (Firebase Console > Realtime Database > copy the URL).
  3. TELEGRAM_BOT_TOKEN - token from @BotFather when you create the bot.
  4. TELEGRAM_CHAT_ID   - your chat id (send a message to your bot, then
     check https://api.telegram.org/bot<TOKEN>/getUpdates).
"""

import os

# ------------------------------------------------------------------
# Firebase Admin SDK
# ------------------------------------------------------------------
# Download the service account key JSON from:
#   Firebase Console > Project Settings > Service accounts > Generate new private key
# Place it next to this file (or update the path) and NEVER commit it.
FIREBASE_CRED_PATH = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")

# Firebase Console > Realtime Database > copy the URL, e.g.
# "https://my-toilet-project-default-rtdb.firebaseio.com"
FIREBASE_DB_URL = "https://YOUR_PROJECT-default-rtdb.firebaseio.com"

# ------------------------------------------------------------------
# Telegram alerting
# ------------------------------------------------------------------
# 1. Create a bot with @BotFather -> /newbot -> copy the token.
TELEGRAM_BOT_TOKEN = "YOUR_BOT_TOKEN"

# 2. Message your bot once, then GET
#    https://api.telegram.org/bot<TOKEN>/getUpdates and copy "chat":{"id": ...}
TELEGRAM_CHAT_ID = "YOUR_CHAT_ID"

# ------------------------------------------------------------------
# Behaviour
# ------------------------------------------------------------------
TOILET_ID = "toilet_01"

# Urgency score above which a Telegram alert is sent (0-10 scale).
URGENCY_THRESHOLD = 7.0

# How often the urgency engine polls Firebase, in seconds.
CHECK_INTERVAL_SECONDS = 300

# Minimum seconds between consecutive alerts (30 minutes).
ALERT_COOLDOWN_SECONDS = 30 * 60
