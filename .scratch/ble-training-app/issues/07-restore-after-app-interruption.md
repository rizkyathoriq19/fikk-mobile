# 07 — Restore sessions after app interruption

**What to build:** Recover a device-owned session after the mobile application is force-closed or relaunched, restoring active work or a completed result and preserving local idempotency.

**Blocked by:** `05` — Save, discard, and browse results offline; `06` — Recover an active or completed session after BLE disconnect.

**Status:** ready-for-agent

- [ ] The app stores enough current-session and remembered-device context to attempt recovery after relaunch.
- [ ] On launch, the app performs a best-effort reconnect to the remembered peripheral without creating a new session.
- [ ] Relaunch recovery restores GATT discovery, notification subscription, and SYNC ordering.
- [ ] A device-reported ACTIVE session resumes with the original session ID, count, and elapsed time.
- [ ] A retained completed session is restored into Result and can be saved through the existing idempotent persistence path.
- [ ] Recovered results appear once in History after Save and repeated launch/reconnect cycles do not create duplicates.
- [ ] Recovery failure remains a recoverable user-facing state and does not fabricate a result or silently reset the device.
- [ ] Tests cover force-close/relaunch with active and completed device states, remembered-device reconnect, SYNC, save idempotency, and recovery failure.
