# BLE foundation spike

## Question

Can the Fikk Mobile Expo baseline communicate with the target BLE training device through a versioned protocol and a transport-neutral seam?

## Implemented evidence

- Expo SDK 57.0.17, React Native 0.86.3, `expo-dev-client` 57.0.16, and `react-native-ble-manager` 12.5.1 are pinned.
- The app config enables a custom development build and the BLE manager config plugin.
- Protocol v1 encode/decode covers the defined envelope and all defined command/event payloads.
- Invalid protocol versions, message types, payload lengths, device states, and numeric values are rejected.
- The transport seam has a fake adapter and a `react-native-ble-manager` adapter with injected client tests for scan filtering, discovery, notification setup, reads, writes, and disconnect.
- Official references used: [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction) and [react-native-ble-manager Expo setup](https://innoveit.github.io/react-native-ble-manager/expo).

## Blocked physical checks

- The target microcontroller firmware repository and hardware are not available in this workspace.
- Final service and characteristic UUID values have not been supplied by firmware; the adapter therefore requires a caller-supplied profile instead of inventing identifiers.
- This Windows host cannot compile or install an iOS development build. Android physical validation also requires the target hardware and Android native toolchain.

## Verdict: PARTIAL

### What worked

- The software protocol and adapter seam are type-safe and covered by automated tests.
- The Expo configuration is ready for a custom development build once the target profile is known.

### What did not

- Physical Android/iOS-to-microcontroller communication is not validated.
- UUID sharing with firmware is not complete.

### Recommendation for the real build

- Obtain the firmware-owned UUID profile and target hardware, inject it into the adapter factory, then run the physical read/write/notify proof before starting the Ready UI slice.
