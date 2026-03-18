'use client'

import { useState, useCallback, useEffect } from 'react'
import PinModal from './PinModal'

type PaymentAuthGuardProps = {
  children: React.ReactNode
  onSuccess: () => void
  title?: string
  /** 버튼 대신 감싼 영역 클릭 시 PIN 검증 후 onSuccess 호출 */
  requirePin?: boolean
}

export default function PaymentAuthGuard({ children, onSuccess, title = '결제 PIN 확인', requirePin = true }: PaymentAuthGuardProps) {
  const [showPin, setShowPin] = useState(false)
  const [pinError, setPinError] = useState('')
  const [lockedMinutes, setLockedMinutes] = useState<number | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/pin/status')
      const data = await res.json()
      if (data.minutesLeft != null && data.minutesLeft > 0) setLockedMinutes(data.minutesLeft)
      else setLockedMinutes(null)
    } catch {
      setLockedMinutes(null)
    }
  }, [])

  useEffect(() => {
    if (showPin) fetchStatus()
  }, [showPin, fetchStatus])

  const handleClick = () => {
    if (!requirePin) {
      onSuccess()
      return
    }
    setPinError('')
    setShowPin(true)
  }

  const handleConfirm = async (pin: string) => {
    setPinError('')
    const res = await fetch('/api/auth/pin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
    const data = await res.json()
    if (res.status === 423 && data.minutesLeft != null) {
      setLockedMinutes(data.minutesLeft)
      return
    }
    if (!res.ok) {
      setPinError(data.error || 'PIN이 일치하지 않습니다.')
      throw new Error(data.error)
    }
    setShowPin(false)
    onSuccess()
  }

  return (
    <>
      <div onClick={handleClick} style={{ display: 'inline-block', cursor: 'pointer' }}>
        {children}
      </div>
      {showPin && (
        <PinModal
          title={title}
          onConfirm={handleConfirm}
          onCancel={() => setShowPin(false)}
          error={pinError}
          lockedMinutes={lockedMinutes ?? undefined}
        />
      )}
    </>
  )
}
