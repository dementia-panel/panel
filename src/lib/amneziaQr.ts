// Qt QDataStream framing used by the AmneziaVPN scanner. The payload in a
// vpn:// link is already in Qt's compressed representation.
export function amneziaFrames(link: string): string[] {
  const encoded = /^vpn:\/\/([A-Za-z0-9_-]+)$/.exec(link.trim())?.[1]
  if (!encoded) throw new Error('Invalid AmneziaVPN profile')
  const payload = atob(encoded.replaceAll('-', '+').replaceAll('_', '/'))
  const chunkSize = 850
  const count = Math.ceil(payload.length / chunkSize)
  if (count > 255) throw new Error('Profile exceeds the AmneziaVPN QR limit')

  return Array.from({ length: count }, (_, index) => {
    const chunk = payload.slice(index * chunkSize, (index + 1) * chunkSize)
    const header = new Uint8Array(8)
    const stream = new DataView(header.buffer)
    stream.setUint16(0, 1984)
    stream.setUint8(2, count)
    stream.setUint8(3, index)
    stream.setUint32(4, chunk.length)
    return btoa(String.fromCharCode(...header) + chunk)
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '')
  })
}
