import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useAllUsers } from '../lib/users'

function UserOptions() {
  const users = useAllUsers()
  if (users.loading) return <span>Loading options</span>
  return <span>{users.error || users.data?.map((user) => user.username).join(',')}</span>
}

test('user selectors load remaining pages and preserve the first page', async () => {
  const pages: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      pages.push(url)
      const page = Number(new URL(url, 'https://panel.example.test').searchParams.get('page'))
      return new Response(
        JSON.stringify({
          items: [{ id: 'id-' + page, username: 'person-' + page }],
          page,
          per_page: 100,
          total: 2,
          total_pages: 2,
          online_total: 0,
        }),
      )
    }),
  )
  render(<UserOptions />)
  await screen.findByText('person-1,person-2')
  expect(pages).toEqual([
    '/api/admin/users?page=1&per_page=100',
    '/api/admin/users?page=2&per_page=100',
  ])
})

test('unmounted user selectors do not fetch another page', async () => {
  let resolve!: (response: Response) => void
  const request = vi.fn(
    () =>
      new Promise<Response>((done) => {
        resolve = done
      }),
  )
  vi.stubGlobal('fetch', request)
  const view = render(<UserOptions />)
  await screen.findByText('Loading options')
  view.unmount()
  resolve(
    new Response(JSON.stringify({ items: [{ id: 'id-1', username: 'person-1' }], total_pages: 5 })),
  )
  await new Promise((done) => setTimeout(done, 20))
  expect(request).toHaveBeenCalledTimes(1)
})
