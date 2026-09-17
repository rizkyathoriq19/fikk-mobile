# OVbAT — How to Use

OVbAT is an offline-first Expo React Native app for operating the OVbAT ESP32 BLE training device.

- **Mobile:** permissions, BLE discovery, connection lifecycle, operator notes, recovery, and local History.
- **Device:** sensor qualification, ball count, elapsed time, feedback, completion, and retained result.
- **Network:** not required for the training workflow.
- **Runtime:** use a custom Expo development build. Expo Go is not supported because the app uses native BLE modules.

See [`api-contract.md`](./api-contract.md) for the BLE UUID and protocol v1 contract.

## Device-only operation

Android is optional for a local ESP-only Training Session:

1. Leave the Device in `READY`.
2. Press and release the physical GPIO12 Device Start Button.
3. The timer starts immediately; send six balls through the GPIO26 IR sensor.
4. The completed count and duration remain on the LCD.
5. Release and press the Device Start Button again to start the next session.

For the Android + ESP flow, use the app's Start action first, then press the physical Device Start Button when the LCD shows `Press device btn`.

## 1. Daily Android development

### Start Metro

From the repository root:

```bash
pnpm start
```

This runs:

```text
expo start --dev-client
```

Metro is the JavaScript development server. TypeScript and UI changes reload through Metro; they do not require a Gradle rebuild.

To start Metro and ask Expo to open Android automatically:

```bash
pnpm run android
```

`pnpm run android` does **not** build or install the native app. A compatible OVbAT development build must already be installed.

### Connect a physical Android phone over USB

Enable Developer options and USB debugging on the phone, connect it, and authorize the computer when prompted:

```bash
adb devices
```

Expected state:

```text
<device-serial>    device
```

For a USB Metro connection, forward the development server port:

```bash
adb reverse tcp:8081 tcp:8081
```

Open the installed **OVbAT** development build and select the local development server if the launcher asks for one. With `adb reverse`, the app can use `localhost:8081`.

If Metro is already running from `pnpm start`, do not start a second server. Open the development build manually.

## 2. One-time Android development build

The first native build requires Android Studio tooling, Android SDK, JDK 17, and a connected emulator or phone.

Set the Android SDK variables on Windows. Restart the terminal after using `setx`:

```cmd
setx ANDROID_HOME "C:\Users\<user>\AppData\Local\Android\Sdk"
setx ANDROID_SDK_ROOT "C:\Users\<user>\AppData\Local\Android\Sdk"
```

Git Bash equivalent for the current shell:

```bash
export ANDROID_HOME=/c/Users/<user>/AppData/Local/Android/Sdk
export ANDROID_SDK_ROOT="$ANDROID_HOME"
```

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Generate the native Android project, compile the debug variant, and install it:

```bash
pnpm run android:install
```

This runs:

```text
expo prebuild --platform android
cd android && gradlew.bat installDebug
```

After installation, return to the daily workflow with `pnpm start` or `pnpm run android`.

## 3. Native changes versus JavaScript changes

| Change | Action |
|---|---|
| TypeScript, screen layout, labels, controller logic | Restart/reload Metro only |
| Add/update a native dependency | Run `pnpm run android:install` |
| Change `app.json` native configuration | Run `pnpm run android:install` |
| Upgrade Expo SDK or React Native | Run `pnpm run android:install` and review prebuild output |
| Need only a debug APK file | Run `pnpm run android:build` |

The generated `android/` directory is ignored by Git and recreated by `android:prebuild`.

## 4. Build a debug APK later

Build the native debug APK with Gradle:

```bash
pnpm run android:build
```

This runs:

```text
expo prebuild --platform android
cd android && gradlew.bat assembleDebug
```

APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install an already-built APK directly when a device is connected:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

This is a debug APK. The generated release configuration currently uses the development/debug signing setup and is not a store-release signing process. Production release signing must be configured before distribution.

## 5. Use the app

### 5.1 Open Home

Home shows:

- BLE device status;
- optional training notes;
- the six-ball training action;
- recovery/error messages;
- active count and authoritative elapsed time;
- a link to the completed Result.

Training notes are optional, trimmed before use, and limited to 500 characters. Notes stay local and are not part of production diagnostic logs.

If no synchronized Ready device exists, **Connect device first** opens Settings instead of sending START.

### 5.2 Connect from Settings

1. Open **Settings**.
2. Confirm Bluetooth is enabled.
3. Tap **Scan for devices**.
4. Select the compatible device, normally shown as `OVbAT-ESP32`.
5. Tap **Connect**.
6. Wait for GATT discovery, EVENT/STATE subscriptions, DEVICE_INFO/STATE reads, and the `Ready` status.

A device is not considered Ready from a transport connection alone. The app requires the product service, required characteristics, subscriptions, and initial state synchronization.

Settings also exposes:

- adapter state;
- connection state;
- last device identifier;
- firmware/device information when available;
- current device STATE;
- **Reconnect last device** after a disconnect.

Scanning is bounded to five seconds and stops when the scan finishes. The app does not continuously scan.

### 5.3 Start training

1. Return to **Home**.
2. Enter optional notes.
3. Confirm the device status is `Ready`.
4. Tap **Start Training**.
5. Wait for the device acknowledgement.

The app creates one non-zero BLE session ID and sends `START` with target count `6`. After the device accepts START, it enters `Armed` and waits for the physical GPIO12 button. Press that button on the device to start the timer and enter `Active`. Duplicate start actions are disabled while a session is arming or active.

The ESP32 remains authoritative for:

- valid ball detections;
- count;
- elapsed time;
- completion reason.

The mobile count/time display mirrors device PROGRESS and STATE data. It is not the source of truth.

### 5.4 Complete and handle the Result

When the device sends a valid COMPLETE event, Home shows that training is complete and the app exposes **View Result**.

Result displays:

- final count out of six;
- authoritative device duration;
- start timestamp;
- completion timestamp;
- notes;
- device name;
- completion reason.

Choose one action:

- **Save Result** — writes the session to local SQLite first, then acknowledges the retained device result, then opens History.
- **Discard** — acknowledges the device result without creating a History row, then returns to Home.

Save is idempotent by stable device key plus BLE session ID. Repeated Save, COMPLETE, or recovery events do not create duplicate logical History rows.

### 5.5 Browse History

1. Open **History**.
2. Saved sessions appear newest first.
3. Each row shows date/time, notes preview, final count, and duration.
4. Tap a row to open full details.

History is stored in the local `fikk.db` SQLite database and remains available without internet access. Detail includes device ID, status, protocol version, timestamps, notes, count, and duration.

Only saved results appear in History. Discarded results do not create rows.

## 6. Disconnect and app interruption recovery

### BLE disconnect during training

If BLE disconnects while START is unresolved, the device is `Armed`, or training is active:

1. Home enters `Recovering`.
2. The app explains that the device session may still be running.
3. The app attempts bounded reconnects.
4. It repeats GATT discovery and EVENT/STATE subscriptions.
5. It sends SYNC using the original session ID.
6. It resumes the waiting-for-button state from ARMED, resumes Active from device STATE, or shows a retained Result from COMPLETE.

The app never blindly sends a new START during recovery.

### Relaunch after interruption

On app launch, the app restores a persisted unresolved session and remembered device identity. It then attempts reconnect and SYNC without creating a new session. A retained completed result remains available for Save or Discard.

If the device no longer retains the session, the app keeps the unresolved identity and shows a recoverable error. It does not invent count, duration, or completion data.

## 7. Firmware development and simulation

The firmware target is the confirmed ESP32 DevKit V1. The physical wiring contract is IR sensor GPIO26 active-HIGH, Start Button GPIO12 active-LOW with an external 3.3V pull resistor, LCD SCL GPIO22, LCD SDA GPIO21, and a 20x4 I2C LCD at address `0x27`. The exact chip/module and hardware revision remain unverified.

Build the firmware:

```bash
pio run -d firmware -e esp32dev
```

Flash a connected board:

```bash
pio run -d firmware -e esp32dev -t upload --upload-port COMx
```

Monitor serial output:

```bash
pio device monitor -d firmware -e esp32dev --port COMx
```

The default `esp32dev` firmware build uses the physical GPIO inputs. The optional `esp32dev-sim` environment enables `FIKK_DEV_SIMULATION=1`; while ACTIVE, it sends one qualified detection approximately every two seconds through the same path used by sensor input. It emits bounded buzzer/LED feedback logs, PROGRESS, and one COMPLETE at six.

Simulation validates protocol and software flow only. It does not prove real IR sensor, buzzer, LED, timing, or GPIO behavior.

For the guided physical procedure:

```bash
bash scripts/validate-esp32-ble.sh
```

## 8. Troubleshooting

### `No development build ... is installed`

Expo is trying to open the custom dev client, but it is not installed. Build/install it once:

```bash
pnpm run android:install
```

Expo Go cannot substitute for this app because the BLE transport is native.

### `adb devices` is empty

- Keep the phone unlocked.
- Use a USB data cable.
- Enable USB debugging.
- Accept the RSA authorization prompt.
- Restart ADB if needed:

```bash
adb kill-server
adb start-server
adb devices
```

### Metro is running but the app cannot connect

Use USB port forwarding:

```bash
adb reverse tcp:8081 tcp:8081
```

Then reload the development build. For Wi-Fi development, keep the phone and computer on the same network and select the computer's reachable Metro URL in the dev-client launcher.

### Gradle cannot find the Android SDK

Set `ANDROID_HOME` and `ANDROID_SDK_ROOT`, restart the terminal, and confirm the SDK contains the Android platform/build tools required by the generated project. A local `android/local.properties` file may also be used; it is ignored and must not be committed with a user-specific path.

### Native build reports a Reanimated/Worklets mismatch

Use the Expo SDK 57-compatible versions in `package.json`:

- `react-native-reanimated`: `4.5.1`
- `react-native-worklets`: `0.10.1`

Reinstall from the lockfile and rebuild:

```bash
pnpm install --frozen-lockfile
pnpm run android:install
```

Do not solve this by disabling New Architecture or downgrading unrelated Expo packages.

### No compatible BLE device is found

- Confirm the firmware is flashed and advertising.
- Confirm Bluetooth is enabled.
- Confirm the device advertises `OVbAT-ESP32` and the OVbAT service UUID.
- Confirm the mobile app is a custom development build.
- Confirm the device's GATT service contains CONTROL, EVENT, STATE, and DEVICE_INFO.

### Training result is not shown

The app accepts only valid, newer, same-session protocol events. Check the device serial log for START, ACK, PROGRESS, COMPLETE, and ERROR. A malformed packet, wrong session ID, stale sequence, invalid state, or device ERROR is intentionally not converted into a result.

## 9. Known limitations

- Physical Android, iOS, and ESP32 interoperability is not fully validated yet.
- iOS native builds require macOS/Xcode.
- Real sensor/buzzer/LED validation requires the hardware pinout and connected board.
- The phone does not own authoritative timing or ball counting.
- Full background BLE UX is outside the MVP; the device continues independently and the app recovers on reconnect or relaunch.
- No cloud account, remote sync, backend API, or internet connection is required for saved local History.
