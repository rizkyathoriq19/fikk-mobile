# 03 — Start one six-ball session safely

**What to build:** Let an operator enter notes from Home and start exactly one device-owned six-ball session after the device reaches Ready.

**Blocked by:** `02` — Connect a compatible device and reach synchronized Ready.

**Status:** ready-for-agent

- [ ] Home exposes Start Training and the operator can enter optional multiline notes.
- [ ] Notes are trimmed and values over 500 characters are rejected or constrained without corrupting the session metadata.
- [ ] Start Session is blocked when the device is not Ready and routes the operator to connection setup when needed.
- [ ] The app creates one 32-bit unsigned BLE session ID before sending START and preserves it for the logical session.
- [ ] START carries the fixed MVP target count of six and the generated session ID.
- [ ] The firmware accepts START only in READY, initializes the session once, and acknowledges acceptance.
- [ ] The app enters Active only after an application-level accepted ACK, not merely after a successful BLE write.
- [ ] A duplicate START for the same active session ID does not reset the device timer or counter; a conflicting active START is rejected.
- [ ] A missing ACK times out after three seconds, checks current device state/session identity before retrying, and never blindly restarts an active session.
- [ ] Training-session orchestration tests cover the Ready gate, session ID stability, accepted/rejected ACKs, duplicate starts, timeout, and safe retry behavior.
