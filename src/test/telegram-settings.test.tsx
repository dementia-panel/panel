import { beforeEach, expect, test, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TelegramSettings } from '../components/TelegramSettings'
import { FeedbackProvider } from '../components/ui'
import { setLanguage } from '../lib/i18n'

beforeEach(() => {
  setLanguage('en')
})

test('notification categories load, save and remain selected after reopening', async () => {
  let saved = { node: true, user: true, admin: true, api_token: true, subscription: false }
  const requests: unknown[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'PUT') {
        saved = JSON.parse(String(options.body))
        requests.push(saved)
      }
      return new Response(JSON.stringify(saved), {
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  const user = userEvent.setup()
  const view = render(
    <FeedbackProvider>
      <TelegramSettings />
    </FeedbackProvider>,
  )
  const node = (await screen.findByRole('checkbox', { name: 'Node events' })) as HTMLInputElement
  expect(node.checked).toBe(true)
  await user.click(node)
  await user.click(screen.getByRole('checkbox', { name: 'Subscription events' }))
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByText('Notification preferences saved')
  expect(requests).toEqual([
    { node: false, user: true, admin: true, api_token: true, subscription: true },
  ])
  view.unmount()
  render(<TelegramSettings />)
  await waitFor(() =>
    expect(
      (screen.getByRole('checkbox', { name: 'Node events' }) as HTMLInputElement).checked,
    ).toBe(false),
  )
  expect(
    (screen.getByRole('checkbox', { name: 'Subscription events' }) as HTMLInputElement).checked,
  ).toBe(true)
})

test('failed saves show an error and can be retried', async () => {
  let writes = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'PUT' && ++writes === 1)
        return new Response(JSON.stringify({ error: 'Service unavailable' }), { status: 503 })
      return new Response(
        JSON.stringify({
          node: true,
          user: false,
          admin: true,
          api_token: true,
          subscription: false,
        }),
      )
    }),
  )
  const user = userEvent.setup()
  render(<TelegramSettings />)
  await screen.findByRole('checkbox', { name: 'Node events' })
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Service unavailable')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(writes).toBe(2))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
})
