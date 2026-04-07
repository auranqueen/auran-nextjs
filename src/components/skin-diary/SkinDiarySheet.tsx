'use client'
import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import CalendarSection from '@/components/CalendarSection'
import SkinDiaryJournal from './SkinDiaryJournal'

type Props = {
  open: boolean
  onClose: () => void
  supabase: SupabaseClient
  userId: string
  hormoneCycle: any
  hormoneTrack: string
  skinRecList: any[]
  cycleType: string | null
}

const GOLD = '#C9A96E'
const PURPLE = '#7B5EA7'

const SLEEP_OPTS = [['4시간\n이하','😵'],['5시간','😪'],['6시간','😐'],['7시간','🙂'],['8시간\n이상','😊']]
const UV_OPTS = [['실내만','🏠'],['30분 이하','🌤'],['1~2시간','☀️'],['2시간+','🔥']]
const STRESS_OPTS = [['여유로워요','😌'],['보통이에요','🙂'],['좀 바빴어요','😅'],['힘들었어요','😓'],['너무 힘들었어요','😫']]
const SKIN_OPTS = [['열감','🔥'],['건조','💧'],['트러블','😤'],['붓기','🌊'],['좋아요','✨']]
const SAVE_MSGS = ['오늘도 내 피부를 잘 챙겼어요 💜','기록이 쌓일수록 피부가 좋아져요 🌸','오늘 하루도 수고하셨어요 ✨','내 피부가 고마워하고 있어요 💎']

export default function SkinDiarySheet({ open, onClose, supabase, userId, hormoneCycle, hormoneTrack, skinRecList, cycleType }: Props) {
  const [tab, setTab] = useState(0)
  const [water, setWater] = useState(0)
  const [sleep, setSleep] = useState(-1)
  const [uv, setUv] = useState(-1)
  const [stress, setStress] = useState(-1)
  const [skins, setSkins] = useState<string[]>([])
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  if (!open) return null

  const toggleSkin = (s: string) => setSkins(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev, s])
  const ready = water > 0 && sleep >= 0 && uv >= 0 && stress >= 0 && skins.length > 0

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })

  const onSave = async () => {
    if (!ready || saving || !userId) return
    setSaving(true)
    await supabase.from('daily_skin_log').upsert({
      user_id: userId,
      date: today,
      water,
      sleep_hours: sleep + 4,
      uv_exposure: uv,
      stress_level: stress,
      skin_status: skins,
      memo,
    }, { onConflict: 'user_id,date' })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const TAB_LABELS = ['오늘 상태', '마법 캘린더', '피부 일지']

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'flex-end', justifyContent:'center', backdropFilter:'blur(6px)' }}
      onClick={onClose}>
      <div style={{ width:'100%', maxWidth:480, background:'#13111a', borderRadius:'28px 28px 0 0', maxHeight:'90vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>

        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 0' }}>
          <div style={{ width:40, height:4, borderRadius:2, background:'rgba(255,255,255,0.18)' }} />
        </div>

        <div style={{ padding:'0 20px', display:'flex', justifyContent:'space-between', alignItems:'center', margin:'12px 0 16px' }}>
          <div>
            <div style={{ fontSize:16, color:'#fff' }}>오늘의 피부 다이어리</div>
            <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>{new Date().toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' })}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:22, cursor:'pointer' }}>×</button>
        </div>

        <div style={{ display:'flex', padding:'0 20px', gap:6, marginBottom:16 }}>
          {TAB_LABELS.map((label,i) => (
            <button key={i} onClick={() => setTab(i)} style={{ flex:1, padding:'8px 4px', borderRadius:12, border:'none', cursor:'pointer', fontSize:12, background: tab===i ? PURPLE : 'rgba(255,255,255,0.05)', color: tab===i ? '#fff' : 'rgba(255,255,255,0.5)' }}>{label}</button>
          ))}
        </div>

        <div style={{ padding:'0 20px 32px' }}>
          {tab === 0 && (
            <div>
              {saved && <div style={{ background:'rgba(123,94,167,0.2)', border:'1px solid rgba(123,94,167,0.4)', borderRadius:12, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#c4a7e7', textAlign:'center' }}>{SAVE_MSGS[Math.floor(Math.random()*SAVE_MSGS.length)]}</div>}

              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8 }}>물 마시기 <span style={{ color:GOLD }}>{water}/8잔</span></div>
                <div style={{ display:'flex', gap:6 }}>
                  {Array.from({length:8},(_,i) => (
                    <div key={i} onClick={() => setWater(i < water ? i : i+1)} style={{ cursor:'pointer', fontSize:20, opacity: i < water ? 1 : 0.2 }}>💧</div>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8 }}>수면 시간</div>
                <div style={{ display:'flex', gap:6 }}>
                  {SLEEP_OPTS.map((o,i) => (
                    <button key={i} onClick={() => setSleep(i)} style={{ flex:1, background: sleep===i ? 'rgba(123,94,167,0.25)' : 'rgba(255,255,255,0.04)', border: sleep===i ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.1)', borderRadius:12, color: sleep===i ? '#c4a7e7' : 'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:11, padding:'8px 4px', textAlign:'center' }}>
                      <div style={{ fontSize:16 }}>{o[1]}</div>
                      <div style={{ marginTop:4, whiteSpace:'pre-line' }}>{o[0]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8 }}>햇빛 노출</div>
                <div style={{ display:'flex', gap:6 }}>
                  {UV_OPTS.map((o,i) => (
                    <button key={i} onClick={() => setUv(i)} style={{ flex:1, background: uv===i ? 'rgba(123,94,167,0.25)' : 'rgba(255,255,255,0.04)', border: uv===i ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.1)', borderRadius:12, color: uv===i ? '#c4a7e7' : 'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:11, padding:'8px 4px', textAlign:'center' }}>
                      <div style={{ fontSize:16 }}>{o[1]}</div>
                      <div style={{ marginTop:4 }}>{o[0]}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8 }}>오늘 하루</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {STRESS_OPTS.map((o,i) => (
                    <button key={i} onClick={() => setStress(i)} style={{ background: stress===i ? 'rgba(123,94,167,0.2)' : 'rgba(255,255,255,0.04)', border: stress===i ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.1)', borderRadius:20, color: stress===i ? '#c4a7e7' : 'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:11, padding:'6px 12px' }}>{o[1]} {o[0]}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8 }}>오늘 피부 상태</div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {SKIN_OPTS.map((o,i) => (
                    <button key={i} onClick={() => toggleSkin(o[0])} style={{ background: skins.includes(o[0]) ? 'rgba(123,94,167,0.2)' : 'rgba(255,255,255,0.04)', border: skins.includes(o[0]) ? '1px solid #7B5EA7' : '1px solid rgba(255,255,255,0.1)', borderRadius:20, color: skins.includes(o[0]) ? '#c4a7e7' : 'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:11, padding:'6px 12px' }}>{o[1]} {o[0]}</button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginBottom:8 }}>한 줄 메모</div>
                <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="오늘 피부 한마디..." style={{ width:'100%', boxSizing:'border-box', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(123,94,167,0.2)', borderRadius:10, padding:'10px 12px', color:'#fff', fontSize:13, outline:'none' }} />
              </div>

              <button onClick={onSave} disabled={!ready || saving} style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', cursor: ready ? 'pointer' : 'default', fontSize:14, background: ready ? PURPLE : 'rgba(255,255,255,0.06)', color: ready ? '#fff' : 'rgba(255,255,255,0.25)' }}>
                {saving ? '저장 중...' : '저장하기'}
              </button>
            </div>
          )}

          {tab === 1 && (
            <CalendarSection
              supabase={supabase}
              myUserId={userId}
              hormoneCycle={hormoneCycle}
              hormoneTrack={hormoneTrack}
              skinRecList={skinRecList}
              cycleType={cycleType}
            />
          )}

          {tab === 2 && (
            <SkinDiaryJournal supabase={supabase} userId={userId} />
          )}
        </div>
      </div>
    </div>
  )
}
