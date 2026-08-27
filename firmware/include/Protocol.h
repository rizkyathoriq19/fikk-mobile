#pragma once

#include <array>
#include <cstddef>
#include <cstdint>

#include "DeviceState.h"

namespace FikkProtocol {

constexpr uint8_t kProtocolVersion = 0x01;
constexpr size_t kHeaderSize = 8;
constexpr size_t kMaxPayloadSize = 6;
constexpr size_t kMaxPacketSize = kHeaderSize + kMaxPayloadSize;

using FikkDevice::AckStatus;
using FikkDevice::CompletionReason;
using FikkDevice::DeviceState;

enum class MessageType : uint8_t {
  Start = 0x01,
  Stop = 0x02,
  Sync = 0x03,
  AckResult = 0x04,
  Ack = 0x81,
  Progress = 0x82,
  Complete = 0x83,
  State = 0x84,
  Error = 0xff,
};

enum class DecodeError : uint8_t {
  None = 0,
  NullData,
  TooShort,
  UnsupportedVersion,
  UnknownMessageType,
  InvalidPayloadLength,
  InvalidPayload,
  OutputTooSmall,
};

struct Packet {
  uint8_t version = kProtocolVersion;
  MessageType messageType = MessageType::Sync;
  uint32_t sessionId = 0;
  uint16_t sequence = 0;
  uint8_t payloadLength = 0;
  std::array<uint8_t, kMaxPayloadSize> payload = {};
};

struct DecodeResult {
  DecodeError error;

  DecodeResult(DecodeError value = DecodeError::None) : error(value) {}

  bool ok() const { return error == DecodeError::None; }
};

inline bool isKnownMessageType(uint8_t value) {
  switch (static_cast<MessageType>(value)) {
    case MessageType::Start:
    case MessageType::Stop:
    case MessageType::Sync:
    case MessageType::AckResult:
    case MessageType::Ack:
    case MessageType::Progress:
    case MessageType::Complete:
    case MessageType::State:
    case MessageType::Error:
      return true;
  }
  return false;
}

inline int expectedPayloadLength(MessageType messageType) {
  switch (messageType) {
    case MessageType::Start:
    case MessageType::Stop:
      return 1;
    case MessageType::Sync:
      return 0;
    case MessageType::AckResult:
    case MessageType::Ack:
    case MessageType::Error:
      return 2;
    case MessageType::Progress:
    case MessageType::Complete:
    case MessageType::State:
      return messageType == MessageType::Progress ? 5 : 6;
  }
  return -1;
}

inline bool isValidPayload(const Packet& packet) {
  if (packet.payloadLength > kMaxPayloadSize) {
    return false;
  }

  switch (packet.messageType) {
    case MessageType::Start:
      return packet.payloadLength == 1 && packet.payload[0] > 0;
    case MessageType::State:
      return packet.payloadLength == 6 && packet.payload[0] <= static_cast<uint8_t>(DeviceState::Error);
    default:
      return true;
  }
}

inline void writeUint16(uint8_t* destination, uint16_t value) {
  destination[0] = static_cast<uint8_t>(value & 0xff);
  destination[1] = static_cast<uint8_t>((value >> 8) & 0xff);
}

inline void writeUint32(uint8_t* destination, uint32_t value) {
  destination[0] = static_cast<uint8_t>(value & 0xff);
  destination[1] = static_cast<uint8_t>((value >> 8) & 0xff);
  destination[2] = static_cast<uint8_t>((value >> 16) & 0xff);
  destination[3] = static_cast<uint8_t>((value >> 24) & 0xff);
}

inline uint16_t readUint16(const uint8_t* source) {
  return static_cast<uint16_t>(source[0]) | static_cast<uint16_t>(source[1] << 8);
}

inline uint32_t readUint32(const uint8_t* source) {
  return static_cast<uint32_t>(source[0]) |
         (static_cast<uint32_t>(source[1]) << 8) |
         (static_cast<uint32_t>(source[2]) << 16) |
         (static_cast<uint32_t>(source[3]) << 24);
}

inline bool encodePacket(
    const Packet& packet,
    uint8_t* output,
    size_t outputCapacity,
    size_t& outputLength,
    DecodeError& error) {
  outputLength = 0;
  error = DecodeError::None;

  if (output == nullptr) {
    error = DecodeError::NullData;
    return false;
  }
  if (packet.version != kProtocolVersion) {
    error = DecodeError::UnsupportedVersion;
    return false;
  }
  if (!isKnownMessageType(static_cast<uint8_t>(packet.messageType))) {
    error = DecodeError::UnknownMessageType;
    return false;
  }
  const int expectedLength = expectedPayloadLength(packet.messageType);
  if (expectedLength < 0 || packet.payloadLength != static_cast<uint8_t>(expectedLength)) {
    error = DecodeError::InvalidPayloadLength;
    return false;
  }
  if (!isValidPayload(packet)) {
    error = DecodeError::InvalidPayload;
    return false;
  }

  const size_t totalLength = kHeaderSize + packet.payloadLength;
  if (outputCapacity < totalLength) {
    error = DecodeError::OutputTooSmall;
    return false;
  }

  output[0] = kProtocolVersion;
  output[1] = static_cast<uint8_t>(packet.messageType);
  writeUint32(output + 2, packet.sessionId);
  writeUint16(output + 6, packet.sequence);
  for (size_t index = 0; index < packet.payloadLength; ++index) {
    output[kHeaderSize + index] = packet.payload[index];
  }
  outputLength = totalLength;
  return true;
}

inline DecodeResult decodePacket(const uint8_t* input, size_t inputLength, Packet& output) {
  if (input == nullptr) {
    return {DecodeError::NullData};
  }
  if (inputLength < kHeaderSize) {
    return {DecodeError::TooShort};
  }
  if (input[0] != kProtocolVersion) {
    return {DecodeError::UnsupportedVersion};
  }
  if (!isKnownMessageType(input[1])) {
    return {DecodeError::UnknownMessageType};
  }

  Packet decoded;
  decoded.version = input[0];
  decoded.messageType = static_cast<MessageType>(input[1]);
  decoded.sessionId = readUint32(input + 2);
  decoded.sequence = readUint16(input + 6);
  const size_t payloadLength = inputLength - kHeaderSize;
  if (payloadLength > kMaxPayloadSize) {
    return {DecodeError::InvalidPayloadLength};
  }
  decoded.payloadLength = static_cast<uint8_t>(payloadLength);

  const int expectedLength = expectedPayloadLength(decoded.messageType);
  if (expectedLength < 0 || decoded.payloadLength != static_cast<uint8_t>(expectedLength)) {
    return {DecodeError::InvalidPayloadLength};
  }
  for (size_t index = 0; index < decoded.payloadLength; ++index) {
    decoded.payload[index] = input[kHeaderSize + index];
  }
  if (!isValidPayload(decoded)) {
    return {DecodeError::InvalidPayload};
  }

  output = decoded;
  return {DecodeError::None};
}

inline Packet makeBasePacket(MessageType messageType, uint32_t sessionId, uint16_t sequence) {
  Packet packet;
  packet.messageType = messageType;
  packet.sessionId = sessionId;
  packet.sequence = sequence;
  return packet;
}

inline Packet makeStart(uint32_t sessionId, uint16_t sequence, uint8_t targetCount) {
  Packet packet = makeBasePacket(MessageType::Start, sessionId, sequence);
  packet.payloadLength = 1;
  packet.payload[0] = targetCount;
  return packet;
}

inline Packet makeStop(uint32_t sessionId, uint16_t sequence, uint8_t reason) {
  Packet packet = makeBasePacket(MessageType::Stop, sessionId, sequence);
  packet.payloadLength = 1;
  packet.payload[0] = reason;
  return packet;
}

inline Packet makeSync(uint32_t sessionId, uint16_t sequence) {
  return makeBasePacket(MessageType::Sync, sessionId, sequence);
}

inline Packet makeAckResult(uint32_t sessionId, uint16_t sequence, uint16_t resultSequence) {
  Packet packet = makeBasePacket(MessageType::AckResult, sessionId, sequence);
  packet.payloadLength = 2;
  writeUint16(packet.payload.data(), resultSequence);
  return packet;
}

inline Packet makeAck(uint32_t sessionId, uint16_t sequence, MessageType command, AckStatus status) {
  Packet packet = makeBasePacket(MessageType::Ack, sessionId, sequence);
  packet.payloadLength = 2;
  packet.payload[0] = static_cast<uint8_t>(command);
  packet.payload[1] = static_cast<uint8_t>(status);
  return packet;
}

inline Packet makeProgress(uint32_t sessionId, uint16_t sequence, uint8_t count, uint32_t elapsedMs) {
  Packet packet = makeBasePacket(MessageType::Progress, sessionId, sequence);
  packet.payloadLength = 5;
  packet.payload[0] = count;
  writeUint32(packet.payload.data() + 1, elapsedMs);
  return packet;
}

inline Packet makeComplete(
    uint32_t sessionId,
    uint16_t sequence,
    uint8_t count,
    uint32_t durationMs,
    CompletionReason reason) {
  Packet packet = makeBasePacket(MessageType::Complete, sessionId, sequence);
  packet.payloadLength = 6;
  packet.payload[0] = count;
  writeUint32(packet.payload.data() + 1, durationMs);
  packet.payload[5] = static_cast<uint8_t>(reason);
  return packet;
}

inline Packet makeState(uint32_t sessionId, uint16_t sequence, DeviceState state, uint8_t count, uint32_t elapsedMs) {
  Packet packet = makeBasePacket(MessageType::State, sessionId, sequence);
  packet.payloadLength = 6;
  packet.payload[0] = static_cast<uint8_t>(state);
  packet.payload[1] = count;
  writeUint32(packet.payload.data() + 2, elapsedMs);
  return packet;
}

inline Packet makeError(uint32_t sessionId, uint16_t sequence, uint16_t errorCode) {
  Packet packet = makeBasePacket(MessageType::Error, sessionId, sequence);
  packet.payloadLength = 2;
  writeUint16(packet.payload.data(), errorCode);
  return packet;
}

}  // namespace FikkProtocol
