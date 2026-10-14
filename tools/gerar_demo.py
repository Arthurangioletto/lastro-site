#!/usr/bin/env python3
"""Gera os números do exemplo fictício do index.html a partir de tools/demo.json.

Fonte única: tools/demo.json. Este script calcula faltas, sobras, diferença
líquida, valor absoluto, ranking e percentuais e reescreve, no index.html, os
trechos entre os marcadores:

  <!-- demo:painel -->     ... <!-- /demo:painel -->      (painel da primeira dobra)
  <!-- demo:relatorio -->  ... <!-- /demo:relatorio -->   (exemplo de relatório)

Também grava tools/demo-resumo.json com os totais, usado pelos guias e testes.
Uso: python3 tools/gerar_demo.py
"""
import html
import json
import re
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
D = json.loads((RAIZ / "tools" / "demo.json").read_text(encoding="utf-8"))
MENOS = "−"


def dec(v):
    return Decimal(str(v))


def q2(v):
    return dec(v).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def brl(v, sinal=False):
    v = q2(v)
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    if not sinal:
        return "R$ " + s
    return ("+" if v > 0 else MENOS) + "R$ " + s


def inteiro(n):
    return f"{n:,}".replace(",", ".")


def pct(v, casas=1):
    return f"{v:.{casas}f}".replace(".", ",")


def esc(t):
    return html.escape(t, quote=False)


def impacto(i):
    return q2((dec(i["fis"]) - dec(i["sis"])) * dec(i["custo"]))


# ---------- cálculos ----------
princ = D["principais"]
outras = D["outras"]
for i in princ + outras:
    i["dif"] = i["fis"] - i["sis"]
    i["imp"] = impacto(i)
    if i["dif"] == 0:
        sys.exit(f"Item sem divergência na lista de divergências: {i['nome']}")

# ranking: as principais têm de ser as maiores, em ordem
princ.sort(key=lambda i: -abs(i["imp"]))
menor_principal = min(abs(i["imp"]) for i in princ)
maior_outra = max(abs(i["imp"]) for i in outras)
if maior_outra >= menor_principal:
    sys.exit(f"Ranking inconsistente: uma das 'outras' ({maior_outra}) não é menor que a 8ª maior ({menor_principal}).")

todas = princ + outras
faltas = [i for i in todas if i["imp"] < 0]
sobras = [i for i in todas if i["imp"] > 0]
F = sum((-i["imp"] for i in faltas), Decimal(0))
S = sum((i["imp"] for i in sobras), Decimal(0))
OF = sum((-i["imp"] for i in outras if i["imp"] < 0), Decimal(0))
OS = sum((i["imp"] for i in outras if i["imp"] > 0), Decimal(0))
onf = sum(1 for i in outras if i["imp"] < 0)
ons = sum(1 for i in outras if i["imp"] > 0)
ABS = F + S
LIQ = S - F
TOP = sum((abs(i["imp"]) for i in princ), Decimal(0))
TOP_PCT = int((TOP / ABS * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
amostra = D["maior_valor"] + D["sorteados"]
nf, ns = len(faltas), len(sobras)
bate = amostra - nf - ns
pbate = bate / amostra * 100
maxabs = abs(princ[0]["imp"])
assert q2(ABS) == q2(TOP + OF + OS), "reconciliação do valor absoluto"

resumo = {
    "amostra": amostra, "cadastrados": D["cadastrados"], "batem": bate,
    "itens_falta": nf, "itens_sobra": ns,
    "faltas": float(q2(F)), "sobras": float(q2(S)), "liquida": float(q2(LIQ)),
    "absoluto": float(q2(ABS)), "maiores8": float(q2(TOP)), "maiores8_pct": TOP_PCT,
    "outras_faltas": float(q2(OF)), "outras_sobras": float(q2(OS)),
    "outras_n_faltas": onf, "outras_n_sobras": ons,
    "maior_outra": float(maior_outra), "menor_principal": float(menor_principal),
    "pct_batem": round(pbate, 1),
}

# ---------- painel da primeira dobra ----------
def linha_painel(nome, n):
    if nome == D["bate_exemplo"]["nome"]:
        b = D["bate_exemplo"]
        return (f'          <tr style="--i:{n}"><th scope="row">{esc(nome)}</th><td data-rotulo="Sistema">{b["sis"]}</td>'
                f'<td data-rotulo="Físico">{b["fis"]}</td><td data-rotulo="Diferença" class="dif bate"><span>bate</span></td></tr>')
    i = next(x for x in princ if x["nome"] == nome)
    cl = "falta" if i["imp"] < 0 else "sobra"
    dif = ("+" if i["dif"] > 0 else MENOS) + str(abs(i["dif"]))
    return (f'          <tr style="--i:{n}"><th scope="row">{esc(nome)}</th><td data-rotulo="Sistema">{i["sis"]}</td>'
            f'<td data-rotulo="Físico">{i["fis"]}</td><td data-rotulo="Diferença" class="dif {cl}"><span>{dif}</span>'
            f'<small>{brl(i["imp"], True)}</small></td></tr>')


painel = f"""<!-- demo:painel -->
    <figure class="painel" aria-labelledby="painel-titulo">
      <div class="painel-topo">
        <div>
          <p class="painel-titulo" id="painel-titulo">Conciliação sistema × físico</p>
          <p class="painel-sub">Distribuidora fictícia · amostra de {amostra} itens</p>
        </div>
        <span class="selo">Dados fictícios</span>
      </div>
      <dl class="painel-kpis">
        <div class="kpi kpi-bate">
          <dt>Itens que batem</dt>
          <dd><span class="kpi-num">{pct(pbate)}%</span><span class="medidor" aria-hidden="true"><i style="--v:{pbate:.1f}%"></i></span><small>{bate} de {amostra}</small></dd>
        </div>
        <div class="kpi kpi-falta">
          <dt>Faltas</dt>
          <dd><span class="kpi-num">{brl(F)}</span><small>{nf} itens</small></dd>
        </div>
        <div class="kpi kpi-sobra">
          <dt>Sobras</dt>
          <dd><span class="kpi-num">{brl(S)}</span><small>{ns} itens</small></dd>
        </div>
      </dl>
      <table class="tabela-conc painel-tabela">
        <caption class="sr">Quatro itens da amostra fictícia: saldo do sistema, quantidade física e diferença</caption>
        <thead><tr><th scope="col">Item</th><th scope="col">Sistema</th><th scope="col">Físico</th><th scope="col">Diferença</th></tr></thead>
        <tbody>
{chr(10).join(linha_painel(n, k) for k, n in enumerate(D["painel_itens"]))}
        </tbody>
      </table>
      <figcaption class="painel-rodape">Recorte de 4 dos {amostra} itens do <a href="#relatorio">relatório de exemplo</a>. Faltas e sobras são somadas separadamente: uma não compensa a outra.</figcaption>
    </figure>
    <!-- /demo:painel -->"""

# ---------- relatório ----------
barras = []
linhas = []
for i in princ:
    cl = "falta" if i["imp"] < 0 else "sobra"
    w = float(abs(i["imp"]) / maxabs * 100)
    w = f"{w:.2f}".rstrip("0").rstrip(".") + "%"
    barras.append(f'          <li class="{cl}"><span class="b-nome">{esc(i["nome"])}</span><span class="b-trilho" aria-hidden="true"><i style="--v:{w}"></i></span><span class="b-valor">{brl(i["imp"], True)}</span></li>')
    dif = ("+" if i["dif"] > 0 else MENOS) + str(abs(i["dif"]))
    linhas.append(
        f'            <tr data-sis="{i["sis"]}" data-fis="{i["fis"]}" data-custo="{i["custo"]:.2f}"><th scope="row">{esc(i["nome"])}</th>'
        f'<td data-rotulo="Sistema">{i["sis"]}</td><td data-rotulo="Físico">{i["fis"]}</td>'
        f'<td data-rotulo="Diferença" class="dif {cl}">{dif}</td><td data-rotulo="Custo unit.">{brl(i["custo"])}</td>'
        f'<td data-rotulo="Impacto" class="dif {cl}">{brl(i["imp"], True)}</td></tr>')

causas = "\n".join(f"            <li><b>{esc(c[0])}</b> {esc(c[1])}</li>" for c in D["causas"])
acoes = "\n".join(f"            <li>{esc(a)}</li>" for a in D["acoes"])
pf, ps = nf / amostra * 100, ns / amostra * 100

relatorio = f"""<!-- demo:relatorio -->
    <article class="relatorio" aria-labelledby="rel-titulo">
      <header class="rel-cabeca">
        <div>
          <h3 id="rel-titulo">Raio-X do Estoque · {esc(D["empresa"])}</h3>
          <p>Amostra de {amostra} dos {inteiro(D["cadastrados"])} itens cadastrados: {D["maior_valor"]} de maior valor + {D["sorteados"]} sorteados</p>
        </div>
        <p class="aviso-ficticio" role="note"><strong>Demonstração.</strong> Empresa e números fictícios. Não representa um cliente real.</p>
      </header>

      <dl class="rel-kpis">
        <div><dt>SKUs contados</dt><dd>{amostra}</dd><dd class="kpi-nota">de {inteiro(D["cadastrados"])} cadastrados</dd></div>
        <div class="kpi-bate"><dt>Itens que batem</dt><dd>{pct(pbate)}%</dd><dd class="kpi-nota">{bate} de {amostra}</dd></div>
        <div class="kpi-falta"><dt>Faltas na amostra</dt><dd>{brl(F)}</dd><dd class="kpi-nota">{nf} itens</dd></div>
        <div class="kpi-sobra"><dt>Sobras na amostra</dt><dd>{brl(S)}</dd><dd class="kpi-nota">{ns} itens</dd></div>
      </dl>

      <div class="rel-composicao">
        <p class="rel-subtitulo" id="comp-tit">Situação dos {amostra} itens contados</p>
        <div class="barra-comp" role="img" aria-labelledby="comp-tit" aria-describedby="comp-leg">
          <span class="seg-bate" style="--v:{pbate:.2f}%"></span><span class="seg-falta" style="--v:{pf:.2f}%"></span><span class="seg-sobra" style="--v:{ps:.2f}%"></span>
        </div>
        <ul class="legenda" id="comp-leg">
          <li class="l-bate">{bate} batem</li><li class="l-falta">{nf} com falta</li><li class="l-sobra">{ns} com sobra</li>
        </ul>
        <dl class="rel-somas">
          <div class="s-falta"><dt>Faltas</dt><dd>{brl(F)}</dd></div>
          <div class="s-sobra"><dt>Sobras</dt><dd>{brl(S)}</dd></div>
          <div class="s-abs"><dt>Valor absoluto das divergências</dt><dd>{brl(ABS)}</dd></div>
          <div class="s-liq"><dt>Diferença líquida</dt><dd>{brl(LIQ, True)}</dd></div>
        </dl>
        <p class="liquido">Diferença líquida: <strong>{brl(LIQ, True)}</strong> (sobras menos faltas). Aparece só como referência: as sobras não compensam as faltas, porque são dois erros de controle diferentes. O tamanho do problema é o valor absoluto, {brl(ABS)}.</p>
      </div>

      <div class="rel-grafico">
        <div class="rel-grafico-cabeca">
          <p class="rel-subtitulo" id="graf-tit">As 8 maiores divergências, em reais</p>
          <p class="destaque-dado">As 8 maiores somam <strong>{brl(TOP)}</strong> ({TOP_PCT}%) dos {brl(ABS)} em divergências, contando faltas e sobras pelo valor absoluto. É por elas que a correção começa.</p>
        </div>
        <ul class="barras" aria-labelledby="graf-tit">
{chr(10).join(barras)}
        </ul>
        <ul class="legenda legenda-pequena" aria-hidden="true"><li class="l-falta">Falta</li><li class="l-sobra">Sobra</li></ul>
      </div>

      <div class="rel-tabela">
        <table class="tabela-conc tabela-rel" id="tabela-rel">
          <caption class="rel-subtitulo">Detalhe das 8 maiores divergências</caption>
          <thead><tr><th scope="col">Item</th><th scope="col">Sistema</th><th scope="col">Físico</th><th scope="col">Diferença</th><th scope="col">Custo unit.</th><th scope="col">Impacto</th></tr></thead>
          <tbody>
{chr(10).join(linhas)}
          </tbody>
          <tfoot>
            <tr class="linha-outros"><th scope="row">Outras {onf + ons} divergências<small>cada uma abaixo de {brl(menor_principal)}</small></th><td colspan="5" data-rotulo="Impacto"><span class="falta">{onf} faltas: {brl(-OF, True)}</span> <span class="sobra">{ons} sobras: {brl(OS, True)}</span></td></tr>
            <tr class="linha-total"><th scope="row">Total da amostra</th><td colspan="5" data-rotulo="Impacto"><span class="falta">Faltas: {brl(-F, True)}</span> <span class="sobra">Sobras: {brl(S, True)}</span></td></tr>
            <tr class="linha-abs"><th scope="row">Valor absoluto</th><td colspan="5" data-rotulo="Faltas + sobras">{brl(ABS)}</td></tr>
          </tfoot>
        </table>
      </div>

      <div class="rel-analise">
        <div>
          <h4>Causas prováveis</h4>
          <ol>
{causas}
          </ol>
        </div>
        <div>
          <h4>Ações recomendadas</h4>
          <ol>
{acoes}
          </ol>
        </div>
      </div>
      <p class="rel-rodape">Os valores valem para os {amostra} itens contados, não para o estoque inteiro: a amostra indica onde está o problema, mas não mede com exatidão o total. O relatório real descreve essas limitações: tamanho da amostra, confiabilidade dos custos do cadastro e movimentações ocorridas durante a contagem.</p>
    </article>
    <!-- /demo:relatorio -->"""


def trocar(texto, nome, novo, padrao_inicial):
    marc = re.compile(rf"<!-- demo:{nome} -->.*?<!-- /demo:{nome} -->", re.S)
    if marc.search(texto):
        return marc.sub(lambda m: novo, texto, count=1)
    m = re.search(padrao_inicial, texto, re.S)
    if not m:
        sys.exit(f"Bloco {nome} não encontrado no index.html")
    return texto[:m.start()] + novo + texto[m.end():]


idx = RAIZ / "index.html"
t = idx.read_text(encoding="utf-8")
t = trocar(t, "painel", painel, r'<figure class="painel".*?</figure>')
t = trocar(t, "relatorio", relatorio, r'<article class="relatorio".*?</article>')
idx.write_text(t, encoding="utf-8")
(RAIZ / "tools" / "demo-resumo.json").write_text(json.dumps(resumo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(json.dumps(resumo, ensure_ascii=False))
