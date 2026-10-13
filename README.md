# Lastro — site e sistema de contagem

Dois produtos no mesmo repositório, ambos estáticos (HTML, CSS e JavaScript puros, sem build, sem servidor, sem banco, sem custo de hospedagem):

| Pasta | O que é | Endereço atual |
|---|---|---|
| `/` | Site da Lastro (página única + política de privacidade) | https://arthurangioletto.github.io/lastro-site/ |
| `/app/` | Lastro Contagem: ferramenta de inventário e Raio-X do Estoque | https://arthurangioletto.github.io/lastro-site/app/ (fora dos buscadores) |

## Estrutura do site

```
index.html            página principal
privacidade.html      política de privacidade (LGPD)
assets/config.js      contato (WhatsApp, e-mail): troque aqui
assets/site.css       estilo (cores em :root)
assets/site.js        menu, CTA fixo no celular, formulário com revisão
assets/logo.svg       marca e favicon
assets/og.png         imagem de compartilhamento (1200×630)
assets/apple-touch-icon.png
assets/instrument-sans.woff  fonte (OFL)
sitemap.xml, robots.txt
tests/site.test.js    testes automáticos (Playwright)
```

Seções da página, na ordem: primeira dobra com painel de conciliação → sinais → Raio-X do Estoque (oferta principal) → exemplo de relatório → serviços em 5 etapas → como funciona (6 passos) → quem faz e compromissos → dúvidas → formulário.

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

### Quando tiver o domínio próprio (lastroestoque.com.br)

1. Registre no registro.br.
2. Em **Settings → Pages → Custom domain**, digite o domínio.
3. No registro.br, aponte o DNS:
   - registros A para 185.199.108.153, 185.199.109.153, 185.199.110.153 e 185.199.111.153;
   - CNAME `www` para `arthurangioletto.github.io`.
4. Marque **Enforce HTTPS**.
5. Troque `https://arthurangioletto.github.io/lastro-site/` por `https://lastroestoque.com.br/` nestes lugares:
   - `index.html`: canonical, og:url, og:image e JSON-LD;
   - `privacidade.html`: canonical;
   - `sitemap.xml` e `robots.txt`.
6. Com o e-mail do domínio criado, preencha `email` no `config.js`.

## Lastro Contagem: como funciona

- **Projetos**: um por cliente, tipo Raio-X (amostra) ou inventário completo.
- **Base do cliente**: importa Excel (.xlsx) ou CSV e reconhece as colunas sozinho (código, descrição, saldo, custo, unidade, EAN, endereço, lote, validade), mesmo com título acima do cabeçalho.
- **Amostra (Raio-X)**: os N itens de maior valor mais M sorteados, com número de sorteio repetível. Lista para imprimir em ordem de endereço.
- **Contagem**: leitor USB, câmera (Android/Chrome) ou digitação. Contagem cega, lê EAN e GS1, registra itens sem cadastro, guarda quem contou e quando, e tem botão desfazer.
- **Recontagem, conciliação e relatório**: faltas e sobras separadas, maiores diferenças, causas, plano de ação e limitações. O relatório pode ser impresso ou salvo em PDF.
- **Dados**: ficam só no aparelho (IndexedDB). Há backup em arquivo e junção de contagens de outro aparelho, e o app funciona offline depois de aberto uma vez.

## Limitações conhecidas

- **robots.txt**: no endereço `github.io/lastro-site/` os buscadores leem o robots.txt da raiz `arthurangioletto.github.io`, não o deste repositório. Ele passa a valer com o domínio próprio. O sitemap pode ser enviado manualmente no Google Search Console.
- **Testes**: foram feitos em navegador Chromium automatizado, simulando as larguras de tela. Ainda não houve teste em aparelhos reais (iPhone/Safari, Android) nem com leitor de tela real.
- **Imagem de compartilhamento**: só aparece no WhatsApp e no LinkedIn depois que a página estiver publicada. O cache deles pode demorar a atualizar.
- **Contagem no iPhone**: a câmera como leitor só funciona no Android com Chrome; no iPhone, use leitor USB/Bluetooth ou digite.
- **Revisão jurídica**: a política de privacidade foi escrita em linguagem simples e não teve revisão de advogado.

## Licenças

Fonte Instrument Sans (SIL Open Font License, `assets/instrument-sans-OFL.txt`).
