import '@testing-library/jest-dom/vitest'
import { createElement, Fragment, forwardRef } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { vi } from 'vitest'

const MOTION_PROPS = new Set([
  'animate',
  'exit',
  'initial',
  'transition',
  'variants',
  'whileHover',
  'whileTap',
  'whileFocus',
  'whileDrag',
  'whileInView',
  'layout',
  'layoutId',
  'drag',
  'dragConstraints',
  'dragElastic',
  'dragMomentum',
  'dragTransition',
  'viewport'
])

function stripMotionProps(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    if (MOTION_PROPS.has(key)) continue
    output[key] = value
  }

  return output
}

vi.mock('framer-motion', () => {
  const cache = new Map<string, ComponentType<Record<string, unknown>>>()

  const getMotionComponent = (tag: string): ComponentType<Record<string, unknown>> => {
    const cached = cache.get(tag)
    if (cached) return cached

    const MotionComponent = forwardRef<HTMLElement, Record<string, unknown>>(function MotionStub(
      { children, ...props },
      ref
    ) {
      return createElement(tag, { ...stripMotionProps(props), ref }, children as ReactNode)
    })

    MotionComponent.displayName = `MotionStub(${tag})`
    cache.set(tag, MotionComponent)
    return MotionComponent
  }

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => {
        if (typeof key !== 'string') return getMotionComponent('div')
        return getMotionComponent(key)
      }
    }
  )

  const PassThrough = ({ children }: { children?: ReactNode }) =>
    createElement(Fragment, null, children)

  return {
    motion,
    m: motion,
    AnimatePresence: PassThrough,
    LayoutGroup: PassThrough,
    MotionConfig: PassThrough,
    useReducedMotion: () => true
  }
})
