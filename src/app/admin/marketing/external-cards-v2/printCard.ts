type ProductRow = { id: string; name: string; brand: string; orig: number; custom: number; usage: string; reviewTextRate: number; reviewPhotoRate: number; reviewVideoRate: number }

export type PrintCardParams = {
  name: string
  products: ProductRow[]
  totalAmount: number
  giftItems: { label: string; threshold: number; items: string }[]
  bundleProds: { name: string; tip: string }[]
  sampleProds: { name: string; tip: string }[]
  courier: string
  trackingNo: string
  shippedAt: string
  arrivalAt: string
  amRoutine: string
  pmRoutine: string
  tip: string
}

export function printCard({ name, products, totalAmount, giftItems, bundleProds, sampleProds, courier, trackingNo, shippedAt, arrivalAt, amRoutine, pmRoutine, tip }: PrintCardParams) {
    const qrBase = 'https://api.qrserver.com/v1/create-qr-code/?size=80x80&data='
    const qrJoin = qrBase + encodeURIComponent('https://auran.kr/join?ref=care_card')
    const qrChat = qrBase + encodeURIComponent('https://auran.kr/chat?ref=care_card')
    const qrReview = qrBase + encodeURIComponent('https://auran.kr/store-review?ref=care_card')
    const productList = products.map(p => `
      <tr>
        <td>${p.name}${p.usage ? `<div style="font-size:9px;color:#7B5EA7;margin-top:2px;">✦ ${p.usage}</div>` : ''}</td>
        <td style="text-align:right;white-space:nowrap">₩${p.custom.toLocaleString()}</td>
      </tr>`).join('')
    const storeReviewToast =
      totalAmount >= 500000 ? 10000 :
      totalAmount >= 200000 ? 5000 :
      totalAmount >= 100000 ? 2000 : 1000
    const reviewToastRows = `<tr>
      <td colspan="2" style="font-size:11px;color:#555;padding:4px 0">
        구매 합산금액 기준 리뷰 토스트
      </td>
    </tr>
    <tr>
      <td style="font-size:11px;color:#888">합산 ${totalAmount.toLocaleString()}원</td>
      <td style="text-align:center;font-size:12px;color:#C9A96E;font-weight:500">${storeReviewToast.toLocaleString()}T</td>
    </tr>`
    const activeGifts = giftItems.filter(g => g.items.trim() && totalAmount >= g.threshold)
    const giftSection = activeGifts.length > 0 ? `
      <div class="sec">
        <div class="sec-title">💝 금액별 선물</div>
        ${activeGifts.map(g => `<div style="padding:4px 0;font-size:11px;border-bottom:0.5px solid #f5efe8"><span style="color:#C9A96E;font-size:10px">${g.label}</span> ${g.items}</div>`).join('')}
      </div>` : ''
    const bundleSection = bundleProds.length > 0 ? `
      <div class="sec">
        <div class="sec-title">✨ 함께 쓰면 좋은 제품</div>
        ${bundleProds.map(b => `<div style="padding:4px 0;font-size:11px;border-bottom:0.5px solid #f5efe8">${b.name}${b.tip ? `<span style="color:#7B5EA7;font-size:10px;margin-left:6px">${b.tip}</span>` : ''}</div>`).join('')}
      </div>` : ''
    const sampleSection = sampleProds.length > 0 ? `
      <div class="sec">
        <div class="sec-title">🎁 동봉 샘플</div>
        ${sampleProds.map(s => `<div style="padding:4px 0;font-size:11px;border-bottom:0.5px solid #f5efe8">${s.name}${s.tip ? `<span style="color:#7B5EA7;font-size:10px;margin-left:6px">${s.tip}</span>` : ''}</div>`).join('')}
      </div>` : ''
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AURAN 케어카드</title>
<style>
@media print{@page{size:A4;margin:8mm 10mm}html,body{height:100%;overflow:hidden!important}.no-print{display:none!important}body{font-size:9px!important;transform-origin:top left;transform:scale(0.9)}.hdr{padding-bottom:3px!important;margin-bottom:4px!important}.greeting{margin-bottom:4px!important}.sec{margin-bottom:4px!important}.join{margin-bottom:4px!important;padding:6px 8px!important}.ot{margin-bottom:4px!important;padding:6px 8px!important}.review{margin-bottom:4px!important;padding:6px 8px!important}.delivery{margin-bottom:4px!important;padding:6px 8px!important}table th,table td{padding:2px 4px!important}.qr-img{width:50px!important;height:50px!important}img[width="54"]{width:44px!important;height:44px!important}img[width="48"]{width:40px!important;height:40px!important}img[width="40"]{width:34px!important;height:34px!important}}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#111;font-size:11px;line-height:1.5;padding:16px 20px;max-width:780px;margin:0 auto;}
.hdr{text-align:center;padding-bottom:6px;border-bottom:1px solid #C9A96E;margin-bottom:8px}
.logo{font-family:Georgia,serif;font-size:20px;letter-spacing:.35em;color:#7B5EA7;font-style:italic}
.hdr-sub{font-size:10px;color:#999;margin-top:3px}
.greeting{background:#f9f6ff;border-left:3px solid #7B5EA7;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:14px;font-size:10px;color:#534AB7;line-height:1.7}
.greeting strong{color:#2a1f3d;font-size:12px}
.sec{margin-bottom:8px}
.sec-title{font-size:10px;letter-spacing:.15em;color:#C9A96E;border-bottom:.5px solid #eee;padding-bottom:5px;margin-bottom:8px}
table{width:100%;border-collapse:collapse;font-size:11px}
th{background:#f9f6ff;color:#7B5EA7;font-weight:400;padding:7px 8px;text-align:left;border-bottom:.5px solid #e0d8f0;font-size:10px}
td{padding:7px 8px;border-bottom:.5px solid #f0edf8}
.total{text-align:right;font-size:12px;color:#7B5EA7;padding-top:8px;border-top:1px solid #C9A96E;margin-top:6px}
.delivery{background:#f9f6ff;border-radius:6px;padding:9px 12px;margin-bottom:14px;display:flex;gap:20px;font-size:11px}
.d-label{font-size:9px;color:#999;margin-bottom:2px}
.routine-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px}
.routine-box{background:#f9f6ff;border-radius:6px;padding:8px 10px}
.routine-time{font-size:9px;letter-spacing:.15em;color:#9B7EC8;margin-bottom:4px}
.routine-step{font-size:10px;color:#534AB7;line-height:1.8;white-space:pre-wrap}
.tip-text{font-size:10px;color:#534AB7;line-height:1.7;border-top:.5px solid #eee;padding-top:8px;margin-top:4px}
.join{background:#fff;color:#111;border:1px solid #2D5A3D;border-radius:8px;padding:12px 16px;display:flex;flex-direction:column;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}
.j-eye{font-size:9px;letter-spacing:.12em;color:#C9A96E;margin-bottom:4px}
.j-copy{font-family:Georgia,serif;font-size:12px;color:#fff;font-style:italic;line-height:1.4;margin-bottom:4px}
.j-sub{font-size:9px;color:rgba(255,255,255,.35);margin-bottom:6px}
.j-pill{font-size:9px;color:rgba(255,255,255,.6);display:flex;align-items:center;gap:4px;margin-bottom:3px}
.j-dot{width:2px;height:2px;border-radius:50%;background:#C9A96E;display:inline-block}
.qr{width:54px;height:54px;background:#fff;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#7B5EA7;text-align:center;padding:3px;flex-shrink:0}
.ot{border:.5px solid rgba(123,94,167,.3);border-radius:8px;overflow:hidden;margin-bottom:8px}
.ot-head{background:#7B5EA7;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;gap:10px}
.ot-title{font-family:Georgia,serif;font-size:13px;color:#fff;line-height:1.35}
.ot-title em{font-style:italic;color:#FAE8C0}
.ot-sub{font-size:9px;color:rgba(255,255,255,.5);margin-top:3px}
.bubbles{display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0}
.bq{font-size:9px;padding:4px 8px;border-radius:8px 8px 2px 8px;background:rgba(255,255,255,.15);color:rgba(255,255,255,.85);max-width:100px;line-height:1.4;text-align:right}
.ba{font-size:9px;padding:4px 8px;border-radius:8px 8px 8px 2px;background:#FAE8C0;color:#3d2a00;max-width:100px;line-height:1.4}
.ot-body{background:#f3effa;padding:11px 14px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.steps{display:flex;flex-direction:column;gap:5px}
.step{display:flex;align-items:center;gap:6px;font-size:9px;color:#4a3d6a}
.snum{width:16px;height:16px;border-radius:50%;background:#7B5EA7;color:#fff;font-size:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ot-hint{font-size:9px;color:#9B7EC8;padding-left:22px;margin-top:2px}
.ot-qr{width:48px;height:48px;background:#fff;border:.5px solid rgba(123,94,167,.2);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#7B5EA7;text-align:center;padding:3px;flex-shrink:0}
.ot-free{font-size:8px;padding:2px 7px;border-radius:10px;background:rgba(123,94,167,.12);color:#7B5EA7;text-align:center;margin-top:3px}
.review{border:1px solid rgba(201,169,110,.3);border-radius:8px;padding:9px 13px;display:flex;justify-content:space-between;align-items:center;gap:10px}
.rv-title{font-size:10px;color:#2a1f3d;margin-bottom:2px}
.rv-sub{font-size:9px;color:#999;line-height:1.5;margin-bottom:4px}
.rv-pill{font-size:9px;padding:2px 6px;border-radius:8px;background:#f9f6ff;color:#7B5EA7;border:.5px solid rgba(123,94,167,.2);margin-right:4px}
.rv-qr{width:40px;height:40px;background:#f9f6ff;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#7B5EA7;text-align:center;flex-shrink:0}
.footer{text-align:right;font-size:9px;color:#ccc;margin-top:10px}
</style></head><body>
<div style="position:fixed;top:12px;right:16px;z-index:999;display:flex;gap:8px;" class="no-print">
  <button onclick="window.print()" style="padding:8px 20px;background:#7B5EA7;color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;">🖨️ 인쇄하기</button>
  <button onclick="window.close()" style="padding:8px 16px;background:#f5f5f5;color:#666;border:1px solid #ddd;border-radius:8px;font-size:13px;cursor:pointer;">닫기</button>
</div>
<div class="hdr"><div class="logo">A U R A N</div><div class="hdr-sub">스킨파우더룸 · 맑원장 피부 케어 가이드</div></div>
<div class="greeting"><strong>${name}님, 소중한 구매 감사드려요 💜</strong><br>맑원장이 직접 이 제품 쓰는 방법을 알려드릴게요. 쓰다가 모르는 게 생기면 바로 물어봐요.</div>
${products.length ? `<div class="sec"><div class="sec-title">✦ 구매하신 제품</div><table><thead><tr><th>상품명</th><th style="text-align:right">금액</th></tr></thead><tbody>${productList}</tbody></table><div class="total">합계 <strong>₩${totalAmount.toLocaleString()}</strong></div>${(courier || trackingNo) ? `<div style="font-size:9px;color:#888;margin-top:4px;padding-top:4px;border-top:0.5px solid #eee;">${courier ? `${courier}` : ''}${trackingNo ? ` · 송장 ${trackingNo}` : ''}${shippedAt ? ` · 발송 ${shippedAt}` : ''}${arrivalAt ? ` · 도착예정 ${arrivalAt}` : ''}</div>` : ''}</div>` : ''}
${giftSection}${bundleSection}${sampleSection}
${(amRoutine || pmRoutine || tip) ? `<div class="sec"><div class="sec-title">✦ 맞춤 사용 루틴</div><div class="routine-grid">${amRoutine ? `<div class="routine-box"><div class="routine-time">AM · 아침</div><div class="routine-step">${amRoutine}</div></div>` : ''}${pmRoutine ? `<div class="routine-box"><div class="routine-time">PM · 저녁</div><div class="routine-step">${pmRoutine}</div></div>` : ''}</div>${tip ? `<div class="tip-text">💜 ${tip}</div>` : ''}</div>` : ''}
<div class="join"><div style="display:flex;gap:10px;align-items:flex-start;"><div style="flex:1;"><div style="font-size:11px;font-weight:600;color:#2D5A3D;margin-bottom:4px;">생리 10일 전, 피부가 가장 뒤집힐 확률 87%</div><div style="font-size:8px;color:#555;margin-bottom:6px;">같은 제품도 호르몬 주기에 따라 효과가 완전히 달라져요.</div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:6px;"><div style="background:#f0f7f3;border-radius:4px;padding:4px 5px;text-align:center;"><div style="font-size:7px;color:#C9A96E;">달빛기</div><div style="font-size:7px;color:#888;">생리중~직후</div><div style="font-size:8px;color:#2D5A3D;margin-top:2px;">진정</div></div><div style="background:#f0f7f3;border-radius:4px;padding:4px 5px;text-align:center;"><div style="font-size:7px;color:#C9A96E;">황금기</div><div style="font-size:7px;color:#888;">생리후 7~10일</div><div style="font-size:8px;color:#2D5A3D;margin-top:2px;">영양·미백</div></div><div style="background:#f0f7f3;border-radius:4px;padding:4px 5px;text-align:center;"><div style="font-size:7px;color:#C9A96E;">만개기</div><div style="font-size:7px;color:#888;">배란기</div><div style="font-size:8px;color:#2D5A3D;margin-top:2px;">모공·유분</div></div><div style="background:#f0f7f3;border-radius:4px;padding:4px 5px;text-align:center;"><div style="font-size:7px;color:#C9A96E;">물들기</div><div style="font-size:7px;color:#888;">생리전 7~10일</div><div style="font-size:8px;color:#2D5A3D;margin-top:2px;">트러블예방</div></div></div><div style="font-size:8px;color:#555;line-height:1.6;">AURAN이 내 호르몬 주기를 읽고 오늘 필요한 홈케어를 알려드려요. 💜</div><div style="margin-top:4px;"><div style="font-size:8px;color:#C9A96E;">• 가입 즉시 10,000T 지급</div><div style="font-size:8px;color:#777;">• 내 호르몬 주기 분석 · 맞춤 홈케어 루틴 제공</div></div></div><div style="text-align:center;flex-shrink:0;"><img src="${qrJoin}" width="52" height="52" style="display:block;border-radius:4px;border:1px solid #eee;" /><div style="font-size:7px;color:#888;margin-top:2px;">카카오 가입</div></div></div></div>
<div class="ot"><div class="ot-head"><div><div class="ot-title">제품 쓰다 막히면<br><em>맑원장님께 직접 물어보세요</em></div><div class="ot-sub">오렌톡 · 맑원장 1:1 상담</div></div><div class="bubbles"><div class="bq">세럼이랑 크림<br>순서 맞나요?</div><div class="ba">세럼 먼저요!<br>흡수 후 크림 발라요</div></div></div><div class="ot-body"><div class="steps"><div class="step"><div class="snum">1</div>위 QR 스캔 → AURAN 카카오 가입</div><div class="step"><div class="snum">2</div>앱 하단 채팅 탭 터치</div><div class="step"><div class="snum">3</div>맑원장님께 바로 질문하기</div><div class="ot-hint">맑원장이 직접 챙겨드릴게요 💜</div></div><div style="display:flex;flex-direction:column;align-items:center;gap:3px"><img src="${qrChat}" width="48" height="48" style="display:block;border-radius:4px;" /><div style="font-size:8px;color:#9B7EC8;text-align:center">상담 바로가기</div></div></div></div>
<div class="review"><div><div class="rv-title">솔직한 후기 남기고 토스트 받으세요</div><div class="rv-sub">내 후기 한 줄이 비슷한 피부 고민 가진 분께 큰 도움이 돼요</div><div><table style="width:100%;border-collapse:collapse;margin-top:6px">
  <thead><tr>
  <th style="font-size:9px;color:#999;text-align:left;padding:3px 0">구매 합산금액</th>
  <th style="font-size:9px;color:#999;text-align:center">리뷰 토스트</th>
</tr></thead>
  <tbody>${reviewToastRows}</tbody>
</table></div></div><img src="${qrReview}" width="40" height="40" style="display:block;border-radius:4px;" /></div>
<div class="footer">auran.kr · 오렌톡 · 맑원장 · 스킨파우더룸 · ${new Date().toLocaleDateString('ko-KR')}</div>
</body></html>`
    const today = new Date().toLocaleDateString('ko-KR')
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
    }
}
