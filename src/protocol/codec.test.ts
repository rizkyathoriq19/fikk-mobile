import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeMessage, encodeMessage, MESSAGE_TYPES } from './codec.js';

test('START messages round-trip with little-endian session fields', () => {
  const message = {
    version: 1,
    messageType: MESSAGE_TYPES.START,
    sessionId: 0x01020304,
    sequence: 0x0506,
    payload: { targetCount: 6 },
  } as const;

  const encoded = encodeMessage(message);

  assert.deepEqual([...encoded], [1, 1, 4, 3, 2, 1, 6, 5, 6]);
  assert.deepEqual(decodeMessage(encoded), message);
});

test('unsupported protocol versions are rejected', () => {
  assert.throws(
    () => decodeMessage(Uint8Array.from([2, 1, 0, 0, 0, 0, 0, 0, 6])),
    /unsupported protocol version/i,
  );
});

test('all v1 message payloads round-trip through the public codec', () => {
  const messages = [
    {
      version: 1,
      messageType: MESSAGE_TYPES.STOP,
      sessionId: 9,
      sequence: 10,
      payload: { reason: 3 },
    },
    {
      version: 1,
      messageType: MESSAGE_TYPES.SYNC,
      sessionId: 9,
      sequence: 11,
      payload: {},
    },
    {
      version: 1,
      messageType: MESSAGE_TYPES.ACK_RESULT,
      sessionId: 9,
      sequence: 12,
      payload: { resultSequence: 0xabcd },
    },
    {
      version: 1,
      messageType: MESSAGE_TYPES.ACK,
      sessionId: 9,
      sequence: 13,
      payload: { command: MESSAGE_TYPES.START, status: 0 },
    },
    {
      version: 1,
      messageType: MESSAGE_TYPES.PROGRESS,
      sessionId: 9,
      sequence: 14,
      payload: { count: 5, elapsedMs: 0x01020304 },
    },
    {
      version: 1,
      messageType: MESSAGE_TYPES.COMPLETE,
      sessionId: 9,
      sequence: 15,
      payload: { count: 6, durationMs: 0x05060708, reason: 1 },
    },
    {
      version: 1,
      messageType: MESSAGE_TYPES.STATE,
      sessionId: 9,
      sequence: 16,
      payload: { state: 2, count: 6, elapsedMs: 0x090a0b0c },
    },
    {
      version: 1,
      messageType: MESSAGE_TYPES.ERROR,
      sessionId: 9,
      sequence: 17,
      payload: { errorCode: 0xbeef },
    },
  ] as const;

  for (const message of messages) {
    assert.deepEqual(decodeMessage(encodeMessage(message)), message);
  }
});

test('v1 byte fixtures match the shared firmware contract', () => {
  const fixtures = [
    [
      {
        version: 1,
        messageType: MESSAGE_TYPES.START,
        sessionId: 0x01020304,
        sequence: 0x0506,
        payload: { targetCount: 6 },
      },
      [1, 1, 4, 3, 2, 1, 6, 5, 6],
    ],
    [
      {
        version: 1,
        messageType: MESSAGE_TYPES.STOP,
        sessionId: 9,
        sequence: 10,
        payload: { reason: 3 },
      },
      [1, 2, 9, 0, 0, 0, 10, 0, 3],
    ],
    [
      {
        version: 1,
        messageType: MESSAGE_TYPES.SYNC,
        sessionId: 9,
        sequence: 11,
        payload: {},
      },
      [1, 3, 9, 0, 0, 0, 11, 0],
    ],
    [
      {
        version: 1,
        messageType: MESSAGE_TYPES.ACK_RESULT,
        sessionId: 9,
        sequence: 12,
        payload: { resultSequence: 0xabcd },
      },
      [1, 4, 9, 0, 0, 0, 12, 0, 0xcd, 0xab],
    ],
    [
      {
        version: 1,
        messageType: MESSAGE_TYPES.ACK,
        sessionId: 9,
        sequence: 13,
        payload: { command: MESSAGE_TYPES.START, status: 0 },
      },
      [1, 0x81, 9, 0, 0, 0, 13, 0, 1, 0],
    ],
    [
      {
        version: 1,
        messageType: MESSAGE_TYPES.PROGRESS,
        sessionId: 9,
        sequence: 14,
        payload: { count: 5, elapsedMs: 0x01020304 },
      },
      [1, 0x82, 9, 0, 0, 0, 14, 0, 5, 4, 3, 2, 1],
    ],
    [
      {
        version: 1,
        messageType: MESSAGE_TYPES.COMPLETE,
        sessionId: 9,
        sequence: 15,
        payload: { count: 6, durationMs: 0x05060708, reason: 1 },
      },
      [1, 0x83, 9, 0, 0, 0, 15, 0, 6, 8, 7, 6, 5, 1],
    ],
    [
      {
        version: 1,
        messageType: MESSAGE_TYPES.STATE,
        sessionId: 9,
        sequence: 16,
        payload: { state: 2, count: 6, elapsedMs: 0x090a0b0c },
      },
      [1, 0x84, 9, 0, 0, 0, 16, 0, 2, 6, 12, 11, 10, 9],
    ],
    [
      {
        version: 1,
        messageType: MESSAGE_TYPES.ERROR,
        sessionId: 9,
        sequence: 17,
        payload: { errorCode: 0xbeef },
      },
      [1, 0xff, 9, 0, 0, 0, 17, 0, 0xef, 0xbe],
    ],
  ] as const;

  for (const [message, expectedBytes] of fixtures) {
    assert.deepEqual([...encodeMessage(message)], expectedBytes);
  }
});

test('invalid payload lengths, states, and values are rejected', () => {
  assert.throws(
    () => decodeMessage(Uint8Array.from([1, MESSAGE_TYPES.SYNC, 0, 0, 0, 0, 0, 0, 1])),
    /invalid payload length/i,
  );
  assert.throws(
    () => decodeMessage(Uint8Array.from([1, MESSAGE_TYPES.STATE, 0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0])),
    /unknown device state/i,
  );
  assert.throws(
    () => encodeMessage({
      version: 1,
      messageType: MESSAGE_TYPES.START,
      sessionId: 1,
      sequence: 1,
      payload: { targetCount: 0 },
    }),
    /targetCount must be greater than 0/i,
  );
  assert.throws(
    () => encodeMessage({
      version: 1,
      messageType: MESSAGE_TYPES.PROGRESS,
      sessionId: 0x100000000,
      sequence: 1,
      payload: { count: 1, elapsedMs: 1 },
    }),
    /sessionId must be an integer/i,
  );
});
