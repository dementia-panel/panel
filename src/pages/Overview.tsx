import { t } from '../lib/i18n'
import { ArrowDownLeft, ArrowUpRight, Network, Plus, Server, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useResource, bytes, date } from '../lib/api'
import type { Node, User, Subscription, Traffic } from '../lib/types'
import { Badge, Empty, ErrorNotice, Heading, Loading } from '../components/ui'

export default function Overview() {
  const nodes = useResource<Node[]>('/nodes', 15000)
  const users = useResource<User[]>('/users', 15000)
  const subs = useResource<Subscription[]>('/subscriptions', 15000)
  const traffic = useResource<Traffic[]>('/traffic?days=7', 30000)
  if (nodes.loading || users.loading || subs.loading) return <Loading />
  const error = nodes.error || users.error || subs.error
  if (error)
    return (
      <ErrorNotice
        message={error}
        retry={() => {
          void nodes.refresh()
          void users.refresh()
          void subs.refresh()
        }}
      />
    )
  const activeNodes = nodes.data?.filter((n) => !n.retired_at) || []
  const online = activeNodes.filter((n) => n.online && n.enabled && n.status === 'ready').length
  const activeSubs =
    subs.data?.filter((s) => s.enabled && new Date(s.expires_at) > new Date()) || []
  const totals = (traffic.data || []).reduce(
    (s, t) => ({ rx: s.rx + t.received_bytes, tx: s.tx + t.sent_bytes }),
    { rx: 0, tx: 0 },
  )
  return (
    <>
      <Heading
        title={t('Обзор сети')}
        description={t('Состояние инфраструктуры и доступа в одном месте.')}
        action={
          <Link className="btn btn-primary" to="/nodes?create=1">
            <Plus size={16} />
            {t('Подключить ноду')}
          </Link>
        }
      />
      <div className="stat-grid">
        <Stat
          label={t('Пользователи')}
          tone="blue"
          value={String(users.data?.length || 0)}
          note={(users.data?.filter((u) => u.online).length || 0) + t(' сейчас в сети')}
          icon={<Users size={19} />}
        />
        <Stat
          label={t('Активные подписки')}
          tone="violet"
          value={String(activeSubs.length)}
          note={t('Всего ') + (subs.data?.length || 0)}
          icon={<Network size={19} />}
        />
        <Stat
          label={t('Ноды в сети')}
          tone="emerald"
          value={online + ' / ' + activeNodes.length}
          note={activeNodes.length ? t('Связь по ответам агента') : t('Подключите первый сервер')}
          icon={<Server size={19} />}
        />
        <Stat
          label={t('Трафик за 7 дней')}
          tone="cyan"
          value={bytes(totals.rx + totals.tx)}
          note={t('Входящий + исходящий')}
          icon={<ArrowUpRight size={19} />}
        />
      </div>
      <div className="overview-grid">
        <section className="surface">
          <div className="section-head">
            <div>
              <h2>{t('Инфраструктура')}</h2>
              <p>{t('Ноды и применение настроек')}</p>
            </div>
            <Link className="text-link" to="/nodes">
              {t('Все ноды ')}
              <ArrowUpRight size={15} />
            </Link>
          </div>
          {!activeNodes.length ? (
            <Empty
              title={t('Начните с первой ноды')}
              description={t(
                'Подключите VPS по SSH. Панель установит AmneziaWG и настроит сервер.',
              )}
              action={
                <Link className="btn btn-secondary" to="/nodes?create=1">
                  {t('Подключить сервер')}
                </Link>
              }
            />
          ) : (
            <div className="node-summary-list">
              {activeNodes.slice(0, 6).map((n) => (
                <Link to={'/nodes?node=' + n.id} className="node-summary" key={n.id}>
                  <span className="item-icon">
                    <Server size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <strong>{n.name}</strong>
                    <small className="mono">{n.ip}</small>
                  </div>
                  <Badge
                    tone={
                      n.online && n.enabled
                        ? 'success'
                        : n.status === 'failed'
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {!n.enabled
                      ? t('Пауза')
                      : n.online
                        ? t('В сети')
                        : n.status === 'installing'
                          ? t('Установка')
                          : t('Нет связи')}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="surface">
          <div className="section-head">
            <div>
              <h2>{t('Передача данных')}</h2>
              <p>{t('Последние 7 дней · UTC')}</p>
            </div>
          </div>
          {traffic.error ? (
            <ErrorNotice message={traffic.error} />
          ) : (
            <>
              <div className="traffic-totals">
                <div className="traffic-received">
                  <ArrowDownLeft size={17} />
                  <span>
                    {t('Получено')}
                    <strong>{bytes(totals.rx)}</strong>
                  </span>
                </div>
                <div className="traffic-sent">
                  <ArrowUpRight size={17} />
                  <span>
                    {t('Отправлено')}
                    <strong>{bytes(totals.tx)}</strong>
                  </span>
                </div>
              </div>
              <div className="mini-chart" aria-label={t('Общий трафик по дням')}>
                {(traffic.data || []).map((t) => (
                  <div
                    className="chart-column"
                    key={t.day}
                    title={t.day + ' · ' + bytes(t.received_bytes + t.sent_bytes)}
                  >
                    <div className="chart-track">
                      <div
                        style={{
                          height:
                            Math.max(
                              2,
                              ((t.received_bytes + t.sent_bytes) /
                                Math.max(
                                  ...(traffic.data || []).map(
                                    (d) => d.received_bytes + d.sent_bytes,
                                  ),
                                  1,
                                )) *
                                100,
                            ) + '%',
                        }}
                      />
                    </div>
                    <span>{t.day.slice(8)}</span>
                  </div>
                ))}
              </div>
              {!traffic.data?.length && (
                <p className="muted text-sm px-6 pb-6">
                  {t('История появится после первых отчётов нод.')}
                </p>
              )}
            </>
          )}
        </section>
      </div>
      <section className="surface mt-6">
        <div className="section-head">
          <div>
            <h2>{t('Последние подключения')}</h2>
            <p>{t('По времени последнего рукопожатия VPN')}</p>
          </div>
          <Link className="text-link" to="/users">
            {t('Пользователи ')}
            <ArrowUpRight size={15} />
          </Link>
        </div>
        {users.data?.some((u) => u.last_connected_at) ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Пользователь')}</th>
                  <th>{t('Состояние')}</th>
                  <th>{t('Последняя активность')}</th>
                </tr>
              </thead>
              <tbody>
                {[...(users.data || [])]
                  .filter((u) => u.last_connected_at)
                  .sort((a, b) =>
                    (b.last_connected_at || '').localeCompare(a.last_connected_at || ''),
                  )
                  .slice(0, 5)
                  .map((u) => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.username}</td>
                      <td>
                        <Badge tone={u.online ? 'success' : 'neutral'}>
                          {u.online ? t('В сети') : t('Не в сети')}
                        </Badge>
                      </td>
                      <td>{date(u.last_connected_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="quiet-empty">
            {t('Подключения появятся, когда пользователи начнут пользоваться VPN.')}
          </div>
        )}
      </section>
    </>
  )
}
function Stat({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string
  value: string
  note: string
  tone: 'blue' | 'violet' | 'emerald' | 'cyan'
  icon: React.ReactNode
}) {
  return (
    <div className={'stat stat-' + tone}>
      <div className="stat-label">
        {label}
        <span>{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  )
}
