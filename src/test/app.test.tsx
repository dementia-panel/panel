import { beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrafficTrend } from '../components/TrafficTrend'
import { App } from '../App'
import { useResource } from '../lib/api'

let signedIn = true
let calls: { path: string; method: string; body: Record<string, unknown> }[]
let createdUsers: Record<string, unknown>[]
let createdPlans: Record<string, unknown>[]
let createdSubscriptions: Record<string, unknown>[]
beforeEach(() => {
  signedIn = true
  calls = []
  createdUsers = []
  createdSubscriptions = []
  createdPlans = []
  vi.stubGlobal('localStorage', {
    setItem: vi.fn(),
    getItem: vi.fn((key: string) => (key === 'dementia.language' ? 'ru' : null)),
    removeItem: vi.fn(),
    clear: vi.fn(),
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      const path = String(url)
      const method = options?.method || 'GET'
      const body = JSON.parse(String(options?.body || '{}'))
      calls.push({ path, method, body })
      const respond = (data: unknown, status = 200) =>
        new Response(status === 204 ? null : JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      if (path === '/api/auth/setup') return respond({ setup_required: false })
      if (path === '/api/auth/me')
        return signedIn ? respond({ username: 'admin' }) : respond({ error: 'unauthorized' }, 401)
      if (path === '/api/auth/login') {
        if (body.password !== 'test-password-123')
          return respond({ error: 'invalid username or password' }, 401)
        signedIn = true
        return respond({ username: body.username })
      }
      if (path === '/api/admin/settings/subscription-branding')
        return respond(method === 'PUT' ? body : { name: 'dementia', logo: '' })
      if (path === '/api/admin/settings/integrations')
        return respond({
          telegram: { enabled: false, state: 'disabled' },
          webhook: { enabled: false, state: 'disabled' },
        })
      if (path === '/api/admin/users' && method === 'POST') {
        const u = {
          ...body,
          id: 'user-1',
          enabled: true,
          online: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        createdUsers.push(u)
        return respond(u, 201)
      }
      if (path === '/api/admin/users') return respond(createdUsers)
      if (/^\/api\/admin\/users\/[^/]+\/subscription$/.test(path)) {
        const userId = path.split('/')[4]
        if (method === 'PUT') {
          const access = createdSubscriptions.find((item) => item.user_id === userId)
          if (access)
            Object.assign(access, {
              enabled: body.enabled,
              expires_at: body.expires_at,
              plan_id: body.plan_id,
            })
          return respond({ id: access?.id })
        }
        return respond(createdSubscriptions.find((item) => item.user_id === userId) ?? null)
      }
      if (/^\/api\/admin\/users\/[^/]+$/.test(path)) {
        const record = createdUsers.find((item) => item.id === path.split('/')[4])
        if (method === 'PATCH') {
          Object.assign(record ?? {}, body)
          return respond(undefined, 204)
        }
        return respond(record)
      }
      if (path === '/api/admin/nodes' && method === 'POST')
        return respond({ ...body, id: 'node-2' }, 202)
      if (path === '/api/admin/nodes/node-1' && method === 'PATCH')
        return respond({ enabled: body.enabled })
      if (path === '/api/admin/nodes')
        return respond([
          {
            id: 'node-1',
            name: 'Frankfurt',
            ip: '192.0.2.10',
            vpn_port: 51820,
            status: 'ready',
            enabled: true,
            online: true,
            revision: 1,
            applied_revision: 1,
          },
        ])
      if (path === '/api/admin/subscription-plans' && method === 'POST') {
        const plan = { ...body, id: 'plan-1' }
        createdPlans.push(plan)
        return respond(plan, 201)
      }
      if (path === '/api/admin/subscription-plans') return respond(createdPlans)
      if (path === '/api/admin/subscriptions') return respond(createdSubscriptions)
      if (path === '/api/admin/subscriptions/sub-1/link') return respond({ url: 'https://example.test/s/existing-subscription' })
      if (path === '/api/admin/subscriptions/sub-1/nodes/node-1/profile')
        return respond({ conf: '[Interface]', key: 'vpn://existing-key' })
      if (path === '/api/admin/api-tokens' && method === 'POST')
        return respond({ token: 'test-only-api-key' }, 201)
      if (path === '/api/admin/api-tokens') return respond([])
      if (path.startsWith('/api/admin/traffic')) return respond([])
      throw new Error('Unexpected request: ' + method + ' ' + path)
    }),
  )
})
test('protects admin routes and supports a failed login followed by a successful login', async () => {
  signedIn = false
  window.history.replaceState({}, '', '/users')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText('Добро пожаловать')
  await user.type(screen.getByLabelText('Имя администратора'), 'admin')
  await user.type(screen.getByLabelText('Пароль'), 'wrong')
  await user.click(screen.getByRole('button', { name: 'Войти в панель' }))
  await screen.findByText('Неверное имя пользователя или пароль.')
  await user.clear(screen.getByLabelText('Пароль'))
  await user.type(screen.getByLabelText('Пароль'), 'test-password-123')
  await user.click(screen.getByRole('button', { name: 'Войти в панель' }))
  await screen.findByRole('heading', { name: 'Обзор сети' })
  expect(window.localStorage.setItem).not.toHaveBeenCalled()
})
test('creates a user with a numeric Telegram ID and displays the saved record', async () => {
  window.history.replaceState({}, '', '/users')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Пользователи' })
  await user.click(screen.getAllByRole('button', { name: 'Добавить пользователя' })[0])
  await user.type(screen.getByLabelText('Имя пользователя'), 'boris')
  await user.type(screen.getByLabelText('Telegram ID'), '12345678')
  await user.click(screen.getByRole('button', { name: 'Создать пользователя' }))
  await screen.findByText('boris')
  expect(calls.find((c) => c.method === 'POST' && c.path.endsWith('/users'))?.body).toEqual({
    username: 'boris',
    telegram_id: 12345678,
  })
})
test('creates a subscription as a server list without a user or expiration', async () => {
  window.history.replaceState({}, '', '/subscriptions')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Подписки' })
  await user.click(screen.getByRole('button', { name: 'Создать подписку' }))
  await user.type(screen.getByLabelText('Название'), 'Личная')
  await user.click(await screen.findByRole('checkbox', { name: /Frankfurt/ }))
  await user.click(screen.getByRole('button', { name: 'Сохранить' }))
  await screen.findByText('Личная')
  expect(
    calls.find((c) => c.method === 'POST' && c.path.endsWith('/subscription-plans'))?.body,
  ).toEqual({
    name: 'Личная',
    node_ids: ['node-1'],
  })
})

test('opens issued profiles and switches between QR applications without issuing new keys', async () => {
  createdUsers = [{ id: 'user-1', username: 'boris', enabled: true }]
  createdSubscriptions = [
    { id: 'sub-1', user_id: 'user-1', name: 'Личная', enabled: true, node_ids: ['node-1'] },
  ]
  window.history.replaceState({}, '', '/subscriptions?user=user-1')
  const user = userEvent.setup()
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Профили подключения: Личная' }))
  expect(screen.getByRole('button', { name: 'Скачать .conf' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Скачать .vpn' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Скопировать vpn://' }))
  await waitFor(async () => expect(await navigator.clipboard.readText()).toBe('vpn://existing-key'))
  await user.click(screen.getByRole('button', { name: 'Показать QR-коды' }))
  for (const name of ['QR-код AmneziaVPN', 'QR-код AmneziaWG']) {
    if (name === 'QR-код AmneziaWG') {
      expect(screen.queryByRole('img', { name })).toBeNull()
      await user.click(screen.getByRole('button', { name: 'AmneziaWG' }))
    }
    expect((await screen.findByRole('img', { name })).getAttribute('src')).toMatch(
      /^data:image\/png/,
    )
  }
  expect(calls.filter((c) => c.path.endsWith('/profile')).map((c) => c.method)).toEqual([
    'GET',
    'GET',
  ])
  expect(window.localStorage.setItem).not.toHaveBeenCalled()
})

test('reveals an API token once and clears it on close', async () => {
  window.history.replaceState({}, '', '/tokens')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'API-токены' })
  await user.click(screen.getAllByRole('button', { name: 'Выпустить токен' })[0])
  await user.type(screen.getByLabelText('Название интеграции'), 'Billing')
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Выпустить токен' }),
  )
  await screen.findByDisplayValue('test-only-api-key')
  await user.click(screen.getByRole('button', { name: 'Я сохранил токен' }))
  expect(screen.queryByDisplayValue('test-only-api-key')).toBeNull()
})
test('ignores an old response after the resource filter changes', async () => {
  let resolveOld!: (value: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      url.endsWith('/old')
        ? new Promise<Response>((resolve) => {
            resolveOld = resolve
          })
        : Promise.resolve(new Response(JSON.stringify({ name: 'new' }))),
    ),
  )
  function View({ path }: { path: string }) {
    const r = useResource<{ name: string }>(path)
    return <span>{r.data?.name || 'loading'}</span>
  }
  const view = render(<View path="/old" />)
  await waitFor(() => expect(resolveOld).toBeTypeOf('function'))
  view.rerender(<View path="/new" />)
  await act(async () => {
    resolveOld(new Response(JSON.stringify({ name: 'old' })))
  })
  await screen.findByText('new')
  expect(screen.queryByText('old')).toBeNull()
})

test('registers a server using SSH credentials without a manual fingerprint', async () => {
  window.history.replaceState({}, '', '/nodes?create=1')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('dialog', { name: 'Подключение сервера' })
  await user.type(screen.getByLabelText('Название сервера'), 'Amsterdam')
  await user.type(screen.getByLabelText('IP-адрес'), '192.0.2.11')
  await user.type(screen.getByLabelText('SSH-пароль'), 'test-only-ssh-password')
  expect(screen.queryByLabelText('Отпечаток SSH-ключа')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Установить ноду' }))
  await screen.findByText('Установка запущена. Состояние обновится автоматически.')
  expect(calls.find((c) => c.method === 'POST' && c.path.endsWith('/nodes'))?.body).toEqual({
    name: 'Amsterdam',
    ip: '192.0.2.11',
    ssh_port: 22,
    vpn_port: 51820,
    login: 'root',
    password: 'test-only-ssh-password',
  })
  expect(screen.queryByLabelText('SSH-пароль')).toBeNull()
})
test('requires confirmation before pausing a server', async () => {
  window.history.replaceState({}, '', '/nodes')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText('Frankfurt')
  await user.click(screen.getByRole('button', { name: 'Поставить на паузу Frankfurt' }))
  expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Подтвердить' }))
  await screen.findByText('Состояние ноды обновлено')
  expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ enabled: false })
})
test('supports administrator setup with a generated password', async () => {
  const originalFetch = globalThis.fetch
  let configured = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/auth/setup' && options?.method === 'POST') {
        configured = true
        const payload = JSON.parse(String(options.body))
        expect(payload.password.length).toBeGreaterThanOrEqual(12)
        expect((options.headers as Record<string, string>).Authorization).toBeUndefined()
        return new Response(JSON.stringify({ username: 'admin' }), { status: 201 })
      }
      if (url === '/api/auth/setup')
        return new Response(JSON.stringify({ setup_required: !configured, setup_available: true }))
      return originalFetch(url, options)
    }),
  )
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText('Настроим вашу панель')
  expect(screen.queryByLabelText('Токен первичной настройки')).toBeNull()
  await user.type(screen.getByLabelText('Имя администратора'), 'admin')
  await user.click(screen.getByRole('button', { name: 'Сгенерировать пароль' }))
  const generated = (screen.getByLabelText('Новый пароль') as HTMLInputElement).value
  await user.type(screen.getByLabelText('Повторите пароль'), generated)
  await user.click(screen.getByRole('checkbox', { name: 'Я сохранил пароль в надёжном месте' }))
  await user.click(screen.getByRole('button', { name: 'Сохранить и открыть панель' }))
  await screen.findByRole('heading', { name: 'Обзор сети' })
})
test.each([
  ['/traffic', 'Трафик'],
  ['/settings', 'Настройки'],
])('opens the %s route directly', async (path, title) => {
  window.history.replaceState({}, '', path)
  render(<App />)
  await screen.findByRole('heading', { name: title, level: 1 })
})

test('requires an authenticated bootstrap administrator to choose permanent credentials', async () => {
  const originalFetch = globalThis.fetch
  let required = true
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/auth/me')
        return new Response(
          JSON.stringify({ username: 'admin', password_change_required: required }),
        )
      if (url === '/api/auth/complete-setup') {
        const payload = JSON.parse(String(options?.body))
        expect(payload).toEqual({ username: 'owner', password: 'my-permanent-password' })
        required = false
        return new Response(JSON.stringify({ username: 'owner', password_change_required: false }))
      }
      return originalFetch(url, options)
    }),
  )
  window.history.replaceState({}, '', '/nodes')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('heading', { name: 'Настроим вашу панель' })
  expect(screen.queryByRole('heading', { name: 'Ноды' })).toBeNull()
  expect(screen.queryByLabelText('Токен первичной настройки')).toBeNull()
  await user.clear(screen.getByLabelText('Имя администратора'))
  await user.type(screen.getByLabelText('Имя администратора'), 'owner')
  await user.type(screen.getByLabelText('Новый пароль'), 'my-permanent-password')
  await user.type(screen.getByLabelText('Повторите пароль'), 'different-password')
  await user.click(screen.getByRole('button', { name: 'Сохранить и открыть панель' }))
  await screen.findByText('Пароли не совпадают.')
  await user.clear(screen.getByLabelText('Повторите пароль'))
  await user.type(screen.getByLabelText('Повторите пароль'), 'my-permanent-password')
  await user.click(screen.getByRole('button', { name: 'Сохранить и открыть панель' }))
  await screen.findByRole('heading', { name: 'Обзор сети' })
})

test('defaults to English and persists Russian across application remounts', async () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: vi.fn((key: string) => values.get(key) || null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
    clear: vi.fn(() => values.clear()),
  }
  vi.stubGlobal('localStorage', storage)
  window.history.replaceState({}, '', '/settings')
  const user = userEvent.setup()
  const first = render(<App />)
  await screen.findByRole('heading', { name: 'Settings', level: 1 })
  expect(document.documentElement.lang).toBe('en')
  await user.click(screen.getByRole('combobox', { name: 'Interface language' }))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('listbox')).toBeNull()
  await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
  expect(screen.queryByRole('listbox')).toBeNull()
  await screen.findByRole('heading', { name: 'Настройки', level: 1 })
  expect(storage.setItem).toHaveBeenCalledWith('dementia.language', 'ru')
  expect(screen.getByRole('link', { name: 'Пользователи' })).toBeTruthy()
  first.unmount()
  render(<App />)
  await screen.findByRole('heading', { name: 'Настройки', level: 1 })
  expect(screen.getByRole('combobox', { name: 'Язык интерфейса' }).textContent).toBe('Русский')
  expect(document.documentElement.lang).toBe('ru')
})

test('shows actual integration states from the backend', async () => {
  const originalFetch = globalThis.fetch
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url === '/api/admin/settings/integrations')
        return new Response(
          JSON.stringify({
            telegram: { enabled: true, state: 'connected', checked_at: '2026-11-14T10:00:00Z' },
            webhook: { enabled: true, state: 'error', checked_at: '2026-11-14T10:00:00Z' },
          }),
        )
      return originalFetch(url, options)
    }),
  )
  window.history.replaceState({}, '', '/settings')
  render(<App />)
  await screen.findByText('Подключён')
  await screen.findByText('Ошибка соединения')
  expect(screen.queryByText('Безопасность сессии')).toBeNull()
})

test('shows the sign-in form in English on a first visit', async () => {
  signedIn = false
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null), setItem: vi.fn() })
  window.history.replaceState({}, '', '/login')
  render(<App />)
  await screen.findByRole('heading', { name: 'Welcome back' })
  expect(screen.getByLabelText('Administrator name')).toBeTruthy()
  expect(screen.getByLabelText('Password')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy()
})

test('updates the subscription page branding from settings', async () => {
  const user = userEvent.setup()
  window.history.replaceState({}, '', '/settings')
  render(<App />)
  const name = await screen.findByRole('textbox', { name: 'Название проекта' })
  await user.clear(name)
  await user.type(name, 'Northern Relay')
  await user.click(screen.getByRole('button', { name: 'Сохранить' }))
  await screen.findByText('Оформление страницы подписки сохранено.')
  expect(calls).toContainEqual({
    path: '/api/admin/settings/subscription-branding',
    method: 'PUT',
    body: { name: 'Northern Relay', logo: '' },
  })
})

test('opens a subscription and reveals its key without an admin session', async () => {
  const user = userEvent.setup()
  const path = '/s/demo-token'
  const request = vi.fn(async (url: string) => {
    if (url === path + '/manifest')
      return Response.json({
        name: 'Личный VPN',
        branding: { name: 'Northern Relay', logo: '' },
        locations: [
          { id: 'node-1', name: 'Франкфурт', available: true },
          { id: 'node-2', name: 'Хельсинки', available: false },
        ],
      })
    if (url === path + '/nodes/node-1.key') return new Response('vpn://demo-key')
    throw new Error('Unexpected request: ' + url)
  })
  vi.stubGlobal('fetch', request)
  signedIn = false
  window.history.replaceState({}, '', path)
  render(<App />)
  await screen.findByRole('heading', { name: 'Личный VPN' })
  expect(screen.getByText('Northern Relay')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'AmneziaVPN .vpn' }).getAttribute('href')).toBe(
    path + '/nodes/node-1.vpn',
  )
  await user.click(screen.getByRole('button', { name: 'AmneziaWG Конфиг .conf' }))
  expect(screen.getByRole('link', { name: 'AmneziaWG .conf' }).getAttribute('href')).toBe(
    path + '/nodes/node-1.conf',
  )
  expect(screen.queryByRole('link', { name: 'AmneziaVPN .vpn' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'AmneziaVPN Ключ и конфиг .vpn' }))
  await user.click(screen.getByRole('button', { name: 'Показать ключ' }))
  expect(
    (await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Ключ vpn://' })).value,
  ).toBe('vpn://demo-key')
  expect(request.mock.calls.map(([url]) => url)).toEqual([
    path + '/manifest',
    path + '/nodes/node-1.key',
  ])
})

test('opens the user card, saves subscription expiration and can pause access', async () => {
  const user = userEvent.setup()
  createdUsers = [
    {
      id: 'user-1',
      username: 'boris',
      telegram_id: null,
      enabled: true,
      subscription_plan_id: 'plan-1',
      online: false,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      last_connected_at: null,
    },
  ]
  createdPlans = [{ id: 'plan-1', name: 'Europe', node_ids: ['node-1'] }]
  createdSubscriptions = [
    {
      id: 'sub-1',
      user_id: 'user-1',
      plan_id: 'plan-1',
      enabled: true,
      expires_at: null,
      traffic_used_bytes: 0,
      traffic_limit_bytes: null,
      node_ids: ['node-1'],
    },
  ]
  window.history.replaceState({}, '', '/users')
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Открыть пользователя boris' }))
  await screen.findByRole('heading', { name: 'Карточка пользователя' })
  await screen.findByRole('switch', { name: 'Подписка включена' })
  await screen.findByDisplayValue('https://example.test/s/existing-subscription')
  expect(screen.getByRole('button', { name: 'Скачать .conf' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Скачать .vpn' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Скопировать' }))
  await waitFor(async () => expect(await navigator.clipboard.readText()).toBe('https://example.test/s/existing-subscription'))
  await user.click(screen.getByRole('button', { name: 'Скопировать vpn://' }))
  await waitFor(async () => expect(await navigator.clipboard.readText()).toBe('vpn://existing-key'))
  expect(calls.filter((call) => call.method !== 'GET')).toEqual([])
  await user.click(screen.getByRole('checkbox', { name: 'Без ограничения срока' }))
  const expiry = screen.getByLabelText('Действует до')
  await user.type(expiry, '2027-01-31')
  await user.click(screen.getByRole('switch', { name: 'Подписка включена' }))
  await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }))
  await screen.findByText('Пользователь обновлён')
  const saved = calls.find(
    (call) => call.method === 'PUT' && call.path.endsWith('/users/user-1/subscription'),
  )
  expect(saved?.body.plan_id).toBe('plan-1')
  expect(saved?.body.enabled).toBe(false)
  const end = new Date(String(saved?.body.expires_at))
  expect([
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
    end.getHours(),
    end.getMinutes(),
  ]).toEqual([2027, 0, 31, 23, 59])
})

test('selects the nearest chart day on pointer movement and supports keyboard navigation', async () => {
  const user = userEvent.setup()
  render(
    <TrafficTrend
      data={[
        { day: '2026-11-14', received_bytes: 100, sent_bytes: 10 },
        { day: '2026-11-15', received_bytes: 200, sent_bytes: 20 },
        { day: '2026-11-16', received_bytes: 300, sent_bytes: 30 },
      ]}
    />,
  )
  const plot = screen.getByRole('slider')
  vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue({
    left: 100,
    right: 900,
    top: 0,
    bottom: 240,
    width: 800,
    height: 240,
    x: 100,
    y: 0,
    toJSON: () => ({}),
  })
  const event = new Event('pointermove', { bubbles: true })
  Object.defineProperty(event, 'clientX', { value: 500 })
  fireEvent(plot, event)
  expect(plot.getAttribute('aria-valuenow')).toBe('1')
  expect(plot.getAttribute('aria-valuetext')).toContain('200')
  act(() => plot.focus())
  await user.keyboard('{ArrowRight}')
  expect(plot.getAttribute('aria-valuenow')).toBe('2')
  await user.keyboard('{Home}')
  expect(plot.getAttribute('aria-valuenow')).toBe('0')
})
