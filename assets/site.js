(function () {
  "use strict";
  var C = window.LASTRO || {};
  var doc = document;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var temIO = "IntersectionObserver" in window;

  // ---------- contato vindo do config.js ----------
  var zap = String(C.whatsapp || "").replace(/\D/g, "");
  var zapBonito = (function (n) {
    var m = n.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
    return m ? "(" + m[1] + ") " + m[2] + "-" + m[3] : n;
  })(zap);
  if (zap) {
    $$('a[href^="https://wa.me/"]').forEach(function (a) {
      a.href = "https://wa.me/" + zap;
      if (/\(\d{2}\)/.test(a.textContent)) a.textContent = a.textContent.replace(/\(\d{2}\)\s?[\d-]+/, zapBonito);
    });
  }

  // ---------- menu ----------
  var botao = $("#menu-botao"), menu = $("#menu");
  function fecharMenu(devolverFoco) {
    if (!menu.classList.contains("aberto")) return;
    menu.classList.remove("aberto");
    botao.setAttribute("aria-expanded", "false");
    if (devolverFoco) botao.focus();
  }
  if (botao && menu) {
    botao.addEventListener("click", function () {
      var abrir = !menu.classList.contains("aberto");
      menu.classList.toggle("aberto", abrir);
      botao.setAttribute("aria-expanded", String(abrir));
      if (abrir) { var p = $("a", menu); if (p) p.focus(); }
    });
    menu.addEventListener("click", function (e) { if (e.target.closest("a")) fecharMenu(false); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") fecharMenu(true); });
    doc.addEventListener("click", function (e) { if (!e.target.closest("#topo")) fecharMenu(false); });
    window.addEventListener("resize", function () { if (window.innerWidth > 1120) fecharMenu(false); });
  }

  // ---------- link da seção atual no menu ----------
  var links = $$('#menu ul a[href^="#"]');
  if (temIO && links.length) {
    var porId = {};
    links.forEach(function (a) { porId[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute("aria-current"); });
        var a = porId[en.target.id];
        if (a && en.target.id !== "inicio") a.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(porId).forEach(function (id) { var s = doc.getElementById(id); if (s) spy.observe(s); });
  }

  // ---------- CTA fixo no celular: aparece depois da primeira dobra, some perto do formulário ----------
  var cta = $("#cta-movel");
  if (cta && temIO) {
    var visto = { inicio: true, contato: false, rodape: false };
    var atualizar = function () { cta.classList.toggle("visivel", !visto.inicio && !visto.contato && !visto.rodape); };
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) { visto[en.target.dataset.cta] = en.isIntersecting; });
      atualizar();
    });
    [["#inicio", "inicio"], ["#contato", "contato"], [".rodape", "rodape"]].forEach(function (p) {
      var el = $(p[0]); if (el) { el.dataset.cta = p[1]; obs.observe(el); }
    });
  }

  // ---------- formulário ----------
  // ---------- revelar com movimento sutil (só se a pessoa não pediu menos movimento) ----------
  var calmo = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revelar = $$(".revelar");
  if (temIO && !calmo && revelar.length) {
    var obsR = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("visto"); obsR.unobserve(en.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    revelar.forEach(function (el) { el.classList.add("pronto"); obsR.observe(el); });
  }

  var form = $("#form-orcamento");
  if (!form) return;

  // interesse vindo de outra página (ex.: sistemas.html → index.html?interesse=...)
  try {
    var pedido = new URLSearchParams(location.search).get("interesse");
    if (pedido) {
      var selI = form.elements.interesse;
      if ($$("option", selI).some(function (o) { return o.value === pedido || o.text === pedido; })) selI.value = pedido;
    }
  } catch (e) {}
  var revisao = $("#revisao"), revTexto = $("#revisao-texto"), abrir = $("#abrir-whats");
  var status = $("#revisao-status"), erroGeral = $("#erro-geral");
  var regras = {
    nome: { min: 2, rotulo: "Nome", msg: "Escreva seu nome." },
    empresa: { min: 2, rotulo: "Empresa", msg: "Escreva o nome da empresa." },
    local: { min: 2, rotulo: "Bairro ou cidade", msg: "Informe o bairro ou a cidade do estoque." },
    segmento: { min: 1, rotulo: "Segmento", msg: "Escolha o segmento mais próximo." },
    problema: { min: 10, rotulo: "Principal problema", msg: "Conte em uma frase qual é o problema (mínimo de 10 letras)." }
  };

  function limpar(v, multilinha) {
    v = String(v || "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "");
    if (!multilinha) return v.replace(/\s+/g, " ").trim();
    return v.split("\n").map(function (l) { return l.replace(/[ \t]+/g, " ").trim(); }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function dados() {
    var d = {};
    $$("input, select, textarea", form).forEach(function (el) { if (el.name) d[el.name] = limpar(el.value, el.tagName === "TEXTAREA"); });
    return d;
  }
  function validarCampo(nome, valor) {
    var r = regras[nome], el = form.elements[nome], erro = doc.getElementById("e-" + nome);
    var curto = r.min > 1 ? valor.replace(/\s/g, "").length < r.min : !valor;
    var msg = !valor ? r.msg : (curto ? r.msg : "");
    el.setAttribute("aria-invalid", msg ? "true" : "false");
    if (erro) erro.textContent = msg;
    return !msg;
  }

  // revalida enquanto a pessoa corrige
  Object.keys(regras).forEach(function (k) {
    var el = form.elements[k];
    var ev = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(ev, function () {
      if (el.getAttribute("aria-invalid") === "true") validarCampo(k, limpar(el.value, el.tagName === "TEXTAREA"));
    });
    el.addEventListener("blur", function () {
      if (el.value) validarCampo(k, limpar(el.value, el.tagName === "TEXTAREA"));
    });
  });

  var problema = form.elements.problema, contador = $("#c-problema");
  function contar() { contador.textContent = problema.value.length + "/" + problema.maxLength; }
  problema.addEventListener("input", contar); contar();

  // botões "pedir avaliação deste serviço" já escolhem o interesse
  $$("[data-interesse]").forEach(function (a) {
    a.addEventListener("click", function () {
      var sel = form.elements.interesse, v = a.getAttribute("data-interesse");
      if ($$("option", sel).some(function (o) { return o.value === v || o.text === v; })) sel.value = v;
      if (!revisao.hidden) mostrarForm(false);
    });
  });

  function montar(d) {
    var linhas = ["Olá, Arthur! Quero solicitar uma avaliação de estoque.", ""];
    [["nome", "Nome"], ["empresa", "Empresa"], ["local", "Local"], ["segmento", "Segmento"], ["skus", "Itens (SKUs)"],
     ["sistema", "Sistema"], ["interesse", "Interesse"], ["prazo", "Prazo"]].forEach(function (p) {
      if (d[p[0]]) linhas.push(p[1] + ": " + d[p[0]]);
    });
    linhas.push("", "Principal problema:", d.problema);
    return linhas.join("\n");
  }

  function mostrarForm(foco) {
    revisao.hidden = true; form.hidden = false; status.textContent = "";
    if (foco) form.elements.nome.focus();
  }

  var travado = false;
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (travado) return;
    var d = dados();
    if (d.site) return; // campo escondido: só robôs preenchem
    var invalidos = Object.keys(regras).filter(function (k) { return !validarCampo(k, d[k]); });
    if (invalidos.length) {
      erroGeral.textContent = "Revise " + (invalidos.length === 1 ? "o campo" : "os campos") + ": " +
        invalidos.map(function (k) { return regras[k].rotulo; }).join(", ") + ".";
      form.elements[invalidos[0]].focus();
      return;
    }
    erroGeral.textContent = "";
    travado = true; setTimeout(function () { travado = false; }, 700);

    var texto = montar(d);
    revTexto.textContent = texto;
    if (zap) {
      abrir.href = "https://wa.me/" + zap + "?text=" + encodeURIComponent(texto);
      abrir.textContent = "Abrir no WhatsApp";
    } else {
      abrir.href = "mailto:" + (C.email || "") + "?subject=" + encodeURIComponent("Avaliação de estoque: " + d.empresa) + "&body=" + encodeURIComponent(texto);
      abrir.textContent = "Abrir no e-mail";
      abrir.removeAttribute("target");
    }
    form.hidden = true; revisao.hidden = false; status.textContent = "";
    var tit = $("#revisao-titulo");
    tit.focus({ preventScroll: true });
    revisao.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  });

  abrir.addEventListener("click", function () {
    status.textContent = zap
      ? "Abrimos o WhatsApp com a mensagem pronta. Ela só é enviada quando você tocar em enviar lá. Se não abriu, copie o texto e mande para " + zapBonito + "."
      : "Abrimos o seu e-mail com a mensagem pronta. É só enviar.";
  });

  $("#copiar").addEventListener("click", function () {
    var texto = revTexto.textContent;
    var ok = function () { status.textContent = "Texto copiado. Cole no WhatsApp" + (zap ? " de " + zapBonito : "") + " e envie."; };
    var falhou = function () {
      var r = doc.createRange(); r.selectNodeContents(revTexto);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      status.textContent = "Não foi possível copiar sozinho. O texto ficou selecionado: copie com Ctrl+C ou segurando o dedo.";
    };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(texto).then(ok, falhou);
    else falhou();
  });

  $("#editar").addEventListener("click", function () { mostrarForm(true); });
})();
