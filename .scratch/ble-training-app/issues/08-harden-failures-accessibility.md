# 08 — Harden failure paths and accessibility

**What to build:** Make the complete training workflow safe and usable across expected BLE/protocol failures, invalid device data, and accessibility settings.

**Blocked by:** `07` — Restore sessions after app interruption.

**Status:** ready-for-agent

- [ ] Permission denial, adapter-off, no-device, scan timeout, connection timeout, GATT discovery failure, command timeout, and disconnect produce explicit recoverable states.
- [ ] Invalid protocol version, unknown message type, invalid payload length, truncated payload, impossible values, and impossible state transitions are rejected without a false result.
- [ ] Device ERROR events preserve diagnostic information, stop unsafe active behavior, and do not fabricate completion.
- [ ] Retry controls are bounded and cannot create duplicate START commands or uncontrolled reconnect loops.
- [ ] All core controls expose meaningful accessibility labels and states, use readable contrast and scalable text, and do not communicate status by color alone.
- [ ] Training notes are excluded from production diagnostics and sensitive data is not unnecessarily logged.
- [ ] The app respects the responsiveness target for delivered PROGRESS events under normal foreground conditions.
- [ ] Scanning and reconnect behavior respects the battery constraints and never performs continuous scanning.
- [ ] Automated and integration tests cover the failure matrix, invalid packets, diagnostics, retry safety, and accessibility-critical state exposure.
