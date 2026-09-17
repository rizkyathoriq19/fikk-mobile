# OVbAT BLE API Contract

**Status:** Protocol v1
**Scope:** Mobile app ↔ OVbAT ESP32 training device
**Transport:** Bluetooth Low Energy GATT
**Last verified from:** `src/protocol/*`, `src/ble/*`, `firmware/include/Protocol.h`

## 1. Boundary

OVbAT does not expose or require an HTTP API for the MVP. The integration contract is a local BLE GATT service and a compact binary protocol. The product is offline-first:

- the ESP32 owns sensor qualification, counting, timing, feedback, completion, and retained result state;
- the mobile app owns permissions, discovery, connection lifecycle, operator notes, recovery orchestration, and local SQLite history;
- neither side should infer the other's authoritative values.

## 2. BLE identity

The device advertises local name `OVbAT-ESP32` and the following custom service:

| Item | UUID |
|---|---|
| Service | `c8c5aefd-0e30-525e-9bf9-5243913c8127` |
| CONTROL | `c42f890d-088a-5b19-bcd4-5029fceb2bcc` |
| EVENT | `57a6c81b-268e-5eed-995b-2149521b911f` |
| STATE | `8271b32c-fa20-5adc-a4d0-141bf24baa71` |
| DEVICE_INFO | `98ef338e-f5f8-5ea4-b89f-116d303090a3` |

### Characteristic properties

| Characteristic | Direction | Required property | Contract |
|---|---|---|---|
| CONTROL | Mobile → device | Write With Response | Commands: START, STOP, SYNC, ACK_RESULT |
| EVENT | Device → mobile | Notify | ACK, PROGRESS, COMPLETE, STATE, ERROR |
| STATE | Device → mobile | Read + Notify | Current device/session snapshot |
| DEVICE_INFO | Device → mobile | Read | UTF-8 diagnostic identity string |

The mobile app must not report `Ready` until it has completed connection, GATT discovery, EVENT/STATE subscriptions, and initial DEVICE_INFO/STATE reads.

## 3. Packet envelope

All binary packets use protocol version `0x01` and little-endian multi-byte integers.

| Offset | Size | Field | Encoding |
|---:|---:|---|---|
| 0 | 1 | `version` | `u8`, must be `0x01` |
| 1 | 1 | `messageType` | `u8` |
| 2 | 4 | `sessionId` | unsigned `u32`, little-endian |
| 6 | 2 | `sequence` | unsigned `u16`, little-endian |
| 8 | 0–6 | `payload` | message-specific bytes |

Maximum packet size is **14 bytes**. The header is 8 bytes. Each message has an exact payload length; extra, missing, truncated, unknown, or unsupported data is rejected.

A non-zero `sessionId` identifies one logical training session. `sessionId = 0` is used by the device's READY snapshot and is not a valid mobile-created training session.

## 4. Message types

| Type | Name | Direction | Payload | Payload bytes | Total bytes |
|---:|---|---|---|---:|---:|
| `0x01` | START | Mobile → device | `targetCount:u8` | 1 | 9 |
| `0x02` | STOP | Mobile → device | `reason:u8` | 1 | 9 |
| `0x03` | SYNC | Mobile → device | none | 0 | 8 |
| `0x04` | ACK_RESULT | Mobile → device | `resultSequence:u16` LE | 2 | 10 |
| `0x81` | ACK | Device → mobile | `command:u8`, `status:u8` | 2 | 10 |
| `0x82` | PROGRESS | Device → mobile | `count:u8`, `elapsedMs:u32` LE | 5 | 13 |
| `0x83` | COMPLETE | Device → mobile | `count:u8`, `durationMs:u32` LE, `reason:u8` | 6 | 14 |
| `0x84` | STATE | Device → mobile | `state:u8`, `count:u8`, `elapsedMs:u32` LE | 6 | 14 |
| `0xff` | ERROR | Device → mobile | `errorCode:u16` LE | 2 | 10 |

The header `sequence` is the sequence of the packet itself. `ACK_RESULT.resultSequence` is the sequence of the retained COMPLETE packet and is separate from the ACK_RESULT header sequence.

## 5. Device states

| Value | Name | Meaning |
|---:|---|---|
| `0` | READY | No active or retained completed session |
| `1` | ACTIVE | A session is running on the device |
| `2` | COMPLETED | A completed result is retained |
| `3` | ERROR | Device is reporting an error state |
| `4` | ARMED | A session is prepared and waiting for the physical start button |

Legal MVP lifecycle:

```text
READY → ARMED → ACTIVE → COMPLETED → READY
  │        │          │
  └────────┴──────────┴─ ERROR may be reported without fabricating a result
```

Malformed packets and impossible values must not reset a valid device session or create a mobile result.

## 6. ACK status values

| Value | Name | Meaning |
|---:|---|---|
| `0` | ACCEPTED | Command accepted |
| `1` | REJECTED | Command rejected |
| `2` | INVALID_STATE | Command is not legal in the current state |
| `3` | INVALID_PACKET | Command packet is invalid |
| `4` | UNSUPPORTED | Command or capability is unsupported |

For an ACK, `payload.command` contains the command type being acknowledged, normally `START`, `STOP`, `SYNC`, or `ACK_RESULT`.

## 7. Completion and stop reasons

### Completion reasons

| Value | Name |
|---:|---|
| `1` | TARGET_REACHED |
| `2` | STOPPED |
| `3` | DEVICE_ERROR |

### STOP reasons

| Value | Name |
|---:|---|
| `1` | USER |
| `2` | DEVICE_ERROR |
| `3` | RESTART |

The mobile UI must display these as semantic labels, not as unexplained numeric values.

## 8. Error codes

| Code | Name | Meaning |
|---:|---|---|
| `0x0001` | INVALID_PACKET | Packet shape or payload is invalid |
| `0x0002` | INVALID_STATE | Command is not legal in the current device state |
| `0x0003` | UNSUPPORTED_VERSION | Protocol version is not supported |
| `0x0004` | INVALID_TARGET | Target count is invalid |
| `0x0005` | RESULT_NOT_FOUND | Requested retained result is unavailable or sequence does not match |

The mobile app preserves the error code in diagnostics, moves the training flow to an error/recovery state as appropriate, and never creates a successful result from an ERROR event.

## 9. Command contracts

### 9.1 START — `0x01`

**Request:** Mobile writes to CONTROL with:

- `version = 0x01`;
- `messageType = 0x01`;
- a new non-zero `sessionId`;
- `sequence = 0` for the MVP request;
- payload `targetCount = 6`.

Example for `sessionId = 0x01020304`:

```text
01 01 04 03 02 01 00 00 06
```

**Preconditions:**

- mobile has a fully synchronized Ready device;
- no mobile session is already `starting` or `active`;
- `targetCount > 0`; the MVP sends `6`.

**Accepted response:** Device sends ACK with `command = START`, matching session ID, and `status = ACCEPTED`, then publishes ARMED STATE. The mobile app enters its waiting-for-button state after the ACK and enters `Active` only after the Device Start Button produces ACTIVE STATE.

**Timeout/retry:** The mobile waits up to 3 seconds for application ACK. On timeout it reads STATE, compares the session ID, and performs at most one safe retry. It must not blindly send START if the device is already ARMED, ACTIVE, or COMPLETED.

**Idempotency:** A duplicate START for the same currently armed or active session ID is acknowledged without resetting count, target, or timer. A different session ID while ARMED or ACTIVE is rejected.

### 9.2 STOP — `0x02`

**Request:** Mobile writes a one-byte stop reason for the current ACTIVE session.

Example from the validation fixture (`sessionId = 9`, request sequence `10`, reason `3`):

```text
01 02 09 00 00 00 0A 00 03
```

STOP is optional for the MVP operator flow. When implemented by the device, it returns an accepted ACK, emits COMPLETE with reason STOPPED, and publishes COMPLETED STATE.

### 9.3 SYNC — `0x03`

**Request:** Mobile writes a no-payload SYNC for the logical session ID.

Example (`sessionId = 9`, request sequence `11`):

```text
01 03 09 00 00 00 0B 00
```

**Preconditions:** GATT discovery and EVENT/STATE subscriptions must be complete after reconnect.

**Responses:**

- READY: device reports no retained session; mobile surfaces a recoverable lost-session error rather than starting automatically;
- ARMED: device returns the same session ID with zero elapsed time; mobile resumes its waiting-for-button state;
- ACTIVE: device returns the same session ID, current count, and authoritative elapsed time; mobile resumes `Active`;
- COMPLETED: device returns retained state and replays COMPLETE with the retained result sequence; mobile shows `Result`;
- ERROR: mobile preserves the error code and does not fabricate completion.

SYNC never starts a new session.

### 9.4 ACK_RESULT — `0x04`

**Request:** Mobile acknowledges the exact sequence of a handled COMPLETE event.

Example from the validation fixture (`sessionId = 9`, request sequence `12`, result sequence `0xABCD`):

```text
01 04 09 00 00 00 0C 00 CD AB
```

**Save path:** Mobile persists the complete result to SQLite first, then writes ACK_RESULT. This ordering prevents data loss if the BLE write fails.

**Discard path:** Mobile writes ACK_RESULT without inserting a History row, then returns to Home.

**Accepted response:** Device sends an accepted ACK, clears the retained result, and returns to READY.

**Sequence mismatch:** Device sends rejected ACK and RESULT_NOT_FOUND ERROR and retains the result. The mobile app must not guess a replacement sequence.

## 10. Event contracts

### 10.1 ACK — `0x81`

ACK correlates to the command in `payload.command` and the session in the packet header. `status = ACCEPTED` is the only status that advances the command's successful state.

Example accepted START ACK from the fixture:

```text
01 81 09 00 00 00 0D 00 01 00
```

### 10.2 PROGRESS — `0x82`

Payload:

```text
count:u8 | elapsedMs:u32 little-endian
```

The count and elapsed time are authoritative device values. The mobile UI displays them but never recomputes the stored final duration from the phone clock.

Mobile acceptance rules:

- matching current session ID;
- sequence newer than the highest accepted sequence;
- `0 <= count <= targetCount`;
- count and elapsed time do not regress;
- current mobile state is ACTIVE.

Example fixture:

```text
01 82 09 00 00 00 0E 00 05 04 03 02 01
```

### 10.3 COMPLETE — `0x83`

Payload:

```text
count:u8 | durationMs:u32 little-endian | reason:u8
```

COMPLETE is the source of truth for final count, duration, and completion reason. A valid COMPLETE moves the mobile flow to `completed` and retains the result until Save or Discard handles it.

Mobile acceptance rules:

- matching current session ID;
- newer sequence;
- final count is within the target range and does not regress;
- duration does not regress;
- reason is one of the defined completion reasons;
- current mobile state is ACTIVE or Recovering.

Example target-reached fixture:

```text
01 83 09 00 00 00 0F 00 06 08 07 06 05 01
```

### 10.4 STATE — `0x84`

Payload:

```text
state:u8 | count:u8 | elapsedMs:u32 little-endian
```

STATE is used for initial synchronization, START timeout safety checks, and reconnect/app-launch recovery.

Example COMPLETED STATE fixture:

```text
01 84 09 00 00 00 10 00 02 06 0C 0B 0A 09
```

### 10.5 ERROR — `0xff`

Payload:

```text
errorCode:u16 little-endian
```

Example fixture:

```text
01 FF 09 00 00 00 11 00 EF BE
```

The mobile app preserves the diagnostic code. An ERROR during pending START rejects that command immediately and must not trigger a timeout retry. An ERROR during ACTIVE stops the active flow without creating a result.

## 11. Session and sequence rules

- The mobile-generated logical session ID remains unchanged across START retries, disconnect recovery, app relaunch, SYNC, COMPLETE, Save, and Discard.
- The mobile controller tracks the highest accepted sequence for the current session.
- Older, duplicate, wrong-session, malformed, or out-of-order events are ignored without moving visible progress backward.
- A retained completed result is accepted only through the current session's recovery path; unrelated session events are ignored.
- A transport write succeeding only means the BLE link accepted the write. Application ACK determines command acceptance.

## 12. Connection and recovery ordering

Initial connection:

```text
request permission
  → initialize adapter
  → confirm adapter ON
  → scan for 5 seconds using service UUID
  → connect
  → discover service and characteristics
  → subscribe EVENT
  → subscribe STATE
  → read DEVICE_INFO and STATE
  → Ready
```

Recovery:

```text
transport disconnect
  → mobile Recovering
  → bounded reconnect attempts: 0 ms, 250 ms, 500 ms delay
  → connect and rediscover GATT
  → resubscribe EVENT and STATE
  → SYNC with original session ID
  → resume ACTIVE or show retained Result
```

Recovery does not send a new START. If the device reports READY, the mobile keeps the unresolved session identity and surfaces that the device no longer retains it.

## 13. Local persistence contract

SQLite database name: `fikk.db`.

Table: `training_sessions`.

| Field | Type | Meaning |
|---|---|---|
| `id` | text primary key | Mobile local UUID |
| `ble_session_id` | integer | Device session ID |
| `notes` | text nullable | Trimmed operator notes, max 500 characters |
| `target_count` | integer | MVP value `6` |
| `final_count` | integer | Device COMPLETE count |
| `duration_ms` | integer | Device COMPLETE duration |
| `started_at` | text | App-observed start metadata |
| `completed_at` | text | App-observed completion metadata |
| `device_key` | text | Stable BLE device identity |
| `device_name` | text nullable | Advertised/device name |
| `status` | text | `completed`, `recovered`, or `cancelled` |
| `protocol_version` | integer | `1` |

Uniqueness is enforced by `(device_key, ble_session_id)`. Save and recovery use upsert semantics, so repeated COMPLETE, SYNC, or Save operations do not create duplicate logical History rows.

## 14. Device information

The current firmware returns this UTF-8 value from DEVICE_INFO:

```text
firmware=0.1.0;protocol=1;board=ESP32 DevKit V1;chip=unknown;hardware_revision=unknown
```

The confirmed board is ESP32 DevKit V1. Exact chip/module, hardware revision, GPIO assignments, and sensor wiring are intentionally unspecified until physically verified.

## 15. Compatibility and security boundaries

- Protocol version must be exactly `1`.
- Unknown message types, invalid payload lengths, truncated packets, invalid states, impossible counts, and invalid target values are rejected.
- No HTTP server, account, cloud sync, pairing/bonding requirement, or application-layer authentication is part of the MVP contract.
- Training notes remain local and are not included in production diagnostic logs.
- Physical interoperability, GPIO behavior, LED/buzzer feedback, and native runtime behavior require validation on the actual hardware/device matrix; passing codec or fake-transport tests is not physical proof.

## Source references

- `src/ble/fikk-profile.ts`
- `src/ble/transport.ts`
- `src/features/bluetooth/connection-controller.ts`
- `src/features/training/session-controller.ts`
- `src/features/history/session-repository.ts`
- `src/features/history/sqlite-session-repository.ts`
- `src/protocol/codec.ts`
- `src/protocol/constants.ts`
- `firmware/include/Protocol.h`
- `firmware/README.md`
