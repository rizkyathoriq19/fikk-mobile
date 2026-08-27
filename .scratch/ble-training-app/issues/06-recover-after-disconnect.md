# 06 — Recover an active or completed session after BLE disconnect

**What to build:** Preserve device-owned work across a live BLE disconnect and reconcile the mobile session by reconnecting and synchronizing instead of starting over.

**Blocked by:** `04` — Complete a six-ball session with an authoritative Result.

**Status:** ready-for-agent

- [ ] A disconnect during START or ACTIVE moves the mobile session into Recovering and explains that the device may still be running.
- [ ] Reconnect attempts use bounded backoff and stop when recovery succeeds or the retry policy is exhausted.
- [ ] Reconnection repeats the required GATT discovery and notification subscription before synchronization.
- [ ] Recovery sends SYNC and never blindly sends START again for an unresolved logical session.
- [ ] If the device reports the same session ACTIVE, the app resumes Active with the device's current count and elapsed time.
- [ ] If the device reports a retained completed result, the app shows the corresponding recovered Result.
- [ ] Events for another session are ignored unless explicitly identified as retained last-result recovery data.
- [ ] Duplicate, delayed, and out-of-order PROGRESS, STATE, and COMPLETE messages do not duplicate work or regress state.
- [ ] The logical session ID remains unchanged through disconnect and reconnect.
- [ ] Tests cover active recovery, completed recovery, reconnect ordering, SYNC behavior, bounded retry, stale events, and sequence deduplication.
