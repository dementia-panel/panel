import { t, useLanguage } from '../lib/i18n'
import { Radio, Webhook, Terminal } from 'lucide-react'
import { Badge, CopyValue, ErrorNotice, Heading } from '../components/ui'
import { date, useResource } from '../lib/api'
import type { IntegrationStatus, Integrations } from '../lib/types'
import { Select } from '../components/Select'
import { SubscriptionBrandingSettings } from '../components/SubscriptionBranding'

function ConnectionStatus({
  status,
  unavailable,
}: {
  status?: IntegrationStatus
  unavailable: boolean
}) {
  if (unavailable) return <Badge tone="warning">{t('Статус недоступен')}</Badge>
  if (!status) return <Badge>{t('Проверяем…')}</Badge>
  const states = {
    disabled: { tone: 'neutral', label: t('Отключён') },
    pending: { tone: 'warning', label: t('Ожидает проверки') },
    connected: { tone: 'success', label: t('Подключён') },
    error: { tone: 'danger', label: t('Ошибка соединения') },
  } as const
  const value = states[status.state]
  return <Badge tone={value.tone}>{value.label}</Badge>
}
export default function SettingsPage() {
  const { language, setLanguage } = useLanguage()
  const integrations = useResource<Integrations>('/settings/integrations', 10000)
  return (
    <>
      <Heading
        title={t('Настройки')}
        description={t('Адрес панели и параметры подключения сервисов.')}
      />
      <div className="settings-address">
        <span className="settings-field-label">{t('Адрес панели')}</span>
        <CopyValue value={window.location.origin} inputLabel={t('Адрес панели')} />
      </div>
      <section className="surface settings-language padded mt-6">
        <div>
          <h2 id="language-label">{t('Язык интерфейса')}</h2>
          <p>{t('Язык сохраняется в этом браузере.')}</p>
        </div>
        <Select
          labelledBy="language-label"
          value={language}
          onChange={(value) => setLanguage(value as 'en' | 'ru')}
          options={[
            { value: 'en', label: 'English', lang: 'en' },
            { value: 'ru', label: 'Русский', lang: 'ru' },
          ]}
        />
      </section>
      <SubscriptionBrandingSettings />
      <section className="surface mt-6">
        <div className="section-head">
          <div>
            <h2>{t('Интеграции')}</h2>
            <p>{t('Параметры задаются в окружении backend и применяются после перезапуска.')}</p>
          </div>
          <Terminal size={20} />
        </div>
        {integrations.error && (
          <ErrorNotice message={integrations.error} retry={() => void integrations.refresh()} />
        )}
        <div className="integration-row">
          <Radio size={23} />
          <div className="integration-body">
            <div className="integration-title">
              <h3>{t('Telegram-бот')}</h3>
              <ConnectionStatus
                status={integrations.data?.telegram}
                unavailable={!!integrations.error}
              />
            </div>
            <p>{t('Уведомления о нодах и метриках. Поддерживаются polling и webhook.')}</p>
            <code>TELEGRAM_BOT_TOKEN · TELEGRAM_CHAT_ID · TELEGRAM_MODE</code>
            <p className="integration-check">
              {integrations.data?.telegram.checked_at
                ? t('Последняя проверка: ') + date(integrations.data.telegram.checked_at)
                : t('Статус обновляется по результатам обращений к Telegram API.')}
            </p>
          </div>
        </div>
        <div className="integration-row">
          <Webhook size={23} />
          <div className="integration-body">
            <div className="integration-title">
              <h3>{t('Webhook событий')}</h3>
              <ConnectionStatus
                status={integrations.data?.webhook}
                unavailable={!!integrations.error}
              />
            </div>
            <p>{t('События пользователей, нод и подписок. При пустом URL отправка отключена.')}</p>
            <code>WEBHOOK_URL · WEBHOOK_SECRET_HEADER</code>
            <p className="integration-check">
              {integrations.data?.webhook.checked_at
                ? t('Последняя попытка доставки: ') + date(integrations.data.webhook.checked_at)
                : t('Связь проверяется при отправке событий.')}
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
