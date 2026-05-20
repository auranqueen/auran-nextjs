'use client'
import { useState, useEffect } from 'react'

export default function Loading() {
  const [cur, setCur] = useState(0)
  const msgs = [
    '달빛기 · 피부가 예민한 시기에요',
    '황금기 · 에너지가 차오르는 중',
    '만개기 · 피부가 가장 빛나는 시간',
    '물들기 · 진정 케어가 필요한 때',
  ]
  const labels = ['달빛기','황금기','만개기','물들기']

  useEffect(() => {
    const t = setInterval(() => setCur(c => (c + 1) % 4), 1800)
    return () => clearInterval(t)
  }, [])

  const darkBase = 'rgba(26,10,62,0.9)'

  const moons = [
    <svg key={0} width="52" height="52" viewBox="0 0 52 52">
      <defs>
        <mask id="m0"><circle cx="26" cy="26" r="22" fill="white"/><circle cx="16" cy="26" r="19" fill="black"/></mask>
        <radialGradient id="yg0" cx="80%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#FFEE40"/><stop offset="60%" stopColor="#FFD700"/><stop offset="100%" stopColor="#B07800"/>
        </radialGradient>
      </defs>
      <circle cx="26" cy="26" r="22" fill={darkBase}/>
      <circle cx="26" cy="26" r="22" fill="url(#yg0)" mask="url(#m0)"/>
      <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,215,0,0.35)" strokeWidth="0.8"/>
    </svg>,
    <svg key={1} width="52" height="52" viewBox="0 0 52 52">
      <defs>
        <mask id="m1"><circle cx="26" cy="26" r="22" fill="white"/><rect x="0" y="0" width="26" height="52" fill="black"/></mask>
        <radialGradient id="yg1" cx="70%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#FFEE40"/><stop offset="50%" stopColor="#FFD700"/><stop offset="100%" stopColor="#B07800"/>
        </radialGradient>
      </defs>
      <circle cx="26" cy="26" r="22" fill={darkBase}/>
      <circle cx="26" cy="26" r="22" fill="url(#yg1)" mask="url(#m1)"/>
      <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,215,0,0.35)" strokeWidth="0.8"/>
    </svg>,
    <svg key={2} width="52" height="52" viewBox="0 0 52 52">
      <defs>
        <clipPath id="cp2"><circle cx="26" cy="26" r="22"/></clipPath>
        <radialGradient id="yg2" cx="42%" cy="38%" r="65%">
          <stop offset="0%" stopColor="#FFF880"/><stop offset="35%" stopColor="#FFD700"/>
          <stop offset="75%" stopColor="#CC9200"/><stop offset="100%" stopColor="#996000"/>
        </radialGradient>
      </defs>
      <g clipPath="url(#cp2)"><circle cx="26" cy="26" r="22" fill="url(#yg2)"/></g>
      <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,215,0,0.6)" strokeWidth="0.8"/>
    </svg>,
    <svg key={3} width="52" height="52" viewBox="0 0 52 52">
      <defs>
        <mask id="m3"><circle cx="26" cy="26" r="22" fill="white"/><circle cx="36" cy="26" r="19" fill="black"/></mask>
        <radialGradient id="gg3" cx="20%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#E8DEC8"/><stop offset="55%" stopColor="#B8B09A"/><stop offset="100%" stopColor="#807060"/>
        </radialGradient>
        <clipPath id="cp3"><circle cx="26" cy="26" r="22"/></clipPath>
      </defs>
      <circle cx="26" cy="26" r="22" fill={darkBase}/>
      <circle cx="26" cy="26" r="22" fill="url(#gg3)" mask="url(#m3)"/>
      <g clipPath="url(#cp3)">
        <circle cx="32" cy="18" r="2.8" fill="rgba(40,34,52,0.8)"/>
        <circle cx="20" cy="24" r="2.1" fill="rgba(40,34,52,0.8)"/>
        <circle cx="30" cy="32" r="2.4" fill="rgba(40,34,52,0.8)"/>
        <circle cx="19" cy="33" r="1.6" fill="rgba(40,34,52,0.8)"/>
        <circle cx="35" cy="26" r="1.5" fill="rgba(40,34,52,0.8)"/>
      </g>
      <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(123,94,167,0.5)" strokeWidth="0.8"/>
    </svg>,
  ]

  const stars = [
    {top:'8%',left:'12%',s:'1.2px',d:'2.1s',dl:'0s'},
    {top:'5%',left:'28%',s:'0.8px',d:'3.1s',dl:'0.4s'},
    {top:'12%',left:'45%',s:'1px',d:'2.5s',dl:'0.8s'},
    {top:'4%',left:'62%',s:'1.2px',d:'3.4s',dl:'0.2s'},
    {top:'9%',left:'78%',s:'0.9px',d:'2.8s',dl:'1s'},
    {top:'15%',left:'90%',s:'1px',d:'2.2s',dl:'0.6s'},
    {top:'20%',left:'6%',s:'0.8px',d:'3.6s',dl:'1.2s'},
    {top:'18%',left:'55%',s:'1.1px',d:'2.9s',dl:'0.3s'},
    {top:'7%',left:'38%',s:'0.9px',d:'3.2s',dl:'0.9s'},
    {top:'22%',left:'82%',s:'1px',d:'2.4s',dl:'1.5s'},
  ]

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'linear-gradient(180deg,#0d0820 0%,#1a0a3e 40%,#2d1060 70%,#1a0a2e 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      zIndex: 9999,
      overflow: 'hidden',
    }}>
      {/* 별 */}
      {stars.map((s,i) => (
        <div key={i} style={{
          position:'absolute',
          width:s.s, height:s.s,
          top:s.top, left:s.left,
          borderRadius:'50%',
          background:'#e8d5ff',
          animation:`twinkle ${s.d} infinite ${s.dl}`,
        }}/>
      ))}
      {/* 하단 안개 */}
      <div style={{position:'absolute',bottom:0,left:0,right:0,height:120,background:'linear-gradient(0deg,rgba(45,16,96,0.6),transparent)',pointerEvents:'none'}}/>

      <div style={{fontSize:22,letterSpacing:8,color:'#C9A96E',position:'relative',zIndex:2}}>AURAN</div>
      <div style={{fontSize:10,color:'rgba(232,213,255,0.35)',letterSpacing:'1.5px',position:'relative',zIndex:2}}>내 피부 주기를 읽는 중</div>

      <div style={{display:'flex',alignItems:'center',gap:4,position:'relative',zIndex:2}}>
        {moons.map((moon, i) => (
          <div key={i} style={{display:'flex',alignItems:'center',gap:4}}>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8,opacity:cur===i?1:cur>i?0.45:0.18,transition:'opacity 0.8s'}}>
              {moon}
              <div style={{fontSize:9,color:cur===i?'#FFD700':'rgba(232,213,255,0.3)',letterSpacing:'0.5px',transition:'color 0.8s'}}>
                {labels[i]}
              </div>
            </div>
            {i < 3 && <div style={{width:12,height:1,background:'rgba(232,213,255,0.15)',marginBottom:17}}/>}
          </div>
        ))}
      </div>

      <div style={{fontSize:11,color:'rgba(255,215,0,0.85)',letterSpacing:'0.5px',minHeight:15,position:'relative',zIndex:2}}>
        {msgs[cur]}
      </div>

      <div style={{width:190,height:1.5,background:'rgba(232,213,255,0.1)',borderRadius:1,overflow:'hidden',position:'relative',zIndex:2}}>
        <div style={{height:'100%',background:'linear-gradient(90deg,#7B5EA7,#FFD700)',borderRadius:1,width:`${(cur+1)/4*100}%`,transition:'width 0.8s ease'}}/>
      </div>

      <style>{`@keyframes twinkle{0%,100%{opacity:0.2}50%{opacity:0.8}}`}</style>
    </div>
  )
}
