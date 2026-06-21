const BG = '#0D0B09'
const SURFACE = 'rgba(255,255,255,0.08)'
const CARD = 'rgba(255,255,255,0.05)'

function Bone({ h, w = '100%', r = 8, mb = 0 }: { h: number; w?: string | number; r?: number; mb?: number }) {
  return (
    <div
      style={{
        height: h,
        width: w,
        borderRadius: r,
        background: SURFACE,
        marginBottom: mb,
        animation: 'salonSkPulse 1.2s ease-in-out infinite',
      }}
    />
  )
}

export default function SalonLoading() {
  return (
    <div style={{ minHeight: '100vh', background: BG, paddingBottom: 80 }}>
      <style>{`@keyframes salonSkPulse{0%,100%{opacity:.45}50%{opacity:.9}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px' }}>
        <Bone h={24} w={24} r={12} />
        <Bone h={16} w={120} />
        <Bone h={24} w={24} r={12} />
      </div>
      <Bone h={180} w="100%" r={0} mb={16} />
      <div style={{ padding: '0 16px' }}>
        <Bone h={20} w="70%" mb={8} />
        <Bone h={12} w="50%" mb={12} />
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Bone h={28} w={64} r={20} />
          <Bone h={28} w={64} r={20} />
          <Bone h={28} w={64} r={20} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          <Bone h={44} w="33%" r={10} />
          <Bone h={44} w="33%" r={10} />
          <Bone h={44} w="33%" r={10} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <Bone h={14} w={72} />
          <Bone h={14} w={72} />
          <Bone h={14} w={72} />
        </div>
        <div style={{ background: CARD, borderRadius: 12, padding: 14, marginBottom: 12 }}>
          <Bone h={14} w="80%" mb={8} />
          <Bone h={12} w="90%" />
        </div>
        {[1, 2, 3].map((k) => (
          <div key={k} style={{ background: CARD, borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <Bone h={16} w="55%" mb={8} />
            <Bone h={12} w="85%" mb={6} />
            <Bone h={12} w="40%" mb={10} />
            <Bone h={36} w={72} r={8} />
          </div>
        ))}
      </div>
    </div>
  )
}
