import { beforeEach, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { applicationDownloadURL } from '../pages/PublicSubscription'
import { TrafficTrend } from '../components/TrafficTrend'
import { App } from '../App'
import { useResource } from '../lib/api'

let nodeStatus = 'ready'
let nodeAppliedRevision = 4499
let nodeRemoved = false
let signedIn = true
let calls: { path: string; method: string; body: Record<string, unknown> }[]
let createdUsers: Record<string, unknown>[]
let createdPlans: Record<string, unknown>[]
let createdDevices: Record<string, unknown>[]
let deviceDefault: number | null
let createdSubscriptions: Record<string, unknown>[]
beforeEach(() => {
  signedIn = true
  nodeStatus = 'ready'
  nodeAppliedRevision = 4499
  nodeRemoved = false
  calls = []
  createdDevices = []
  deviceDefault = 3
  createdUsers = []
  createdSubscriptions = []
  createdPlans = []
  vi.stubGlobal('localStorage', {
    setItem: vi.fn(),
    getItem: vi.fn((key: string) =>
      key === 'dementia.language' || key === 'dementia.subscription.language' ? 'ru' : null,
    ),
    removeItem: vi.fn(),
    clear: vi.fn(),
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      const requestURL = new URL(String(url), 'https://panel.example.test')
      const path = requestURL.pathname
      const method = options?.method || 'GET'
      const body = JSON.parse(String(options?.body || '{}'))
      calls.push({ path, method, body })
      const respond = (data: unknown, status = 200) => {
        if (path === '/api/admin/users' && method === 'GET' && Array.isArray(data)) {
          const query = requestURL.searchParams
          const search = query.get('search') || ''
          const status = query.get('status') || 'all'
          const values = data.filter(
            (user) =>
              (String(user.username).toLowerCase().includes(search.toLowerCase()) ||
                String(user.telegram_id || '').includes(search)) &&
              (status === 'all' || (status === 'online' ? user.online : !user.enabled)),
          )
          const sort = query.get('sort') || 'created_at'
          values.sort((a, b) =>
            sort === 'username'
              ? String(a.username).localeCompare(String(b.username))
              : sort === 'last_connected_at'
                ? String(b.last_connected_at || '').localeCompare(String(a.last_connected_at || ''))
                : sort === 'created_at_asc'
                  ? String(a.created_at).localeCompare(String(b.created_at))
                  : String(b.created_at).localeCompare(String(a.created_at)),
          )
          const page = Number(query.get('page') || 1),
            per_page = Number(query.get('per_page') || 25)
          data = {
            items: values.slice((page - 1) * per_page, page * per_page),
            total: values.length,
            online_total: values.filter((user) => user.online).length,
            page,
            per_page,
            total_pages: Math.ceil(values.length / per_page),
          }
        }
        return new Response(status === 204 ? null : JSON.stringify(data), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      if (path === '/api/auth/setup') return respond({ setup_required: false })
      if (path === '/api/auth/me')
        return signedIn ? respond({ username: 'admin' }) : respond({ error: 'unauthorized' }, 401)
      if (path === '/api/auth/login') {
        if (body.password !== 'test-password-123')
          return respond({ error: 'invalid username or password' }, 401)
        signedIn = true
        return respond({ username: body.username })
      }
      if (path === '/api/admin/settings/devices') {
        if (method === 'PUT') deviceDefault = body.default_device_limit
        return respond({ default_device_limit: deviceDefault })
      }
      if (path === '/api/admin/users/user-1/device-limit') {
        Object.assign(createdUsers[0], { device_limit: body.device_limit })
        return respond(undefined, 204)
      }
      if (path === '/api/admin/users/user-1/devices') {
        if (method === 'POST') {
          const record = createdUsers[0]
          if (record.device_limit != null && createdDevices.length >= Number(record.device_limit))
            return respond({ error: 'device limit reached' }, 409)
          const device = {
            id: 'device-' + (createdDevices.length + 1),
            user_id: 'user-1',
            name: body.name,
            online: false,
            last_connected_at: null,
          }
          createdDevices.push(device)
          return respond(device, 201)
        }
        return respond(createdDevices)
      }
      if (/^\/api\/admin\/users\/user-1\/devices\/[^/]+\/nodes\/node-1\/profile$/.test(path))
        return respond({ conf: '[Interface]', key: 'vpn://existing-key' })
      if (/^\/api\/admin\/users\/user-1\/devices\/[^/]+$/.test(path)) {
        const id = path.split('/')[6]
        if (method === 'PATCH')
          Object.assign(createdDevices.find((device) => device.id === id) ?? {}, body)
        if (method === 'DELETE')
          createdDevices = createdDevices.filter((device) => device.id !== id)
        return respond(undefined, 204)
      }
      if (/^\/api\/admin\/users\/user-1\/devices\/[^/]+\/link$/.test(path))
        return respond({ url: 'https://example.test/s/device-' + path.split('/')[6] })
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
        if (record)
          Object.assign(record, {
            device_count: createdDevices.length,
            online_device_count: createdDevices.filter((device) => device.online).length,
          })
        return respond(record)
      }
      if (path === '/api/admin/nodes' && method === 'POST')
        return respond({ ...body, id: 'node-2' }, 202)
      if (path === '/api/admin/nodes/node-1' && method === 'PATCH')
        return respond({ enabled: body.enabled })
      if (path === '/api/admin/nodes/node-1' && method === 'DELETE') {
        nodeRemoved = true
        return respond(undefined, 204)
      }
      if (path === '/api/admin/nodes')
        return respond(
          nodeRemoved
            ? []
            : [
                {
                  id: 'node-1',
                  name: 'Frankfurt',
                  ip: '192.0.2.10',
                  vpn_port: 51820,
                  status: nodeStatus,
                  online_device_count: 7,
                  enabled: true,
                  online: true,
                  revision: 4499,
                  applied_revision: nodeAppliedRevision,
                },
              ],
        )
      if (path === '/api/admin/subscription-plans' && method === 'POST') {
        const plan = { ...body, id: 'plan-1' }
        createdPlans.push(plan)
        return respond(plan, 201)
      }
      if (path === '/api/admin/subscription-plans') return respond(createdPlans)
      if (path === '/api/admin/subscriptions') return respond(createdSubscriptions)
      if (path === '/api/admin/subscriptions/sub-1/link')
        return respond({ url: 'https://example.test/s/existing-subscription' })
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
  await user.click(within(name.closest('form')!).getByRole('button', { name: 'Сохранить' }))
  await screen.findByText('Оформление страницы подписки сохранено.')
  expect(calls).toContainEqual({
    path: '/api/admin/settings/subscription-branding',
    method: 'PUT',
    body: { name: 'Northern Relay', logo: '', default_language: 'en' },
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
  createdDevices = [{ id: 'phone', user_id: 'user-1', name: 'iPhone', online: true }]
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
  await screen.findByDisplayValue('https://example.test/s/device-phone')
  expect(screen.getByRole('button', { name: 'Скачать .conf' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Скачать .vpn' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Скопировать' }))
  await waitFor(async () =>
    expect(await navigator.clipboard.readText()).toBe('https://example.test/s/device-phone'),
  )
  await user.click(screen.getByRole('button', { name: 'Скопировать vpn://' }))
  await waitFor(async () => expect(await navigator.clipboard.readText()).toBe('vpn://existing-key'))
  expect(calls.filter((call) => call.method !== 'GET')).toEqual([])
  await user.click(screen.getByRole('checkbox', { name: 'Без ограничения срока' }))
  const expiry = screen.getByLabelText('Действует до')
  fireEvent.change(expiry, { target: { value: '2027-01-31T14:35:20' } })
  expect((expiry as HTMLInputElement).value).toBe('2027-01-31T14:35:20.000')
  expect((expiry as HTMLInputElement).checkValidity()).toBe(true)
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
  ]).toEqual([2027, 0, 31, 14, 35])
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

test('manages named devices and their limit from the user card without rotating existing keys', async () => {
  createdUsers = [
    {
      id: 'user-1',
      username: 'boris',
      telegram_id: null,
      enabled: true,
      subscription_plan_id: 'plan-1',
      device_limit: 2,
    },
  ]
  createdPlans = [{ id: 'plan-1', name: 'Europe', node_ids: ['node-1'] }]
  createdSubscriptions = [
    { id: 'sub-1', user_id: 'user-1', plan_id: 'plan-1', enabled: true, node_ids: ['node-1'] },
  ]
  createdDevices = [
    { id: 'device-1', name: 'iPhone', online: true, last_connected_at: '2026-11-16T10:00:00Z' },
    { id: 'device-2', name: 'Laptop', online: false },
  ]
  const user = userEvent.setup()
  window.history.replaceState({}, '', '/users')
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Открыть пользователя boris' }))
  await user.click(await screen.findByRole('button', { name: 'Устройства' }))
  await screen.findByText('iPhone')
  await screen.findByText('Laptop')
  expect(
    (screen.getByRole('button', { name: 'Добавить устройство' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  await user.click(screen.getByRole('checkbox', { name: 'Без лимита устройств' }))
  await user.click(screen.getByRole('button', { name: 'Сохранить лимит' }))
  await screen.findByText('Лимит устройств сохранён')
  expect(calls.find((call) => call.path.endsWith('/device-limit'))?.body).toEqual({
    device_limit: null,
  })
  await user.type(screen.getByLabelText('Название устройства'), 'Work Mac')
  await user.click(screen.getByRole('button', { name: 'Добавить устройство' }))
  await screen.findByText('Work Mac')
  await user.click(screen.getByRole('button', { name: 'Переименовать устройство: iPhone' }))
  await user.clear(screen.getByLabelText('Новое название устройства'))
  await user.type(screen.getByLabelText('Новое название устройства'), 'Personal iPhone')
  await user.click(screen.getByRole('button', { name: /^Сохранить$/ }))
  const title = await screen.findByText('Personal iPhone')
  const article = title.closest('article')!
  await user.click(within(article).getByRole('button', { name: 'Ключи подключения' }))
  await user.click(within(article).getByRole('button', { name: 'Скопировать vpn://' }))
  await waitFor(async () => expect(await navigator.clipboard.readText()).toBe('vpn://existing-key'))
  expect(
    calls.some(
      (call) => call.path.includes('/device-1/nodes/node-1/profile') && call.method === 'GET',
    ),
  ).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Удалить устройство: Work Mac' }))
  await user.click(screen.getByRole('button', { name: 'Подтвердить' }))
  await waitFor(() => expect(screen.queryByText('Work Mac')).toBeNull())
  expect(screen.getByText('Personal iPhone')).toBeTruthy()
  expect(calls.some((call) => /rotate-link|revoke/.test(call.path))).toBe(false)
})

test('saves the default device limit and can disable it for new users', async () => {
  const user = userEvent.setup()
  window.history.replaceState({}, '', '/settings')
  render(<App />)
  const limit = await screen.findByLabelText('Лимит устройств по умолчанию')
  await user.clear(limit)
  await user.type(limit, '5')
  const section = screen.getByText('Устройства пользователей').closest('section')!
  await user.click(within(section).getByRole('button', { name: /^Сохранить$/ }))
  await screen.findByText('Настройки устройств сохранены')
  expect(deviceDefault).toBe(5)
  await user.click(within(section).getByRole('checkbox', { name: 'Без лимита устройств' }))
  await user.click(within(section).getByRole('button', { name: /^Сохранить$/ }))
  await waitFor(() => expect(deviceDefault).toBeNull())
})

test('switches subscription devices without keeping another device key visible', async () => {
  const user = userEvent.setup()
  const path = '/s/device-demo'
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === path + '/manifest')
        return Response.json({
          name: 'Device subscription',
          devices: [
            { id: 'phone', name: 'iPhone', online: false },
            { id: 'laptop', name: 'Laptop' },
          ],
          locations: [{ id: 'node-1', name: 'Frankfurt', available: true }],
        })
      if (url === path + '/devices/phone/nodes/node-1.key') return new Response('vpn://phone-key')
      if (url === path + '/devices/laptop/nodes/node-1.key') return new Response('vpn://laptop-key')
      throw new Error('Unexpected request: ' + url)
    }),
  )
  signedIn = false
  window.history.replaceState({}, '', path)
  render(<App />)
  await screen.findByRole('heading', { name: 'Device subscription' })
  await user.click(screen.getByRole('button', { name: 'Показать ключ' }))
  expect(
    (await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Ключ vpn://' })).value,
  ).toBe('vpn://phone-key')
  await user.click(screen.getByRole('combobox', { name: 'Устройство для подключения' }))
  await user.click(screen.getByRole('option', { name: 'Laptop' }))
  expect(screen.queryByRole('textbox', { name: 'Ключ vpn://' })).toBeNull()
  expect(screen.getByRole('link', { name: 'AmneziaVPN .vpn' }).getAttribute('href')).toBe(
    path + '/devices/laptop/nodes/node-1.vpn',
  )
  await user.click(screen.getByRole('button', { name: 'Показать ключ' }))
  expect(
    (await screen.findByRole<HTMLTextAreaElement>('textbox', { name: 'Ключ vpn://' })).value,
  ).toBe('vpn://laptop-key')
  expect(
    (screen.getByRole('textbox', { name: 'Ссылка на подписку' }) as HTMLInputElement).value,
  ).toContain('?device_id=laptop')
})

test('opens the selected app directly in the mobile platform store', () => {
  expect(applicationDownloadURL('vpn', 'iPhone', 1)).toBe(
    'https://apps.apple.com/app/amneziavpn/id1600529900',
  )
  expect(applicationDownloadURL('wg', 'iPad', 5)).toBe(
    'https://apps.apple.com/app/amneziawg/id6478942365',
  )
  expect(applicationDownloadURL('vpn', 'Macintosh', 5)).toContain('apps.apple.com')
  expect(applicationDownloadURL('vpn', 'Android', 1)).toBe(
    'https://play.google.com/store/apps/details?id=org.amnezia.vpn',
  )
  expect(applicationDownloadURL('wg', 'Android', 1)).toBe(
    'https://play.google.com/store/apps/details?id=org.amnezia.awg',
  )
  expect(applicationDownloadURL('vpn', 'Windows', 0)).toBe('https://amnezia.org/downloads')
})

test.each([
  { online: true, last_connected_at: null },
  { online: false, last_connected_at: '2026-11-16T10:00:00Z' },
])('hides all subscription content for a used device: %j', async (status) => {
  signedIn = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json({
        name: 'Private subscription',
        devices: [
          {
            id: 'phone',
            name: 'iPhone',
            ...status,
            servers: [{ node_id: 'node-1', last_connected_at: '2026-11-16T10:00:00Z' }],
          },
        ],
        locations: [{ id: 'node-1', name: 'Frankfurt', available: true }],
      }),
    ),
  )
  window.history.replaceState({}, '', '/s/used-device')
  render(<App />)
  await screen.findByText('Данный ключ уже использован')
  expect(screen.getByRole('heading', { name: 'Подключение к VPN' })).toBeTruthy()
  expect(screen.getByText('Этот ключ уже активирован на устройстве.')).toBeTruthy()
  expect(document.querySelector('.subscription-site-main')?.children).toHaveLength(2)
  expect(document.querySelector('.subscription-status.is-available')).toBeNull()
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByRole('combobox', { name: 'Устройство для подключения' })).toBeTruthy()
  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.queryByText('Подписка активна')).toBeNull()
  expect(document.querySelector('.subscription-qr-modal')).toBeNull()
  vi.mocked(localStorage.getItem).mockReturnValue('en')
  fireEvent.click(screen.getByRole('button', { name: 'EN' }))
  await screen.findByText('This key has already been used')
})

test('removes a revealed VPN key when polling reports the first connection', async () => {
  signedIn = false
  let refresh: (() => void) | undefined
  const interval = vi.spyOn(window, 'setInterval').mockImplementation((handler, delay) => {
    if (delay === 15000) refresh = handler as () => void
    return 123 as unknown as ReturnType<typeof window.setInterval>
  })
  let connected = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.endsWith('/manifest')
        ? Response.json({
            name: 'Device subscription',
            devices: [
              {
                id: 'phone',
                name: 'iPhone',
                online: connected,
                servers: [
                  {
                    node_id: 'node-1',
                    last_connected_at: connected ? '2026-11-16T10:00:00Z' : null,
                  },
                ],
                last_connected_at: connected ? '2026-11-16T10:00:00Z' : null,
              },
            ],
            locations: [{ id: 'node-1', name: 'Frankfurt', available: true }],
          })
        : new Response('vpn://private-key'),
    ),
  )
  window.history.replaceState({}, '', '/s/device-polling')
  try {
    render(<App />)
    await screen.findByText('Device subscription')
    fireEvent.click(screen.getByRole('button', { name: 'Показать ключ' }))
    await screen.findByDisplayValue('vpn://private-key')
    fireEvent.click(screen.getByRole('button', { name: 'QR подписки' }))
    await screen.findByRole('dialog')
    connected = true
    await act(async () => {
      refresh?.()
    })
    await screen.findByText('Данный ключ уже использован')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByDisplayValue('vpn://private-key')).toBeNull()
    expect(screen.queryByRole('button', { name: 'QR подписки' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'AmneziaVPN .vpn' })).toBeNull()
  } finally {
    interval.mockRestore()
  }
})

test('removes a failed node from the panel without requesting SSH credentials', async () => {
  nodeStatus = 'failed'
  const user = userEvent.setup()
  window.history.replaceState({}, '', '/nodes')
  render(<App />)
  await screen.findByText('Ошибка установки')
  await user.click(screen.getByRole('button', { name: 'Удалить' }))
  await screen.findByRole('heading', { name: 'Удаление ноды' })
  expect(screen.queryByLabelText('SSH-пароль')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Удалить из системы' }))
  await screen.findByText('Нода удалена из системы')
  expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({ cleanup: false })
  expect(screen.queryByText('Frankfurt')).toBeNull()
})
test('shows one synchronization state instead of cumulative node revisions', async () => {
  window.history.replaceState({}, '', '/nodes')
  const view = render(<App />)
  await screen.findByText('Frankfurt')
  expect(screen.getByText('1/1')).not.toBeNull()
  expect(screen.queryByText('4499/4499')).toBeNull()
  view.unmount()
  nodeAppliedRevision = 4498
  render(<App />)
  await screen.findByText('Frankfurt')
  expect(screen.getByText('0/1')).not.toBeNull()
})
test('requires SSH credentials only for remote cleanup and drops them when switching back', async () => {
  const user = userEvent.setup()
  window.history.replaceState({}, '', '/nodes')
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Удалить' }))
  await user.click(screen.getByRole('combobox', { name: 'Способ удаления' }))
  await user.click(screen.getByRole('option', { name: 'Удалить и очистить сервер' }))
  expect((screen.getByLabelText('SSH-пароль') as HTMLInputElement).required).toBe(true)
  await user.type(screen.getByLabelText('SSH-пароль'), 'test-only-password')
  await user.click(screen.getByRole('combobox', { name: 'Способ удаления' }))
  await user.click(screen.getByRole('option', { name: 'Удалить из системы' }))
  expect(screen.queryByLabelText('SSH-пароль')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Удалить из системы' }))
  await screen.findByText('Нода удалена из системы')
  expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({ cleanup: false })
})
test('submits remote cleanup with explicitly selected SSH credentials', async () => {
  const user = userEvent.setup()
  window.history.replaceState({}, '', '/nodes')
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Удалить' }))
  await user.click(screen.getByRole('combobox', { name: 'Способ удаления' }))
  await user.click(screen.getByRole('option', { name: 'Удалить и очистить сервер' }))
  await user.type(screen.getByLabelText('SSH-пароль'), 'test-only-password')
  await user.click(screen.getByRole('button', { name: 'Удалить и очистить сервер' }))
  await screen.findByText('Очистка VPS запущена.')
  expect(calls.find((c) => c.method === 'DELETE')?.body).toEqual({
    cleanup: true,
    login: 'root',
    password: 'test-only-password',
  })
})
test('can explicitly accept a changed SSH host key when retrying a failed installation', async () => {
  nodeStatus = 'failed'
  const user = userEvent.setup()
  window.history.replaceState({}, '', '/nodes')
  render(<App />)
  await user.click(await screen.findByRole('button', { name: 'Повторить установку' }))
  const reset = screen.getByRole('checkbox', {
    name: 'Сервер переустановлен: принять новый SSH-ключ',
  })
  expect((reset as HTMLInputElement).checked).toBe(false)
  await user.click(reset)
  await user.type(screen.getByLabelText('SSH-пароль'), 'test-only-password')
  await user.click(screen.getByRole('button', { name: 'Установить ноду' }))
  await screen.findByText('Установка запущена. Состояние обновится автоматически.')
  expect(
    calls.find((c) => c.method === 'POST' && c.path === '/api/admin/nodes')?.body.reset_host_key,
  ).toBe(true)
})

test('keeps unused servers accessible when another server key was already used', async () => {
  signedIn = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      url.endsWith('/manifest')
        ? Response.json({
            name: 'Europe',
            devices: [
              {
                id: 'phone',
                name: 'iPhone',
                online: true,
                last_connected_at: '2026-11-16T10:00:00Z',
                servers: [
                  { node_id: 'node-a', last_connected_at: '2026-11-16T10:00:00Z' },
                  { node_id: 'node-b', last_connected_at: null },
                ],
              },
            ],
            locations: [
              { id: 'node-a', name: 'Amsterdam', available: true },
              { id: 'node-b', name: 'Berlin', available: true },
            ],
          })
        : new Response('vpn://berlin'),
    ),
  )
  window.history.replaceState({}, '', '/s/multi')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText('Europe')
  expect(screen.queryByText('Данный ключ уже использован')).toBeNull()
  expect(screen.getByRole('link', { name: 'AmneziaVPN .vpn' }).getAttribute('href')).toBe(
    '/s/multi/devices/phone/nodes/node-b.vpn',
  )
  await user.click(screen.getByRole('combobox', { name: 'Сервер' }))
  await user.click(screen.getByRole('option', { name: 'Amsterdam · Ключ уже использован' }))
  await screen.findByText('Данный ключ уже использован')
  expect(screen.queryByRole('button', { name: 'Показать ключ' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'AmneziaVPN .vpn' })).toBeNull()
  await user.click(screen.getByRole('combobox', { name: 'Сервер' }))
  await user.click(screen.getByRole('option', { name: 'Berlin' }))
  await user.click(screen.getByRole('button', { name: 'Показать ключ' }))
  await screen.findByDisplayValue('vpn://berlin')
})

test('switches device links even when every server on the current device was used', async () => {
  signedIn = false
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/s/a/devices/laptop/link')
        return Response.json({ url: 'https://example.test/s/b' })
      const current = url === '/s/a/manifest' ? 'phone' : 'laptop'
      return Response.json({
        name: 'Europe',
        device_options: [
          { id: 'phone', name: 'iPhone' },
          { id: 'laptop', name: 'Laptop' },
        ],
        devices: [
          {
            id: current,
            name: current === 'phone' ? 'iPhone' : 'Laptop',
            servers: [
              {
                node_id: 'node-1',
                last_connected_at: current === 'phone' ? '2026-11-17T10:00:00Z' : null,
              },
            ],
          },
        ],
        locations: [{ id: 'node-1', name: 'Berlin', available: true }],
      })
    }),
  )
  window.history.replaceState({}, '', '/s/a')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByText('Данный ключ уже использован')
  await user.click(screen.getByRole('combobox', { name: 'Устройство для подключения' }))
  await user.click(screen.getByRole('option', { name: 'Laptop' }))
  await screen.findByRole('link', { name: 'AmneziaVPN .vpn' })
  expect(window.location.pathname).toBe('/s/b')
  expect(screen.queryByText('Данный ключ уже использован')).toBeNull()
  expect(screen.getByRole('link', { name: 'AmneziaVPN .vpn' }).getAttribute('href')).toBe(
    '/s/b/devices/laptop/nodes/node-1.vpn',
  )
})

test('saves the default subscription language in settings', async () => {
  const user = userEvent.setup()
  window.history.replaceState({}, '', '/settings')
  render(<App />)
  await user.click(
    await screen.findByRole('combobox', { name: 'Язык страницы подписки по умолчанию' }),
  )
  await user.click(screen.getByRole('option', { name: 'Русский' }))
  const section = screen.getByText('Оформление страницы подписки').closest('section')!
  await user.click(within(section).getByRole('button', { name: 'Сохранить' }))
  await screen.findByText('Оформление страницы подписки сохранено.')
  expect(
    calls.find((c) => c.path === '/api/admin/settings/subscription-branding' && c.method === 'PUT')
      ?.body.default_language,
  ).toBe('ru')
})
test.each([null, 'en'])(
  'applies configured language without overriding visitor preference: %s',
  async (preference) => {
    const values = new Map<string, string>([['dementia.language', 'en']])
    if (preference) values.set('dementia.subscription.language', preference)
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          name: 'Europe',
          devices: [],
          locations: [],
          branding: { name: 'Test', logo: '', default_language: 'ru' },
        }),
      ),
    )
    window.history.replaceState({}, '', '/s/lang')
    render(<App />)
    await screen.findByText(preference ? 'Subscription active' : 'Подписка активна')
    expect(values.get('dementia.language')).toBe('en')
    if (!preference) expect(values.has('dementia.subscription.language')).toBe(false)
  },
)

test('paginates users and searches across pages instead of filtering only visible rows', async () => {
  createdUsers = Array.from({ length: 30 }, (_, index) => ({
    id: 'user-' + index,
    username: 'person-' + String(index).padStart(2, '0'),
    telegram_id: 1000 + index,
    enabled: true,
    online: false,
    created_at: '2030-01-01T00:00:00Z',
    updated_at: '2030-01-01T00:00:00Z',
    last_connected_at: null,
  }))
  window.history.replaceState({}, '', '/users')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('button', { name: 'Открыть пользователя person-00' })
  expect(screen.queryByRole('button', { name: 'Открыть пользователя person-29' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Далее' }))
  await screen.findByRole('button', { name: 'Открыть пользователя person-29' })
  expect(screen.queryByRole('button', { name: 'Открыть пользователя person-00' })).toBeNull()
  await user.type(screen.getByRole('textbox', { name: 'Имя или Telegram ID' }), 'person-00')
  await screen.findByRole('button', { name: 'Открыть пользователя person-00' })
  expect(screen.queryByRole('button', { name: 'Открыть пользователя person-29' })).toBeNull()
  expect((screen.getByRole('button', { name: 'Назад' }) as HTMLButtonElement).disabled).toBe(true)
})

test('node cards show active devices and topbar project metadata', async () => {
  window.history.replaceState({}, '', '/nodes')
  render(<App />)
  const label = await screen.findByText('Подключено устройств')
  expect(label.nextElementSibling?.textContent).toBe('7')
  expect(screen.getByRole('link', { name: 'Проект на GitHub' }).getAttribute('href')).toBe(
    'https://github.com/dementia-panel',
  )
  const { version } = await import('../../package.json')
  expect(screen.getByLabelText(`Версия панели ${version}`).textContent).toBe(`v${version}`)
  expect(screen.getByRole('button', { name: 'Выйти' })).toBeTruthy()
})

test('creates a user with the selected subscription expiration time', async () => {
  createdPlans = [{ id: 'plan-1', name: 'Europe', node_ids: ['node-1'] }]
  window.history.replaceState({}, '', '/users')
  const user = userEvent.setup()
  render(<App />)
  await user.click((await screen.findAllByRole('button', { name: 'Добавить пользователя' }))[0])
  await user.type(screen.getByLabelText('Имя пользователя'), 'timed-user')
  await user.click(screen.getByRole('combobox', { name: 'Подписка' }))
  await user.click(await screen.findByRole('option', { name: 'Europe' }))
  await user.click(screen.getByRole('checkbox', { name: 'Без ограничения срока' }))
  fireEvent.change(screen.getByLabelText('Действует до'), {
    target: { value: '2032-04-05T18:42:23' },
  })
  await user.click(screen.getByRole('button', { name: 'Создать пользователя' }))
  await screen.findByText('timed-user')
  expect(calls.find((c) => c.method === 'POST' && c.path === '/api/admin/users')?.body).toEqual({
    username: 'timed-user',
    telegram_id: null,
    plan_id: 'plan-1',
    expires_at: new Date('2032-04-05T18:42:23').toISOString(),
  })
})

test('sorts users together with filters and keeps the query in the URL', async () => {
  createdUsers = [
    { id: 'older', username: 'alice', enabled: false, created_at: '2030-01-01T00:00:00Z' },
    { id: 'newer', username: 'zoe', enabled: false, created_at: '2030-01-02T00:00:00Z' },
    { id: 'active', username: 'boris', enabled: true, created_at: '2030-01-03T00:00:00Z' },
  ]
  window.history.replaceState({}, '', '/users')
  const user = userEvent.setup()
  render(<App />)
  await screen.findByRole('button', { name: 'Открыть пользователя boris' })
  expect(
    screen
      .getAllByRole('button', { name: /Открыть пользователя / })
      .map((n) => n.getAttribute('aria-label')),
  ).toEqual([
    'Открыть пользователя boris',
    'Открыть пользователя zoe',
    'Открыть пользователя alice',
  ])
  await user.click(screen.getByRole('button', { name: 'Отключены' }))
  await user.click(screen.getByRole('combobox', { name: 'Сортировка пользователей' }))
  await user.click(screen.getByRole('option', { name: 'Сначала старые' }))
  await screen.findByRole('button', { name: 'Открыть пользователя alice' })
  expect(
    screen
      .getAllByRole('button', { name: /Открыть пользователя / })
      .map((n) => n.getAttribute('aria-label')),
  ).toEqual(['Открыть пользователя alice', 'Открыть пользователя zoe'])
  expect(new URLSearchParams(location.search).get('sort')).toBe('created_at_asc')
  expect(new URLSearchParams(location.search).get('status')).toBe('disabled')
  await user.type(screen.getByPlaceholderText('Имя или Telegram ID'), 'alice')
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Открыть пользователя zoe' })).toBeNull(),
  )
  expect(new URLSearchParams(location.search).get('search')).toBe('alice')
  expect(new URLSearchParams(location.search).get('sort')).toBe('created_at_asc')
})
