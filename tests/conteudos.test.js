// Testa as páginas de conteúdo: carregam, sem rolagem lateral, títulos em ordem, links internos e console limpo.
const { chromium } = require('playwright');
const U = process.env.SITE_URL || 'http://localhost:8000/';
const paginas = ['conteudos/inventario-de-estoque-sao-paulo.html', 'conteudos/estoque-nao-bate-com-o-sistema.html', 'conteudos/acuracidade-de-estoque.html', 'conteudos/inventario-rotativo.html', 'sistemas.html'];
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) falhas++; };
(async () => {
  const b = await chromium.launch();
  for (const slug of paginas) {
    for (const w of [320, 390, 1366]) {
      const p = await b.newPage({ viewport: { width: w, height: 900 } });
      const erros = [];
      p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
      p.on('response', r => { if (r.status() >= 400) erros.push(r.status() + ' ' + r.url()); });
      const r0 = await p.goto(`${U}${slug}`, { waitUntil: 'networkidle' });
      const r = await p.evaluate(() => {
        const hs = [...document.querySelectorAll('h1,h2,h3,h4')].map(h => +h.tagName[1]);
        const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].every(s => { try { JSON.parse(s.textContent); return true; } catch (e) { return false; } });
        return { sw: document.documentElement.scrollWidth, W: document.documentElement.clientWidth, h1: hs.filter(x => x === 1).length, salto: hs.some((n, i) => i && n > hs[i - 1] + 1), ld, links: [...document.querySelectorAll('a[href]')].map(a => a.href), titulo: document.title, desc: document.querySelector('meta[name=description]').content.length, can: document.querySelector('link[rel=canonical]').href };
      });
      ok(r0.status() === 200 && r.sw <= r.W, `${slug} @${w}: carrega e sem rolagem lateral (${r.sw}/${r.W})`);
      if (w === 1366) {
        ok(r.h1 === 1 && !r.salto && r.ld, `${slug}: um h1, títulos em ordem, JSON-LD válido`);
        ok(r.titulo.length <= 80 && r.desc >= 70 && r.desc <= 170 && r.can.endsWith(slug), `${slug}: título (${r.titulo.length}), descrição (${r.desc}) e canonical`);
        for (const l of [...new Set(r.links.filter(h => h.startsWith(U)).map(h => h.split('#')[0]))]) {
          const rr = await p.request.get(l); if (rr.status() !== 200) ok(false, `${slug}: link ${l} → ${rr.status()}`);
        }
        await p.screenshot({ path: `${require('os').tmpdir()}/${slug.replace(/\W/g, '_')}.png`, fullPage: true });
      }
      ok(!erros.length, `${slug} @${w}: sem erros ${erros.join(' | ')}`);
      await p.close();
    }
  }
  await b.close();
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
})();
