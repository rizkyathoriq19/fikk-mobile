# OVbAT ESP32 BLE Firmware

Minimal Arduino-framework firmware for the confirmed **ESP32 DevKit V1** development board.

The exact ESP chip/module and physical hardware revision are intentionally unknown and are not inferred by this project.

## Toolchain

Install PlatformIO:

```bash
python -m pip install platformio
```

The project uses:

- PlatformIO Core 6.1.19 or later
- `espressif32@6.10.0`
- Arduino framework
- PlatformIO board target `esp32dev`
- physical GPIO/LCD input is the default `esp32dev` behavior
- optional `esp32dev-sim` environment enables `FIKK_DEV_SIMULATION=1`

`esp32dev` is the PlatformIO target for the confirmed ESP32 DevKit V1 board. It does not establish the exact module or hardware revision.

## Build, flash, and monitor

From the repository root:

```bash
# Build the ESP32 firmware
pio run -d firmware -e esp32dev

# Flash the connected board
pio run -d firmware -e esp32dev -t upload

# If more than one serial port exists
pio run -d firmware -e esp32dev -t upload --upload-port COMx

# Open the serial monitor
pio device monitor -d firmware -e esp32dev
```

Serial speed is `115200`.

For the guided human-in-the-loop flash and physical BLE validation flow:

```bash
bash scripts/validate-esp32-ble.sh
```

## BLE identity

| Item | Value |
|---|---|
| Local name | `OVbAT-ESP32` |
| Service UUID | `c8c5aefd-0e30-525e-9bf9-5243913c8127` |
| CONTROL UUID | `c42f890d-088a-5b19-bcd4-5029fceb2bcc` |
| EVENT UUID | `57a6c81b-268e-5eed-995b-2149521b911f` |
| STATE UUID | `8271b32c-fa20-5adc-a4d0-141bf24baa71` |
| DEVICE_INFO UUID | `98ef338e-f5f8-5ea4-b89f-116d303090a3` |

The UUIDs are stable UUIDv5 values generated once for the OVbAT protocol v1 contract. They are also used by the mobile BLE profile.

### Characteristics

| Characteristic | Properties | Behavior |
|---|---|---|
| CONTROL | Write With Response | App commands |
| EVENT | Notify | ACK, PROGRESS, COMPLETE, STATE, and ERROR packets |
| STATE | Read + Notify | Current state snapshot packet |
| DEVICE_INFO | Read | UTF-8 development information string |

The firmware advertises the custom service UUID and the local name. It restarts advertising after a client disconnects.

`DEVICE_INFO` is a UTF-8 string because the mobile protocol v1 codec defines no separate DEVICE_INFO message type. Current value:

```text
product=OVbAT;firmware=0.1.0;protocol=1;board=ESP32 DevKit V1;chip=unknown;hardware_revision=unknown
```

## Physical input and LCD wiring

| Function | GPIO/configuration |
|---|---|
| IR sensor | GPIO26, active-HIGH |
| Device Start Button | GPIO12, active-LOW; use an external 3.3V pull resistor because GPIO12 is a strapping pin |
| LCD SCL | GPIO22 |
| LCD SDA | GPIO21 |
| LCD | 20x4 I2C, address `0x27` |

## Protocol v1

All protocol packets use this envelope:

| Offset | Size | Field |
|---:|---:|---|
| 0 | 1 | Protocol version (`0x01`) |
| 1 | 1 | Message type |
| 2 | 4 | Session ID, unsigned 32-bit little-endian |
| 6 | 2 | Sequence, unsigned 16-bit little-endian |
| 8 | 0–6 | Message-specific payload |

Maximum packet size is 14 bytes. Malformed packets are rejected without resetting the session or device.

### Message types

| Value | Name | Direction | Payload |
|---:|---|---|---|
| `0x01` | START | App → ESP | `targetCount:u8` |
| `0x02` | STOP | App → ESP | `reason:u8` |
| `0x03` | SYNC | App → ESP | none |
| `0x04` | ACK_RESULT | App → ESP | `resultSequence:u16` little-endian |
| `0x81` | ACK | ESP → App | `command:u8,status:u8` |
| `0x82` | PROGRESS | ESP → App | `count:u8,elapsedMs:u32` little-endian |
| `0x83` | COMPLETE | ESP → App | `count:u8,durationMs:u32,reason:u8` |
| `0x84` | STATE | ESP → App | `state:u8,count:u8,elapsedMs:u32` |
| `0xff` | ERROR | ESP → App | `errorCode:u16` little-endian |

### Device states

| Value | State |
|---:|---|
| `0` | READY |
| `1` | ACTIVE |
| `2` | COMPLETED |
| `3` | ERROR |

### ACK status values

| Value | Status |
|---:|---|
| `0` | Accepted |
| `1` | Rejected |
| `2` | Invalid state |
| `3` | Invalid packet |
| `4` | Unsupported |

### Completion and stop reasons

| Value | Completion reason | Stop reason |
|---:|---|---|
| `1` | Target reached | User |
| `2` | Stopped | Device error |
| `3` | Device error | Restart |

### Error codes

| Value | Error |
|---:|---|
| `0x0001` | Invalid packet |
| `0x0002` | Invalid state |
| `0x0003` | Unsupported protocol version |
| `0x0004` | Invalid target count |
| `0x0005` | Result not found |

## Deterministic byte fixtures

These fixtures match the mobile codec tests. They use the values in the test vectors: session ID `9`, except START uses `0x01020304`; header sequence values are shown by packet.

| Message | Hex bytes |
|---|---|
| START (`sessionId=0x01020304`, `sequence=0x0506`, target `6`) | `01 01 04 03 02 01 06 05 06` |
| STOP (`sessionId=9`, `sequence=10`, reason `3`) | `01 02 09 00 00 00 0A 00 03` |
| SYNC (`sessionId=9`, `sequence=11`) | `01 03 09 00 00 00 0B 00` |
| ACK_RESULT (`sessionId=9`, `sequence=12`, result sequence `0xABCD`) | `01 04 09 00 00 00 0C 00 CD AB` |
| ACK START accepted (`sessionId=9`, `sequence=13`) | `01 81 09 00 00 00 0D 00 01 00` |
| PROGRESS (`sessionId=9`, `sequence=14`, count `5`, elapsed `0x01020304`) | `01 82 09 00 00 00 0E 00 05 04 03 02 01` |
| COMPLETE (`sessionId=9`, `sequence=15`, count `6`, duration `0x05060708`, target reached) | `01 83 09 00 00 00 0F 00 06 08 07 06 05 01` |
| STATE COMPLETED (`sessionId=9`, `sequence=16`, count `6`, elapsed `0x090A0B0C`) | `01 84 09 00 00 00 10 00 02 06 0C 0B 0A 09` |
| ERROR (`sessionId=9`, `sequence=17`, code `0xBEEF`) | `01 FF 09 00 00 00 11 00 EF BE` |

## Session behavior

### START

- Accepted only in READY.
- Session ID must be non-zero.
- Target count must be greater than zero; the mobile MVP sends `6`.
- Acceptance sets the session ID, clears count, starts the monotonic timer, and enters ACTIVE.
- The app receives an ACK and a STATE snapshot.
- Repeating START with the same currently active session ID returns an accepted ACK without resetting timer, count, or target.
- START with a different session ID while ACTIVE or any START while COMPLETED is rejected and does not reset the device.

### STOP

- Accepted only for the current ACTIVE session.
- Returns an accepted ACK, completes the current partial result with reason STOPPED, emits COMPLETE, and publishes COMPLETED STATE.
- STOP in another state returns an invalid-state ACK and ERROR.

### SYNC

- Returns an accepted ACK and the current STATE snapshot.
- READY returns session ID zero and an empty progress state.
- ACTIVE returns the current session ID, count, and elapsed time.
- COMPLETED returns the retained session/result state and replays COMPLETE using the retained result sequence.
- SYNC never starts a new session.

### ACK_RESULT

- Accepted only when the session is COMPLETED, the session ID matches, and `resultSequence` matches the retained COMPLETE packet.
- Returns an accepted ACK, clears the retained result, and transitions to READY.
- A mismatch returns a rejected ACK and RESULT_NOT_FOUND ERROR without clearing the result.

### Disconnect/reconnect

BLE disconnect callbacks do not alter the logical session. ACTIVE and COMPLETED state remain in memory, advertising restarts, and the mobile app can reconnect and issue SYNC.

## DEV SIMULATION

The normal `esp32dev` environment reads GPIO26 and GPIO12. `BallDetectionDebouncer` accepts one rising IR level per physical pulse and rejects a new pulse inside the 100 ms debounce window.

With the explicit `esp32dev-sim` environment (`FIKK_DEV_SIMULATION=1`), while ACTIVE the device increments the count once every 2 seconds through the same `registerBallDetection()` path used by sensor input. The simulation environment is mutually exclusive with the physical input loop. The default mobile target is six.

The buzzer and LED outputs remain unassigned; no GPIO pins are invented for them.

## Serial debugging

The firmware emits bounded logs for:

```text
BOOT
BLE_INIT
BLE_ADVERTISING
BLE_CONNECTED
BLE_DISCONNECTED
CONTROL_RX
START
STOP
SYNC
ACK_RESULT
STATE_CHANGE
EVENT_TX
ERROR
```

Protocol packets are logged as bounded hexadecimal data. Simulation logs are rate-limited to one progress event per 2-second simulation interval.

## Tests

Protocol tests are in the PlatformIO test environment and cover all byte fixtures, round-trips, malformed lengths/types/versions/states, and invalid START payloads.

```bash
# Compile the ESP32 firmware
pio run -d firmware -e esp32dev

# Compile the ESP32 protocol test without uploading or running it
pio test -d firmware -e esp32dev --without-uploading --without-testing

# Run protocol tests on a connected ESP32 board
pio test -d firmware -e esp32dev --upload-port COMx --test-port COMx

# Host-native test alternative (requires gcc/g++)
pio test -d firmware -e native
```

The ESP32 test was compile-validated in this workspace. Runtime execution requires a connected board and serial port. The native test environment requires a Windows `gcc`/`g++` toolchain, which is not installed in this workspace.

## Physical validation procedure

1. Flash the board with `pio run -d firmware -e esp32dev -t upload --upload-port COMx`.
2. Open `pio device monitor -d firmware -e esp32dev`.
3. Confirm BOOT, BLE_INIT, and BLE_ADVERTISING.
4. Open the OVbAT custom development build.
5. Scan for `OVbAT-ESP32` using the service UUID.
6. Connect to the device.
7. Discover the custom service.
8. Confirm CONTROL, EVENT, STATE, and DEVICE_INFO.
9. Read DEVICE_INFO.
10. Read STATE.
11. Subscribe to EVENT and STATE notifications.
12. Send START with a non-zero session ID and target count six.
13. Confirm accepted ACK and ACTIVE STATE.
14. Confirm DEV SIMULATION PROGRESS notifications.
15. Confirm COMPLETE at count six, or send STOP and confirm a stopped result.
16. Disconnect without resetting the device.
17. Reconnect and send SYNC.
18. Confirm ACTIVE or COMPLETED recovery.
19. Send ACK_RESULT with the retained COMPLETE sequence.
20. Confirm accepted ACK and READY STATE.

## Known hardware unknowns

- Confirmed board: ESP32 DevKit V1.
- Exact ESP chip/module: unknown.
- Physical hardware revision: unknown.
- No GPIO or sensor wiring is assumed.
- Physical Android/iOS validation has not been performed from this workspace.
- Pairing, bonding, and application-layer authentication are not enabled.
