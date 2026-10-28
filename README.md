# Nosso Enxoval

Web app para organizar o enxoval de casamento: itens por cômodo e categoria, cotações por loja, orçamento, compras parceladas, meta de poupança e gráfico de evolução. Os dados ficam no Supabase e sincronizam em tempo real entre os dois celulares.

## Estrutura

| Arquivo | Função |
|---|---|
| `index.html` | Página única do app |
| `app.js` | Toda a lógica (telas, cálculos, sincronização) |
| `styles.css` | Visual (claro/escuro automático) |
| `config.js` | URL e chave pública do Supabase |
| `schema.sql` | Banco: tabelas, segurança e dados iniciais |
| `manifest.webmanifest`, `icon.svg` | Instalação na tela inicial do celular |

## Configuração (uma vez só, ~15 min)

### 1. Supabase
1. Crie uma conta em supabase.com e um projeto novo (plano gratuito; região São Paulo).
2. **Authentication › Sign In / Providers**: desative *Allow new users to sign up*. Assim ninguém além de vocês cria conta.
3. **Authentication › Users › Add user › Create new user**: crie o usuário de cada um (e-mail + senha, marque *Auto Confirm User*).
4. Abra `schema.sql`, troque os dois e-mails de exemplo pelos de vocês (os mesmos do passo 3).
5. **SQL Editor › New query**: cole o `schema.sql` inteiro e clique em *Run*.
6. **Project Settings › API**: copie a *Project URL* e a chave *anon public*.

### 2. Código
Cole a URL e a chave em `config.js`. A chave anon é pública por design; quem protege os dados são as regras RLS do banco, que só liberam os e-mails da tabela `membros`.

### 3. GitHub Pages
1. Crie um repositório (ex.: `enxoval`) e envie todos os arquivos para a raiz.
2. **Settings › Pages**: *Deploy from a branch*, branch `main`, pasta `/ (root)`.
3. O app fica em `https://<seu-usuario>.github.io/enxoval/`.

### 4. Celular
Abra o link no celular e use *Adicionar à tela inicial* (Safari: botão compartilhar; Chrome: menu ⋮).

## Regras de cálculo

- **Gasto**: soma do valor total pago dos itens com status *Comprado*.
- **Previsto**: para itens *Pendente/Cotando*, menor cotação × quantidade. Itens sem cotação entram como zero (o painel avisa quantos são).
- **Ganho**: não conta como gasto nem como previsto.
- **Parcelas**: valor total ÷ nº de parcelas, a partir do mês da 1ª parcela (centavos de arredondamento vão na última). À vista conta no mês da compra.
- **Desembolso**: parcelas acumuladas mês a mês; a linha tracejada no gráfico são parcelas futuras já assumidas.
- **Guardado**: soma dos aportes (retirada = valor negativo).
- **Trajetória ideal**: linha reta de zero, no mês de início, até o valor da meta, no mês do prazo.

## Limitações conhecidas

- Projetos gratuitos do Supabase são **pausados após 7 dias sem uso**. Se isso acontecer, entre no painel do Supabase e clique em *Restore*. Usando o app toda semana, não acontece.
- Sem modo offline: precisa de internet para abrir e salvar.
- Não há histórico de alterações nem "quem editou o quê".
