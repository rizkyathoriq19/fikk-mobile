## Parent

#12 — OVbAT physical start, IR sensor, and LCD integration

## What to build

Make the Device distinguish `Armed` from `Ready` and `Active`. Mobile `START` must be acknowledged into `Armed`; the Device Start Button transition must begin the authoritative timer and move the Device to `Active`; mobile must show an active session only after receiving the Device-owned Active state.

The existing BLE envelope and payloads remain unchanged. Add `ARMED` as device state code `4` and keep protocol version `1`. Preserve the app-generated session ID and target count six.

## Acceptance criteria

- [ ] Firmware accepts valid START only from Ready, retains the session ID and target count, acknowledges it, publishes Armed state, and does not start the timer yet.
- [ ] A button-start input while Armed transitions the Device to Active and starts the monotonic timer exactly once.
- [ ] Button-start input before Armed, while Active, or while Completed is ignored.
- [ ] Mobile codec encodes/decodes Armed state code `4` and rejects unsupported state values.
- [ ] Mobile training orchestration enters its waiting-for-button state after START acceptance and enters Active only after Active state for the same session ID.
- [ ] Reconnect from Armed or Active issues SYNC and never blindly sends START again.
- [ ] Existing Ready, Active, Complete, Save, Discard, and ACK_RESULT behavior remains green.
- [ ] Automated firmware and mobile tests cover the new state transitions, stale-session rejection, and reconnect behavior.

## Blocked by

None — can start immediately.
