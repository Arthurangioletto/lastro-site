# Lastro — site e sistema de contagem

Dois produtos no mesmo repositório, ambos estáticos (HTML, CSS e JavaScript puros, sem build, sem servidor, sem banco, sem custo de hospedagem):

| Pasta | O que é | Endereço atual |
|---|---|---|
| `/` | Site da Lastro (página única + política de privacidade) | https://lastroinventario.com.br/ |
| `/app/` | Lastro Contagem: ferramenta de inventário e Raio-X do Estoque | https://lastroinventario.com.br/app/ (fora dos buscadores) |

## Estrutura do site

```
index.html            página principal
privacidade.html      política de privacidade (LGPD)
sistemas.html         página Sistemas (app de inventário, Bipou, módulos sob medida, painel com gráficos)
assets/ilustra-inventario.svg  ilustração da equipe contando no armazém (seção "Em campo")
assets/img/*.webp     telas reais dos sistemas com dados fictícios
conteudos/*.html      guias para busca (inventário em SP, estoque não bate, acuracidade, inventário rotativo)
tools/demo.json          FONTE ÚNICA dos números do exemplo fictício (relatório, painel, guia)
tools/gerar_demo.py      calcula totais, ranking e % e reescreve o painel e o relatório no index.html
tools/demo-resumo.json   totais calculados (gerado; usado pelo gerar_conteudos.py)
tools/gerar_conteudos.py  gera os guias e o sitemap a partir de um modelo único
tools/gerar_backup_demo.py  backup fictício do app com os mesmos números (para as telas em assets/img)
tools/gerar_og.js        gera assets/og.png e o apple-touch-icon (Playwright, site rodando na porta 8765)
assets/config.js      contato (WhatsApp, e-mail): troque aqui
assets/site.css       estilo (cores em :root)
assets/site.js        menu, CTA fixo no celular, formulário com revisão
assets/logo.svg       marca e favicon
assets/og.png         imagem de compartilhamento (1200×630)
assets/apple-touch-icon.png
assets/instrument-sans.woff  fonte (OFL)
sitemap.xml, robots.txt
tests/site.test.js, tests/conteudos.test.js   testes automáticos (Playwright)
tests/medir.js         mede peso, requisições, LCP e CLS
```

Nome usado no site e nas buscas: **Lastro Inventário e Consultoria de Estoque** (curto: Lastro). CEO e fundador: Arthur Angioletto.

Seções da página, na ordem: primeira dobra com painel de conciliação → sinais → Raio-X do Estoque (oferta principal) → exemplo de relatório → serviços em 5 etapas → como funciona (6 passos) → quem está por trás (competências, equipe, sistema e método próprios, compromissos) → guias → dúvidas → formulário.

## Exemplo de relatório (dados fictícios)

Todos os números do exemplo saem de `tools/demo.json`: as 8 maiores divergências, as outras 24 e o item que bate mostrado no painel. Para mudar o exemplo:

```bash
python3 tools/gerar_demo.py        # reescreve o painel e o relatório no index.html (entre os marcadores <!-- demo:... -->)
python3 tools/gerar_conteudos.py   # atualiza o exemplo do guia de acuracidade
```

O script recusa dados em que alguma das "outras" divergências seja maior que a 8ª maior. Não edite os números à mão no index.html: o teste compara a página com o demo.json. Se mudar os valores, gere de novo `assets/og.png` (`tools/gerar_og.js`) e as telas do app (`tools/gerar_backup_demo.py`, depois importe o backup no app e capture as telas).

Valores atuais: amostra de 150 de 1.380 itens; 118 batem (78,7%); faltas R$ 4.266,60 em 21 itens; sobras R$ 1.905,60 em 11 itens; valor absoluto R$ 6.172,20; diferença líquida −R$ 2.361,00; as 8 maiores somam R$ 4.495,50 (73% do valor absoluto).

## Guias (conteúdo para busca)

Para editar ou criar um guia, mude a lista `ARTIGOS` em `tools/gerar_conteudos.py` e rode `python3 tools/gerar_conteudos.py`. O script reescreve `conteudos/*.html` e o `sitemap.xml`. Depois, atualize os cartões da seção `#conteudos` no `index.html`.

## Contato

`assets/config.js`:

```js
window.LASTRO = { nome: "Lastro", whatsapp: "5511950600817", email: "", regiao: "São Paulo capital" };
```

O `site.js` atualiza todos os links `wa.me` da página com esse número. Se trocar o número, troque também o `telephone` do bloco JSON-LD no `<head>` do `index.html`.

## Formulário

1. A pessoa preenche. Obrigatórios: nome, empresa, bairro/cidade, segmento e problema (mínimo de 10 letras).
2. **Revisar mensagem** valida os campos, mostra os erros ao lado de cada campo e um resumo, e põe o foco no primeiro erro.
3. Com tudo certo, aparece a mensagem pronta para conferir, com três botões: **Abrir no WhatsApp** (link real `wa.me` com o texto codificado), **Copiar texto** e **Editar**.
4. Nada é gravado nem enviado pelo site. A mensagem só sai quando a pessoa toca em enviar no WhatsApp, e a página diz isso.

Há um campo-armadilha escondido contra robôs. O site não usa analytics, cookies nem serviços de terceiros.

## Rodar no computador

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000` (site) e `http://localhost:8000/app/` (contagem).

## Testes

Com o site rodando em `localhost:8000` e o Playwright instalado (`npm i -D playwright`):

```bash
node tests/site.test.js
node tests/conteudos.test.js
```

O teste verifica:
- Larguras 320, 360, 375, 390, 414, 768, 1024, 1280, 1366 e 1920 px: sem rolagem lateral, alvos de toque ≥ 40 px e nenhuma fonte < 12 px.
- Âncoras, ids únicos, links externos e arquivos sem 404.
- Menu do celular: abre, fecha com Esc e com clique fora, e devolve o foco.
- Link "pular para o conteúdo" e CTA fixo no celular (aparece e some no lugar certo).
- Formulário: validação, mensagem montada e codificada corretamente, só campos preenchidos, Editar, interesse escolhido pelos botões dos serviços e campo-armadilha.
- Números do exemplo, que precisam fechar entre si:
  - Diferença e impacto de cada linha.
  - Totais da tabela, KPIs, painel da primeira dobra, gráfico, barra de composição, % que bate e diferença líquida.
- Acessibilidade: um h1, títulos sem pular nível, rótulos, alt, contraste AA calculado, foco visível e `lang`.
- Movimento reduzido, página sem JavaScript, app de contagem abrindo e console sem erros.

## Publicar (GitHub Pages)

O Pages já está ligado: **Settings → Pages → Deploy from a branch → main / (root)**. Todo push na `main` publica em 1 a 2 minutos.

### Domínio próprio

`lastroinventario.com.br` já está ligado (arquivo `CNAME`, DNS no registro.br com os registros A do GitHub Pages e CNAME `www`, HTTPS forçado). Quando criar um e-mail no domínio, preencha `email` no `config.js`; a política de privacidade passa a mostrá-lo no lugar do WhatsApp.

### Ponto de restauração

Antes da auditoria de outubro de 2026 foi criado o branch `restauracao-antes-auditoria`. Para voltar: `git checkout main && git reset --hard restauracao-antes-auditoria && git push --force-with-lease` (apaga as mudanças posteriores; faça só se tiver certeza).

## Lastro Contagem: como funciona

- **Projetos**: um por cliente, tipo Raio-X (amostra) ou inventário completo.
- **Base do cliente**: importa Excel (.xlsx) ou CSV e reconhece as colunas sozinho (código, descrição, saldo, custo, unidade, EAN, endereço, lote, validade), mesmo com título acima do cabeçalho.
- **Amostra (Raio-X)**: os N itens de maior valor mais M sorteados, com número de sorteio repetível. Lista para imprimir em ordem de endereço.
- **Contagem**: leitor USB, câmera (Android/Chrome) ou digitação. Contagem cega, lê EAN e GS1, registra itens sem cadastro, guarda quem contou e quando, e tem botão desfazer.
- **Recontagem, conciliação e relatório**: faltas e sobras separadas, maiores diferenças, causas, plano de ação e limitações. O relatório pode ser impresso ou salvo em PDF.
- **Dados**: ficam só no aparelho (IndexedDB). Há backup em arquivo e junção de contagens de outro aparelho, e o app funciona offline depois de aberto uma vez.

## Limitações conhecidas

- **Fonte**: a Instrument Sans está em .woff. Converter para .woff2 (menor) exige a biblioteca brotli, que não pôde ser instalada no ambiente usado; vale converter depois.
- **Testes**: foram feitos em navegador Chromium automatizado, simulando as larguras de tela. Ainda não houve teste em aparelhos reais (iPhone/Safari, Android) nem com leitor de tela real.
- **Imagem de compartilhamento**: só aparece no WhatsApp e no LinkedIn depois que a página estiver publicada. O cache deles pode demorar a atualizar.
- **Contagem no iPhone**: a câmera como leitor só funciona no Android com Chrome; no iPhone, use leitor USB/Bluetooth ou digite.
- **Revisão jurídica**: a política de privacidade foi escrita em linguagem simples e não teve revisão de advogado.

## Licenças

Fonte Instrument Sans (SIL Open Font License, `assets/instrument-sans-OFL.txt`).

## Fotos reais

A seção "Em campo" usa uma ilustração própria. Fotos reais da equipe trabalhando passam mais confiança do que foto de banco. Para trocar:
1. Salve as fotos em `assets/img/` (de preferência .webp com até 1600 px de largura).
2. Troque o `src` da imagem em `.campo-figura` no `index.html`.
3. Use só fotos com autorização das pessoas que aparecem e sem logotipo ou dado de cliente ou de empregador.
