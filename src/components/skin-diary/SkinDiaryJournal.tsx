'use client'
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

type Props = {
  supabase: SupabaseClient
  userId: string
}

export default function SkinDiaryJournal({ supabase, userId }: Props) {
  const [logs, setLogs] = useState<any[]>([])

  useEffect(() => {
    if (!userId) return
    supabase
      .from('daily_skin_log')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(14)
      .then(({ data }) => setLogs(data || []))
  }, [userId])

  return (
    <div style={{ padding: '0 0 16px' }}>
      <div style={{ background: 'rgba(123,94,167,0.08)', border: '1px solid rgba(123,94,167,0.2)', borderRadius: 14, padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#c4a7e7', marginBottom: 10 }}>이번 주 피부 요약</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: '평균 수분', value: logs.length ? Math.round(logs.slice(0,7).reduce((a,l)=>a+(l.water||0),0)/Math.max(1,logs.slice(0,7).length)*10)/10+'잔' : '-' },
            { label: '평균 수면', value: logs.length ? Math.round(logs.slice(0,7).reduce((a,l)=>a+(l.sleep_hours||0),0)/Math.max(1,logs.slice(0,7).length)*10)/10+'h' : '-' },
            { label: '연속 기록', value: logs.length+'일' },
          ].map((s,i) => (
            <div key={i} style={{ flex:1, background:'rgba(255,255,255,0.04)', borderRadius:10, padding:'10px', textAlign:'center' }}>
              <div style={{ fontSize:16, color:'#fff', fontWeight:500 }}>{s.value}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>최근 기록</div>
      {logs.length === 0 ? (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0' }}>아직 기록이 없어요. 오늘 첫 기록을 남겨보세요 💜</div>
      ) : logs.map((log, i) => (
        <div key={i} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:12, padding:'10px 12px', marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', minWidth:50 }}>{log.date}</div>
          <div style={{ display:'flex', gap:4 }}>
            {(log.skin_status||[]).map((s:string,j:number) => <span key={j} style={{ fontSize:12 }}>{s==='열감'?'🔥':s==='건조'?'💧':s==='트러블'?'😤':s==='붓기'?'🌊':'✨'}</span>)}
          </div>
          <div style={{ flex:1, fontSize:11, color:'rgba(255,255,255,0.55)' }}>{log.memo||''}</div>
        </div>
      ))}

      <div style={{ marginTop:14, padding:'12px 14px', background:'rgba(201,169,110,0.08)', border:'1px solid rgba(201,169,110,0.2)', borderRadius:14, textAlign:'center' }}>
        <div style={{ fontSize:12, color:'#C9A96E' }}>7일 연속 달성 시 500T 적립</div>
        <div style={{ fontSize:10, color:'rgba(201,169,110,0.5)', marginTop:4 }}>꾸준히 기록하면 피부가 달라져요 💜</div>
      </div>
    </div>
  )
}
