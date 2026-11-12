import { describe, expect, it } from 'vitest'
import {
  PUBLIC_SERVERS,
  filterPublicServers,
  formatServerAddress,
  formatServerPlayers,
  isServerOnline,
  sortPublicServersByPlayers,
} from './publicServers'

describe('public server list', () => {
  it('keeps every featured server on a unique host and id', () => {
    expect(new Set(PUBLIC_SERVERS.map((server) => server.id)).size).toBe(PUBLIC_SERVERS.length)
    expect(new Set(PUBLIC_SERVERS.map((server) => server.host)).size).toBe(PUBLIC_SERVERS.length)
    expect(PUBLIC_SERVERS.every((server) => !!server.host && !!server.name)).toBe(true)
  })

  it('prints the default port only when it is not implicit', () => {
    expect(formatServerAddress({ host: 'mc.hypixel.net' })).toBe('mc.hypixel.net')
    expect(formatServerAddress({ host: 'mc.hypixel.net', port: 25565 })).toBe('mc.hypixel.net')
    expect(formatServerAddress({ host: 'example.org', port: 25566 })).toBe('example.org:25566')
  })

  it('treats only a non-negative player count as online', () => {
    expect(isServerOnline({ players: { online: 0, max: 0 } })).toBe(true)
    expect(isServerOnline({ players: { online: 1297, max: 1 } })).toBe(true)
    expect(isServerOnline({ players: { online: -1, max: -1 } })).toBe(false)
    expect(isServerOnline(undefined)).toBe(false)
  })

  it('formats player counts with the current locale', () => {
    expect(formatServerPlayers(28959, 200000, 'en-US')).toBe('28,959 / 200,000')
    expect(formatServerPlayers(1556, 0, 'en-US')).toBe('1,556')
  })

  it('filters by name, host and category without case sensitivity', () => {
    expect(filterPublicServers(PUBLIC_SERVERS, 'hypixel').map((s) => s.id)).toEqual(['hypixel'])
    expect(filterPublicServers(PUBLIC_SERVERS, 'CUBECRAFT').map((s) => s.id)).toEqual(['cubecraft'])
    expect(filterPublicServers(PUBLIC_SERVERS, 'wynncraft.com').map((s) => s.id)).toEqual(['wynncraft'])
    expect(filterPublicServers(PUBLIC_SERVERS, '', 'pvp').map((s) => s.id)).toEqual(['minemen', 'pvplegacy'])
    expect(filterPublicServers(PUBLIC_SERVERS, '2b2t', 'anarchy').map((s) => s.id)).toEqual(['2b2t'])
    expect(filterPublicServers(PUBLIC_SERVERS, '2b2t', 'pvp')).toEqual([])
  })

  it('sorts reachable servers by live player count', () => {
    const servers = PUBLIC_SERVERS.slice(0, 2)
    const sorted = sortPublicServersByPlayers(servers, {
      [servers[0].id]: { players: { online: 10, max: 100 } },
      [servers[1].id]: { players: { online: 500, max: 1000 } },
    })
    expect(sorted.map((s) => s.id)).toEqual([servers[1].id, servers[0].id])
  })

  it('pushes failed pings to the end of the list', () => {
    const servers = PUBLIC_SERVERS.slice(0, 2)
    const sorted = sortPublicServersByPlayers(servers, {
      [servers[0].id]: { players: { online: -1, max: -1 } },
      [servers[1].id]: { players: { online: 4, max: 100 } },
    })
    expect(sorted.map((s) => s.id)).toEqual([servers[1].id, servers[0].id])
  })
})
