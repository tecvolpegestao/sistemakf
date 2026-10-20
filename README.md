# KF Detail

Sistema da operação da KF Detail: clientes, veículos, parceiros, catálogo, orçamento em PDF e ordens de serviço até o pagamento.

Esta entrega cobre a operação básica do plano. Estoque com custo real, venda avulsa de produtos e o fechamento semanal com parceiros ficam para as fases seguintes. O catálogo já guarda custo e margem quando o dono informa o custo, e o produto de revenda de exemplo mostra a conta (R$ 8 de custo, R$ 16 de venda, 50% de margem).

## Como rodar

```bash
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Abra http://localhost:3000.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Dono | victor@kfdetail.com.br | kfdetail |
| Atendimento | atendimento@kfdetail.com.br | kfdetail |
| Aplicador | aplicador@kfdetail.com.br | kfdetail |

`npm run db:setup` recria a base de demonstração, com a Auto Gallery, o pacote de R$ 500 e ordens em situações diferentes. `npm test` cobre custo, margem, pagamento e o fluxo da ordem.

## O que o dono vê e os outros não

Custo e margem aparecem só para o dono. O atendimento vê preços, orçamentos, pagamentos e clientes. O aplicador vê as ordens atribuídas a ele, conclui etapas e anexa fotos, sem valores.

## Identidade

As cores e as duas logos seguem as diretrizes de outubro de 2026. O tema claro usa a logo com K em grafite; o tema escuro usa a logo com K em cinza. O azul `#0149D3` fica nos botões e no item selecionado. No tema escuro, link e texto de destaque usam `#4D8BFF`.

## Decisões enquanto os pontos em aberto não são confirmados

- Os preços do catálogo, fora o pacote da Auto Gallery, são ponto de partida e podem ser editados.
- O custo de mão de obra não entra na conta.
- PPF e película são orçados em metros lineares.
- O PDF deixa campo de data e assinatura, e a aprovação também pode ser registrada no sistema.
- Pagamentos: Pix, dinheiro e cartão.
- O sistema tem login e dados próprios.
