'use client'
import { BORDER, GOLD, PURPLE, SUB, TEXT, toDateStr, type DateMarks } from './liveUtils'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const NAV_BTN = { width: 28, height: 28, borderRadius: 8, border: `1px solid ${BORDER}`, background: '#fff', color: TEXT, fontSize: 14, cursor: 'pointer', padding: 0 } as const

interface Props {
  year: number
  month: number
  marks: DateMarks
  selectedDate: string | null
  today: string
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onPick: (date: string) => void
}

function buildCells(year: number, month: number) {
  const offset = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const cells: (string | null)[] = Array.from({ length: offset }, () => null)
  for (let d = 1; d <= days; d++) cells.push(toDateStr(new Date(year, month, d)))
  return cells
}

export default function LiveMiniCalendar({ year, month, marks, selectedDate, today, onPrev, onNext, onToday, onPick }: Props) {
  const cells = buildCells(year, month)
  const isThisMonth = today.startsWith(toDateStr(new Date(year, month, 1)).slice(0, 7))

  return (
    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: 12, marginBottom: 16, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <button type="button" aria-label="이전 달" onClick={onPrev} style={NAV_BTN}>‹</button>
        <div style={{ fontSize: 13, color: TEXT, minWidth: 84, textAlign: 'center' }}>{year}년 {month + 1}월</div>
        <button type="button" aria-label="다음 달" onClick={onNext} style={NAV_BTN}>›</button>
        <button
          type="button"
          onClick={onToday}
          disabled={isThisMonth}
          style={{ marginLeft: 'auto', fontSize: 11, padding: '4px 10px', borderRadius: 12, border: `1px solid ${GOLD}`, background: '#fff', color: GOLD, cursor: isThisMonth ? 'default' : 'pointer', opacity: isThisMonth ? 0.5 : 1 }}
        >
          오늘
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={w} style={{ textAlign: 'center', fontSize: 10, color: i === 0 ? '#e57373' : SUB }}>{w}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 2 }}>
        {cells.map((date, i) => {
          if (!date) return <div key={`blank-${i}`} />
          const mark = marks[date]
          const isPast = date < today
          const disabled = isPast && !mark
          const isSelected = selectedDate === date
          const isToday = date === today
          const color = isSelected ? '#fff' : disabled ? '#cccccc' : isToday ? GOLD : TEXT
          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => onPick(date)}
              aria-label={`${Number(date.slice(5, 7))}월 ${Number(date.slice(8, 10))}일`}
              style={{ height: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, background: 'none', border: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer' }}
            >
              <span
                style={{
                  width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color, boxSizing: 'border-box',
                  background: isSelected ? GOLD : 'transparent',
                  border: mark?.upcoming && !isSelected ? `1.5px solid ${GOLD}` : '1.5px solid transparent',
                }}
              >
                {Number(date.slice(8, 10))}
              </span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: mark?.past ? PURPLE : 'transparent' }} />
            </button>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 10, color: SUB }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', border: `1.5px solid ${GOLD}`, marginRight: 4, verticalAlign: 'middle' }} />예정</span>
        <span><span style={{ display: 'inline-block', width: 5, height: 5, borderRadius: '50%', background: PURPLE, marginRight: 4, verticalAlign: 'middle' }} />지난 방송</span>
        <span style={{ marginLeft: 'auto' }}>빈 날을 누르면 방송 만들기</span>
      </div>
    </div>
  )
}
