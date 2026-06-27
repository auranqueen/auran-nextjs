'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CSSProperties } from 'react'
const PURPLE = '#7B5EA7'
const TEXT = 'rgba(255,255,255,0.65)'
const SUB = 'rgba(255,255,255,0.3)'
const CARD: CSSProperties = { background: '#1a1520', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: 14, marginBottom: 10 }
interface InventoryRow {
  id: string
  product_name: string
  total_stock: number
}
interface LotRow {
  id: string
  inventory_id: string
  lot_number: string
  remaining_qty: number
  expires_at: string | null
  brand_inventory: { product_name: string } | null
}
interface Props {
  brandId: string | null
  brandName: string
}
async function generateQRDataUrl(data: string): Promise<string> {
  const QRCode = (await import('qrcode')).default
  return QRCode.toDataURL(data, {
    width: 160,
    margin: 1,
    color: { dark: '#1a1a2e', light: '#ffffff' },
  })
}
function QRImage({ data, size = 80 }: { data: string; size?: number }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    generateQRDataUrl(data).then(setUrl).catch(() => setUrl(''))
  }, [data])
  if (!url) return <div style={{ width: size, height: size, background: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
  return <img src={url} alt="QR" width={size} height={size} style={{ borderRadius: 4, display: 'block' }} />
}
export default function BrandInventoryQR({ brandId, brandName }: Props) {
  const supabase = createClient()
  const [inventories, setInventories] = useState<InventoryRow[]>([])
  const [lots, setLots] = useState<LotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [scanMode, setScanMode] = useState(false)
  const [scanResult, setScanResult] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<{ reset: () => void } | null>(null)
  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500) }
  const loadData = useCallback(async () => {
    if (!brandId) return
    setLoading(true)
    const [{ data: invData }, { data: lotData }] = await Promise.all([
      supabase.from('brand_inventory').select('id, product_name, total_stock').eq('brand_id', brandId).order('product_name'),
      supabase.from('brand_inventory_lots').select('id, inventory_id, lot_number, remaining_qty, expires_at, brand_inventory(product_name)').eq('brand_id', brandId).eq('status', 'active').order('expires_at', { ascending: true }),
    ])
    setInventories((invData || []) as InventoryRow[])
    setLots((lotData || []) as unknown as LotRow[])
    setLoading(false)
  }, [brandId])
  useEffect(() => { void loadData() }, [loadData])
  const tryParseQR = (text: string) => {
    try { return JSON.parse(text) as { product_name?: string; lot_number?: string } } catch { return null }
  }
  const stopScan = () => {
    if (scannerRef.current) {
      scannerRef.current.reset()
      scannerRef.current = null
    }
    setScanMode(false)
  }
  const startScan = async () => {
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library')
      const reader = new BrowserMultiFormatReader()
      scannerRef.current = reader
      setScanMode(true)
      setScanResult('')
      const mediaDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = mediaDevices.filter(d => d.kind === 'videoinput')
      const deviceId = videoDevices.length > 0 ? videoDevices[videoDevices.length - 1].deviceId : undefined
      if (videoRef.current) {
        await reader.decodeFromVideoDevice(deviceId ?? null, videoRef.current, (result) => {
          if (result) {
            const text = result.getText()
            setScanResult(text)
            stopScan()
            const parsed = tryParseQR(text)
            if (parsed) {
              showToast(`스캔 완료: ${parsed.product_name} — ${parsed.lot_number || '로트 없음'}`)
            } else {
              showToast('스캔됨: ' + text)
            }
          }
        })
      }
    } catch {
      showToast('카메라 접근 실패. 권한을 확인해주세요.')
      setScanMode(false)
    }
  }
  const qrData = (inv: InventoryRow, lot?: LotRow) => JSON.stringify({
    brand_id: brandId,
    brand_name: brandName,
    inventory_id: inv.id,
    product_name: inv.product_name,
    lot_id: lot?.id || null,
    lot_number: lot?.lot_number || null,
    expires_at: lot?.expires_at || null,
  })
  const printQR = async (inv: InventoryRow, lot?: LotRow) => {
    const data = qrData(inv, lot)
    const qrUrl = await generateQRDataUrl(data)
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR - ${inv.product_name}</title>
    <style>
      @page { size: 100mm 60mm; margin: 0; }
      @media print { body { margin: 0; } }
      body { font-family: 'Malgun Gothic', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fff; }
      .label { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; max-width: 95mm; }
      .info { flex: 1; min-width: 0; }
      .brand { font-size: 9px; color: #7B5EA7; margin-bottom: 3px; }
      .prod { font-size: 13px; font-weight: 600; color: #1a1a2e; margin-bottom: 4px; word-break: keep-all; }
      .lot { font-size: 10px; color: #444; margin-bottom: 2px; }
      .exp { font-size: 10px; color: ${lot?.expires_at ? '#E53935' : '#888'}; }
    </style></head>
    <body>
      <div class="label">
        <img src="${qrUrl}" width="120" height="120" style="display:block"/>
        <div class="info">
          <div class="brand">${brandName}</div>
          <div class="prod">${inv.product_name}</div>
          ${lot ? `<div class="lot">LOT: ${lot.lot_number}</div>` : ''}
          ${lot?.expires_at ? `<div class="exp">유통기한: ${new Date(lot.expires_at).toLocaleDateString('ko-KR')}</div>` : ''}
          <div style="font-size:9px;color:#888;margin-top:3px">AURAN Brand Hub</div>
        </div>
      </div>
    </body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300) }
  }
  const printAllQR = async () => {
    const labels = await Promise.all(inventories.map(async inv => {
      const invLots = lots.filter(l => l.inventory_id === inv.id)
      if (invLots.length > 0) {
        const lotLabels = await Promise.all(invLots.map(async lot => {
          const data = qrData(inv, lot)
          const qrUrl = await generateQRDataUrl(data)
          return `<div class="label">
            <img src="${qrUrl}" width="90" height="90" style="display:block;flex-shrink:0"/>
            <div class="info">
              <div class="brand">${brandName}</div>
              <div class="prod">${inv.product_name}</div>
              <div class="lot">LOT: ${lot.lot_number}</div>
              ${lot.expires_at ? `<div class="exp">유통기한: ${new Date(lot.expires_at).toLocaleDateString('ko-KR')}</div>` : ''}
            </div>
          </div>`
        }))
        return lotLabels.join('')
      }
      const data = qrData(inv)
      const qrUrl = await generateQRDataUrl(data)
      return `<div class="label">
        <img src="${qrUrl}" width="90" height="90" style="display:block;flex-shrink:0"/>
        <div class="info">
          <div class="brand">${brandName}</div>
          <div class="prod">${inv.product_name}</div>
          <div style="font-size:9px;color:#888">AURAN Brand Hub</div>
        </div>
      </div>`
    }))
    const labelsHtml = labels.join('')
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR 전체 출력</title>
    <style>
      @page { size: A4; margin: 10mm; }
      @media print { body { margin: 0; } }
      body { font-family: 'Malgun Gothic', sans-serif; margin: 0; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 8px; }
      .label { display: flex; align-items: center; gap: 8px; padding: 8px; border: 0.5px solid #ddd; border-radius: 4px; break-inside: avoid; }
      .info { flex: 1; min-width: 0; }
      .brand { font-size: 8px; color: #7B5EA7; margin-bottom: 2px; }
      .prod { font-size: 11px; font-weight: 600; color: #1a1a2e; margin-bottom: 3px; }
      .lot { font-size: 9px; color: #444; }
      .exp { font-size: 9px; color: #E53935; }
    </style></head>
    <body><div class="grid">${labelsHtml}</div></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 300) }
  }
  useEffect(() => {
    return () => { if (scannerRef.current) { scannerRef.current.reset(); scannerRef.current = null } }
  }, [])
  if (loading) return <div style={{ padding: 20, color: SUB, textAlign: 'center', fontSize: 13 }}>불러오는 중...</div>
  return (
    <div>
      {toast && <div style={{ position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', background: PURPLE, color: '#fff', fontSize: 12, padding: '7px 18px', borderRadius: 20, zIndex: 999, whiteSpace: 'nowrap' }}>{toast}</div>}
      <div style={CARD}>
        <div style={{ fontSize: 12, color: SUB, marginBottom: 10 }}>📷 QR / 바코드 카메라 스캔</div>
        {scanMode ? (
          <div>
            <video ref={videoRef} style={{ width: '100%', borderRadius: 8, marginBottom: 8, background: '#000' }} />
            <button type="button" onClick={stopScan}
              style={{ width: '100%', padding: '8px', borderRadius: 7, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, fontSize: 12, cursor: 'pointer' }}>
              스캔 중지
            </button>
          </div>
        ) : (
          <button type="button" onClick={startScan}
            style={{ width: '100%', padding: '10px', borderRadius: 7, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.1)', color: '#c4a7e7', fontSize: 13, cursor: 'pointer' }}>
            카메라 스캔 시작
          </button>
        )}
        {scanResult && (
          <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(76,175,80,0.1)', borderRadius: 6, fontSize: 12, color: '#4CAF50', wordBreak: 'break-all' }}>
            스캔 결과: {scanResult}
          </div>
        )}
      </div>
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: SUB }}>제품·로트별 QR 발행</span>
          <button type="button" onClick={() => void printAllQR()}
            style={{ fontSize: 11, padding: '4px 12px', borderRadius: 6, border: `0.5px solid ${PURPLE}`, background: 'rgba(123,94,167,0.15)', color: '#c4a7e7', cursor: 'pointer' }}>
            🖨️ 전체 출력 (A4)
          </button>
        </div>
        <div style={{ fontSize: 11, color: SUB, marginBottom: 12, lineHeight: 1.6 }}>
          QR 포함 정보: 브랜드ID · 제품ID · 로트번호 · 유통기한<br/>
          출력 규격: 라벨지 100×60mm / A4 3열<br/>
          홀로그램 라벨: QR 데이터 → 외주 업체 제작 가능
        </div>
        {inventories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px 0', color: SUB, fontSize: 12 }}>등록된 제품이 없어요</div>
        ) : inventories.map(inv => {
          const invLots = lots.filter(l => l.inventory_id === inv.id)
          return (
            <div key={inv.id} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: '0.5px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: TEXT }}>{inv.product_name}</span>
                <button type="button" onClick={() => void printQR(inv)}
                  style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, border: '0.5px solid rgba(255,255,255,0.1)', background: 'transparent', color: SUB, cursor: 'pointer' }}>
                  제품 QR 출력
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                <div style={{ background: '#fff', borderRadius: 6, padding: 6, display: 'inline-block' }}>
                  <QRImage data={qrData(inv)} size={80} />
                  <div style={{ fontSize: 9, color: '#666', textAlign: 'center', marginTop: 3 }}>제품</div>
                </div>
                {invLots.map(lot => (
                  <div key={lot.id} style={{ textAlign: 'center' as const }}>
                    <div style={{ background: '#fff', borderRadius: 6, padding: 6, display: 'inline-block', cursor: 'pointer' }}
                      onClick={() => void printQR(inv, lot)}>
                      <QRImage data={qrData(inv, lot)} size={80} />
                      <div style={{ fontSize: 9, color: '#666', textAlign: 'center', marginTop: 3 }}>
                        {lot.lot_number.slice(-6)}
                      </div>
                    </div>
                    {lot.expires_at && (
                      <div style={{ fontSize: 9, color: 'rgba(229,57,53,0.7)', marginTop: 2 }}>
                        {new Date(lot.expires_at).toLocaleDateString('ko-KR')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
