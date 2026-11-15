import { t, getLocale } from './i18n'
import { useCallback, useEffect, useRef, useState } from 'react'

export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

function messages(): Record<string, string> {
  return {
    'password setup required': t('Завершите первичную настройку администратора.'),
    'password setup is already complete': t('Первичная настройка уже завершена. Войдите снова.'),
    'invalid username or password length': t(
      'Проверьте имя администратора и длину пароля (не менее 12 символов).',
    ),
    'invalid username or password': t('Неверное имя пользователя или пароль.'),
    'administrator is already configured': t('Администратор уже создан. Войдите с паролем.'),
    'resource already exists': t('Запись с такими данными уже существует.'),
    'resource not found': t('Запись не найдена. Обновите страницу.'),
    'subscription plan is in use': t('Сначала снимите подписку со всех пользователей.'),
    'node already registered': t('Этот сервер уже зарегистрирован.'),
    'invalid node settings': t('Проверьте IP-адрес, порты и данные SSH-подключения.'),
    'too many login attempts': t('Слишком много попыток входа. Подождите минуту.'),
    'login temporarily unavailable': t('Сервис входа временно недоступен.'),
    'invalid origin': t(
      'Адрес интерфейса не совпадает с PUBLIC_URL backend. Проверьте настройку прокси.',
    ),
    'database operation temporarily unavailable': t(
      'База данных занята. Повторите запрос немного позже.',
    ),
    'internal error': t('Не удалось выполнить операцию. Повторите запрос.'),
    'backend is shutting down': t('Backend завершает работу. Повторите запрос позже.'),
  }
}

let queue: Promise<unknown> = Promise.resolve()

// One credentialed request at a time prevents competing refresh-token rotations.
export function api<T = void>(
  path: string,
  method = 'GET',
  body?: unknown,
  headers?: HeadersInit,
): Promise<T> {
  const operation = async () => {
    let response: Response
    try {
      response = await fetch(path.startsWith('/api/') ? path : '/api/admin' + path, {
        method,
        credentials: 'include',
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(25000),
      })
    } catch {
      throw new APIError(
        0,
        t('Нет связи с backend. Проверьте, что сервис запущен и прокси настроен.'),
      )
    }
    const data = response.status === 204 ? undefined : await response.json().catch(() => undefined)
    if (!response.ok) {
      if (response.status === 401 && path.startsWith('/api/auth/') === false) {
        window.dispatchEvent(new Event('session-expired'))
      }
      throw new APIError(
        response.status,
        messages()[data?.error] ||
          (response.status === 401
            ? t('Сессия завершена. Войдите снова.')
            : response.status === 429
              ? t('Слишком много запросов. Повторите позже.')
              : data?.error || t('Ошибка запроса.')),
      )
    }
    return data as T
  }
  const synchronized = async (): Promise<T> =>
    navigator.locks
      ? await navigator.locks.request('dementia-session', operation)
      : await operation()
  const result = queue.then(synchronized, synchronized)
  queue = result.catch(() => undefined)
  return result
}

export function useResource<T>(path: string, interval = 0) {
  const [data, setData] = useState<T>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const generation = useRef(0)
  const inFlight = useRef<{ generation: number; promise: Promise<void> } | null>(null)
  const refresh = useCallback(async () => {
    const current = generation.current
    // A manual reload after a mutation must wait for an older poll, then fetch again.
    const previous = inFlight.current
    if (previous?.generation === current) await previous.promise
    if (current !== generation.current) return
    const promise = (async () => {
      try {
        const value = await api<T>(path)
        if (current === generation.current) {
          setData(value)
          setError('')
        }
      } catch (e) {
        if (current === generation.current) setError(errorMessage(e))
      } finally {
        if (current === generation.current) setLoading(false)
      }
    })()
    const request = { generation: current, promise }
    inFlight.current = request
    await promise
    if (inFlight.current === request) inFlight.current = null
  }, [path])
  useEffect(() => {
    generation.current++
    inFlight.current = null
    setData(undefined)
    setError('')
    setLoading(true)
    void refresh()
    const timer = interval
      ? window.setInterval(() => {
          if (!document.hidden && !inFlight.current) void refresh()
        }, interval)
      : undefined
    return () => {
      generation.current++
      clearInterval(timer)
    }
  }, [refresh, interval])
  return { data, error, loading, refresh }
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : t('Не удалось выполнить операцию.')
}
export function date(value?: string | null) {
  return value && !Number.isNaN(new Date(value).getTime())
    ? new Intl.DateTimeFormat(getLocale(), {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '—'
}
export function bytes(value = 0) {
  if (value < 1024) return value + t(' Б')
  const units = [t('КиБ'), t('МиБ'), t('ГиБ'), t('ТиБ')]
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)) - 1, 3)
  return (
    (value / 1024 ** (index + 1)).toLocaleString(getLocale(), { maximumFractionDigits: 1 }) +
    ' ' +
    units[index]
  )
}
export function localDate(value: string) {
  const d = new Date(value)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
