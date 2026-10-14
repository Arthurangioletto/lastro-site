// Mede peso transferido, número de requisições, LCP e CLS (Chromium, sem limitação de rede).
const { chromium } = require('playwright');
const U = process.env.SITE_URL || 'http://localhost:8000/';
(async () => {
  const b = await chromium.launch();
  for (const pg of ['', 'sistemas.html', 'conteudos/acuracidade-de-estoque.html']) {
    for (const [nome, vp] of [['celular', { width: 390, height: 844 }], ['computador', { width: 1366, height: 900 }]]) {
      const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
      await p.addInitScript(() => {
        window.__lcp = 0; window.__cls = 0;
        new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
      });
      await p.goto(U + pg, { waitUntil: 'networkidle' }); await p.waitForTimeout(800);
      const r = await p.evaluate(() => { const rs = performance.getEntriesByType('resource'); const nav = performance.getEntriesByType('navigation')[0];
        const kb = (rs.reduce((a, x) => a + (x.decodedBodySize || 0), 0) + nav.decodedBodySize) / 1024;
        return { req: rs.length + 1, kb: Math.round(kb), lcp: Math.round(window.__lcp), cls: +window.__cls.toFixed(3), dom: Math.round(nav.domContentLoadedEventEnd) }; });
      console.log(`${pg || 'index.html'} [${nome}] requisições=${r.req} peso=${r.kb}KB LCP=${r.lcp}ms CLS=${r.cls} DOMContentLoaded=${r.dom}ms`);
      await ctx.close();
    }
  }
  await b.close();
})();
