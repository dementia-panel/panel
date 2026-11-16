import { useEffect, useId, useState } from 'react'
import { ArrowDownToLine, Pause, Play } from 'lucide-react'
import { Select } from '../components/Select'
import { Modal } from '../components/ui'
import { amneziaFrames } from '../lib/amneziaQr'
import { t } from '../lib/i18n'

export type Location = { id: string; name: string; available: boolean }

export function profilePath(base: string, id: string) {
  return base + '/nodes/' + encodeURIComponent(id)
}

export async function fetchProfile(path: string, signal?: AbortSignal) {
  const response = await fetch(path, {
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    signal,
  })
  if (!response.ok) throw new Error('Profile unavailable')
  return response.text()
}

type Mode = 'link' | 'vpn' | 'wg'

export function QRFrames({ frames, label }: { frames: string[]; label: string }) {
  const [frame, setFrame] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = frames.length
  useEffect(() => {
    if (paused || count < 2) return
    const timer = window.setInterval(() => setFrame((index) => (index + 1) % count), 600)
    return () => window.clearInterval(timer)
  }, [count, paused])

  return (
    <figure className="subscription-qr-frame">
      <img src={frames[frame]} alt={label} width={272} height={272} />
      {count > 1 && (
        <figcaption>
          <span>
            {t('Кадр')} {frame + 1} / {count}
          </span>
          <button
            className="subscription-button"
            type="button"
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? <Play size={14} /> : <Pause size={14} />}
            {paused ? t('Продолжить смену кадров') : t('Приостановить смену кадров')}
          </button>
        </figcaption>
      )}
    </figure>
  )
}

export function SubscriptionQR({
  base,
  locations,
  initialServer,
  initialMode,
  onClose,
}: {
  base: string
  locations: Location[]
  initialServer?: string
  initialMode?: Mode
  onClose: () => void
}) {
  const serverLabel = useId()
  const [mode, setMode] = useState<Mode>(initialMode ?? (initialServer ? 'vpn' : 'link'))
  const [server, setServer] = useState(initialServer ?? locations[0]?.id ?? '')
  const [result, setResult] = useState<{ request: string; images: string[] } | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const root = mode === 'link' ? base : profilePath(base, server)
  const request = mode + ':' + root + ':' + attempt

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const { toDataURL } = await import('qrcode')
        let payloads: string[]
        if (mode === 'link') {
          payloads = [new URL(root, window.location.origin).href]
        } else {
          const profile = await fetchProfile(
            root + (mode === 'vpn' ? '.key' : '.conf'),
            controller.signal,
          )
          payloads = mode === 'vpn' ? amneziaFrames(profile) : [profile]
        }
        const images = await Promise.all(
          payloads.map((payload) =>
            toDataURL(payload, {
              width: 540,
              margin: 4,
              errorCorrectionLevel: 'L',
            }),
          ),
        )
        if (!controller.signal.aborted) setResult({ request, images })
      } catch {
        if (!controller.signal.aborted) setError(request)
      }
    })()
    return () => controller.abort()
  }, [mode, request, root])

  const modes: { value: Mode; label: string }[] = [
    { value: 'link', label: t('Ссылка подписки') },
    { value: 'vpn', label: 'AmneziaVPN' },
    { value: 'wg', label: 'AmneziaWG' },
  ]
  const qrLabel =
    mode === 'link'
      ? t('QR-код ссылки подписки')
      : t(mode === 'vpn' ? 'QR-код AmneziaVPN' : 'QR-код AmneziaWG')

  return (
    <Modal title={t('QR-коды')} onClose={onClose} className="subscription-qr-modal">
      <div className="subscription-qr">
        <div
          className="subscription-qr-modes"
          role="group"
          aria-label={t('Приложение для сканирования')}
        >
          {modes.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              className="subscription-button"
              disabled={value !== 'link' && !locations.length}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {label}
            </button>
          ))}
        </div>
        {mode !== 'link' && (
          <div className="subscription-qr-server">
            <span id={serverLabel}>{t('Сервер')}</span>
            <Select
              labelledBy={serverLabel}
              value={server}
              onChange={setServer}
              options={locations.map(({ id, name }) => ({ value: id, label: name }))}
            />
          </div>
        )}
        <div className="subscription-qr-display">
          {result?.request === request ? (
            <QRFrames key={request} frames={result.images} label={qrLabel} />
          ) : error === request ? (
            <>
              <p role="alert">{t('Не удалось создать QR-код.')}</p>
              <button
                className="subscription-button"
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t('Повторить')}
              </button>
              {mode !== 'link' && (
                <a
                  className="subscription-button"
                  href={root + (mode === 'vpn' ? '.vpn' : '.conf')}
                >
                  <ArrowDownToLine size={15} />
                  {t('Скачать конфиг')}
                </a>
              )}
            </>
          ) : (
            <p role="status">{t('Готовим QR-код…')}</p>
          )}
        </div>
        <p className="subscription-qr-help">
          {mode === 'link'
            ? t('Отсканируйте камерой телефона, чтобы открыть страницу со всеми серверами.')
            : mode === 'vpn'
              ? t('Наведите камеру в AmneziaVPN и дождитесь, пока приложение считает все кадры.')
              : t('Отсканируйте этот код в AmneziaWG, чтобы добавить выбранный сервер.')}
        </p>
      </div>
    </Modal>
  )
}
