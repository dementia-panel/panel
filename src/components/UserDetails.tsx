import { useState } from 'react'
import { bytes, api, date, useResource } from '../lib/api'
import { t } from '../lib/i18n'
import type { Subscription, SubscriptionPlan, User } from '../lib/types'
import { Select } from './Select'
import { ActionForm, Badge, ErrorNotice, Field, Loading, Modal, useFeedback } from './ui'

function dateInput(value: string | null) {
  if (!value) return ''
  const parsed = new Date(value)
  return [
    parsed.getFullYear(),
    String(parsed.getMonth() + 1).padStart(2, '0'),
    String(parsed.getDate()).padStart(2, '0'),
  ].join('-')
}

function DetailsForm({
  user,
  access,
  plans,
  onSaved,
  onClose,
  onIssued,
}: {
  user: User
  access: Subscription | null
  plans: SubscriptionPlan[]
  onSaved: () => Promise<void>
  onClose: () => void
  onIssued: (value: { id: string; planId: string; url?: string }) => void
}) {
  const [selectedPlan, setSelectedPlan] = useState(user.subscription_plan_id ?? '')
  const [unlimited, setUnlimited] = useState(!access?.expires_at)
  const [expiry, setExpiry] = useState(dateInput(access?.expires_at ?? null))
  const feedback = useFeedback()
  return (
    <ActionForm
      onCancel={onClose}
      submitLabel={t('Сохранить изменения')}
      onSubmit={async (form) => {
        const rawTelegram = String(form.get('telegram_id') || '').trim()
        const telegram = rawTelegram ? Number(rawTelegram) : null
        if (telegram !== null && (!Number.isSafeInteger(telegram) || telegram <= 0)) {
          throw new Error(t('Telegram ID должен быть положительным целым числом.'))
        }
        let expiresAt: string | null = null
        if (selectedPlan && !unlimited) {
          const [year, month, day] = expiry.split('-').map(Number)
          const end = new Date(year, month - 1, day, 23, 59, 59, 999)
          if (Number.isNaN(end.getTime())) throw new Error(t('Выберите дату окончания подписки.'))
          expiresAt = end.toISOString()
        }
        const username = String(form.get('username')).trim()
        const enabled = form.get('enabled') === 'on'
        if (
          username !== user.username ||
          telegram !== user.telegram_id ||
          enabled !== user.enabled
        ) {
          await api('/users/' + user.id, 'PATCH', { username, telegram_id: telegram, enabled })
        }
        const planId = String(form.get('plan_id') || '') || null
        const assigned = await api<{ id?: string; url?: string }>(
          '/users/' + user.id + '/subscription',
          'PUT',
          {
            plan_id: planId,
            enabled: form.get('subscription_enabled') === 'on',
            expires_at: expiresAt,
          },
        )
        if (assigned.id && assigned.url && planId)
          onIssued({ id: assigned.id, planId, url: assigned.url })
        await onSaved()
        feedback.notify(t('Пользователь обновлён'))
        onClose()
      }}
    >
      <div className="user-detail-summary">
        <span className="user-avatar">{user.username.slice(0, 2).toUpperCase()}</span>
        <div>
          <strong>{user.username}</strong>
          <span>
            {t('Последнее подключение')} · {date(user.last_connected_at)}
          </span>
        </div>
        <Badge tone={user.online ? 'success' : 'neutral'}>
          {user.online ? t('Сейчас в VPN') : t('Не в сети')}
        </Badge>
      </div>
      <div className="form-grid">
        <Field label={t('Имя пользователя')}>
          <input name="username" required maxLength={128} defaultValue={user.username} />
        </Field>
        <Field label="Telegram ID">
          <input
            name="telegram_id"
            inputMode="numeric"
            pattern="[0-9]*"
            defaultValue={user.telegram_id ?? ''}
          />
        </Field>
      </div>
      <label className="user-access-switch">
        <span>
          {t('Доступ пользователя')}
          <small>{t('Разрешает пользователю пользоваться VPN.')}</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          name="enabled"
          defaultChecked={user.enabled}
          aria-label={t('Доступ пользователя')}
        />
      </label>
      <section className="user-subscription-settings">
        <h3>{t('Подписка')}</h3>
        <Field label={t('Подписка')}>
          <input type="hidden" name="plan_id" value={selectedPlan} />
          <Select
            value={selectedPlan}
            onChange={setSelectedPlan}
            ariaLabel={t('Подписка')}
            options={[
              { value: '', label: t('Без подписки') },
              ...plans.map((plan) => ({ value: plan.id, label: plan.name })),
            ]}
          />
        </Field>
        <fieldset className="user-subscription-options" disabled={!selectedPlan}>
          <label className="user-access-switch">
            <span>
              {t('Подписка включена')}
              <small>{t('Выключение приостанавливает доступ по выданным ключам.')}</small>
            </span>
            <input
              type="checkbox"
              role="switch"
              name="subscription_enabled"
              defaultChecked={access?.enabled ?? true}
              aria-label={t('Подписка включена')}
            />
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={unlimited}
              onChange={(event) => setUnlimited(event.target.checked)}
            />
            {t('Без ограничения срока')}
          </label>
          {selectedPlan && !unlimited && (
            <Field
              label={t('Действует до')}
              hint={
                t('Включительно до конца выбранного дня.') +
                ' ' +
                Intl.DateTimeFormat().resolvedOptions().timeZone
              }
            >
              <input
                type="date"
                required
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
              />
            </Field>
          )}
        </fieldset>
      </section>
      <dl className="details user-detail-facts">
        <dt>ID</dt>
        <dd className="mono">{user.id}</dd>
        <dt>{t('Создан')}</dt>
        <dd>{date(user.created_at)}</dd>
        <dt>{t('Обновлён')}</dt>
        <dd>{date(user.updated_at)}</dd>
        <dt>{t('Трафик')}</dt>
        <dd>{bytes(access?.traffic_used_bytes ?? 0)}</dd>
        <dt>{t('Лимит трафика')}</dt>
        <dd>
          {access?.traffic_limit_bytes ? bytes(access.traffic_limit_bytes) : t('Без ограничений')}
        </dd>
      </dl>
    </ActionForm>
  )
}

export function UserDetails({
  userId,
  onClose,
  onSaved,
  onIssued,
}: {
  userId: string
  onClose: () => void
  onSaved: () => Promise<void>
  onIssued: (value: { id: string; planId: string; url?: string }) => void
}) {
  const user = useResource<User>('/users/' + userId)
  const access = useResource<Subscription | null>('/users/' + userId + '/subscription')
  const plans = useResource<SubscriptionPlan[]>('/subscription-plans')
  const error = user.error || access.error || plans.error
  return (
    <Modal title={t('Карточка пользователя')} onClose={onClose} wide className="user-details-modal">
      {error ? (
        <ErrorNotice
          message={error}
          retry={() => {
            void user.refresh()
            void access.refresh()
            void plans.refresh()
          }}
        />
      ) : user.loading || access.loading || plans.loading ? (
        <Loading />
      ) : (
        user.data &&
        plans.data && (
          <DetailsForm
            user={user.data}
            access={access.data ?? null}
            plans={plans.data}
            onSaved={onSaved}
            onIssued={onIssued}
            onClose={onClose}
          />
        )
      )}
    </Modal>
  )
}
