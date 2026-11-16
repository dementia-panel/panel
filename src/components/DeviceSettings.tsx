import { useState } from 'react'
import { api, useResource } from '../lib/api'
import { t } from '../lib/i18n'
import { ActionForm, ErrorNotice, Field, Loading, useFeedback } from './ui'

function SettingsForm({
  initial,
  onSaved,
}: {
  initial: number | null
  onSaved: () => Promise<void>
}) {
  const [unlimited, setUnlimited] = useState(initial === null)
  const [limit, setLimit] = useState(String(initial ?? 3))
  const feedback = useFeedback()
  return (
    <ActionForm
      submitLabel={t('Сохранить')}
      onSubmit={async () => {
        const value = unlimited ? null : Number(limit)
        if (value !== null && (!Number.isInteger(value) || value < 1 || value > 10000))
          throw new Error(t('Укажите лимит от 1 до 10000.'))
        await api('/settings/devices', 'PUT', { default_device_limit: value })
        await onSaved()
        feedback.notify(t('Настройки устройств сохранены'))
      }}
    >
      <label className="check-field">
        <input
          type="checkbox"
          checked={unlimited}
          onChange={(e) => setUnlimited(e.target.checked)}
        />
        {t('Без лимита устройств')}
      </label>
      {!unlimited && (
        <Field label={t('Лимит устройств по умолчанию')}>
          <input
            type="number"
            min={1}
            max={10000}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </Field>
      )}
    </ActionForm>
  )
}
export function DeviceSettings() {
  const settings = useResource<{ default_device_limit: number | null }>('/settings/devices')
  return (
    <section className="surface padded device-settings">
      <h2>{t('Устройства пользователей')}</h2>
      <p className="muted">
        {t(
          'Лимит применяется только к новым пользователям. В карточке пользователя его можно изменить или отключить.',
        )}
      </p>
      {settings.error ? (
        <ErrorNotice message={settings.error} retry={() => void settings.refresh()} />
      ) : settings.loading ? (
        <Loading />
      ) : (
        settings.data && (
          <SettingsForm initial={settings.data.default_device_limit} onSaved={settings.refresh} />
        )
      )}
    </section>
  )
}
