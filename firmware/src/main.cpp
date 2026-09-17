#include <Arduino.h>
#include <BLE2902.h>
#include <BLEAdvertising.h>
#include <BLECharacteristic.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEService.h>
#include <BLEUtils.h>
#include <LiquidCrystal_I2C.h>
#include <Wire.h>

#include <cstdio>
#include <cstring>
#include <string>

#include "BleProfile.h"
#include "DeviceState.h"
#include "InputDebouncer.h"
#include "Protocol.h"

using namespace FikkDevice;
using namespace FikkProtocol;

namespace {

constexpr uint8_t kDefaultTargetCount = 6;
constexpr uint8_t kIrSensorPin = 26;
constexpr uint8_t kStartButtonPin = 12;
constexpr uint8_t kLcdSclPin = 22;
constexpr uint8_t kLcdSdaPin = 21;
// ponytail: keep the common 20x4 backpack address configurable; scan if a board uses another address.
constexpr uint8_t kLcdAddress = 0x27;
// The timer is displayed with one-second precision; avoid overloading the LCD I2C bus.
constexpr uint32_t kDisplayRefreshMs = 1000;
constexpr uint8_t kLcdColumns = 20;
constexpr uint8_t kLcdRows = 4;
#if defined(FIKK_DEV_SIMULATION) && FIKK_DEV_SIMULATION
constexpr uint32_t kSimulationIntervalMs = 2000;
#endif

enum class TrainingMode : uint8_t {
  AndroidEsp,
  EspOnly,
};

class TrainingDevice;
TrainingDevice* g_trainingDevice = nullptr;

void logHex(const char* label, const uint8_t* data, size_t length) {
  Serial.print(label);
  Serial.print(" len=");
  Serial.print(static_cast<unsigned int>(length));
  Serial.print(" data=");
  const size_t boundedLength = length < kMaxPacketSize ? length : kMaxPacketSize;
  for (size_t index = 0; index < boundedLength; ++index) {
    if (data[index] < 0x10) {
      Serial.print('0');
    }
    Serial.print(data[index], HEX);
  }
  Serial.println();
}

class TrainingDevice {
 public:
  void begin();
  void loop();
  void handleControl(const uint8_t* data, size_t length);
  void handleSensorLevel(bool sensorActive, uint32_t nowMs);
  void onClientConnected();
  void onClientDisconnected();

 private:
  void handleCommand(const Packet& command);
  void handleStart(const Packet& command);
  void handleStop(const Packet& command);
  void handleSync(const Packet& command);
  void handleAckResult(const Packet& command);
  void handlePhysicalStart();
  void startEspOnlySession();
  void prepareSession(uint32_t sessionId, uint8_t targetCount, TrainingMode mode);
  void registerBallDetection();
  void completeSession(CompletionReason reason);
  void resetToReady();
  void updateDisplay();
  void writeLcdLine(uint8_t row, const char* text);
#if defined(FIKK_DEV_SIMULATION) && FIKK_DEV_SIMULATION
  void runDevelopmentSimulation();
#endif

  void sendAck(uint32_t sessionId, MessageType command, AckStatus status);
  void sendProgress();
  void sendComplete();
  void sendState();
  void sendError(uint32_t sessionId, uint16_t errorCode);
  void publishEvent(const Packet& packet);
  void publishStatePacket(const Packet& packet);
  uint16_t nextSequence();
  uint32_t nextEspOnlySessionId();
  uint32_t elapsedMs() const;
  uint16_t errorCodeFor(DecodeError error) const;

  BLEServer* server_ = nullptr;
  BLECharacteristic* controlCharacteristic_ = nullptr;
  BLECharacteristic* eventCharacteristic_ = nullptr;
  BLECharacteristic* stateCharacteristic_ = nullptr;
  BLECharacteristic* deviceInfoCharacteristic_ = nullptr;

  DeviceState deviceState_ = DeviceState::Ready;
  uint32_t sessionId_ = 0;
  uint16_t eventSequence_ = 0;
  uint16_t resultSequence_ = 0;
  uint8_t targetCount_ = kDefaultTargetCount;
  uint8_t count_ = 0;
  uint32_t startedAtMs_ = 0;
  uint32_t durationMs_ = 0;
  CompletionReason completionReason_ = CompletionReason::TargetReached;
  TrainingMode trainingMode_ = TrainingMode::AndroidEsp;
  uint32_t espOnlySessionId_ = 0;
  bool resultRetained_ = false;
  BallDetectionDebouncer inputDebouncer_;
  bool startButtonPressed_ = false;
  uint32_t lastDisplayAtMs_ = 0;
#if defined(FIKK_DEV_SIMULATION) && FIKK_DEV_SIMULATION
  uint32_t lastSimulationAtMs_ = 0;
#endif
  LiquidCrystal_I2C lcd_{kLcdAddress, kLcdColumns, kLcdRows};
};

class ServerCallbacks final : public BLEServerCallbacks {
 public:
  void onConnect(BLEServer*) override {
    Serial.println("BLE_CONNECTED");
    if (g_trainingDevice != nullptr) {
      g_trainingDevice->onClientConnected();
    }
  }

  void onDisconnect(BLEServer* server) override {
    Serial.println("BLE_DISCONNECTED");
    if (g_trainingDevice != nullptr) {
      g_trainingDevice->onClientDisconnected();
    }
    server->startAdvertising();
    Serial.println("BLE_ADVERTISING");
  }
};

class ControlCallbacks final : public BLECharacteristicCallbacks {
 public:
  void onWrite(BLECharacteristic* characteristic) override {
    const std::string value = characteristic->getValue();
    if (g_trainingDevice != nullptr) {
      g_trainingDevice->handleControl(
          reinterpret_cast<const uint8_t*>(value.data()), value.size());
    }
  }
};

void TrainingDevice::begin() {
  Serial.println("BOOT");
  pinMode(kIrSensorPin, INPUT);
  // GPIO12 is a strapping pin; use the documented external 3.3V pull resistor.
  pinMode(kStartButtonPin, INPUT);
  startButtonPressed_ = digitalRead(kStartButtonPin) == LOW;
  Wire.begin(kLcdSdaPin, kLcdSclPin);
  lcd_.init();
  lcd_.backlight();
  updateDisplay();

  BLEDevice::init(FikkBleProfile::kLocalName);
  Serial.println("BLE_INIT");

  server_ = BLEDevice::createServer();
  server_->setCallbacks(new ServerCallbacks());

  BLEService* service = server_->createService(FikkBleProfile::kServiceUuid);
  controlCharacteristic_ = service->createCharacteristic(
      FikkBleProfile::kControlUuid,
      BLECharacteristic::PROPERTY_WRITE);
  controlCharacteristic_->setCallbacks(new ControlCallbacks());

  eventCharacteristic_ = service->createCharacteristic(
      FikkBleProfile::kEventUuid,
      BLECharacteristic::PROPERTY_NOTIFY);
  eventCharacteristic_->addDescriptor(new BLE2902());

  stateCharacteristic_ = service->createCharacteristic(
      FikkBleProfile::kStateUuid,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  stateCharacteristic_->addDescriptor(new BLE2902());

  deviceInfoCharacteristic_ = service->createCharacteristic(
      FikkBleProfile::kDeviceInfoUuid,
      BLECharacteristic::PROPERTY_READ);
  const std::string deviceInfo =
      std::string("product=OVbAT;firmware=") + FikkBleProfile::kFirmwareVersion +
      ";protocol=" + FikkBleProfile::kProtocolVersion +
      ";board=" + FikkBleProfile::kBoardName +
      ";chip=" + FikkBleProfile::kUnknownChipModule +
      ";hardware_revision=" + FikkBleProfile::kUnknownHardwareRevision;
  deviceInfoCharacteristic_->setValue(deviceInfo);

  service->start();
  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(FikkBleProfile::kServiceUuid);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  Serial.println("BLE_ADVERTISING");

  sendState();
}

void TrainingDevice::loop() {
#if defined(FIKK_DEV_SIMULATION) && FIKK_DEV_SIMULATION
  runDevelopmentSimulation();
#else
  const uint32_t now = millis();
  const bool startButtonPressed = digitalRead(kStartButtonPin) == LOW;
  if (startButtonPressed && !startButtonPressed_) {
    handlePhysicalStart();
  }
  startButtonPressed_ = startButtonPressed;
  handleSensorLevel(digitalRead(kIrSensorPin) == HIGH, now);
  if (now - lastDisplayAtMs_ >= kDisplayRefreshMs) {
    updateDisplay();
  }
#endif
}

void TrainingDevice::onClientConnected() {
  Serial.println("BLE client connected; logical session preserved");
}

void TrainingDevice::onClientDisconnected() {
  Serial.println("BLE client disconnected; logical session preserved");
}

void TrainingDevice::handlePhysicalStart() {
  if (deviceState_ == DeviceState::Ready ||
      (deviceState_ == DeviceState::Completed && trainingMode_ == TrainingMode::EspOnly)) {
    startEspOnlySession();
    return;
  }

  if (deviceState_ != DeviceState::Armed) {
    return;
  }

  startedAtMs_ = millis();
  durationMs_ = 0;
  deviceState_ = DeviceState::Active;
  Serial.println("PHYSICAL_START");
  Serial.println("STATE_CHANGE ACTIVE");
  sendState();
  updateDisplay();
}

void TrainingDevice::startEspOnlySession() {
  prepareSession(nextEspOnlySessionId(), kDefaultTargetCount, TrainingMode::EspOnly);
  startedAtMs_ = millis();
  deviceState_ = DeviceState::Active;
  Serial.println("ESP_ONLY_START");
  Serial.println("STATE_CHANGE ACTIVE");
  sendState();
  updateDisplay();
}

void TrainingDevice::handleSensorLevel(bool sensorActive, uint32_t nowMs) {
  if (inputDebouncer_.update(sensorActive, nowMs)) {
    registerBallDetection();
  }
}

void TrainingDevice::handleControl(const uint8_t* data, size_t length) {
  logHex("CONTROL_RX", data, length);

  Packet command;
  const DecodeResult result = decodePacket(data, length, command);
  if (!result.ok()) {
    Serial.print("ERROR decode=");
    Serial.println(static_cast<unsigned int>(result.error));
    sendError(sessionId_, errorCodeFor(result.error));
    return;
  }

  handleCommand(command);
}

void TrainingDevice::handleCommand(const Packet& command) {
  switch (command.messageType) {
    case MessageType::Start:
      handleStart(command);
      return;
    case MessageType::Stop:
      handleStop(command);
      return;
    case MessageType::Sync:
      handleSync(command);
      return;
    case MessageType::AckResult:
      handleAckResult(command);
      return;
    default:
      sendError(command.sessionId, static_cast<uint16_t>(ErrorCode::InvalidPacket));
      return;
  }
}

void TrainingDevice::handleStart(const Packet& command) {
  const uint8_t requestedTarget = command.payload[0];
  if (command.sessionId == 0 || requestedTarget == 0) {
    sendAck(command.sessionId, MessageType::Start, AckStatus::InvalidPacket);
    sendError(command.sessionId, static_cast<uint16_t>(ErrorCode::InvalidTarget));
    return;
  }

  if ((deviceState_ == DeviceState::Armed || deviceState_ == DeviceState::Active) && command.sessionId == sessionId_) {
    sendAck(sessionId_, MessageType::Start, AckStatus::Accepted);
    return;
  }

  if (deviceState_ != DeviceState::Ready &&
      !(deviceState_ == DeviceState::Completed && trainingMode_ == TrainingMode::EspOnly)) {
    sendAck(command.sessionId, MessageType::Start, AckStatus::InvalidState);
    sendError(command.sessionId, static_cast<uint16_t>(ErrorCode::InvalidState));
    return;
  }

  prepareSession(command.sessionId, requestedTarget, TrainingMode::AndroidEsp);
  deviceState_ = DeviceState::Armed;

  Serial.println("START");
  Serial.println("STATE_CHANGE ARMED");
  sendAck(sessionId_, MessageType::Start, AckStatus::Accepted);
  sendState();
  updateDisplay();
}

void TrainingDevice::prepareSession(uint32_t sessionId, uint8_t targetCount, TrainingMode mode) {
  sessionId_ = sessionId;
  eventSequence_ = 0;
  resultSequence_ = 0;
  targetCount_ = targetCount;
  count_ = 0;
  startedAtMs_ = 0;
  durationMs_ = 0;
  trainingMode_ = mode;
  resultRetained_ = false;
}

void TrainingDevice::handleStop(const Packet& command) {
  if (deviceState_ != DeviceState::Active || command.sessionId != sessionId_) {
    sendAck(command.sessionId, MessageType::Stop, AckStatus::InvalidState);
    sendError(command.sessionId, static_cast<uint16_t>(ErrorCode::InvalidState));
    return;
  }

  Serial.println("STOP");
  sendAck(sessionId_, MessageType::Stop, AckStatus::Accepted);
  completeSession(CompletionReason::Stopped);
}

void TrainingDevice::handleSync(const Packet& command) {
  Serial.println("SYNC");
  sendAck(sessionId_ == 0 ? command.sessionId : sessionId_, MessageType::Sync, AckStatus::Accepted);
  sendState();
  if (deviceState_ == DeviceState::Completed && resultRetained_) {
    sendComplete();
  }
}

void TrainingDevice::handleAckResult(const Packet& command) {
  const uint16_t acknowledgedSequence = readUint16(command.payload.data());
  if (deviceState_ != DeviceState::Completed || !resultRetained_ ||
      command.sessionId != sessionId_ || acknowledgedSequence != resultSequence_) {
    sendAck(command.sessionId, MessageType::AckResult, AckStatus::Rejected);
    sendError(command.sessionId, static_cast<uint16_t>(ErrorCode::ResultNotFound));
    return;
  }

  Serial.println("ACK_RESULT");
  sendAck(sessionId_, MessageType::AckResult, AckStatus::Accepted);
  resetToReady();
}

void TrainingDevice::completeSession(CompletionReason reason) {
  durationMs_ = elapsedMs();
  completionReason_ = reason;
  deviceState_ = DeviceState::Completed;
  resultRetained_ = true;
  resultSequence_ = nextSequence();

  Serial.println("STATE_CHANGE COMPLETED");
  sendComplete();
  sendState();
  updateDisplay();
}

void TrainingDevice::resetToReady() {
  deviceState_ = DeviceState::Ready;
  sessionId_ = 0;
  eventSequence_ = 0;
  resultSequence_ = 0;
  targetCount_ = kDefaultTargetCount;
  count_ = 0;
  startedAtMs_ = 0;
  durationMs_ = 0;
  trainingMode_ = TrainingMode::AndroidEsp;
  resultRetained_ = false;
  Serial.println("STATE_CHANGE READY");
  sendState();
  updateDisplay();
}

void TrainingDevice::registerBallDetection() {
  if (deviceState_ != DeviceState::Active || count_ >= targetCount_) {
    return;
  }

  ++count_;
  Serial.println("BUZZER_FEEDBACK");
  Serial.println("LED_FEEDBACK");
  sendProgress();
  if (count_ >= targetCount_) {
    completeSession(CompletionReason::TargetReached);
  } else {
    sendState();
  }
  updateDisplay();
}

#if defined(FIKK_DEV_SIMULATION) && FIKK_DEV_SIMULATION
void TrainingDevice::runDevelopmentSimulation() {
  if (deviceState_ != DeviceState::Active) {
    return;
  }

  const uint32_t now = millis();
  if (now - lastSimulationAtMs_ < kSimulationIntervalMs) {
    return;
  }
  lastSimulationAtMs_ = now;

  if (count_ < targetCount_) {
    Serial.print("DEV SIMULATION count=");
    Serial.print(static_cast<unsigned int>(count_ + 1));
    Serial.print('/');
    Serial.println(static_cast<unsigned int>(targetCount_));
    registerBallDetection();
  }
}
#endif

void TrainingDevice::updateDisplay() {
  char line[21] = {};
  writeLcdLine(0, "OVbAT TRAINING");
  if (deviceState_ == DeviceState::Ready) {
    writeLcdLine(1, "Ready");
    writeLcdLine(2, "App START or button");
    writeLcdLine(3, "");
  } else if (deviceState_ == DeviceState::Armed) {
    writeLcdLine(1, "Press device btn");
    std::snprintf(line, sizeof(line), "Target: %u balls", targetCount_);
    writeLcdLine(2, line);
    writeLcdLine(3, "");
  } else if (deviceState_ == DeviceState::Active) {
    std::snprintf(line, sizeof(line), "Count: %u/%u", count_, targetCount_);
    writeLcdLine(1, line);
    const uint32_t elapsed = elapsedMs() / 1000;
    std::snprintf(line, sizeof(line), "Time: %02lu:%02lu", static_cast<unsigned long>(elapsed / 60), static_cast<unsigned long>(elapsed % 60));
    writeLcdLine(2, line);
    writeLcdLine(3, "Sensor: READY");
  } else if (deviceState_ == DeviceState::Completed) {
    writeLcdLine(1, trainingMode_ == TrainingMode::EspOnly ? "Done - press button" : "Completed");
    std::snprintf(line, sizeof(line), "Count: %u/%u", count_, targetCount_);
    writeLcdLine(2, line);
    const uint32_t duration = durationMs_ / 1000;
    std::snprintf(line, sizeof(line), "Time: %02lu:%02lu", static_cast<unsigned long>(duration / 60), static_cast<unsigned long>(duration % 60));
    writeLcdLine(3, line);
  } else {
    writeLcdLine(1, "Error");
    writeLcdLine(2, "Check device");
    writeLcdLine(3, "");
  }
  lastDisplayAtMs_ = millis();
}

void TrainingDevice::writeLcdLine(uint8_t row, const char* text) {
  lcd_.setCursor(0, row);
  lcd_.print(text);
  const size_t length = std::strlen(text);
  for (size_t index = length; index < kLcdColumns; ++index) {
    lcd_.print(' ');
  }
}

void TrainingDevice::sendAck(uint32_t sessionId, MessageType command, AckStatus status) {
  const Packet packet = makeAck(sessionId, nextSequence(), command, status);
  publishEvent(packet);
}

void TrainingDevice::sendProgress() {
  const Packet packet = makeProgress(sessionId_, nextSequence(), count_, elapsedMs());
  publishEvent(packet);
}

void TrainingDevice::sendComplete() {
  const Packet packet = makeComplete(
      sessionId_,
      resultSequence_,
      count_,
      durationMs_,
      completionReason_);
  publishEvent(packet);
}

void TrainingDevice::sendState() {
  const Packet packet = makeState(sessionId_, nextSequence(), deviceState_, count_, elapsedMs());
  publishStatePacket(packet);
}

void TrainingDevice::sendError(uint32_t sessionId, uint16_t errorCode) {
  Serial.println("ERROR");
  const Packet packet = makeError(sessionId, nextSequence(), errorCode);
  publishEvent(packet);
}

void TrainingDevice::publishEvent(const Packet& packet) {
  if (eventCharacteristic_ == nullptr) {
    return;
  }

  uint8_t encoded[kMaxPacketSize] = {};
  size_t encodedLength = 0;
  DecodeError error = DecodeError::None;
  if (!encodePacket(packet, encoded, sizeof(encoded), encodedLength, error)) {
    Serial.print("ERROR encode=");
    Serial.println(static_cast<unsigned int>(error));
    return;
  }

  eventCharacteristic_->setValue(encoded, encodedLength);
  eventCharacteristic_->notify();
  Serial.println("EVENT_TX");
  logHex("EVENT_TX", encoded, encodedLength);
}

void TrainingDevice::publishStatePacket(const Packet& packet) {
  if (stateCharacteristic_ == nullptr) {
    return;
  }

  uint8_t encoded[kMaxPacketSize] = {};
  size_t encodedLength = 0;
  DecodeError error = DecodeError::None;
  if (!encodePacket(packet, encoded, sizeof(encoded), encodedLength, error)) {
    Serial.print("ERROR encode=");
    Serial.println(static_cast<unsigned int>(error));
    return;
  }

  publishEvent(packet);
  stateCharacteristic_->setValue(encoded, encodedLength);
  stateCharacteristic_->notify();
}

uint16_t TrainingDevice::nextSequence() {
  if (eventSequence_ == 0xffff) {
    eventSequence_ = 0;
  } else {
    ++eventSequence_;
  }
  return eventSequence_;
}

uint32_t TrainingDevice::nextEspOnlySessionId() {
  ++espOnlySessionId_;
  if (espOnlySessionId_ == 0) {
    ++espOnlySessionId_;
  }
  return espOnlySessionId_;
}

uint32_t TrainingDevice::elapsedMs() const {
  if (deviceState_ == DeviceState::Active) {
    return millis() - startedAtMs_;
  }
  return durationMs_;
}

uint16_t TrainingDevice::errorCodeFor(DecodeError error) const {
  switch (error) {
    case DecodeError::UnsupportedVersion:
      return static_cast<uint16_t>(ErrorCode::UnsupportedVersion);
    case DecodeError::InvalidPayload:
      return static_cast<uint16_t>(ErrorCode::InvalidPacket);
    case DecodeError::None:
      return 0;
    default:
      return static_cast<uint16_t>(ErrorCode::InvalidPacket);
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  delay(100);
  static TrainingDevice device;
  g_trainingDevice = &device;
  device.begin();
}

void loop() {
  if (g_trainingDevice != nullptr) {
    g_trainingDevice->loop();
  }
  delay(1);
}
