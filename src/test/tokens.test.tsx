import { expect, test, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TokensPage from '../pages/Tokens'
import { setLanguage } from '../lib/i18n'

test('renames an API token without issuing another token', async () => {
  setLanguage('en')
  let token = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Billing',
    created_at: '2030-01-01T00:00:00Z',
  }
  const writes: { method: string; body: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'PATCH') {
        const body = JSON.parse(String(options.body))
        writes.push({ method: options.method, body })
        token = { ...token, ...body }
        return new Response(JSON.stringify(token))
      }
      return new Response(JSON.stringify([token]))
    }),
  )
  render(<TokensPage />)
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Rename Billing' }))
  const dialog = screen.getByRole('dialog')
  const input = within(dialog).getByRole('textbox')
  await user.clear(input)
  await user.type(input, 'Payment service')
  await user.click(within(dialog).getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(writes).toEqual([{ method: 'PATCH', body: { name: 'Payment service' } }]),
  )
  await screen.findByText('Payment service')
  expect(screen.queryByRole('dialog')).toBeNull()
})
