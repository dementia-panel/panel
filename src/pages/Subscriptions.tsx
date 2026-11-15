import { t } from '../lib/i18n'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Settings2, Link2, Trash2, KeyRound } from 'lucide-react'
import { api, bytes, date, errorMessage, useResource } from '../lib/api'
import type { Subscription, User, Node, SubscriptionPlan } from '../lib/types'
import {
  ActionForm,
  Badge,
  Button,
  CopyValue,
  Empty,
  ErrorNotice,
  Field,
  Heading,
  Loading,
  Modal,
  SearchBox,
  useFeedback,
} from '../components/ui'

type Mode = 'edit' | 'limit' | 'schedule'
type ProfileExport = { conf: string; key: string }
type ProfileDialog = { subscriptionId: string; nodeIds: string[]; url?: string }

export function ProfileActions({
  subscriptionId,
  nodeId,
  name,
}: {
  subscriptionId: string
  nodeId: string
  name: string
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [manualKey, setManualKey] = useState('')
  const [qr, setQR] = useState<{ vpn: string; awg: string } | null>(null)
  const feedback = useFeedback()

  async function exportProfile(action: 'conf' | 'vpn' | 'copy' | 'qr') {
    setBusy(true)
    setError('')
    setManualKey('')
    try {
      const profile = api<ProfileExport>(`/subscriptions/${subscriptionId}/nodes/${nodeId}/profile`)
      if (action === 'copy') {
        try {
          if (typeof ClipboardItem === 'function' && navigator.clipboard?.write) {
            const content = profile.then(({ key }) => new Blob([key], { type: 'text/plain' }))
            void content.catch(() => {})
            await navigator.clipboard.write([new ClipboardItem({ 'text/plain': content })])
          } else {
            await navigator.clipboard.writeText((await profile).key)
          }
          feedback.notify(t('Ключ скопирован.'))
        } catch {
          setManualKey((await profile).key)
        }
      } else if (action === 'qr') {
        const [{ conf, key }, { toDataURL }] = await Promise.all([profile, import('qrcode')])
        const options = { width: 440, margin: 4, errorCorrectionLevel: 'M' as const }
        const [vpn, awg] = await Promise.all([toDataURL(key, options), toDataURL(conf, options)])
        setQR({ vpn, awg })
      } else {
        const { conf, key } = await profile
        const url = URL.createObjectURL(new Blob([action === 'conf' ? conf : key]))
        const link = document.createElement('a')
        link.href = url
        link.download = `dementia-${nodeId}.${action}`
        document.body.append(link)
        link.click()
        link.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-2" role="group" aria-label={name}>
      <strong>{name}</strong>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={() => void exportProfile('conf')}>
          {t('Скачать .conf')}
        </Button>
        <Button type="button" disabled={busy} onClick={() => void exportProfile('vpn')}>
          {t('Скачать .vpn')}
        </Button>
        <Button type="button" disabled={busy} onClick={() => void exportProfile('copy')}>
          {t('Скопировать vpn://')}
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={() => (qr ? setQR(null) : void exportProfile('qr'))}
        >
          {qr ? t('Скрыть QR-коды') : t('Показать QR-коды')}
        </Button>
      </div>
      {qr && (
        <div className="grid gap-3 sm:grid-cols-2">
          <figure>
            <figcaption>AmneziaVPN</figcaption>
            <img src={qr.vpn} alt={t('QR-код AmneziaVPN')} />
          </figure>
          <figure>
            <figcaption>AmneziaWG</figcaption>
            <img src={qr.awg} alt={t('QR-код AmneziaWG')} />
          </figure>
        </div>
      )}
      {manualKey && <CopyValue value={manualKey} inputLabel={t('Ключ vpn://')} />}
      {error && <ErrorNotice message={error} />}
    </div>
  )
}

export default function SubscriptionsPage() {
  const [params] = useSearchParams()
  return params.has('user') ? (
    <IssuedAccessPage key={params.get('user')} />
  ) : (
    <SubscriptionPlansPage />
  )
}

function IssuedAccessPage() {
  const r = useResource<Subscription[]>('/subscriptions', 15000)
  const users = useResource<User[]>('/users')
  const nodes = useResource<Node[]>('/nodes')
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [user, setUser] = useState(params.get('user') || '')
  const [modal, setModal] = useState<{ mode: Mode; sub?: Subscription } | null>(null)
  const [profiles, setProfiles] = useState<ProfileDialog | null>(null)
  const f = useFeedback()
  const list = (r.data || []).filter(
    (s) =>
      (!user || s.user_id === user) &&
      (s.name + (users.data?.find((u) => u.id === s.user_id)?.username || ''))
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  async function mutation(s: Subscription, path: string, method: string, body?: unknown) {
    await api('/subscriptions/' + s.id + path, method, body)
    await r.refresh()
  }
  function rotate(s: Subscription, revoke: boolean) {
    f.confirm(
      revoke ? t('Отозвать текущий доступ?') : t('Создать новую ссылку?'),
      revoke
        ? t(
            'Ссылка и VPN-ключи будут заменены. Старые подключения прекратятся после синхронизации нод.',
          )
        : t('Старая ссылка перестанет работать. Уже импортированные VPN-ключи сохранят доступ.'),
      async () => {
        const result = await api<{ url: string }>(
          '/subscriptions/' + s.id + (revoke ? '/revoke' : '/rotate-link'),
          'POST',
        )
        setProfiles({ subscriptionId: s.id, nodeIds: s.node_ids || [], url: result.url })
        await r.refresh()
      },
    )
  }
  return (
    <>
      <Heading
        title={t('Доступ пользователя')}
        description={t(
          'Выпущенные профили и учёт трафика. Подписка назначается в настройках пользователя.',
        )}
      />
      <section className="surface">
        <div className="toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder={t('Подписка или пользователь')}
          />
          <select
            aria-label={t('Фильтр по пользователю')}
            value={user}
            onChange={(e) => setUser(e.target.value)}
          >
            <option value="">{t('Все пользователи')}</option>
            {users.data?.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </select>
        </div>
        {[r.error, users.error, nodes.error].filter(Boolean).map((e, i) => (
          <ErrorNotice key={i} message={e!} />
        ))}
        {r.loading ? (
          <Loading />
        ) : !list.length ? (
          <Empty
            title={t('Подписок пока нет')}
            description={t('Выберите подписку в настройках пользователя.')}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Подписка')}</th>
                  <th>{t('Статус')}</th>
                  <th>{t('Ноды')}</th>
                  <th>{t('Трафик')}</th>
                  <th>{t('Действия')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const expired = Boolean(
                    s.expires_at && new Date(s.expires_at).getTime() <= Date.now(),
                  )
                  const limited =
                    s.traffic_limit_bytes !== null && s.traffic_used_bytes >= s.traffic_limit_bytes
                  return (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                        <small>
                          {users.data?.find((u) => u.id === s.user_id)?.username || s.user_id}
                        </small>
                      </td>
                      <td>
                        <Badge
                          tone={!s.enabled ? 'neutral' : expired || limited ? 'warning' : 'success'}
                        >
                          {!s.enabled
                            ? t('Отключена')
                            : expired
                              ? t('Истекла')
                              : limited
                                ? t('Лимит исчерпан')
                                : t('Активна')}
                        </Badge>
                      </td>
                      <td>
                        <span
                          title={s.node_ids
                            .map((id) => nodes.data?.find((n) => n.id === id)?.name || id)
                            .join(', ')}
                        >
                          {s.node_ids.length}
                          {t(' серверов')}
                        </span>
                      </td>
                      <td>
                        <strong className="font-normal">{bytes(s.traffic_used_bytes)}</strong>
                        <small>
                          {s.traffic_limit_bytes
                            ? t('из ') + bytes(s.traffic_limit_bytes)
                            : t('Без лимита')}
                        </small>
                        {s.traffic_limit_bytes && (
                          <div className="progress">
                            <span
                              style={{
                                width:
                                  Math.min(
                                    100,
                                    (s.traffic_used_bytes / s.traffic_limit_bytes) * 100,
                                  ) + '%',
                              }}
                            />
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <Button
                            variant="ghost"
                            title={t('Профили подключения')}
                            aria-label={t('Профили подключения') + ': ' + s.name}
                            onClick={() =>
                              setProfiles({ subscriptionId: s.id, nodeIds: s.node_ids || [] })
                            }
                          >
                            <KeyRound size={16} />
                            {t('Профили')}
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={t('Новая ссылка ') + s.name}
                            onClick={() => rotate(s, false)}
                          >
                            <Link2 size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={t('Настройки ') + s.name}
                            onClick={() => setModal({ mode: 'edit', sub: s })}
                          >
                            <Settings2 size={16} />
                          </Button>
                          <Button
                            variant="ghost"
                            aria-label={t('Удалить ') + s.name}
                            onClick={() =>
                              f.confirm(
                                t('Удалить подписку?'),
                                t(
                                  'Ссылка перестанет работать. VPN-доступ будет отозван после синхронизации.',
                                ),
                                async () => {
                                  await mutation(s, '', 'DELETE')
                                  f.notify(t('Подписка удалена'))
                                },
                              )
                            }
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          {list.length}
          {t(' подписок · Статус VPN обновляется после синхронизации нод')}
        </div>
      </section>
      {modal && (
        <Modal
          title={
            {
              edit: t('Настройки подписки'),
              limit: t('Лимит трафика'),
              schedule: t('Автоматический сброс'),
            }[modal.mode]
          }
          onClose={() => setModal(null)}
        >
          <ActionForm
            key={modal.mode}
            onCancel={() => setModal(null)}
            onSubmit={async (form) => {
              const s = modal.sub
              if (modal.mode === 'edit')
                await mutation(s!, '', 'PATCH', {
                  enabled: form.get('enabled') === 'on',
                })
              if (modal.mode === 'limit') {
                const value = String(form.get('limit'))
                const amount = value ? Math.round(Number(value) * 1073741824) : null
                if (amount !== null && (!Number.isSafeInteger(amount) || amount <= 0))
                  throw new Error(t('Укажите положительный лимит.'))
                await mutation(s!, '/traffic-limit', 'PUT', { traffic_limit_bytes: amount })
              }
              if (modal.mode === 'schedule')
                await mutation(s!, '/traffic-reset-schedule', 'PUT', {
                  traffic_reset_days: form.get('days') ? Number(form.get('days')) : null,
                })
              setModal(null)
              await r.refresh()
              f.notify(t('Подписка сохранена'))
            }}
          >
            {modal.mode === 'limit' && (
              <Field
                label={t('Лимит, GiB')}
                hint={t('Пустое поле — без ограничения. Учитывается входящий и исходящий трафик.')}
              >
                <input
                  name="limit"
                  type="number"
                  min="0.001"
                  step="any"
                  defaultValue={
                    modal.sub?.traffic_limit_bytes ? modal.sub.traffic_limit_bytes / 1073741824 : ''
                  }
                />
              </Field>
            )}
            {modal.mode === 'schedule' && (
              <>
                <Field
                  label={t('Сбрасывать каждые N дней')}
                  hint={t('От 1 до 366. Оставьте пустым, чтобы отключить автоматический сброс.')}
                >
                  <input
                    name="days"
                    type="number"
                    min={1}
                    max={366}
                    defaultValue={modal.sub?.traffic_reset_days || ''}
                  />
                </Field>
                <p className="muted">
                  {t('Следующий сброс: ')}
                  {date(modal.sub?.traffic_reset_at || null)}
                </p>
              </>
            )}
            {modal.mode === 'edit' && (
              <>
                <label className="check-field">
                  <input type="checkbox" name="enabled" defaultChecked={modal.sub!.enabled} />
                  {t('Подписка включена')}
                </label>
                <div className="settings-links">
                  {[
                    ['limit', t('Изменить лимит трафика')],
                    ['schedule', t('Автоматический сброс')],
                  ].map(([mode, label]) => (
                    <Button
                      key={mode}
                      type="button"
                      onClick={() => setModal({ mode: mode as Mode, sub: modal.sub })}
                    >
                      {label}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    onClick={() => {
                      const s = modal.sub!
                      setModal(null)
                      f.confirm(
                        t('Сбросить использованный трафик?'),
                        t('Счётчик подписки будет обнулён.'),
                        async () => {
                          await mutation(s, '/reset-traffic', 'POST')
                          f.notify(t('Трафик сброшен'))
                        },
                      )
                    }}
                  >
                    {t('Сбросить трафик сейчас')}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => {
                      const s = modal.sub!
                      setModal(null)
                      rotate(s, true)
                    }}
                  >
                    {t('Отозвать ключи и выпустить заново')}
                  </Button>
                </div>
              </>
            )}
          </ActionForm>
        </Modal>
      )}
      {profiles && (
        <Modal
          title={profiles.url ? t('Ссылка подписки готова') : t('Профили подключения')}
          onClose={() => setProfiles(null)}
        >
          <div className="modal-content">
            {profiles.url && (
              <>
                <p className="muted">
                  {t(
                    'Скопируйте и передайте пользователю. Эта ссылка даёт доступ к конфигурациям VPN и показывается только сейчас.',
                  )}
                </p>
                <CopyValue value={profiles.url} />
              </>
            )}
            <p className="muted">{t('Профиль начнёт работать после синхронизации ноды.')}</p>
            {!profiles.nodeIds.length && <p>{t('В подписке пока нет серверов.')}</p>}
            {profiles.nodeIds.map((nodeId) => (
              <ProfileActions
                key={nodeId}
                subscriptionId={profiles.subscriptionId}
                nodeId={nodeId}
                name={nodes.data?.find((node) => node.id === nodeId)?.name || nodeId}
              />
            ))}
            <Button variant="primary" onClick={() => setProfiles(null)}>
              {t('Готово')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}

function SubscriptionPlansPage() {
  const plans = useResource<SubscriptionPlan[]>('/subscription-plans')
  const nodes = useResource<Node[]>('/nodes')
  const [editing, setEditing] = useState<SubscriptionPlan | 'new' | null>(null)
  const feedback = useFeedback()
  const activeNodes = (nodes.data || []).filter((node) => !node.retired_at)
  const previous = editing === 'new' ? undefined : editing

  return (
    <>
      <Heading
        title={t('Подписки')}
        description={t('Создайте список серверов и назначьте его пользователям.')}
        action={
          <Button variant="primary" onClick={() => setEditing('new')}>
            <Plus size={16} />
            {t('Создать подписку')}
          </Button>
        }
      />
      {plans.error && <ErrorNotice message={plans.error} retry={() => void plans.refresh()} />}
      {plans.loading ? (
        <Loading />
      ) : (
        <section className="surface">
          {plans.data?.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t('Подписка')}</th>
                    <th>{t('Серверы')}</th>
                    <th>{t('Действия')}</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.data.map((plan) => (
                    <tr key={plan.id}>
                      <td>
                        <strong>{plan.name}</strong>
                      </td>
                      <td>
                        {plan.node_ids
                          .map((id) => activeNodes.find((node) => node.id === id)?.name || id)
                          .join(', ') || '—'}
                      </td>
                      <td>
                        <div className="row-actions">
                          <Button onClick={() => setEditing(plan)}>{t('Настройки')}</Button>
                          <Button
                            aria-label={t('Удалить ') + plan.name}
                            onClick={() =>
                              feedback.confirm(
                                t('Удалить подписку?'),
                                t('Сначала снимите подписку со всех пользователей.'),
                                async () => {
                                  await api('/subscription-plans/' + plan.id, 'DELETE')
                                  await plans.refresh()
                                },
                              )
                            }
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title={t('Подписок пока нет')}
              description={t('Создайте список серверов и назначьте его пользователям.')}
            />
          )}
        </section>
      )}
      {editing && (
        <Modal
          title={previous ? t('Настройки подписки') : t('Новая подписка')}
          onClose={() => setEditing(null)}
        >
          <ActionForm
            onCancel={() => setEditing(null)}
            onSubmit={async (form) => {
              const nodeIds = form.getAll('node_ids').map(String)
              if (!nodeIds.length) throw new Error(t('Выберите хотя бы одну ноду.'))
              await api(
                '/subscription-plans' + (previous ? '/' + previous.id : ''),
                previous ? 'PUT' : 'POST',
                {
                  name: String(form.get('name')).trim(),
                  node_ids: nodeIds,
                },
              )
              setEditing(null)
              await plans.refresh()
            }}
          >
            <Field label={t('Название')}>
              <input name="name" required maxLength={128} defaultValue={previous?.name} />
            </Field>
            <div className="field">
              <span>{t('Серверы')}</span>
              <div className="checkbox-list">
                {activeNodes.map((node) => (
                  <label key={node.id}>
                    <input
                      type="checkbox"
                      name="node_ids"
                      value={node.id}
                      defaultChecked={previous?.node_ids.includes(node.id)}
                    />
                    <span>{node.name}</span>
                  </label>
                ))}
                {!activeNodes.length && (
                  <p className="muted">{t('Сначала добавьте ноду в разделе «Ноды».')}</p>
                )}
              </div>
            </div>
          </ActionForm>
        </Modal>
      )}
    </>
  )
}
