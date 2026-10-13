# Lastro — site e sistema de contagem

Dois produtos no mesmo repositório, ambos estáticos (sem servidor, sem banco, sem custo de hospedagem):

| Pasta | O que é | Endereço quando publicado |
|---|---|---|
| `/` | Site da Lastro (página única + política de privacidade) | `https://lastroestoque.com.br/` |
| `/app/` | Lastro Contagem: ferramenta de inventário e Raio-X do Estoque | `https://lastroestoque.com.br/app/` (fora dos buscadores) |

## Antes de publicar: preencha o contato

Abra `assets/config.js` e coloque o WhatsApp (só números, com 55 e DDD) e o e-mail:

```js
window.LASTRO = { nome: "Lastro", whatsapp: "5511999999999", email: "contato@lastroestoque.com.br", regiao: "São Paulo capital" };
```

Sem WhatsApp, o formulário abre o e-mail. O formulário não grava nada: ele monta a mensagem e abre o WhatsApp ou o e-mail de quem preencheu. Por isso não precisa de servidor, não junta spam em banco e quase não tem tratamento de dados pessoais.

## Publicar de graça no GitHub Pages

1. Crie um repositório no GitHub (ex.: `lastro-site`) e suba estes arquivos.
2. No repositório: **Settings → Pages → Build and deployment → Deploy from a branch → main / (root)**.
3. Em 1 a 2 minutos o site fica em `https://SEU-USUARIO.github.io/lastro-site/`.
4. Domínio próprio: registre `lastroestoque.com.br` no registro.br (cerca de R$ 40 por ano), em **Settings → Pages → Custom domain** digite o domínio, e no registro.br aponte o DNS para o GitHub Pages (registros A para 185.199.108.153, .109.153, .110.153 e .111.153, e CNAME `www` para `SEU-USUARIO.github.io`). Marque **Enforce HTTPS**.

Custo mensal: zero. Custo anual: o domínio.

## Rodar no computador

```bash
python3 -m http.server 8000
```
Abra `http://localhost:8000` (site) e `http://localhost:8000/app/` (contagem).

## Lastro Contagem: como funciona

- **Projetos**: um por cliente, tipo Raio-X (amostra) ou inventário completo.
- **Base do cliente**: importa Excel (.xlsx) ou CSV e reconhece as colunas sozinho (código, descrição, saldo, custo, unidade, EAN, endereço, lote, validade), mesmo com título acima do cabeçalho. Mesmo código e lote em duas linhas: soma o saldo.
- **Amostra (Raio-X)**: os N itens de maior valor (saldo × custo) mais M sorteados com um número de sorteio que permite repetir a mesma amostra. Lista para imprimir em ordem de endereço.
- **Contagem**: no celular ou no computador, com leitor USB, câmera (Android/Chrome) ou digitando. Contagem cega (não mostra o saldo do sistema). Lê EAN e GS1 (escolhe o lote pela etiqueta). Produto com vários lotes: pergunta qual. Código fora da base: registra como "sem cadastro". Cada contagem guarda quem contou, quando e o endereço. Botão desfazer.
- **Recontagem**: lista só o que deu diferença na 1ª contagem. A recontagem substitui a 1ª; quando as duas não batem entre si, o item fica marcado.
- **Conciliação**: sistema × 1ª × recontagem × físico, diferença e valor, filtros e exportação para Excel (CSV). Item não achado só vira zero com confirmação.
- **Relatório**: resumo, faltas e sobras separadas (o saldo líquido não é tratado como prejuízo), maiores diferenças, itens sem cadastro, causas, plano de ação e limitações. Imprime ou salva em PDF.
- **Dados**: ficam só no aparelho (IndexedDB). **Baixar backup** gera um arquivo .json; **Juntar contagens de outro aparelho** soma as contagens feitas no celular de um ajudante.
- **Sem internet**: depois de aberto uma vez com internet, o app funciona offline (service worker).

## Limitações conhecidas

- Câmera como leitor só funciona no Android com Chrome; no iPhone, use leitor USB/Bluetooth ou digite.
- Vários aparelhos não sincronizam sozinhos: junte as contagens pelo arquivo de backup.
- Limpar os dados do navegador apaga os projetos. Baixe o backup ao fim de cada dia de contagem.

## Testes feitos

Site: computador e celular sem rolagem lateral, validação do formulário, mensagem montada para e-mail. Contagem: projeto completo no navegador (importação com título e lotes, amostra, contagem por código, EAN e GS1, sem cadastro, recontagem, conciliação, relatório, PDF, dados mantidos depois de recarregar).

## Licenças

Fonte Instrument Sans (SIL Open Font License, `assets/instrument-sans-OFL.txt`).
