export const BLE_CHARACTERISTICS = ['CONTROL', 'EVENT', 'STATE', 'DEVICE_INFO'] as const;

export type BleCharacteristic = (typeof BLE_CHARACTERISTICS)[number];

export type BleProfile = {
  serviceUuid: string;
  characteristics: Readonly<Record<BleCharacteristic, string>>;
};

export function createBleProfile(input: BleProfile): BleProfile {
  if (!input.serviceUuid.trim()) {
    throw new Error('service UUID is required');
  }

  const characteristics = Object.fromEntries(
    BLE_CHARACTERISTICS.map((name) => {
      const uuid = input.characteristics[name];
      if (!uuid?.trim()) {
        throw new Error(`${name} characteristic UUID is required`);
      }
      return [name, uuid.trim()];
    }),
  ) as Record<BleCharacteristic, string>;

  return {
    serviceUuid: input.serviceUuid.trim(),
    characteristics,
  };
}
