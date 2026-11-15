import { t } from '../lib/i18n'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Settings2, Link2, Trash2 } from 'lucide-react'
import { api, bytes, date, localDate, useResource } from '../lib/api'
import type { Subscription, User, Node } from '../lib/types'
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

type Mode = 'create' | 'edit' | 'nodes' | 'limit' | 'schedule'
export default function SubscriptionsPage() {
  const r = useResource<Subscription[]>('/subscriptions', 15000)
  const users = useResource<User[]>('/users')
  const nodes = useResource<Node[]>('/nodes')
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [user, setUser] = useState(params.get('user') || '')
  const [modal, setModal] = useState<{ mode: Mode; sub?: Subscription } | null>(null)
  const [link, setLink] = useState('')
  const f = useFeedback()
  const available = (nodes.data || []).filter((n) => !n.retired_at)
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
        setLink(result.url)
        await r.refresh()
      },
    )
  }
  return (
    <>
      <Heading
        title={t('Подписки')}
        description={t('Один доступ к нескольким серверам с лимитами и сроком действия.')}
        action={
          <Button variant="primary" onClick={() => setModal({ mode: 'create' })}>
            <Plus size={16} />
            {t('Создать подписку')}
          </Button>
        }
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
            description={t('Создайте пользователя, подключите ноду и выпустите подписку.')}
            action={
              <Button onClick={() => setModal({ mode: 'create' })}>{t('Создать подписку')}</Button>
            }
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
                  <th>{t('Действует до')}</th>
                  <th>{t('Действия')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const expired = new Date(s.expires_at).getTime() <= Date.now()
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
                            .map((id) => available.find((n) => n.id === id)?.name || id)
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
                      <td>{date(s.expires_at)}</td>
                      <td>
                        <div className="row-actions">
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
              create: t('Новая подписка'),
              edit: t('Настройки подписки'),
              nodes: t('Серверы подписки'),
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
              if (modal.mode === 'create') {
                if (!form.getAll('node_ids').length)
                  throw new Error(t('Выберите хотя бы одну ноду.'))
                const result = await api<{ url: string }>('/subscriptions', 'POST', {
                  user_id: String(form.get('user_id')),
                  name: String(form.get('name')).trim(),
                  expires_at: new Date(String(form.get('expires_at'))).toISOString(),
                  node_ids: form.getAll('node_ids'),
                })
                setLink(result.url)
              }
              if (modal.mode === 'edit')
                await mutation(s!, '', 'PATCH', {
                  enabled: form.get('enabled') === 'on',
                  expires_at: new Date(String(form.get('expires_at'))).toISOString(),
                })
              if (modal.mode === 'nodes') {
                if (!form.getAll('node_ids').length)
                  throw new Error(t('Выберите хотя бы одну ноду.'))
                await mutation(s!, '/nodes', 'PUT', { node_ids: form.getAll('node_ids') })
              }
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
            {modal.mode === 'create' && (
              <>
                <Field label={t('Название')}>
                  <input
                    name="name"
                    required
                    maxLength={128}
                    placeholder={t('Например, Личная подписка')}
                  />
                </Field>
                <Field label={t('Пользователь')}>
                  <select name="user_id" required defaultValue={user}>
                    <option value="" disabled>
                      {t('Выберите пользователя')}
                    </option>
                    {users.data?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            {(modal.mode === 'create' || modal.mode === 'edit') && (
              <Field
                label={t('Действует до')}
                hint={t('Время указано в часовом поясе вашего браузера.')}
              >
                <input
                  name="expires_at"
                  type="datetime-local"
                  required
                  defaultValue={localDate(
                    modal.sub?.expires_at || new Date(Date.now() + 30 * 86400000).toISOString(),
                  )}
                />
              </Field>
            )}
            {(modal.mode === 'nodes' || modal.mode === 'create') && (
              <div className="field">
                <span>{t('Серверы')}</span>
                <div className="checkbox-list">
                  {available.map((n) => (
                    <label key={n.id}>
                      <input
                        name="node_ids"
                        type="checkbox"
                        value={n.id}
                        defaultChecked={modal.sub?.node_ids.includes(n.id)}
                      />
                      <span>
                        {n.name}
                        <small>
                          {n.ip} ·{' '}
                          {n.enabled
                            ? n.status === 'ready'
                              ? t('Готова')
                              : t('Не готова')
                            : t('На паузе')}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
                {!available.length && (
                  <p className="muted">{t('Сначала добавьте ноду в разделе «Ноды».')}</p>
                )}
              </div>
            )}
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
                    ['nodes', t('Выбрать серверы')],
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
      {link && (
        <Modal title={t('Ссылка подписки готова')} onClose={() => setLink('')}>
          <div className="modal-content">
            <p className="muted">
              {t(
                'Скопируйте и передайте пользователю. Эта ссылка даёт доступ к конфигурациям VPN и показывается только сейчас.',
              )}
            </p>
            <CopyValue value={link} />
            <div className="notice">
              {t(
                'Откройте ссылку в браузере, выберите сервер и скачайте профиль AmneziaVPN (.vpn) или AmneziaWG (.conf). В приложение импортируйте скачанный файл.',
              )}
            </div>
            <Button variant="primary" onClick={() => setLink('')}>
              {t('Готово')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
