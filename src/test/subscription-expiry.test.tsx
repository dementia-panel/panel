import { expect, test } from 'vitest'
import { localExpiry, readSubscriptionExpiry } from '../components/SubscriptionExpiry'

test('converts selected local time to an exact UTC timestamp', () => {
  const form = new FormData()
  form.set('expires_at', '2032-04-05T18:42:23.000')
  expect(readSubscriptionExpiry(form)).toBe(new Date(2032, 3, 5, 18, 42, 23).toISOString())
  form.set('expires_at', '2032-04-05T18:42')
  expect(readSubscriptionExpiry(form)).toBe(new Date(2032, 3, 5, 18, 42).toISOString())
})

test('preserves the original expiration precision if the time is unchanged', () => {
  const original = '2032-04-05T18:42:23.789Z'
  const form = new FormData()
  form.set('expires_at', localExpiry(original))
  expect(readSubscriptionExpiry(form, original)).toBe(original)
})

test('supports no expiration and rejects missing or invalid local times', () => {
  const form = new FormData()
  expect(() => readSubscriptionExpiry(form)).toThrow()
  for (const value of ['invalid', '2032-02-31T10:00', '2032-04-05']) {
    form.set('expires_at', value)
    expect(() => readSubscriptionExpiry(form)).toThrow()
  }
  form.set('unlimited_expiry', 'on')
  expect(readSubscriptionExpiry(form)).toBeNull()
})
