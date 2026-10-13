// Leitura de planilhas no navegador, sem bibliotecas externas.
// .xlsx: abre o pacote zip e lê as abas. .csv/.txt: detecta separador e acentuação.
(function () {
  "use strict";

  async function inflar(bytes) {
    const ds = new DecompressionStream("deflate-raw");
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  function lerZip(buf) {
    const dv = new DataView(buf);
    const u8 = new Uint8Array(buf);
    let fim = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
    }
    if (fim < 0) throw new Error("Esse arquivo não parece ser um Excel (.xlsx) válido.");
    const total = dv.getUint16(fim + 10, true);
    let p = dv.getUint32(fim + 16, true);
    const arquivos = {};
    const dec = new TextDecoder();
    for (let k = 0; k < total; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const metodo = dv.getUint16(p + 10, true);
      const tam = dv.getUint32(p + 20, true);
      const nLen = dv.getUint16(p + 28, true), eLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const nome = dec.decode(u8.subarray(p + 46, p + 46 + nLen));
      arquivos[nome] = { metodo, tam, local };
      p += 46 + nLen + eLen + cLen;
    }
    return {
      nomes: Object.keys(arquivos),
      async texto(nome) {
        const a = arquivos[nome];
        if (!a) return null;
        const ini = a.local + 30 + dv.getUint16(a.local + 26, true) + dv.getUint16(a.local + 28, true);
        const dados = u8.subarray(ini, ini + a.tam);
        const bytes = a.metodo === 0 ? dados : await inflar(dados);
        return new TextDecoder("utf-8").decode(bytes);
      },
    };
  }

  const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  const desescapar = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m);

  function textosDe(xml) {
    // junta os <t> de um <si>, ignorando a fonética (<rPh>)
    const semFonetica = xml.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, "");
    let out = "";
    semFonetica.replace(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g, (m, t) => { out += t; return m; });
    return desescapar(out);
  }

  function coluna(ref) {
    let n = 0;
    for (const ch of ref) { const c = ch.charCodeAt(0); if (c < 65 || c > 90) break; n = n * 26 + (c - 64); }
    return n - 1;
  }

  function lerAba(xml, compartilhadas) {
    const linhas = [];
    const reLinha = /<(?:\w+:)?row\b[^>]*?(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g;
    const reCel = /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g;
    let m;
    while ((m = reLinha.exec(xml))) {
      const linha = [];
      const corpo = m[1] || "";
      let c, pos = 0;
      reCel.lastIndex = 0;
      while ((c = reCel.exec(corpo))) {
        const attrs = c[1];
        const ref = (attrs.match(/\br="([A-Z]+)\d*"/) || [])[1];
        const col = ref ? coluna(ref) : pos;
        pos = col + 1;
        const tipo = (attrs.match(/\bt="(\w+)"/) || [])[1];
        const dentro = c[2] || "";
        let v = (dentro.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/) || [])[1];
        let valor;
        if (tipo === "s") valor = compartilhadas[Number(v)] ?? "";
        else if (tipo === "inlineStr") valor = textosDe(dentro);
        else if (tipo === "b") valor = v === "1" ? "VERDADEIRO" : "FALSO";
        else valor = v === undefined ? "" : desescapar(v);
        linha[col] = valor;
      }
      for (let i = 0; i < linha.length; i++) if (linha[i] === undefined) linha[i] = "";
      linhas.push(linha);
    }
    return linhas;
  }

  async function lerXlsx(buf) {
    const zip = lerZip(buf);
    const wb = await zip.texto("xl/workbook.xml");
    if (!wb) throw new Error("Não achei as abas dentro desse Excel.");
    const rels = (await zip.texto("xl/_rels/workbook.xml.rels")) || "";
    const alvo = {};
    rels.replace(/<Relationship\b[^>]*>/g, (r) => {
      const id = (r.match(/\bId="([^"]+)"/) || [])[1];
      let t = (r.match(/\bTarget="([^"]+)"/) || [])[1];
      if (id && t) alvo[id] = t.startsWith("/") ? t.slice(1) : "xl/" + t.replace(/^\.\//, "");
      return r;
    });
    const ss = await zip.texto("xl/sharedStrings.xml");
    const compartilhadas = [];
    if (ss) ss.replace(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g, (m, si) => { compartilhadas.push(textosDe(si)); return ""; });
    const abas = [];
    const reAba = /<(?:\w+:)?sheet\b[^>]*>/g;
    let m;
    while ((m = reAba.exec(wb))) {
      const nome = desescapar((m[0].match(/\bname="([^"]*)"/) || [])[1] || "Aba");
      const rid = (m[0].match(/\br:id="([^"]+)"/) || m[0].match(/\b\w+:id="([^"]+)"/) || [])[1];
      const arq = alvo[rid];
      if (!arq) continue;
      const xml = await zip.texto(arq);
      if (xml) abas.push({ nome, linhas: lerAba(xml, compartilhadas) });
    }
    if (!abas.length) throw new Error("Esse Excel não tem abas com dados.");
    return abas;
  }

  function decodificar(buf) {
    const u8 = new Uint8Array(buf);
    try { return new TextDecoder("utf-8", { fatal: true }).decode(u8).replace(/^﻿/, ""); }
    catch { return new TextDecoder("windows-1252").decode(u8); }
  }

  function lerCsv(texto) {
    const primeira = texto.slice(0, 5000).split(/\r?\n/)[0] || "";
    const conta = (ch) => primeira.split(ch).length - 1;
    const sep = [";", ",", "\t", "|"].sort((a, b) => conta(b) - conta(a))[0];
    const linhas = [];
    let linha = [], campo = "", aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto[i];
      if (aspas) {
        if (ch === '"') { if (texto[i + 1] === '"') { campo += '"'; i++; } else aspas = false; }
        else campo += ch;
      } else if (ch === '"' && campo === "") aspas = true;
      else if (ch === sep) { linha.push(campo); campo = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && texto[i + 1] === "\n") i++;
        linha.push(campo); campo = "";
        if (linha.some((c) => c !== "")) linhas.push(linha);
        linha = [];
      } else campo += ch;
    }
    linha.push(campo);
    if (linha.some((c) => c !== "")) linhas.push(linha);
    return [{ nome: "CSV", linhas }];
  }

  async function ler(arquivo) {
    const buf = await arquivo.arrayBuffer();
    const u8 = new Uint8Array(buf.slice(0, 4));
    const ehZip = u8[0] === 0x50 && u8[1] === 0x4b;
    if (ehZip) {
      if (typeof DecompressionStream === "undefined") throw new Error("Seu navegador é antigo para abrir Excel. Atualize o navegador ou salve a planilha como CSV.");
      return lerXlsx(buf);
    }
    if (/\.xls$/i.test(arquivo.name)) throw new Error("Esse é o formato antigo do Excel (.xls). Abra no Excel e salve como .xlsx ou CSV.");
    return lerCsv(decodificar(buf));
  }

  window.Planilha = { ler };
})();
