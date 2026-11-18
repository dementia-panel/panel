import { useState } from 'react'
import { t } from '../lib/i18n'
import { Field } from './ui'

export function localExpiry(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19)
}

export function readSubscriptionExpiry(form: FormData, original: string | null = null) {
  if (form.get('unlimited_expiry') === 'on') return null
  const input = String(form.get('expires_at') || '')
  const date = new Date(input)
  const normalized = input.length === 16 ? input + ':00' : input.replace(/\.0+$/, '')
  if (!input || Number.isNaN(date.getTime()) || localExpiry(date.toISOString()) !== normalized)
    throw new Error(t('Выберите дату и время окончания подписки.'))
  if (original && normalized === localExpiry(original)) return original
  return date.toISOString()
}

export function SubscriptionExpiry({
  expiresAt = null,
  disabled = false,
}: {
  expiresAt?: string | null
  disabled?: boolean
}) {
  const [unlimited, setUnlimited] = useState(!expiresAt)
  const [expiry, setExpiry] = useState(localExpiry(expiresAt))
  return (
    <fieldset className="subscription-expiry-fields" disabled={disabled}>
      <label className="check-field">
        <input
          name="unlimited_expiry"
          type="checkbox"
          checked={unlimited}
          onChange={(event) => setUnlimited(event.target.checked)}
        />
        {t('Без ограничения срока')}
      </label>
      {!unlimited && (
        <Field
          label={t('Действует до')}
          hint={t('Часовой пояс: ') + Intl.DateTimeFormat().resolvedOptions().timeZone}
        >
          <input
            type="datetime-local"
            name="expires_at"
            required
            step="1"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          />
        </Field>
      )}
    </fieldset>
  )
}
