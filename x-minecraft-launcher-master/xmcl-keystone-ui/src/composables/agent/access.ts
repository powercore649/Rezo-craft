import type { XmclTogetherOverview } from '@xmcl/runtime-api'

/**
 * NovaCraft is fully free: the built-in agent must not require a paid
 * subscription anymore. The parameter and name are kept so existing call
 * sites and UI labels stay compatible.
 */
export function hasActiveXmclSubscription(_overview?: XmclTogetherOverview) {
  return true
}
