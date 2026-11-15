import { t } from '../lib/i18n'
import { useState } from 'react'
import { ArrowRight, Check, Copy, Eye, EyeOff, Shuffle } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { ActionForm, Button, ErrorNotice, Field, Loading } from '../components/ui'
import { DementiaMark, DementiaWordmark } from '../components/Logo'

export default function AuthPage() {
  const auth = useAuth()
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  if (auth.loading)
    return (
      <div className="auth-loading">
        <Loading />
      </div>
    )
  const onboarding = !!auth.session?.password_change_required
  if (auth.session && !onboarding) return <Navigate to="/" replace />
  const setup = !!auth.setup?.setup_required
  const creating = setup || onboarding
  return (
    <div className="auth-layout">
      <main className="auth-stage">
        <div className="auth-wordmark">
          <DementiaWordmark />
        </div>
        <div className="auth-corner">{creating ? t('ПЕРВЫЙ ЗАПУСК') : 'CONTROL PANEL'}</div>
        <section className="auth-form" key={onboarding ? 'onboarding' : setup ? 'setup' : 'login'}>
          <div className="auth-icon">
            <DementiaMark />
          </div>
          <header className="auth-heading">
            <h1>{creating ? t('Настроим вашу панель') : t('Добро пожаловать')}</h1>
            <p>
              {onboarding
                ? t('Замените временные данные и сохраните новый пароль.')
                : setup
                  ? t('Создайте учётную запись администратора dementia.')
                  : t('Войдите в dementia, чтобы управлять своей сетью.')}
            </p>
          </header>
          {auth.error && <ErrorNotice message={auth.error} retry={() => void auth.reload()} />}
          <ActionForm
            key={creating ? 'create' : 'login'}
            submitLabel={creating ? t('Сохранить и открыть панель') : t('Войти в панель')}
            onSubmit={async (data) => {
              if (creating && password !== data.get('confirmation'))
                throw new Error(t('Пароли не совпадают.'))
              if (generated && data.get('saved') !== 'on')
                throw new Error(t('Сохраните сгенерированный пароль и подтвердите это ниже.'))
              await api(
                '/api/auth/' + (onboarding ? 'complete-setup' : setup ? 'setup' : 'login'),
                'POST',
                { username: String(data.get('username')).trim(), password },
              )
              setPassword('')
              setGenerated(false)
              setCopied(false)
              await auth.reload()
            }}
          >
            <Field label={t('Имя администратора')}>
              <input
                name="username"
                required
                pattern="[a-zA-Z0-9_.-]{1,64}"
                maxLength={64}
                autoComplete="username"
                defaultValue={onboarding ? auth.session?.username : ''}
                placeholder="admin"
                autoFocus
              />
            </Field>
            <Field
              label={creating ? t('Новый пароль') : t('Пароль')}
              hint={
                creating
                  ? t('Не менее 12 символов. Можно придумать свой или сгенерировать.')
                  : undefined
              }
            >
              <div className="password-field">
                <input
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setGenerated(false)
                    setCopied(false)
                  }}
                  type={visible ? 'text' : 'password'}
                  minLength={creating ? 12 : 1}
                  maxLength={1024}
                  required
                  autoComplete={creating ? 'new-password' : 'current-password'}
                  placeholder={creating ? t('Придумайте надёжный пароль') : t('Введите пароль')}
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={visible ? t('Скрыть пароль') : t('Показать пароль')}
                >
                  {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            {creating && (
              <>
                <div className="password-tools">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      const random = crypto.getRandomValues(new Uint8Array(16))
                      setPassword(
                        Array.from(random, (x) => x.toString(16).padStart(2, '0')).join(''),
                      )
                      setVisible(true)
                      setGenerated(true)
                      setCopied(false)
                    }}
                  >
                    <Shuffle size={14} />
                    {t('Сгенерировать пароль')}
                  </Button>
                  {password && (
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label={t('Скопировать пароль')}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(password)
                          setCopied(true)
                          setCopyError('')
                        } catch {
                          setCopyError(t('Выделите пароль и скопируйте его вручную.'))
                        }
                      }}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? t('Скопирован') : t('Копировать')}
                    </Button>
                  )}
                </div>
                {copyError && <p className="muted text-xs">{copyError}</p>}
                <Field label={t('Повторите пароль')}>
                  <input
                    name="confirmation"
                    type="password"
                    required
                    minLength={12}
                    maxLength={1024}
                    autoComplete="new-password"
                    placeholder={t('Повторите новый пароль')}
                  />
                </Field>
                {generated && (
                  <label className="check-field">
                    <input type="checkbox" name="saved" required />
                    {t('Я сохранил пароль в надёжном месте')}
                  </label>
                )}
              </>
            )}
          </ActionForm>
          {!creating && (
            <div className="auth-access-note">
              <span />
              {t('Доступ только для администратора')}
            </div>
          )}
          {creating && (
            <p className="auth-setup-note">
              {onboarding
                ? t('После сохранения временный пароль и предыдущие сессии перестанут работать.')
                : t('Данные сохранятся в базе после перезапуска контейнеров.')}
            </p>
          )}
        </section>
        <footer className="auth-stage-footer">
          <span>{t('dementia · Своя сеть под контролем')}</span>
          <span className="auth-secure">
            <ArrowRight size={12} />
            {t('Защищённое рабочее пространство')}
          </span>
        </footer>
      </main>
    </div>
  )
}
