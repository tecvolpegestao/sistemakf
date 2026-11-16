# Manual de processos — KF Detail

Este manual descreve como a equipe usa o sistema no dia a dia. Ele cobre a operação básica já construída: do primeiro contato com o cliente até a entrega do veículo e o pagamento.

O andamento do serviço e o pagamento são dois controles separados. Um carro pode estar pronto e ainda sem pagamento, ou pago e ainda na oficina.

## Quem usa

| Perfil | Para que entra | O que enxerga |
| --- | --- | --- |
| Dono | Preço, custo, margem, catálogo e textos do orçamento | Tudo, inclusive custo e margem |
| Atendimento | Cliente, orçamento, ordem, PDF e pagamento | Preços e pagamentos. Custo e margem ficam ocultos |
| Aplicador | Executar a ordem que foi atribuída a ele | Etapas e fotos da própria ordem. Valores, PDF e pagamentos ficam ocultos |

A busca do topo aceita placa, nome do cliente ou número da ordem. O aplicador só encontra as ordens atribuídas a ele.

## O caminho de um veículo

O caminho normal tem seis situações. Cada botão principal da ordem avança um passo.

1. **Orçamento.** O atendimento monta os serviços e o valor.
2. **Aguardando aprovação.** O PDF ou o texto do WhatsApp já foi para o cliente.
3. **Aprovado.** O cliente aceitou o escopo e o valor. A data de entrada é combinada com a equipe.
4. **Em execução.** O aplicador está no veículo.
5. **Pronto.** O serviço acabou e o carro ainda não saiu.
6. **Entregue.** O veículo foi embora. O pagamento pode já ter acontecido ou ainda estar em aberto.

Dois desvios:

- **Recusado.** O cliente não aprovou. A ordem pode voltar para orçamento e ser refeita.
- **Cancelado.** A ordem sai de circulação com um motivo escrito. O motivo fica no histórico. Uma ordem que já tem pagamento, ou que já foi entregue, só o dono cancela.

O aplicador só move a própria ordem de Aprovado para Em execução, e de Em execução para Pronto. Entrega, aprovação e cancelamento ficam com o atendimento ou com o dono.

## Rotina do atendimento

### 1. Olhar o painel

O painel resume o dia em quatro números:

- **Em atendimento:** ordens aprovadas, em execução ou prontas.
- **Prontos:** carros que ainda não foram entregues.
- **A receber:** valor das ordens já entregues e ainda não pagas.
- **Recebido no mês:** o que entrou em Pix, dinheiro ou cartão desde o dia 1.

### 2. Achar ou cadastrar o cliente

Antes de abrir um orçamento novo, busque a placa ou o nome. Se o cliente já existe, use o cadastro dele. Uma placa não pode existir duas vezes.

Para um cliente novo, informe nome e telefone. Se o telefone já estiver em outro cadastro, o sistema avisa e pede confirmação antes de criar outro.

Cliente particular e loja parceira são cadastros diferentes. A loja parceira tem página própria, logo e pacote exclusivo. A Auto Gallery é o exemplo: o pacote comercial dela vale R$ 500 por veículo.

O veículo pede placa, marca e modelo. A placa vale no formato antigo (ABC1234) e no Mercosul (ABC1D23).

### 3. Montar o orçamento

Em **Novo orçamento**, escolha o cliente e o veículo, ou cadastre os dois na hora. Uma ordem tem um veículo.

Os itens vêm do catálogo:

- **Mão de obra:** polimento, vitrificação, lavagem detalhada, lavagem de motor, higienização, remoção de película.
- **Serviço com produto:** PPF e película fumê, orçados em metros lineares. Informe a metragem prevista.
- **Pacote:** um conjunto de serviços com um preço fechado. Se o cliente for uma loja parceira e o orçamento ainda estiver vazio, o pacote exclusivo dessa loja entra sozinho. Nesse caso o PDF mostra **Valor por veículo**.

Produto de revenda, como o aromatizante, ainda não entra no orçamento. A venda avulsa fica para a fase seguinte.

O desconto, quando houver, não pode passar do subtotal. As observações da ordem aparecem para a equipe e não substituem o texto padrão do PDF.

Se já souber quem vai executar, atribua o aplicador agora. Dá para atribuir depois.

### 4. Enviar para o cliente

Na ordem, use:

- **PDF** para o orçamento impresso ou enviado em arquivo. Ele sai sempre no visual claro, com a logo, o veículo, os serviços, o valor em destaque e as linhas de data e assinatura.
- **Copiar** para colar o resumo em outra conversa.
- **WhatsApp** quando o cliente tem telefone. O link abre a conversa com o resumo pronto.

Em seguida, aperte **Enviar para aprovação**.

### 5. Registrar a resposta

- Cliente aceitou: **Registrar aprovação**.
- Cliente recusou: **Recusar**. Para refazer a proposta, volte a ordem para orçamento.

Depois da aprovação, o atendimento não altera itens nem preço. Se o escopo mudar, o dono edita. A alteração guarda quem mudou, quando mudou e o valor anterior.

## Rotina do aplicador

1. Abra **Minhas ordens**. A lista traz só o que foi atribuído a você.
2. Na ordem aprovada, aperte **Iniciar execução** quando o carro entrar.
3. Conclua cada etapa. Um pacote vira uma etapa por serviço que o compõe. Quem concluiu e o horário ficam registrados. Uma etapa concluída pode ser reaberta.
4. Anexe fotos de **Antes** e **Depois**.
5. Quando o serviço acabar, aperte **Marcar pronto** e avise o atendimento.

O aplicador não vê preço, custo, margem, PDF nem pagamento.

## Entrega e pagamento

O atendimento marca **Entregue** quando o veículo sai.

O pagamento pode ser registrado em qualquer momento da ordem, antes ou depois da entrega. Informe valor, forma (Pix, dinheiro ou cartão) e data. O valor não pode passar do saldo. Um pagamento menor que o total deixa a ordem como **Pago em parte**.

| Situação do pagamento | Significado |
| --- | --- |
| Sem pagamento | Nada entrou |
| Pago em parte | Entrou menos que o valor da ordem |
| Pago | O saldo zerou |

**A receber** lista só o que já foi entregue e ainda tem saldo. Dá para ordenar por tempo ou por valor, e abrir o WhatsApp do cliente. Uma ordem aprovada e ainda na oficina não entra nessa lista, mesmo que não tenha sido paga.

**Recebimentos** lista o que entrou, com período, forma e quem registrou.

## Catálogo e custo

Só o dono cria, altera, duplica ou inativa itens. O atendimento consulta o catálogo para orçar.

O custo informado no catálogo é uma estimativa. No momento em que a ordem é salva, esse custo fica congelado na linha. A margem estimada é `(preço − custo) / preço`. Se o custo ainda for zero, o sistema mostra **Ainda não informado** em vez de uma margem de 100%.

Nesta fase, a mão de obra não entra no custo. O custo do pacote é a soma do custo dos serviços que o compõem. O consumo real de produto e a metragem de PPF efetivamente usada entram na fase de estoque.

Uma mudança de preço no catálogo não reescreve ordens já feitas. A alteração fica na atividade importante, em Configurações.

## Configurações

O dono ajusta os textos de apresentação e de fechamento do PDF, o Instagram, a cidade e a chave Pix da KF. Instagram e cidade aparecem no rodapé do PDF quando estão preenchidos. A chave Pix fica guardada para o fechamento com o parceiro, que ainda não está nesta fase.

A mesma tela mostra as últimas ações importantes: mudança de preço, cancelamento, pagamento e alteração de configuração.

## O que este manual ainda não cobre

- Estoque, entrada de produto e baixa pelo consumo real da ordem.
- Venda de produto fora de uma ordem de serviço.
- Fechamento semanal com a Auto Gallery e as outras lojas.
- Link para o cliente aprovar o orçamento dentro do sistema. Hoje a aprovação é registrada pela equipe, e o PDF continua com o campo de assinatura.
- Nota fiscal.

Enquanto isso não for confirmado com a operação, o sistema segue assim: preços do catálogo são ponto de partida, exceto o pacote da Auto Gallery a R$ 500; PPF e película em metro linear; pagamentos em Pix, dinheiro e cartão; login e dados separados de qualquer outro sistema.
