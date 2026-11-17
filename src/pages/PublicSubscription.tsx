import { useEffect, useId, useState } from 'react'
import {
  ArrowDownToLine,
  Copy,
  KeyRound,
  QrCode,
  Server,
  ShieldCheck,
  Check,
  ExternalLink,
} from 'lucide-react'
import { useParams } from 'react-router-dom'
import { CopyValue } from '../components/ui'
import { Select } from '../components/Select'
import { SubscriptionBrand } from '../components/SubscriptionBrand'
import { date } from '../lib/api'
import { t, useLanguage, getLocale } from '../lib/i18n'
import type { SubscriptionBranding } from '../lib/types'
import { fetchProfile, profilePath, SubscriptionQR, type Location } from './SubscriptionQR'
import './PublicSubscription.css'

type Manifest = {
  devices?: { id: string; name: string; online?: boolean; last_connected_at?: string | null }[]
  name: string
  expires_at?: string | null
  locations: Location[]
  branding?: SubscriptionBranding
}

export function applicationDownloadURL(
  app: 'vpn' | 'wg',
  userAgent = navigator.userAgent,
  touchPoints = navigator.maxTouchPoints,
): string {
  const ios =
    /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && touchPoints > 1)
  if (ios)
    return app === 'vpn'
      ? 'https://apps.apple.com/app/amneziavpn/id1600529900'
      : 'https://apps.apple.com/app/amneziawg/id6478942365'
  if (/Android/i.test(userAgent))
    return (
      'https://play.google.com/store/apps/details?id=' +
      (app === 'vpn' ? 'org.amnezia.vpn' : 'org.amnezia.awg')
    )
  return app === 'vpn'
    ? 'https://amnezia.org/downloads'
    : 'https://docs.amnezia.org/documentation/amnezia-wg/'
}

function ServerCard({
  location,
  base,
  openQR,
  app,
}: {
  location: Location
  base: string
  openQR: () => void
  app: 'vpn' | 'wg'
}) {
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState('')
  const [revealed, setRevealed] = useState('')
  const root = profilePath(base, location.id)

  async function perform(action: 'key' | 'copy') {
    if (processing) return
    setProcessing(true)
    setMessage('')
    try {
      const key = fetchProfile(root + '.key').then((value) => {
        if (!value.startsWith('vpn://')) throw new Error('Invalid key')
        return value
      })
      if (action === 'key') {
        setRevealed(await key)
      } else {
        try {
          if (typeof ClipboardItem === 'function' && navigator.clipboard?.write) {
            const content = key.then((value) => new Blob([value], { type: 'text/plain' }))
            void content.catch(() => {})
            await navigator.clipboard.write([new ClipboardItem({ 'text/plain': content })])
          } else {
            await navigator.clipboard.writeText(await key)
          }
          setMessage('Ключ скопирован.')
        } catch {
          setRevealed(await key)
          setMessage('Скопируйте ключ из поля ниже.')
        }
      }
    } catch {
      setMessage('Профиль пока недоступен. Обновите страницу и попробуйте снова.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <article className="subscription-server">
      {location.available ? (
        <>
          <div className="subscription-server-actions">
            {app === 'vpn' && (
              <button
                className="subscription-button primary"
                disabled={processing}
                onClick={() => void perform('copy')}
              >
                <Copy size={16} />
                {t('Скопировать vpn://')}
              </button>
            )}
            <button className="subscription-button" onClick={openQR}>
              <QrCode size={17} />
              {t('QR-коды')}
            </button>
          </div>
          <div className="subscription-downloads">
            {app === 'vpn' && (
              <a className="subscription-button" href={root + '.vpn'}>
                <ArrowDownToLine size={15} /> <span>AmneziaVPN</span> <code>.vpn</code>
              </a>
            )}
            {app === 'wg' && (
              <a className="subscription-button" href={root + '.conf'}>
                <ArrowDownToLine size={15} /> <span>AmneziaWG</span> <code>.conf</code>
              </a>
            )}
            {app === 'vpn' && (
              <button
                className="subscription-button"
                disabled={processing}
                onClick={() => (revealed ? setRevealed('') : void perform('key'))}
              >
                <KeyRound size={15} />
                {revealed ? t('Скрыть ключ') : t('Показать ключ')}
              </button>
            )}
          </div>
          {message && (
            <p className="subscription-feedback" role="status">
              {t(message)}
            </p>
          )}
          {revealed && (
            <textarea
              className="subscription-key"
              readOnly
              value={revealed}
              aria-label={t('Ключ vpn://')}
              onFocus={(event) => event.currentTarget.select()}
            />
          )}
        </>
      ) : (
        <p className="subscription-feedback">
          {t('Профиль появится, когда сервер синхронизируется.')}
        </p>
      )}
    </article>
  )
}

export default function PublicSubscription() {
  const { token = '' } = useParams()
  const { language, setLanguage } = useLanguage()
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [failure, setFailure] = useState<'unavailable' | 'network' | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [qr, setQR] = useState<{ server?: string } | null>(null)
  const [app, setApp] = useState<'vpn' | 'wg'>('vpn')
  const [selectedId, setSelectedId] = useState('')
  const [deviceID, setDeviceID] = useState(
    () => new URLSearchParams(window.location.search).get('device_id') ?? '',
  )
  const serverLabel = useId()
  const base = '/s/' + encodeURIComponent(token)

  useEffect(() => {
    const controller = new AbortController()
    setManifest(null)
    setFailure(null)
    let refreshing = false
    const refresh = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const result = await fetch(base + '/manifest', {
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'error',
          signal: controller.signal,
        })
        if (!result.ok) {
          if (!controller.signal.aborted) {
            if (result.status === 404) setManifest(null)
            setFailure(result.status === 404 ? 'unavailable' : 'network')
          }
          return
        }
        const value: Manifest = await result.json()
        if (!controller.signal.aborted) {
          setManifest(value)
          setFailure(null)
        }
      } catch {
        if (!controller.signal.aborted) setFailure('network')
      } finally {
        refreshing = false
      }
    }
    void refresh()
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh()
    }, 15000)
    return () => {
      controller.abort()
      window.clearInterval(timer)
    }
  }, [attempt, base])

  const device = manifest?.devices?.find((item) => item.id === deviceID) ?? manifest?.devices?.[0]
  const used = !!(device?.online || device?.last_connected_at)
  const profileBase = device ? base + '/devices/' + encodeURIComponent(device.id) : base
  const available = manifest?.locations.filter((location) => location.available) ?? []
  const selected =
    manifest?.locations.find((location) => location.id === selectedId) ??
    available[0] ??
    manifest?.locations[0]
  const branding = manifest?.branding ?? { name: 'dementia', logo: '' }
  useEffect(() => {
    if (used || !manifest) setQR(null)
  }, [used, manifest])

  useEffect(() => {
    document.title = manifest ? manifest.name + ' · ' + branding.name : t('Подключение к VPN')
  }, [manifest, branding.name, language])

  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (!icon || !branding.logo) return
    const original = icon.href
    const originalType = icon.type
    icon.removeAttribute('type')
    icon.href = branding.logo
    return () => {
      icon.href = original
      icon.type = originalType
    }
  }, [branding.logo])

  return (
    <div className="subscription-site">
      <header className="subscription-site-header">
        <SubscriptionBrand branding={branding} />
        <div className="subscription-languages" role="group" aria-label={t('Язык интерфейса')}>
          <button
            type="button"
            lang="en"
            aria-pressed={language === 'en'}
            onClick={() => setLanguage('en')}
          >
            EN
          </button>
          <button
            type="button"
            lang="ru"
            aria-pressed={language === 'ru'}
            onClick={() => setLanguage('ru')}
          >
            RU
          </button>
        </div>
      </header>
      <main className="subscription-site-main">
        {used ? (
          <section className="subscription-hero" role="status">
            <span className="subscription-status">
              <i />
              {t('Данный ключ уже использован')}
            </span>
            <h1>{t('Подключение к VPN')}</h1>
            <p>{t('Этот ключ уже активирован на устройстве.')}</p>
          </section>
        ) : (
          <>
            <section className="subscription-hero">
              <span className={'subscription-status' + (manifest ? ' is-available' : '')}>
                <i />
                {manifest
                  ? t('Подписка активна')
                  : failure
                    ? t('Подписка недоступна')
                    : t('Загрузка подписки…')}
              </span>
              <h1>
                {manifest?.expires_at
                  ? t('до') +
                    ' ' +
                    new Date(manifest.expires_at).toLocaleDateString(getLocale(), {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : manifest?.name || t('Подключение к VPN')}
              </h1>
              {manifest?.expires_at && <p className="subscription-plan-name">{manifest.name}</p>}
              {manifest && (
                <dl className="subscription-facts">
                  <div>
                    <dt>
                      <ShieldCheck size={17} />
                      {t('Срок действия')}
                    </dt>
                    <dd>
                      {manifest.expires_at ? date(manifest.expires_at) : t('Без ограничения срока')}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <Server size={17} />
                      {t('Серверы подключения')}
                    </dt>
                    <dd>
                      {available.length} / {manifest.locations.length} {t('доступно')}
                    </dd>
                  </div>
                </dl>
              )}
              {failure && (
                <p>
                  {failure === 'unavailable'
                    ? t('Проверьте правильность ссылки.')
                    : t('Не удалось загрузить настройки подключения.')}
                </p>
              )}
              {failure === 'network' && (
                <button
                  className="subscription-button"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  {t('Повторить')}
                </button>
              )}
            </section>
            {manifest && (
              <>
                <section className="subscription-install">
                  {!!manifest?.devices?.length && (
                    <div className="subscription-device-picker">
                      <span id="subscription-device-label">{t('Устройство для подключения')}</span>
                      <Select
                        labelledBy="subscription-device-label"
                        value={device?.id ?? ''}
                        onChange={setDeviceID}
                        options={manifest.devices.map((item) => ({
                          value: item.id,
                          label: item.name === 'Main device' ? t('Основное устройство') : item.name,
                        }))}
                      />
                    </div>
                  )}
                  {device && (
                    <div
                      className={'subscription-device-status' + (device.online ? ' is-online' : '')}
                      role="status"
                    >
                      <strong>
                        {device.name === 'Main device' ? t('Основное устройство') : device.name}
                      </strong>
                      <p>
                        {device.online
                          ? t('По этому ключу уже подключено устройство.')
                          : t('Устройство сейчас не подключено.')}
                      </p>
                      {device.last_connected_at && (
                        <small>
                          {t('Последнее подключение')} · {date(device.last_connected_at)}
                        </small>
                      )}
                    </div>
                  )}
                  <div className="subscription-section-title">
                    <h2>{t('Настройка подключения')}</h2>
                    <span>{t('Выберите приложение')}</span>
                  </div>
                  <div className="subscription-install-layout">
                    <div
                      className="subscription-apps"
                      role="group"
                      aria-label={t('Приложение для подключения')}
                    >
                      <button
                        type="button"
                        aria-pressed={app === 'vpn'}
                        onClick={() => setApp('vpn')}
                      >
                        <span
                          className="subscription-app-icon subscription-app-icon-vpn"
                          aria-hidden="true"
                        />
                        <span>
                          <strong>AmneziaVPN</strong>
                          <small>{t('Ключ и конфиг .vpn')}</small>
                        </span>
                        {app === 'vpn' && <Check size={17} />}
                      </button>
                      <button
                        type="button"
                        aria-pressed={app === 'wg'}
                        onClick={() => setApp('wg')}
                      >
                        <span
                          className="subscription-app-icon subscription-app-icon-wg"
                          aria-hidden="true"
                        />
                        <span>
                          <strong>AmneziaWG</strong>
                          <small>{t('Конфиг .conf')}</small>
                        </span>
                        {app === 'wg' && <Check size={17} />}
                      </button>
                    </div>
                    <ol className="subscription-steps">
                      <li>
                        <span className="subscription-step-number">1</span>
                        <div>
                          <h3>{t('Установка приложения')}</h3>
                          <p>
                            {t(
                              'Установите приложение для вашего устройства. Затем вернитесь на эту страницу.',
                            )}
                          </p>
                          <a
                            className="subscription-button"
                            href={applicationDownloadURL(app)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ArrowDownToLine size={17} />
                            {t('Скачать приложение')}
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </li>
                      <li>
                        <span className="subscription-step-number">2</span>
                        <div>
                          <h3>{t('Добавление сервера')}</h3>
                          <p>
                            {app === 'vpn'
                              ? t(
                                  'Скопируйте ключ и вставьте его в AmneziaVPN. Также можно импортировать файл .vpn или отсканировать QR-код.',
                                )
                              : t(
                                  'Скачайте файл .conf и импортируйте его в AmneziaWG. Для подключения с другого устройства используйте QR-код.',
                                )}
                          </p>
                          {selected ? (
                            <>
                              <div className="subscription-choose-server">
                                <span id={serverLabel}>{t('Сервер')}</span>
                                <Select
                                  labelledBy={serverLabel}
                                  value={selected.id}
                                  onChange={setSelectedId}
                                  options={manifest.locations.map((location) => ({
                                    value: location.id,
                                    label:
                                      location.name +
                                      (location.available ? '' : ' · ' + t('Недоступен')),
                                  }))}
                                />
                              </div>
                              <ServerCard
                                key={profileBase + selected.id + app}
                                location={selected}
                                base={profileBase}
                                app={app}
                                openQR={() => setQR({ server: selected.id })}
                              />
                            </>
                          ) : (
                            <p>{t('В подписке пока нет серверов.')}</p>
                          )}
                        </div>
                      </li>
                      <li>
                        <span className="subscription-step-number">
                          <Check size={18} />
                        </span>
                        <div>
                          <h3>{t('Подключение и использование')}</h3>
                          <p>
                            {t(
                              'Включите VPN в приложении и разрешите добавление VPN-конфигурации, если устройство запросит подтверждение.',
                            )}
                          </p>
                        </div>
                      </li>
                    </ol>
                  </div>
                </section>
                <section className="subscription-link-section">
                  <div className="subscription-section-title">
                    <h2>{t('Ссылка на подписку')}</h2>
                    <button className="subscription-button" onClick={() => setQR({})}>
                      <QrCode size={16} />
                      {t('QR подписки')}
                    </button>
                  </div>
                  <CopyValue
                    value={
                      new URL(
                        device ? base + '?device_id=' + encodeURIComponent(device.id) : base,
                        window.location.origin,
                      ).href
                    }
                    inputLabel={t('Ссылка на подписку')}
                  />
                  <p>
                    {t(
                      'Сохраните эту ссылку, чтобы вернуться к своим серверам и настройкам подключения.',
                    )}
                  </p>
                </section>
              </>
            )}
          </>
        )}
      </main>
      {qr && manifest && !used && (
        <SubscriptionQR
          base={profileBase}
          locations={available}
          initialServer={qr.server}
          initialMode={qr.server ? app : 'link'}
          onClose={() => setQR(null)}
        />
      )}
    </div>
  )
}
