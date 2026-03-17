export interface CardStyle {
  bg: string
  border: string
  name: string
  desc: string
}

export interface SparkleConfig {
  left: string
  top: string
  size: number
  duration: number
  color: string
}

export interface MoonConfig {
  show: boolean
  width: number
  height: number
  color: string
  glow: string
}

export interface MonthTheme {
  month: number
  name: string
  emoji: string
  issue: string
  lights: string[]
  bg: string
  phoneBorder: string
  logo: string
  logoSub: string
  titleColor: string
  titleEmColor: string
  subColor: string
  ctaColor: string
  dividerColor: string
  footColor: string
  badgeBg: string
  badgeColor: string
  badgeBorder: string
  particles: string
  particleSpeeds: number[]
  sparkles: SparkleConfig[]
  moon?: MoonConfig
  hasSun?: boolean
  hasWave?: boolean
  hasAurora?: boolean
  hasSnowGround?: boolean
  hasXmasTree?: boolean
  hasCherry?: boolean
  c1: CardStyle
  c2: CardStyle
  c3: CardStyle
  c4: CardStyle
}

export const PARTICLE_CHARS: Record<string, string[]> = {
  m1:     ['❄','🎍','⛄','❅','🎎','❆'],
  m2:     ['💝','🍫','❄','💕','🌙','💗'],
  m3:     ['🌼','🐣','🌼','🥓','🌼','🐥'],
  cherry4:['🌸','🌸','🌸','🌺','🌸','🌸'],
  m5:     ['💗','🌹','🎀','💕','👶','🌸'],
  m6:     ['💗','🌿','💕','🌸','💐','💗'],
  plane:  ['🛩'],
  m9:     ['🌕','🌾','🏮','🌺','🍱','🌕'],
  m10:    ['🍁','🎃','👻','🍂','🕯','🍁'],
  bero:   ['🍫','🍭','🍬','🍂','📝','🍡'],
  m12:    ['❄','⛄','🎄','🎅','🎁','❆'],
  bday:   ['🎂','🎉','✨','🎀','💝','🎁','🌟','🥳'],
}

export const MONTH_THEMES: MonthTheme[] = [
  {
    month: 1, name: '1월', emoji: '🎍', issue: '설날 · 신정 · 새해맞이',
    lights: ['#ff4444','#ff9900','#ffff00','#00ff88','#4499ff','#ff44ff'],
    bg: 'linear-gradient(180deg,#060e20 0%,#0c1c38 45%,#101e3a 62%,#e0ecf8 72%,#d0e4f4 100%)',
    phoneBorder: '#2a4070', logo: '#a0c8ff', logoSub: '#3a5878',
    titleColor: '#d8f0ff', titleEmColor: '#88c0ff',
    subColor: '#5a7898', ctaColor: '#78b0e8',
    dividerColor: 'rgba(140,190,240,0.3)', footColor: '#3a5070',
    badgeBg: 'linear-gradient(135deg,#0a1830,#020810)', badgeColor: '#a0c8ff', badgeBorder: '#2a4070',
    moon: { show:true, width:36, height:36, color:'radial-gradient(circle at 38% 38%,#fffde7,#ffd060 60%,#f0b030)', glow:'rgba(255,200,60,0.5)' },
    hasAurora: true, hasSnowGround: true,
    particles: 'm1', particleSpeeds: [20,24,22,26,21,23,19,25,18,22],
    sparkles: [{left:'18%',top:'8%',size:3,duration:2.2,color:'rgba(160,200,255,0.9)'},{left:'52%',top:'5%',size:2,duration:3,color:'rgba(180,220,255,0.8)'},{left:'76%',top:'16%',size:3,duration:2.7,color:'rgba(200,230,255,0.9)'},{left:'36%',top:'4%',size:4,duration:3.5,color:'rgba(140,190,255,0.7)'}],
    c1:{bg:'rgba(255,160,200,0.1)',border:'rgba(255,140,190,0.6)',name:'#ffb0d8',desc:'#c07898'},
    c2:{bg:'rgba(160,200,255,0.1)',border:'rgba(140,190,255,0.62)',name:'#90c0ff',desc:'#5080b0'},
    c3:{bg:'rgba(200,180,255,0.1)',border:'rgba(190,170,255,0.62)',name:'#c8a8ff',desc:'#8060b0'},
    c4:{bg:'rgba(160,240,200,0.1)',border:'rgba(140,230,190,0.62)',name:'#80f0b8',desc:'#308060'},
  },
  {
    month: 2, name: '2월', emoji: '💝', issue: '발렌타인데이(2/14) · 겨울 끝자락',
    lights: ['#ff4466','#ff2244','#ff6688','#ff44aa','#cc2255','#ff88aa'],
    bg: 'linear-gradient(180deg,#180828 0%,#220e34 40%,#2a1240 62%,#ece0f4 72%,#e0d0ee 100%)',
    phoneBorder: '#8833aa', logo: '#e8a0ff', logoSub: '#7030a0',
    titleColor: '#f8e8ff', titleEmColor: '#e080ff',
    subColor: '#9870b8', ctaColor: '#cc70f8',
    dividerColor: 'rgba(220,150,255,0.3)', footColor: '#6830a0',
    badgeBg: 'linear-gradient(135deg,#280e38,#0e0510)', badgeColor: '#e8a0ff', badgeBorder: '#7030a0',
    moon: { show:true, width:32, height:32, color:'radial-gradient(circle at 35% 35%,#ffe8f0,#ff80aa 60%,#e04080)', glow:'rgba(255,120,180,0.6)' },
    hasSnowGround: true,
    particles: 'm2', particleSpeeds: [20,24,22,26,20,24,21,25,19,23],
    sparkles: [{left:'25%',top:'12%',size:3,duration:2.5,color:'rgba(255,150,220,0.9)'},{left:'62%',top:'6%',size:2,duration:3.2,color:'rgba(220,130,255,0.8)'},{left:'80%',top:'18%',size:3,duration:2.8,color:'rgba(255,170,240,0.9)'},{left:'44%',top:'8%',size:2,duration:3.8,color:'rgba(210,140,255,0.7)'}],
    c1:{bg:'rgba(255,140,180,0.14)',border:'rgba(240,100,160,0.65)',name:'#ff90c8',desc:'#c06090'},
    c2:{bg:'rgba(200,150,255,0.12)',border:'rgba(180,120,255,0.6)',name:'#d090ff',desc:'#9060c0'},
    c3:{bg:'rgba(255,190,220,0.12)',border:'rgba(255,160,200,0.6)',name:'#ffb0d8',desc:'#c07090'},
    c4:{bg:'rgba(180,240,200,0.1)',border:'rgba(140,220,180,0.6)',name:'#1a7a40',desc:'#0e5028'},
  },
  {
    month: 3, name: '3월', emoji: '🌼', issue: '삼겹살데이(3/3) · 화이트데이(3/14)',
    lights: ['#ffe044','#ffcc00','#ffee66','#ffdd22','#ffbb00','#fff066'],
    bg: 'linear-gradient(180deg,#fffbe0 0%,#fff5b0 30%,#ffe87a 60%,#ffd84a 100%)',
    phoneBorder: '#e8c020', logo: '#7a5800', logoSub: '#a07820',
    titleColor: '#4a3400', titleEmColor: '#c88000',
    subColor: '#8a6820', ctaColor: '#b07818',
    dividerColor: 'rgba(180,130,0,0.3)', footColor: '#c09830',
    badgeBg: 'linear-gradient(135deg,#f0d040,#c8a010)', badgeColor: '#4a3400', badgeBorder: '#d0b020',
    hasCherry: true,
    particles: 'm3', particleSpeeds: [18,22,20,24,17,21,19,23],
    sparkles: [{left:'18%',top:'8%',size:4,duration:2.3,color:'rgba(255,220,50,0.95)'},{left:'54%',top:'5%',size:3,duration:3.1,color:'rgba(255,235,80,0.9)'},{left:'74%',top:'16%',size:4,duration:2.7,color:'rgba(255,210,40,0.95)'},{left:'36%',top:'4%',size:2,duration:3.5,color:'rgba(255,230,70,0.8)'}],
    c1:{bg:'rgba(255,220,80,0.3)',border:'rgba(200,160,20,0.55)',name:'#5a3800',desc:'#8a5c10'},
    c2:{bg:'rgba(255,235,120,0.3)',border:'rgba(180,140,10,0.5)',name:'#4a3000',desc:'#7a5010'},
    c3:{bg:'rgba(255,200,60,0.25)',border:'rgba(190,150,15,0.5)',name:'#503a00',desc:'#7a5800'},
    c4:{bg:'rgba(255,240,140,0.3)',border:'rgba(170,130,10,0.5)',name:'#3a2800',desc:'#6a4808'},
  },
  {
    month: 4, name: '4월', emoji: '🌸', issue: '벚꽃 만개 · 식목일(4/5)',
    lights: ['#ffaacc','#ff88bb','#ffccdd','#ff99bb','#ffbbdd','#ff77aa'],
    bg: 'radial-gradient(ellipse 200% 55% at 50% 0%,#ffe0ee 0%,transparent 58%),linear-gradient(180deg,#fff0f5 0%,#ffe8f0 40%,#ffd8e8 100%)',
    phoneBorder: '#ffb0cc', logo: '#9b2c5a', logoSub: '#c07090',
    titleColor: '#5a1a30', titleEmColor: '#c83060',
    subColor: '#904060', ctaColor: '#b03070',
    dividerColor: 'rgba(200,80,130,0.3)', footColor: '#d090b0',
    badgeBg: 'linear-gradient(135deg,#ffb8d0,#ff88b8)', badgeColor: '#5a1a30', badgeBorder: '#ff80aa',
    hasCherry: true,
    particles: 'cherry4', particleSpeeds: [28,34,30,36,26,32,28,34,27,30],
    sparkles: [{left:'14%',top:'10%',size:4,duration:2.1,color:'rgba(255,180,210,0.95)'},{left:'34%',top:'7%',size:3,duration:3,color:'rgba(255,160,200,0.85)'},{left:'58%',top:'14%',size:4,duration:2.6,color:'rgba(255,190,220,0.9)'},{left:'78%',top:'5%',size:3,duration:3.4,color:'rgba(255,205,230,0.75)'},{left:'50%',top:'20%',size:2,duration:2.3,color:'rgba(255,175,215,0.8)'}],
    c1:{bg:'rgba(255,160,200,0.22)',border:'rgba(210,80,130,0.55)',name:'#8a1840',desc:'#b05070'},
    c2:{bg:'rgba(180,220,255,0.2)',border:'rgba(80,150,230,0.5)',name:'#1a3888',desc:'#3060b0'},
    c3:{bg:'rgba(210,185,255,0.2)',border:'rgba(140,90,220,0.5)',name:'#401880',desc:'#6038a0'},
    c4:{bg:'rgba(170,245,200,0.2)',border:'rgba(50,170,100,0.5)',name:'#0c4028',desc:'#186840'},
  },
  {
    month: 5, name: '5월', emoji: '🌹', issue: '어린이날(5/5) · 어버이날(5/8) · 로즈데이(5/14)',
    lights: ['#ff4466','#cc2244','#ff8899','#ff3355','#dd1144','#ff6677'],
    bg: 'linear-gradient(160deg,#fff0f5 0%,#ffd8e8 25%,#f5b8d0 50%,#e8a0c0 70%,#f0d8e8 85%,#e8f0d8 100%)',
    phoneBorder: '#cc4070', logo: '#6a0828', logoSub: '#a04868',
    titleColor: '#3a0818', titleEmColor: '#c02858',
    subColor: '#7a3858', ctaColor: '#901848',
    dividerColor: 'rgba(180,60,100,0.35)', footColor: '#c080a0',
    badgeBg: 'linear-gradient(135deg,#e05888,#b02858)', badgeColor: '#fff0f4', badgeBorder: '#c03868',
    hasCherry: true,
    particles: 'm5', particleSpeeds: [20,24,22,26,19,23,21,25],
    sparkles: [{left:'22%',top:'9%',size:3,duration:2.4,color:'rgba(255,160,190,0.9)'},{left:'58%',top:'6%',size:2,duration:3.2,color:'rgba(200,240,150,0.8)'},{left:'78%',top:'16%',size:3,duration:2.9,color:'rgba(255,140,180,0.9)'},{left:'40%',top:'5%',size:2,duration:3.6,color:'rgba(180,230,130,0.7)'}],
    c1:{bg:'rgba(255,150,185,0.2)',border:'rgba(200,70,120,0.55)',name:'#8a1840',desc:'#aa4870'},
    c2:{bg:'rgba(170,245,165,0.2)',border:'rgba(60,170,80,0.5)',name:'#0a4018',desc:'#1a6030'},
    c3:{bg:'rgba(210,185,255,0.2)',border:'rgba(140,90,220,0.5)',name:'#401880',desc:'#6038a0'},
    c4:{bg:'rgba(255,230,140,0.2)',border:'rgba(200,160,50,0.5)',name:'#5a3808',desc:'#8a6028'},
  },
  {
    month: 6, name: '6월', emoji: '🌿', issue: '현충일(6/6) · 단오 · 수국 시즌',
    lights: ['#44cc44','#22aa44','#66dd44','#33bb22','#55cc33','#88ee55'],
    bg: 'linear-gradient(160deg,#e8f8e0 0%,#c8eeb0 20%,#a8de88 42%,#88cc60 62%,#c8eec0 80%,#e0f5d8 100%)',
    phoneBorder: '#4a9830', logo: '#1a4810', logoSub: '#3a7828',
    titleColor: '#0e2e08', titleEmColor: '#2a7018',
    subColor: '#3a6028', ctaColor: '#1a5810',
    dividerColor: 'rgba(60,140,40,0.35)', footColor: '#70a850',
    badgeBg: 'linear-gradient(135deg,#5ab030,#2a7818)', badgeColor: '#e8f8e0', badgeBorder: '#3a8820',
    particles: 'm6', particleSpeeds: [22,27,24,29,21,26,23,28],
    sparkles: [{left:'18%',top:'7%',size:3,duration:2.5,color:'rgba(80,200,80,0.9)'},{left:'50%',top:'4%',size:2,duration:3.3,color:'rgba(120,230,100,0.8)'},{left:'72%',top:'13%',size:3,duration:2.8,color:'rgba(60,190,80,0.9)'},{left:'34%',top:'3%',size:2,duration:3.7,color:'rgba(100,220,90,0.7)'}],
    c1:{bg:'rgba(255,155,195,0.2)',border:'rgba(200,80,130,0.52)',name:'#6a1030',desc:'#9a3860'},
    c2:{bg:'rgba(120,220,120,0.22)',border:'rgba(60,170,60,0.55)',name:'#0c3808',desc:'#286020'},
    c3:{bg:'rgba(180,240,160,0.2)',border:'rgba(80,180,60,0.5)',name:'#183808',desc:'#307028'},
    c4:{bg:'rgba(255,240,140,0.2)',border:'rgba(180,160,40,0.5)',name:'#3a3008',desc:'#686020'},
  },
  {
    month: 7, name: '7월', emoji: '🌊', issue: '바다 시즌 · 한여름 · 복날',
    lights: ['#ffff44','#ffdd00','#ffee66','#ffe800','#ffcc00','#fff066'],
    bg: 'linear-gradient(180deg,#4ec3f7 0%,#29b6f6 18%,#039be5 38%,#0277bd 57%,#01579b 62%,#f5deb3 62%,#e8c97a 100%)',
    phoneBorder: '#29b6f6', logo: '#fff', logoSub: 'rgba(255,255,255,0.7)',
    titleColor: '#fff', titleEmColor: '#ffe066',
    subColor: 'rgba(255,255,255,0.88)', ctaColor: '#ffe066',
    dividerColor: 'rgba(255,255,255,0.3)', footColor: 'rgba(255,255,255,0.45)',
    badgeBg: 'linear-gradient(135deg,#0288d1,#01579b)', badgeColor: '#ffe066', badgeBorder: '#29b6f6',
    hasSun: true, hasWave: true,
    particles: 'plane', particleSpeeds: [24,30,26,32,22,28,25,29],
    sparkles: [{left:'30%',top:'7%',size:3,duration:2.5,color:'rgba(255,230,100,0.9)'},{left:'55%',top:'4%',size:2,duration:3,color:'rgba(255,240,120,0.8)'},{left:'12%',top:'14%',size:3,duration:2.8,color:'rgba(255,220,80,0.9)'},{left:'46%',top:'21%',size:4,duration:3.5,color:'rgba(255,235,100,0.7)'}],
    c1:{bg:'rgba(255,160,190,0.18)',border:'rgba(255,140,180,0.7)',name:'#fff',desc:'rgba(255,255,255,0.8)'},
    c2:{bg:'rgba(255,255,255,0.15)',border:'rgba(255,255,255,0.75)',name:'#fff',desc:'rgba(255,255,255,0.8)'},
    c3:{bg:'rgba(200,220,255,0.15)',border:'rgba(180,210,255,0.65)',name:'#fff',desc:'rgba(255,255,255,0.8)'},
    c4:{bg:'rgba(180,255,220,0.15)',border:'rgba(150,255,200,0.65)',name:'#fff',desc:'rgba(255,255,255,0.8)'},
  },
  {
    month: 8, name: '8월', emoji: '🌻', issue: '광복절(8/15) · 해바라기 · 말복',
    lights: ['#ff8800','#ffaa00','#ffcc44','#ff9900','#ffbb22','#ffdd66'],
    bg: 'linear-gradient(180deg,#ff8c00 0%,#ffa500 22%,#ffcc02 48%,#87ceeb 60%,#5bb8e0 100%)',
    phoneBorder: '#ffa500', logo: '#fff', logoSub: 'rgba(255,255,255,0.75)',
    titleColor: '#fff', titleEmColor: '#ffe066',
    subColor: 'rgba(255,255,255,0.9)', ctaColor: '#fff3cc',
    dividerColor: 'rgba(255,255,255,0.35)', footColor: 'rgba(255,255,255,0.5)',
    badgeBg: 'linear-gradient(135deg,#ff8c00,#e07000)', badgeColor: '#fff', badgeBorder: '#ffa500',
    hasSun: true, hasWave: true,
    particles: 'plane', particleSpeeds: [22,28,24,30,20,26,23,27],
    sparkles: [{left:'24%',top:'9%',size:4,duration:2.2,color:'rgba(255,240,100,0.95)'},{left:'60%',top:'5%',size:3,duration:2.8,color:'rgba(255,220,60,0.9)'},{left:'15%',top:'17%',size:3,duration:3.2,color:'rgba(255,230,80,0.88)'},{left:'44%',top:'3%',size:2,duration:3.8,color:'rgba(255,245,120,0.8)'}],
    c1:{bg:'rgba(255,200,150,0.2)',border:'rgba(255,160,80,0.7)',name:'#fff',desc:'rgba(255,255,255,0.85)'},
    c2:{bg:'rgba(255,255,255,0.18)',border:'rgba(255,255,255,0.8)',name:'#fff',desc:'rgba(255,255,255,0.85)'},
    c3:{bg:'rgba(200,240,255,0.18)',border:'rgba(160,220,255,0.7)',name:'#fff',desc:'rgba(255,255,255,0.85)'},
    c4:{bg:'rgba(180,255,210,0.15)',border:'rgba(140,240,190,0.65)',name:'#fff',desc:'rgba(255,255,255,0.85)'},
  },
  {
    month: 9, name: '9월', emoji: '🌾', issue: '추석 · 한가위 · 무궁화 · 풍요',
    lights: ['#ffaa44','#ff8822','#ffcc66','#ff9933','#ffbb44','#ffdd88'],
    bg: 'linear-gradient(180deg,#1a1006 0%,#2e1c0a 28%,#4a2e14 58%,#8a6030 100%)',
    phoneBorder: '#c08040', logo: '#ffe8a0', logoSub: '#c09050',
    titleColor: '#fff8e0', titleEmColor: '#ffcc60',
    subColor: '#e8c880', ctaColor: '#ffd060',
    dividerColor: 'rgba(255,210,100,0.4)', footColor: '#c09850',
    badgeBg: 'linear-gradient(135deg,#a07030,#603818)', badgeColor: '#e8b860', badgeBorder: '#c08040',
    moon: { show:true, width:38, height:38, color:'radial-gradient(circle at 38% 38%,#fffde7,#ffd060 60%,#e8a030)', glow:'rgba(255,200,60,0.7)' },
    particles: 'm9', particleSpeeds: [20,24,22,26,19,23,21,25],
    sparkles: [{left:'20%',top:'14%',size:2,duration:3.1,color:'rgba(240,185,80,0.7)'},{left:'56%',top:'7%',size:2,duration:3.6,color:'rgba(220,165,60,0.65)'},{left:'76%',top:'18%',size:2,duration:2.9,color:'rgba(252,195,90,0.7)'}],
    c1:{bg:'rgba(255,185,100,0.15)',border:'rgba(230,145,60,0.62)',name:'#f0b060',desc:'#a07030'},
    c2:{bg:'rgba(220,185,100,0.15)',border:'rgba(200,155,60,0.62)',name:'#e8c870',desc:'#a08038'},
    c3:{bg:'rgba(200,165,100,0.15)',border:'rgba(180,135,60,0.56)',name:'#d8a860',desc:'#906030'},
    c4:{bg:'rgba(120,195,120,0.12)',border:'rgba(80,165,80,0.52)',name:'#80c870',desc:'#406040'},
  },
  {
    month: 10, name: '10월', emoji: '🍁', issue: '한글날(10/9) · 핼러윈(10/31) · 단풍 절정',
    lights: ['#ff6600','#ff4400','#ff8800','#ff5500','#dd3300','#ff7722'],
    bg: 'linear-gradient(180deg,#0d0804 0%,#1e1006 18%,#2e1a08 38%,#3d2010 58%,#5a3015 78%,#7a4820 100%)',
    phoneBorder: '#9a6030', logo: '#e8a040', logoSub: '#7a5020',
    titleColor: '#f0d090', titleEmColor: '#e8a040',
    subColor: '#9a7040', ctaColor: '#c08030',
    dividerColor: 'rgba(232,160,64,0.3)', footColor: '#5a3a18',
    badgeBg: 'linear-gradient(135deg,#7a4820,#4a2810)', badgeColor: '#e8a040', badgeBorder: '#9a6030',
    moon: { show:true, width:34, height:34, color:'radial-gradient(circle at 40% 40%,#fffde0,#ffc840 55%,#e89820)', glow:'rgba(255,190,50,0.55)' },
    particles: 'm10', particleSpeeds: [20,24,22,26,19,23,21,25,20,24],
    sparkles: [{left:'20%',top:'15%',size:2,duration:3.3,color:'rgba(232,165,64,0.65)'},{left:'58%',top:'9%',size:2,duration:3.9,color:'rgba(210,145,50,0.55)'},{left:'78%',top:'21%',size:2,duration:3,color:'rgba(248,180,70,0.65)'}],
    c1:{bg:'rgba(230,115,50,0.15)',border:'rgba(220,105,50,0.65)',name:'#f09060',desc:'#a05030'},
    c2:{bg:'rgba(210,165,50,0.15)',border:'rgba(200,155,50,0.65)',name:'#f0c860',desc:'#a08030'},
    c3:{bg:'rgba(190,92,42,0.15)',border:'rgba(180,82,42,0.62)',name:'#e07050',desc:'#904030'},
    c4:{bg:'rgba(100,175,82,0.12)',border:'rgba(90,165,72,0.56)',name:'#90d070',desc:'#508040'},
  },
  {
    month: 11, name: '11월', emoji: '🍂', issue: '빼빼로데이(11/11) · 수능 · 늦가을',
    lights: ['#886644','#aa7744','#cc9955','#997733','#bb8844','#ddaa66'],
    bg: 'linear-gradient(180deg,#060402 0%,#120a06 22%,#1c1208 48%,#2a1a0a 74%,#3a2410 100%)',
    phoneBorder: '#785022', logo: '#c89050', logoSub: '#684818',
    titleColor: '#e0c080', titleEmColor: '#c89050',
    subColor: '#806838', ctaColor: '#a07030',
    dividerColor: 'rgba(200,144,80,0.28)', footColor: '#4a3015',
    badgeBg: 'linear-gradient(135deg,#5a3815,#3a2008)', badgeColor: '#c89050', badgeBorder: '#785022',
    moon: { show:true, width:30, height:30, color:'radial-gradient(circle at 40% 40%,#fff8d0,#ffc840 55%,#d89020)', glow:'rgba(240,175,40,0.45)' },
    particles: 'bero', particleSpeeds: [22,26,24,28,21,25,23,27,20,24],
    sparkles: [{left:'18%',top:'10%',size:2,duration:3.1,color:'rgba(200,148,80,0.55)'},{left:'52%',top:'6%',size:2,duration:3.7,color:'rgba(180,128,62,0.5)'},{left:'74%',top:'16%',size:2,duration:2.8,color:'rgba(210,158,90,0.58)'}],
    c1:{bg:'rgba(200,125,62,0.14)',border:'rgba(190,115,52,0.62)',name:'#d09060',desc:'#906040'},
    c2:{bg:'rgba(190,155,72,0.14)',border:'rgba(180,145,62,0.62)',name:'#d0b060',desc:'#887040'},
    c3:{bg:'rgba(170,92,52,0.14)',border:'rgba(160,82,42,0.56)',name:'#c07050',desc:'#804030'},
    c4:{bg:'rgba(80,155,82,0.1)',border:'rgba(70,145,72,0.52)',name:'#80c070',desc:'#407040'},
  },
  {
    month: 12, name: '12월', emoji: '🎄', issue: '크리스마스(12/25) · 동지 · 연말결산',
    lights: ['#ff3333','#33ff33','#ffff33','#ff3333','#3333ff','#ff9933'],
    bg: 'linear-gradient(180deg,#010508 0%,#040e18 22%,#081828 50%,#c8e0f4 60%,#b4d4ee 100%)',
    phoneBorder: '#cc2828', logo: '#ff6060', logoSub: '#992020',
    titleColor: '#f4f8ff', titleEmColor: '#ff7050',
    subColor: '#6888a8', ctaColor: '#ff7050',
    dividerColor: 'rgba(255,120,100,0.3)', footColor: '#3a5070',
    badgeBg: 'linear-gradient(135deg,#881818,#cc2828)', badgeColor: '#f4f8ff', badgeBorder: '#cc2828',
    hasAurora: true, hasSnowGround: true, hasXmasTree: true,
    particles: 'm12', particleSpeeds: [20,24,22,26,21,23,19,25,18,22],
    sparkles: [{left:'22%',top:'12%',size:3,duration:2.3,color:'rgba(255,100,100,0.8)'},{left:'58%',top:'7%',size:2,duration:3.1,color:'rgba(200,230,255,0.9)'},{left:'78%',top:'18%',size:3,duration:2.7,color:'rgba(255,130,80,0.8)'},{left:'40%',top:'5%',size:2,duration:3.5,color:'rgba(180,220,255,0.75)'}],
    c1:{bg:'rgba(255,100,100,0.12)',border:'rgba(220,70,70,0.65)',name:'#ff8080',desc:'#c05050'},
    c2:{bg:'rgba(160,200,255,0.1)',border:'rgba(140,190,255,0.65)',name:'#90c0ff',desc:'#5080b0'},
    c3:{bg:'rgba(100,200,100,0.1)',border:'rgba(80,180,80,0.62)',name:'#70d070',desc:'#306030'},
    c4:{bg:'rgba(255,230,150,0.1)',border:'rgba(240,210,100,0.62)',name:'#f0d060',desc:'#a08030'},
  },
]

// 현재 달 테마 반환
export function getCurrentTheme(): MonthTheme {
  const month = new Date().getMonth() + 1
  return MONTH_THEMES[month - 1]
}

// 생일 D-N 계산 (localStorage 'auran_birthday' MM-DD)
export function getBirthdayDaysLeft(): number | null {
  if (typeof window === 'undefined') return null
  const bd = localStorage.getItem('auran_birthday')
  if (!bd) return null
  const [mm, dd] = bd.split('-').map(Number)
  if (!mm || !dd) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const year = today.getFullYear()
  let bday = new Date(year, mm - 1, dd)
  bday.setHours(0, 0, 0, 0)
  if (bday < today) bday = new Date(year + 1, mm - 1, dd)
  return Math.round((bday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// 생일 주간 여부 (D-7 ~ D-0)
export function isBirthdayWeek(): boolean {
  const d = getBirthdayDaysLeft()
  return d !== null && d >= 0 && d <= 7
}

// 생일 테마
export const BIRTHDAY_THEME: Partial<MonthTheme> = {
  lights: ['#ff6b9d','#ffd700','#ff9dc0','#ffb347','#ff6b9d','#fff0f8'],
  bg: 'linear-gradient(160deg,#1a0828 0%,#2e0a3a 30%,#3d1245 55%,#ff8fab 70%,#ffb3c1 85%,#ffd6e0 100%)',
  phoneBorder: '#ff6b9d',
  logo: '#ffe0f0', logoSub: '#ff9dc0',
  titleColor: '#fff0f8', titleEmColor: '#ffd700',
  subColor: 'rgba(255,220,240,0.9)', ctaColor: '#ffd700',
  dividerColor: 'rgba(255,200,220,0.5)', footColor: 'rgba(255,180,210,0.7)',
  particles: 'bday',
  sparkles: [
    {left:'15%',top:'8%',size:4,duration:1.8,color:'rgba(255,215,0,0.95)'},
    {left:'40%',top:'5%',size:3,duration:2.4,color:'rgba(255,120,180,0.9)'},
    {left:'65%',top:'10%',size:4,duration:2,color:'rgba(255,215,0,0.9)'},
    {left:'82%',top:'6%',size:3,duration:2.8,color:'rgba(255,160,210,0.85)'},
  ],
  c1:{bg:'rgba(255,107,157,0.2)',border:'rgba(255,80,140,0.7)',name:'#fff0f8',desc:'rgba(255,220,240,0.85)'},
  c2:{bg:'rgba(255,215,0,0.15)',border:'rgba(255,200,0,0.7)',name:'#fff8e0',desc:'rgba(255,240,180,0.85)'},
  c3:{bg:'rgba(180,100,255,0.15)',border:'rgba(160,80,255,0.65)',name:'#f0d8ff',desc:'rgba(230,200,255,0.85)'},
  c4:{bg:'rgba(100,220,180,0.15)',border:'rgba(80,200,160,0.65)',name:'#d8fff4',desc:'rgba(180,255,230,0.85)'},
}
