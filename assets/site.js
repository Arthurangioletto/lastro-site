(function () {
  "use strict";
  var C = window.LASTRO || {};
  var reduzir = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var reais = function (v) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); };

  // ---- a conciliação da abertura: conta item por item, uma vez ----
  var corpo = document.getElementById("linhas-conc");
  if (corpo && !reduzir) {
    var linhas = Array.prototype.slice.call(corpo.querySelectorAll("tr"));
    var finais = linhas.map(function (tr) { return [tr.querySelector(".fis").textContent, tr.querySelector(".dif").outerHTML]; });
    var totais = document.getElementById("totais-conc");
    linhas.forEach(function (tr) {
      tr.classList.add("pendente");
      tr.querySelector(".fis").textContent = "—";
      tr.querySelector(".dif").textContent = "a contar";
    });
    totais.style.visibility = "hidden";
    var i = 0;
    var passo = function () {
      if (i > 0) linhas[i - 1].classList.remove("contando");
      if (i >= linhas.length) { totais.style.visibility = "visible"; return; }
      var tr = linhas[i];
      tr.classList.remove("pendente");
      tr.classList.add("contando");
      tr.querySelector(".fis").textContent = finais[i][0];
      tr.querySelector(".dif").outerHTML = finais[i][1];
      i++;
      setTimeout(passo, 650);
    };
    setTimeout(passo, 700);
  }

  // ---- canais de contato ----
  var canais = document.getElementById("canais");
  var zap = String(C.whatsapp || "").replace(/\D/g, "");
  if (canais) {
    var html = "";
    if (zap) html += '<div><a href="https://wa.me/' + zap + '" target="_blank" rel="noopener">WhatsApp</a><span>Resposta mais rápida</span></div>';
    if (C.email) html += '<div><a href="mailto:' + C.email + '">' + C.email + '</a><span>E-mail</span></div>';
    html += '<div><span>Atendimento</span>' + (C.regiao || "São Paulo") + "</div>";
    canais.innerHTML = html;
  }

  // ---- formulário: monta a mensagem e abre WhatsApp (ou e-mail) ----
  var form = document.getElementById("form-orcamento");
  if (!form) return;
  var botao = document.getElementById("enviar");
  if (!zap) botao.textContent = "Enviar por e-mail";
  var aberto = Date.now();
  var obrig = { nome: "Escreva seu nome.", empresa: "Escreva o nome da empresa.", problema: "Conte em uma frase qual é o problema." };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var d = {};
    Array.prototype.forEach.call(form.elements, function (el) { if (el.name) d[el.name] = String(el.value || "").trim(); });
    if (d.site || Date.now() - aberto < 2500) return; // robôs preenchem o campo escondido ou enviam rápido demais
    var ok = true;
    Object.keys(obrig).forEach(function (k) {
      var campo = form.elements[k], erro = form.querySelector('[data-erro="' + k + '"]');
      var falta = !d[k];
      campo.setAttribute("aria-invalid", falta ? "true" : "false");
      erro.textContent = falta ? obrig[k] : "";
      if (falta && ok) { campo.focus(); ok = false; }
    });
    if (!ok) return;
    var linhas = [
      "Olá! Quero uma avaliação de estoque.",
      "Nome: " + d.nome,
      "Empresa: " + d.empresa,
      d.local && "Local: " + d.local,
      d.segmento && "Segmento: " + d.segmento,
      d.skus && "Itens no estoque: " + d.skus,
      d.sistema && "Sistema: " + d.sistema,
      "Problema: " + d.problema,
      d.prazo && "Prazo: " + d.prazo,
    ].filter(Boolean);
    var texto = linhas.join("\n");
    var url = zap
      ? "https://wa.me/" + zap + "?text=" + encodeURIComponent(texto)
      : "mailto:" + (C.email || "") + "?subject=" + encodeURIComponent("Avaliação de estoque — " + d.empresa) + "&body=" + encodeURIComponent(texto);
    window.open(url, zap ? "_blank" : "_self", "noopener");
    document.getElementById("retorno").textContent = zap
      ? "Abrimos o WhatsApp com a sua mensagem pronta. É só tocar em enviar."
      : "Abrimos o seu e-mail com a mensagem pronta. É só enviar.";
  });
})();
