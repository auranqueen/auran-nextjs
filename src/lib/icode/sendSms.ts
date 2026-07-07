import net from 'net'

class IcodeClient {
  sendCnt = 0
  res = ''
  returns: Array<{ stdcd: string; retcd: string; retmsg: string; receiver: string; telecom: string }> = []
  socket: net.Socket | null = null
  token = ''
  stm = 0
  retFn: ((rets: any[]) => void) | null = null

  connect(option: { host: string; port: number; token: string }) {
    const stm = this.currentTimeMillis()
    this.stm = stm
    this.token = option.token
    const _this = this
    this.socket = net.connect({ port: option.port, host: option.host }, function (this: net.Socket) {
      const sock = this
      this.setTimeout(2000)
      this.setEncoding('utf8')
      this.on('data', function (data) {
        _this.res += data.toString()
        if (_this.sendCnt > 0 && _this.res && _this.res.length >= _this.sendCnt * 31) {
          for (let j = 0; j < _this.sendCnt; j++) {
            const t = _this.res.substring(j * 31, j * 31 + 31)
            _this.returns.push({
              stdcd: t.substring(0, 6),
              retcd: t.substring(6, 8),
              retmsg: _this.retCodeName(t.substring(6, 8)),
              receiver: t.substring(8, 20),
              telecom: t.substring(20),
            })
          }
          sock.end()
          if (_this.retFn) _this.retFn(_this.returns)
        }
      })
      this.on('error', function (err) {
        console.error('[icode] Socket Error:', JSON.stringify(err))
      })
      this.on('timeout', function () {
        console.error('[icode] Socket Timed Out')
      })
    })
  }

  send(sms: { receivers: string[]; sender: string; title: string; msg: string; rsvdt: string }, fn: (rets: any[]) => void) {
    this.retFn = fn
    const _this = this
    sms.receivers.forEach(function (rsv) {
      const data = {
        key: _this.token,
        tel: rsv,
        cb: sms.sender,
        title: sms.title.replace('\r\n', ' '),
        msg: (rsv + sms.msg).replace('\r\n', '\n'),
        date: sms.rsvdt,
      }
      _this.writeData(_this.socket!, data)
    })
  }

  writeData(socket: net.Socket, data: any) {
    const _this = this
    this.sendCnt++
    let str = this.unicodeEscape(JSON.stringify(data))
    const byteLength = ('0000' + Buffer.byteLength(str)).slice(-4)
    str = '06' + byteLength + str
    const success = !socket.write(str)
    if (!success) {
      socket.once('drain', function () {
        _this.writeData(socket, data)
      })
    }
  }

  retCodeName(retCode: string): string {
    switch (retCode) {
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
    this.socket?.destroy()
  }

  unicodeEscape(str: string): string {
    return str.replace(/[\s\S]/g, function (escape) {
      const ch = escape.charCodeAt(0)
      if ((12593 <= ch && ch >= 12622) || (12623 <= ch && ch >= 12641) || (44032 <= ch && ch <= 55203)) {
        return '\\u' + ch.toString(16)
      }
      return escape
    })
  }

  currentTimeMillis(): number {
    return new Date().getTime()
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
    const finish = (result: { ok: boolean; raw?: string }) => {
      if (settled) return
      settled = true
      resolve(result)
    }
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
        (rets: any[]) => {
          const first = rets?.[0]
          if (first && first.retcd === '00') {
            finish({ ok: true, raw: first.retmsg })
          } else {
            console.error('[icode] send failed:', first)
            finish({ ok: false, raw: first?.retmsg || 'unknown_error' })
          }
        }
      )
      setTimeout(() => finish({ ok: false, raw: 'timeout' }), 5000)
    } catch (e: any) {
      console.error('[icode] exception:', e?.message)
      finish({ ok: false, raw: e?.message || 'exception' })
    }
  })
}
