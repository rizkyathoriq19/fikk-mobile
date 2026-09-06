import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDuration, formatTrainingError } from './labels';

test('formats device durations for people instead of raw milliseconds', () => {
  assert.equal(formatDuration(850), '850 ms');
  assert.equal(formatDuration(1250), '1.3 s');
  assert.equal(formatDuration(12_500), '13 s');
});

test('turns recovery errors into actionable training copy', () => {
  assert.match(formatTrainingError('Session recovery failed: timeout'), /reconnect/i);
  assert.match(formatTrainingError('Device error 0x02'), /device reported a problem/i);
});
