import type {
  NetworkActionResult,
  NetworkAdapterInfo,
  NetworkConnection,
  NetworkPingResult,
  NetworkSnapshot,
  WifiNetwork,
  WifiScanResult,
  WifiSecurity,
} from '@xmcl/runtime-api'
import { execFile } from 'child_process'
import { promises as fs } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const MAC = /^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/i
const EMPTY_SCAN: WifiScanResult = { status: 'idle', networks: [], at: 0 }

interface ExecResult {
  code: number
  stdout: string
  stderr: string
}

function run(file: string, args: string[], timeout: number): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { windowsHide: true, encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const code = error && typeof (error as { code?: unknown }).code === 'number'
          ? (error as { code: number }).code
          : error
            ? 1
            : 0
        resolve({ code, stdout: stdout ?? '', stderr: stderr ?? (error?.message ?? '') })
      },
    )
  })
}

function ps(script: string, timeout = 20000) {
  return run('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.Encoding]::UTF8;${script}`,
  ], timeout)
}

function netsh(command: string, timeout = 25000) {
  return ps(`netsh ${command}`, timeout)
}

function parseJson<T>(raw: string): T | undefined {
  const text = raw.trim()
  if (!text || text[0] !== '{' && text[0] !== '[') return undefined
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined
  }
}

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function isLocationBlocked(raw: string) {
  return /privacy-location|WlanQueryInterface|informations WLAN|WLAN information/i.test(raw)
}

function lastErrorLine(raw: string) {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const interesting = lines.find((l) => /erreur|error|impossible|failed|refus/i.test(l))
  return (interesting ?? lines[lines.length - 1] ?? '').slice(0, 300)
}

/**
 * Parse the output of `netsh wlan show networks mode=bssid`.
 *
 * The labels printed by netsh are localized, so the parser relies on the
 * structure (`SSID 1 : name`, `BSSID 1 : mac`, `label : value`) and on the
 * shape of the values instead of the English/French label names.
 */
export function parseWifiScan(raw: string): WifiNetwork[] {
  const networks: WifiNetwork[] = []
  let current: (WifiNetwork & { bssids: number }) | undefined

  const flush = () => {
    if (!current) return
    const { bssids, ...rest } = current
    networks.push({ ...rest, secure: isSecureAuth(rest.authentication, rest.encryption) })
    current = undefined
  }

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, '    ')
    const ssid = /^\s*SSID\s+\d+\s*:\s?(.*)$/i.exec(line)
    if (ssid) {
      flush()
      const name = ssid[1].trim()
      if (!name) continue
      current = {
        ssid: name,
        signal: 0,
        authentication: '',
        encryption: '',
        secure: true,
        bssids: 0,
      }
      continue
    }
    if (!current) continue
    const separator = line.indexOf(':')
    if (separator < 0) continue
    const value = line.slice(separator + 1).trim()
    if (!value) continue

    if (MAC.test(value)) {
      current.bssids += 1
      continue
    }
    const percent = /^(\d{1,3})\s*%$/.exec(value)
    if (percent) {
      current.signal = Math.max(current.signal, Math.min(100, Number(percent[1])))
      continue
    }
    if (value.startsWith('802.11')) {
      current.radioType = value
      continue
    }
    if (/^\d+$/.test(value)) {
      const channel = Number(value)
      if (channel > 0 && channel <= 233) current.channel = channel
      continue
    }
    if (/^(CCMP|TKIP|GCMP|WEP|AES|None|Aucun)$/i.test(value)) {
      current.encryption = value
      continue
    }
    if (/WPA|WEP|OWE|SAE|ENTERPRISE|ENTREPRISE|PERSONAL|PERSONNEL|OPEN|OUVERT|NONE|AUCUN/i.test(value)) {
      current.authentication = value
    }
  }
  flush()

  return networks
    .map((network) => ({
      ...network,
      ssid: network.ssid.trim(),
    }))
    .filter((network, index, all) => all.findIndex((other) => other.ssid === network.ssid) === index)
    .sort((a, b) => b.signal - a.signal)
}

export function isSecureAuth(authentication: string, encryption: string) {
  const value = `${authentication} ${encryption}`.trim()
  if (!value) return true
  if (/^(OPEN|OUVERT|NONE|AUCUN)$/i.test(authentication.trim())) return false
  if (/^NONE$/i.test(encryption.trim()) || /^AUCUN$/i.test(encryption.trim())) return false
  return true
}

export function parseWlanProfiles(raw: string): string[] {
  const names: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    const index = line.lastIndexOf(':')
    if (index < 0) continue
    const value = line.slice(index + 1).trim()
    if (!value || value.startsWith('<')) continue
    if (/^(SSID|BSSID|Nom|Name)$/i.test(value)) continue
    if (names.includes(value)) continue
    names.push(value)
  }
  return names
}

export function parseWlanSignal(raw: string): number | undefined {
  const match = /(\d{1,3})\s*%/.exec(raw)
  if (!match) return undefined
  return Math.min(100, Number(match[1]))
}

interface AdapterJson {
  Name?: string
  InterfaceDescription?: string
  Status?: string
  LinkSpeed?: string
  MacAddress?: string
}

interface IpJson {
  Name?: string
  IPv4?: string | string[]
  Gateway?: string | string[]
  DNS?: string | string[]
}

interface ConnectionJson {
  Name?: string
  Interface?: string
  Category?: string
  IPv4?: string
}

const isWifiName = (name: string, description: string) =>
  /wi-?fi|wlan|wireless|802\.11/i.test(`${name} ${description}`)

/**
 * `net session` only succeeds for an elevated process, which is what netsh needs
 * to enumerate or connect Wi-Fi networks.
 */
async function isElevated() {
  if (process.platform !== 'win32') return true
  const result = await run('net', ['session'], 6000)
  return result.code === 0
}

export async function getNetworkSnapshot(): Promise<NetworkSnapshot> {
  if (process.platform !== 'win32') {
    return { supported: false, elevated: true, adapters: [], savedProfiles: [], scan: { ...EMPTY_SCAN, status: 'unsupported' } }
  }

  // One PowerShell process for every CIM query: spawning five shells at once is
  // slow enough on some machines that the adapter list ends up empty.
  const systemScript = [
    '$a=@(Get-NetAdapter -Physical | Select-Object Name,InterfaceDescription,Status,LinkSpeed,MacAddress);',
    '$i=@(Get-NetIPConfiguration | ForEach-Object { [pscustomobject]@{ Name=$_.InterfaceAlias; IPv4=@($_.IPv4Address.IPAddress); Gateway=@($_.IPv4DefaultGateway.NextHop); DNS=@($_.DNSServer.ServerAddresses) } });',
    '$c=@(Get-NetConnectionProfile | ForEach-Object { [pscustomobject]@{ Name=$_.Name; Interface=$_.InterfaceAlias; Category=[string]$_.NetworkCategory; IPv4=[string]$_.IPv4Connectivity } });',
    '[pscustomobject]@{ adapters=$a; ips=$i; connections=$c } | ConvertTo-Json -Compress -Depth 6',
  ].join('')

  const [system, profilesResult, interfacesResult] = await Promise.all([
    ps(systemScript, 30000),
    netsh('wlan show profiles', 30000),
    netsh('wlan show interfaces', 30000),
  ])

  const systemInfo = parseJson<{
    adapters?: AdapterJson | AdapterJson[]
    ips?: IpJson | IpJson[]
    connections?: ConnectionJson | ConnectionJson[]
  }>(system.stdout)
  const adapterList = toArray(systemInfo?.adapters)
  const ips = toArray(systemInfo?.ips)
  const connections = toArray(systemInfo?.connections)
  const savedProfiles = profilesResult.stdout && !isLocationBlocked(profilesResult.stdout)
    ? parseWlanProfiles(profilesResult.stdout)
    : []

  const ipByName = new Map(ips.map((ip) => [ip.Name ?? '', ip]))

  const adapters: NetworkAdapterInfo[] = adapterList
    .filter((adapter) => adapter.Status !== 'Not Present')
    .map((adapter) => {
      const name = adapter.Name ?? ''
      const ip = ipByName.get(name)
      return {
        name,
        description: adapter.InterfaceDescription ?? '',
        status: adapter.Status ?? 'Unknown',
        linkSpeed: adapter.LinkSpeed ?? '',
        mac: adapter.MacAddress ?? '',
        ipv4: toArray(ip?.IPv4).filter(Boolean),
        gateway: toArray(ip?.Gateway).filter(Boolean),
        dns: toArray(ip?.DNS).filter(Boolean),
        wifi: isWifiName(name, adapter.InterfaceDescription ?? ''),
      }
    })
    .sort((a, b) => Number(b.wifi) - Number(a.wifi) || a.name.localeCompare(b.name))

  const wifiAdapter = adapters.find((adapter) => adapter.wifi && adapter.status === 'Up') ?? adapters.find((adapter) => adapter.wifi)
  const signal = parseWlanSignal(interfacesResult.stdout)
  const wifiConnection = connections.find((connection) => connection.Interface && wifiAdapter && connection.Interface === wifiAdapter.name)
    ?? connections.find((connection) => connection.Name && !/^network \d+$/i.test(connection.Name))

  const connection: NetworkConnection | undefined = wifiConnection && wifiAdapter
    ? {
        ssid: wifiConnection.Name ?? '',
        adapter: wifiAdapter.name,
        signal,
        ipv4: wifiAdapter.ipv4,
        gateway: wifiAdapter.gateway,
        dns: wifiAdapter.dns,
        category: wifiConnection.Category || wifiConnection.IPv4,
      }
    : undefined

  return {
    supported: true,
    elevated: await isElevated(),
    adapters,
    connection,
    savedProfiles,
    scan: { ...EMPTY_SCAN },
  }
}

export async function scanWifi(): Promise<WifiScanResult> {
  if (process.platform !== 'win32') {
    return { status: 'unsupported', networks: [], at: Date.now() }
  }
  const result = await netsh('wlan show networks mode=bssid', 30000)
  const output = `${result.stdout}\n${result.stderr}`
  if (isLocationBlocked(output)) {
    return {
      status: 'blocked',
      networks: [],
      message: lastErrorLine(output),
      at: Date.now(),
    }
  }
  const networks = parseWifiScan(result.stdout)
  if (!networks.length && result.code !== 0 && !/aucun|none/i.test(output)) {
    return { status: 'error', networks: [], message: lastErrorLine(output), at: Date.now() }
  }
  return { status: 'ok', networks, at: Date.now() }
}

function xmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildProfileXml(ssid: string, password: string | undefined, security: WifiSecurity) {
  const name = xmlEscape(ssid)
  const open = security === 'open'
  const authentication = open ? 'open' : security === 'WPA3' ? 'WPA3SAE' : 'WPA2PSK'
  const encryption = open ? 'none' : 'AES'
  const key = open
    ? ''
    : `<sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>${xmlEscape(password ?? '')}</keyMaterial></sharedKey>`
  return `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${name}</name>
  <SSIDConfig><SSID><name>${name}</name></SSID></SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>auto</connectionMode>
  <MSM>
    <security>
      <authEncryption>
        <authentication>${authentication}</authentication>
        <encryption>${encryption}</encryption>
        <useOneX>false</useOneX>
      </authEncryption>
      ${key}
    </security>
  </MSM>
</WLANProfile>
`
}

function validateSsid(ssid: string) {
  const value = ssid.trim()
  if (!value) return { ok: false, message: 'empty ssid' } as const
  if (value.length > 32) return { ok: false, message: 'ssid too long' } as const
  if (/["\r\n]/.test(value)) return { ok: false, message: 'invalid ssid' } as const
  return { ok: true, value } as const
}

function actionResult(result: ExecResult): NetworkActionResult {
  const output = `${result.stdout}\n${result.stderr}`
  if (isLocationBlocked(output)) {
    return { ok: false, blocked: true, message: lastErrorLine(output) }
  }
  const failed = /erreur|error|impossible|failed|refus|denied/i.test(output) && result.code !== 0
  return { ok: !failed, message: lastErrorLine(output) || undefined }
}

export async function connectWifi(ssid: string, password?: string, security: WifiSecurity = 'WPA2'): Promise<NetworkActionResult> {
  if (process.platform !== 'win32') return { ok: false, message: 'unsupported' }
  const valid = validateSsid(ssid)
  if (!valid.ok) return { ok: false, message: valid.message }

  const profiles = await netsh('wlan show profiles')
  const known = parseWlanProfiles(profiles.stdout).some((name) => name.toLowerCase() === valid.value.toLowerCase())

  if (!known) {
    if (security !== 'open' && !password) {
      return { ok: false, message: 'password required' }
    }
    const file = join(tmpdir(), `novacraft-wlan-${Date.now()}.xml`)
    try {
      await fs.writeFile(file, buildProfileXml(valid.value, password, security), 'utf8')
      const added = await netsh(`wlan add profile filename="${file}" user=all`)
      const addOutput = `${added.stdout}\n${added.stderr}`
      if (isLocationBlocked(addOutput)) {
        return { ok: false, blocked: true, message: lastErrorLine(addOutput) }
      }
      if (/erreur|error|impossible|failed/i.test(addOutput) && !/ajout|added|correct/i.test(addOutput)) {
        return { ok: false, message: lastErrorLine(addOutput) }
      }
    } finally {
      await fs.unlink(file).catch(() => {})
    }
  }

  const connected = await netsh(`wlan connect name="${valid.value}"`)
  return actionResult(connected)
}

export async function disconnectWifi(): Promise<NetworkActionResult> {
  if (process.platform !== 'win32') return { ok: false, message: 'unsupported' }
  return actionResult(await netsh('wlan disconnect'))
}

export async function forgetWifi(ssid: string): Promise<NetworkActionResult> {
  if (process.platform !== 'win32') return { ok: false, message: 'unsupported' }
  const valid = validateSsid(ssid)
  if (!valid.ok) return { ok: false, message: valid.message }
  return actionResult(await netsh(`wlan delete profile name="${valid.value}"`))
}

export async function pingHosts(hosts: string[]): Promise<NetworkPingResult[]> {
  if (process.platform !== 'win32') return hosts.map((host) => ({ host, ms: null }))
  const safe = hosts.filter((host) => /^[a-zA-Z0-9.-]{1,253}$/.test(host)).slice(0, 8)
  if (!safe.length) return []
  const list = safe.map((host) => `'${host}'`).join(',')
  const script = [
    '$r=@();',
    `foreach($h in @(${list})){`,
    'try{$p=Test-Connection -ComputerName $h -Count 1 -ErrorAction Stop;[int]$ms=($p | Measure-Object -Property ResponseTime -Minimum).Minimum;$r += [pscustomobject]@{host=$h;ms=$ms}}',
    'catch{$r += [pscustomobject]@{host=$h;ms=$null}}};',
    '$r | ConvertTo-Json -Compress',
  ].join('')
  const result = await ps(script, 25000)
  const parsed = toArray(parseJson<{ host?: string; ms?: number | null } | { host?: string; ms?: number | null }[]>(result.stdout))
  return safe.map((host) => {
    const hit = parsed.find((item) => item.host === host)
    return { host, ms: typeof hit?.ms === 'number' ? hit.ms : null }
  })
}
