# 05 — Save, discard, and browse results offline

**What to build:** Let the operator save or discard a completed Result and review saved sessions locally through History without network access.

**Blocked by:** `04` — Complete a six-ball session with an authoritative Result.

**Status:** ready-for-agent

- [ ] Result exposes Save Result as the primary action and Discard as the secondary action.
- [ ] Save persists the session locally with notes, target count, final count, authoritative duration, timestamps, device identity, status, and protocol version.
- [ ] Local persistence enforces uniqueness by stable device key and BLE session ID.
- [ ] Repeated Save actions, repeated COMPLETE events, and repeated recovery writes update one logical result rather than creating duplicate rows.
- [ ] Discard returns to Home without creating a History record.
- [ ] ACK_RESULT is sent only after the result has been handled according to the save/discard flow.
- [ ] History lists saved results newest first and each row shows date/time, notes preview, final count, and duration.
- [ ] Selecting a History row opens complete result details.
- [ ] Saved History remains available offline and survives application restart.
- [ ] Repository and orchestration tests cover persistence shape, ordering, uniqueness, idempotent writes, Save, Discard, and restart durability.
