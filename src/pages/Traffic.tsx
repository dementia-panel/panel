import { t } from '../lib/i18n'
import { useState } from 'react'
import { Download, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { bytes, useResource } from '../lib/api'
import type { Traffic, Node, User } from '../lib/types'
import { Button, Empty, ErrorNotice, Heading, Loading } from '../components/ui'
export default function TrafficPage() {
  const [days, setDays] = useState('30')
  const [node, setNode] = useState('')
  const [user, setUser] = useState('')
  const nodes = useResource<Node[]>('/nodes')
  const users = useResource<User[]>('/users')
  const query = new URLSearchParams({
    days,
    ...(node ? { node_id: node } : {}),
    ...(user ? { user_id: user } : {}),
  })
  const r = useResource<Traffic[]>('/traffic?' + query, 30000)
  const data = r.data || []
  const rx = data.reduce((sum, t) => sum + t.received_bytes, 0)
  const tx = data.reduce((sum, t) => sum + t.sent_bytes, 0)
  const max = Math.max(1, ...data.map((t) => t.received_bytes + t.sent_bytes))
  function exportCSV() {
    const blob = new Blob(
      [
        '\ufeffday,received_bytes,sent_bytes\n' +
          data
            .map((t) => [t.day.slice(0, 10), t.received_bytes, t.sent_bytes].join(','))
            .join('\n'),
      ],
      { type: 'text/csv;charset=utf-8' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'traffic.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <>
      <Heading
        title={t('Трафик')}
        description={t('Передача данных по отчётам нод. Дни учитываются по UTC.')}
        action={
          <Button onClick={exportCSV} disabled={!data.length}>
            <Download size={16} />
            {t('Экспорт CSV')}
          </Button>
        }
      />
      <section className="surface">
        <div className="toolbar">
          <div className="filter-group">
            <select aria-label={t('Период')} value={days} onChange={(e) => setDays(e.target.value)}>
              {[7, 30, 90, 366].map((d) => (
                <option key={d} value={d}>
                  {d}
                  {t(' дней')}
                </option>
              ))}
            </select>
            <select aria-label={t('Нода')} value={node} onChange={(e) => setNode(e.target.value)}>
              <option value="">{t('Все ноды')}</option>
              {nodes.data?.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                  {n.retired_at ? t(' (удалена)') : ''}
                </option>
              ))}
            </select>
            <select
              aria-label={t('Пользователь')}
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
        </div>
        {(r.error || nodes.error || users.error) && (
          <ErrorNotice
            message={r.error || nodes.error || users.error}
            retry={() => {
              void r.refresh()
              void nodes.refresh()
              void users.refresh()
            }}
          />
        )}
        {r.loading ? (
          <Loading />
        ) : !data.length ? (
          <Empty
            title={t('Пока нет данных')}
            description={t(
              'Трафик появится после подключения пользователей и получения отчётов от нод.',
            )}
          />
        ) : (
          <>
            <div className="traffic-totals large">
              <div className="traffic-received">
                <ArrowDownLeft size={20} />
                <span>
                  {t('Получено')}
                  <strong>{bytes(rx)}</strong>
                </span>
              </div>
              <div className="traffic-sent">
                <ArrowUpRight size={20} />
                <span>
                  {t('Отправлено')}
                  <strong>{bytes(tx)}</strong>
                </span>
              </div>
              <div>
                <span>
                  {t('Всего')}
                  <strong>{bytes(rx + tx)}</strong>
                </span>
              </div>
            </div>
            <div
              className="traffic-chart"
              role="img"
              aria-label={t(
                'Столбчатый график входящего и исходящего трафика по дням. Точные значения в таблице ниже.',
              )}
            >
              <div className="chart-scale">{bytes(max)}</div>
              <div className="chart-bars">
                {data.map((t) => (
                  <div
                    className="chart-column"
                    key={t.day}
                    title={t.day.slice(0, 10) + ': ' + bytes(t.received_bytes + t.sent_bytes)}
                  >
                    <div className="chart-track">
                      <div
                        className="stacked-bar"
                        style={{
                          height:
                            Math.max(1, ((t.received_bytes + t.sent_bytes) / max) * 100) + '%',
                        }}
                      >
                        <span style={{ flex: t.received_bytes || 0.001 }} />
                        <span style={{ flex: t.sent_bytes || 0.001 }} />
                      </div>
                    </div>
                    {data.length <= 31 && <span>{t.day.slice(8, 10)}</span>}
                  </div>
                ))}
              </div>
              <div className="chart-legend">
                <span>
                  <i />
                  {t('Получено')}
                </span>
                <span>
                  <i />
                  {t('Отправлено')}
                </span>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('Дата · UTC')}</th>
                    <th>{t('Получено')}</th>
                    <th>{t('Отправлено')}</th>
                    <th>{t('Всего')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data].reverse().map((t) => (
                    <tr key={t.day}>
                      <td>{t.day.slice(0, 10)}</td>
                      <td>{bytes(t.received_bytes)}</td>
                      <td>{bytes(t.sent_bytes)}</td>
                      <td className="font-medium">{bytes(t.received_bytes + t.sent_bytes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  )
}
