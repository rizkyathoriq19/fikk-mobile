## Parent

#12 — OVbAT physical start, IR sensor, and LCD integration

## What to build

Rename the product-facing mobile identity and the BLE local device name to OVbAT without changing technical identifiers that preserve installation, navigation, or BLE compatibility.

The Android application label and visible UI references become `OVbAT`. The ESP32 BLE local name and device-facing display branding become `OVbAT-ESP32` and `OVbAT`. Preserve the existing package ID, Expo slug, scheme, UUIDs, and internal source identifiers.

## Acceptance criteria

- [ ] Android application label resolves to `OVbAT` in the Expo public configuration and generated Android metadata.
- [ ] User-facing mobile strings no longer present the old Fikk product name where the text refers to the product or device.
- [ ] Bluetooth permission text names `OVbAT`.
- [ ] ESP32 BLE advertising local name is `OVbAT-ESP32`.
- [ ] Device information identifies the renamed product without changing service or characteristic UUIDs.
- [ ] Existing Android package ID, Expo slug, deep-link scheme, iOS bundle identifier, and BLE UUIDs remain unchanged.
- [ ] BLE scanning still discovers the renamed device through the existing service profile.
- [ ] Existing mobile tests and Android config/export verification remain green.

## Blocked by

None — can start immediately.
