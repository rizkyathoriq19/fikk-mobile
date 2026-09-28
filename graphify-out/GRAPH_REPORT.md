# Graph Report - ovbat  (2026-09-28)

## Corpus Check
- 85 files · ~46,186 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: (none) 2, .ini 1)

## Summary
- 843 nodes · 1573 edges · 60 communities (42 shown, 18 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `aa25d3c2`
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
- expo-dev-client
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
- ticket-03.md
- ticket-04.md
- ticket-05.md
- OVbAT Training
- 0001-device-authoritative-active-session-flow.md
- 0002-physical-start-button-gates-session-timer.md
- 7. Microcontroller Training Flow

## God Nodes (most connected - your core abstractions)
1. `TrainingDevice` - 58 edges
2. `TrainingSessionController` - 44 edges
3. `Packet` - 31 edges
4. `BluetoothConnectionController` - 27 edges
5. `Product Requirements Document` - 25 edges
6. `ReactNativeBleManagerTransport` - 24 edges
7. `FakeBleTransport` - 22 edges
8. `TrainingSession` - 21 edges
9. `OVbAT BLE API Contract` - 17 edges
10. `BleTransport` - 16 edges

## Surprising Connections (you probably didn't know these)
- `11.1 `TrainingSession`` --references--> `TrainingSession`  [INFERRED]
  PRD.md → src/features/history/session-repository.ts
- `Testing Decisions` --references--> `TrainingConnection`  [INFERRED]
  .scratch/ovbat-hardware/spec.md → src/features/training/session-controller.ts
- `Testing Decisions` --references--> `TrainingSessionController`  [INFERRED]
  .scratch/ovbat-hardware/spec.md → src/features/training/session-controller.ts
- `DEV SIMULATION` --references--> `registerBallDetection`  [INFERRED]
  firmware/README.md → firmware/src/main.cpp
- `handleAckResult` --calls--> `readUint16()`  [INFERRED]
  firmware/src/main.cpp → firmware/include/Protocol.h

## Import Cycles
- None detected.

## Communities (60 total, 18 thin omitted)

### Community 0 - "ReactNativeBleManagerTransport"
Cohesion: 0.07
Nodes (18): react-native-ble-manager, createFikkNativeBleTransport(), createNativeBleTransport(), BLE_CHARACTERISTICS, BleCharacteristic, BleProfile, createBleProfile(), BleManagerClient (+10 more)

### Community 1 - "connection-controller.ts"
Cohesion: 0.05
Nodes (41): ref_node_assert, ref_node_test, @react-native-async-storage/async-storage, FIKK_BLE_PROFILE, FIKK_BLE_UUIDS, BleDevice, BluetoothContext, BluetoothContextValue (+33 more)

### Community 2 - "TrainingProvider.tsx"
Cohesion: 0.07
Nodes (54): expo-router, react, react-native, react-native-safe-area-context, ResultField(), ResultFieldProps, styles, Screen() (+46 more)

### Community 3 - "TrainingDevice"
Cohesion: 0.05
Nodes (75): arduino, ble2902, bleadvertising, BLECharacteristic, BLECharacteristicCallbacks, bledevice, BLEServer, BLEServerCallbacks (+67 more)

### Community 4 - "Packet"
Cohesion: 0.09
Nodes (50): array, cstddef, decodePacket(), DecodeResult, error, encodePacket(), expectedPayloadLength(), AckStatus (+42 more)

### Community 5 - "ESP BLE Training Device Discovery Questionnaire"
Cohesion: 0.07
Nodes (27): 1. Daily Android development, 2. One-time Android development build, 3. Native changes versus JavaScript changes, 4. Build a debug APK later, 5.1 Open Home, 5.2 Connect from Settings, 5.3 Start training, 5.4 Complete and handle the Result (+19 more)

### Community 6 - "dependencies"
Cohesion: 0.12
Nodes (16): dependencies, expo, expo-constants, expo-dev-client, expo-linking, expo-router, expo-sqlite, expo-symbols (+8 more)

### Community 7 - "scripts"
Cohesion: 0.33
Nodes (6): devDependencies, babel-preset-expo, tsx, @types/node, @types/react, typescript

### Community 8 - "Fikk Mobile ESP32 BLE Firmware"
Cohesion: 0.08
Nodes (24): ACK_RESULT, ACK status values, Android + ESP mode, BLE identity, Build, flash, and monitor, Characteristics, Completion and stop reasons, Deterministic byte fixtures (+16 more)

### Community 9 - "TrainingSessionController"
Cohesion: 0.13
Nodes (4): isCompletionReason(), isValidProgress(), StartTimeoutError, TrainingSessionController

### Community 10 - "native-session-store.ts"
Cohesion: 0.16
Nodes (9): ConnectionSnapshot, acceptedStart(), activeState(), complete(), device, FakeTrainingConnection, makeCompletedSession(), TrainingConnection (+1 more)

### Community 11 - "session-controller.ts"
Cohesion: 0.22
Nodes (9): scripts, android, android:build, android:install, android:prebuild, expo:config, start, test (+1 more)

### Community 12 - "validate-esp32-ble.sh"
Cohesion: 0.23
Nodes (17): ask(), ask_secret(), banner(), _clear(), confirm(), _existing(), finish(), note() (+9 more)

### Community 14 - "TrainingSession"
Cohesion: 0.12
Nodes (16): main, name, private, version, babel-preset-expo, expo, expo-constants, expo-dev-client (+8 more)

### Community 15 - "expo-dev-client"
Cohesion: 0.07
Nodes (29): 10.1 ACK — `0x81`, 10.2 PROGRESS — `0x82`, 10.3 COMPLETE — `0x83`, 10.4 STATE — `0x84`, 10.5 ERROR — `0xff`, 10. Event contracts, 11. Session and sequence rules, 12. Connection and recovery ordering (+21 more)

### Community 16 - "Product Requirements Document"
Cohesion: 0.12
Nodes (15): 14. Non-Functional Requirements, 15. Security and BLE Safety, 16. Acceptance Criteria, 18. Delivery Plan, 19. Risks and Open Decisions, 1. Executive Summary, 20. Definition of Done for MVP, 2. Problem Statement (+7 more)

### Community 17 - "session-controller.test.ts"
Cohesion: 0.12
Nodes (16): initialSnapshot, MVP_TARGET_COUNT, PendingRecovery, PendingStart, StateMessage, toPersistedSession(), TrainingResult, TrainingSessionControllerOptions (+8 more)

### Community 18 - "expo"
Cohesion: 0.14
Nodes (13): package, expo, android, ios, name, orientation, plugins, scheme (+5 more)

### Community 19 - "BallDetectionDebouncer"
Cohesion: 0.13
Nodes (9): cstdint, BallDetectionDebouncer, debounceMs_, hasAcceptedDetection_, lastAcceptedAtMs_, sensorWasActive_, test_held_low_does_not_trigger(), test_one_physical_pulse_produces_one_detection() (+1 more)

### Community 20 - ".update"
Cohesion: 0.16
Nodes (9): AsyncStorageTrainingSessionStore, isPersistedResult(), isPersistedTrainingSession(), isUint32(), MemoryTrainingSessionStore, PersistedTrainingResult, PersistedTrainingSession, PersistedTrainingSessionState (+1 more)

### Community 21 - "tsconfig.json"
Cohesion: 0.25
Nodes (7): expo/tsconfig.base, compilerOptions, noEmit, strict, types, extends, include

### Community 22 - "BLE Training App and IoT Device"
Cohesion: 0.22
Nodes (8): BLE Training App and IoT Device, Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Solution, Testing Decisions, User Stories

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
Cohesion: 0.14
Nodes (10): 11.1 `TrainingSession`, 11.2 Idempotency Constraint, 11. Data Model and Persistence, expo-sqlite, TrainingSession, TrainingSessionRepository, SessionRow, SQLiteTrainingSessionRepository (+2 more)

### Community 33 - "12. Functional Requirements"
Cohesion: 0.67
Nodes (3): 12.1 Mobile Requirements, 12.2 BLE Requirements, 12. Functional Requirements

### Community 34 - "3. Product Goals and Non-Goals"
Cohesion: 0.67
Nodes (3): 3.1 Goals, 3.2 Non-Goals for MVP, 3. Product Goals and Non-Goals

### Community 35 - "5. Source Flow Interpretation"
Cohesion: 0.67
Nodes (3): 5.1 Mobile Product Flow, 5.2 Source Labels → Product Screens, 5. Source Flow Interpretation

### Community 38 - "8. BLE Connection and Session State"
Cohesion: 0.22
Nodes (8): Further Notes, Implementation Decisions, Out of Scope, Parent, Problem Statement, Solution, Testing Decisions, User Stories

### Community 49 - "react-native"
Cohesion: 0.29
Nodes (4): expo-symbols, styles, TabName, tabSymbols

### Community 50 - "react-native-ble-manager"
Cohesion: 0.29
Nodes (3): createLocalId(), isValidSessionId(), normalizeNotes()

### Community 51 - "react-native-safe-area-context"
Cohesion: 0.40
Nodes (4): Acceptance criteria, Blocked by, Parent, What to build

### Community 52 - "react-native-worklets"
Cohesion: 0.40
Nodes (4): Acceptance criteria, Blocked by, Parent, What to build

### Community 53 - "ticket-03.md"
Cohesion: 0.40
Nodes (4): Acceptance criteria, Blocked by, Parent, What to build

### Community 54 - "ticket-04.md"
Cohesion: 0.40
Nodes (4): Acceptance criteria, Blocked by, Parent, What to build

### Community 55 - "ticket-05.md"
Cohesion: 0.40
Nodes (4): Acceptance criteria, Blocked by, Parent, What to build

## Knowledge Gaps
- **314 isolated node(s):** `name`, `slug`, `version`, `orientation`, `userInterfaceStyle` (+309 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 412 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TrainingSession` connect `11. Data Model and Persistence` to `session-controller.test.ts`, `TrainingProvider.tsx`, `native-session-store.ts`, `TrainingSessionController`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `Product Requirements Document` connect `Product Requirements Document` to `11. Data Model and Persistence`, `12. Functional Requirements`, `3. Product Goals and Non-Goals`, `5. Source Flow Interpretation`, `13. Error Handling and Recovery`, `9. BLE GATT Contract — Protocol v1`, `6. User Experience Requirements`, `7. Microcontroller Training Flow`, `10. Mobile Technical Architecture`, `Appendix C — Implementation Notes`, `17. Test Strategy`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **What connects `name`, `slug`, `version` to the rest of the system?**
  _314 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ReactNativeBleManagerTransport` be split into smaller, more focused modules?**
  _Cohesion score 0.0660377358490566 - nodes in this community are weakly interconnected._
- **Should `connection-controller.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05462962962962963 - nodes in this community are weakly interconnected._
- **Should `TrainingProvider.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07382091592617908 - nodes in this community are weakly interconnected._
- **Should `TrainingDevice` be split into smaller, more focused modules?**
  _Cohesion score 0.05443037974683544 - nodes in this community are weakly interconnected._