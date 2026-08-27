#pragma once

#include <cstdint>

namespace FikkDevice {

enum class DeviceState : uint8_t {
  Ready = 0,
  Active = 1,
  Completed = 2,
  Error = 3,
};

enum class AckStatus : uint8_t {
  Accepted = 0,
  Rejected = 1,
  InvalidState = 2,
  InvalidPacket = 3,
  Unsupported = 4,
};

enum class CompletionReason : uint8_t {
  TargetReached = 1,
  Stopped = 2,
  DeviceError = 3,
};

enum class StopReason : uint8_t {
  User = 1,
  DeviceError = 2,
  Restart = 3,
};

enum class ErrorCode : uint16_t {
  InvalidPacket = 0x0001,
  InvalidState = 0x0002,
  UnsupportedVersion = 0x0003,
  InvalidTarget = 0x0004,
  ResultNotFound = 0x0005,
};

}  // namespace FikkDevice
