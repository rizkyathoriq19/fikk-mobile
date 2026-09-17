## Parent

#12 — OVbAT physical start, IR sensor, and LCD integration

## What to build

Run the complete automated and physical validation gate for the OVbAT training flow after the protocol, GPIO, LCD, and identity slices are complete.

Verify the real ESP32 DevKit V1 assembly and custom Android development build separately from unit tests and compilation. Do not claim sensor, button, LCD, or BLE behavior as physically validated without the wired hardware.

## Acceptance criteria

- [ ] `pnpm run test` passes.
- [ ] `pnpm run typecheck` passes.
- [ ] Android configuration/export or debug build confirms application label `OVbAT`, while package ID and scheme remain unchanged.
- [ ] ESP32 firmware compiles with physical GPIO input and LCD configuration.
- [ ] Physical boot succeeds with the GPIO12 button wiring and no strapping-pin failure.
- [ ] Physical LCD output works at address `0x27` using SCL GPIO22 and SDA GPIO21.
- [ ] BLE advertises as `OVbAT-ESP32` and remains discoverable through the existing service UUID.
- [ ] Mobile START produces Armed without starting the timer.
- [ ] GPIO12 starts Active and the authoritative timer.
- [ ] GPIO26 active-HIGH detections count one ball per qualified pulse and complete at six.
- [ ] LCD, BLE progress, and mobile Active Training show consistent device-owned count and duration.
- [ ] Disconnect/reconnect from Armed and Active recovers through SYNC without duplicate START.
- [ ] Save and Discard handle the retained completion and return the Device to Ready.
- [ ] Automated results and physical results are reported separately, including any unavailable hardware validation.

## Blocked by

- #13 — Add Armed state and physical-start protocol flow
- #14 — Connect GPIO26 IR sensor and GPIO12 start button
- #15 — Add 20x4 I2C LCD device display
- #16 — Rename product and BLE identity to OVbAT
