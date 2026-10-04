'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}

export default function SlideUpSheet({ open, onClose, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const lastChildrenRef = useRef<React.ReactNode>(null)
  const [keepContent, setKeepContent] = useState(false)
  if (open) lastChildrenRef.current = children

  useEffect(() => {
    if (open) {
      setKeepContent(true)
      return
    }
    const t = setTimeout(() => {
      lastChildrenRef.current = null
      setKeepContent(false)
    }, 320)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    let closedByPop = false
    window.history.pushState({ ...(window.history.state ?? {}), slideUpSheet: true }, '')
    const handler = () => {
      closedByPop = true
      onCloseRef.current()
    }
    window.addEventListener('popstate', handler)
    return () => {
      window.removeEventListener('popstate', handler)
      if (!closedByPop && window.history.state?.slideUpSheet) window.history.back()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (typeof window === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          opacity: open ? 1 : 0,
          transition: 'opacity 0.3s',
        }}
      />
      <div
        ref={ref}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '95dvh',
          background: 'var(--bg, #fff)',
          borderRadius: '16px 16px 0 0',
          overflowY: 'auto',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32,0,0,1)',
        }}
      >
        {open ? children : keepContent ? lastChildrenRef.current : null}
      </div>
    </div>,
    document.body
  )
}
