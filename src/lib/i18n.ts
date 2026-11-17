import { useEffect, useSyncExternalStore } from 'react'
import { english } from './translations'

export type Language = 'en' | 'ru'
type Scope = 'admin' | 'subscription'
const keys = { admin: 'dementia.language', subscription: 'dementia.subscription.language' }
const changeEvent = 'dementia:language'
let currentLanguage: Language = 'en'
let subscriptionDefault: Language = 'en'
const memory: Partial<Record<Scope, Language>> = {}
let memoryOnly = false

function snapshot(scope: Scope): Language {
  let value: string | null | undefined = memory[scope]
  if (!memoryOnly) {
    try {
      value = window.localStorage.getItem(keys[scope])
    } catch {
      memoryOnly = true
    }
  }
  currentLanguage =
    value === 'en' || value === 'ru' ? value : scope === 'subscription' ? subscriptionDefault : 'en'
  return currentLanguage
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === keys.admin || event.key === keys.subscription || event.key === null)
      listener()
  }
  window.addEventListener(changeEvent, listener)
  window.addEventListener('storage', storage)
  return () => {
    window.removeEventListener(changeEvent, listener)
    window.removeEventListener('storage', storage)
  }
}
export function setLanguage(language: Language, scope: Scope = 'admin') {
  currentLanguage = language
  memory[scope] = language
  try {
    window.localStorage.setItem(keys[scope], language)
  } catch {
    memoryOnly = true
  }
  window.dispatchEvent(new Event(changeEvent))
}
export function setSubscriptionDefault(language: Language) {
  subscriptionDefault = language
  snapshot('subscription')
  window.dispatchEvent(new Event(changeEvent))
}
export function getLocale() {
  return currentLanguage === 'ru' ? 'ru-RU' : 'en-US'
}
export function t(message: string): string {
  if (currentLanguage === 'ru') return message
  if (Object.hasOwn(english, message)) return english[message]
  const trimmed = message.trim()
  return Object.hasOwn(english, trimmed) ? message.replace(trimmed, english[trimmed]) : message
}
export function useLanguage(scope: Scope = 'admin') {
  const language = useSyncExternalStore(
    subscribe,
    () => snapshot(scope),
    () => 'en' as const,
  )
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  return { language, setLanguage: (value: Language) => setLanguage(value, scope) }
}
