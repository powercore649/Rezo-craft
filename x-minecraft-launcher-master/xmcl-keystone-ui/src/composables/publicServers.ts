import { ServerStatusServiceKey, type ServerStatus } from '@xmcl/runtime-api'
import { reactive, ref } from 'vue'
import { PUBLIC_SERVERS, type PublicServer } from '@/util/publicServers'
import { useService } from './service'

/**
 * Live status of the featured public servers, backed by the launcher own
 * Minecraft status ping (the same one used by instances).
 */
export function usePublicServers() {
  const { pingServer } = useService(ServerStatusServiceKey)
  const statuses = reactive<Record<string, ServerStatus>>({})
  const pending = reactive<Record<string, boolean>>({})
  const refreshing = ref(false)
  const lastUpdated = ref(0)

  async function refreshOne(server: PublicServer) {
    if (pending[server.id]) return
    pending[server.id] = true
    try {
      statuses[server.id] = await pingServer({ host: server.host, port: server.port })
    } finally {
      pending[server.id] = false
    }
  }

  async function refreshAll() {
    if (refreshing.value) return
    refreshing.value = true
    try {
      await Promise.all(PUBLIC_SERVERS.map((server) => refreshOne(server)))
      lastUpdated.value = Date.now()
    } finally {
      refreshing.value = false
    }
  }

  return {
    servers: PUBLIC_SERVERS,
    statuses,
    pending,
    refreshing,
    lastUpdated,
    refreshAll,
    refreshOne,
  }
}

export type PublicServersController = ReturnType<typeof usePublicServers>
