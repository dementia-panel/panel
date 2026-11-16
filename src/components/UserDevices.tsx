import { useState } from 'react'
import { Monitor, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, date, errorMessage, useResource } from '../lib/api'
import { t } from '../lib/i18n'
import type { Node, Subscription, User, UserDevice } from '../lib/types'
import { ProfileActions } from '../pages/Subscriptions'
import { Badge, Button, ErrorNotice, Field, Loading, CopyValue, useFeedback } from './ui'

export function DeviceLink({
  userID,
  deviceID,
  subscriptionID,
}: {
  userID: string
  deviceID: string
  subscriptionID: string
}) {
  const link = useResource<{ url: string }>(
    `/users/${userID}/devices/${deviceID}/link?subscription_id=${subscriptionID}`,
  )
  return (
    <div className="device-subscription-link">
      <span className="settings-field-label">{t('Ссылка подписки устройства')}</span>
      {link.error ? (
        <ErrorNotice message={link.error} retry={() => void link.refresh()} />
      ) : link.data ? (
        <CopyValue value={link.data.url} inputLabel={t('Ссылка подписки устройства')} />
      ) : (
        <Loading />
      )}
    </div>
  )
}

export function UserDevices({
  user,
  access,
  onChanged,
}: {
  user: User
  access: Subscription | null
  onChanged: () => Promise<void>
}) {
  const devices = useResource<UserDevice[]>(`/users/${user.id}/devices`, 15000)
  const nodes = useResource<Node[]>('/nodes')
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [unlimited, setUnlimited] = useState(user.device_limit == null)
  const [limit, setLimit] = useState(String(user.device_limit ?? 3))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const feedback = useFeedback()
  const count = devices.data?.length ?? user.device_count ?? 0
  const reached = user.device_limit != null && count >= user.device_limit
  async function change(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    setError('')
    try {
      await action()
      await Promise.all([devices.refresh(), onChanged()])
      feedback.notify(t(message))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="user-devices">
      <div className="user-device-limit">
        <label className="check-field">
          <input
            type="checkbox"
            checked={unlimited}
            onChange={(e) => setUnlimited(e.target.checked)}
          />
          {t('Без лимита устройств')}
        </label>
        <div className="user-device-create">
          {!unlimited && (
            <Field label={t('Лимит устройств')}>
              <input
                type="number"
                min={1}
                max={10000}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </Field>
          )}
          <Button
            type="button"
            busy={busy}
            onClick={() =>
              void change(async () => {
                const value = unlimited ? null : Number(limit)
                if (value !== null && (!Number.isInteger(value) || value < 1 || value > 10000))
                  throw new Error(t('Укажите лимит от 1 до 10000.'))
                await api(`/users/${user.id}/device-limit`, 'PUT', { device_limit: value })
              }, 'Лимит устройств сохранён')
            }
          >
            {t('Сохранить лимит')}
          </Button>
        </div>
        <p className="muted">
          {t(
            'Уменьшение лимита не удаляет существующие устройства, но запрещает выдачу новых ключей сверх лимита.',
          )}
        </p>
      </div>
      <form
        className="user-device-create"
        onSubmit={(e) => {
          e.preventDefault()
          void change(async () => {
            await api(`/users/${user.id}/devices`, 'POST', { name: name.trim() })
            setName('')
          }, 'Устройство добавлено')
        }}
      >
        <Field label={t('Название устройства')}>
          <input
            required
            maxLength={128}
            placeholder={t('Например, iPhone или рабочий ноутбук')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Button type="submit" busy={busy} disabled={reached || !name.trim()}>
          <Plus size={15} />
          {t('Добавить устройство')}
        </Button>
      </form>
      {reached && (
        <p className="muted">
          {t('Достигнут лимит устройств. Удалите устройство или увеличьте лимит.')}
        </p>
      )}
      <p className="muted">
        {t('Одно устройство — отдельный набор ключей для всех серверов подписки.')}
      </p>
      {(error || devices.error || nodes.error) && (
        <ErrorNotice
          message={error || devices.error || nodes.error || ''}
          retry={() => {
            void devices.refresh()
            void nodes.refresh()
          }}
        />
      )}
      {devices.loading ? (
        <Loading />
      ) : !devices.data?.length ? (
        <p className="muted">{t('Устройства ещё не добавлены.')}</p>
      ) : (
        devices.data.map((device) => (
          <article className="user-device-card" key={device.id}>
            <div className="user-device-heading">
              <Monitor size={20} />
              <div className="user-device-title">
                <strong>
                  {device.name === 'Main device' ? t('Основное устройство') : device.name}
                </strong>
                <small>
                  {t('Последнее подключение')} · {date(device.last_connected_at)}
                </small>
              </div>
              <Badge tone={device.online ? 'success' : 'neutral'}>
                {device.online ? t('Подключено') : t('Не в сети')}
              </Badge>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                aria-label={t('Переименовать устройство') + ': ' + device.name}
                onClick={() => {
                  setEditing(device.id)
                  setEditName(device.name)
                }}
              >
                <Pencil size={15} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                aria-label={t('Удалить устройство') + ': ' + device.name}
                onClick={() =>
                  feedback.confirm(
                    t('Удалить устройство') + ' «' + device.name + '»?',
                    t(
                      'Ключи этого устройства будут отозваны на всех нодах после синхронизации. Другие устройства сохранят доступ.',
                    ),
                    async () => {
                      await api(`/users/${user.id}/devices/${device.id}`, 'DELETE')
                      await Promise.all([devices.refresh(), onChanged()])
                    },
                  )
                }
              >
                <Trash2 size={15} />
              </Button>
            </div>
            {editing === device.id && (
              <form
                className="user-device-create"
                onSubmit={(e) => {
                  e.preventDefault()
                  void change(async () => {
                    await api(`/users/${user.id}/devices/${device.id}`, 'PATCH', {
                      name: editName.trim(),
                    })
                    setEditing(null)
                  }, 'Устройство переименовано')
                }}
              >
                <Field label={t('Новое название устройства')}>
                  <input
                    required
                    maxLength={128}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </Field>
                <Button type="submit" busy={busy}>
                  {t('Сохранить')}
                </Button>
                <Button type="button" onClick={() => setEditing(null)}>
                  {t('Отмена')}
                </Button>
              </form>
            )}
            {access && (
              <DeviceLink userID={user.id} deviceID={device.id} subscriptionID={access.id} />
            )}
            {access && (
              <Button
                type="button"
                onClick={() => setExpanded(expanded === device.id ? null : device.id)}
                aria-expanded={expanded === device.id}
              >
                {t('Ключи подключения')}
              </Button>
            )}
            {access &&
              expanded === device.id &&
              (access.node_ids ?? []).map((nodeID) => (
                <div className="user-connection-server" key={nodeID}>
                  <ProfileActions
                    subscriptionId={access.id}
                    nodeId={nodeID}
                    endpoint={`/users/${user.id}/devices/${device.id}/nodes/${nodeID}/profile`}
                    name={nodes.data?.find((node) => node.id === nodeID)?.name ?? t('Сервер')}
                  />
                </div>
              ))}
          </article>
        ))
      )}
    </section>
  )
}
