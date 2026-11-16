import { useEffect, useSyncExternalStore } from 'react'
import { english } from './translations'

export type Language = 'en' | 'ru'
const storageKey = 'dementia.language'
const changeEvent = 'dementia:language'
let currentLanguage: Language = 'en'
let memoryOnly = false

function snapshot(): Language {
  if (!memoryOnly) {
    try {
      currentLanguage = window.localStorage.getItem(storageKey) === 'ru' ? 'ru' : 'en'
    } catch {
      memoryOnly = true
    }
  }
  return currentLanguage
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === storageKey || event.key === null) listener()
  }
  window.addEventListener(changeEvent, listener)
  window.addEventListener('storage', storage)
  return () => {
    window.removeEventListener(changeEvent, listener)
    window.removeEventListener('storage', storage)
  }
}
export function setLanguage(language: Language) {
  currentLanguage = language
  try {
    window.localStorage.setItem(storageKey, language)
  } catch {
    memoryOnly = true
  }
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
export function useLanguage() {
  const language = useSyncExternalStore(subscribe, snapshot, () => 'en' as const)
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  return { language, setLanguage }
}
