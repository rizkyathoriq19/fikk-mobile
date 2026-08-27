# ESP BLE Training Device Discovery Questionnaire

**Purpose:** Collect the ESP/BLE contract and physical-test details needed to finish ticket `01` for Fikk Mobile: validate the custom development build, finalize the protocol profile, and prove BLE read/write/notify behavior.

**From:** Implementation agent — **To:** Project owner / ESP BLE integrator — **How your answers will be used:** Populate the mobile BLE profile, align the mobile codec with firmware, and prepare physical Android/iOS validation.

## Context

Fikk Mobile is an offline-first Expo React Native app using `react-native-ble-manager`. The software foundation now has a protocol v1 codec, a fake BLE transport, a native BLE adapter, and custom development-build configuration. The board is confirmed as an ESP32 DevKit V1, and firmware version 0.1.0 with a stable BLE v1 service/profile is implemented in `firmware/`; physical flashing/discovery and the exact ESP chip/module and hardware revision remain unverified.

## How to answer

Please answer before the next physical BLE validation session. Estimated effort: 10–15 minutes if the firmware details are available. Use exact values copied from firmware or a BLE inspection tool where possible. Partial answers and “I don’t know” are useful; flag assumptions instead of guessing.

## Device and firmware

### What exact ESP chip/module and hardware revision are used on the ESP32 DevKit V1 board?

_Why this matters: it determines the BLE stack, platform-specific behavior, and build/test assumptions._

> Known board: ESP32 DevKit V1.
> Exact ESP chip/module:
> Hardware revision:

### What firmware version, repository, branch, and build artifact should the mobile app target?

_Why this matters: the mobile contract must be tied to a reproducible firmware version._

> Firmware version: 0.1.0.
> Repository/location: `firmware/` in this repository.
> Branch and physical build artifact: not specified or verified.

### Who owns or can update the firmware if the mobile contract exposes a mismatch?

>

### Is the target device already advertising BLE, or must the firmware BLE service be implemented or changed?

> The firmware implementation advertises `Fikk-ESP32` and the custom service UUID. Physical advertisement has not been verified.

## GATT profile

### What is the exact custom BLE service UUID?

_Why this matters: the app cannot reliably filter or connect to the product device without the service identifier._

> `c8c5aefd-0e30-525e-9bf9-5243913c8127`

### What is the exact UUID for the CONTROL characteristic?

> `c42f890d-088a-5b19-bcd4-5029fceb2bcc`

### What is the exact UUID for the EVENT characteristic?

> `57a6c81b-268e-5eed-995b-2149521b911f`

### What is the exact UUID for the STATE characteristic?

> `8271b32c-fa20-5adc-a4d0-141bf24baa71`

### What is the exact UUID for the DEVICE_INFO characteristic?

> `98ef338e-f5f8-5ea4-b89f-116d303090a3`

### What properties does each characteristic support?

_Why this matters: confirm Read, Write With Response, Notify, or Indicate for CONTROL, EVENT, STATE, and DEVICE_INFO._

| Characteristic | Read | Write with response | Notify | Indicate | Notes |
|---|---|---|---|---|---|
| CONTROL | No | Yes | No | No | App commands |
| EVENT | No | No | Yes | No | Async protocol events |
| STATE | Yes | No | Yes | No | Current state snapshot |
| DEVICE_INFO | Yes | No | No | No | UTF-8 development information |

### What service UUID, manufacturer data, or local-name data appears in advertisements?

_Why this matters: the scanner must reject unrelated nearby BLE devices._

> Local name: `Fikk-ESP32`. Advertised service UUID: `c8c5aefd-0e30-525e-9bf9-5243913c8127`. Manufacturer data is not configured.

### Does the device expose all four required characteristics after service discovery, and are UUIDs case/hyphen stable across Android and iOS?

> The firmware creates CONTROL, EVENT, STATE, and DEVICE_INFO with stable UUID constants. Physical discovery and cross-platform UUID behavior remain unverified.

## Protocol and device behavior

### Are the protocol v1 envelope fields exactly one-byte version, one-byte message type, four-byte little-endian session ID, two-byte little-endian sequence, and message-specific payload?

_Why this matters: the mobile codec currently implements this contract._

> Confirmed by firmware implementation: version `0x01`, message type `u8`, session ID `u32` little-endian, sequence `u16` little-endian, followed by the message-specific payload. Maximum packet length is 14 bytes.

### Provide one real byte-level sample for each command and event that the firmware currently supports.

_Why this matters: fixtures must be compared against an independent firmware source, not generated from the mobile implementation._

| Message | Direction | Hex bytes or capture | Meaning |
|---|---|---|---|
| START | App → ESP | `01 01 04 03 02 01 06 05 06` | session `0x01020304`, sequence `0x0506`, target `6` |
| STOP | App → ESP | `01 02 09 00 00 00 0A 00 03` | session `9`, sequence `10`, reason `3` |
| SYNC | App → ESP | `01 03 09 00 00 00 0B 00` | session `9`, sequence `11` |
| ACK_RESULT | App → ESP | `01 04 09 00 00 00 0C 00 CD AB` | session `9`, sequence `12`, result sequence `0xABCD` |
| ACK | ESP → App | `01 81 09 00 00 00 0D 00 01 00` | START accepted |
| PROGRESS | ESP → App | `01 82 09 00 00 00 0E 00 05 04 03 02 01` | session `9`, sequence `14`, count `5`, elapsed `0x01020304` |
| COMPLETE | ESP → App | `01 83 09 00 00 00 0F 00 06 08 07 06 05 01` | session `9`, sequence `15`, count `6`, target reached |
| STATE | ESP → App | `01 84 09 00 00 00 10 00 02 06 0C 0B 0A 09` | COMPLETED, count `6`, elapsed `0x090A0B0C` |
| ERROR | ESP → App | `01 FF 09 00 00 00 11 00 EF BE` | error code `0xBEEF` |

### What target count, completion reason, stop reason, ACK status, device state, and error-code values are implemented?

> Target count from the mobile MVP: `6`.
> Device states: READY=`0`, ACTIVE=`1`, COMPLETED=`2`, ERROR=`3`.
> ACK statuses: ACCEPTED=`0`, REJECTED=`1`, INVALID_STATE=`2`, INVALID_PACKET=`3`, UNSUPPORTED=`4`.
> Completion reasons: TARGET_REACHED=`1`, STOPPED=`2`, DEVICE_ERROR=`3`.
> Stop reasons: USER=`1`, DEVICE_ERROR=`2`, RESTART=`3`.
> Error codes: INVALID_PACKET=`0x0001`, INVALID_STATE=`0x0002`, UNSUPPORTED_VERSION=`0x0003`, INVALID_TARGET=`0x0004`, RESULT_NOT_FOUND=`0x0005`.

### What happens when START is repeated with the same active session ID?

_Why this matters: the app must not reset an active timer or counter during retry._

> The firmware returns an accepted ACK and does not reset the active timer, count, target, or session ID.

### What happens when START is sent with a different session ID while the device is ACTIVE or COMPLETED?

> The firmware returns an INVALID_STATE ACK and ERROR without resetting or replacing the current logical session.

### Does the device continue timing and counting after BLE disconnect?

> The firmware keeps the logical session in memory and does not reset it in the BLE disconnect callback. Physical disconnect/reconnect behavior remains unverified.

### What does SYNC return for READY, ACTIVE, and COMPLETED states?

> SYNC returns an accepted ACK and a STATE snapshot. READY reports session ID zero; ACTIVE reports the current session ID, count, and elapsed time; COMPLETED reports the retained completed state and replays COMPLETE with the retained result sequence.

### How long is a completed result retained, and what exact ACK_RESULT action clears or replaces it?

> The latest completed result is retained until ACK_RESULT matches the completed session ID and COMPLETE sequence. A matching ACK_RESULT returns an accepted ACK, clears the result, and transitions to READY. A mismatch returns a rejected ACK and RESULT_NOT_FOUND ERROR without clearing it.

## Physical validation

### Which Android phone is available for the first physical BLE test?

_Why this matters: ticket 01 requires a real Android custom development build, not Expo Go or a simulator._

>

### Which iPhone and Mac/Xcode environment are available for iOS validation?

_Why this matters: iOS development builds require macOS/Xcode or an agreed EAS/TestFlight workflow._

>

### Is an Apple Developer account or EAS build access available for the iOS development build?

>

### What is the shortest repeatable physical test procedure for scan, connect, discover, subscribe, read, write-with-response, and disconnect?

_Why this matters: the result should be reproducible and tied to expected firmware behavior._

1. Power on the ESP device:
2. Open the custom mobile development build:
3. Start BLE scan:
4. Select the expected device:
5. Confirm discovered service/characteristics:
6. Read STATE or DEVICE_INFO:
7. Subscribe to EVENT or STATE:
8. Send a safe test CONTROL packet:
9. Confirm expected ACK/state response:
10. Disconnect:

### What result counts as a successful physical validation, and where should captures/logs be stored?

> Firmware-side expected behavior is documented in `firmware/README.md`; no physical validation result or capture location is established yet.

## Security and operating constraints

### Does the device require pairing, bonding, a PIN, or application-layer authentication?

_Why this matters: the MVP currently avoids mandatory pairing unless the threat model requires it._

> No pairing, bonding, PIN, or application-layer authentication is implemented in the firmware.

### Are there MTU, packet-size, connection-interval, power, or scan-duration constraints we must respect?

> Protocol packets are limited to 14 bytes by the firmware codec. No custom MTU, connection-interval, power, or scan-duration settings are defined.

### Are there any firmware limitations on concurrent connections, reconnect timing, or notification ordering?

> The firmware preserves the logical session through BLE disconnect and restarts advertising after disconnect. Physical reconnect timing, concurrent-connection behavior, and cross-platform notification ordering are not verified.

## Anything else?

What device, firmware, protocol, or test detail did we not ask that could change the mobile implementation?

>
