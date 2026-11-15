import { t } from '../lib/i18n'
import { createContext, useContext, useEffect, useId, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, FormEvent, ReactNode } from 'react'
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, Search, X } from 'lucide-react'
import { errorMessage } from '../lib/api'

export function Button({
  children,
  variant = 'secondary',
  busy,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  busy?: boolean
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={'btn btn-' + variant + ' ' + (props.className || '')}
    >
      {busy && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  )
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'success' | 'danger' | 'neutral' | 'warning'
}) {
  return (
    <span className={'badge badge-' + tone}>
      <span className="status-dot" />
      {children}
    </span>
  )
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  return (
    <div className="field">
      <label>
        <span>{label}</span>
        {children}
      </label>
      {hint && <small>{hint}</small>}
    </div>
  )
}
export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div role="alert" className="notice notice-error">
      <AlertCircle size={18} className="shrink-0" />
      <span>{message}</span>
      {retry && <Button onClick={retry}>{t('Повторить')}</Button>}
    </div>
  )
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty-mark">—</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <Loader2 size={20} className="animate-spin" />
      {t('Загружаем данные…')}
    </div>
  )
}
export function Heading({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{action}</div>
    </div>
  )
}
export function SearchBox({
  value,
  onChange,
  placeholder = t('Поиск'),
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="search">
      <Search size={16} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    const onCancel = (e: Event) => {
      e.preventDefault()
      closeRef.current()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      dialog.close()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      className={'modal ' + (wide ? 'modal-wide' : '')}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect()
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose()
        }
      }}
    >
      <div className="modal-head">
        <h2 id={id}>{title}</h2>
        <Button variant="ghost" aria-label={t('Закрыть')} onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
      {children}
    </dialog>
  )
}
export function ActionForm({
  children,
  submitLabel = t('Сохранить'),
  onSubmit,
  onCancel,
}: {
  children: ReactNode
  submitLabel?: string
  onSubmit: (data: FormData) => Promise<void>
  onCancel?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [error, setError] = useState('')
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    const form = e.currentTarget
    setBusy(true)
    setError('')
    try {
      await onSubmit(new FormData(form))
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit}>
      <fieldset disabled={busy} className="form-fields">
        {children}
      </fieldset>
      {error && <ErrorNotice message={error} />}
      <div className="form-footer">
        {onCancel && (
          <Button type="button" onClick={onCancel} disabled={busy}>
            {t('Отмена')}
          </Button>
        )}
        <Button type="submit" variant="primary" busy={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
export function CopyValue({
  value,
  label = t('Скопировать'),
  inputLabel = t('Значение для копирования'),
}: {
  value: string
  label?: string
  inputLabel?: string
}) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)
  return (
    <div className="copy-value">
      <input value={value} readOnly aria-label={inputLabel} onFocus={(e) => e.target.select()} />
      <Button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setError(false)
          } catch {
            setError(true)
          }
        }}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? t('Скопировано') : label}
      </Button>
      {error && <small>{t('Выделите значение и скопируйте вручную.')}</small>}
    </div>
  )
}

type Notice = { text: string; kind: 'success' | 'error' }
const FeedbackContext = createContext<{
  notify: (text: string, kind?: Notice['kind']) => void
  confirm: (title: string, text: string, action: () => Promise<void>) => void
}>({ notify: () => {}, confirm: () => {} })
export function useFeedback() {
  return useContext(FeedbackContext)
}
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null)
  const [confirmation, setConfirmation] = useState<{
    title: string
    text: string
    action: () => Promise<void>
  } | null>(null)
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 7000)
    return () => clearTimeout(timer)
  }, [notice])
  return (
    <FeedbackContext.Provider
      value={{
        notify: (text, kind = 'success') => setNotice({ text, kind }),
        confirm: (title, text, action) => setConfirmation({ title, text, action }),
      }}
    >
      {children}
      {notice && (
        <div className={'toast toast-' + notice.kind} role="status">
          {notice.kind === 'success' ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}
          <span>{notice.text}</span>
          <button aria-label={t('Закрыть уведомление')} onClick={() => setNotice(null)}>
            <X size={17} />
          </button>
        </div>
      )}
      {confirmation && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
          <ActionForm
            submitLabel={t('Подтвердить')}
            onCancel={() => setConfirmation(null)}
            onSubmit={async () => {
              await confirmation.action()
              setConfirmation(null)
            }}
          >
            <p className="muted leading-relaxed">{confirmation.text}</p>
          </ActionForm>
        </Modal>
      )}
    </FeedbackContext.Provider>
  )
}
