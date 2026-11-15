import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
  value() {
    this.setAttribute('open', '')
  },
})
Object.defineProperty(HTMLDialogElement.prototype, 'close', {
  value() {
    this.removeAttribute('open')
  },
})
afterEach(() => {
  cleanup()
  window.history.replaceState({}, '', '/')
})
