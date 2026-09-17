## Parent

#12 — OVbAT physical start, IR sensor, and LCD integration

## What to build

Replace the normal ESP32 development simulation with the supplied physical inputs. Use IR sensor GPIO 26 as active-HIGH Ball Detection and the GPIO 12 active-LOW Device Start Button to drive the Armed-to-Active flow. Reuse the existing debounce/ball-registration behavior and keep simulation available only as an explicit development environment.

The GPIO12 wiring must use an externally verified 3.3V pull resistor; firmware must not rely on an internal pull-up for this strapping pin. The implementation must not invent buzzer or LED pin assignments.

## Acceptance criteria

- [ ] GPIO26 is configured and sampled as active-HIGH input.
- [ ] GPIO12 is configured and sampled as active-LOW input using the documented external 3.3V pull resistor arrangement.
- [ ] A valid GPIO12 button action while Armed starts the Device timer and transitions to Active through the behavior delivered by Ticket 1.
- [ ] One physical IR pulse produces no more than one Ball Detection using the existing debouncer and calibration constant.
- [ ] IR activity before Active and after Completed does not change the count.
- [ ] Normal `esp32dev` firmware does not run the development simulation and uses the physical input loop.
- [ ] Simulation remains available only through an explicit development/test environment and cannot run concurrently with GPIO input.
- [ ] Serial diagnostics identify bounded input/setup failures without logging user training notes.
- [ ] Firmware tests cover active-HIGH IR input, active-LOW button input, debounce, state gating, and six-count completion.
- [ ] Firmware compiles with the physical-input configuration.

## Blocked by

- #13 — Add Armed state and physical-start protocol flow
