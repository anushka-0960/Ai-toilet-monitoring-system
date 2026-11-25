"""
Telegram alert sender (python-telegram-bot v20+ async style).

Provides a synchronous wrapper `send_alert()` so the urgency engine
can call it directly from its synchronous main loop.
"""

import asyncio
import sys
from datetime import datetime

from telegram import Bot

try:
    from config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
except ImportError:
    from .config import TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID  # type: ignore

TELEGRAM_TIMEOUT_SECONDS = 15


def format_alert(toilet_id: str, urgency: float, details: dict) -> str:
    """Build the human-readable alert message."""
    ammonia = details.get("ammonia_ppm", "n/a")
    bin_fill = details.get("bin_fill_percent", "n/a")
    hours = details.get("last_cleaned_hours_ago", "n/a")
    if isinstance(hours, (int, float)):
        hours = round(hours, 1)
    return (
        "🧹 Toilet {id} needs cleaning!\n"
        "Urgency: {urgency}/10\n"
        "Ammonia: {ammonia} ppm\n"
        "Bin: {bin} %\n"
        "Last cleaned: {hours}h ago"
    ).format(id=toilet_id, urgency=round(urgency, 1),
             ammonia=ammonia, bin=bin_fill, hours=hours)


async def _send_alert_async(message: str) -> None:
    bot = Bot(token=TELEGRAM_BOT_TOKEN)
    await bot.send_message(
        chat_id=TELEGRAM_CHAT_ID,
        text=message,
        disable_notification=False,
    )


def send_alert(toilet_id: str, urgency: float, details: dict) -> bool:
    """
    Synchronous wrapper: send one formatted alert message to Telegram.

    Returns True on success, False on failure (failure is logged, never raised).
    """
    message = format_alert(toilet_id, urgency, details)
    try:
        asyncio.run(_send_alert_async(message))
        print(f"[telegram] Alert sent for toilet {toilet_id}")
        return True
    except Exception as exc:  # network down, bad token, bad chat id ...
        print(f"[telegram] Failed to send alert: {exc}", file=sys.stderr)
        return False


if __name__ == "__main__":
    test_details = {
        "ammonia_ppm": 84.5,
        "bin_fill_percent": 91,
        "last_cleaned_hours_ago": 26.3,
        "_note": f"test message sent {datetime.now().isoformat()}",
    }
    ok = send_alert("toilet_01", 8.7, test_details)
    if ok:
        print("Test alert delivered — check your Telegram chat.")
    else:
        print("Test alert FAILED. Check TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID in config.py.")
