import { expect, test } from 'vitest'
import { amneziaFrames } from '../lib/amneziaQr'

test('packs the Qt payload into independently numbered AmneziaVPN frames', () => {
  const payload = Buffer.from(Array.from({ length: 1200 }, (_, i) => i % 256))
  const frames = amneziaFrames('vpn://' + payload.toString('base64url'))
  expect(frames).toHaveLength(2)
  const chunks = frames.map((frame, index) => {
    const bytes = Buffer.from(frame, 'base64url')
    expect(bytes.readUInt16BE(0)).toBe(1984)
    expect(bytes[2]).toBe(2)
    expect(bytes[3]).toBe(index)
    expect(bytes.readUInt32BE(4)).toBe(index === 0 ? 850 : 350)
    return bytes.subarray(8)
  })
  expect(Buffer.concat(chunks)).toEqual(payload)
})
