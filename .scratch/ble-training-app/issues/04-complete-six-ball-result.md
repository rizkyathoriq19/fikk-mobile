# 04 — Complete a six-ball session with an authoritative Result

**What to build:** Run the physical six-ball training loop and show the operator a Result sourced from the microcontroller's count, duration, and completion event.

**Blocked by:** `03` — Start one six-ball session safely.

**Status:** ready-for-agent

- [ ] The firmware qualifies and debounces IR detections so one physical ball produces one logical increment.
- [ ] Every valid detection triggers buzzer and LED feedback on the device.
- [ ] The device emits PROGRESS after each valid detection with session ID, sequence, count, and authoritative elapsed time.
- [ ] The app's Active screen shows device-reported count out of six and elapsed time, while any phone-side interpolation remains display-only.
- [ ] The device reaches completion at six valid detections, stops its monotonic timer exactly once, and emits one COMPLETE event.
- [ ] COMPLETE includes final count, authoritative duration, and completion reason; the device retains the latest completed result for recovery.
- [ ] The app shows final count, authoritative duration, start timestamp, completion timestamp, notes, and device name on Result.
- [ ] The app ignores stale or invalid session events and handles duplicate or out-of-order sequence values without moving visible progress backward.
- [ ] Tests prove one completion for six valid detections, authoritative result values, device feedback, event deduplication, and invalid event rejection.
- [ ] A physical-device demonstration completes a six-ball session without the phone becoming the source of truth.
