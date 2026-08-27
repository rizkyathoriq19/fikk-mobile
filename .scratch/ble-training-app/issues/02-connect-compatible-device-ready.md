# 02 — Connect a compatible device and reach synchronized Ready

**What to build:** Let an operator enter the BLE flow from Settings, select the compatible training device, and reach Ready only after the connection is fully usable and synchronized.

**Blocked by:** `01` — Validate physical BLE foundation and protocol v1.

**Status:** ready-for-agent

- [ ] Bluetooth permission is requested only when the operator enters a BLE-related flow.
- [ ] Permission denied and Bluetooth adapter-off states are visible, recoverable, and do not crash the app.
- [ ] Scanning is bounded, stops after connection or timeout, and filters by the product service or manufacturer/service data.
- [ ] Scan results show device name, stable identifier when available, and RSSI.
- [ ] Selecting a new device disconnects the previous peripheral before establishing the new connection.
- [ ] The app discovers required characteristics, subscribes to EVENT and STATE notifications, and performs initial state synchronization.
- [ ] The app reports Ready only after discovery, subscription, and synchronization succeed; Connected alone is insufficient.
- [ ] Settings shows connection state, device identity, and protocol/firmware/device information when available.
- [ ] The last successful device identity is remembered for later best-effort reconnect.
- [ ] Automated behavior tests cover permission, adapter, scan, connection replacement, discovery, subscription, synchronization, and Ready gating.
