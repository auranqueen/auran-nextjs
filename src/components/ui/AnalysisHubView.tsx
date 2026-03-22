'use client'

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
    return <div style={{ fontSize: 12, color: 'var(--text3)' }}>불러오는 중...</div>
  }

  return (
    <>
      {profile ? (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 18,
            padding: '16px 16px',
            marginBottom: 14,
            boxShadow: '0 8px 28px rgba(0,0,0,0.2)',
          }}
        >
          <div style={{ fontSize: 10, letterSpacing: '0.14em', color: 'var(--text3)', marginBottom: 8, fontWeight: 700 }}>
            MY SKIN PROFILE
          </div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{profile.name || '사용자'}</div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 1.75 }}>
            피부 타입: <span style={{ color: 'var(--gold)', fontWeight: 900 }}>{profile.skin_type || '미설정'}</span>
            <br />
            피부 고민: <span style={{ color: 'rgba(255,255,255,0.92)' }}>{concernsText(profile.skin_concerns)}</span>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 12 }}>
          프로필 정보를 불러올 수 없습니다. 아래에서 바로 분석을 시작할 수 있습니다.
        </div>
      )}

      <div
        style={{
          borderRadius: 18,
          padding: '18px 16px',
          background: 'linear-gradient(145deg, rgba(201,168,76,0.18) 0%, rgba(20,18,14,0.95) 55%)',
          border: '1px solid rgba(201,168,76,0.35)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--gold)', marginBottom: 8 }}>분석 시작</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, marginBottom: 14 }}>
          {`설문 기반 피부 타입 분석 후 맞춤 제품을 추천해 드립니다. 완료 시 ${analysisPoint}P 적립!`}
        </div>
        <button
          type="button"
          onClick={onStartAnalysis}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 14,
            background: 'linear-gradient(90deg, var(--gold), #e8c88a)',
            border: 'none',
            color: '#0a0a0a',
            fontSize: 14,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(201,168,76,0.25)',
          }}
        >
          피부 분석 시작하기 →
        </button>
      </div>
    </>
  )
}
