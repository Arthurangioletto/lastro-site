"""Gera as páginas de conteúdo (conteudos/*.html) a partir de um modelo único.

Uso: python3 tools/gerar_conteudos.py
Edite os textos aqui e rode de novo; as páginas são sobrescritas.
"""
import html, json, os

BASE = "https://lastroinventario.com.br/"
DATA = "2026-10-13"
DATA_BR = "13 de outubro de 2026"
AUTOR = "Arthur Angioletto"
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Números do exemplo vêm da mesma fonte do relatório do site (tools/gerar_demo.py → tools/demo-resumo.json)
with open(os.path.join(RAIZ, "tools", "demo-resumo.json"), encoding="utf-8") as _f:
    DEMO = json.load(_f)


def _brl(v, sinal=False):
    s = f"{abs(v):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return (("+" if v > 0 else "\u2212") if sinal else "") + "R$ " + s


def demo_no_texto(t):
    erro = DEMO["absoluto"] / 200000 * 100
    trocas = {
        "@@FALTAS@@": _brl(DEMO["faltas"]), "@@SOBRAS@@": _brl(DEMO["sobras"]),
        "@@ABSN@@": _brl(DEMO["absoluto"])[3:], "@@LIQ@@": _brl(DEMO["liquida"], True),
        "@@ERRO@@": f"{erro:.1f}".replace(".", ",") + "%",
    }
    for k, v in trocas.items():
        t = t.replace(k, v)
    return t

ARTIGOS = [
    {
        "slug": "inventario-de-estoque-sao-paulo",
        "titulo": "Inventário de estoque em São Paulo: como funciona e como se preparar",
        "titulo_seo": "Inventário de Estoque em São Paulo: Como Funciona e Como se Preparar | Lastro",
        "descricao": "Quando fazer o inventário físico, como é a contagem bem feita, o que define o prazo e um checklist de preparação para empresas de São Paulo.",
        "resumo": "Quando vale a pena contar tudo, como é um inventário bem feito e o checklist para a contagem não virar retrabalho.",
        "corpo": """
<p class="abre">Inventário físico é contar o que existe no estoque, comparar com o saldo do sistema e corrigir as diferenças deixando registro de cada ajuste. Parece simples, mas um inventário mal preparado gera números errados, ajustes no escuro e a sensação de que &ldquo;contar não adianta&rdquo;.</p>

<h2>Quando fazer um inventário completo</h2>
<ul>
  <li><b>Fechamento do ano ou do balanço</b>, para o valor do estoque na contabilidade refletir o que existe de verdade.</li>
  <li><b>Troca de sistema (ERP)</b>, para não levar saldo errado para o sistema novo.</li>
  <li><b>Mudança de galpão ou de layout</b>, aproveitando que tudo vai ser movimentado.</li>
  <li><b>Quando ninguém confia mais no saldo</b>: vendas de itens que não existem, compras repetidas e ajustes frequentes.</li>
  <li><b>Entrada de sócio, venda da empresa ou auditoria</b>, quando o estoque precisa ser comprovado.</li>
</ul>
<p>Se a dúvida é só &ldquo;o meu saldo está muito errado?&rdquo;, um <a href="../#raio-x">Raio-X do Estoque</a> por amostragem responde mais rápido e ajuda a decidir se o inventário completo é necessário.</p>

<h2>Como funciona um inventário bem feito</h2>
<ol>
  <li><b>Preparação.</b> Relatório de saldo exportado do sistema (código, descrição, unidade, quantidade e custo), mapa dos endereços, itens avariados e de terceiros separados e identificados.</li>
  <li><b>Corte das movimentações.</b> Combinar antes como tratar entradas e saídas durante a contagem: pausa, horário de corte ou registro para conciliar depois. É a principal fonte de diferença falsa.</li>
  <li><b>Contagem cega.</b> Quem conta não vê o saldo do sistema. Assim a pessoa conta o que está na prateleira, não o que espera encontrar.</li>
  <li><b>Recontagem das divergências.</b> Toda diferença é contada de novo, de preferência por outra pessoa, antes de virar ajuste.</li>
  <li><b>Conciliação.</b> Sistema × físico item a item, com o valor de cada diferença. Faltas e sobras somadas separadamente.</li>
  <li><b>Relatório e causas.</b> O ajuste corrige o saldo; entender a causa reduz a chance de a diferença voltar no mês seguinte.</li>
</ol>

<h2>O que define o prazo</h2>
<p>Não existe prazo padrão. O tempo depende principalmente de:</p>
<ul>
  <li>quantidade de itens diferentes (SKUs) e de endereços;</li>
  <li>organização: produto endereçado e etiquetado se conta muito mais rápido;</li>
  <li>unidade de medida: itens vendidos em metro, quilo ou fração exigem mais cuidado;</li>
  <li>controle de lote e validade, que multiplica as linhas a contar;</li>
  <li>possibilidade de parar ou não a expedição.</li>
</ul>
<p>Por isso o prazo e o tamanho da equipe entram na proposta só depois de entender a operação.</p>

<h2>Checklist de preparação</h2>
<ul class="checklist">
  <li>Relatório de saldo do sistema gerado no horário do corte.</li>
  <li>Notas de entrada pendentes lançadas ou separadas.</li>
  <li>Pedidos separados e não faturados identificados.</li>
  <li>Avariados, devoluções e itens de terceiros em área própria.</li>
  <li>Endereços e prateleiras identificados.</li>
  <li>Caixas abertas fechadas ou identificadas com a quantidade.</li>
  <li>Uma pessoa da empresa que conheça os produtos para tirar dúvidas.</li>
  <li>Regra combinada para itens sem cadastro encontrados na contagem.</li>
</ul>

<h2>Inventário de estoque em São Paulo com a Lastro</h2>
<p>A Lastro atende empresas da cidade de São Paulo com equipe própria de contagem, sistema de contagem com leitor de código de barras e relatório com faltas e sobras em reais. A contagem pode ser programada para fim de semana, conforme o escopo combinado.</p>
""",
    },
    {
        "slug": "estoque-nao-bate-com-o-sistema",
        "titulo": "Por que o estoque não bate com o sistema: 8 causas comuns",
        "titulo_seo": "Estoque Não Bate com o Sistema? 8 Causas Comuns e Como Corrigir | Lastro",
        "descricao": "As causas mais comuns de diferença entre o estoque físico e o sistema, como reconhecer cada uma e o que fazer para a diferença não voltar.",
        "resumo": "Saída sem baixa, unidade de medida, troca de código e outras causas, com o sintoma de cada uma e como corrigir.",
        "corpo": """
<p class="abre">Ajustar o saldo para bater resolve o número de hoje. Se a causa continua, a diferença volta no próximo mês. Estas são as causas que mais aparecem em distribuidoras, lojas e e-commerces com estoque próprio, com o sintoma típico de cada uma.</p>

<h2>1. Saída sem baixa no sistema</h2>
<p><b>Sintoma:</b> faltas recorrentes em itens pequenos e de giro alto. <b>Onde acontece:</b> venda de balcão, amostra, consumo interno, troca feita &ldquo;na hora&rdquo;. <b>Correção:</b> nenhuma saída sem documento no sistema, inclusive as internas.</p>

<h2>2. Erro de unidade de medida</h2>
<p><b>Sintoma:</b> diferença enorme e &ldquo;redonda&rdquo;, como 100 ou 12 vezes o esperado. <b>Onde acontece:</b> produto comprado em caixa e vendido em unidade, rolo e metro, saco e quilo. <b>Correção:</b> revisar o fator de conversão no cadastro e no recebimento.</p>

<h2>3. Recebimento sem conferência</h2>
<p><b>Sintoma:</b> faltas em itens que acabaram de chegar. <b>Onde acontece:</b> a mercadoria entra pela nota, sem contagem física. <b>Correção:</b> conferência cega no recebimento, pelo menos nos itens de maior valor.</p>

<h2>4. Troca de código entre itens parecidos</h2>
<p><b>Sintoma:</b> sobra em um item e falta, de quantidade parecida, em outro muito semelhante (tamanho, cor, voltagem, amperagem). <b>Correção:</b> separar fisicamente, etiquetar e usar leitura de código de barras na venda e na separação.</p>

<h2>5. Devoluções e trocas sem lançamento</h2>
<p><b>Sintoma:</b> sobras de itens que voltaram de cliente. <b>Correção:</b> área própria para devolução e lançamento no mesmo dia.</p>

<h2>6. Produto em mais de um lugar</h2>
<p><b>Sintoma:</b> falta na contagem e o produto aparece depois &ldquo;no fundo&rdquo; ou em outro corredor. <b>Correção:</b> endereçamento com um endereço principal por item e registro dos endereços de pulmão.</p>

<h2>7. Perdas, avarias e vencidos não baixados</h2>
<p><b>Sintoma:</b> faltas que ninguém sabe explicar. <b>Correção:</b> rotina de baixa de avaria e vencimento com responsável e motivo registrado.</p>

<h2>8. Ajuste feito para &ldquo;bater&rdquo;</h2>
<p><b>Sintoma:</b> muitos ajustes no histórico, sem justificativa. <b>Correção:</b> ajuste só depois de recontar e anotar a causa provável. O histórico de ajustes é uma das melhores fontes para descobrir onde o erro nasce.</p>

<h2>Como descobrir quais são as suas</h2>
<p>O primeiro passo é medir. Conte uma amostra, compare com o sistema e olhe faltas e sobras <b>separadamente</b>: somar uma com a outra esconde dois erros diferentes. Sobras costumam apontar para erro de lançamento (unidade, código, devolução); faltas podem ser lançamento ou perda. É isso que o <a href="../#raio-x">Raio-X do Estoque</a> entrega, com as causas prováveis em ordem de valor.</p>
""",
    },
    {
        "slug": "acuracidade-de-estoque",
        "titulo": "Acuracidade de estoque: o que é e como calcular",
        "titulo_seo": "Acuracidade de Estoque: O Que É e Como Calcular (com Exemplo) | Lastro",
        "descricao": "O que é acuracidade de estoque, a fórmula por itens e por valor, um exemplo calculado e os erros mais comuns ao medir.",
        "resumo": "A fórmula por itens e por valor, um exemplo calculado e por que o saldo líquido engana.",
        "corpo": """
<p class="abre">Acuracidade de estoque é o quanto o saldo do sistema corresponde ao que existe fisicamente. É o indicador que responde à pergunta &ldquo;posso confiar no meu sistema para vender e comprar?&rdquo;.</p>

<h2>Acuracidade por itens</h2>
<p>É a forma mais usada. Conte um conjunto de itens e veja quantos batem exatamente com o sistema:</p>
<p class="formula">Acuracidade (%) = itens que batem ÷ itens contados × 100</p>
<p><b>Exemplo:</b> foram contados 150 itens e 118 bateram. A acuracidade é 118 ÷ 150 × 100 = <b>78,7%</b>. Os outros 32 itens têm falta ou sobra.</p>
<p>Defina antes se existe tolerância. Para itens vendidos a granel (metro, quilo), algumas empresas aceitam uma pequena diferença percentual. O importante é a regra ser a mesma em todas as medições.</p>

<h2>Erro em valor</h2>
<p>A acuracidade por itens trata igual um parafuso e um motor. Para ver o peso financeiro, some o valor das divergências <b>em módulo</b>, ou seja, faltas e sobras como valores positivos:</p>
<p class="formula">Erro em valor (%) = (faltas + sobras, em R$) ÷ valor contado × 100</p>
<p><b>Exemplo:</b> uma amostra que vale R$ 200.000,00 teve @@FALTAS@@ em faltas e @@SOBRAS@@ em sobras. O erro em valor é @@ABSN@@ ÷ 200.000,00 × 100 = <b>@@ERRO@@</b>.</p>

<h2>Por que o saldo líquido engana</h2>
<p>No mesmo exemplo, o saldo líquido seria @@LIQ@@ (sobras menos faltas). Parece menor, mas esconde que existem dois problemas: produtos que sumiram e produtos lançados errado. Uma sobra não compensa uma falta. Por isso o relatório deve mostrar as duas separadas.</p>

<h2>Qual meta usar</h2>
<p>Não existe um número que sirva para toda empresa. Uma forma prática:</p>
<ul>
  <li>meça primeiro, sem meta, para saber o ponto de partida;</li>
  <li>defina metas mais rigorosas para os itens de maior valor ou maior giro;</li>
  <li>acompanhe a evolução mês a mês, sempre com o mesmo método de medição.</li>
</ul>

<h2>Como medir sem parar a operação</h2>
<p>Não é preciso contar o estoque inteiro para medir a acuracidade. Uma amostra bem escolhida (itens de maior valor mais alguns sorteados) ou um <a href="inventario-rotativo.html">inventário rotativo</a> já mostram a tendência. Se o número sair baixo, o próximo passo é entender <a href="estoque-nao-bate-com-o-sistema.html">por que o estoque não bate com o sistema</a>.</p>
""",
    },
    {
        "slug": "inventario-rotativo",
        "titulo": "Inventário rotativo: como implantar em uma empresa pequena",
        "titulo_seo": "Inventário Rotativo: Como Implantar em Empresa Pequena (Passo a Passo) | Lastro",
        "descricao": "Passo a passo para implantar o inventário rotativo com curva ABC, um calendário de exemplo e os erros que fazem a rotina perder valor.",
        "resumo": "Curva ABC, calendário de exemplo com contas prontas e os erros que fazem a rotina perder valor.",
        "corpo": """
<p class="abre">No inventário rotativo, uma parte do estoque é contada toda semana ou todo mês, em vez de tudo de uma vez por ano. A operação não para, os erros aparecem cedo e a acuracidade passa a ser acompanhada de forma contínua.</p>

<h2>1. Classifique os itens pela curva ABC</h2>
<p>Ordene os itens pelo valor (custo × quantidade em estoque, ou valor consumido no período). Em geral, poucos itens concentram a maior parte do valor:</p>
<ul>
  <li><b>A:</b> os itens que somam a maior parte do valor;</li>
  <li><b>B:</b> os intermediários;</li>
  <li><b>C:</b> a maioria dos itens, com pouco valor cada.</li>
</ul>
<p>Itens com histórico de divergência ou fáceis de desviar podem subir de classe, mesmo com valor menor.</p>

<h2>2. Defina a frequência e monte o calendário</h2>
<p>Um ponto de partida comum é contar A todo mês, B a cada trimestre e C a cada semestre. Veja as contas com um estoque de 1.200 itens:</p>
<div class="tabela-rolagem"><table class="tabela-artigo">
  <caption>Exemplo de calendário para 1.200 itens</caption>
  <thead><tr><th scope="col">Classe</th><th scope="col">Itens</th><th scope="col">Frequência</th><th scope="col">Itens por mês</th></tr></thead>
  <tbody>
    <tr><th scope="row">A</th><td>120</td><td>mensal</td><td>120</td></tr>
    <tr><th scope="row">B</th><td>360</td><td>trimestral</td><td>120</td></tr>
    <tr><th scope="row">C</th><td>720</td><td>semestral</td><td>120</td></tr>
  </tbody>
  <tfoot><tr><th scope="row">Total</th><td>1.200</td><td></td><td>360</td></tr></tfoot>
</table></div>
<p>São 360 itens por mês: com 20 dias úteis, cerca de 18 itens por dia. Uma rotina curta, que cabe antes da expedição começar.</p>

<h2>3. Conte às cegas e reconte as diferenças</h2>
<p>Quem conta não deve ver o saldo do sistema. Toda diferença é recontada antes de qualquer ajuste, de preferência por outra pessoa.</p>

<h2>4. Investigue antes de ajustar</h2>
<p>Para cada divergência, anote a causa provável: saída sem baixa, unidade de medida, troca de código, recebimento. O ajuste corrige o saldo; a causa anotada é o que ajuda a evitar a próxima diferença. Veja as <a href="estoque-nao-bate-com-o-sistema.html">8 causas mais comuns</a>.</p>

<h2>5. Registre o indicador</h2>
<p>Ao fim de cada mês, calcule a <a href="acuracidade-de-estoque.html">acuracidade</a> dos itens contados e o valor das faltas e sobras, separados. O gráfico mês a mês mostra se o controle está melhorando.</p>

<h2>Erros que fazem o rotativo perder valor</h2>
<ul>
  <li>contar com a lista de saldos na mão;</li>
  <li>contar no horário de maior movimento;</li>
  <li>ajustar sem recontar e sem anotar a causa;</li>
  <li>deixar a rotina parar nas semanas mais corridas;</li>
  <li>nunca rever a curva ABC.</li>
</ul>

<h2>Implantação com a Lastro</h2>
<p>A Lastro classifica os itens, monta o calendário, treina a equipe na contagem cega e acompanha os indicadores no <a href="../#servicos">acompanhamento mensal</a>.</p>
""",
    },
]


def pagina(a, outros):
    url = f"{BASE}conteudos/{a['slug']}.html"
    ld = [
        {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": a["titulo"],
            "description": a["descricao"],
            "datePublished": DATA,
            "dateModified": DATA,
            "inLanguage": "pt-BR",
            "mainEntityOfPage": url,
            "image": BASE + "assets/og.png",
            "author": {"@type": "Person", "name": AUTOR, "jobTitle": "CEO e fundador da Lastro"},
            "publisher": {"@type": "Organization", "name": "Lastro Inventário e Consultoria de Estoque", "logo": {"@type": "ImageObject", "url": BASE + "assets/apple-touch-icon.png"}},
        },
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Início", "item": BASE},
                {"@type": "ListItem", "position": 2, "name": "Conteúdos", "item": BASE + "#conteudos"},
                {"@type": "ListItem", "position": 3, "name": a["titulo"], "item": url},
            ],
        },
    ]
    rel = "\n".join(
        f'      <li><a href="{o["slug"]}.html">{html.escape(o["titulo"])}</a></li>' for o in outros
    )
    e = html.escape
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(a['titulo_seo'])}</title>
<meta name="description" content="{e(a['descricao'])}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index, follow">
<meta name="author" content="{AUTOR}">
<meta property="og:type" content="article">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Lastro Inventário e Consultoria de Estoque">
<meta property="og:title" content="{e(a['titulo'])}">
<meta property="og:description" content="{e(a['descricao'])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE}assets/og.png">
<meta property="article:published_time" content="{DATA}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#10233a">
<link rel="icon" href="../assets/logo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../assets/apple-touch-icon.png">
<link rel="preload" href="../assets/instrument-sans.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="../assets/site.css">
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=1)}
</script>
</head>
<body>
<a class="pular" href="#conteudo">Pular para o conteúdo</a>
<header class="topo topo-simples" id="topo"><div class="faixa topo-faixa"><a class="marca" href="../" aria-label="Lastro Inventário e Consultoria de Estoque, página inicial"><img src="../assets/logo.svg" alt="" width="32" height="32"><span class="marca-nome">Lastro<small>Inventário e Consultoria de Estoque</small></span></a><a class="btn btn-principal btn-topo" href="../#contato">Pedir avaliação</a></div></header>
<main id="conteudo" class="faixa artigo-faixa">
  <nav class="trilha-nav" aria-label="Você está em"><ol><li><a href="../">Início</a></li><li><a href="../#conteudos">Conteúdos</a></li><li aria-current="page">{e(a['titulo'])}</li></ol></nav>
  <article class="artigo">
    <header class="artigo-cabeca">
      <h1>{e(a['titulo'])}</h1>
      <p class="artigo-meta">Por {AUTOR}, CEO e fundador da Lastro · <time datetime="{DATA}">{DATA_BR}</time></p>
    </header>
{demo_no_texto(a['corpo']).strip()}
    <aside class="artigo-cta" aria-labelledby="cta-{a['slug']}">
      <h2 id="cta-{a['slug']}">Quer saber quanto o seu estoque erra?</h2>
      <p>A Lastro mede a diferença entre o sistema e a prateleira e mostra quanto ela vale em reais. Atendimento em São Paulo capital.</p>
      <a class="btn btn-principal btn-grande" href="../#contato">Solicitar avaliação</a>
    </aside>
  </article>
  <nav class="relacionados" aria-labelledby="rel-titulo">
    <h2 id="rel-titulo">Leia também</h2>
    <ul>
{rel}
    </ul>
  </nav>
</main>
<footer class="rodape"><div class="faixa rodape-grade"><div><a class="marca marca-rodape" href="../"><img src="../assets/logo.svg" alt="" width="28" height="28"><span class="marca-nome">Lastro<small>Inventário e Consultoria de Estoque</small></span></a><p>Inventário físico, Raio-X do Estoque e consultoria de estoque em São Paulo, SP</p></div><nav aria-label="Rodapé"><ul><li><a href="../">Início</a></li><li><a href="../sistemas.html">Sistemas</a></li><li><a href="../#contato">Pedir avaliação</a></li><li><a href="../privacidade.html">Política de privacidade</a></li></ul></nav></div></footer>
</body>
</html>
"""


def main():
    os.makedirs(os.path.join(RAIZ, "conteudos"), exist_ok=True)
    for a in ARTIGOS:
        outros = [o for o in ARTIGOS if o is not a]
        with open(os.path.join(RAIZ, "conteudos", a["slug"] + ".html"), "w", encoding="utf-8") as f:
            f.write(pagina(a, outros))
    # sitemap
    urls = [BASE, BASE + "sistemas.html", BASE + "privacidade.html"] + [f"{BASE}conteudos/{a['slug']}.html" for a in ARTIGOS]
    linhas = "\n".join(f"  <url><loc>{u}</loc><lastmod>{DATA}</lastmod></url>" for u in urls)
    with open(os.path.join(RAIZ, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{linhas}\n</urlset>\n')
    print("ok:", len(ARTIGOS), "artigos")


if __name__ == "__main__":
    main()
