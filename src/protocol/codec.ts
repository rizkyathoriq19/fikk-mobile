export const PROTOCOL_VERSION = 0x01 as const;

export const MESSAGE_TYPES = {
  START: 0x01,
  STOP: 0x02,
  SYNC: 0x03,
  ACK_RESULT: 0x04,
  ACK: 0x81,
  PROGRESS: 0x82,
  COMPLETE: 0x83,
  STATE: 0x84,
  ERROR: 0xff,
} as const;

export type MessageType = (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export const DEVICE_STATES = {
  READY: 0,
  ACTIVE: 1,
  COMPLETED: 2,
  ERROR: 3,
} as const;

export type DeviceState = (typeof DEVICE_STATES)[keyof typeof DEVICE_STATES];

type MessageHeader = {
  version: typeof PROTOCOL_VERSION;
  sessionId: number;
  sequence: number;
};

export type ProtocolMessage =
  | (MessageHeader & {
      messageType: typeof MESSAGE_TYPES.START;
      payload: { targetCount: number };
    })
  | (MessageHeader & {
      messageType: typeof MESSAGE_TYPES.STOP;
      payload: { reason: number };
    })
  | (MessageHeader & {
      messageType: typeof MESSAGE_TYPES.SYNC;
      payload: Record<string, never>;
    })
  | (MessageHeader & {
      messageType: typeof MESSAGE_TYPES.ACK_RESULT;
      payload: { resultSequence: number };
    })
  | (MessageHeader & {
      messageType: typeof MESSAGE_TYPES.ACK;
      payload: { command: number; status: number };
    })
  | (MessageHeader & {
      messageType: typeof MESSAGE_TYPES.PROGRESS;
      payload: { count: number; elapsedMs: number };
    })
  | (MessageHeader & {
      messageType: typeof MESSAGE_TYPES.COMPLETE;
      payload: { count: number; durationMs: number; reason: number };
    })
  | (MessageHeader & {
      messageType: typeof MESSAGE_TYPES.STATE;
      payload: { state: DeviceState; count: number; elapsedMs: number };
    })
  | (MessageHeader & {
      messageType: typeof MESSAGE_TYPES.ERROR;
      payload: { errorCode: number };
    });

export class ProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtocolError';
  }
}

const HEADER_SIZE = 8;

function assertIntegerInRange(value: number, max: number, field: string): void {
  if (!Number.isInteger(value) || value < 0 || value > max) {
    throw new ProtocolError(`${field} must be an integer from 0 to ${max}`);
  }
}

function assertByte(value: number, field: string): void {
  assertIntegerInRange(value, 0xff, field);
}

function assertUint16(value: number, field: string): void {
  assertIntegerInRange(value, 0xffff, field);
}

function assertUint32(value: number, field: string): void {
  assertIntegerInRange(value, 0xffffffff, field);
}

function isMessageType(value: number): value is MessageType {
  return (Object.values(MESSAGE_TYPES) as number[]).includes(value);
}

function isDeviceState(value: number): value is DeviceState {
  return (Object.values(DEVICE_STATES) as number[]).includes(value);
}

function assertPayloadLength(actual: number, expected: number, messageType: MessageType): void {
  if (actual !== expected) {
    throw new ProtocolError(
      `invalid payload length for message type 0x${messageType.toString(16)}: expected ${expected}, got ${actual}`,
    );
  }
}

function viewFor(bytes: Uint8Array): DataView {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

export function encodeMessage(message: ProtocolMessage): Uint8Array {
  if (message.version !== PROTOCOL_VERSION) {
    throw new ProtocolError(`unsupported protocol version: ${message.version}`);
  }

  assertUint32(message.sessionId, 'sessionId');
  assertUint16(message.sequence, 'sequence');

  let payload: Uint8Array;
  switch (message.messageType) {
    case MESSAGE_TYPES.START:
      assertByte(message.payload.targetCount, 'targetCount');
      if (message.payload.targetCount === 0) {
        throw new ProtocolError('targetCount must be greater than 0');
      }
      payload = Uint8Array.of(message.payload.targetCount);
      break;
    case MESSAGE_TYPES.STOP:
      assertByte(message.payload.reason, 'reason');
      payload = Uint8Array.of(message.payload.reason);
      break;
    case MESSAGE_TYPES.SYNC:
      payload = new Uint8Array(0);
      break;
    case MESSAGE_TYPES.ACK_RESULT: {
      assertUint16(message.payload.resultSequence, 'resultSequence');
      payload = new Uint8Array(2);
      new DataView(payload.buffer).setUint16(0, message.payload.resultSequence, true);
      break;
    }
    case MESSAGE_TYPES.ACK:
      assertByte(message.payload.command, 'command');
      assertByte(message.payload.status, 'status');
      payload = Uint8Array.of(message.payload.command, message.payload.status);
      break;
    case MESSAGE_TYPES.PROGRESS: {
      assertByte(message.payload.count, 'count');
      assertUint32(message.payload.elapsedMs, 'elapsedMs');
      payload = new Uint8Array(5);
      const payloadView = new DataView(payload.buffer);
      payloadView.setUint8(0, message.payload.count);
      payloadView.setUint32(1, message.payload.elapsedMs, true);
      break;
    }
    case MESSAGE_TYPES.COMPLETE: {
      assertByte(message.payload.count, 'count');
      assertUint32(message.payload.durationMs, 'durationMs');
      assertByte(message.payload.reason, 'reason');
      payload = new Uint8Array(6);
      const payloadView = new DataView(payload.buffer);
      payloadView.setUint8(0, message.payload.count);
      payloadView.setUint32(1, message.payload.durationMs, true);
      payloadView.setUint8(5, message.payload.reason);
      break;
    }
    case MESSAGE_TYPES.STATE: {
      assertByte(message.payload.state, 'state');
      if (!isDeviceState(message.payload.state)) {
        throw new ProtocolError(`unknown device state: ${message.payload.state}`);
      }
      assertByte(message.payload.count, 'count');
      assertUint32(message.payload.elapsedMs, 'elapsedMs');
      payload = new Uint8Array(6);
      const payloadView = new DataView(payload.buffer);
      payloadView.setUint8(0, message.payload.state);
      payloadView.setUint8(1, message.payload.count);
      payloadView.setUint32(2, message.payload.elapsedMs, true);
      break;
    }
    case MESSAGE_TYPES.ERROR:
      assertUint16(message.payload.errorCode, 'errorCode');
      payload = new Uint8Array(2);
      new DataView(payload.buffer).setUint16(0, message.payload.errorCode, true);
      break;
    default:
      throw new ProtocolError('unknown message type');
  }

  const bytes = new Uint8Array(HEADER_SIZE + payload.length);
  const header = viewFor(bytes);
  header.setUint8(0, PROTOCOL_VERSION);
  header.setUint8(1, message.messageType);
  header.setUint32(2, message.sessionId, true);
  header.setUint16(6, message.sequence, true);
  bytes.set(payload, HEADER_SIZE);
  return bytes;
}

export function decodeMessage(bytes: Uint8Array): ProtocolMessage {
  if (bytes.byteLength < HEADER_SIZE) {
    throw new ProtocolError(`message is shorter than the ${HEADER_SIZE}-byte header`);
  }

  const header = viewFor(bytes);
  const version = header.getUint8(0);
  if (version !== PROTOCOL_VERSION) {
    throw new ProtocolError(`unsupported protocol version: ${version}`);
  }

  const messageTypeValue = header.getUint8(1);
  if (!isMessageType(messageTypeValue)) {
    throw new ProtocolError(`unknown message type: 0x${messageTypeValue.toString(16)}`);
  }

  const sessionId = header.getUint32(2, true);
  const sequence = header.getUint16(6, true);
  const payload = bytes.subarray(HEADER_SIZE);
  const commonHeader = { version: PROTOCOL_VERSION, messageType: messageTypeValue, sessionId, sequence };

  switch (messageTypeValue) {
    case MESSAGE_TYPES.START:
      assertPayloadLength(payload.length, 1, messageTypeValue);
      if (payload[0] === 0) {
        throw new ProtocolError('targetCount must be greater than 0');
      }
      return { ...commonHeader, messageType: MESSAGE_TYPES.START, payload: { targetCount: payload[0] } };
    case MESSAGE_TYPES.STOP:
      assertPayloadLength(payload.length, 1, messageTypeValue);
      return { ...commonHeader, messageType: MESSAGE_TYPES.STOP, payload: { reason: payload[0] } };
    case MESSAGE_TYPES.SYNC:
      assertPayloadLength(payload.length, 0, messageTypeValue);
      return { ...commonHeader, messageType: MESSAGE_TYPES.SYNC, payload: {} };
    case MESSAGE_TYPES.ACK_RESULT:
      assertPayloadLength(payload.length, 2, messageTypeValue);
      return {
        ...commonHeader,
        messageType: MESSAGE_TYPES.ACK_RESULT,
        payload: { resultSequence: viewFor(payload).getUint16(0, true) },
      };
    case MESSAGE_TYPES.ACK:
      assertPayloadLength(payload.length, 2, messageTypeValue);
      return {
        ...commonHeader,
        messageType: MESSAGE_TYPES.ACK,
        payload: { command: payload[0], status: payload[1] },
      };
    case MESSAGE_TYPES.PROGRESS:
      assertPayloadLength(payload.length, 5, messageTypeValue);
      return {
        ...commonHeader,
        messageType: MESSAGE_TYPES.PROGRESS,
        payload: { count: payload[0], elapsedMs: viewFor(payload).getUint32(1, true) },
      };
    case MESSAGE_TYPES.COMPLETE:
      assertPayloadLength(payload.length, 6, messageTypeValue);
      return {
        ...commonHeader,
        messageType: MESSAGE_TYPES.COMPLETE,
        payload: {
          count: payload[0],
          durationMs: viewFor(payload).getUint32(1, true),
          reason: payload[5],
        },
      };
    case MESSAGE_TYPES.STATE: {
      assertPayloadLength(payload.length, 6, messageTypeValue);
      const state = payload[0];
      if (!isDeviceState(state)) {
        throw new ProtocolError(`unknown device state: ${state}`);
      }
      return {
        ...commonHeader,
        messageType: MESSAGE_TYPES.STATE,
        payload: { state, count: payload[1], elapsedMs: viewFor(payload).getUint32(2, true) },
      };
    }
    case MESSAGE_TYPES.ERROR:
      assertPayloadLength(payload.length, 2, messageTypeValue);
      return {
        ...commonHeader,
        messageType: MESSAGE_TYPES.ERROR,
        payload: { errorCode: viewFor(payload).getUint16(0, true) },
      };
  }
}
