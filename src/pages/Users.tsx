import { UserDetails } from '../components/UserDetails'
import { FormSelect } from '../components/Select'
import { t } from '../lib/i18n'
import { useState } from 'react'
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { api, date, useResource } from '../lib/api'
import { ProfileActions } from './Subscriptions'
import type { User, SubscriptionPlan, Node } from '../lib/types'
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

export default function UsersPage() {
  const resource = useResource<User[]>('/users', 15000)
  const plans = useResource<SubscriptionPlan[]>('/subscription-plans')
  const nodes = useResource<Node[]>('/nodes')
  const [issued, setIssued] = useState<{ id: string; planId: string; url?: string } | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [edit, setEdit] = useState<User | 'new' | null>(null)
  const [detailsId, setDetailsId] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const feedback = useFeedback()
  const data = resource.data || []
  const visible = data.filter(
    (u) =>
      (u.username.toLowerCase().includes(search.toLowerCase()) ||
        String(u.telegram_id || '').includes(search)) &&
      (filter === 'all' || (filter === 'online' ? u.online : !u.enabled)),
  )
  function remove(u: User) {
    feedback.confirm(
      t('Удалить ') + u.username + '?',
      t(
        'Все подписки пользователя будут удалены. Доступ по VPN-ключам будет отозван после синхронизации нод.',
      ),
      async () => {
        await api('/users/' + u.id, 'DELETE')
        setSelected((ids) => ids.filter((id) => id !== u.id))
        await resource.refresh()
        feedback.notify(t('Пользователь удалён'))
      },
    )
  }
  function bulk(enabled: boolean) {
    feedback.confirm(
      enabled ? t('Включить пользователей?') : t('Отключить пользователей?'),
      t('Изменение затронет ') + selected.length + t(' пользователей и все их подписки.'),
      async () => {
        await api('/users/bulk/enabled', 'POST', { ids: selected, enabled })
        setSelected([])
        await resource.refresh()
        feedback.notify(t('Статус пользователей обновлён'))
      },
    )
  }
  return (
    <>
      <Heading
        title={t('Пользователи')}
        description={t('Управляйте доступом и следите за активностью VPN.')}
        action={
          <>
            <Button aria-label={t('Обновить')} onClick={() => void resource.refresh()}>
              <RefreshCw size={16} />
            </Button>
            <Button variant="primary" onClick={() => setEdit('new')}>
              <Plus size={16} />
              {t('Добавить пользователя')}
            </Button>
          </>
        }
      />
      <section className="surface">
        <div className="toolbar">
          <SearchBox value={search} onChange={setSearch} placeholder={t('Имя или Telegram ID')} />
          <div className="tabs">
            {[
              ['all', t('Все')],
              ['online', t('В сети')],
              ['disabled', t('Отключены')],
            ].map(([id, title]) => (
              <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id}>
                {title}
              </button>
            ))}
          </div>
        </div>
        {selected.length > 0 && (
          <div className="selection-bar">
            <span>
              {t('Выбрано ')}
              {selected.length}
            </span>
            <Button onClick={() => bulk(true)}>{t('Включить')}</Button>
            <Button onClick={() => bulk(false)}>{t('Отключить')}</Button>
            <Button variant="ghost" onClick={() => setSelected([])}>
              {t('Снять выбор')}
            </Button>
          </div>
        )}
        {resource.error && (
          <ErrorNotice message={resource.error} retry={() => void resource.refresh()} />
        )}
        {resource.loading ? (
          <Loading />
        ) : !visible.length ? (
          <Empty
            title={data.length ? t('Пользователи не найдены') : t('Добавьте первого пользователя')}
            description={
              data.length
                ? t('Попробуйте изменить запрос или фильтр.')
                : t('После создания можно выпустить подписку на один или несколько серверов.')
            }
            action={
              !data.length && (
                <Button onClick={() => setEdit('new')}>{t('Добавить пользователя')}</Button>
              )
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      aria-label={t('Выбрать видимых пользователей')}
                      checked={visible.length > 0 && visible.every((u) => selected.includes(u.id))}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...new Set([...selected, ...visible.map((u) => u.id)])].slice(0, 500)
                            : selected.filter((id) => !visible.some((u) => u.id === id)),
                        )
                      }
                    />
                  </th>
                  <th>{t('Пользователь')}</th>
                  <th>{t('Доступ')}</th>
                  <th>Telegram ID</th>
                  <th>{t('Последнее подключение')}</th>
                  <th className="text-right">{t('Действия')}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr
                    key={u.id}
                    className="user-clickable-row"
                    onClick={(event) => {
                      if (!(event.target as HTMLElement).closest('button, a, input'))
                        setDetailsId(u.id)
                    }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        aria-label={t('Выбрать ') + u.username}
                        checked={selected.includes(u.id)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked
                              ? [...selected, u.id].slice(0, 500)
                              : selected.filter((id) => id !== u.id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="user-cell user-open-button"
                        onClick={() => setDetailsId(u.id)}
                        aria-label={t('Открыть пользователя ') + u.username}
                      >
                        <span className="user-avatar">{u.username.slice(0, 2).toUpperCase()}</span>
                        <div>
                          <strong>{u.username}</strong>
                          <small className={u.online ? 'presence-online' : undefined}>
                            {u.online ? t('Сейчас в VPN') : t('Не в сети')}
                          </small>
                        </div>
                      </button>
                    </td>
                    <td>
                      <Badge tone={u.enabled ? 'success' : 'neutral'}>
                        {u.enabled ? t('Активен') : t('Отключён')}
                      </Badge>
                    </td>
                    <td className="mono">{u.telegram_id || '—'}</td>
                    <td className="muted">{date(u.last_connected_at)}</td>
                    <td>
                      <div className="row-actions">
                        <Button
                          variant="ghost"
                          aria-label={t('Изменить ') + u.username}
                          onClick={() => setDetailsId(u.id)}
                        >
                          <Pencil size={15} />
                        </Button>
                        <Button
                          variant="ghost"
                          aria-label={t('Удалить ') + u.username}
                          onClick={() => remove(u)}
                        >
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>
            {visible.length}
            {t(' из ')}
            {data.length}
            {t(' пользователей')}
          </span>
          <span>{t('Онлайн определяется по рукопожатию за 3 минуты')}</span>
        </div>
      </section>
      {edit && (
        <Modal
          title={edit === 'new' ? t('Новый пользователь') : t('Настройки пользователя')}
          onClose={() => setEdit(null)}
        >
          <ActionForm
            onCancel={() => setEdit(null)}
            submitLabel={edit === 'new' ? t('Создать пользователя') : t('Сохранить изменения')}
            onSubmit={async (form) => {
              const raw = String(form.get('telegram_id') || '')
              const telegram = raw ? Number(raw) : null
              if (telegram !== null && (!Number.isSafeInteger(telegram) || telegram <= 0))
                throw new Error(t('Telegram ID должен быть положительным целым числом.'))
              const selectedPlan = String(form.get('plan_id') || '') || null
              const saved = await api<
                { subscription_url?: string; access_id?: string } | undefined
              >(
                '/users' + (edit === 'new' ? '' : '/' + edit.id),
                edit === 'new' ? 'POST' : 'PATCH',
                {
                  username: String(form.get('username')).trim(),
                  telegram_id: telegram,
                  ...(edit !== 'new'
                    ? { enabled: form.get('enabled') === 'on' }
                    : selectedPlan
                      ? { plan_id: selectedPlan }
                      : {}),
                },
              )
              if (saved?.access_id && selectedPlan)
                setIssued({
                  id: saved.access_id,
                  planId: selectedPlan,
                  url: saved.subscription_url,
                })
              if (edit !== 'new' && form.has('plan_id')) {
                if (selectedPlan !== (edit.subscription_plan_id || null)) {
                  const assigned = await api<{ id?: string; url?: string }>(
                    '/users/' + edit.id + '/subscription',
                    'PUT',
                    {
                      plan_id: selectedPlan,
                    },
                  )
                  if (assigned.id && selectedPlan)
                    setIssued({ id: assigned.id, planId: selectedPlan, url: assigned.url })
                }
              }
              setEdit(null)
              await resource.refresh()
              feedback.notify(
                edit === 'new' ? t('Пользователь создан') : t('Пользователь обновлён'),
              )
            }}
          >
            <Field label={t('Имя пользователя')}>
              <input
                name="username"
                required
                maxLength={128}
                defaultValue={edit === 'new' ? '' : edit.username}
                placeholder={t('Например, boris')}
              />
            </Field>
            <Field
              label="Telegram ID"
              hint={t('Необязательно. Числовой ID пользователя Telegram.')}
            >
              <input
                name="telegram_id"
                inputMode="numeric"
                pattern="[0-9]*"
                defaultValue={edit === 'new' ? '' : edit.telegram_id || ''}
                placeholder="123456789"
              />
            </Field>
            <Field label={t('Подписка')}>
              <FormSelect
                name="plan_id"
                label={t('Подписка')}
                defaultValue={edit === 'new' ? '' : edit.subscription_plan_id || ''}
                disabled={!plans.data}
                options={[
                  { value: '', label: t('Без подписки') },
                  ...(plans.data || []).map((plan) => ({
                    value: plan.id,
                    label: plan.name,
                  })),
                ]}
              />
            </Field>
            {plans.error && (
              <ErrorNotice message={plans.error} retry={() => void plans.refresh()} />
            )}
            {edit !== 'new' && (
              <>
                <label className="check-field">
                  <input name="enabled" type="checkbox" defaultChecked={edit.enabled} />
                  {t('Доступ включён')}
                </label>
                <dl className="details">
                  <dt>{t('Создан')}</dt>
                  <dd>{date(edit.created_at)}</dd>
                  <dt>{t('Обновлён')}</dt>
                  <dd>{date(edit.updated_at)}</dd>
                </dl>
              </>
            )}
          </ActionForm>
        </Modal>
      )}
      {detailsId && (
        <UserDetails
          userId={detailsId}
          onClose={() => setDetailsId(null)}
          onSaved={resource.refresh}
          onIssued={setIssued}
        />
      )}
      {issued && (
        <Modal
          title={issued.url ? t('Ссылка подписки готова') : t('Профили подключения')}
          onClose={() => setIssued(null)}
        >
          <div className="modal-content grid gap-3">
            {issued.url && <CopyValue value={issued.url} />}
            <p className="muted">{t('Профиль начнёт работать после синхронизации ноды.')}</p>
            {plans.data
              ?.find((plan) => plan.id === issued.planId)
              ?.node_ids.map((id) => (
                <ProfileActions
                  key={id}
                  subscriptionId={issued.id}
                  nodeId={id}
                  name={nodes.data?.find((node) => node.id === id)?.name || id}
                />
              ))}
            <Button onClick={() => setIssued(null)}>{t('Готово')}</Button>
          </div>
        </Modal>
      )}
    </>
  )
}
