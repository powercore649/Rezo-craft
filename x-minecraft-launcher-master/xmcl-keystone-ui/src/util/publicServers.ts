import type { ServerStatus } from '@xmcl/runtime-api'

export type PublicServerCategory =
  | 'minigames'
  | 'pvp'
  | 'mmorpg'
  | 'survival'
  | 'prison'
  | 'anarchy'

export interface PublicServer {
  id: string
  name: string
  host: string
  port?: number
  category: PublicServerCategory
  website?: string
}

/**
 * Curated list of long-running public Minecraft: Java Edition servers.
 * Every address here was verified with the launcher own status ping
 * (`@xmcl/client` queryStatus) before being added, so the section never
 * advertises a dead host as a featured server.
 */
export const PUBLIC_SERVERS: PublicServer[] = [
  { id: 'hypixel', name: 'Hypixel', host: 'mc.hypixel.net', category: 'minigames', website: 'https://hypixel.net' },
  { id: 'cubecraft', name: 'CubeCraft', host: 'play.cubecraft.net', category: 'minigames', website: 'https://www.cubecraft.net' },
  { id: 'wynncraft', name: 'Wynncraft', host: 'play.wynncraft.com', category: 'mmorpg', website: 'https://wynncraft.com' },
  { id: '2b2t', name: '2b2t', host: 'connect.2b2t.org', category: 'anarchy', website: 'https://2b2t.org' },
  { id: 'purpleprison', name: 'Purple Prison', host: 'purpleprison.net', category: 'prison', website: 'https://purpleprison.net' },
  { id: 'manacube', name: 'ManaCube', host: 'play.manacube.com', category: 'minigames', website: 'https://manacube.com' },
  { id: 'minemen', name: 'Minemen Club', host: 'na.minemen.club', category: 'pvp', website: 'https://minemen.club' },
  { id: 'pvplegacy', name: 'PvP Legacy', host: 'play.pvplegacy.net', category: 'pvp', website: 'https://www.pvplegacy.net' },
  { id: 'jartex', name: 'JartexNetwork', host: 'play.jartexnetwork.com', category: 'minigames', website: 'https://jartexnetwork.com' },
  { id: 'originrealms', name: 'Origin Realms', host: 'play.originrealms.com', category: 'survival', website: 'https://originrealms.com' },
]

export function formatServerAddress(server: Pick<PublicServer, 'host' | 'port'>) {
  return server.port && server.port !== 25565 ? `${server.host}:${server.port}` : server.host
}

/**
 * A successful ping always reports a non-negative online count. The launcher
 * fill failed/timeout pings with `-1`, so this doubles as the reachability test.
 */
export function isServerOnline(status?: Pick<ServerStatus, 'players'>) {
  return !!status && status.players.online >= 0
}

export function formatServerPlayers(online: number, max: number, locale: string) {
  const formatter = new Intl.NumberFormat(locale)
  return max > 0
    ? `${formatter.format(online)} / ${formatter.format(max)}`
    : formatter.format(online)
}

export function filterPublicServers(
  servers: PublicServer[],
  query: string,
  category: PublicServerCategory | 'all' = 'all',
) {
  const keyword = query.trim().toLowerCase()
  return servers.filter((server) => {
    if (category !== 'all' && server.category !== category) return false
    if (!keyword) return true
    return (
      server.name.toLowerCase().includes(keyword) ||
      server.host.toLowerCase().includes(keyword) ||
      server.category.includes(keyword)
    )
  })
}

export function sortPublicServersByPlayers(
  servers: PublicServer[],
  statuses: Record<string, Pick<ServerStatus, 'players'> | undefined>,
) {
  return [...servers].sort(
    (left, right) =>
      (statuses[right.id]?.players.online ?? -1) - (statuses[left.id]?.players.online ?? -1) ||
      left.name.localeCompare(right.name),
  )
}
