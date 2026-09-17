# Fundamental Program Microcontroller OVbAT

Dokumen ini menjelaskan program ESP32 pada folder `firmware/` dari dasar. Target pembacanya adalah orang yang baru mulai belajar microcontroller, Arduino, C++, BLE, sensor, dan LCD.

> **Sumber penjelasan:** implementasi aktual pada `firmware/src/main.cpp`, `firmware/include/*.h`, dan `firmware/platformio.ini`.
>
> **Catatan penting:** wiring final yang digunakan program adalah IR GPIO26, tombol GPIO12, LCD SCL GPIO22, dan LCD SDA GPIO21. Jika wiring fisik berbeda, program dapat berhasil di-compile tetapi perangkat tidak bekerja sesuai harapan.

---

## 1. Apa fungsi program ini?

Program ini membuat ESP32 menjadi **alat training OVbAT**. Tanggung jawab utama ESP32 adalah:

1. Menyediakan koneksi BLE bernama `OVbAT-ESP32`.
2. Menerima perintah training dari aplikasi Android OVbAT.
3. Menyiapkan satu sesi training dalam state `ARMED`.
4. Menunggu tombol fisik GPIO12 ditekan.
5. Memulai timer hanya setelah tombol fisik ditekan.
6. Membaca sensor IR GPIO26.
7. Menghitung bola berdasarkan pulse sensor IR.
8. Mengakhiri sesi ketika target tercapai, default-nya 6 bola.
9. Menyimpan hasil selesai di memori runtime sampai aplikasi mengirim `ACK_RESULT`.
10. Menampilkan status lokal melalui LCD 20x4.

ESP32 adalah sumber kebenaran untuk tiga hal penting:

- jumlah bola;
- waktu training;
- kapan training benar-benar dimulai dan selesai.

Aplikasi Android hanya mengirim perintah, menampilkan data, menyimpan history lokal, dan memulihkan sesi setelah koneksi BLE terputus.

---

## 2. Gambaran besar alur program

```text
ESP32 menyala
    |
    v
Inisialisasi GPIO, LCD, BLE, dan state READY
    |
    v
Aplikasi terhubung melalui BLE
    |
    v
Aplikasi mengirim START(sessionId, targetCount=6)
    |
    v
ESP32 masuk ARMED
(timer belum berjalan, sensor belum menghitung)
    |
    v
Pengguna menekan tombol fisik GPIO12
    |
    v
ESP32 masuk ACTIVE
(timer dimulai)
    |
    v
Sensor IR GPIO26 membaca pulse
    |
    v
Satu pulse valid = satu bola
    |
    v
Count mencapai target 6
    |
    v
ESP32 masuk COMPLETED dan menahan hasil
    |
    v
Aplikasi Save atau Discard
    |
    v
Aplikasi mengirim ACK_RESULT
    |
    v
ESP32 menghapus hasil yang ditahan dan kembali READY
```

State normalnya adalah:

```text
READY → ARMED → ACTIVE → COMPLETED → READY
```

`ERROR` dapat muncul ketika ada packet rusak, command tidak sesuai state, atau masalah protocol. Error tidak boleh dibuat menjadi hasil training palsu.

---

## 3. Struktur folder firmware

```text
firmware/
├── include/
│   ├── BleProfile.h       # Nama BLE, UUID, dan metadata device
│   ├── DeviceState.h      # Enum state dan alasan completion/error
│   ├── InputDebouncer.h   # Filter pulse sensor agar tidak terhitung ganda
│   └── Protocol.h         # Format packet BLE dan encoder/decoder
├── src/
│   └── main.cpp           # Program utama dan alur device
├── test/
│   ├── test_input_debouncer/
│   └── test_protocol/
├── platformio.ini         # Board, framework, dependency, environment build
└── README.md              # Catatan build dan validation firmware
```

`main.cpp` adalah pengatur utama. Header di `include/` memisahkan konsep agar protocol, state, dan debounce dapat dipakai serta diuji secara terpisah.

---

## 4. Library dan header yang digunakan

### 4.1 `Arduino.h`

```cpp
#include <Arduino.h>
```

Ini adalah header utama Arduino/ESP32. Program memakai beberapa fungsi fundamental darinya:

| Fungsi | Arti untuk pemula |
|---|---|
| `pinMode(pin, mode)` | Menentukan GPIO sebagai input atau output |
| `digitalRead(pin)` | Membaca nilai digital HIGH atau LOW dari GPIO |
| `millis()` | Mengambil waktu sejak board menyala dalam milidetik |
| `Serial.begin(115200)` | Membuka komunikasi log melalui USB serial |
| `Serial.println(...)` | Mencetak log ke serial monitor |
| `delay(1)` | Menunggu sebentar sebelum loop berikutnya |

Program tidak memakai library timer khusus. Timer training dihitung dari perbedaan nilai `millis()`.

Contoh konsep timer:

```cpp
startedAtMs_ = millis();

// Beberapa saat kemudian:
elapsed = millis() - startedAtMs_;
```

Karena `millis()` terus bertambah, program tidak perlu menghentikan CPU selama training.

### 4.2 BLE Arduino untuk ESP32

Header BLE yang dipakai:

```cpp
#include <BLE2902.h>
#include <BLEAdvertising.h>
#include <BLECharacteristic.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEService.h>
#include <BLEUtils.h>
```

BLE adalah Bluetooth Low Energy. Di program ini BLE dipakai untuk komunikasi data kecil antara Android dan ESP32.

Konsep BLE yang perlu dipahami:

- **Server:** ESP32 yang menyediakan data dan menerima command.
- **Service:** kelompok fitur BLE OVbAT.
- **Characteristic:** titik komunikasi individual di dalam service.
- **Write:** aplikasi menulis command ke ESP32.
- **Read:** aplikasi membaca data dari ESP32.
- **Notify:** ESP32 mengirim perubahan data tanpa harus terus-menerus ditanya aplikasi.
- **Advertising:** ESP32 mengumumkan bahwa dirinya tersedia untuk ditemukan.
- **Callback:** fungsi yang otomatis dipanggil ketika event BLE terjadi, misalnya client connect, disconnect, atau write.
- **Descriptor `BLE2902`:** descriptor umum yang membantu mengaktifkan notifikasi characteristic pada client BLE.

Characteristic yang dibuat:

| Characteristic | Arah | Fungsi |
|---|---|---|
| `CONTROL` | Android → ESP32 | START, STOP, SYNC, ACK_RESULT |
| `EVENT` | ESP32 → Android | ACK, PROGRESS, COMPLETE, ERROR, dan event state |
| `STATE` | ESP32 → Android | Snapshot state device; dapat dibaca dan diberi notifikasi |
| `DEVICE_INFO` | ESP32 → Android | Informasi firmware/device dalam text UTF-8 |

### 4.3 `Wire.h`

```cpp
#include <Wire.h>
```

`Wire` adalah library Arduino untuk I2C. I2C adalah komunikasi dua kabel antara ESP32 dan device seperti LCD backpack.

Pada program:

```cpp
Wire.begin(kLcdSdaPin, kLcdSclPin);
```

Nilainya adalah:

```text
SDA = GPIO21
SCL = GPIO22
```

- **SDA** membawa data.
- **SCL** membawa clock/sinyal pengatur waktu komunikasi.

### 4.4 `LiquidCrystal_I2C`

Dependency ini dicantumkan di `platformio.ini`:

```ini
lib_deps =
  marcoschwartz/LiquidCrystal_I2C@^1.1.4
```

Library ini menyederhanakan komunikasi dengan LCD character melalui I2C. Tanpa library ini, program harus mengirim command LCD satu per satu secara manual.

Objek LCD dibuat sebagai:

```cpp
LiquidCrystal_I2C lcd_{0x27, 20, 4};
```

Artinya:

- alamat I2C: `0x27`;
- jumlah kolom: `20`;
- jumlah baris: `4`.

Method yang digunakan:

| Method | Fungsi |
|---|---|
| `init()` | Menginisialisasi LCD |
| `backlight()` | Menyalakan lampu belakang LCD |
| `setCursor(column, row)` | Memindahkan posisi tulisan |
| `print(text)` | Menulis text ke LCD |

### 4.5 Header C++ standard library

```cpp
#include <cstdio>
#include <cstring>
#include <string>
```

| Header | Pemakaian |
|---|---|
| `<cstdio>` | `std::snprintf()` untuk membuat text berformat, misalnya `Count: 3/6` |
| `<cstring>` | `std::strlen()` untuk menghitung panjang text LCD |
| `<string>` | `std::string` untuk menerima nilai BLE dan membuat `DEVICE_INFO` |

Contoh:

```cpp
std::snprintf(line, sizeof(line), "Count: %u/%u", count_, targetCount_);
```

`snprintf` membuat text ke buffer dengan batas ukuran. Ini lebih aman daripada membuat string tanpa batas.

### 4.6 Header buatan project

```cpp
#include "BleProfile.h"
#include "DeviceState.h"
#include "InputDebouncer.h"
#include "Protocol.h"
```

Header ini bukan library eksternal; semuanya adalah kode project OVbAT.

- `BleProfile.h` menyimpan identitas BLE dan UUID.
- `DeviceState.h` menyimpan state dan alasan hasil.
- `InputDebouncer.h` menyaring pulse sensor.
- `Protocol.h` mengatur format byte packet.

### 4.7 PlatformIO

PlatformIO bukan library runtime. PlatformIO adalah alat untuk:

1. memilih board ESP32;
2. mengunduh framework Arduino;
3. mengunduh dependency;
4. compile source;
5. membuat firmware binary;
6. upload binary ke board;
7. menjalankan test environment.

Konfigurasi board ada di `platformio.ini`:

```ini
platform = espressif32@6.10.0
board = esp32dev
framework = arduino
monitor_speed = 115200
```

---

## 5. Wiring hardware

| Komponen | GPIO / konfigurasi | Makna sinyal |
|---|---:|---|
| Sensor IR | GPIO26 | Active-HIGH; pulse terdeteksi ketika pin HIGH |
| Tombol start | GPIO12 | Active-LOW; ditekan berarti pin LOW |
| LCD SDA | GPIO21 | Jalur data I2C |
| LCD SCL | GPIO22 | Jalur clock I2C |
| LCD | I2C address `0x27`, 20x4 | Display lokal |

### 5.1 Tombol GPIO12

Program menggunakan:

```cpp
pinMode(kStartButtonPin, INPUT);
```

GPIO12 menggunakan **external pull resistor 3.3V** sesuai wiring yang telah ditentukan. Program tidak mengaktifkan `INPUT_PULLUP` internal untuk pin ini.

Karena tombol active-LOW:

```cpp
const bool startButtonPressed = digitalRead(kStartButtonPin) == LOW;
```

Artinya:

- `HIGH`: tombol tidak ditekan;
- `LOW`: tombol ditekan.

GPIO12 adalah strapping pin ESP32. Karena itu, wiring resistor dan level tegangan harus benar agar board tetap dapat boot.

### 5.2 Sensor IR GPIO26

Program membaca sensor sebagai active-HIGH:

```cpp
handleSensorLevel(digitalRead(kIrSensorPin) == HIGH, now);
```

Artinya:

- pin LOW: tidak ada pulse aktif;
- pin HIGH: sensor sedang aktif.

Program menghitung perubahan pulse melalui `BallDetectionDebouncer`, bukan menghitung setiap loop ketika pin tetap HIGH.

### 5.3 LCD

Program menghubungkan I2C secara eksplisit:

```cpp
Wire.begin(kLcdSdaPin, kLcdSclPin);
lcd_.init();
lcd_.backlight();
```

Jika LCD tidak tampil, penyebab paling umum adalah:

1. SDA dan SCL tertukar;
2. address bukan `0x27`;
3. ground tidak tersambung;
4. level tegangan tidak aman;
5. backpack LCD belum mendapat supply;
6. wiring GPIO tidak sesuai tabel.

---

## 6. Dasar C++ yang dipakai program

### 6.1 `class`

```cpp
class TrainingDevice {
 public:
  void begin();
  void loop();

 private:
  void handleStart(const Packet& command);
  DeviceState deviceState_ = DeviceState::Ready;
};
```

`TrainingDevice` adalah cetak biru objek device.

- `public`: fungsi yang boleh dipanggil dari luar class.
- `private`: detail internal yang hanya digunakan class itu sendiri.
- Nama dengan akhiran `_`, misalnya `deviceState_`, adalah variable internal object.

### 6.2 Object

Di `setup()` dibuat satu object:

```cpp
static TrainingDevice device;
g_trainingDevice = &device;
device.begin();
```

Object `device` menyimpan seluruh state training selama ESP32 hidup.

### 6.3 Pointer

```cpp
TrainingDevice* g_trainingDevice = nullptr;
```

Pointer menyimpan alamat object di memory. Callback BLE membutuhkan pointer global agar callback dapat meneruskan event ke object `TrainingDevice`.

### 6.4 `enum class`

State tidak disimpan sebagai text, tetapi sebagai angka yang memiliki nama:

```cpp
enum class DeviceState : uint8_t {
  Ready = 0,
  Active = 1,
  Completed = 2,
  Error = 3,
  Armed = 4,
};
```

`uint8_t` berarti state dikirim sebagai angka unsigned 8-bit, cukup untuk nilai 0 sampai 255.

### 6.5 Reference `const Packet&`

```cpp
void handleStart(const Packet& command);
```

`const Packet&` berarti:

- fungsi menerima object Packet tanpa menyalin seluruh object;
- fungsi tidak boleh mengubah packet tersebut.

### 6.6 `if` dan state guard

Contoh:

```cpp
if (deviceState_ != DeviceState::Armed) {
  return;
}
```

Ini disebut **guard**. Tombol hanya boleh melakukan sesuatu ketika state benar-benar `ARMED`. Jika state `READY`, `ACTIVE`, atau `COMPLETED`, tombol diabaikan.

---

## 7. Urutan program saat ESP32 menyala

Arduino memiliki dua fungsi khusus:

```cpp
void setup();
void loop();
```

### Langkah 1 — `setup()` berjalan satu kali

```cpp
void setup() {
  Serial.begin(115200);
  delay(100);
  static TrainingDevice device;
  g_trainingDevice = &device;
  device.begin();
}
```

Urutannya:

1. Serial dibuka pada baud rate `115200`.
2. Program menunggu sebentar agar serial monitor siap.
3. Object `TrainingDevice` dibuat.
4. Pointer global diarahkan ke object tersebut.
5. `device.begin()` dipanggil.

### Langkah 2 — `TrainingDevice::begin()` menyiapkan BLE dan LCD

Di dalam `begin()`:

1. Program mencetak `BOOT`.
2. I2C/LCD diinisialisasi.
3. LCD menampilkan state awal `READY`.
4. BLE diinisialisasi dengan nama `OVbAT-ESP32`.
5. BLE server dibuat.
6. Callback connect/disconnect dipasang.
7. Service OVbAT dibuat.
8. Characteristic CONTROL, EVENT, STATE, dan DEVICE_INFO dibuat.
9. Advertising dimulai.
10. State awal dikirim ke client jika ada.

Metadata `DEVICE_INFO` berbentuk text:

```text
product=OVbAT;firmware=0.1.0;protocol=1;board=ESP32 DevKit V1;chip=unknown;hardware_revision=unknown
```

### Langkah 3 — `loop()` berjalan berulang-ulang

```cpp
void loop() {
  if (g_trainingDevice != nullptr) {
    g_trainingDevice->loop();
  }
  delay(1);
}
```

`loop()` dijalankan berkali-kali selama board hidup. Program tidak membuat thread training khusus. Semua pekerjaan device dilakukan secara cepat di loop:

- cek tombol;
- cek sensor;
- update LCD jika waktunya;
- jalankan simulasi jika environment simulation digunakan.

---

## 8. Urutan BLE dari Android sampai training

### Langkah 1 — Android menemukan device

ESP32 melakukan advertising dengan:

```text
Local name: OVbAT-ESP32
Service UUID: c8c5aefd-0e30-525e-9bf9-5243913c8127
```

Aplikasi mencari device yang memiliki service dan characteristic yang sesuai. Nama BLE membantu manusia mengenali device, sedangkan UUID memastikan aplikasi berbicara dengan service yang benar.

### Langkah 2 — Android melakukan discovery

Aplikasi menemukan:

- CONTROL untuk menulis command;
- EVENT untuk menerima notification;
- STATE untuk membaca/menerima snapshot state;
- DEVICE_INFO untuk membaca metadata.

Koneksi BLE saja belum berarti device siap digunakan. Discovery dan subscription harus selesai lebih dulu.

### Langkah 3 — Android mengirim `START`

Packet START memiliki format:

```text
version | messageType | sessionId | sequence | targetCount
```

Contoh konseptual:

```text
01 01 04 03 02 01 00 00 06
```

Arti byte tersebut:

| Bagian | Nilai | Arti |
|---|---|---|
| version | `01` | Protocol v1 |
| message type | `01` | START |
| session ID | `04 03 02 01` | ID session little-endian |
| sequence | `00 00` | Nomor urut packet |
| target | `06` | Target 6 bola |

`sessionId` harus bukan nol. Session ID mengikat semua event pada satu training.

### Langkah 4 — ESP32 memvalidasi START

ESP32 memeriksa:

1. packet dapat didecode;
2. version didukung;
3. message type dikenal;
4. panjang payload benar;
5. session ID bukan nol;
6. target count bukan nol;
7. state device sedang `READY`, atau START adalah duplicate untuk session yang sama ketika `ARMED`/`ACTIVE`.

Jika valid:

```text
READY → ARMED
```

ESP32 mengatur:

```cpp
sessionId_ = command.sessionId;
targetCount_ = requestedTarget;
count_ = 0;
startedAtMs_ = 0;
durationMs_ = 0;
deviceState_ = DeviceState::Armed;
```

Timer belum dimulai karena `startedAtMs_` masih nol.

ESP32 lalu mengirim:

1. ACK `ACCEPTED` untuk START;
2. STATE `ARMED`;
3. update LCD.

### Langkah 5 — Android menunggu physical start

Android tidak boleh menganggap timer telah berjalan hanya karena ACK START diterima. Android masuk state aplikasi `armed` dan menampilkan instruksi untuk menekan tombol pada device.

LCD menampilkan:

```text
OVbAT TRAINING
Press device btn
Target: 6 balls

```

### Langkah 6 — Tombol GPIO12 ditekan

Pada setiap putaran loop, program membaca tombol:

```cpp
const bool startButtonPressed = digitalRead(kStartButtonPin) == LOW;
if (startButtonPressed && !startButtonPressed_) {
  handlePhysicalStart();
}
startButtonPressed_ = startButtonPressed;
```

Bagian pentingnya adalah:

```cpp
startButtonPressed && !startButtonPressed_
```

Ini mendeteksi **perubahan dari tidak ditekan menjadi ditekan**, bukan sekadar kondisi LOW terus-menerus.

Jika state bukan `ARMED`, fungsi langsung berhenti. Jika state `ARMED`:

```cpp
startedAtMs_ = millis();
durationMs_ = 0;
deviceState_ = DeviceState::Active;
```

Barulah timer dimulai dan state berubah:

```text
ARMED → ACTIVE
```

ESP32 mengirim STATE `ACTIVE`, sehingga Android baru memindahkan UI ke training aktif.

### Langkah 7 — Sensor IR mulai berlaku

Setiap loop physical normal membaca GPIO26:

```cpp
handleSensorLevel(digitalRead(kIrSensorPin) == HIGH, now);
```

`handleSensorLevel()` meneruskan sinyal ke debouncer. Jika pulse dianggap valid:

```cpp
registerBallDetection();
```

`registerBallDetection()` memiliki guard:

```cpp
if (deviceState_ != DeviceState::Active || count_ >= targetCount_) {
  return;
}
```

Konsekuensinya:

- pulse sebelum tombol ditekan diabaikan;
- pulse saat `ARMED` diabaikan;
- pulse setelah `COMPLETED` diabaikan;
- pulse setelah target tercapai diabaikan.

### Langkah 8 — Bola dihitung

Jika pulse lolos debounce:

```cpp
++count_;
sendProgress();
```

Program juga mencetak feedback log:

```text
BUZZER_FEEDBACK
LED_FEEDBACK
```

Saat count belum mencapai target, ESP32 mengirim progress dan state terbaru.

Payload PROGRESS berisi:

```text
count:u8 | elapsedMs:u32
```

Waktu berasal dari ESP32, bukan perhitungan jam Android.

### Langkah 9 — Target tercapai

Ketika:

```cpp
count_ >= targetCount_
```

program memanggil:

```cpp
completeSession(CompletionReason::TargetReached);
```

Fungsi tersebut:

1. mengambil durasi authoritative;
2. menyimpan alasan completion;
3. mengubah state menjadi `COMPLETED`;
4. menandai hasil sebagai retained;
5. membuat result sequence;
6. mengirim COMPLETE;
7. mengirim STATE `COMPLETED`;
8. mengupdate LCD.

State menjadi:

```text
ACTIVE → COMPLETED
```

LCD menampilkan:

```text
OVbAT TRAINING
Completed
Count: 6/6
Time: 00:18
```

### Langkah 10 — Android Save atau Discard

ESP32 tidak langsung menghapus hasil setelah COMPLETE. Hasil tetap disimpan di runtime device.

#### Save

Aplikasi:

1. menyimpan hasil ke SQLite terlebih dahulu;
2. mengirim `ACK_RESULT` dengan result sequence yang tepat;
3. kembali ke Home/History.

#### Discard

Aplikasi:

1. tidak membuat row History;
2. mengirim `ACK_RESULT`;
3. kembali ke Home.

ESP32 hanya menerima ACK_RESULT jika:

- state saat ini `COMPLETED`;
- result masih retained;
- session ID cocok;
- result sequence cocok.

Jika semuanya cocok:

```text
COMPLETED → READY
```

Tombol tidak dapat memulai sesi baru sebelum hasil lama di-acknowledge.

---

## 9. State machine secara detail

### `READY`

Arti: tidak ada sesi aktif dan tidak ada hasil selesai yang sedang ditahan.

Yang boleh dilakukan:

- menerima START baru;
- menerima SYNC dan melaporkan tidak ada sesi retained.

Yang diabaikan:

- tombol fisik;
- pulse IR;
- ACK_RESULT untuk result yang tidak ada.

LCD:

```text
OVbAT TRAINING
Ready
Press START

```

### `ARMED`

Arti: aplikasi sudah mengirim START dan ESP32 sudah menyiapkan session, tetapi pengguna belum menekan tombol fisik.

Yang boleh dilakukan:

- menerima duplicate START untuk session ID yang sama;
- menerima SYNC;
- menerima physical start button.

Yang belum dilakukan:

- timer belum berjalan;
- pulse IR belum menghitung bola.

LCD:

```text
OVbAT TRAINING
Press device btn
Target: 6 balls

```

### `ACTIVE`

Arti: tombol GPIO12 telah ditekan dan timer berjalan.

Yang dilakukan:

- timer dihitung dari `millis()`;
- GPIO26 diproses;
- progress dikirim;
- completion menunggu target atau STOP.

LCD:

```text
OVbAT TRAINING
Count: 3/6
Time: 00:12
Sensor: READY
```

### `COMPLETED`

Arti: target tercapai atau sesi dihentikan, dan hasil masih ditahan device.

Yang dilakukan:

- hasil tetap tersedia;
- duplicate/late pulse diabaikan;
- tombol diabaikan;
- COMPLETE dapat dikirim ulang saat SYNC;
- menunggu ACK_RESULT.

LCD:

```text
OVbAT TRAINING
Completed
Count: 6/6
Time: 00:18
```

### `ERROR`

Arti: device atau protocol melaporkan error.

Error tidak boleh dianggap sebagai completion sukses. Android menyimpan informasi error untuk recovery dan tidak membuat history sukses dari error tersebut.

---

## 10. Cara kerja debounce sensor IR

Sensor fisik bisa menghasilkan sinyal yang tidak sempurna. Satu bola dapat membuat sinyal HIGH selama beberapa loop. Tanpa debounce, program mungkin menghitung satu bola berkali-kali.

`BallDetectionDebouncer` menyimpan tiga informasi:

```cpp
uint32_t lastAcceptedAtMs_ = 0;
bool sensorWasActive_ = false;
bool hasAcceptedDetection_ = false;
```

Default debounce window adalah 100 ms.

### Aturan debounce

1. Jika sensor LOW:
   - `sensorWasActive_` di-reset menjadi false;
   - tidak ada detection.
2. Jika sensor HIGH dan sebelumnya masih HIGH:
   - pulse dianggap masih pulse yang sama;
   - tidak dihitung lagi.
3. Jika sensor HIGH dan sebelumnya LOW:
   - ini dianggap rising edge baru.
4. Jika rising edge terlalu dekat dengan detection sebelumnya, kurang dari 100 ms:
   - ditolak sebagai kemungkinan noise/double trigger.
5. Jika cukup jauh:
   - diterima sebagai satu bola.

Contoh waktu:

```text
0 ms    sensor LOW
10 ms   sensor HIGH  → diterima, bola +1
20 ms   sensor HIGH  → diabaikan, masih pulse yang sama
50 ms   sensor LOW   → siap menerima pulse berikutnya
80 ms   sensor HIGH  → ditolak, terlalu dekat (<100 ms)
200 ms  sensor LOW
250 ms  sensor HIGH  → diterima, bola +1
```

Debounce 100 ms adalah nilai software. Jika sensor nyata terlalu sensitif atau terlalu lambat, nilai ini mungkin perlu dikalibrasi setelah pengujian fisik.

---

## 11. Cara kerja timer

Program menyimpan waktu mulai hanya ketika tombol fisik ditekan:

```cpp
startedAtMs_ = millis();
```

Selama state `ACTIVE`, fungsi `elapsedMs()` mengembalikan:

```cpp
millis() - startedAtMs_
```

Ketika sesi selesai, durasi disalin ke `durationMs_`. Setelah itu durasi tidak lagi berubah walaupun waktu terus berjalan.

Ini penting karena:

- Android tidak menjadi sumber timer;
- BLE disconnect tidak menghentikan timer device;
- device dapat menyelesaikan sesi tanpa aplikasi tetap terhubung;
- hasil completion tetap memakai waktu device.

### Catatan overflow `millis()`

Perhitungan selisih unsigned seperti:

```cpp
now - previous
```

adalah pola umum Arduino yang tetap aman ketika counter `millis()` melakukan rollover, selama interval yang dibandingkan tidak lebih besar dari batas representasi timer.

---

## 12. Cara kerja LCD renderer

Semua rendering LCD dilakukan oleh:

```cpp
void TrainingDevice::updateDisplay()
```

Baris LCD diberi index 0 sampai 3. Program selalu menulis dari kolom 0.

Helper:

```cpp
void TrainingDevice::writeLcdLine(uint8_t row, const char* text)
```

Helper tersebut:

1. memindahkan cursor ke awal baris;
2. mencetak text;
3. mencetak spasi sampai panjang 20 kolom.

Padding spasi mencegah sisa tulisan state sebelumnya tetap terlihat.

Contoh masalah tanpa padding:

```text
Tulisan lama: Count: 6/6
Tulisan baru: Ready
```

Tanpa clear/padding, LCD dapat menampilkan sisa karakter lama. Dengan padding, seluruh baris ditimpa kembali.

LCD tidak menentukan state. LCD hanya menampilkan state internal `deviceState_`. Data yang dikirim melalui BLE tetap berasal dari state dan counter yang sama.

---

## 13. Format packet protocol

Setiap packet mempunyai header 8 byte:

| Offset | Ukuran | Isi |
|---:|---:|---|
| 0 | 1 byte | protocol version |
| 1 | 1 byte | message type |
| 2 | 4 byte | session ID, little-endian |
| 6 | 2 byte | sequence, little-endian |
| 8 | 0–6 byte | payload |

Maximum packet adalah 14 byte.

### Little-endian

Angka multi-byte dikirim dari byte paling rendah terlebih dahulu.

Contoh angka session ID `0x01020304` disimpan sebagai:

```text
04 03 02 01
```

Fungsi protocol yang mengurus ini:

- `writeUint16()`;
- `writeUint32()`;
- `readUint16()`;
- `readUint32()`;
- `encodePacket()`;
- `decodePacket()`.

### Jenis message

| Type | Nama | Arah |
|---:|---|---|
| `0x01` | START | Android → ESP32 |
| `0x02` | STOP | Android → ESP32 |
| `0x03` | SYNC | Android → ESP32 |
| `0x04` | ACK_RESULT | Android → ESP32 |
| `0x81` | ACK | ESP32 → Android |
| `0x82` | PROGRESS | ESP32 → Android |
| `0x83` | COMPLETE | ESP32 → Android |
| `0x84` | STATE | ESP32 → Android |
| `0xff` | ERROR | ESP32 → Android |

### Mengapa ada sequence?

BLE notification bisa datang terlambat atau terduplikasi. Sequence membantu Android mengenali urutan event dan menolak packet lama.

`resultSequence` pada ACK_RESULT berbeda dari sequence packet ACK_RESULT. Nilainya menunjuk sequence COMPLETE yang ingin diakui.

---

## 14. Disconnect dan reconnect

BLE hanya transport komunikasi. Koneksi BLE putus tidak otomatis menghapus state device.

### Jika putus saat `ARMED`

ESP32 tetap `ARMED`. Jika tombol fisik ditekan:

```text
ARMED → ACTIVE
```

Timer mulai walaupun Android sedang tidak terhubung.

### Jika putus saat `ACTIVE`

ESP32 tetap menghitung timer dan sensor. Android tidak boleh membuat sesi baru.

Saat reconnect:

1. Android discovery ulang.
2. Android subscribe ulang EVENT/STATE.
3. Android mengirim SYNC dengan session ID lama.
4. ESP32 mengirim snapshot authoritative.
5. Android memulihkan UI dari state tersebut.

### Jika putus saat `COMPLETED`

ESP32 menahan hasil. SYNC dapat menyebabkan COMPLETE dikirim ulang. Android kemudian tetap menawarkan Save atau Discard.

---

## 15. Environment physical dan simulation

### Environment normal: `esp32dev`

```bash
pio run -d firmware -e esp32dev
```

Environment ini memakai hardware fisik:

- GPIO12 untuk tombol;
- GPIO26 untuk sensor IR;
- GPIO21/22 untuk LCD.

Simulation tidak aktif pada environment normal.

### Environment simulation: `esp32dev-sim`

```bash
pio run -d firmware -e esp32dev-sim
```

Environment ini menambahkan:

```text
FIKK_DEV_SIMULATION=1
```

Saat state sudah `ACTIVE`, simulasi memanggil jalur `registerBallDetection()` kira-kira setiap 2 detik. Dengan begitu, jalur progress dan completion dapat diuji tanpa pulse IR nyata.

### Batasan simulation saat ini

Environment simulation saat ini **tidak mensimulasikan tombol GPIO12**. Kode simulation hanya memproses auto-count ketika state sudah `ACTIVE`, sedangkan perubahan `ARMED → ACTIVE` tetap berasal dari tombol physical pada environment normal.

Akibatnya, pada `esp32dev-sim`:

```text
START → ARMED
```

dan state dapat tetap `ARMED` jika tidak ada mekanisme virtual start tambahan.

Jangan menganggap build simulation sebagai bukti bahwa tombol, sensor, LCD, wiring, atau BLE sudah lulus pengujian fisik.

---

## 16. Cara build dan upload

### Compile firmware normal

Dari root repository:

```bash
pio run -d firmware -e esp32dev
```

Jika berhasil, PlatformIO membuat output di folder generated `.pio/`.

### Compile simulation

```bash
pio run -d firmware -e esp32dev-sim
```

### Upload ke board

Ganti `COMx` dengan port serial ESP32 yang benar:

```bash
pio run -d firmware -e esp32dev -t upload --upload-port COMx
```

### Membuka serial monitor

```bash
pio device monitor -d firmware -e esp32dev --port COMx
```

Baud rate:

```text
115200
```

Log penting yang dapat terlihat:

```text
BOOT
BLE_INIT
BLE_ADVERTISING
BLE_CONNECTED
START
STATE_CHANGE ARMED
PHYSICAL_START
STATE_CHANGE ACTIVE
BUZZER_FEEDBACK
LED_FEEDBACK
STATE_CHANGE COMPLETED
ACK_RESULT
STATE_CHANGE READY
```

---

## 17. Cara membaca log saat troubleshooting

### Board tidak boot

Periksa:

1. supply dan kabel USB;
2. wiring GPIO12 dan external pull resistor;
3. apakah GPIO12 menahan level boot yang salah;
4. port COM yang digunakan.

### BLE tidak terlihat

Cari log:

```text
BLE_INIT
BLE_ADVERTISING
```

Jika tidak ada, masalah terjadi sebelum advertising. Jika ada tetapi Android tidak menemukan device:

1. pastikan Bluetooth Android aktif;
2. pastikan permission diberikan;
3. cari nama `OVbAT-ESP32`;
4. pastikan UUID service cocok;
5. pastikan device tidak masih terhubung ke client lain.

### START diterima tetapi timer tidak berjalan

Ini normal jika LCD menunjukkan `Press device btn`. START hanya membuat device `ARMED`.

Tekan tombol physical GPIO12. Cari log:

```text
PHYSICAL_START
STATE_CHANGE ACTIVE
```

### Bola tidak bertambah

Periksa:

1. sensor terhubung ke GPIO26;
2. sensor benar-benar active-HIGH;
3. pulse turun kembali ke LOW agar pulse berikutnya dapat dibedakan;
4. state sudah `ACTIVE`;
5. pulse tidak terlalu cepat dibanding debounce 100 ms;
6. ground sensor dan ESP32 tersambung.

### Satu bola terhitung berkali-kali

Periksa bentuk pulse sensor. Debouncer menganggap satu rangkaian HIGH sebagai satu pulse. Jika sensor memiliki noise atau bounce, waktu debounce mungkin perlu dikalibrasi setelah pengujian fisik.

### LCD menyala tetapi text salah/tidak tampil

Periksa:

1. address `0x27`;
2. SDA GPIO21;
3. SCL GPIO22;
4. contrast potentiometer pada backpack LCD;
5. supply dan ground;
6. ukuran LCD benar-benar 20x4.

### Device selesai tetapi tidak kembali READY

ESP32 memang menahan result sampai menerima `ACK_RESULT` yang cocok. Pastikan Android mengirim:

- session ID yang sama;
- result sequence COMPLETE yang sama;
- payload ACK_RESULT yang valid.

---

## 18. Pengujian yang sudah dan belum dibuktikan

### Yang dapat dibuktikan tanpa hardware

- packet encode/decode;
- validasi protocol;
- mapping state `ARMED`;
- alur mobile START/ACK/STATE;
- progress dan completion di fake transport;
- reconnect dan SYNC secara software;
- firmware compile untuk environment normal;
- firmware compile untuk environment simulation.

### Yang wajib dibuktikan dengan hardware nyata

- board boot dengan wiring GPIO12;
- tombol GPIO12 benar-benar active-LOW;
- sensor GPIO26 benar-benar active-HIGH;
- satu bola menghasilkan satu pulse yang valid;
- debounce sesuai karakter sensor;
- LCD tampil pada address `0x27`;
- SDA/SCL tidak tertukar;
- BLE advertising dan koneksi pada board nyata;
- device tetap berjalan ketika BLE dicabut;
- reconnect dan SYNC setelah sesi berjalan tanpa koneksi;
- completion nyata pada target 6;
- Save/Discard end-to-end dengan device nyata.

Compile sukses berarti source code dapat diterjemahkan menjadi firmware. Compile sukses **bukan** bukti bahwa kabel, sensor, tombol, LCD, atau perilaku radio sudah benar.

---

## 19. Ringkasan fungsi utama

| Fungsi | Tanggung jawab |
|---|---|
| `setup()` | Membuka serial, membuat object training device, memanggil `begin()` |
| `loop()` | Memanggil loop device berulang kali |
| `TrainingDevice::begin()` | Menyiapkan LCD, BLE service, characteristic, advertising, state awal |
| `TrainingDevice::loop()` | Membaca tombol/sensor physical atau menjalankan simulation |
| `handleControl()` | Menerima dan decode byte dari CONTROL |
| `handleCommand()` | Memilih handler berdasarkan message type |
| `handleStart()` | Memvalidasi START dan masuk `ARMED` |
| `handlePhysicalStart()` | Mengubah `ARMED` menjadi `ACTIVE` dan memulai timer |
| `handleSensorLevel()` | Mengirim level sensor ke debouncer |
| `registerBallDetection()` | Menambah count, mengirim progress, memicu completion |
| `completeSession()` | Menyimpan duration/result dan masuk `COMPLETED` |
| `handleSync()` | Mengirim state terbaru dan replay COMPLETE bila perlu |
| `handleAckResult()` | Memvalidasi ACK hasil lalu kembali `READY` |
| `resetToReady()` | Menghapus session/result runtime |
| `updateDisplay()` | Memilih text LCD sesuai state |
| `writeLcdLine()` | Menulis satu baris LCD dan membersihkan sisa karakter |
| `sendAck()` | Mengirim status penerimaan command |
| `sendProgress()` | Mengirim count dan elapsed time |
| `sendComplete()` | Mengirim hasil final |
| `sendState()` | Mengirim snapshot state |
| `sendError()` | Mengirim error protocol |
| `publishEvent()` | Encode dan notify melalui EVENT |
| `publishStatePacket()` | Encode dan notify snapshot melalui STATE |
| `nextSequence()` | Menghasilkan nomor sequence berikutnya |
| `elapsedMs()` | Menghasilkan durasi authoritative device |

---

## 20. Glosarium pemula

| Istilah | Arti sederhana |
|---|---|
| ESP32 | Microcontroller dengan GPIO, Wi-Fi, dan Bluetooth/BLE |
| GPIO | Pin digital yang dapat membaca atau mengeluarkan sinyal |
| HIGH | Level digital tinggi, biasanya mendekati 3.3V pada ESP32 |
| LOW | Level digital rendah, biasanya mendekati 0V |
| Active-HIGH | Kondisi aktif ditandai level HIGH |
| Active-LOW | Kondisi aktif ditandai level LOW |
| Pull resistor | Resistor yang menjaga input memiliki level default stabil |
| Sensor pulse | Perubahan sinyal yang menandai suatu kejadian |
| Debounce | Penyaringan noise atau perubahan cepat agar satu kejadian tidak dihitung berkali-kali |
| I2C | Protocol komunikasi dua kabel SDA dan SCL |
| BLE | Bluetooth hemat energi untuk komunikasi data kecil |
| GATT | Struktur service dan characteristic pada BLE |
| UUID | ID unik untuk menemukan service/characteristic yang tepat |
| Advertising | Pengumuman BLE bahwa device tersedia |
| Characteristic | Kanal data di dalam BLE service |
| Notify | Device mendorong data ke aplikasi |
| Packet | Susunan byte yang memiliki arti protocol |
| Payload | Isi packet setelah header |
| Sequence | Nomor urut packet |
| Session ID | ID unik satu sesi training |
| State | Kondisi device saat ini |
| Authoritative | Sumber nilai yang dianggap paling benar |
| Retained result | Hasil selesai yang masih disimpan sampai di-acknowledge |
| ACK | Acknowledgement; tanda bahwa command/event diterima |
| I2C address | Alamat device pada bus I2C |
| Firmware | Program yang berjalan langsung di microcontroller |
| Compile | Mengubah source code menjadi binary yang dapat dijalankan board |
| Upload/flash | Menulis binary firmware ke memory board |
| Serial monitor | Tampilan log dari board melalui kabel USB |

---

## Kesimpulan

Program OVbAT memisahkan tanggung jawab dengan jelas:

- aplikasi Android memulai niat training dengan `START`;
- ESP32 menunggu tindakan nyata pengguna melalui tombol GPIO12;
- ESP32 memulai timer dan menjadi sumber waktu;
- sensor GPIO26 menjadi sumber jumlah bola;
- LCD menjadi display lokal;
- BLE mengirim snapshot dan event ke Android;
- ESP32 menahan hasil sampai Android mengirim `ACK_RESULT`.

Urutan paling penting untuk diingat adalah:

```text
START dari Android
  → ARMED
  → tekan tombol GPIO12
  → ACTIVE + timer mulai
  → pulse IR GPIO26
  → count bertambah
  → target tercapai
  → COMPLETED
  → Save/Discard
  → ACK_RESULT
  → READY
```
