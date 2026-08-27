import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACK_STATUS, COMPLETION_REASONS, ERROR_CODES, STOP_REASONS } from './constants.js';

test('semantic protocol values match the firmware contract', () => {
  assert.deepEqual(ACK_STATUS, {
    ACCEPTED: 0,
    REJECTED: 1,
    INVALID_STATE: 2,
    INVALID_PACKET: 3,
    UNSUPPORTED: 4,
  });
  assert.deepEqual(COMPLETION_REASONS, { TARGET_REACHED: 1, STOPPED: 2, DEVICE_ERROR: 3 });
  assert.deepEqual(STOP_REASONS, { USER: 1, DEVICE_ERROR: 2, RESTART: 3 });
  assert.deepEqual(ERROR_CODES, {
    INVALID_PACKET: 0x0001,
    INVALID_STATE: 0x0002,
    UNSUPPORTED_VERSION: 0x0003,
    INVALID_TARGET: 0x0004,
    RESULT_NOT_FOUND: 0x0005,
  });
});
