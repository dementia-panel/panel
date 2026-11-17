import { useState } from 'react'
import { api, useResource } from '../lib/api'
import { t } from '../lib/i18n'
import { ActionForm, ErrorNotice, Loading, useFeedback } from './ui'

type Preferences = Record<'node' | 'user' | 'admin' | 'api_token' | 'subscription', boolean>
const categories: [keyof Preferences, string][] = [
  ['node', 'События нод'],
  ['user', 'События пользователей'],
  ['admin', 'Вход администратора'],
  ['api_token', 'Изменения API-ключей'],
  ['subscription', 'События подписок'],
]
function PreferencesForm({ initial }: { initial: Preferences }) {
  const [value, setValue] = useState(initial)
  const feedback = useFeedback()
  return (
    <ActionForm
      submitLabel={t('Сохранить')}
      onSubmit={async () => {
        await api('/settings/telegram', 'PUT', value)
        feedback.notify(t('Настройки уведомлений сохранены'))
      }}
    >
      {categories.map(([key, label]) => (
        <label key={key} className="check-field">
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(event) => setValue({ ...value, [key]: event.target.checked })}
          />
          {t(label)}
        </label>
      ))}
    </ActionForm>
  )
}
export function TelegramSettings() {
  const resource = useResource<Preferences>('/settings/telegram')
  return (
    <section className="surface padded device-settings">
      <h2>{t('Уведомления Telegram')}</h2>
      <p className="muted">{t('Выберите события для отправки в настроенный Telegram-чат.')}</p>
      {resource.error ? (
        <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
      ) : resource.loading ? (
        <Loading />
      ) : (
        resource.data && <PreferencesForm initial={resource.data} />
      )}
    </section>
  )
}
