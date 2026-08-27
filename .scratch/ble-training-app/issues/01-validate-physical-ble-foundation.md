# 01 — Validate physical BLE foundation and protocol v1

**What to build:** Prove that a custom Expo development build can communicate with the target BLE microcontroller through the selected adapter and establish the versioned protocol foundation used by later product slices.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A custom development build runs on a physical Android device and a physical iOS device.
- [ ] The selected BLE adapter can scan for, connect to, and disconnect from the target microcontroller.
- [ ] The target service and CONTROL, EVENT, STATE, and DEVICE_INFO characteristics can be discovered.
- [ ] The physical connection proves read, write-with-response, and notification behavior against the target hardware.
- [ ] Product service UUIDs and protocol v1 constants are finalized and shared between the mobile and firmware implementations.
- [ ] Protocol envelope encoding and decoding handles version, message type, session ID, sequence, payload, little-endian integers, and invalid input.
- [ ] A fake BLE transport can drive the future training-session orchestration tests without native BLE.
- [ ] The selected BLE library and compatible package versions are pinned based on the physical proof; Expo Go is not used.
