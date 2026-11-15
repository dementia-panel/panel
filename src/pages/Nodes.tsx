import { t } from '../lib/i18n'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Server, RefreshCw, Pause, Play, Pencil, Radio, RotateCw, Trash2 } from 'lucide-react'
import { api, date, useResource } from '../lib/api'
import type { Node } from '../lib/types'
import {
  ActionForm,
  Badge,
  Button,
  Empty,
  ErrorNotice,
  Field,
  Heading,
  Loading,
  Modal,
  SearchBox,
  useFeedback,
} from '../components/ui'

export default function NodesPage() {
  const [params] = useSearchParams()
  const r = useResource<Node[]>('/nodes', 2500)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{
    mode: 'create' | 'edit' | 'endpoint' | 'remove'
    node?: Node
  } | null>(params.has('create') ? { mode: 'create' } : null)
  const [checking, setChecking] = useState<string | null>(null)
  const f = useFeedback()
  const nodes = (r.data || []).filter(
    (n) => !n.retired_at && (n.name + n.ip).toLowerCase().includes(search.toLowerCase()),
  )
  async function action(n: Node, suffix: string, body?: unknown, method = 'POST') {
    await api('/nodes/' + n.id + suffix, method, body)
    await r.refresh()
  }
  return (
    <>
      <Heading
        title={t('Ноды')}
        description={t('Серверы AmneziaWG и состояние синхронизации конфигураций.')}
        action={
          <>
            <Button
              onClick={() =>
                f.confirm(
                  t('Перезапустить все ноды?'),
                  t(
                    'Команда будет выполнена агентами при следующей синхронизации. VPN-соединения могут прерваться.',
                  ),
                  async () => {
                    await api('/nodes/actions/restart-all', 'POST')
                    await r.refresh()
                    f.notify(t('Перезапуск поставлен в очередь'))
                  },
                )
              }
            >
              <RotateCw size={16} />
              {t('Перезапустить все')}
            </Button>
            <Button variant="primary" onClick={() => setModal({ mode: 'create' })}>
              <Plus size={16} />
              {t('Добавить ноду')}
            </Button>
          </>
        }
      />
      <div className="toolbar standalone">
        <SearchBox value={search} onChange={setSearch} placeholder={t('Название или IP-адрес')} />
        <Button onClick={() => void r.refresh()}>
          <RefreshCw size={15} />
          {t('Обновить')}
        </Button>
      </div>
      {r.error && <ErrorNotice message={r.error} retry={() => void r.refresh()} />}
      {r.loading ? (
        <Loading />
      ) : !nodes.length ? (
        <section className="surface">
          <Empty
            title={t('Нет подходящих нод')}
            description={t(
              'Подключите сервер по SSH. Backend скачает установщик и развернёт ноду автоматически.',
            )}
            action={
              <Button onClick={() => setModal({ mode: 'create' })}>{t('Подключить сервер')}</Button>
            }
          />
        </section>
      ) : (
        <div className="node-grid">
          {nodes.map((n) => (
            <section
              className={
                'surface node-card ' + (params.get('node') === n.id ? 'node-selected' : '')
              }
              key={n.id}
            >
              <div className="node-card-head">
                <span className="node-icon">
                  <Server size={22} />
                </span>
                <Badge
                  tone={
                    n.status === 'failed'
                      ? 'danger'
                      : n.status === 'installing'
                        ? 'warning'
                        : !n.enabled
                          ? 'neutral'
                          : n.online
                            ? 'success'
                            : 'danger'
                  }
                >
                  {n.status === 'installing'
                    ? t('Установка')
                    : n.status === 'failed'
                      ? t('Ошибка установки')
                      : !n.enabled
                        ? t('На паузе')
                        : n.online
                          ? t('В сети')
                          : t('Нет связи')}
                </Badge>
              </div>
              <h2>{n.name}</h2>
              <p className="mono muted">
                {n.ip}:{n.vpn_port}
              </p>
              <dl className="details">
                <dt>{t('Конфигурация')}</dt>
                <dd>
                  {n.applied_revision < n.revision
                    ? t('Ожидает синхронизации')
                    : t('Синхронизирована')}{' '}
                  <span className="mono muted">
                    {n.applied_revision}/{n.revision}
                  </span>
                </dd>
                <dt>{t('Последняя связь')}</dt>
                <dd>{date(n.last_seen_at)}</dd>
                <dt>{t('Публичный адрес')}</dt>
                <dd className="mono">
                  {n.endpoint_host || n.ip}:{n.endpoint_port || n.vpn_port}
                </dd>
                <dt>{t('Проверка связи')}</dt>
                <dd>
                  {n.connection_ok === null
                    ? t('Не проводилась')
                    : n.connection_ok
                      ? t('Успешно')
                      : t('Нет ответа')}
                </dd>
                {n.restart_revision > n.restarted_revision && (
                  <>
                    <dt>{t('Перезапуск')}</dt>
                    <dd>{t('В очереди')}</dd>
                  </>
                )}
              </dl>
              {(n.status === 'installing' || n.operation_stage === 'removing') && (
                <NodeOperation stage={n.operation_stage} />
              )}
              {n.error && <div className="notice notice-error break-all">{n.error}</div>}
              <div className="node-actions">
                {n.status === 'failed' && n.operation_stage !== 'removing' && (
                  <Button onClick={() => setModal({ mode: 'create', node: n })}>
                    {t('Повторить установку')}
                  </Button>
                )}
                <Button
                  busy={checking === n.id}
                  onClick={async () => {
                    setChecking(n.id)
                    try {
                      const result = await api<Node & { responded: boolean }>(
                        '/nodes/' + n.id + '/actions/check',
                        'POST',
                      )
                      f.notify(
                        result.responded
                          ? t('Нода ответила')
                          : t('Нода не ответила за время проверки'),
                        result.responded ? 'success' : 'error',
                      )
                      await r.refresh()
                    } catch (e) {
                      f.notify(e instanceof Error ? e.message : t('Ошибка проверки'), 'error')
                    } finally {
                      setChecking(null)
                    }
                  }}
                >
                  <Radio size={15} />
                  {t('Проверить')}
                </Button>
                <Button
                  disabled={n.operation_stage === 'removing'}
                  onClick={() => setModal({ mode: 'edit', node: n })}
                >
                  <Pencil size={15} />
                  {t('Настройки')}
                </Button>
                <Button
                  aria-label={
                    n.enabled ? t('Поставить на паузу ') + n.name : t('Включить ') + n.name
                  }
                  onClick={() =>
                    f.confirm(
                      n.enabled ? t('Приостановить ноду?') : t('Включить ноду?'),
                      t('Изменение вступит в силу после синхронизации конфигурации.'),
                      async () => {
                        await action(n, '', { enabled: !n.enabled }, 'PATCH')
                        f.notify(t('Состояние ноды обновлено'))
                      },
                    )
                  }
                >
                  {n.enabled ? <Pause size={15} /> : <Play size={15} />}
                </Button>
              </div>
              <div className="node-secondary">
                <button onClick={() => setModal({ mode: 'endpoint', node: n })}>
                  {t('Изменить адрес')}
                </button>
                <button
                  onClick={() =>
                    f.confirm(
                      t('Перезапустить ') + n.name + '?',
                      t(
                        'VPN-соединения могут прерваться. Команда выполнится после связи с агентом.',
                      ),
                      async () => {
                        await action(n, '/actions/restart')
                        f.notify(t('Перезапуск поставлен в очередь'))
                      },
                    )
                  }
                >
                  {t('Перезапустить')}
                </button>
                <button
                  className="danger-text"
                  disabled={n.status === 'installing' || n.operation_stage === 'removing'}
                  onClick={() => setModal({ mode: 'remove', node: n })}
                >
                  <Trash2 size={13} />
                  {t('Удалить')}
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
      {modal && (
        <Modal
          title={
            modal.mode === 'create'
              ? t('Подключение сервера')
              : modal.mode === 'remove'
                ? t('Удаление ноды с VPS')
                : modal.mode === 'endpoint'
                  ? t('Публичный адрес VPN')
                  : t('Настройки ноды')
          }
          onClose={() => setModal(null)}
        >
          <ActionForm
            onCancel={() => setModal(null)}
            submitLabel={
              modal.mode === 'create'
                ? t('Установить ноду')
                : modal.mode === 'remove'
                  ? t('Удалить ноду')
                  : t('Сохранить')
            }
            onSubmit={async (form) => {
              const value = (key: string) => String(form.get(key) || '').trim()
              if (modal.mode === 'create')
                await api('/nodes', 'POST', {
                  name: value('name'),
                  ip: value('ip'),
                  login: value('login'),
                  password: String(form.get('password')),
                  ssh_port: Number(value('ssh_port')),
                  vpn_port: Number(value('vpn_port')),
                })
              else if (modal.mode === 'remove')
                await action(
                  modal.node!,
                  '',
                  {
                    login: value('login'),
                    password: String(form.get('password')),
                  },
                  'DELETE',
                )
              else if (modal.mode === 'edit')
                await action(modal.node!, '', { name: value('name') }, 'PATCH')
              else {
                if (!!value('host') !== !!value('port'))
                  throw new Error(t('Заполните адрес и порт вместе или очистите оба поля.'))
                await action(
                  modal.node!,
                  '/endpoint',
                  {
                    host: value('host') || null,
                    port: value('port') ? Number(value('port')) : null,
                  },
                  'PUT',
                )
              }
              setModal(null)
              await r.refresh()
              f.notify(
                modal.mode === 'create'
                  ? t('Установка запущена. Состояние обновится автоматически.')
                  : modal.mode === 'remove'
                    ? t('Очистка VPS запущена.')
                    : t('Изменения сохранены'),
              )
            }}
          >
            {modal.mode === 'remove' ? (
              <>
                <p className="muted">
                  {t(
                    'Контейнеры ноды остановятся, установленные файлы и ключи будут удалены с VPS.',
                  )}
                </p>
                <Field label={t('SSH-пользователь')}>
                  <input name="login" defaultValue="root" required />
                </Field>
                <Field label={t('SSH-пароль')}>
                  <input name="password" type="password" autoComplete="off" required />
                </Field>
              </>
            ) : modal.mode !== 'endpoint' ? (
              <Field label={t('Название сервера')}>
                <input
                  name="name"
                  required
                  maxLength={128}
                  defaultValue={modal.node?.name}
                  placeholder={t('Например, Frankfurt 01')}
                />
              </Field>
            ) : (
              <>
                <p className="muted">
                  {t(
                    'Адрес, который получат VPN-клиенты. Очистите оба поля, чтобы использовать IP и порт ноды.',
                  )}
                </p>
                <Field label={t('Домен или IP')}>
                  <input
                    name="host"
                    defaultValue={modal.node?.endpoint_host || ''}
                    placeholder="vpn.example.com"
                  />
                </Field>
                <Field label={t('Порт')}>
                  <input
                    name="port"
                    type="number"
                    min={1}
                    max={65535}
                    defaultValue={modal.node?.endpoint_port || ''}
                  />
                </Field>
              </>
            )}
            {modal.mode === 'create' && (
              <>
                <Field label={t('IP-адрес')}>
                  <input
                    name="ip"
                    required
                    defaultValue={modal.node?.ip}
                    placeholder="203.0.113.10"
                  />
                </Field>
                <div className="form-grid">
                  <Field label={t('SSH-порт')}>
                    <input
                      name="ssh_port"
                      type="number"
                      min={1}
                      max={65535}
                      required
                      defaultValue={modal.node?.ssh_port || 22}
                    />
                  </Field>
                  <Field label={t('VPN-порт')}>
                    <input
                      name="vpn_port"
                      type="number"
                      min={1}
                      max={65535}
                      required
                      defaultValue={modal.node?.vpn_port || 51820}
                    />
                  </Field>
                </div>
                <Field
                  label={t('SSH-пользователь')}
                  hint={t('Root или пользователь с правами sudo.')}
                >
                  <input name="login" required autoComplete="off" defaultValue="root" />
                </Field>
                <Field label={t('SSH-пароль')}>
                  <input name="password" type="password" required autoComplete="new-password" />
                </Field>
                <div className="notice">
                  {t(
                    'Установщик определит ОС, установит Docker и развернёт AmneziaWG. Процесс может занять до 15 минут.',
                  )}
                </div>
              </>
            )}
          </ActionForm>
        </Modal>
      )}
    </>
  )
}

function NodeOperation({ stage }: { stage?: string }) {
  const steps = [
    { id: 'queued', name: t('Ожидание установки'), progress: 5 },
    { id: 'ssh', name: t('Подключение по SSH'), progress: 12 },
    { id: 'download', name: t('Загрузка установщика'), progress: 25 },
    { id: 'requirements', name: t('Проверка системы'), progress: 35 },
    { id: 'docker', name: t('Подготовка Docker'), progress: 45 },
    { id: 'build', name: t('Сборка AmneziaWG'), progress: 60 },
    { id: 'start', name: t('Запуск контейнера'), progress: 80 },
    { id: 'verify', name: t('Проверка VPN-интерфейса'), progress: 95 },
  ]
  const current = steps.find((step) => step.id === stage) || steps[0]
  const label = stage === 'removing' ? t('Очистка VPS запущена.') : current.name
  return (
    <div className="node-operation" role="status">
      <span>{label}</span>
      <progress
        aria-label={label}
        max={100}
        value={stage === 'removing' ? undefined : current.progress}
      />
    </div>
  )
}
