const { chromium } = require(process.env.PLAYWRIGHT || '/opt/npm-tools/node_modules/playwright');
const og = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:IS;src:url(/assets/instrument-sans.woff) format("woff");font-weight:400 700;font-stretch:75% 100%}
*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;font-family:IS;background:#10233a;color:#fff;display:grid;grid-template-columns:1.05fr .95fr;gap:48px;padding:64px 64px;font-variant-numeric:tabular-nums}
.m{display:flex;align-items:center;gap:14px;font-weight:700;font-size:34px;letter-spacing:-.02em}.m img{width:46px;height:46px;background:#fff;border-radius:10px}
h1{font-size:76px;line-height:1;font-stretch:78%;letter-spacing:-.025em;margin-top:56px}
p{margin-top:28px;font-size:25px;color:#b4c3d3;line-height:1.4}
.c{background:#fff;color:#16202b;border-radius:18px;align-self:center;overflow:hidden}
.t{padding:18px 24px;border-bottom:1px solid #dbe2e9;display:flex;justify-content:space-between;align-items:center;font-weight:700;color:#10233a;font-size:20px}
.t span{font-size:14px;color:#74510a;background:#fdf3d8;padding:4px 10px;border-radius:99px}
.k{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #dbe2e9}.k div{padding:16px 16px;border-left:1px solid #dbe2e9}.k div:first-child{border:0}
.k b{display:block;font-size:28px;font-stretch:76%;white-space:nowrap}.k small{font-size:14px;color:#546170;font-weight:600}
.r{display:flex;justify-content:space-between;padding:14px 24px;border-top:1px solid #e8edf2;font-size:18px}.r b{font-weight:700}
</style></head><body><div><div class="m"><img src="/assets/logo.svg">Lastro</div><h1>O sistema diz uma coisa. A prateleira, outra.</h1><p>Inventário físico, Raio-X do Estoque e consultoria de estoque em São Paulo.</p></div>
<div class="c"><div class="t">Conciliação sistema × físico<span>Dados fictícios</span></div>
<div class="k"><div><small>Itens que batem</small><b style="color:#13734d">78,7%</b></div><div><small>Faltas</small><b style="color:#b3362b">R$ 4.266,60</b></div><div><small>Sobras</small><b style="color:#2758a6">R$ 1.905,60</b></div></div>
<div class="r" style="border:0">Disjuntor tripolar 63 A<b style="color:#b3362b">−9</b></div><div class="r">Cabo PP 3×2,5 mm (m)<b style="color:#2758a6">+180</b></div><div class="r">Fita isolante 20 m<b style="color:#b3362b">−22</b></div></div></body></html>`;
const icon = `<!doctype html><html><head><style>*{margin:0}body{width:180px;height:180px;background:#10233a;display:grid;place-items:center}img{width:150px;height:150px}</style></head><body><img src="/assets/logo.svg"></body></html>`;
(async () => {
  const b = await chromium.launch();
  let p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto('http://localhost:8765/robots.txt'); await p.setContent(og, { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: require('path').join(__dirname, '..', 'assets') + '/og.png' });
  p = await b.newPage({ viewport: { width: 180, height: 180 } });
  await p.goto('http://localhost:8765/robots.txt'); await p.setContent(icon, { waitUntil: 'networkidle' });
  await p.screenshot({ path: require('path').join(__dirname, '..', 'assets') + '/apple-touch-icon.png' });
  await b.close();
})();
