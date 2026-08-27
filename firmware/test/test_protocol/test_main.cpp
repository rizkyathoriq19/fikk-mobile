#include <unity.h>

#include <cstddef>
#include <cstdint>

#include "DeviceState.h"
#include "Protocol.h"

using namespace FikkDevice;
using namespace FikkProtocol;

namespace {

void assertEncodedBytes(const Packet& packet, const uint8_t* expected, size_t expectedLength) {
  uint8_t encoded[kMaxPacketSize] = {};
  size_t encodedLength = 0;
  DecodeError error = DecodeError::None;

  TEST_ASSERT_TRUE(encodePacket(packet, encoded, sizeof(encoded), encodedLength, error));
  TEST_ASSERT_EQUAL_UINT(static_cast<unsigned int>(expectedLength), static_cast<unsigned int>(encodedLength));
  TEST_ASSERT_EQUAL_UINT8_ARRAY(expected, encoded, expectedLength);
}

void assertRoundTrip(const Packet& packet) {
  uint8_t encoded[kMaxPacketSize] = {};
  size_t encodedLength = 0;
  DecodeError error = DecodeError::None;
  Packet decoded;

  TEST_ASSERT_TRUE(encodePacket(packet, encoded, sizeof(encoded), encodedLength, error));
  const DecodeResult result = decodePacket(encoded, encodedLength, decoded);
  TEST_ASSERT_TRUE(result.ok());
  TEST_ASSERT_EQUAL_UINT8(static_cast<uint8_t>(packet.messageType), static_cast<uint8_t>(decoded.messageType));
  TEST_ASSERT_EQUAL_UINT32(packet.sessionId, decoded.sessionId);
  TEST_ASSERT_EQUAL_UINT16(packet.sequence, decoded.sequence);
  TEST_ASSERT_EQUAL_UINT8(packet.payloadLength, decoded.payloadLength);
  TEST_ASSERT_EQUAL_UINT8_ARRAY(packet.payload.data(), decoded.payload.data(), packet.payloadLength);
}

void test_start_fixture() {
  const Packet packet = makeStart(0x01020304, 0x0506, 6);
  const uint8_t expected[] = {1, 1, 4, 3, 2, 1, 6, 5, 6};
  assertEncodedBytes(packet, expected, sizeof(expected));
  assertRoundTrip(packet);
}

void test_stop_fixture() {
  const Packet packet = makeStop(9, 10, 3);
  const uint8_t expected[] = {1, 2, 9, 0, 0, 0, 10, 0, 3};
  assertEncodedBytes(packet, expected, sizeof(expected));
  assertRoundTrip(packet);
}

void test_sync_fixture() {
  const Packet packet = makeSync(9, 11);
  const uint8_t expected[] = {1, 3, 9, 0, 0, 0, 11, 0};
  assertEncodedBytes(packet, expected, sizeof(expected));
  assertRoundTrip(packet);
}

void test_ack_result_fixture() {
  const Packet packet = makeAckResult(9, 12, 0xabcd);
  const uint8_t expected[] = {1, 4, 9, 0, 0, 0, 12, 0, 0xcd, 0xab};
  assertEncodedBytes(packet, expected, sizeof(expected));
  assertRoundTrip(packet);
}

void test_ack_fixture() {
  const Packet packet = makeAck(9, 13, MessageType::Start, AckStatus::Accepted);
  const uint8_t expected[] = {1, 0x81, 9, 0, 0, 0, 13, 0, 1, 0};
  assertEncodedBytes(packet, expected, sizeof(expected));
  assertRoundTrip(packet);
}

void test_progress_fixture() {
  const Packet packet = makeProgress(9, 14, 5, 0x01020304);
  const uint8_t expected[] = {1, 0x82, 9, 0, 0, 0, 14, 0, 5, 4, 3, 2, 1};
  assertEncodedBytes(packet, expected, sizeof(expected));
  assertRoundTrip(packet);
}

void test_complete_fixture() {
  const Packet packet = makeComplete(9, 15, 6, 0x05060708, CompletionReason::TargetReached);
  const uint8_t expected[] = {1, 0x83, 9, 0, 0, 0, 15, 0, 6, 8, 7, 6, 5, 1};
  assertEncodedBytes(packet, expected, sizeof(expected));
  assertRoundTrip(packet);
}

void test_state_fixture() {
  const Packet packet = makeState(9, 16, DeviceState::Completed, 6, 0x090a0b0c);
  const uint8_t expected[] = {1, 0x84, 9, 0, 0, 0, 16, 0, 2, 6, 12, 11, 10, 9};
  assertEncodedBytes(packet, expected, sizeof(expected));
  assertRoundTrip(packet);
}

void test_error_fixture() {
  const Packet packet = makeError(9, 17, 0xbeef);
  const uint8_t expected[] = {1, 0xff, 9, 0, 0, 0, 17, 0, 0xef, 0xbe};
  assertEncodedBytes(packet, expected, sizeof(expected));
  assertRoundTrip(packet);
}

void test_malformed_packets_are_rejected() {
  Packet decoded;
  const uint8_t shortPacket[] = {1, 1, 0, 0, 0, 0, 0};
  TEST_ASSERT_EQUAL(static_cast<int>(DecodeError::TooShort), static_cast<int>(decodePacket(shortPacket, sizeof(shortPacket), decoded).error));

  const uint8_t unknownType[] = {1, 0x55, 0, 0, 0, 0, 0, 0};
  TEST_ASSERT_EQUAL(static_cast<int>(DecodeError::UnknownMessageType), static_cast<int>(decodePacket(unknownType, sizeof(unknownType), decoded).error));

  const uint8_t wrongLength[] = {1, 3, 0, 0, 0, 0, 0, 0, 1};
  TEST_ASSERT_EQUAL(static_cast<int>(DecodeError::InvalidPayloadLength), static_cast<int>(decodePacket(wrongLength, sizeof(wrongLength), decoded).error));

  const uint8_t invalidState[] = {1, 0x84, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0, 0};
  TEST_ASSERT_EQUAL(static_cast<int>(DecodeError::InvalidPayload), static_cast<int>(decodePacket(invalidState, sizeof(invalidState), decoded).error));

  uint8_t oversized[kHeaderSize + 256] = {};
  oversized[0] = kProtocolVersion;
  oversized[1] = static_cast<uint8_t>(MessageType::Sync);
  TEST_ASSERT_EQUAL(static_cast<int>(DecodeError::InvalidPayloadLength), static_cast<int>(decodePacket(oversized, sizeof(oversized), decoded).error));

  const Packet invalidStart = makeStart(1, 1, 0);
  uint8_t encoded[kMaxPacketSize] = {};
  size_t encodedLength = 0;
  DecodeError error = DecodeError::None;
  TEST_ASSERT_FALSE(encodePacket(invalidStart, encoded, sizeof(encoded), encodedLength, error));
  TEST_ASSERT_EQUAL(static_cast<int>(DecodeError::InvalidPayload), static_cast<int>(error));
}

}  // namespace

void setup() {
  UNITY_BEGIN();
  RUN_TEST(test_start_fixture);
  RUN_TEST(test_stop_fixture);
  RUN_TEST(test_sync_fixture);
  RUN_TEST(test_ack_result_fixture);
  RUN_TEST(test_ack_fixture);
  RUN_TEST(test_progress_fixture);
  RUN_TEST(test_complete_fixture);
  RUN_TEST(test_state_fixture);
  RUN_TEST(test_error_fixture);
  RUN_TEST(test_malformed_packets_are_rejected);
  UNITY_END();
}

void loop() {}
