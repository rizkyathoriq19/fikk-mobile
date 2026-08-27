#pragma once

#include <cstdint>

namespace FikkDevice {

class BallDetectionDebouncer {
 public:
  explicit BallDetectionDebouncer(uint32_t debounceMs = 100) : debounceMs_(debounceMs) {}

  bool update(bool sensorActive, uint32_t nowMs) {
    if (!sensorActive) {
      sensorWasActive_ = false;
      return false;
    }
    if (sensorWasActive_) {
      return false;
    }
    sensorWasActive_ = true;
    if (hasAcceptedDetection_ && nowMs - lastAcceptedAtMs_ < debounceMs_) {
      return false;
    }
    hasAcceptedDetection_ = true;
    lastAcceptedAtMs_ = nowMs;
    return true;
  }

 private:
  uint32_t debounceMs_;
  uint32_t lastAcceptedAtMs_ = 0;
  bool sensorWasActive_ = false;
  bool hasAcceptedDetection_ = false;
};

}  // namespace FikkDevice
