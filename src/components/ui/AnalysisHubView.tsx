'use client'

const GOLD = '#C9A96E'
const CARD_BG = 'rgba(255,255,255,0.03)'
const CARD_BORDER = '1px solid rgba(255,255,255,0.07)'
const TEXT_MUTED = 'rgba(255,255,255,0.4)'
const TEXT_DIM = 'rgba(255,255,255,0.25)'

type Profile = {
  name?: string | null
  skin_type?: string | null
  skin_concerns?: unknown
}

type Props = {
  loading: boolean
  profile: Profile | null
  analysisPoint: number
  onStartAnalysis: () => void
}

function concernsText(skin_concerns: unknown): string {
  if (Array.isArray(skin_concerns)) return skin_concerns.join(', ') || '미설정'
  return '미설정'
}

export default function AnalysisHubView({ loading, profile, analysisPoint, onStartAnalysis }: Props) {
  if (loading) {
    return <div style={{ fontSize: 12, color: TEXT_MUTED }}>불러오는 중...</div>
  }

  return (
    <>
      {profile ? (
        <div
          style={{
            background: CARD_BG,
            border: CARD_BORDER,
            borderRadius: 16,
            padding: '14px 16px',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontFamily: 'monospace',
              letterSpacing: '1.5px',
              color: TEXT_DIM,
              marginBottom: 8,
              fontWeight: 400,
            }}
          >
            MY SKIN PROFILE
          </div>
          <div style={{ fontSize: 15, fontWeight: 400, color: 'rgba(255,255,255,0.85)' }}>{profile.name || '사용자'}</div>
          <div style={{ marginTop: 10, fontSize: 12, color: TEXT_MUTED, lineHeight: 1.75 }}>
            피부 타입: <span style={{ color: GOLD, fontWeight: 600 }}>{profile.skin_type || '미설정'}</span>
            <br />
            피부 고민: <span style={{ color: 'rgba(255,255,255,0.78)' }}>{concernsText(profile.skin_concerns)}</span>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12 }}>
          프로필 정보를 불러올 수 없습니다. 아래에서 바로 분석을 시작할 수 있습니다.
        </div>
      )}

      <div
        style={{
          borderRadius: 16,
          padding: '16px 16px',
          background: CARD_BG,
          border: '1px solid rgba(201,169,110,0.28)',
        }}
      >
        <div style={{ fontSize: 9, fontFamily: 'monospace', letterSpacing: '1.5px', color: TEXT_DIM, marginBottom: 6 }}>AI ANALYSIS</div>
        <div style={{ fontSize: 14, fontWeight: 400, color: GOLD, marginBottom: 8 }}>분석 시작</div>
        <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.7, marginBottom: 14 }}>
          {`설문 기반 피부 타입 분석 후 맞춤 제품을 추천해 드립니다. 완료 시 ${analysisPoint}P 적립!`}
        </div>
        <button
          type="button"
          onClick={onStartAnalysis}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 12,
            background: GOLD,
            border: 'none',
            color: '#0D0B09',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(201,169,110,0.22)',
          }}
        >
          피부 분석 시작하기 →
        </button>
      </div>
    </>
  )
}
