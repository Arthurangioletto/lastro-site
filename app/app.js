// Lastro Contagem — ferramenta de inventário e Raio-X do Estoque.
// Tudo fica neste aparelho (IndexedDB). Funciona sem internet depois de aberto uma vez.
(function () {
  "use strict";

  // ---------- utilidades ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const qtd = (v) => (v === null || v === undefined ? "—" : Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 }));
  const reais = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const pct = (v) => (v === null || !isFinite(v) ? "—" : (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%");
  const dataBR = (d) => { if (!d) return "—"; const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : new Date(d).toLocaleDateString("pt-BR"); };
  const itens = (n, um = "item", varios = "itens") => `${n} ${n === 1 ? um : varios}`;
  const horaBR = (d) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const numBR = (s) => {
    if (s === null || s === undefined) return null;
    if (typeof s === "number") return isFinite(s) ? s : null;
    let t = String(s).trim().replace(/[R$\s]/g, "");
    if (!t) return null;
    if (t.includes(",") && t.includes(".")) t = t.lastIndexOf(",") > t.lastIndexOf(".") ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
    else if (t.includes(",")) t = t.replace(",", ".");
    const n = Number(t);
    return isFinite(n) ? n : null;
  };
  const norm = (s) => String(s ?? "").trim().toUpperCase();
  const normNum = (s) => { const t = norm(s); return /^\d+$/.test(t) ? t.replace(/^0+(?=\d)/, "") : t; };
  const chaveDe = (cod, lote) => norm(cod) + (lote ? "|" + norm(lote) : "");

  function aviso(txt, tipo = "") {
    const el = document.createElement("div");
    el.className = "aviso " + tipo; el.textContent = txt;
    $("#avisos").append(el);
    setTimeout(() => el.remove(), tipo === "erro" ? 5500 : 3000);
  }
  let audio;
  function bipe(ok = true) {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = (f, i, d) => { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = f; g.gain.value = .06; o.connect(g); g.connect(audio.destination); o.start(audio.currentTime + i); o.stop(audio.currentTime + i + d); };
      ok ? t(1750, 0, .08) : (t(240, 0, .14), t(200, .18, .18));
    } catch {}
  }
  function baixar(nome, conteudo, tipo) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    a.download = nome; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  const csv = (linhas) => "﻿" + linhas.map((l) => l.map((v) => { const t = v === null || v === undefined ? "" : String(v); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; }).join(";")).join("\r\n");
  const dec = (v) => (v === null || v === undefined ? "" : String(v).replace(".", ","));
  const guarda = { ler(k, d) { try { const v = localStorage.getItem("lastro:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, gravar(k, v) { try { localStorage.setItem("lastro:" + k, JSON.stringify(v)); } catch {} } };

  // ---------- banco local (IndexedDB) ----------
  let db;
  function abrirBanco() {
    return new Promise((ok, falha) => {
      const r = indexedDB.open("lastro-contagem", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("projetos", { keyPath: "id" });
      r.onsuccess = () => { db = r.result; ok(); };
      r.onerror = () => falha(r.error);
    });
  }
  const tx = (modo, fn) => new Promise((ok, falha) => {
    const t = db.transaction("projetos", modo); const s = t.objectStore("projetos");
    const r = fn(s); t.oncomplete = () => ok(r && r.result); t.onerror = () => falha(t.error);
  });
  const listar = () => tx("readonly", (s) => s.getAll());
  const pegar = (id) => tx("readonly", (s) => s.get(id));
  const salvar = (p) => { p.atualizadoEm = new Date().toISOString(); return tx("readwrite", (s) => s.put(p)); };
  const apagar = (id) => tx("readwrite", (s) => s.delete(id));

  // ---------- leitura de código (leitor USB, câmera, GS1) ----------
  function lerCodigo(bruto) {
    let s = String(bruto || "").replace(/^\][A-Za-z]\d/, "").trim();
    const r = { bruto: s, codigos: [], lote: null };
    const add = (v) => { v = String(v || "").trim(); if (v && !r.codigos.includes(v)) r.codigos.push(v); };
    const par = s.match(/\(01\)(\d{14})/); const lotePar = s.match(/\(10\)([^(]+)/);
    if (par) { add(par[1]); add(par[1].slice(1)); }
    if (lotePar) r.lote = lotePar[1].replace(/\x1D/g, "").trim();
    const cru = !par && s.match(/^01(\d{14})/);
    if (cru) {
      add(cru[1]); add(cru[1].slice(1));
      const resto = s.slice(16); const m = resto.match(/(?:^|\x1D)(?:17\d{6})?10([^\x1D]+)/);
      if (m) r.lote = m[1];
    }
    add(s);
    return r;
  }

  // ---------- regras: lista, conciliação, amostra ----------
  function indice(p) {
    const porChave = new Map(), porCod = new Map(), porBarras = new Map();
    for (const it of p.base?.itens || []) {
      porChave.set(it.chave, it);
      const c = norm(it.cod); if (!porCod.has(c)) porCod.set(c, []); porCod.get(c).push(it);
      if (it.barras) { const b = normNum(it.barras); if (!porBarras.has(b)) porBarras.set(b, []); porBarras.get(b).push(it); }
    }
    return { porChave, porCod, porBarras };
  }
  function achar(p, idx, bruto) {
    const l = lerCodigo(bruto);
    let achados = [];
    for (const c of l.codigos) { achados = idx.porBarras.get(normNum(c)) || idx.porCod.get(norm(c)) || []; if (achados.length) break; }
    if (achados.length > 1 && l.lote) { const um = achados.filter((it) => norm(it.lote) === norm(l.lote)); if (um.length) achados = um; }
    return { leitura: l, itens: achados };
  }
  function lista(p) {
    if (!p.base) return [];
    if (p.tipo === "raiox") return p.amostra ? p.amostra.chaves : [];
    return p.base.itens.map((it) => it.chave);
  }
  function conciliar(p) {
    const idx = indice(p);
    const naLista = new Set(lista(p));
    const soma = new Map(); // chave -> {r1, r2, n1, n2}
    const semCad = new Map();
    for (const c of p.contagens || []) {
      if (!c.chave) {
        const k = norm(c.desc) + "|" + norm(c.codLido);
        const g = semCad.get(k) || { desc: c.desc, codLido: c.codLido, qtd: 0, ends: new Set() };
        g.qtd += c.qtd; if (c.end) g.ends.add(c.end); semCad.set(k, g); continue;
      }
      const s = soma.get(c.chave) || { r1: 0, r2: 0, n1: 0, n2: 0, ends: new Set() };
      if (c.rodada === 2) { s.r2 += c.qtd; s.n2++; } else { s.r1 += c.qtd; s.n1++; }
      if (c.end) s.ends.add(c.end);
      soma.set(c.chave, s);
    }
    const zero = p.decisoes?.zero || {};
    const chaves = new Set([...naLista, ...soma.keys()]);
    const linhas = [];
    for (const k of chaves) {
      const it = idx.porChave.get(k); if (!it) continue;
      const s = soma.get(k) || { r1: 0, r2: 0, n1: 0, n2: 0, ends: new Set() };
      const fis = s.n2 ? s.r2 : s.n1 ? s.r1 : zero[k] ? 0 : null;
      const dif = fis === null ? null : Math.round((fis - it.saldo) * 1000) / 1000;
      const valor = dif === null ? null : Math.round(dif * (it.custo || 0) * 100) / 100;
      const status = dif === null ? "pendente" : dif === 0 ? "bate" : dif < 0 ? "falta" : "sobra";
      linhas.push({
        ...it, r1: s.n1 ? s.r1 : null, r2: s.n2 ? s.r2 : null, fis, dif, valor, status, naLista: naLista.has(k),
        recontar: s.n1 > 0 && !s.n2 && s.r1 !== it.saldo, recontagemDiferente: s.n1 > 0 && s.n2 > 0 && s.r1 !== s.r2,
        endsContados: [...s.ends].join(", "), zerado: !s.n1 && !s.n2 && !!zero[k],
      });
    }
    const contados = linhas.filter((l) => l.naLista && l.fis !== null);
    const batem = contados.filter((l) => l.status === "bate").length;
    const faltas = linhas.filter((l) => l.status === "falta"), sobras = linhas.filter((l) => l.status === "sobra");
    const vFaltas = faltas.reduce((a, l) => a + Math.abs(l.valor), 0), vSobras = sobras.reduce((a, l) => a + l.valor, 0);
    const valorBase = (p.base?.itens || []).reduce((a, it) => a + Math.abs(it.saldo * (it.custo || 0)), 0);
    const valorLista = linhas.filter((l) => l.naLista).reduce((a, l) => a + Math.abs(l.saldo * (l.custo || 0)), 0);
    return {
      linhas, semCadastro: [...semCad.values()].map((g) => ({ ...g, ends: [...g.ends].join(", ") })),
      tamanhoLista: naLista.size, contados: contados.length, batem, acuracidade: contados.length ? batem / contados.length : null,
      faltas: faltas.length, sobras: sobras.length, vFaltas: Math.round(vFaltas * 100) / 100, vSobras: Math.round(vSobras * 100) / 100,
      pendentes: linhas.filter((l) => l.naLista && l.fis === null).length, aRecontar: linhas.filter((l) => l.recontar).length,
      foraDaLista: linhas.filter((l) => !l.naLista).length, valorBase, valorLista,
      semCusto: (p.base?.itens || []).filter((it) => !it.custo).length,
    };
  }
  function gerarAmostra(p, nTop, nAleat, semente) {
    const itens = [...p.base.itens];
    const temCusto = itens.some((it) => it.custo > 0);
    const peso = (it) => Math.abs(it.saldo * (temCusto ? it.custo || 0 : 1));
    itens.sort((a, b) => peso(b) - peso(a));
    const top = itens.slice(0, nTop);
    let resto = itens.slice(nTop);
    let x = semente >>> 0;
    const rnd = () => { x |= 0; x = (x + 0x6D2B79F5) | 0; let t = Math.imul(x ^ (x >>> 15), 1 | x); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = resto.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [resto[i], resto[j]] = [resto[j], resto[i]]; }
    const aleat = resto.slice(0, nAleat);
    return { geradaEm: new Date().toISOString(), nTop: top.length, nAleat: aleat.length, semente, porCusto: temCusto, chaves: [...top, ...aleat].map((it) => it.chave), topo: top.map((it) => it.chave) };
  }

  // ---------- rotas ----------
  const tela = $("#tela");
  const ir = (h) => { if (location.hash === "#" + h) desenhar(); else location.hash = h; };
  async function desenhar() {
    pararCamera();
    const [r, id, sub] = location.hash.replace(/^#/, "").split("/");
    try {
      if (r === "p" && id) {
        const p = await pegar(id);
        if (!p) { aviso("Projeto não encontrado.", "erro"); return ir("projetos"); }
        const telas = { base: telaBase, amostra: telaAmostra, contar: telaContar, conciliar: telaConciliar, relatorio: telaRelatorio };
        return (telas[sub] || telaResumo)(p);
      }
      return telaProjetos();
    } catch (e) { console.error(e); tela.innerHTML = `<div class="bloco"><p class="vazio">Algo deu errado: ${esc(e.message)}</p></div>`; }
    finally { window.scrollTo(0, 0); }
  }

  function passos(p, atual) {
    const c = p.base ? conciliar(p) : null;
    const itens = [
      ["", "Resumo", true],
      ["base", "1. Base do cliente", !!p.base],
      ...(p.tipo === "raiox" ? [["amostra", "2. Amostra", !!p.amostra]] : []),
      ["contar", (p.tipo === "raiox" ? "3" : "2") + ". Contar", c && c.contados > 0],
      ["conciliar", (p.tipo === "raiox" ? "4" : "3") + ". Conciliar", c && c.contados > 0 && !c.pendentes && !c.aRecontar],
      ["relatorio", (p.tipo === "raiox" ? "5" : "4") + ". Relatório", false],
    ];
    return `<nav class="passos-proj" aria-label="Etapas do projeto">${itens.map(([s, rot, ok]) => `<a href="#p/${p.id}${s ? "/" + s : ""}" class="${ok ? "ok" : ""}" ${atual === s ? 'aria-current="page"' : ""}>${rot}</a>`).join("")}</nav>`;
  }
  const cabecalho = (p, titulo, extra = "") => `<a class="voltar" href="#projetos">Projetos</a>
    <div class="cabeca"><div><h1>${esc(titulo)}</h1><p>${esc(p.cliente)} · ${p.tipo === "raiox" ? "Raio-X do Estoque" : "Inventário completo"} · ${dataBR(p.data)}</p></div>${extra}</div>`;

  // ---------- projetos ----------
  async function telaProjetos() {
    const ps = (await listar()).sort((a, b) => String(b.atualizadoEm).localeCompare(String(a.atualizadoEm)));
    tela.innerHTML = `
      <div class="cabeca"><div><h1>Projetos</h1><p>Cada cliente é um projeto. Os dados ficam só neste aparelho.</p></div>
        <div class="linha-btn"><label class="btn btn-b">Abrir backup<input type="file" accept=".json" id="abrir-backup" class="sr"></label></div></div>
      <section class="bloco"><header><h2>Novo projeto</h2></header>
        <form class="corpo" id="fnovo"><div class="grade">
          <label class="campo"><span>Cliente</span><input class="entrada" name="cliente" required maxlength="80"></label>
          <label class="campo"><span>Tipo</span><select class="entrada" name="tipo"><option value="raiox">Raio-X do Estoque (amostra)</option><option value="completo">Inventário completo</option></select></label>
          <label class="campo"><span>Data da contagem</span><input class="entrada" name="data" type="date" value="${new Date().toISOString().slice(0, 10)}"></label>
          <label class="campo"><span>Responsável</span><input class="entrada" name="responsavel" value="${esc(guarda.ler("responsavel", ""))}" maxlength="60"></label>
        </div><div class="linha-btn" style="margin-top:1rem"><button class="btn btn-p" type="submit">Criar projeto</button></div></form></section>
      <div class="projetos">${ps.length ? ps.map((p) => {
        const c = p.base ? conciliar(p) : null;
        return `<a class="projeto" href="#p/${p.id}"><div><b>${esc(p.cliente)}</b><span>${p.tipo === "raiox" ? "Raio-X" : "Inventário completo"} · ${dataBR(p.data)}</span></div>
          <span>${!p.base ? "sem base" : `${c.contados} de ${c.tamanhoLista} contados · ${pct(c.acuracidade)} batem`}</span></a>`;
      }).join("") : '<p class="vazio">Nenhum projeto ainda. Crie o primeiro acima.</p>'}</div>`;
    $("#fnovo").onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      if (!d.cliente.trim()) return aviso("Escreva o nome do cliente.", "erro");
      guarda.gravar("responsavel", d.responsavel);
      const p = { id: uid(), cliente: d.cliente.trim(), tipo: d.tipo, data: d.data, responsavel: d.responsavel.trim(), criadoEm: new Date().toISOString(), base: null, amostra: null, contagens: [], decisoes: { zero: {} }, relatorio: { causas: "", limitacoes: "", plano: [] } };
      await salvar(p); ir(`p/${p.id}/base`);
    };
    $("#abrir-backup").onchange = (e) => importarBackup(e.target.files[0]);
  }

  async function importarBackup(arq, projetoAtual) {
    if (!arq) return;
    let dado;
    try { dado = JSON.parse(await arq.text()); } catch { return aviso("Esse arquivo não é um backup do Lastro Contagem.", "erro"); }
    if (!dado || dado.formato !== "lastro-contagem" || !dado.projeto?.id) return aviso("Esse arquivo não é um backup do Lastro Contagem.", "erro");
    const novo = dado.projeto;
    const atual = await pegar(novo.id);
    if (!atual) { await salvar(novo); aviso("Projeto aberto a partir do backup.", "ok"); return ir(`p/${novo.id}`); }
    // mesmo projeto: junta contagens que ainda não existem aqui (ex.: celular do ajudante)
    const ids = new Set(atual.contagens.map((c) => c.id));
    const extras = (novo.contagens || []).filter((c) => !ids.has(c.id));
    atual.contagens.push(...extras);
    await salvar(atual);
    aviso(`${extras.length} contagens novas juntadas ao projeto.`, "ok");
    ir(`p/${atual.id}${projetoAtual ? "/conciliar" : ""}`);
  }
  function exportarBackup(p) {
    baixar(`lastro-${p.cliente.replace(/[^\w-]+/g, "_")}-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ formato: "lastro-contagem", versao: 1, exportadoEm: new Date().toISOString(), projeto: p }), "application/json");
  }

  // ---------- resumo do projeto ----------
  function telaResumo(p) {
    const c = p.base ? conciliar(p) : null;
    tela.innerHTML = cabecalho(p, p.cliente, `<div class="linha-btn"><button class="btn btn-b" id="bkp">Baixar backup</button><label class="btn btn-b">Juntar contagens de outro aparelho<input type="file" accept=".json" id="juntar" class="sr"></label></div>`) + passos(p, "") +
      (c ? `<dl class="numeros">
        <div><dt>Contados</dt><dd>${c.contados}</dd><small>de ${c.tamanhoLista} na lista</small></div>
        <div><dt>Itens que batem</dt><dd>${pct(c.acuracidade)}</dd><small>${itens(c.batem)}</small></div>
        <div><dt>Faltas</dt><dd class="v-falta">${reais(c.vFaltas)}</dd><small>${itens(c.faltas)}</small></div>
        <div><dt>Sobras</dt><dd class="v-sobra">${reais(c.vSobras)}</dd><small>${itens(c.sobras)}</small></div></dl>` : "") +
      `<section class="bloco"><header><h2>Próximo passo</h2></header><div class="corpo">${proximo(p, c)}</div></section>
       <section class="bloco"><header><h2>Projeto</h2></header><form class="corpo" id="fproj"><div class="grade">
        <label class="campo"><span>Cliente</span><input class="entrada" name="cliente" value="${esc(p.cliente)}"></label>
        <label class="campo"><span>Data</span><input class="entrada" name="data" type="date" value="${esc(p.data)}"></label>
        <label class="campo"><span>Responsável</span><input class="entrada" name="responsavel" value="${esc(p.responsavel)}"></label></div>
        <div class="linha-btn" style="margin-top:1rem"><button class="btn btn-p" type="submit">Salvar</button><button class="btn btn-perigo" type="button" id="apagar">Apagar projeto deste aparelho</button></div></form></section>`;
    $("#bkp").onclick = () => exportarBackup(p);
    $("#juntar").onchange = (e) => importarBackup(e.target.files[0], true);
    $("#fproj").onsubmit = async (e) => { e.preventDefault(); Object.assign(p, Object.fromEntries(new FormData(e.target))); await salvar(p); aviso("Salvo.", "ok"); desenhar(); };
    $("#apagar").onclick = async () => {
      if (!confirm(`Apagar o projeto "${p.cliente}" deste aparelho? Baixe um backup antes se for precisar dos dados.`)) return;
      await apagar(p.id); aviso("Projeto apagado."); ir("projetos");
    };
  }
  function proximo(p, c) {
    if (!p.base) return `<p>Importe a planilha de saldo que o cliente enviou.</p><div class="linha-btn" style="margin-top:.8rem"><a class="btn btn-p" href="#p/${p.id}/base">Importar base</a></div>`;
    if (p.tipo === "raiox" && !p.amostra) return `<p>Gere a amostra do Raio-X: os itens de maior valor e uma parte sorteada.</p><div class="linha-btn" style="margin-top:.8rem"><a class="btn btn-p" href="#p/${p.id}/amostra">Gerar amostra</a></div>`;
    if (c.pendentes) return `<p>Faltam ${c.pendentes} itens da lista para contar${c.aRecontar ? ` e ${c.aRecontar} para recontar` : ""}.</p><div class="linha-btn" style="margin-top:.8rem"><a class="btn btn-p" href="#p/${p.id}/contar">Contar</a></div>`;
    if (c.aRecontar) return `<p>${c.aRecontar} itens deram diferença na 1ª contagem e precisam de recontagem.</p><div class="linha-btn" style="margin-top:.8rem"><a class="btn btn-p" href="#p/${p.id}/contar">Recontar</a></div>`;
    return `<p>Contagem completa. Confira a conciliação e gere o relatório.</p><div class="linha-btn" style="margin-top:.8rem"><a class="btn btn-p" href="#p/${p.id}/relatorio">Ver relatório</a><a class="btn btn-b" href="#p/${p.id}/conciliar">Conciliação</a></div>`;
  }

  // ---------- base do cliente ----------
  const CAMPOS = [
    ["cod", "Código do produto", true, ["codigo", "cod", "sku", "produto", "codproduto", "referencia", "ref", "item", "b1cod", "b2cod", "b8produto"]],
    ["desc", "Descrição", true, ["descricao", "desc", "nome", "nomeproduto", "descricaoproduto", "b1desc"]],
    ["saldo", "Saldo no sistema", true, ["saldo", "estoque", "quantidade", "qtd", "qtde", "saldoatual", "estoqueatual", "b2qatu", "b8saldo", "saldolote"]],
    ["custo", "Custo unitário (R$)", false, ["custo", "customedio", "custounitario", "vlrcusto", "precocusto", "cm", "b2cm1", "valorunitario"]],
    ["un", "Unidade", false, ["unidade", "un", "und", "um", "unid", "b1um"]],
    ["barras", "Código de barras", false, ["codigodebarras", "codbarras", "ean", "gtin", "barras", "b1codbar"]],
    ["end", "Endereço / local", false, ["endereco", "local", "localizacao", "prateleira", "posicao", "armazem", "locacao", "bfLocaliz"]],
    ["lote", "Lote", false, ["lote", "lotectl", "b8lotectl"]],
    ["val", "Validade", false, ["validade", "dtvalidade", "vencimento", "b8dtvalid"]],
  ];
  const n2 = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  function acharCabecalho(linhas) {
    let melhor = 0, pontos = -1;
    for (let i = 0; i < Math.min(15, linhas.length); i++) {
      const cel = linhas[i].map(n2);
      const pt = CAMPOS.reduce((a, c) => a + (cel.some((x) => c[3].map(n2).includes(x)) ? 1 : 0), 0) + cel.filter(Boolean).length * 0.01;
      if (pt > pontos) { pontos = pt; melhor = i; }
    }
    return melhor;
  }
  function mapear(cab) {
    const cel = cab.map(n2), usado = new Set(), m = {};
    for (const [k, , , sin] of CAMPOS) {
      const s2 = sin.map(n2); let i = -1;
      for (const s of s2) { i = cel.findIndex((x, j) => x === s && !usado.has(j)); if (i >= 0) break; }
      if (i < 0) for (const s of s2) { if (s.length < 4) continue; i = cel.findIndex((x, j) => x.includes(s) && !usado.has(j)); if (i >= 0) break; }
      if (i >= 0) { m[k] = i; usado.add(i); }
    }
    return m;
  }
  function telaBase(p) {
    tela.innerHTML = cabecalho(p, "Base do cliente") + passos(p, "base") + `
      ${p.base ? `<section class="bloco"><header><div><h2>Base atual</h2><p>${esc(p.base.arquivo)} · importada em ${horaBR(p.base.importadoEm)}</p></div></header>
        <div class="corpo"><p><b>${p.base.itens.length}</b> linhas · valor do estoque no sistema <b>${reais(p.base.itens.reduce((a, it) => a + it.saldo * (it.custo || 0), 0))}</b>${p.base.itens.some((it) => it.lote) ? " · controle por lote" : ""}</p>
        ${p.contagens.length ? '<p class="ajuda" style="margin-top:.5rem">Já existem contagens. Importar outra base mantém as contagens, ligadas pelo código (e lote).</p>' : ""}</div></section>` : ""}
      <label class="soltar" id="soltar"><strong>${p.base ? "Trocar a base" : "Arraste a planilha de saldo do cliente ou toque para escolher"}</strong>
        <span class="ajuda">Excel (.xlsx) ou CSV com código, descrição e saldo. Custo, unidade, código de barras, endereço, lote e validade são opcionais.</span>
        <input type="file" id="arq" accept=".xlsx,.csv,.txt" class="sr"></label>
      <div id="etapa"></div>`;
    const z = $("#soltar");
    $("#arq").onchange = (e) => e.target.files[0] && abrir(e.target.files[0]);
    z.ondragover = (e) => { e.preventDefault(); z.classList.add("sobre"); };
    z.ondragleave = () => z.classList.remove("sobre");
    z.ondrop = (e) => { e.preventDefault(); z.classList.remove("sobre"); e.dataTransfer.files[0] && abrir(e.dataTransfer.files[0]); };

    async function abrir(arq) {
      const et = $("#etapa");
      et.innerHTML = `<section class="bloco" style="margin-top:1rem"><p class="vazio">Lendo ${esc(arq.name)}…</p></section>`;
      let abas;
      try { abas = (await Planilha.ler(arq)).filter((a) => a.linhas.length); } catch (e) { et.innerHTML = `<section class="bloco" style="margin-top:1rem"><p class="vazio">${esc(e.message)}</p></section>`; return; }
      if (!abas.length) { et.innerHTML = `<section class="bloco" style="margin-top:1rem"><p class="vazio">A planilha está vazia.</p></section>`; return; }
      let aba = abas.reduce((a, b) => (b.linhas.length > a.linhas.length ? b : a));
      montar();
      function montar() {
        const iCab = acharCabecalho(aba.linhas);
        const cab = aba.linhas[iCab].map((c, i) => String(c || "").trim() || `Coluna ${i + 1}`);
        const dados = aba.linhas.slice(iCab + 1).filter((l) => l.some((c) => String(c).trim() !== ""));
        const m = mapear(cab);
        et.innerHTML = `<section class="bloco" style="margin-top:1rem"><header><div><h2>${esc(arq.name)}</h2><p>${dados.length} linhas${abas.length > 1 ? ` na aba ${esc(aba.nome)}` : ""}</p></div>
          ${abas.length > 1 ? `<label class="campo"><span>Aba</span><select class="entrada" id="aba">${abas.map((a, i) => `<option value="${i}" ${a === aba ? "selected" : ""}>${esc(a.nome)} (${a.linhas.length})</option>`).join("")}</select></label>` : ""}</header>
          <div class="corpo"><div class="grade">${CAMPOS.map(([k, rot, ob]) => `<label class="campo"><span>${rot}${ob ? " *" : ""}</span><select class="entrada" data-c="${k}"><option value="">${ob ? "Escolha a coluna" : "Não usar"}</option>${cab.map((c, i) => `<option value="${i}" ${m[k] === i ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>`).join("")}</div>
          <h3 style="margin:1.2rem 0 .5rem;font-size:1rem">Prévia</h3><div class="rolagem" id="previa"></div>
          <div class="linha-btn" style="margin-top:1rem"><button class="btn btn-p" id="usar">Usar esta base (${dados.length} linhas)</button></div><p class="retorno erro" id="erro-base"></p></div></section>`;
        if ($("#aba")) $("#aba").onchange = (e) => { aba = abas[Number(e.target.value)]; montar(); };
        const lerM = () => Object.fromEntries($$("[data-c]", et).map((s) => [s.dataset.c, s.value === "" ? null : Number(s.value)]));
        const previa = () => { const mm = lerM(); const vis = CAMPOS.filter(([k]) => mm[k] !== null);
          $("#previa").innerHTML = `<table class="t"><thead><tr>${vis.map(([, r]) => `<th>${r}</th>`).join("")}</tr></thead><tbody>${dados.slice(0, 5).map((l) => `<tr>${vis.map(([k]) => `<td>${esc(l[mm[k]] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`; };
        $$("[data-c]", et).forEach((s) => (s.onchange = previa)); previa();
        $("#usar").onclick = async () => {
          const mm = lerM(), erro = $("#erro-base");
          if (mm.cod === null || mm.desc === null || mm.saldo === null) { erro.textContent = "Escolha as colunas de código, descrição e saldo."; return; }
          const itens = [], vistos = new Map(), problemas = [];
          dados.forEach((l, i) => {
            const cod = String(l[mm.cod] ?? "").trim(); if (!cod) { problemas.push(`linha ${iCab + 2 + i}: sem código`); return; }
            const lote = mm.lote !== null ? String(l[mm.lote] ?? "").trim() : "";
            const chave = chaveDe(cod, lote);
            const saldo = numBR(l[mm.saldo]) ?? 0, custo = mm.custo !== null ? numBR(l[mm.custo]) : null;
            if (vistos.has(chave)) { const it = vistos.get(chave); it.saldo += saldo; if (!it.end && mm.end !== null) it.end = String(l[mm.end] ?? "").trim(); return; } // mesmo item em 2 linhas: soma
            const it = { chave, cod, lote, desc: String(l[mm.desc] ?? "").trim(), saldo, custo: custo ?? 0, un: mm.un !== null ? String(l[mm.un] ?? "").trim() : "", barras: mm.barras !== null ? String(l[mm.barras] ?? "").trim() : "", end: mm.end !== null ? String(l[mm.end] ?? "").trim() : "", val: mm.val !== null ? String(l[mm.val] ?? "").trim() : "" };
            vistos.set(chave, it); itens.push(it);
          });
          if (!itens.length) { erro.textContent = "Nenhuma linha com código encontrada."; return; }
          const trocou = !!p.base;
          p.base = { arquivo: arq.name, importadoEm: new Date().toISOString(), itens };
          if (trocou && p.amostra) { const ok = new Set(itens.map((it) => it.chave)); p.amostra.chaves = p.amostra.chaves.filter((k) => ok.has(k)); }
          await salvar(p);
          aviso(`Base importada: ${itens.length} itens${problemas.length ? `, ${problemas.length} linhas ignoradas` : ""}.`, "ok");
          ir(`p/${p.id}/${p.tipo === "raiox" && !p.amostra ? "amostra" : ""}`);
        };
      }
    }
  }

  // ---------- amostra do Raio-X ----------
  function telaAmostra(p) {
    if (!p.base) return ir(`p/${p.id}/base`);
    const total = p.base.itens.length;
    const a = p.amostra;
    tela.innerHTML = cabecalho(p, "Amostra do Raio-X") + passos(p, "amostra") + `
      <section class="bloco"><header><div><h2>Como a amostra é montada</h2><p>Os itens que mais pesam no valor do estoque, mais uma parte sorteada do restante para medir o todo.</p></div></header>
      <form class="corpo" id="fam"><div class="grade">
        <label class="campo"><span>Itens de maior valor</span><input class="entrada" name="top" inputmode="numeric" value="${a ? a.nTop : Math.min(150, total)}"></label>
        <label class="campo"><span>Itens sorteados</span><input class="entrada" name="aleat" inputmode="numeric" value="${a ? a.nAleat : Math.min(50, Math.max(0, total - 150))}"></label>
        <label class="campo"><span>Número do sorteio</span><input class="entrada" name="semente" inputmode="numeric" value="${a ? a.semente : Math.floor(Math.random() * 9000) + 1000}"><span class="ajuda">Guarde: com o mesmo número a amostra se repete.</span></label>
      </div>${p.contagens.length ? '<p class="ajuda" style="margin-top:.8rem">Já existem contagens: gerar de novo muda a lista, mas não apaga o que foi contado.</p>' : ""}
      <div class="linha-btn" style="margin-top:1rem"><button class="btn btn-p" type="submit">${a ? "Gerar de novo" : "Gerar amostra"}</button></div></form></section>
      ${a ? (() => {
        const idx = indice(p); const its = a.chaves.map((k) => idx.porChave.get(k)).filter(Boolean);
        const vAm = its.reduce((s, it) => s + Math.abs(it.saldo * (it.custo || 0)), 0), vTot = p.base.itens.reduce((s, it) => s + Math.abs(it.saldo * (it.custo || 0)), 0);
        const topo = new Set(a.topo || []);
        return `<section class="bloco"><header><div><h2>${its.length} itens na lista de contagem</h2><p>${a.porCusto ? `Cobrem ${pct(vTot ? vAm / vTot : null)} do valor do estoque no sistema` : "A base não tem custo: os maiores foram escolhidos pela quantidade"}</p></div>
          <button class="btn btn-b" id="baixar-lista" type="button">Baixar lista para imprimir</button></header>
          <div class="rolagem"><table class="t"><thead><tr><th>Código</th><th>Descrição</th><th>Endereço</th><th>Por quê</th></tr></thead><tbody>
          ${its.slice(0, 300).map((it) => `<tr><td>${esc(it.cod)}${it.lote ? `<small>Lote ${esc(it.lote)}</small>` : ""}</td><td>${esc(it.desc)}</td><td>${esc(it.end || "—")}</td><td>${topo.has(it.chave) ? '<span class="selo neutro">Maior valor</span>' : '<span class="selo neutro">Sorteado</span>'}</td></tr>`).join("")}
          </tbody></table></div><div class="corpo"><a class="btn btn-p" href="#p/${p.id}/contar">Começar a contar</a></div></section>`;
      })() : ""}`;
    $("#fam").onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(e.target));
      const top = Math.max(0, Math.floor(numBR(d.top) || 0)), al = Math.max(0, Math.floor(numBR(d.aleat) || 0)), sem = Math.floor(numBR(d.semente) || 1);
      if (!top && !al) return aviso("A amostra precisa de pelo menos 1 item.", "erro");
      p.amostra = gerarAmostra(p, top, al, sem); await salvar(p); aviso("Amostra gerada.", "ok"); desenhar();
    };
    const b = $("#baixar-lista");
    if (b) b.onclick = () => {
      const idx = indice(p);
      const linhas = [["Endereço", "Código", "Lote", "Descrição", "Unidade", "1ª contagem", "Recontagem", "Contador"]];
      p.amostra.chaves.map((k) => idx.porChave.get(k)).filter(Boolean).sort((x, y) => String(x.end).localeCompare(String(y.end), "pt-BR", { numeric: true })).forEach((it) => linhas.push([it.end, it.cod, it.lote, it.desc, it.un, "", "", ""]));
      baixar(`lista-contagem-${p.cliente.replace(/[^\w-]+/g, "_")}.csv`, csv(linhas), "text/csv;charset=utf-8");
    };
  }

  // ---------- contagem ----------
  function telaContar(p) {
    if (!p.base) return ir(`p/${p.id}/base`);
    if (p.tipo === "raiox" && !p.amostra) return ir(`p/${p.id}/amostra`);
    const idx = indice(p);
    let rodada = guarda.ler("rodada:" + p.id, 1);
    let modoBipe = guarda.ler("modoBipe", false);
    const temCamera = "BarcodeDetector" in window && navigator.mediaDevices?.getUserMedia;
    tela.innerHTML = cabecalho(p, "Contar") + passos(p, "contar") + `
      <div class="linha-btn" style="justify-content:space-between">
        <div class="rodada" role="group" aria-label="Rodada"><button type="button" data-r="1">1ª contagem</button><button type="button" data-r="2">Recontagem</button></div>
        <div id="progresso-txt" class="ajuda"></div></div>
      <div class="progresso" style="margin-top:.6rem"><div id="barra-prog" style="width:0"></div></div>
      <div class="grade" style="margin-top:1rem">
        <label class="campo"><span>Quem está contando</span><input class="entrada" id="contador" value="${esc(guarda.ler("contador", p.responsavel || ""))}" maxlength="40"></label>
        <label class="campo"><span>Endereço onde está contando</span><input class="entrada" id="endereco" value="${esc(guarda.ler("end:" + p.id, ""))}" maxlength="40" placeholder="Ex.: B-03"></label>
        <label class="check" style="align-self:end"><input type="checkbox" id="modo-bipe" ${modoBipe ? "checked" : ""}><span>Cada bipe conta 1 unidade e registra na hora</span></label>
      </div>
      <div class="leitor" id="leitor"><div class="laser" aria-hidden="true"></div>
        <label class="campo"><span>Bipe ou digite o código</span><div class="linha"><input class="entrada grande" id="codigo" autocomplete="off" autocapitalize="off" spellcheck="false">${temCamera ? '<button class="btn btn-p" type="button" id="cam">Câmera</button>' : ""}</div></label>
        <p class="retorno" id="retorno" aria-live="polite"></p><div id="cartao"></div></div>
      <section class="bloco" style="margin-top:1rem" id="bloco-recontar"></section>
      <section class="bloco"><header><h2>Últimas contagens</h2><a class="btn btn-t" href="#p/${p.id}/conciliar">Ver tudo na conciliação</a></header><div id="ultimas"></div></section>`;

    const campo = $("#codigo"), retorno = $("#retorno"), leitor = $("#leitor");
    $("#contador").onchange = (e) => guarda.gravar("contador", e.target.value.trim());
    $("#endereco").onchange = (e) => guarda.gravar("end:" + p.id, e.target.value.trim());
    $("#modo-bipe").onchange = (e) => { modoBipe = e.target.checked; guarda.gravar("modoBipe", modoBipe); campo.focus(); };
    $$(".rodada button").forEach((b) => (b.onclick = () => { rodada = Number(b.dataset.r); guarda.gravar("rodada:" + p.id, rodada); pintar(); campo.focus(); }));

    function sinal(ok, txt) { leitor.classList.remove("leu"); void leitor.offsetWidth; if (ok) leitor.classList.add("leu"); retorno.className = "retorno " + (ok ? "ok" : "erro"); retorno.textContent = txt; bipe(ok); }
    function contadoNaRodada(chave) { return p.contagens.filter((c) => c.chave === chave && c.rodada === rodada).reduce((a, c) => a + c.qtd, 0); }

    function pintar() {
      $$(".rodada button").forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.r) === rodada)));
      const c = conciliar(p);
      const feitos = c.tamanhoLista - c.pendentes;
      $("#barra-prog").style.width = (c.tamanhoLista ? (feitos / c.tamanhoLista) * 100 : 0) + "%";
      $("#progresso-txt").textContent = `${feitos} de ${c.tamanhoLista} itens da lista contados · ${c.aRecontar} a recontar`;
      const rec = c.linhas.filter((l) => l.recontar);
      $("#bloco-recontar").innerHTML = rodada === 2
        ? `<header><div><h2>Para recontar (${rec.length})</h2><p>Itens com diferença na 1ª contagem. Conte de novo sem olhar o número anterior.</p></div></header>${rec.length ? `<div class="rolagem"><table class="t"><thead><tr><th>Endereço</th><th>Código</th><th>Descrição</th></tr></thead><tbody>${rec.sort((x, y) => String(x.end).localeCompare(String(y.end), "pt-BR", { numeric: true })).map((l) => `<tr><td>${esc(l.end || l.endsContados || "—")}</td><td>${esc(l.cod)}${l.lote ? `<small>Lote ${esc(l.lote)}</small>` : ""}</td><td>${esc(l.desc)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="vazio">Nada para recontar agora.</p>'}`
        : `<header><div><h2>Faltam contar (${c.pendentes})</h2><p>Itens da lista ainda sem nenhuma contagem.</p></div></header>${c.pendentes ? `<div class="rolagem"><table class="t"><thead><tr><th>Endereço</th><th>Código</th><th>Descrição</th></tr></thead><tbody>${c.linhas.filter((l) => l.naLista && l.fis === null).sort((x, y) => String(x.end).localeCompare(String(y.end), "pt-BR", { numeric: true })).slice(0, 200).map((l) => `<tr><td>${esc(l.end || "—")}</td><td>${esc(l.cod)}${l.lote ? `<small>Lote ${esc(l.lote)}</small>` : ""}</td><td>${esc(l.desc)}</td></tr>`).join("")}</tbody></table></div>` : '<p class="vazio">Todos os itens da lista já foram contados.</p>'}`;
      const ult = [...p.contagens].reverse().slice(0, 10);
      $("#ultimas").innerHTML = ult.length ? `<div class="rolagem"><table class="t"><thead><tr><th>Quando</th><th>Item</th><th class="n">Qtd.</th><th>Rodada</th><th>Endereço</th><th></th></tr></thead><tbody>${ult.map((c) => {
        const it = c.chave ? idx.porChave.get(c.chave) : null;
        return `<tr><td>${horaBR(c.quando)}<small>${esc(c.contador)}</small></td><td>${it ? esc(it.desc) : `<span class="selo pend">Sem cadastro</span> ${esc(c.desc)}`}<small>${esc(it ? it.cod : c.codLido)}</small></td><td class="n"><b>${qtd(c.qtd)}</b></td><td>${c.rodada === 2 ? "Recontagem" : "1ª"}</td><td>${esc(c.end || "—")}</td><td class="n"><button class="btn btn-t" data-desfazer="${c.id}">Desfazer</button></td></tr>`;
      }).join("")}</tbody></table></div>` : '<p class="vazio">Nenhuma contagem ainda. Bipe o primeiro item.</p>';
      $$("[data-desfazer]").forEach((b) => (b.onclick = async () => { p.contagens = p.contagens.filter((c) => c.id !== b.dataset.desfazer); await salvar(p); aviso("Contagem desfeita."); pintar(); campo.focus(); }));
    }

    async function registrar(item, q, extra = {}) {
      const contador = $("#contador").value.trim(), end = $("#endereco").value.trim();
      if (!contador) { aviso("Escreva quem está contando.", "erro"); $("#contador").focus(); return false; }
      if (q === null || q < 0) { aviso("Quantidade inválida.", "erro"); return false; }
      p.contagens.push({ id: uid(), chave: item ? item.chave : null, codLido: extra.codLido || "", desc: extra.desc || "", qtd: q, rodada, contador, end: end || (item ? item.end : ""), quando: new Date().toISOString() });
      await salvar(p);
      return true;
    }

    function mostrarItem(it, lidoLote) {
      const naLista = new Set(lista(p)).has(it.chave);
      const ja = contadoNaRodada(it.chave);
      $("#cartao").innerHTML = `<div class="cartao-item"><h3>${esc(it.desc)}</h3>
        <p class="meta">${esc(it.cod)}${it.lote ? ` · Lote ${esc(it.lote)}` : ""}${it.un ? ` · ${esc(it.un)}` : ""}${it.end ? ` · ${esc(it.end)}` : ""}</p>
        <p class="meta">${naLista ? "Na lista de contagem" : '<span class="selo pend">Fora da lista</span> será registrado à parte'}${ja ? ` · já contado nesta rodada: <b>${qtd(ja)}</b> (soma)` : ""}</p>
        <div class="qtd"><button type="button" id="menos" aria-label="Menos">−</button><input class="entrada" id="q" inputmode="decimal" value="1" aria-label="Quantidade"><button type="button" id="mais" aria-label="Mais">+</button></div>
        <div class="linha-btn" style="margin-top:.8rem"><button class="btn btn-p" id="ok" type="button">Registrar</button><button class="btn btn-t" id="cancelar" type="button">Cancelar</button></div></div>`;
      const q = $("#q"); q.focus(); q.select();
      $("#menos").onclick = () => { q.value = qtd(Math.max(0, (numBR(q.value) || 0) - 1)); };
      $("#mais").onclick = () => { q.value = qtd((numBR(q.value) || 0) + 1); };
      const fechar = () => { $("#cartao").innerHTML = ""; campo.focus(); };
      $("#cancelar").onclick = fechar;
      const ok = async () => { const v = numBR(q.value); if (await registrar(it, v)) { sinal(true, `${it.desc}: ${qtd(v)} registrado.`); fechar(); pintar(); } };
      $("#ok").onclick = ok;
      q.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } };
    }
    function escolherLote(itens, cod) {
      $("#cartao").innerHTML = `<div class="cartao-item"><h3>${esc(itens[0].desc)}</h3><p class="meta">${esc(cod)}: este produto tem ${itens.length} lotes na base. Qual lote está na mão?</p>
        <div class="linha-btn" style="margin-top:.8rem">${itens.map((it, i) => `<button class="btn btn-b" data-i="${i}">${esc(it.lote || "sem lote")}${it.val ? ` · val. ${esc(it.val)}` : ""}</button>`).join("")}</div></div>`;
      $$("[data-i]").forEach((b) => (b.onclick = () => mostrarItem(itens[Number(b.dataset.i)])));
    }
    function semCadastro(lido) {
      $("#cartao").innerHTML = `<div class="cartao-item sem-cadastro"><h3>Código ${esc(lido)} não está na base</h3><p class="meta">Registre como item sem cadastro: ele vai para uma lista à parte no relatório.</p>
        <div class="grade" style="margin-top:.8rem"><label class="campo largo"><span>Descrição do que está na mão</span><input class="entrada" id="sc-desc" maxlength="120"></label><label class="campo"><span>Quantidade</span><input class="entrada" id="sc-q" inputmode="decimal" value="1"></label></div>
        <div class="linha-btn" style="margin-top:.8rem"><button class="btn btn-p" id="sc-ok" type="button">Registrar sem cadastro</button><button class="btn btn-t" id="sc-x" type="button">Cancelar</button></div></div>`;
      $("#sc-desc").focus();
      $("#sc-x").onclick = () => { $("#cartao").innerHTML = ""; campo.focus(); };
      $("#sc-ok").onclick = async () => {
        const d = $("#sc-desc").value.trim(); if (!d) return aviso("Descreva o item.", "erro");
        if (await registrar(null, numBR($("#sc-q").value), { codLido: lido, desc: d })) { sinal(true, "Item sem cadastro registrado."); $("#cartao").innerHTML = ""; pintar(); campo.focus(); }
      };
    }
    async function ler(bruto) {
      const v = String(bruto || "").trim(); if (!v) return;
      campo.value = "";
      const r = achar(p, idx, v);
      if (!r.itens.length) { sinal(false, `Código ${v} não encontrado na base.`); return semCadastro(r.leitura.codigos[0] || v); }
      if (r.itens.length > 1) { sinal(true, "Escolha o lote."); return escolherLote(r.itens, v); }
      const it = r.itens[0];
      if (modoBipe) { if (await registrar(it, 1)) { sinal(true, `${it.desc}: +1 (total nesta rodada ${qtd(contadoNaRodada(it.chave))})`); pintar(); } campo.focus(); return; }
      sinal(true, "Item encontrado. Informe a quantidade.");
      mostrarItem(it);
    }
    campo.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === "Tab") && campo.value.trim()) { e.preventDefault(); ler(campo.value); } });
    if (temCamera) $("#cam").onclick = () => abrirCamera(ler);
    pintar(); campo.focus();
  }

  let camera = null;
  async function abrirCamera(aoLer) {
    let det;
    try { const f = await BarcodeDetector.getSupportedFormats(); det = new BarcodeDetector({ formats: f }); } catch { return aviso("Este aparelho não lê código pela câmera.", "erro"); }
    const el = document.createElement("div"); el.className = "camera";
    el.innerHTML = `<video playsinline muted></video><div class="mira"></div><div class="base"><span id="cam-msg">Aponte para o código</span><button class="btn btn-b" type="button" id="cam-x">Fechar</button></div>`;
    document.body.append(el);
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }); } catch { el.remove(); return aviso("Sem permissão para a câmera.", "erro"); }
    const v = $("video", el); v.srcObject = stream; await v.play().catch(() => {});
    let vivo = true;
    camera = { fechar() { vivo = false; stream.getTracks().forEach((t) => t.stop()); el.remove(); camera = null; } };
    $("#cam-x", el).onclick = () => camera && camera.fechar();
    while (vivo) {
      try { const a = await det.detect(v); if (a.length && a[0].rawValue) { const val = a[0].rawValue; camera.fechar(); aoLer(val); return; } } catch {}
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  function pararCamera() { if (camera) camera.fechar(); }

  // ---------- conciliação ----------
  function telaConciliar(p) {
    if (!p.base) return ir(`p/${p.id}/base`);
    const c = conciliar(p);
    let filtro = guarda.ler("filtro:" + p.id, "diverg");
    tela.innerHTML = cabecalho(p, "Conciliação", `<div class="linha-btn"><button class="btn btn-b" id="exp">Baixar conciliação (Excel)</button></div>`) + passos(p, "conciliar") + `
      <dl class="numeros"><div><dt>Itens que batem</dt><dd>${pct(c.acuracidade)}</dd><small>${c.batem} de ${c.contados} contados</small></div>
        <div><dt>Faltas</dt><dd class="v-falta">${reais(c.vFaltas)}</dd><small>${itens(c.faltas)}</small></div>
        <div><dt>Sobras</dt><dd class="v-sobra">${reais(c.vSobras)}</dd><small>${itens(c.sobras)}</small></div>
        <div><dt>Pendências</dt><dd>${c.pendentes + c.aRecontar}</dd><small>${c.pendentes} sem contagem · ${c.aRecontar} a recontar</small></div></dl>
      <section class="bloco"><header><div class="fichas" role="group" aria-label="Filtro">${[["diverg", "Com diferença"], ["recontar", "A recontar"], ["pendente", "Sem contagem"], ["fora", "Fora da lista"], ["todos", "Todos"]].map(([k, r]) => `<button class="ficha" data-f="${k}" aria-pressed="${filtro === k}">${r}</button>`).join("")}</div>
        <input class="entrada" id="busca" type="search" placeholder="Buscar código ou descrição" style="max-width:280px"></header><div id="tab"></div></section>
      ${c.semCadastro.length ? `<section class="bloco"><header><h2>Itens sem cadastro (${c.semCadastro.length})</h2></header><div class="rolagem"><table class="t"><thead><tr><th>Código lido</th><th>Descrição</th><th class="n">Qtd.</th><th>Endereço</th></tr></thead><tbody>${c.semCadastro.map((s) => `<tr><td>${esc(s.codLido || "—")}</td><td>${esc(s.desc)}</td><td class="n">${qtd(s.qtd)}</td><td>${esc(s.ends || "—")}</td></tr>`).join("")}</tbody></table></div></section>` : ""}`;
    function pintar() {
      const b = n2($("#busca").value);
      let ls = c.linhas.filter((l) => filtro === "todos" ? true : filtro === "diverg" ? (l.status === "falta" || l.status === "sobra") : filtro === "recontar" ? l.recontar : filtro === "pendente" ? (l.naLista && l.fis === null) : !l.naLista);
      if (b) ls = ls.filter((l) => n2(l.cod + " " + l.desc + " " + l.lote).includes(b));
      ls.sort((x, y) => Math.abs(y.valor || 0) - Math.abs(x.valor || 0) || String(x.end).localeCompare(String(y.end), "pt-BR", { numeric: true }));
      $("#tab").innerHTML = ls.length ? `<div class="rolagem"><table class="t"><thead><tr><th>Item</th><th class="n">Sistema</th><th class="n">1ª</th><th class="n">Recont.</th><th class="n">Físico</th><th class="n">Diferença</th><th class="n">Valor</th><th>Situação</th></tr></thead><tbody>${ls.slice(0, 400).map((l) => `<tr>
        <td>${esc(l.desc)}<small>${esc(l.cod)}${l.lote ? ` · Lote ${esc(l.lote)}` : ""}${l.end ? ` · ${esc(l.end)}` : ""}</small></td><td class="n">${qtd(l.saldo)}</td><td class="n">${qtd(l.r1)}</td><td class="n">${qtd(l.r2)}</td><td class="n"><b>${qtd(l.fis)}</b></td>
        <td class="n ${l.dif < 0 ? "v-falta" : l.dif > 0 ? "v-sobra" : ""}">${l.dif === null ? "—" : (l.dif > 0 ? "+" : "") + qtd(l.dif)}</td><td class="n ${l.valor < 0 ? "v-falta" : l.valor > 0 ? "v-sobra" : ""}">${l.valor === null ? "—" : reais(l.valor)}</td>
        <td>${l.status === "pendente" ? `<span class="selo pend">Sem contagem</span> <button class="btn btn-t" data-zero="${esc(l.chave)}">Não achado: contar como 0</button>` : `<span class="selo ${l.status}">${{ bate: "Bate", falta: "Falta", sobra: "Sobra" }[l.status]}</span>`}${l.recontar ? ' <span class="selo pend">Recontar</span>' : ""}${l.recontagemDiferente ? ' <span class="selo neutro">Recontagem ≠ 1ª</span>' : ""}${l.zerado ? ` <span class="selo neutro">Zerado manualmente</span> <button class="btn btn-t" data-deszero="${esc(l.chave)}">Desfazer</button>` : ""}${!l.naLista ? ' <span class="selo neutro">Fora da lista</span>' : ""}</td></tr>`).join("")}</tbody></table></div>${ls.length > 400 ? `<p class="vazio">Mostrando 400 de ${ls.length}. Baixe a conciliação para ver tudo.</p>` : ""}` : '<p class="vazio">Nada neste filtro.</p>';
      $$("[data-zero]").forEach((x) => (x.onclick = async () => { if (!confirm("Confirmar que o item foi procurado e não existe no estoque? Ele entra como falta total.")) return; p.decisoes.zero[x.dataset.zero] = true; await salvar(p); desenhar(); }));
      $$("[data-deszero]").forEach((x) => (x.onclick = async () => { delete p.decisoes.zero[x.dataset.deszero]; await salvar(p); desenhar(); }));
    }
    $$(".ficha").forEach((b) => (b.onclick = () => { filtro = b.dataset.f; guarda.gravar("filtro:" + p.id, filtro); $$(".ficha").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); pintar(); }));
    $("#busca").oninput = pintar;
    $("#exp").onclick = () => exportarConciliacao(p, c);
    pintar();
  }
  function exportarConciliacao(p, c) {
    const linhas = [["Código", "Lote", "Descrição", "Unidade", "Endereço", "Saldo sistema", "1ª contagem", "Recontagem", "Físico", "Diferença", "Custo unitário", "Valor da diferença", "Situação", "Na lista", "Observação"]];
    c.linhas.forEach((l) => linhas.push([l.cod, l.lote, l.desc, l.un, l.end || l.endsContados, dec(l.saldo), dec(l.r1), dec(l.r2), dec(l.fis), dec(l.dif), dec(l.custo), dec(l.valor), { bate: "Bate", falta: "Falta", sobra: "Sobra", pendente: "Sem contagem" }[l.status], l.naLista ? "Sim" : "Não", l.zerado ? "Não achado, contado como 0" : l.recontagemDiferente ? "Recontagem diferente da 1ª" : ""]));
    c.semCadastro.forEach((s) => linhas.push([s.codLido, "", s.desc, "", s.ends, "", "", "", dec(s.qtd), "", "", "", "Sem cadastro", "", ""]));
    baixar(`conciliacao-${p.cliente.replace(/[^\w-]+/g, "_")}.csv`, csv(linhas), "text/csv;charset=utf-8");
  }

  // ---------- relatório ----------
  function telaRelatorio(p) {
    if (!p.base) return ir(`p/${p.id}/base`);
    const c = conciliar(p);
    const r = p.relatorio || (p.relatorio = { causas: "", limitacoes: "", plano: [] });
    const diverg = c.linhas.filter((l) => l.status === "falta" || l.status === "sobra").sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
    const liquido = Math.round((c.vSobras - c.vFaltas) * 100) / 100;
    const raiox = p.tipo === "raiox";
    const autoLim = [
      raiox ? `O Raio-X contou uma amostra de ${c.tamanhoLista} itens de ${p.base.itens.length} cadastrados (${pct(c.valorBase ? c.valorLista / c.valorBase : null)} do valor do estoque no sistema). O resultado indica o nível de acerto do saldo, mas não substitui um inventário completo.` : `Inventário completo dos ${c.tamanhoLista} itens da base.`,
      c.semCusto ? `${itens(c.semCusto, "item da base está", "itens da base estão")} sem custo; as diferenças desses itens aparecem só em quantidade.` : null,
      "Os valores usam o custo informado pelo cliente no cadastro e não foram auditados.",
      c.pendentes ? `${itens(c.pendentes, "item da lista ficou", "itens da lista ficaram")} sem contagem e fora do percentual de acerto.` : null,
      c.semCadastro.length ? `${itens(c.semCadastro.length, "item encontrado no estoque não estava", "itens encontrados no estoque não estavam")} na base e sem valor atribuído.` : null,
      "Diferenças são físicas (contado × sistema). Ajustes no sistema ou na contabilidade são decisão do cliente e não estão incluídos.",
    ].filter(Boolean);
    tela.innerHTML = cabecalho(p, "Relatório", `<div class="linha-btn"><button class="btn btn-p" id="imprimir">Imprimir ou salvar PDF</button><button class="btn btn-b" id="exp">Baixar conciliação</button></div>`) + passos(p, "relatorio") +
      (c.pendentes || c.aRecontar ? `<section class="bloco so-tela"><p class="vazio">Atenção: ainda há ${itens(c.pendentes)} sem contagem e ${c.aRecontar} a recontar. O relatório pode mudar.</p></section>` : "") + `
      <article class="relatorio">
        <h1>${raiox ? "Raio-X do Estoque" : "Inventário físico"}: ${esc(p.cliente)}</h1>
        <p class="sub">Contagem em ${dataBR(p.data)} · responsável ${esc(p.responsavel || "—")} · Lastro Inventário e Consultoria de Estoque</p>
        <p class="resumo">Foram contados <b>${c.contados}</b> itens${raiox ? ` de uma amostra de ${c.tamanhoLista}` : ""}. <b>${pct(c.acuracidade)}</b> bateram com o sistema. As faltas somam <b>${reais(c.vFaltas)}</b> em ${itens(c.faltas)} e as sobras <b>${reais(c.vSobras)}</b> em ${itens(c.sobras)}. O saldo líquido (${reais(liquido)}) não mede o prejuízo: falta e sobra são erros independentes de controle.</p>
        <h2>Números</h2>
        <dl class="numeros"><div><dt>Itens contados</dt><dd>${c.contados}</dd><small>${raiox ? `amostra de ${c.tamanhoLista}` : `de ${c.tamanhoLista}`}</small></div>
          <div><dt>Itens que batem</dt><dd>${pct(c.acuracidade)}</dd><small>${itens(c.batem)}</small></div>
          <div><dt>Faltas</dt><dd class="v-falta">${reais(c.vFaltas)}</dd><small>${itens(c.faltas)}</small></div>
          <div><dt>Sobras</dt><dd class="v-sobra">${reais(c.vSobras)}</dd><small>${itens(c.sobras)}</small></div></dl>
        <h2>Maiores diferenças</h2>
        ${diverg.length ? `<div class="rolagem"><table class="t"><thead><tr><th>Item</th><th class="n">Sistema</th><th class="n">Físico</th><th class="n">Diferença</th><th class="n">Valor</th></tr></thead><tbody>${diverg.slice(0, 15).map((l) => `<tr><td>${esc(l.desc)}<small>${esc(l.cod)}${l.lote ? ` · Lote ${esc(l.lote)}` : ""}${l.end ? ` · ${esc(l.end)}` : ""}</small></td><td class="n">${qtd(l.saldo)}</td><td class="n">${qtd(l.fis)}</td><td class="n ${l.dif < 0 ? "v-falta" : "v-sobra"}">${l.dif > 0 ? "+" : ""}${qtd(l.dif)}</td><td class="n ${l.valor < 0 ? "v-falta" : "v-sobra"}">${reais(l.valor)}</td></tr>`).join("")}</tbody></table></div>${diverg.length > 15 ? `<p class="ajuda" style="margin-top:.4rem">Mais ${diverg.length - 15} itens com diferença na conciliação completa (anexo em Excel).</p>` : ""}` : "<p>Nenhuma diferença encontrada nos itens contados.</p>"}
        ${c.semCadastro.length ? `<h2>Itens sem cadastro</h2><ul>${c.semCadastro.map((s) => `<li>${esc(s.desc)}${s.codLido ? ` (código lido ${esc(s.codLido)})` : ""}: ${qtd(s.qtd)} un.${s.ends ? ` em ${esc(s.ends)}` : ""}</li>`).join("")}</ul>` : ""}
        <h2>Causas prováveis</h2>
        <textarea class="entrada editavel" id="causas" placeholder="Ex.: 1. Cabo vendido em metro e recebido em rolo, sem conversão de unidade. 2. Saídas de balcão sem baixa no sistema.">${esc(r.causas)}</textarea>
        <h2>Plano de ação</h2>
        <div class="rolagem"><table class="t" id="plano"><thead><tr><th>Prioridade</th><th>Ação</th><th>Responsável</th><th>Prazo</th><th class="so-tela"></th></tr></thead><tbody></tbody></table></div>
        <div class="linha-btn so-tela" style="margin-top:.5rem"><button class="btn btn-t" id="add-acao">Adicionar ação</button></div>
        <h2>Limitações deste levantamento</h2>
        <ul>${autoLim.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        <textarea class="entrada editavel" id="limit" placeholder="Outras limitações (opcional)">${esc(r.limitacoes)}</textarea>
      </article>`;
    let t;
    const salvarLogo = () => { clearTimeout(t); t = setTimeout(() => salvar(p), 400); };
    $("#causas").oninput = (e) => { r.causas = e.target.value; salvarLogo(); };
    $("#limit").oninput = (e) => { r.limitacoes = e.target.value; salvarLogo(); };
    const corpoPlano = $("#plano tbody");
    function plano() {
      if (!r.plano.length) r.plano.push({ prio: "Alta", acao: "", resp: "", prazo: "" });
      corpoPlano.innerHTML = r.plano.map((a, i) => `<tr data-i="${i}"><td><select class="entrada" data-k="prio">${["Alta", "Média", "Baixa"].map((o) => `<option ${a.prio === o ? "selected" : ""}>${o}</option>`).join("")}</select></td>
        <td><input class="entrada" data-k="acao" value="${esc(a.acao)}" placeholder="O que fazer"></td><td><input class="entrada" data-k="resp" value="${esc(a.resp)}" placeholder="Quem"></td><td><input class="entrada" data-k="prazo" value="${esc(a.prazo)}" placeholder="Quando"></td>
        <td class="so-tela"><button class="btn btn-t" data-tirar="${i}">Tirar</button></td></tr>`).join("");
      $$("[data-k]", corpoPlano).forEach((el) => (el.oninput = el.onchange = () => { r.plano[Number(el.closest("tr").dataset.i)][el.dataset.k] = el.value; salvarLogo(); }));
      $$("[data-tirar]", corpoPlano).forEach((b) => (b.onclick = () => { r.plano.splice(Number(b.dataset.tirar), 1); salvar(p); plano(); }));
    }
    plano();
    $("#add-acao").onclick = () => { r.plano.push({ prio: "Média", acao: "", resp: "", prazo: "" }); salvar(p); plano(); };
    $("#imprimir").onclick = async () => { await salvar(p); window.print(); };
    $("#exp").onclick = () => exportarConciliacao(p, c);
  }

  // ---------- início ----------
  const atualizarOffline = () => { $("#offline").hidden = navigator.onLine; };
  window.addEventListener("online", atualizarOffline); window.addEventListener("offline", atualizarOffline); atualizarOffline();
  if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
  abrirBanco().then(() => { window.addEventListener("hashchange", desenhar); desenhar(); })
    .catch(() => { tela.innerHTML = '<div class="bloco"><p class="vazio">Este navegador bloqueou o armazenamento local (modo anônimo?). Abra numa janela normal.</p></div>'; });
})();
