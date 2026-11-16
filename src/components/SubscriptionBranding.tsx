import { useState } from 'react'
import { ImagePlus } from 'lucide-react'
import { api, useResource } from '../lib/api'
import { t } from '../lib/i18n'
import type { SubscriptionBranding } from '../lib/types'
import { SubscriptionBrand } from './SubscriptionBrand'
import { Button, ErrorNotice, Loading, useFeedback } from './ui'

const endpoint = '/settings/subscription-branding'

function BrandingForm({ initial }: { initial: SubscriptionBranding }) {
  const [saved, setSaved] = useState(initial)
  const [draft, setDraft] = useState(initial)
  const [reading, setReading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const { notify } = useFeedback()
  const preview = { ...draft, name: draft.name.trim() || 'dementia' }
  const changed = draft.name.trim() !== saved.name || draft.logo !== saved.logo

  async function readLogo(file: File) {
    setError('')
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 256 * 1024) {
      setError(t('Выберите PNG или JPEG размером до 256 КБ.'))
      return
    }
    setReading(true)
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const logo = reader.result
        setDraft((current) => ({ ...current, logo }))
      }
    }
    reader.onerror = () => setError(t('Не удалось прочитать логотип.'))
    reader.onloadend = () => setReading(false)
    reader.readAsDataURL(file)
  }

  async function save() {
    if (saving || reading || !draft.name.trim() || !changed) return
    setSaving(true)
    setError('')
    try {
      const branding = await api<SubscriptionBranding>(endpoint, 'PUT', {
        name: draft.name.trim(),
        logo: draft.logo,
      })
      setDraft(branding)
      setSaved(branding)
      notify(t('Оформление страницы подписки сохранено.'))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('Не удалось выполнить операцию. Повторите запрос.'),
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="padded subscription-branding-form"
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <div className="subscription-branding-preview">
        <span className="settings-field-label">{t('Предпросмотр')}</span>
        <SubscriptionBrand branding={preview} />
      </div>
      <div className="subscription-branding-fields">
        <label>
          {t('Название проекта')}
          <input
            value={draft.name}
            required
            maxLength={64}
            disabled={saving}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </label>
        <label>
          {t('Логотип')}
          <input
            type="file"
            accept="image/png,image/jpeg"
            disabled={reading || saving}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              if (file) void readLogo(file)
              event.currentTarget.value = ''
            }}
          />
          <small>PNG / JPEG · 256 KB · 2048 × 2048 px</small>
        </label>
        {error && <ErrorNotice message={error} />}
        <div className="subscription-branding-actions">
          <Button
            type="submit"
            variant="primary"
            disabled={saving || reading || !draft.name.trim() || !changed}
          >
            {t('Сохранить')}
          </Button>
          {draft.logo && (
            <Button
              type="button"
              disabled={saving || reading}
              onClick={() => setDraft({ ...draft, logo: '' })}
            >
              {t('Вернуть стандартный логотип')}
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

export function SubscriptionBrandingSettings() {
  const { data, error, refresh } = useResource<SubscriptionBranding>(endpoint)
  return (
    <section className="surface">
      <div className="section-head">
        <div>
          <h2>{t('Оформление страницы подписки')}</h2>
          <p>{t('Название и логотип видны всем, кто откроет страницу по ссылке подписки.')}</p>
        </div>
        <ImagePlus size={20} />
      </div>
      {error ? (
        <ErrorNotice message={error} retry={() => void refresh()} />
      ) : data ? (
        <BrandingForm initial={data} />
      ) : (
        <Loading />
      )}
    </section>
  )
}
