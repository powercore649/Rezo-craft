import {
  XmclAccountServiceKey,
  type XmclTogetherOrder,
  type XmclTogetherOverview,
} from '@xmcl/runtime-api'
import { useEventListener } from '@vueuse/core'
import { computed, onMounted, ref, shallowRef } from 'vue'
import {
  getTogetherRecommendationAction,
  isWaffoCheckoutUrl,
} from '@/util/multiplayerTogether'
import { useService } from './service'

export interface TogetherSectionOptions {
  /**
   * Called when the relay access may have changed (trial claimed or plan
   * subscribed) so the caller can reload its ICE servers.
   */
  onAccessChanged?: () => void | Promise<void>
}

const MINIMUM_TOP_UP_MINOR = 100

/**
 * Single source of truth for the Minecraft Together section: relay access,
 * trial, plan, balance and Waffo checkout.
 */
export function useTogetherSection(options: TogetherSectionOptions = {}) {
  const service = useService(XmclAccountServiceKey)
  const overview = shallowRef<XmclTogetherOverview>()
  const order = shallowRef<XmclTogetherOrder>()
  const loading = ref(false)
  const error = shallowRef<unknown>()
  const loaded = ref(false)

  async function run(action: () => Promise<void>) {
    if (loading.value) return
    loading.value = true
    error.value = undefined
    try {
      await action()
      loaded.value = true
    } catch (failure) {
      error.value = failure
    } finally {
      loading.value = false
    }
  }

  async function load() {
    if (order.value?.status === 'pending') {
      order.value = await service.getTogetherOrder(order.value.orderId)
    }
    overview.value = await service.getTogetherOverview()
  }

  async function loadAfterPurchase() {
    await load()
    await options.onAccessChanged?.()
  }

  const refresh = () => run(load)

  const claimTrial = () => run(async () => {
    await service.claimTogetherTrial()
    await loadAfterPurchase()
  })

  const topUp = (amountMinor: number) => run(async () => {
    const amount = Math.round(amountMinor)
    if (!Number.isFinite(amount) || amount < MINIMUM_TOP_UP_MINOR) {
      throw new Error('invalid_top_up_amount')
    }
    const created = await service.createTogetherOrder(amount)
    order.value = created
    const approvalUrl = created.approvalUrl
    if (!approvalUrl || !isWaffoCheckoutUrl(approvalUrl)) {
      throw new Error('invalid_waffo_checkout_url')
    }
    window.open(approvalUrl, '_blank')
  })

  const subscribe = () => run(async () => {
    await service.subscribeTogether()
    await loadAfterPurchase()
  })

  const cancel = () => run(async () => {
    await service.cancelTogether()
    await load()
  })

  const trial = computed(() => overview.value?.trial)
  const subscription = computed(() => overview.value?.subscription ?? undefined)
  const trialStatus = computed(() => overview.value?.trial.status)
  const subscriptionStatus = computed(() => subscription.value?.status)
  // NovaCraft is free: Together access and its relay are granted to everyone,
  // no trial or paid plan is required anymore.
  const hasAccess = computed(() => true)
  const relayAllowance = computed(() => overview.value?.allowances.turnEgressBytes)
  const recommendationAction = computed(() =>
    getTogetherRecommendationAction(trialStatus.value),
  )

  onMounted(() => {
    void refresh()
  })
  useEventListener(window, 'focus', () => {
    if (order.value?.status === 'pending') void refresh()
  })

  return {
    overview,
    order,
    loading,
    error,
    loaded,
    trial,
    trialStatus,
    subscription,
    subscriptionStatus,
    hasAccess,
    relayAllowance,
    recommendationAction,
    refresh,
    claimTrial,
    topUp,
    subscribe,
    cancel,
  }
}

export type TogetherSection = ReturnType<typeof useTogetherSection>
