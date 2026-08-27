# 09 — Validate physical-device matrix and release packaging

**What to build:** Validate the complete offline BLE training product on the required physical-device matrix and produce a release-capable custom build that does not depend on Expo Go.

**Blocked by:** `08` — Harden failure paths and accessibility.

**Status:** ready-for-agent

- [ ] A custom development or release build installs and runs on a recent Pixel-class Android device, a Samsung-class Android device, a current iPhone, and the target microcontroller hardware.
- [ ] The physical matrix passes connect-to-Ready, notes, safe START, six-ball completion, authoritative Result, Save, Discard, and History scenarios.
- [ ] The physical matrix passes duplicate COMPLETE, disconnect after the third ball, reconnect/SYNC, active recovery, completed recovery, and app-relaunch recovery scenarios.
- [ ] Permission-denied, adapter-off, no-device, GATT failure, command timeout, and device-error flows are manually verified as recoverable on applicable platforms.
- [ ] Final count and duration displayed and persisted match the microcontroller result in every accepted completion scenario.
- [ ] No scenario creates duplicate sessions or duplicate History records.
- [ ] The finalized protocol version and UUID constants are present in the mobile and firmware delivery outputs.
- [ ] Scanning stops after connection or timeout, and the foreground progress responsiveness target is verified.
- [ ] Release documentation records the selected BLE library, build method, supported runtime, hardware assumptions, and known open decisions.
