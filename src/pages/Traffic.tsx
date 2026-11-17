import { useAllUsers } from '../lib/users'
import { TrafficTrend } from '../components/TrafficTrend'
import { Select } from '../components/Select'
import { t } from '../lib/i18n'
import { useState } from 'react'
import { Download, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { bytes, useResource } from '../lib/api'
import type { Traffic, Node } from '../lib/types'
import { Button, Empty, ErrorNotice, Heading, Loading } from '../components/ui'
export default function TrafficPage() {
  const [days, setDays] = useState('30')
  const [node, setNode] = useState('')
  const [user, setUser] = useState('')
  const nodes = useResource<Node[]>('/nodes')
  const users = useAllUsers()
  const query = new URLSearchParams({
    days,
    ...(node ? { node_id: node } : {}),
    ...(user ? { user_id: user } : {}),
  })
  const r = useResource<Traffic[]>('/traffic?' + query, 30000)
  const data = r.data || []
  const rx = data.reduce((sum, t) => sum + t.received_bytes, 0)
  const tx = data.reduce((sum, t) => sum + t.sent_bytes, 0)
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
            <Select
              ariaLabel={t('Период')}
              value={days}
              onChange={setDays}
              options={[7, 30, 90, 366].map((value) => ({
                value: String(value),
                label: value + t(' дней'),
              }))}
            />
            <Select
              ariaLabel={t('Нода')}
              value={node}
              onChange={setNode}
              options={[
                { value: '', label: t('Все ноды') },
                ...(nodes.data || []).map((item) => ({
                  value: item.id,
                  label: item.name + (item.retired_at ? t(' (удалена)') : ''),
                })),
              ]}
            />
            <Select
              ariaLabel={t('Пользователь')}
              value={user}
              onChange={setUser}
              options={[
                { value: '', label: t('Все пользователи') },
                ...(users.data || []).map((item) => ({
                  value: item.id,
                  label: item.username,
                })),
              ]}
            />
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
            <TrafficTrend data={data} />
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
