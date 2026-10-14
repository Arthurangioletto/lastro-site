const { chromium } = require('playwright');
const U = process.env.SITE_URL || 'http://localhost:8000/';
const out = process.argv[2] || require('os').tmpdir();
let falhas = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + m); if (!c) falhas++; };
const num = s => parseFloat(String(s).replace(/[^\d,+−-]/g, '').replace('−', '-').replace(/\./g, '').replace(',', '.'));

(async () => {
  const b = await chromium.launch();
  const erros = [];
  const nova = async (opts = {}) => {
    const ctx = await b.newContext(opts);
    const p = await ctx.newPage();
    p.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    p.on('pageerror', e => erros.push(String(e)));
    p.on('response', r => { if (r.status() >= 400 && r.url().startsWith(U)) erros.push(r.status() + ' ' + r.url()); });
    return p;
  };

  // 1. larguras
  for (const w of [320, 360, 375, 390, 414, 768, 1024, 1280, 1366, 1920]) {
    const p = await nova({ viewport: { width: w, height: 900 } });
    await p.goto(U, { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const W = document.documentElement.clientWidth;
      const fora = [];
      document.querySelectorAll('body *').forEach(el => {
        if (el.closest('.sr, .armadilha, .pular, [hidden], thead, .cta-movel')) return;
        const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const q = el.getBoundingClientRect(); if (q.width && (q.right > W + 1 || q.left < -1)) fora.push(el.tagName + '.' + el.className + ' ' + Math.round(q.left) + '→' + Math.round(q.right));
      });
      const pequenos = [];
      document.querySelectorAll('a, button, input, select, textarea, summary').forEach(el => {
        if (el.closest('.sr, .armadilha, [hidden], .pular')) return;
        const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const q = el.getBoundingClientRect(); if (!q.width) return;
        const inline = cs.display === 'inline' && el.closest('p, dd, li span, figcaption');
        if (!inline && q.height < 40) pequenos.push(el.tagName + ':' + (el.textContent || el.name).trim().slice(0, 30) + ' ' + Math.round(q.height));
      });
      const fontes = [...document.querySelectorAll('body *')].filter(el => el.childNodes.length && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()) && !el.closest('.sr, .armadilha, [hidden]') && parseFloat(getComputedStyle(el).fontSize) < 12).map(el => el.tagName + ' ' + getComputedStyle(el).fontSize + ' ' + el.textContent.trim().slice(0, 25));
      return { sw: document.documentElement.scrollWidth, W, fora: fora.slice(0, 5), pequenos: pequenos.slice(0, 8), fontes: fontes.slice(0, 5) };
    });
    ok(r.sw <= r.W && !r.fora.length, `${w}px sem rolagem lateral (scrollWidth ${r.sw}/${r.W}) ${r.fora.join(' | ')}`);
    ok(!r.pequenos.length, `${w}px alvos de toque ≥ 40px ${r.pequenos.join(' | ')}`);
    ok(!r.fontes.length, `${w}px nenhuma fonte < 12px ${r.fontes.join(' | ')}`);
    if ([320, 768, 1920].includes(w)) await p.screenshot({ path: `${out}/w${w}.png`, fullPage: true });
    await p.context().close();
  }

  // 2. links e recursos
  {
    const p = await nova({ viewport: { width: 1366, height: 900 } });
    await p.goto(U, { waitUntil: 'networkidle' });
    const r = await p.evaluate(() => {
      const quebrados = [...document.querySelectorAll('a[href^="#"]')].filter(a => a.getAttribute('href') !== '#' && !document.getElementById(a.getAttribute('href').slice(1))).map(a => a.getAttribute('href'));
      const vazios = [...document.querySelectorAll('a')].filter(a => !a.getAttribute('href') || a.getAttribute('href') === '#').length;
      const externos = [...new Set([...document.querySelectorAll('a[href^="http"]')].map(a => a.href))];
      const ids = [...document.querySelectorAll('[id]')].map(e => e.id); const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
      return { quebrados, vazios, externos, dup };
    });
    ok(!r.quebrados.length && !r.vazios, 'âncoras internas existem ' + r.quebrados.join(','));
    ok(!r.dup.length, 'ids únicos ' + r.dup.join(','));
    ok(r.externos.every(h => h.startsWith('https://wa.me/5511950600817')), 'links externos: ' + r.externos.join(', '));
    const pv = await p.goto(U + 'privacidade.html'); ok(pv.status() === 200, 'privacidade.html carrega');
    ok(await p.evaluate(() => document.querySelector('a[href="index.html"]') !== null), 'privacidade volta ao início');
    for (const a of ['assets/og.png', 'assets/apple-touch-icon.png', 'assets/logo.svg', 'sitemap.xml', 'robots.txt', 'app/']) { const rr = await p.goto(U + a); ok(rr.status() === 200, a + ' responde 200'); }
    await p.context().close();
  }

  // 3. menu e teclado (celular)
  {
    const p = await nova({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await p.goto(U, { waitUntil: 'networkidle' });
    await p.keyboard.press('Tab');
    ok(await p.evaluate(() => document.activeElement.className === 'pular'), 'primeiro Tab vai para "Pular para o conteúdo"');
    const bt = p.locator('#menu-botao');
    ok(await bt.isVisible() && !(await p.locator('#menu').isVisible()), 'menu fechado com botão visível');
    await bt.click();
    ok(await p.locator('#menu').isVisible() && (await bt.getAttribute('aria-expanded')) === 'true', 'menu abre');
    ok(await p.evaluate(() => document.activeElement.closest('#menu') !== null), 'foco vai para o menu');
    await p.keyboard.press('Escape');
    ok(!(await p.locator('#menu').isVisible()) && await p.evaluate(() => document.activeElement.id === 'menu-botao'), 'Esc fecha e devolve o foco');
    await bt.click(); await p.locator('#menu a[href="#servicos"]').click(); await p.waitForTimeout(900);
    const top = await p.evaluate(() => document.getElementById('servicos').getBoundingClientRect().top);
    ok(!(await p.locator('#menu').isVisible()) && top >= 0 && top < 120, 'link do menu fecha o menu e rola até Serviços (' + Math.round(top) + ')');
    await bt.click(); await p.mouse.click(200, 700); ok(!(await p.locator('#menu').isVisible()), 'clique fora fecha o menu');
    // CTA fixo
    await p.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' })); await p.waitForTimeout(600);
    ok(!(await p.locator('#cta-movel').evaluate(e => e.classList.contains('visivel'))), 'CTA fixo escondido na primeira dobra');
    await p.evaluate(() => document.getElementById('raio-x').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(600);
    ok(await p.locator('#cta-movel').evaluate(e => e.classList.contains('visivel')), 'CTA fixo aparece no meio da página');
    await p.evaluate(() => document.getElementById('contato').scrollIntoView({ behavior: 'instant' })); await p.waitForTimeout(600);
    ok(!(await p.locator('#cta-movel').evaluate(e => e.classList.contains('visivel'))), 'CTA fixo some no formulário');
    await p.context().close();
  }

  // 4. formulário
  {
    const p = await nova({ viewport: { width: 1280, height: 900 } });
    await p.goto(U + '#contato', { waitUntil: 'networkidle' });
    await p.click('#revisar');
    const e = await p.evaluate(() => ({ inv: [...document.querySelectorAll('[aria-invalid="true"]')].map(x => x.name), foco: document.activeElement.name, geral: document.getElementById('erro-geral').textContent }));
    ok(e.inv.join() === 'nome,empresa,local,segmento,problema' && e.foco === 'nome', 'envio vazio marca 5 obrigatórios e foca o nome: ' + e.inv.join());
    ok(/Revise os campos/.test(e.geral), 'mensagem geral: ' + e.geral);
    ok(await p.locator('#revisao').isHidden(), 'não abre revisão com erro');
    await p.fill('#f-nome', 'José da Silva');
    ok((await p.getAttribute('#f-nome', 'aria-invalid')) === 'false', 'erro some ao corrigir');
    await p.fill('#f-empresa', 'Ferragens & Cia Ltda');
    await p.fill('#f-local', '  Brás,   São Paulo ');
    await p.selectOption('#f-segmento', 'Distribuidora');
    await p.fill('#f-sistema', 'Bling');
    await p.fill('#f-problema', 'curto');
    await p.click('#revisar');
    ok((await p.getAttribute('#f-problema', 'aria-invalid')) === 'true', 'problema com menos de 10 letras é recusado');
    const problema = 'Diferença de 10% no saldo? Usamos #pedido & "aspas".\n\n\n\nSegunda linha 😅';
    await p.fill('#f-problema', problema);
    ok((await p.textContent('#c-problema')).startsWith(String(problema.length)), 'contador de caracteres');
    await p.click('#revisar');
    ok(await p.locator('#revisao').isVisible() && await p.locator('#form-orcamento').isHidden(), 'abre a revisão');
    ok(await p.evaluate(() => document.activeElement.id === 'revisao-titulo'), 'foco no título da revisão');
    const href = await p.getAttribute('#abrir-whats', 'href');
    const esperado = 'Olá, Arthur! Quero solicitar uma avaliação de estoque.\n\nNome: José da Silva\nEmpresa: Ferragens & Cia Ltda\nLocal: Brás, São Paulo\nSegmento: Distribuidora\nSistema: Bling\n\nPrincipal problema:\nDiferença de 10% no saldo? Usamos #pedido & "aspas".\n\nSegunda linha 😅';
    ok(href.startsWith('https://wa.me/5511950600817?text='), 'link vai para o WhatsApp certo');
    const txt = decodeURIComponent(href.split('?text=')[1]);
    ok(txt === esperado, 'mensagem decodificada igual à esperada');
    if (txt !== esperado) console.log(JSON.stringify(txt));
    ok(!/[ &#"\n]/.test(href.split('?text=')[1]), 'texto codificado na URL (sem espaço, &, #, aspas ou quebra crus)');
    ok((await p.textContent('#revisao-texto')) === esperado, 'texto mostrado na revisão é o mesmo do link');
    ok(!/SKUs|Prazo|Interesse/.test(txt), 'só campos preenchidos entram');
    const [pop] = await Promise.all([p.waitForEvent('popup', { timeout: 3000 }).catch(() => null), p.click('#abrir-whats')]);
    ok(pop && pop.url().startsWith('https://wa.me/5511950600817') || pop !== null, 'botão abre o WhatsApp em nova aba');
    if (pop) await pop.close();
    ok(/só é enviada quando você tocar em enviar/.test(await p.textContent('#revisao-status')), 'aviso honesto depois de abrir');
    await p.click('#editar');
    ok(await p.locator('#form-orcamento').isVisible() && (await p.inputValue('#f-empresa')) === 'Ferragens & Cia Ltda', 'Editar volta ao formulário com os dados');
    await p.click('.trilha a[data-interesse="Diagnóstico de gestão"]');
    ok((await p.inputValue('#f-interesse')) === 'Diagnóstico de gestão', 'botão do serviço preenche o interesse');
    await p.click('#revisar');
    ok(decodeURIComponent((await p.getAttribute('#abrir-whats', 'href')).split('?text=')[1]).includes('Interesse: Diagnóstico de gestão'), 'interesse entra na mensagem');
    await p.click('#editar');
    await p.evaluate(() => { document.getElementById('f-site').value = 'spam'; });
    await p.click('#revisar');
    ok(await p.locator('#revisao').isHidden(), 'campo-armadilha preenchido bloqueia');
    await p.context().close();
  }

  // 5. consistência dos números do exemplo
  {
    const p = await nova({ viewport: { width: 1366, height: 900 } });
    await p.goto(U, { waitUntil: 'networkidle' });
    const d = await p.evaluate(() => {
      const t = s => document.querySelector(s).textContent.trim();
      const linhas = [...document.querySelectorAll('#tabela-rel tbody tr')].map(tr => ({ nome: tr.querySelector('th').textContent.trim(), sis: +tr.dataset.sis, fis: +tr.dataset.fis, custo: +tr.dataset.custo, cel: [...tr.querySelectorAll('td')].map(td => td.textContent.trim()) }));
      const barras = [...document.querySelectorAll('.barras li')].map(li => ({ nome: li.querySelector('.b-nome').textContent.trim(), valor: li.querySelector('.b-valor').textContent.trim(), w: parseFloat(li.querySelector('i').style.getPropertyValue('--v')), tipo: li.className }));
      const kp = [...document.querySelectorAll('.rel-kpis > div')].map(d => [...d.querySelectorAll('dd')].map(x => x.textContent.trim()));
      const hero = [...document.querySelectorAll('.painel-kpis .kpi')].map(d => d.querySelector('.kpi-num').textContent.trim() + '|' + d.querySelector('small').textContent.trim());
      const heroLinhas = [...document.querySelectorAll('.painel-tabela tbody tr')].map(tr => [tr.querySelector('th').textContent.trim(), ...[...tr.querySelectorAll('td')].map(td => td.textContent.trim())]);
      const comp = [...document.querySelectorAll('.barra-comp span')].map(s => parseFloat(s.style.getPropertyValue('--v')));
      return { linhas, barras, kp, hero, heroLinhas, comp, outros: t('.linha-outros td'), total: t('.linha-total td'), destaque: t('.destaque-dado'), liquido: t('.liquido'), leg: t('#comp-leg'), medidor: parseFloat(document.querySelector('.medidor i').style.getPropertyValue('--v')) };
    });
    const brl = v => (v < 0 ? '−' : '+') + 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let F = 0, S = 0, nf = 0, ns = 0, linhasOk = true;
    d.linhas.forEach(l => {
      const dif = l.fis - l.sis, imp = Math.round(dif * l.custo * 100) / 100;
      const exp = [String(l.sis), String(l.fis), (dif > 0 ? '+' : '−') + Math.abs(dif), 'R$ ' + l.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }), brl(imp)];
      if (JSON.stringify(exp) !== JSON.stringify(l.cel)) { linhasOk = false; console.log('  linha', l.nome, l.cel, exp); }
      if (imp < 0) { F += -imp; nf++; } else { S += imp; ns++; }
    });
    ok(linhasOk, 'cada linha: diferença = físico − sistema e impacto = diferença × custo');
    const outrosF = num(d.outros.match(/−R\$ [\d.,]+/)[0]) * -1, outrosS = num(d.outros.match(/\+R\$ [\d.,]+/)[0]);
    const onf = +d.outros.match(/(\d+) faltas/)[1], ons = +d.outros.match(/(\d+) sobras/)[1];
    const TF = Math.round((F + outrosF) * 100) / 100, TS = Math.round((S + outrosS) * 100) / 100;
    ok(d.total.includes(brl(-TF).replace('+', '')) && d.total.includes(brl(TS)), `total da tabela = linhas + outras (faltas ${TF}, sobras ${TS})`);
    const nTotF = nf + onf, nTotS = ns + ons;
    ok(d.kp[2][0] === 'R$ ' + TF.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) && d.kp[2][1] === nTotF + ' itens', 'KPI faltas confere com a tabela');
    ok(d.kp[3][0] === 'R$ ' + TS.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) && d.kp[3][1] === nTotS + ' itens', 'KPI sobras confere com a tabela');
    const tot = +d.kp[0][0], bate = tot - nTotF - nTotS;
    ok(d.kp[1][1] === `${bate} de ${tot}` && d.kp[1][0] === (bate / tot * 100).toFixed(1).replace('.', ',') + '%', `itens que batem ${bate}/${tot} = ${d.kp[1][0]}`);
    ok(JSON.stringify(d.hero) === JSON.stringify([d.kp[1][0] + '|' + d.kp[1][1], d.kp[2][0] + '|' + d.kp[2][1], d.kp[3][0] + '|' + d.kp[3][1]]), 'painel da primeira dobra = KPIs do relatório');
    ok(Math.abs(d.medidor - bate / tot * 100) < .1, 'medidor do painel = % que bate');
    ok(Math.abs(d.comp[0] - bate / tot * 100) < .01 && Math.abs(d.comp[1] - nTotF / tot * 100) < .01 && Math.abs(d.comp[2] - nTotS / tot * 100) < .01, 'barra de composição proporcional');
    ok(d.leg.includes(bate + ' batem') && d.leg.includes(nTotF + ' com falta') && d.leg.includes(nTotS + ' com sobra'), 'legenda da composição');
    const outrasN = await p.evaluate(() => +document.querySelector('.linha-outros th').textContent.match(/\d+/)[0]);
    ok(outrasN === onf + ons && outrasN + d.linhas.length === nTotF + nTotS, `"Outras ${outrasN} divergências" fecha com ${nTotF + nTotS} divergentes`);
    const max = Math.max(...d.linhas.map(l => Math.abs((l.fis - l.sis) * l.custo)));
    const barrasOk = d.barras.length === d.linhas.length && d.barras.every((bb, i) => { const l = d.linhas[i]; const imp = Math.round((l.fis - l.sis) * l.custo * 100) / 100; return bb.nome === l.nome && bb.valor === brl(imp) && Math.abs(bb.w - Math.abs(imp) / max * 100) < .02 && bb.tipo === (imp < 0 ? 'falta' : 'sobra'); });
    ok(barrasOk, 'gráfico = tabela (nome, valor, cor e largura)');
    const top8 = Math.round((F + S) * 100) / 100, totAbs = Math.round((TF + TS) * 100) / 100;
    ok(d.destaque.includes('R$ ' + top8.toLocaleString('pt-BR', { minimumFractionDigits: 2 })) && d.destaque.includes('R$ ' + totAbs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })) && d.destaque.includes(' ' + Math.round(top8 / totAbs * 100) + '% '), `destaque: ${top8} de ${totAbs}`);
    ok(d.liquido.includes(brl(Math.round((TS - TF) * 100) / 100).replace('+', '')), 'diferença líquida = sobras − faltas');
    const heroOk = d.heroLinhas.every(h => { const l = d.linhas.find(x => x.nome.startsWith(h[0].split(' (')[0]) || x.nome === h[0]); if (!l) return h[3] === 'bate' && h[1] === h[2]; return h[1] === String(l.sis) && h[2] === String(l.fis) && h[3].startsWith(l.cel[2]) && h[3].endsWith(l.cel[4]); });
    ok(heroOk, 'linhas do painel = linhas do relatório');
    // fonte única: tools/demo.json (ranking, outras divergências, absoluto e líquido)
    {
      const D = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'tools', 'demo.json'), 'utf8'));
      const imp = i => Math.round((i.fis - i.sis) * i.custo * 100) / 100;
      const menorTop = Math.min(...D.principais.map(i => Math.abs(imp(i))));
      const maiorOutra = Math.max(...D.outras.map(i => Math.abs(imp(i))));
      ok(maiorOutra < menorTop, `ranking: maior das "outras" (${maiorOutra}) < 8ª maior (${menorTop})`);
      const oF = Math.round(D.outras.filter(i => imp(i) < 0).reduce((a, i) => a - imp(i), 0) * 100) / 100;
      const oS = Math.round(D.outras.filter(i => imp(i) > 0).reduce((a, i) => a + imp(i), 0) * 100) / 100;
      ok(Math.abs(oF - outrosF) < .005 && Math.abs(oS - outrosS) < .005 && D.outras.length === outrasN, `linha "outras" = demo.json (${oF} / ${oS})`);
      ok(JSON.stringify(D.principais.map(i => i.nome).sort()) === JSON.stringify(d.linhas.map(l => l.nome).sort()), 'tabela = 8 principais do demo.json');
      const extra = await p.evaluate(() => ({ abs: document.querySelector('.linha-abs td').textContent.trim(), somas: [...document.querySelectorAll('.rel-somas dd')].map(x => x.textContent.trim()), outrosTh: document.querySelector('.linha-outros th').textContent }));
      const fmt = v => 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      ok(extra.abs === fmt(totAbs) && extra.somas[2] === fmt(totAbs), `valor absoluto = faltas + sobras (${totAbs})`);
      ok(extra.somas[0] === fmt(TF) && extra.somas[1] === fmt(TS) && extra.somas[3] === brl(Math.round((TS - TF) * 100) / 100), 'quadro de somas: faltas, sobras e líquida separadas');
      ok(extra.outrosTh.includes(fmt(menorTop)), 'linha "outras" informa o teto de cada divergência');
      ok(Math.abs(top8 + outrosF + outrosS - totAbs) < .005, 'reconciliação: 8 maiores + outras = valor absoluto');
    }
    await p.context().close();
  }

  // 6. acessibilidade básica + contraste
  {
    const p = await nova({ viewport: { width: 1366, height: 900 } });
    await p.goto(U, { waitUntil: 'networkidle' });
    const a = await p.evaluate(() => {
      const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => +h.tagName[1]);
      const saltos = hs.filter((n, i) => i && n > hs[i - 1] + 1);
      const semRotulo = [...document.querySelectorAll('input, select, textarea')].filter(el => !el.closest('.armadilha') && !(el.id && document.querySelector(`label[for="${el.id}"]`))).map(e => e.name);
      const semAlt = [...document.querySelectorAll('img')].filter(i => !i.hasAttribute('alt')).length;
      const botoesSemNome = [...document.querySelectorAll('button, a')].filter(b => !b.textContent.trim() && !b.getAttribute('aria-label')).length;
      const lum = c => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
      const fundo = el => { while (el) { const c = getComputedStyle(el).backgroundColor; const m = c.match(/[\d.]+/g); if (m && (m.length < 4 || +m[3] > .9)) return c; el = el.parentElement; } return 'rgb(255,255,255)'; };
      const baixos = [];
      document.querySelectorAll('body *').forEach(el => {
        if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
        if (el.closest('.sr, .armadilha, [hidden], .pular, .cta-movel')) return;
        const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
        if (el.matches('.entrada') || el.closest('select, option, datalist')) return;
        const l1 = lum(cs.color), l2 = lum(fundo(el)); const r = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
        const grande = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700);
        if (r < (grande ? 3 : 4.5)) baixos.push(el.tagName + '.' + el.className + ' "' + el.textContent.trim().slice(0, 25) + '" ' + r.toFixed(2));
      });
      return { h1: hs.filter(n => n === 1).length, saltos, semRotulo, semAlt, botoesSemNome, baixos, lang: document.documentElement.lang };
    });
    ok(a.h1 === 1 && !a.saltos.length, 'um h1 e títulos sem pular nível');
    ok(!a.semRotulo.length, 'todo campo tem rótulo ' + a.semRotulo);
    ok(!a.semAlt && !a.botoesSemNome, 'imagens com alt e botões/links com nome');
    ok(!a.baixos.length, 'contraste mínimo AA ' + a.baixos.slice(0, 8).join(' | '));
    ok(a.lang === 'pt-BR', 'lang pt-BR');
    // placeholder contraste
    const ph = await p.evaluate(() => getComputedStyle(document.querySelector('#f-local'), '::placeholder').color);
    console.log('     placeholder', ph);
    // foco visível
    await p.focus('#revisar'); await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Tab');
    const foco = await p.evaluate(() => { const cs = getComputedStyle(document.activeElement); return cs.outlineStyle + ' ' + cs.outlineWidth; });
    ok(/solid 3px/.test(foco), 'foco visível no botão: ' + foco);
    await p.context().close();
  }

  // 7. movimento reduzido e sem JavaScript
  {
    const p = await nova({ viewport: { width: 1366, height: 900 }, reducedMotion: 'reduce' });
    await p.goto(U, { waitUntil: 'networkidle' });
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('.painel-tabela tbody tr')).animationName === 'none' && getComputedStyle(document.documentElement).scrollBehavior === 'auto'), 'movimento reduzido desliga animação e rolagem suave');
    await p.context().close();
    const q = await nova({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    await q.goto(U, { waitUntil: 'networkidle' });
    const r = await q.evaluate(() => ({ links: [...document.querySelectorAll('#menu a')].filter(a => a.getBoundingClientRect().width > 0).length, sw: document.documentElement.scrollWidth, cta: getComputedStyle(document.getElementById('cta-movel')).display, num: document.querySelector('.kpi-num').textContent }));
    ok(r.links >= 6 && r.sw <= 390 && r.cta === 'none' && r.num === '78,7%', 'sem JavaScript: menu visível, sem rolagem lateral, números visíveis');
    await q.screenshot({ path: `${out}/nojs.png` });
    await q.context().close();
  }

  // 8. app e erros de console
  {
    const p = await nova({ viewport: { width: 1280, height: 800 } });
    await p.goto(U + 'app/', { waitUntil: 'networkidle' }); await p.waitForTimeout(500);
    ok(await p.locator('text=Projetos').first().isVisible(), 'app de contagem abre');
    await p.context().close();
  }
  ok(!erros.length, 'sem erros de console/404: ' + erros.slice(0, 5).join(' | '));
  await b.close();
  console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
})();
