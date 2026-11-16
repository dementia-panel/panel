import { useState } from 'react'
import { useResource } from '../lib/api'
import { t } from '../lib/i18n'
import type { Node, Subscription, UserDevice } from '../lib/types'
import { ProfileActions } from '../pages/Subscriptions'
import { Select } from './Select'
import { DeviceLink } from './UserDevices'
import { ErrorNotice, Loading } from './ui'

export function UserConnectionAccess({ access }: { access: Subscription }) {
  const devices = useResource<UserDevice[]>(`/users/${access.user_id}/devices`, 15000)
  const nodes = useResource<Node[]>('/nodes')
  const [selected, setSelected] = useState('')
  const device = devices.data?.find((item) => item.id === selected) ?? devices.data?.[0]
  return (
    <section className="user-connection-access" aria-label={t('Профили подключения')}>
      <div className="user-connection-heading">
        <h3>{t('Профили подключения')}</h3>
        <span className="muted">{t('Уже выданные ключи')}</span>
      </div>
      {devices.loading ? (
        <Loading />
      ) : devices.error ? (
        <ErrorNotice message={devices.error} retry={() => void devices.refresh()} />
      ) : device ? (
        <>
          <Select
            ariaLabel={t('Устройство для подключения')}
            value={device.id}
            onChange={setSelected}
            options={(devices.data ?? []).map((item) => ({
              value: item.id,
              label: item.name === 'Main device' ? t('Основное устройство') : item.name,
            }))}
          />
          <DeviceLink
            key={device.id}
            userID={access.user_id}
            deviceID={device.id}
            subscriptionID={access.id}
          />
          {nodes.error ? (
            <ErrorNotice message={nodes.error} retry={() => void nodes.refresh()} />
          ) : (
            (access.node_ids ?? []).map((nodeId) => (
              <div className="user-connection-server" key={device.id + nodeId}>
                <ProfileActions
                  subscriptionId={access.id}
                  nodeId={nodeId}
                  endpoint={`/users/${access.user_id}/devices/${device.id}/nodes/${nodeId}/profile`}
                  name={nodes.data?.find((node) => node.id === nodeId)?.name ?? t('Сервер')}
                />
              </div>
            ))
          )}
        </>
      ) : (
        <p className="muted">{t('Устройства ещё не добавлены.')}</p>
      )}
    </section>
  )
}
