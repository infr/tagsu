/*
 * Jari Tulilahti's Tagsu audio modem: square-wave pulses of 3 / 5 / 17 samples at 44.1 kHz
 * mean bit 0 / bit 1 / sync, least significant bit first.
 * Each 16-byte block is sent as [block#][16 data bytes][CRC-8 poly 0x07], followed by sync pulses.
 * As in Rakettitiede's own updates: blocks numbered from 1 (the firmware writes block n to flash
 * 0x17F0 + 16n and v1.19 rejects anything out of sequence), 38 syncs after each, block 0x80 last.
 */
export const RATE = 44100;
const SYNC = 17;
const BLOCK_GAP = 38;
const LAST_GAP = 88;

function crc8(bytes: Iterable<number>): number {
  let c = 0;
  for (const b of bytes) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

export type Encoded = { samples: Float32Array<ArrayBuffer>; blockStarts: number[]; seconds: number; blocks: number };

export function encode(image: Uint8Array): Encoded {
  const blocks = image.length / 16;
  const pulses: number[] = [];
  const blockPulse: number[] = [];
  const sync = (n: number) => {
    for (let k = 0; k < n; k++) pulses.push(SYNC);
  };
  sync(Math.floor((RATE * 0.5) / SYNC));
  for (let n = 1; n < blocks; n++) {
    blockPulse.push(pulses.length);
    const block = [n, ...image.subarray(n * 16, n * 16 + 16)];
    block.push(crc8(block));
    for (let b of block) for (let k = 0; k < 8; k++, b >>= 1) pulses.push(b & 1 ? 5 : 3);
    sync(n === blocks - 1 ? LAST_GAP : BLOCK_GAP);
  }
  const lead = Math.round(RATE * 0.3);
  const total = lead * 2 + pulses.reduce((a, p) => a + p, 0);
  const samples = new Float32Array(total);
  const blockStarts: number[] = [];
  let level = 1;
  let i = lead;
  let next = 0;
  pulses.forEach((p, k) => {
    if (k === blockPulse[next]) {
      blockStarts.push(i / RATE);
      next++;
    }
    samples.fill(level, i, i + p);
    i += p;
    level = -level;
  });
  return { samples, blockStarts, seconds: total / RATE, blocks: blocks - 1 };
}
