## Parent

#12 — OVbAT physical start, IR sensor, and LCD integration

## What to build

Add the local 20x4 I2C LCD display for the Device using address `0x27`, SCL GPIO22, and SDA GPIO21. The display must mirror the Device-owned session state, count, and authoritative duration without changing the BLE contract.

Use 3.3V-safe I2C signaling or verified level shifting. Keep the display implementation limited to this one configured LCD; do not add address scanning or multi-display support.

## Acceptance criteria

- [ ] LCD initializes as a 20x4 I2C display at address `0x27`.
- [ ] I2C uses SCL GPIO22 and SDA GPIO21.
- [ ] Ready display shows `OVbAT TRAINING`, `Ready`, and `Press START`.
- [ ] Armed display shows `OVbAT TRAINING`, `Press device btn`, and `Target: 6 balls`.
- [ ] Active display shows `OVbAT TRAINING`, current `Count: n/6`, authoritative `Time: mm:ss`, and `Sensor: READY`.
- [ ] Completed display shows `OVbAT TRAINING`, `Completed`, final count, and final duration.
- [ ] Every render clears or pads all four rows so stale text from an earlier state is not visible.
- [ ] LCD initialization or write failures produce bounded serial diagnostics and do not crash the training loop.
- [ ] LCD behavior tests cover Ready, Armed, Active, Completed, row clearing, and formatting.
- [ ] Firmware compiles with the LCD dependency and configured pins.

## Blocked by

- #13 — Add Armed state and physical-start protocol flow
