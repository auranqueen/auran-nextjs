import net from 'net'

type ConnectConfig = { host: string; port: number; token: string }

type SendParams = {
  receivers: string[]
  sender: string
  title: string
  msg: string
  rsvdt: string
}

type IcodeSendResult = {
  stdcd: string
  retcd: string
  receiver: string
  telecom: string
  retmsg: string
}

class IcodeClient {
  private host = ''
  private port = 0
  private token = ''
  private socket: net.Socket | null = null

  connect(cfg: ConnectConfig) {
    this.host = cfg.host
    this.port = cfg.port
    this.token = cfg.token
  }

  send(params: SendParams, callback: (rets: IcodeSendResult[]) => void) {
    const socket = net.connect({ host: this.host, port: this.port })
    this.socket = socket
    const packets: string[] = params.receivers.map((receiver) =>
      this.writeData(receiver, params.sender, params.title, params.msg, params.rsvdt)
    )
    const rets: IcodeSendResult[] = []
    let buffer = ''

    const done = () => {
      this.close()
      callback(rets)
    }

    socket.on('connect', () => {
      for (const packet of packets) {
        socket.write(packet)
      }
    })

    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (rets.length >= packets.length) break
        if (line.length >= 8) rets.push(this.parseResponse(line.slice(0, 31).padEnd(31, ' ')))
      }
      while (buffer.length >= 31 && rets.length < packets.length) {
        const block = buffer.slice(0, 31)
        buffer = buffer.slice(31)
        rets.push(this.parseResponse(block))
      }
      if (rets.length >= packets.length) done()
    })

    socket.on('error', (err) => {
      if (rets.length === 0) {
        rets.push({
          stdcd: '',
          retcd: '99',
          receiver: '',
          telecom: '',
          retmsg: err.message || this.retCodeName('99'),
        })
      }
      done()
    })

    socket.on('close', () => {
      if (rets.length < packets.length && rets.length === 0) {
        rets.push({
          stdcd: '',
          retcd: '99',
          receiver: '',
          telecom: '',
          retmsg: this.retCodeName('99'),
        })
        done()
      }
    })
  }

  writeData(receiver: string, sender: string, title: string, msg: string, rsvdt: string): string {
    const tel = receiver.replace(/[^0-9]/g, '')
    const cb = sender.replace(/[^0-9]/g, '')
    const body = msg.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const list: Record<string, string> = {
      key: this.token,
      tel,
      cb,
      msg: body,
    }
    if (title) list.title = title.slice(0, 30)
    if (rsvdt) list.date = rsvdt.replace(/[^0-9]/g, '')
    const packet = JSON.stringify(list)
    return '06' + String(Buffer.byteLength(packet, 'utf8')).padStart(4, '0') + packet
  }

  parseResponse(block: string): IcodeSendResult {
    const stdcd = block.slice(0, 6)
    const retcd = block.slice(6, 8)
    const receiver = block.slice(8, 20)
    const telecom = block.slice(20)
    return {
      stdcd,
      retcd,
      receiver: receiver.trim(),
      telecom: telecom.trim(),
      retmsg: this.retCodeName(retcd),
    }
  }

  retCodeName(code: string): string {
    switch (code) {
      case '00': return '성공'
      case '99': return '인증실패/포트오류'
      case '98': return '사용기간만료'
      case '97': return '잔여코인부족'
      case '96': return '토큰키불가'
      case '88': return '소켓모듈불가상태'
      case '87': return '발송인증실패'
      case '85': return '미등록발송번호'
      case '23': return '데이터/날짜오류'
      case '17': return '지연,발송대기처리'
      default: return '알수없음'
    }
  }

  close() {
    if (this.socket && !this.socket.destroyed) {
      this.socket.destroy()
    }
    this.socket = null
  }

  unicodeEscape(str: string): string {
    let out = ''
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i)
      if (c > 127) {
        out += '\\u' + c.toString(16).padStart(4, '0')
      } else {
        out += str[i]
      }
    }
    return out.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  }

  currentTimeMillis(): number {
    return Date.now()
  }

  timeDiff(serverTime: number): number {
    return serverTime - this.currentTimeMillis()
  }
}

export async function sendIcodeSms(params: { phone: string; message: string }): Promise<{ ok: boolean; skipped?: boolean; raw?: string }> {
  const token = process.env.ICODE_TOKEN
  const host = process.env.ICODE_HOST
  const port = process.env.ICODE_PORT
  const sender = process.env.ICODE_SENDER
  if (!token || !host || !port || !sender) {
    console.log('[icode] env not set, skipping SMS send (dry-run)')
    return { ok: true, skipped: true }
  }
  return new Promise((resolve) => {
    let settled = false
    const finish = (result: { ok: boolean; skipped?: boolean; raw?: string }) => {
      if (settled) return
      settled = true
      resolve(result)
    }
    const timer = setTimeout(() => {
      finish({ ok: false, raw: 'timeout' })
    }, 5000)
    try {
      const client = new IcodeClient()
      client.connect({ host, port: Number(port), token })
      client.send(
        {
          receivers: [params.phone.replace(/-/g, '')],
          sender,
          title: 'AURAN',
          msg: params.message,
          rsvdt: '',
        },
        (rets) => {
          clearTimeout(timer)
          const first = rets?.[0]
          if (first && first.retcd === '00') {
            finish({ ok: true, raw: first.retmsg })
          } else {
            console.error('[icode] send failed:', first)
            finish({ ok: false, raw: first?.retmsg || 'unknown_error' })
          }
        }
      )
    } catch (e: unknown) {
      clearTimeout(timer)
      const msg = e instanceof Error ? e.message : 'exception'
      console.error('[icode] exception:', msg)
      finish({ ok: false, raw: msg })
    }
  })
}
