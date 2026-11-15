import { t } from '../lib/i18n'
import { useState } from 'react'
import { KeyRound, Plus, Trash2 } from 'lucide-react'
import { api, date, useResource } from '../lib/api'
import type { APIToken } from '../lib/types'
import {
  ActionForm,
  Button,
  CopyValue,
  Empty,
  ErrorNotice,
  Field,
  Heading,
  Loading,
  Modal,
  useFeedback,
} from '../components/ui'
export default function TokensPage() {
  const r = useResource<APIToken[]>('/api-tokens')
  const [create, setCreate] = useState(false)
  const [secret, setSecret] = useState('')
  const f = useFeedback()
  return (
    <>
      <Heading
        title={t('API-токены')}
        description={t('Именованные ключи для интеграций и внешних сервисов.')}
        action={
          <Button variant="primary" onClick={() => setCreate(true)}>
            <Plus size={16} />
            {t('Выпустить токен')}
          </Button>
        }
      />
      <div className="notice mb-6">
        <KeyRound size={18} />
        <span>
          {t(
            'Токены не имеют срока действия. Передавайте ключ в заголовке Authorization: Bearer. Удаление немедленно отзывает доступ.',
          )}
        </span>
      </div>
      <section className="surface">
        {r.error && <ErrorNotice message={r.error} retry={() => void r.refresh()} />}
        {r.loading ? (
          <Loading />
        ) : !r.data?.length ? (
          <Empty
            title={t('Нет API-токенов')}
            description={t('Выпустите отдельный ключ для каждой интеграции.')}
            action={<Button onClick={() => setCreate(true)}>{t('Выпустить токен')}</Button>}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('Название')}</th>
                  <th>{t('Создан')}</th>
                  <th>{t('Идентификатор')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {r.data.map((token) => (
                  <tr key={token.id}>
                    <td>
                      <strong>{token.name}</strong>
                    </td>
                    <td>{date(token.created_at)}</td>
                    <td className="mono muted">{token.id}</td>
                    <td>
                      <Button
                        variant="ghost"
                        aria-label={t('Удалить ') + token.name}
                        onClick={() =>
                          f.confirm(
                            t('Удалить токен ') + token.name + '?',
                            t('Сервисы, использующие этот ключ, потеряют доступ к API.'),
                            async () => {
                              await api('/api-tokens/' + token.id, 'DELETE')
                              await r.refresh()
                              f.notify(t('Токен отозван'))
                            },
                          )
                        }
                      >
                        <Trash2 size={16} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {create && (
        <Modal title={t('Новый API-токен')} onClose={() => setCreate(false)}>
          <ActionForm
            submitLabel={t('Выпустить токен')}
            onCancel={() => setCreate(false)}
            onSubmit={async (form) => {
              const result = await api<{ token: string }>('/api-tokens', 'POST', {
                name: String(form.get('name')).trim(),
              })
              setSecret(result.token)
              setCreate(false)
              await r.refresh()
            }}
          >
            <Field label={t('Название интеграции')}>
              <input
                name="name"
                required
                maxLength={128}
                placeholder={t('Например, Billing service')}
              />
            </Field>
            <p className="muted">
              {t(
                'Ключ предоставляет административный доступ к ресурсам. Храните его в секретах вашего сервиса.',
              )}
            </p>
          </ActionForm>
        </Modal>
      )}
      {secret && (
        <Modal title={t('Сохраните API-токен')} onClose={() => setSecret('')}>
          <div className="modal-content">
            <p className="muted">
              {t(
                'Токен показывается один раз. После закрытия получить его повторно будет невозможно.',
              )}
            </p>
            <CopyValue value={secret} />
            <Button variant="primary" onClick={() => setSecret('')}>
              {t('Я сохранил токен')}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
