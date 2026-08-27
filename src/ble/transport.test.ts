import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FakeBleTransport } from './transport.js';

test('fake transport supports scan, discovery, notifications, and control writes', async () => {
  const device = { id: 'device-1', name: 'Fikk Trainer', rssi: -42, serviceUuids: ['service-1'] };
  const transport = new FakeBleTransport({ devices: [device] });
  const discovered: string[] = [];
  const events: number[][] = [];

  await transport.initialize();
  assert.equal(await transport.checkState(), 'on');

  await transport.scan({
    serviceUuid: 'service-1',
    seconds: 5,
    onDevice: (found) => discovered.push(found.id),
  });
  assert.deepEqual(discovered, ['device-1']);

  await transport.connect(device);
  await transport.discover();
  const unsubscribe = await transport.subscribe('EVENT', (value) => events.push([...value]));

  await transport.writeControl(Uint8Array.of(1, 2, 3));
  transport.emit('EVENT', Uint8Array.of(9, 8));
  assert.deepEqual(events, [[9, 8]]);
  assert.deepEqual(transport.controlWrites, [Uint8Array.of(1, 2, 3)]);

  unsubscribe();
  transport.emit('EVENT', Uint8Array.of(7));
  assert.deepEqual(events, [[9, 8]]);
});

test('fake transport rejects control writes before a discovered connection', async () => {
  const transport = new FakeBleTransport();

  await assert.rejects(() => transport.writeControl(Uint8Array.of(1)), /discovered connection/i);
});
