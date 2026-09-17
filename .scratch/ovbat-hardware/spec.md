## Parent

#1 — BLE Training App and IoT Device

## Problem Statement

The current Fikk Mobile training flow still depends on development simulation for the microcontroller input. The physical training device must instead use its IR sensor to count balls, a physical button to start the authoritative timer, and a local LCD to show device state. The Android product identity and BLE device identity must also be updated to OVbAT.

The mobile application must continue to treat the Device as the source of truth for Ball Detection, elapsed time, completion, and the final Result. A temporary BLE disconnect must not lose a Device-owned Training Session.

## Solution

Update the product-visible application name to `OVbAT` and the BLE local name to `OVbAT-ESP32`, while preserving the existing Android package ID, Expo slug, scheme, BLE UUIDs, and internal source identifiers for compatibility.

Connect the confirmed ESP32 DevKit V1 firmware to the supplied hardware mapping:

- IR sensor: GPIO 26, active-HIGH.
- Device Start Button: GPIO 12, active-LOW, using an externally verified 3.3V pull resistor rather than relying on an internal pull-up.
- LCD SCL: GPIO 22.
- LCD SDA: GPIO 21.
- LCD: 20x4 I2C module at address `0x27`, with safe 3.3V I2C signaling or verified level shifting.

The mobile app sends `START` with its generated session ID and target count. The Device acknowledges the request and enters `Armed`; the timer does not begin yet. Pressing the Device Start Button moves the Device to `Active`, starts the monotonic Device timer, and enables IR Ball Detection. Each qualified IR pulse increments the count, emits physical feedback, updates the LCD, and sends protocol progress. Count six completes the Training Session exactly once, displays the final Result locally, and sends the existing completion event. The mobile app receives `Armed`, `Active`, progress, and completion state through the existing BLE orchestration seam.

If BLE disconnects while the Device is Armed or Active, the Device continues its logical state. On reconnect, the mobile app uses `SYNC` and resumes the corresponding state without sending a blind second `START`.

## User Stories

1. As a trainee, I want the Android application to be named `OVbAT`, so that the installed app matches the new product identity.
2. As a trainee, I want visible mobile references to the old product name replaced with `OVbAT`, so that the UI and Bluetooth permission explanation are consistent.
3. As a support technician, I want the Android package ID, Expo slug, and deep-link scheme preserved, so that an app rename does not unnecessarily break installation or existing links.
4. As a trainee, I want the BLE device to advertise as `OVbAT-ESP32`, so that I can identify the intended device during scanning.
5. As a support technician, I want the BLE service and characteristic UUIDs preserved, so that the rename does not require new physical pairing or protocol identifiers.
6. As a trainee, I want the app to discover `OVbAT-ESP32` through the existing service-filtered BLE flow, so that unrelated BLE peripherals remain excluded.
7. As a trainee, I want the app to send `START` only when the Device is Ready, so that a new Training Session cannot overwrite an existing one.
8. As a trainee, I want the Device to enter Armed after accepting `START`, so that I have a clear physical-start window before timing begins.
9. As a trainee, I want the Device Start Button on GPIO 12 to begin the timer only after the Device is Armed, so that the physical action—not the mobile transport delay—defines the real start.
10. As a trainee, I want a button press before Armed to be ignored, so that accidental presses cannot create an untracked Training Session.
11. As a trainee, I want a button press while Active or Completed to be ignored, so that the timer and retained Result cannot be reset accidentally.
12. As a trainee, I want the Device to continue from Armed or Active if BLE disconnects, so that a communication interruption does not cancel physical training.
13. As a trainee, I want reconnect recovery to use SYNC rather than another START, so that the existing session ID and timer are preserved.
14. As a trainee, I want the IR sensor on GPIO 26 to be the only source of Ball Detection, so that the app does not fabricate count values.
15. As a trainee, I want an active-HIGH IR signal to be interpreted as a sensor event, so that the supplied sensor wiring produces the expected count.
16. As a trainee, I want one physical ball pulse to produce at most one count, so that sensor noise and a held signal do not inflate the Result.
17. As a trainee, I want IR detections before the physical start button to be ignored, so that pre-session sensor activity is not counted.
18. As a trainee, I want IR detections after completion to be ignored, so that the final count remains stable.
19. As a trainee, I want every valid Ball Detection to produce the existing buzzer and LED feedback, so that the Device provides immediate local feedback even if BLE notifications are delayed.
20. As a trainee, I want a PROGRESS notification after each valid Ball Detection, so that the mobile Active Training screen mirrors the Device count and duration.
21. As a trainee, I want the Device timer to be monotonic and authoritative, so that the saved duration is independent of the phone clock.
22. As a trainee, I want the sixth valid Ball Detection to emit one COMPLETE event, so that a Training Session finishes deterministically.
23. As a trainee, I want the Device to retain the completed Result until mobile handling is acknowledged, so that a disconnect after completion does not lose the Result.
24. As a trainee, I want the LCD to show Ready before a session, so that I know the Device can accept a mobile start request.
25. As a trainee, I want the LCD to show Armed while waiting for the physical button, so that I know the next action is on the Device.
26. As a trainee, I want the LCD to show live count and elapsed time while Active, so that the Device remains understandable without looking at the phone.
27. As a trainee, I want the LCD to show the final count and duration after completion, so that the physical Result is visible locally.
28. As a trainee, I want the LCD to use all four rows predictably, so that status text is readable on the 20x4 display without stale characters from a previous state.
29. As a trainee, I want the LCD to use the configured I2C address `0x27`, so that the supplied display module can be initialized without address guessing.
30. As a technician, I want LCD communication to use GPIO22 for SCL and GPIO21 for SDA, so that the firmware matches the supplied wiring.
31. As a technician, I want the firmware to avoid relying on 5V signals directly on ESP32 I2C pins, so that the wiring does not damage the controller or create unreliable readings.
32. As a trainee, I want the app to show Armed distinctly from Ready and Active, so that the UI communicates that the device is waiting for physical input.
33. As a trainee, I want mobile training state to enter Active only after the Device reports that the physical start button began the session, so that the app never shows an active timer prematurely.
34. As a trainee, I want progress and completion events for the current session ID only, so that stale packets cannot corrupt the current Training Session.
35. As a trainee, I want the existing Result screen to use the Device count and duration, so that the saved outcome remains authoritative.
36. As a trainee, I want Save Result and Discard to continue acknowledging the retained Device Result, so that the Device returns to Ready only after the result is handled.
37. As a trainee, I want repeated COMPLETE notifications to remain idempotent, so that reconnect recovery cannot create duplicate History entries.
38. As a trainee, I want the existing local SQLite History to continue working after the rename and hardware integration, so that previous saved Results remain available.
39. As a developer, I want simulation disabled for the normal ESP32 environment, so that normal data collection always uses GPIO input.
40. As a developer, I want simulation retained only as an explicit development/test environment, so that protocol and UI tests do not require physical hardware while production behavior remains sensor-backed.
41. As a developer, I want the existing BallDetectionDebouncer reused for GPIO26 input, so that debounce behavior is not reimplemented in a second path.
42. As a developer, I want the existing BLE adapter, protocol codec, TrainingSessionController, and SQLite repository seams reused, so that the change remains a small cross-layer integration.
43. As a developer, I want the protocol state code for Armed added explicitly, so that both mobile and firmware reject unknown state values consistently.
44. As a developer, I want protocol fixtures for Armed and physical-start transitions, so that the new wire behavior is verified without hardware.
45. As a developer, I want firmware tests to cover button gating, IR qualification, LCD state updates, and completion, so that the input path is not accepted based only on compilation.
46. As a developer, I want mobile tests to cover Armed, physical Active transition, reconnect from Armed, reconnect from Active, and retained completion recovery, so that the UI state follows the Device contract.
47. As a technician, I want serial diagnostics to identify GPIO-backed input transitions and LCD initialization failures without logging training notes, so that wiring problems can be diagnosed safely.
48. As a product owner, I want Android bundle/export verification and firmware compilation, so that the rename and hardware integration are checked before physical validation.
49. As a product owner, I want physical validation reported separately from unit/build checks, so that passing TypeScript or firmware compilation is not mistaken for proof that the sensor, button, LCD, or BLE works on the real assembly.

## Implementation Decisions

- Product-facing mobile name and permission text become `OVbAT`. The Expo slug, Android package ID, iOS bundle identifier, scheme, BLE UUIDs, and internal Fikk-named source symbols remain unchanged unless required by the build system.
- Firmware BLE local name becomes `OVbAT-ESP32`. The existing custom service and characteristic UUIDs remain unchanged.
- The existing BLE packet envelope and payload layouts remain unchanged. A new `ARMED` device state is added as state code `4`; mobile and firmware in this repository ship as one compatible contract. The protocol version remains `1` because no packet envelope or existing payload layout changes.
- The device state sequence is `READY → ARMED → ACTIVE → COMPLETED → READY`. Mobile START acceptance produces Armed; the physical button produces Active and starts the timer; six valid IR detections produce Completed; mobile Save or Discard acknowledges the Result and returns the Device to Ready.
- START remains app-generated with a non-zero uint32 session ID and target count six. This preserves notes/session correlation and avoids device-generated session identity.
- GPIO mapping is fixed to IR 26, button 12, LCD SCL 22, and LCD SDA 21. The firmware uses active-HIGH for IR and active-LOW for the button.
- GPIO12 uses an externally verified 3.3V pull resistor. Firmware must not depend on the internal pull-up for this strapping pin. Physical boot behavior must be verified with the actual button wiring.
- LCD initialization uses a 20x4 I2C display at address `0x27`, with 3.3V-safe signaling or verified level shifting. No address scan or multi-display abstraction is introduced.
- LCD content is:
  - Ready: `OVbAT TRAINING`, `Ready`, `Press START`.
  - Armed: `OVbAT TRAINING`, `Press device btn`, `Target: 6 balls`.
  - Active: `OVbAT TRAINING`, `Count: n/6`, `Time: mm:ss`, `Sensor: READY`.
  - Completed: `OVbAT TRAINING`, `Completed`, `Count: 6/6`, `Time: mm:ss`.
- LCD rows are cleared or padded on each render so shorter text from a previous state cannot remain visible.
- The existing `BallDetectionDebouncer` is reused for GPIO26. A valid rising active-level event is forwarded to the existing ball-registration path only in Active state. The debounce interval remains a named calibration constant rather than a hidden magic value.
- Existing buzzer and LED feedback paths remain the feedback behavior for each accepted detection. If physical output pins are still not supplied, those outputs remain unchanged and are not invented by this feature.
- The normal `esp32dev` environment no longer enables development simulation. A separate explicit simulation environment may remain for development tests; it must not run concurrently with GPIO input.
- The mobile connection and training orchestration boundaries are reused. Mobile consumes Armed through the connection snapshot and message stream, shows a waiting-for-button state, and enters Active only when the Device reports Active for the same session ID.
- Reconnect from Armed or Active performs normal GATT setup followed by SYNC. The mobile app never sends START again solely because the connection was lost.
- Existing retained-result, Save, Discard, ACK_RESULT, SQLite uniqueness, and History behavior remains unchanged except for the renamed user-facing device identity.
- No new backend, cloud synchronization, authentication, OTA update flow, configurable target count, or second BLE service is introduced.

## Testing Decisions

- The highest mobile seam remains the existing fake `TrainingConnection` plus `TrainingSessionController`. Tests assert visible state transitions and emitted protocol commands rather than React component implementation details.
- Mobile behavior tests cover START acknowledgment leading to Armed, Armed state not showing Active, Active only after the Device Start Button transition, GPIO-independent protocol Active events, stale-session rejection, reconnect from Armed, reconnect from Active, completion, repeated completion, Save, Discard, and ACK_RESULT.
- Mobile protocol codec tests add Armed state encode/decode fixtures and reject unknown state values above the supported range.
- Firmware behavior tests cover an Armed state after START, ignored button before Armed, button transition from Armed to Active, timer start at physical button acceptance, ignored button in Active/Completed, active-HIGH IR input, one count per debounced pulse, ignored IR before Active, ignored IR after completion, six-count completion, and retained-result recovery.
- Firmware protocol tests retain all existing fixtures and add Armed state packet coverage without changing the existing envelope or payload fixture bytes.
- LCD tests use a small fake display sink at the firmware behavior seam and assert the four logical rows for Ready, Armed, Active, and Completed, including stale-row clearing/padding behavior.
- Build checks include `pnpm run test`, `pnpm run typecheck`, Android bundle/export verification, and `pio run -d firmware -e esp32dev` with the normal physical-input configuration.
- Physical validation must use the actual ESP32 DevKit V1 assembly and a custom Android development build. It must verify boot with GPIO12 wiring, LCD output/address, button-to-Armed transition, active-HIGH IR counting, BLE name `OVbAT-ESP32`, progress, completion, disconnect/reconnect from Armed and Active, and Save/Discard recovery.
- Physical validation results must be reported as not performed when no target hardware, display, sensor, or button assembly is available. Compilation and unit tests must not be presented as physical evidence.

## Out of Scope

- Changing the Android package ID, Expo slug, scheme, iOS bundle identifier, BLE UUIDs, or internal source identifiers.
- Device-generated session IDs or a second independent button-start protocol.
- Cloud accounts, remote synchronization, coach dashboards, leaderboards, OTA updates, or production authentication.
- Configurable target counts; the MVP remains six valid Ball Detections.
- New buzzer or LED GPIO assignments; none were supplied.
- Automatic I2C address discovery, support for multiple LCD addresses, or support for multiple displays.
- Phone-owned sensor counting or phone-owned authoritative timing.
- Claiming physical sensor/LCD/button validation without the actual wired assembly.

## Further Notes

- The corrected LCD wiring is SCL GPIO22 and SDA GPIO21. GPIO2 is not part of this feature.
- GPIO12 and GPIO21/22 must be checked against the actual ESP32 board wiring and power levels during physical validation. The firmware should preserve bounded serial diagnostics for setup and input troubleshooting without printing user notes.
- The user-approved LCD text is intentionally minimal. A richer UI can be added later only if the four-row display becomes insufficient.
- The existing `Fikk` naming in source filenames and constants is treated as an internal compatibility concern, not as a requirement to rename the repository or perform a broad identifier migration.
