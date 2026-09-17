#pragma once

namespace FikkBleProfile {

constexpr char kLocalName[] = "OVbAT-ESP32";
constexpr char kBoardName[] = "ESP32 DevKit V1";
constexpr char kFirmwareVersion[] = "0.1.0";
constexpr char kProtocolVersion[] = "1";
constexpr char kServiceUuid[] = "c8c5aefd-0e30-525e-9bf9-5243913c8127";
constexpr char kControlUuid[] = "c42f890d-088a-5b19-bcd4-5029fceb2bcc";
constexpr char kEventUuid[] = "57a6c81b-268e-5eed-995b-2149521b911f";
constexpr char kStateUuid[] = "8271b32c-fa20-5adc-a4d0-141bf24baa71";
constexpr char kDeviceInfoUuid[] = "98ef338e-f5f8-5ea4-b89f-116d303090a3";

// The exact ESP chip/module and physical hardware revision are intentionally unknown.
constexpr char kUnknownChipModule[] = "unknown";
constexpr char kUnknownHardwareRevision[] = "unknown";

}  // namespace FikkBleProfile
