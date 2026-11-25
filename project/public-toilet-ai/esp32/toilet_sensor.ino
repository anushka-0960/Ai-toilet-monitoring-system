/*
 * AI Smart Public Toilet Monitoring System - ESP32 Sensor Node
 *
 * Reads 4 sensors and pushes JSON to Firebase Realtime Database
 * every 30 seconds:
 *   - MQ-135 ammonia sensor  (analog, GPIO 34)
 *   - PIR motion sensor      (digital, GPIO 27)
 *   - Float switch (water)   (digital, GPIO 26)
 *   - HC-SR04 bin level      (TRIG GPIO 25, ECHO GPIO 33)
 *
 * Library: Firebase_ESP_Client (Firebase-ESP-Client by Mobizt)
 * Install via Arduino Library Manager: "Firebase Arduino Client Library for ESP8266 and ESP32"
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
// Provide the token generation process info and token signing/decryption helpers
#include "addons/TokenHelper.h"
#include "addons/RTDBHelper.h"

// ======================= WiFi Credentials =======================
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// ===================== Firebase Configuration ===================
#define API_KEY       "YOUR_FIREBASE_WEB_API_KEY"
#define DATABASE_URL  "https://YOUR_PROJECT-default-rtdb.firebaseio.com"

// ========================== Sensor Pins =========================
#define MQ135_PIN     34   // MQ-135 ammonia, analog input (ADC1_CH6)
#define PIR_PIN       27   // PIR motion, digital input
#define FLOAT_PIN     26   // Float switch water level, digital input
#define TRIG_PIN      25   // HC-SR04 trigger, digital output
#define ECHO_PIN      33   // HC-SR04 echo, digital input

// ========================== Constants ===========================
const unsigned long PUSH_INTERVAL_MS = 30000UL;  // publish every 30 seconds
const float BIN_DEPTH_CM             = 50.0;     // assumed bin depth
const unsigned long SERIAL_BAUD      = 115200;

// ====================== Firebase Objects ========================
FirebaseData    fbdo;
FirebaseAuth    auth;
FirebaseConfig  config;

// ========================= State ================================
unsigned long lastPushMs     = 0;
bool          firebaseReady  = false;
int           usageCount     = 0;
int           lastPirState   = LOW;

// ---------------------------------------------------------------
// MQ-135: map raw ADC (0-4095, 0-3.3V) to 0-100 ppm linearly.
// TODO: perform R0 calibration in clean air (measure sensor
// resistance in clean air, compute ratio Rs/R0, and use the MQ-135
// datasheet curve for an accurate ppm conversion).
// ---------------------------------------------------------------
float readAmmoniaPpm() {
  int raw = analogRead(MQ135_PIN);
  float voltage = (raw / 4095.0) * 3.3;
  // Linear approximation: 3.3V ~ 100 ppm
  float ppm = (voltage / 3.3) * 100.0;
  if (ppm < 0.0)   ppm = 0.0;
  if (ppm > 100.0) ppm = 100.0;
  return ppm;
}

// ---------------------------------------------------------------
// HC-SR04: measure distance, convert to bin fill percentage
// assuming bin depth of 50 cm.
// ---------------------------------------------------------------
float readBinFillPercent() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // 30 s timeout in microseconds is over-generous; use 30 ms
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) {
    Serial.println("[HC-SR04] No echo (timeout), assuming empty bin");
    return 0.0;
  }
  float distanceCm = (duration * 0.0343) / 2.0;
  float fillPercent = ((BIN_DEPTH_CM - distanceCm) / BIN_DEPTH_CM) * 100.0;
  if (fillPercent < 0.0)   fillPercent = 0.0;
  if (fillPercent > 100.0) fillPercent = 100.0;
  return fillPercent;
}

String readWaterLevel() {
  // Float switch: LOW = water present (OK), HIGH = floating up (LOW level)
  return digitalRead(FLOAT_PIN) == LOW ? "OK" : "LOW";
}

void connectWiFi() {
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();
  Serial.printf("[WiFi] Connected, IP: %s\n", WiFi.localIP().toString().c_str());
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(1000);

  pinMode(PIR_PIN, INPUT);
  pinMode(FLOAT_PIN, INPUT_PULLUP);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  connectWiFi();

  // Anonymous sign-up (empty email/password). Enable Anonymous
  // sign-in in Firebase Console > Authentication > Sign-in method.
  config.api_key = API_KEY;
  config.database_url = DATABASE_URL;
  config.token_status_callback = tokenStatusCallback;
  config.signer.tokens.legacy_token = "";  // use OAuth2.0 token flow

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("[Firebase] Anonymous sign-up OK");
    firebaseReady = true;
  } else {
    Serial.printf("[Firebase] Sign-up failed: %s\n", config.signer.signupError.message.c_str());
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);
  fbdo.setResponseSize(2048);
}

void loop() {
  // ---- PIR: increment usage_count on LOW -> HIGH transition only ----
  int pirState = digitalRead(PIR_PIN);
  if (pirState == HIGH && lastPirState == LOW) {
    usageCount++;
    Serial.printf("[PIR] Motion detected, usage_count = %d\n", usageCount);
  }
  lastPirState = pirState;

  // ---- Publish every PUSH_INTERVAL_MS ----
  unsigned long now = millis();
  if (now - lastPushMs >= PUSH_INTERVAL_MS) {
    lastPushMs = now;

    if (Firebase.ready() && firebaseReady) {
      float ammoniaPpm = readAmmoniaPpm();
      float binFill    = readBinFillPercent();
      String waterLvl  = readWaterLevel();
      long   epoch     = (long)time(nullptr);

      Serial.println("----------------------------------------");
      Serial.printf("[Sensors] Ammonia: %.1f ppm | Usage: %d | Water: %s | Bin: %.0f%%\n",
                    ammoniaPpm, usageCount, waterLvl.c_str(), binFill);

      // ---- Write to /toilets/toilet_01/latest ----
      FirebaseJson json;
      json.set("ammonia_ppm", ammoniaPpm);
      json.set("usage_count", usageCount);
      json.set("water_level", waterLvl);
      json.set("bin_fill_percent", (int)binFill);
      json.set("timestamp", epoch);

      if (Firebase.RTDB.setJSON(&fbdo, "/toilets/toilet_01/latest", &json)) {
        Serial.println("[RTDB] latest: OK");
      } else {
        Serial.printf("[RTDB] latest FAILED: %s\n", fbdo.errorReason().c_str());
      }

      // ---- Append a copy to /toilets/toilet_01/history (push) ----
      if (Firebase.RTDB.pushJSON(&fbdo, "/toilets/toilet_01/history", &json)) {
        Serial.println("[RTDB] history: pushed");
      } else {
        Serial.printf("[RTDB] history FAILED: %s\n", fbdo.errorReason().c_str());
      }
    } else {
      Serial.println("[Firebase] Not ready, skipping publish");
    }
  }

  delay(50);
}
