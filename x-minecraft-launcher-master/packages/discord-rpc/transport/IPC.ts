import { randomUUID } from 'crypto'
import fs from 'fs'
import net from 'net'
import path from 'path'
import { CUSTOM_RPC_ERROR_CODE, Transport, type TransportOptions } from '../structures/Transport'
import { RPCError } from '../utils/RPCError'

export enum IPC_OPCODE {
  HANDSHAKE,
  FRAME,
  CLOSE,
  PING,
  PONG,
}

export type FormatFunction = (id: number) => [path: string, skipCheck?: boolean]

export type IPCTransportOptions = {
  pathList?: FormatFunction[]
} & TransportOptions

function tempPrefix(): string | undefined {
  const { XDG_RUNTIME_DIR, TMPDIR, TMP, TEMP } = process.env
  const candidate = XDG_RUNTIME_DIR ?? TMPDIR ?? TMP ?? TEMP ?? `${path.sep}tmp`
  try {
    return fs.realpathSync(candidate)
  } catch {
    return undefined
  }
}

const defaultPathList: FormatFunction[] = [
  (id: number): [string, boolean] => {
    // Windows named pipe. Discord listens on discord-ipc-0..9.
    const isWindows = process.platform === 'win32'
    return [isWindows ? `\\\\?\\pipe\\discord-ipc-${id}` : '', isWindows]
  },
  (id: number): [string] => {
    if (process.platform === 'win32') return ['']
    const prefix = tempPrefix()
    return [prefix ? path.join(prefix, `discord-ipc-${id}`) : '']
  },
  (id: number): [string] => {
    // Snap
    if (process.platform === 'win32') return ['']
    const prefix = tempPrefix()
    return [prefix ? path.join(prefix, 'snap.discord', `discord-ipc-${id}`) : '']
  },
  (id: number): [string] => {
    // Flatpak
    if (process.platform === 'win32') return ['']
    const prefix = tempPrefix()
    return [prefix ? path.join(prefix, 'app', 'com.discordapp.Discord', `discord-ipc-${id}`) : '']
  },
]

function createSocket(socketPath: string): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath)
    const onConnect = () => {
      socket.off('error', onError)
      resolve(socket)
    }
    const onError = (e: Error) => {
      socket.off('connect', onConnect)
      socket.destroy()
      reject(e)
    }
    socket.once('connect', onConnect)
    socket.once('error', onError)
  })
}

export class IPCTransport extends Transport {
  pathList: FormatFunction[] = defaultPathList

  private socket?: net.Socket
  /** Bytes received but not yet forming a complete frame. */
  private buffer: Buffer = Buffer.alloc(0)

  get isConnected() {
    return this.socket !== undefined && this.socket.readyState === 'open'
  }

  constructor(options: IPCTransportOptions) {
    super(options)

    this.pathList = options.pathList ?? this.pathList
  }

  private async getSocket(): Promise<net.Socket> {
    if (this.socket) return this.socket

    for (const formatFunc of this.pathList) {
      const ids = this.client.pipeId ? [this.client.pipeId] : Array.from({ length: 10 }, (_, i) => i)
      for (const id of ids) {
        const [socketPath, skipCheck] = formatFunc(id)
        if (!socketPath || !socketPath.trim()) continue
        if (!skipCheck && !fs.existsSync(path.dirname(socketPath))) continue
        const socket = await createSocket(socketPath).catch(() => undefined)
        if (socket) return socket
      }
    }

    throw new RPCError(CUSTOM_RPC_ERROR_CODE.RPC_COULD_NOT_CONNECT, 'Could not connect')
  }

  async connect(): Promise<void> {
    if (this.isConnected) return

    this.socket = await this.getSocket()
    this.buffer = Buffer.alloc(0)

    const socket = this.socket
    socket.setNoDelay(true)
    // A single persistent listener: Discord can split or coalesce frames, and a
    // half-received frame used to throw inside `readable` and kill the socket.
    socket.on('data', (chunk: Buffer) => this.onData(chunk))
    socket.on('error', (e) => {
      this.client.emit('debug', `IPC socket error: ${e.message}`)
      this.handleClose(e.message)
    })
    socket.on('close', () => this.handleClose('Closed by Discord'))

    this.emit('open')
    this.send({ v: 1, client_id: this.client.clientId }, IPC_OPCODE.HANDSHAKE)
  }

  private handleClose(reason: string) {
    if (!this.socket) return
    this.socket = undefined
    this.buffer = Buffer.alloc(0)
    this.emit('close', reason)
  }

  private onData(chunk: Buffer) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk

    while (this.buffer.length >= 8) {
      const op = this.buffer.readUInt32LE(0)
      const length = this.buffer.readUInt32LE(4)
      if (this.buffer.length < 8 + length) return

      const payload = this.buffer.subarray(8, 8 + length)
      this.buffer = this.buffer.subarray(8 + length)
      this.dispatch(op, payload)
    }
  }

  private dispatch(op: number, payload: Buffer) {
    let parsed: any
    try {
      parsed = payload.length ? JSON.parse(payload.toString('utf8')) : undefined
    } catch (e) {
      this.client.emit('debug', 'IPC | Cannot parse frame', e)
      return
    }

    this.client.emit('debug', `SERVER => CLIENT | OPCODE.${IPC_OPCODE[op] ?? op} |`, parsed)

    switch (op) {
      case IPC_OPCODE.FRAME:
        this.emit('message', parsed)
        break
      case IPC_OPCODE.CLOSE:
        this.emit('close', parsed)
        break
      case IPC_OPCODE.PING:
        this.send(parsed, IPC_OPCODE.PONG)
        this.emit('ping')
        break
      case IPC_OPCODE.PONG:
        break
      default:
        break
    }
  }

  send(message?: any, op: IPC_OPCODE = IPC_OPCODE.FRAME): void {
    if (!this.socket || this.socket.destroyed) return

    const dataBuffer = message ? Buffer.from(JSON.stringify(message)) : Buffer.alloc(0)
    const packet = Buffer.alloc(8)
    packet.writeUInt32LE(op, 0)
    packet.writeUInt32LE(dataBuffer.length, 4)

    try {
      this.socket.write(Buffer.concat([packet, dataBuffer]))
    } catch (e) {
      this.client.emit('debug', 'IPC | Cannot write frame', e)
    }
  }

  ping(): void {
    this.send(randomUUID(), IPC_OPCODE.PING)
  }

  close(): Promise<void> {
    const socket = this.socket
    this.socket = undefined
    this.buffer = Buffer.alloc(0)
    if (!socket) return Promise.resolve()

    return new Promise((resolve) => {
      socket.once('close', () => {
        this.emit('close', 'Closed by client')
        resolve()
      })
      socket.end()
    })
  }
}
