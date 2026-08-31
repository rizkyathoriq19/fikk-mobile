# Graph Report - fikk-mobile  (2026-08-31)

## Corpus Check
- 72 files · ~35,490 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 732 nodes · 1302 edges · 53 communities (33 shown, 20 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 30 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d53eafb2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ReactNativeBleManagerTransport
- connection-controller.ts
- TrainingProvider.tsx
- TrainingDevice
- Packet
- ESP BLE Training Device Discovery Questionnaire
- dependencies
- scripts
- Fikk Mobile ESP32 BLE Firmware
- TrainingSessionController
- native-session-store.ts
- session-controller.ts
- validate-esp32-ble.sh
- FakeBleTransport
- TrainingSession
- FakeTrainingConnection
- Product Requirements Document
- session-controller.test.ts
- expo
- BallDetectionDebouncer
- .update
- tsconfig.json
- BLE Training App and IoT Device
- BLE foundation spike
- 6. User Experience Requirements
- Issue tracker: GitHub
- Domain Docs
- 9. BLE GATT Contract — Protocol v1
- Agent skills
- 10. Mobile Technical Architecture
- Appendix C — Implementation Notes
- 17. Test Strategy
- 11. Data Model and Persistence
- 12. Functional Requirements
- 3. Product Goals and Non-Goals
- 5. Source Flow Interpretation
- triage-labels.md
- 13. Error Handling and Recovery
- 8. BLE Connection and Session State
- 01-validate-physical-ble-foundation.md
- 02-connect-compatible-device-ready.md
- 03-start-six-ball-session.md
- 04-complete-six-ball-result.md
- 05-save-discard-history.md
- 06-recover-after-disconnect.md
- 07-restore-after-app-interruption.md
- 08-harden-failures-accessibility.md
- 09-physical-matrix-release.md
- react-native
- react-native-ble-manager
- react-native-safe-area-context
- react-native-worklets

## God Nodes (most connected - your core abstractions)
1. `TrainingDevice` - 47 edges
2. `TrainingSessionController` - 40 edges
3. `Packet` - 31 edges
4. `BluetoothConnectionController` - 26 edges
5. `Product Requirements Document` - 25 edges
6. `ReactNativeBleManagerTransport` - 22 edges
7. `FakeBleTransport` - 22 edges
8. `TrainingSession` - 19 edges
9. `BleTransport` - 16 edges
10. `encodeMessage()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `handleAckResult` --calls--> `readUint16()`  [INFERRED]
  firmware/src/main.cpp → firmware/include/Protocol.h
- `publishEvent` --calls--> `encodePacket()`  [INFERRED]
  firmware/src/main.cpp → firmware/include/Protocol.h
- `publishStatePacket` --calls--> `encodePacket()`  [INFERRED]
  firmware/src/main.cpp → firmware/include/Protocol.h
- `handleControl` --calls--> `decodePacket()`  [INFERRED]
  firmware/src/main.cpp → firmware/include/Protocol.h
- `sendAck` --calls--> `makeAck()`  [INFERRED]
  firmware/src/main.cpp → firmware/include/Protocol.h

## Import Cycles
- None detected.

## Communities (53 total, 20 thin omitted)

### Community 0 - "ReactNativeBleManagerTransport"
Cohesion: 0.09
Nodes (23): createFikkNativeBleTransport(), createNativeBleTransport(), FIKK_BLE_PROFILE, FIKK_BLE_UUIDS, BLE_CHARACTERISTICS, BleCharacteristic, BleProfile, createBleProfile() (+15 more)

### Community 1 - "connection-controller.ts"
Cohesion: 0.07
Nodes (30): BluetoothConnectionController, BluetoothConnectionControllerOptions, BluetoothConnectionStatus, BluetoothPermissionGateway, decodeText(), delay(), DeviceIdentityStore, initialSnapshot (+22 more)

### Community 2 - "TrainingProvider.tsx"
Cohesion: 0.07
Nodes (37): expo-router, node, react, ResultField(), ResultFieldProps, styles, Screen(), ScreenProps (+29 more)

### Community 3 - "TrainingDevice"
Cohesion: 0.08
Nodes (54): BLECharacteristic, BLECharacteristicCallbacks, BLEServer, BLEServerCallbacks, ControlCallbacks, AckStatus, CompletionReason, DecodeError (+46 more)

### Community 4 - "Packet"
Cohesion: 0.10
Nodes (45): array, decodePacket(), DecodeResult, error, encodePacket(), expectedPayloadLength(), AckStatus, CompletionReason (+37 more)

### Community 5 - "ESP BLE Training Device Discovery Questionnaire"
Cohesion: 0.05
Nodes (37): Anything else?, Are the protocol v1 envelope fields exactly one-byte version, one-byte message type, four-byte little-endian session ID, two-byte little-endian sequence, and message-specific payload?, Are there any firmware limitations on concurrent connections, reconnect timing, or notification ordering?, Are there MTU, packet-size, connection-interval, power, or scan-duration constraints we must respect?, Context, Device and firmware, Does the device continue timing and counting after BLE disconnect?, Does the device expose all four required characteristics after service discovery, and are UUIDs case/hyphen stable across Android and iOS? (+29 more)

### Community 6 - "dependencies"
Cohesion: 0.13
Nodes (15): expo, expo-constants, expo-linking, expo-sqlite, dependencies, expo, expo-constants, expo-linking (+7 more)

### Community 7 - "scripts"
Cohesion: 0.18
Nodes (11): babel-preset-expo, devDependencies, babel-preset-expo, tsx, @types/node, @types/react, typescript, tsx (+3 more)

### Community 8 - "Fikk Mobile ESP32 BLE Firmware"
Cohesion: 0.08
Nodes (23): ACK_RESULT, ACK status values, BLE identity, Build, flash, and monitor, Characteristics, Completion and stop reasons, Deterministic byte fixtures, DEV SIMULATION (+15 more)

### Community 9 - "TrainingSessionController"
Cohesion: 0.06
Nodes (13): TrainingSession, TrainingSessionRepository, SessionRow, SQLiteTrainingSessionRepository, toTrainingSession(), createLocalId(), isCompletionReason(), isValidProgress() (+5 more)

### Community 10 - "native-session-store.ts"
Cohesion: 0.05
Nodes (34): ConnectionSnapshot, AsyncStorageTrainingSessionStore, isPersistedResult(), isPersistedTrainingSession(), isUint32(), initialSnapshot, MVP_TARGET_COUNT, PendingRecovery (+26 more)

### Community 11 - "session-controller.ts"
Cohesion: 0.22
Nodes (9): scripts, android, android:build, android:install, android:prebuild, expo:config, start, test (+1 more)

### Community 12 - "validate-esp32-ble.sh"
Cohesion: 0.22
Nodes (15): ask(), banner(), _clear(), confirm(), finish(), note(), open_url(), pause() (+7 more)

### Community 14 - "TrainingSession"
Cohesion: 0.40
Nodes (4): main, name, private, version

### Community 16 - "Product Requirements Document"
Cohesion: 0.12
Nodes (15): 14. Non-Functional Requirements, 15. Security and BLE Safety, 16. Acceptance Criteria, 18. Delivery Plan, 19. Risks and Open Decisions, 1. Executive Summary, 20. Definition of Done for MVP, 2. Problem Statement (+7 more)

### Community 18 - "expo"
Cohesion: 0.12
Nodes (15): package, expo, android, ios, name, orientation, plugins, scheme (+7 more)

### Community 19 - "BallDetectionDebouncer"
Cohesion: 0.18
Nodes (7): BallDetectionDebouncer, debounceMs_, hasAcceptedDetection_, lastAcceptedAtMs_, sensorWasActive_, test_held_low_does_not_trigger(), test_one_physical_pulse_produces_one_detection()

### Community 21 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): expo/tsconfig.base, **/*.ts, **/*.tsx, compilerOptions, noEmit, strict, extends, include

### Community 22 - "BLE Training App and IoT Device"
Cohesion: 0.22
Nodes (8): BLE Training App and IoT Device, Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Solution, Testing Decisions, User Stories

### Community 23 - "BLE foundation spike"
Cohesion: 0.22
Nodes (8): BLE foundation spike, Blocked physical checks, Implemented evidence, Question, Recommendation for the real build, Verdict: PARTIAL, What did not, What worked

### Community 24 - "6. User Experience Requirements"
Cohesion: 0.25
Nodes (8): 6.1 Dashboard, 6.2 Home, 6.3 Start Training / Notes, 6.4 Bluetooth Connection, 6.5 Active Training, 6.6 Result and Save, 6.7 History, 6. User Experience Requirements

### Community 25 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 26 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 27 - "9. BLE GATT Contract — Protocol v1"
Cohesion: 0.33
Nodes (6): 9.1 Characteristics, 9.2 Packet Envelope, 9.3 Message Types, 9.4 Device State Codes, 9.5 Example Session Sequence, 9. BLE GATT Contract — Protocol v1

### Community 28 - "Agent skills"
Cohesion: 0.33
Nodes (5): Agent skills, Domain docs, graphify, Issue tracker, Triage labels

### Community 29 - "10. Mobile Technical Architecture"
Cohesion: 0.40
Nodes (5): 10.1 System Architecture, 10.2 Recommended Mobile Baseline, 10.3 Suggested Module Boundaries, 10.4 Suggested Mobile State Model, 10. Mobile Technical Architecture

### Community 30 - "Appendix C — Implementation Notes"
Cohesion: 0.40
Nodes (5): Appendix C — Implementation Notes, Mobile is not the timer source, Recommended ownership boundaries, Sequence behavior, Session ID behavior

### Community 31 - "17. Test Strategy"
Cohesion: 0.50
Nodes (4): 17.1 Mobile Unit / Integration Tests, 17.2 Firmware Tests, 17.3 Physical Device Matrix, 17. Test Strategy

### Community 32 - "11. Data Model and Persistence"
Cohesion: 0.67
Nodes (3): 11.1 `TrainingSession`, 11.2 Idempotency Constraint, 11. Data Model and Persistence

### Community 33 - "12. Functional Requirements"
Cohesion: 0.67
Nodes (3): 12.1 Mobile Requirements, 12.2 BLE Requirements, 12. Functional Requirements

### Community 34 - "3. Product Goals and Non-Goals"
Cohesion: 0.67
Nodes (3): 3.1 Goals, 3.2 Non-Goals for MVP, 3. Product Goals and Non-Goals

### Community 35 - "5. Source Flow Interpretation"
Cohesion: 0.67
Nodes (3): 5.1 Mobile Product Flow, 5.2 Source Labels → Product Screens, 5. Source Flow Interpretation

## Knowledge Gaps
- **250 isolated node(s):** `name`, `slug`, `version`, `orientation`, `userInterfaceStyle` (+245 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TrainingSessionController` connect `TrainingSessionController` to `native-session-store.ts`, `TrainingProvider.tsx`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `FakeBleTransport` connect `FakeBleTransport` to `ReactNativeBleManagerTransport`, `connection-controller.ts`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `BluetoothConnectionController` connect `connection-controller.ts` to `ReactNativeBleManagerTransport`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _250 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReactNativeBleManagerTransport` be split into smaller, more focused modules?**
  _Cohesion score 0.08571428571428572 - nodes in this community are weakly interconnected._
- **Should `connection-controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06821787414066631 - nodes in this community are weakly interconnected._
- **Should `TrainingProvider.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._