export default function OrderCompletePage() {
  return (
    <div style={{
      minHeight:'100vh',
      background:'#0D0B09',
      display:'flex',
      flexDirection:'column',
      alignItems:'center',
      justifyContent:'center',
      color:'#fff',
      fontFamily:'sans-serif'
    }}>
      <div style={{fontSize:48,marginBottom:16}}>✅</div>
      <div style={{fontSize:11,letterSpacing:'0.2em',color:'#C9A96E',marginBottom:8}}>ORDER COMPLETE</div>
      <div style={{fontSize:24,marginBottom:8}}>결제가 완료됐어요</div>
      <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:32}}>
        1~3 영업일 내 배송 출발 예정이에요
      </div>
      <div style={{display:'flex',gap:8}}>
        <a href="/" style={{
          padding:'14px 24px',
          background:'rgba(255,255,255,0.05)',
          border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:10,color:'rgba(255,255,255,0.6)',
          fontSize:13,textDecoration:'none'
        }}>홈으로</a>
        <a href="/" style={{
          padding:'14px 24px',
          background:'#C9A96E',
          border:'none',
          borderRadius:10,color:'#1a1000',
          fontSize:13,fontWeight:700,textDecoration:'none'
        }}>계속 쇼핑</a>
      </div>
    </div>
  )
}

