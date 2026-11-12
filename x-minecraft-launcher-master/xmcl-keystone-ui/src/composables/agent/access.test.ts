import { describe, expect, it } from 'vitest'
import { hasActiveXmclSubscription } from './access'

function overviewWithSubscription(status: 'active' | 'payment_due' | 'cancelled' | undefined) {
  return {
    subscription: status ? { status } : null,
  } as Parameters<typeof hasActiveXmclSubscription>[0]
}

describe('hasActiveXmclSubscription', () => {
  it('grants the built-in agent without any account or subscription', () => {
    expect(hasActiveXmclSubscription(undefined)).toBe(true)
  })

  it.each(['active', 'payment_due', 'cancelled'] as const)(
    'keeps free access whatever the subscription status is: %s',
    (status) => {
      expect(hasActiveXmclSubscription(overviewWithSubscription(status))).toBe(true)
    },
  )
})
