'use client'

export type LiveWatchProduct = {
  id: string
  name: string
  thumb_img: string | null
  consumer_price: number | null
  sort_order?: number
}

const PURPLE = '#7B5EA7'
const SUB = '#888888'

const won = (n: number | null) => (n == null ? '' : `${n.toLocaleString('ko-KR')}원`)

export default function LiveWatchProductBar({
  products,
  onOpen,
}: {
  products: LiveWatchProduct[]
  onOpen: () => void
}) {
  if (products.length === 0) return null
  const first = products[0]
  const extra = products.length

  return (
    <div
      style={{
        position: 'absolute',
        left: 8,
        right: 8,
        bottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
        zIndex: 20,
      }}
    >
      <button
        type="button"
        onClick={onOpen}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 10px',
          borderRadius: 12,
          border: 'none',
          background: '#fff',
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        }}
      >
        {first.thumb_img ? (
          <img
            src={first.thumb_img}
            alt=""
            style={{ width: 44, height: 44, aspectRatio: '1/1', borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: '#f5f5f5' }}
          />
        ) : (
          <div style={{ width: 44, height: 44, aspectRatio: '1/1', borderRadius: 8, background: '#f0ecf7', flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {first.name}
          </div>
          <div style={{ fontSize: 11, color: PURPLE, marginTop: 2 }}>{won(first.consumer_price)}</div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: '#eee', flexShrink: 0 }} />
        <div style={{ flexShrink: 0, textAlign: 'center', paddingLeft: 4, minWidth: 40 }}>
          <div style={{ fontSize: 13, color: PURPLE }}>{extra}</div>
          <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>더보기</div>
        </div>
      </button>
    </div>
  )
}