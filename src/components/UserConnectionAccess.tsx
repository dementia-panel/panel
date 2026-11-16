import { useState } from 'react'
import { ExternalLink, Link2 } from 'lucide-react'
import { api, useResource } from '../lib/api'
import { t } from '../lib/i18n'
import type { Node, Subscription } from '../lib/types'
import { ProfileActions } from '../pages/Subscriptions'
import { Button, CopyValue, ErrorNotice, Loading, useFeedback } from './ui'

export function UserConnectionAccess({ access }: { access: Subscription }) {
  const link = useResource<{ url: string | null }>(`/subscriptions/${access.id}/link`)
  const nodes = useResource<Node[]>('/nodes')
  const [issuedURL, setIssuedURL] = useState('')
  const feedback = useFeedback()
  const url = issuedURL || link.data?.url

  function replaceLink() {
    feedback.confirm(
      t('Создать новую ссылку?'),
      t('Старая ссылка перестанет работать. Уже импортированные VPN-ключи сохранят доступ.'),
      async () => {
        const result = await api<{ url: string }>(`/subscriptions/${access.id}/rotate-link`, 'POST')
        setIssuedURL(result.url)
      },
    )
  }

  return (
    <section className="user-connection-access" aria-label={t('Профили подключения')}>
      <div className="user-connection-heading">
        <h3>{t('Профили подключения')}</h3>
        <span className="muted">{t('Уже выданные ключи')}</span>
      </div>
      {link.loading ? <Loading /> : link.error ? (
        <ErrorNotice message={link.error} retry={() => void link.refresh()} />
      ) : url ? (
        <div className="user-connection-link">
          <CopyValue value={url} inputLabel={t('Ссылка подписки')} />
          <a className="btn btn-secondary" href={url} target="_blank" rel="noreferrer">
            <ExternalLink size={15} />{t('Открыть')}
          </a>
        </div>
      ) : (
        <p className="muted">{t('Ссылка выпущена до обновления и не сохранена. Можно создать новую ссылку без замены VPN-ключей.')}</p>
      )}
      {!link.loading && !link.error && (
        <Button type="button" onClick={replaceLink}><Link2 size={15} />{t('Создать новую ссылку')}</Button>
      )}
      {nodes.error ? <ErrorNotice message={nodes.error} retry={() => void nodes.refresh()} /> :
        (access.node_ids ?? []).map((nodeId) => (
          <div className="user-connection-server" key={nodeId}>
            <ProfileActions subscriptionId={access.id} nodeId={nodeId}
              name={nodes.data?.find((node) => node.id === nodeId)?.name ?? t('Сервер')} />
          </div>
        ))}
    </section>
  )
}
