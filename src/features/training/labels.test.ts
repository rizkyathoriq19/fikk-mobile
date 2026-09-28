import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDuration, formatTrainingError } from './labels';

test('formats device durations as minutes, seconds, and milliseconds', () => {
  assert.equal(formatDuration(0), '00:00:000');
  assert.equal(formatDuration(850), '00:00:850');
  assert.equal(formatDuration(1250), '00:01:250');
  assert.equal(formatDuration(60_005), '01:00:005');
  assert.equal(formatDuration(3_600_000), '60:00:000');
});

test('turns recovery errors into actionable training copy', () => {
  assert.match(formatTrainingError('Session recovery failed: timeout'), /reconnect/i);
  assert.match(formatTrainingError('Device error 0x02'), /device reported a problem/i);
});
