import './styles/global.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

/* Scrollbar fade — animates --sb-alpha on each scrolling element via RAF.
   CSS reads the property via color-mix() to fade the thumb in/out smoothly. */
const scrollTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>()
const rafHandles = new WeakMap<HTMLElement, number>()

function fadeScrollbar(el: HTMLElement, from: number, to: number, duration: number): void {
  const existing = rafHandles.get(el)
  if (existing !== undefined) cancelAnimationFrame(existing)

  const start = performance.now()

  const tick = (now: number): void => {
    const raw = Math.min((now - start) / duration, 1)
    // ease-out: fast start, gentle settle
    const t = 1 - (1 - raw) ** 2
    const alpha = from + (to - from) * t
    el.style.setProperty('--sb-alpha', alpha.toFixed(3))
    if (raw < 1) {
      rafHandles.set(el, requestAnimationFrame(tick))
    } else {
      rafHandles.delete(el)
    }
  }

  rafHandles.set(el, requestAnimationFrame(tick))
}

document.addEventListener(
  'scroll',
  (e) => {
    const el = e.target
    if (!(el instanceof HTMLElement)) return

    // Cancel any ongoing fade-out and snap to visible
    const raf = rafHandles.get(el)
    if (raf !== undefined) cancelAnimationFrame(raf)
    rafHandles.delete(el)
    el.style.setProperty('--sb-alpha', '1')

    // Reset the hide timer
    const existing = scrollTimers.get(el)
    if (existing) clearTimeout(existing)
    scrollTimers.set(
      el,
      setTimeout(() => {
        scrollTimers.delete(el)
        fadeScrollbar(el, 1, 0, 600)
      }, 800)
    )
  },
  { capture: true, passive: true }
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
