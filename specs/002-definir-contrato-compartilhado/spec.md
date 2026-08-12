# Spec 002 — Contrato Compartilhado (`packages/contracts`)

## Cenários de Uso

1. Como desenvolvedor(a) implementando `providers/aws` (spec 005 em
   diante), preciso de um formato já definido para descrever o
   manifesto do provider (identidade, environment ativo, capabilities
   e status de saúde de cada uma), para poder implementar o endpoint
   de manifesto sem redefinir esse formato durante a implementação.
2. Como desenvolvedor(a) implementando `apps/ui` (fase 3), preciso
   consumir um contrato estável e tipado para renderizar capabilities
   condicionalmente (disponível/indisponível/degradado) e navegar por
   listagens paginadas, sem depender de nenhum detalhe interno de
   provider específico.
3. Como desenvolvedor(a) que vai iniciar um segundo provider real
   (Azure ou GCP) no Estado 2 da arquitetura, preciso que o contrato
   já carregue versionamento semântico próprio desde o primeiro
   commit, para poder evoluí-lo sem quebrar consumidores que já
   existem (UI e provider AWS em uso).
4. Como desenvolvedor(a) trabalhando em qualquer lado do contrato (UI
   ou provider), preciso que um erro de operação (ex.: recurso não
   encontrado, falha de conexão) chegue em um formato estruturado e
   previsível, para tratar ou exibir o erro de forma consistente sem
   parsing ad-hoc de mensagem de texto.

Esta feature não expõe UI nem endpoint funcional — define apenas as
formas de dado consumidas pelas specs seguintes (005+ no provider,
009+ na UI). O "usuário" desta spec é quem desenvolve os dois lados do
contrato, não o usuário final do Eventpier. Os itens do checklist de
fluxos/estados de erro de UI não se aplicam.

## Requisitos Funcionais

1. O contrato deve descrever o manifesto de um provider: sua
   identidade, o environment ativo (identidade, endpoint opcional, se
   é gerenciado pelo Eventpier ou externo), a versão do provider, e a
   lista de capabilities que ele expõe.
2. Cada capability descrita no manifesto deve carregar um status entre
   três estados possíveis — disponível, indisponível, degradado —
   nunca um booleano simples, com um código de motivo enumerado
   quando não estiver disponível (timeout de conexão, conexão
   recusada, falha de autenticação, ou desconhecido).
3. O contrato deve incluir uma forma genérica de paginar listagens de
   recursos (ex.: buckets, objetos), com um cursor opaco para a UI
   avançar à próxima página, reutilizável por qualquer capability
   futura sem exigir um formato de paginação próprio por capability.
4. O contrato deve incluir uma forma estruturada de reportar erros de
   operação: um código identificável, uma mensagem legível, a
   capability relacionada (quando aplicável) e se a operação é segura
   para tentar novamente.
5. O contrato como um todo deve carregar uma versão própria,
   independente da versão do provider ou da UI, seguindo versionamento
   semântico: mudanças aditivas (campos novos opcionais) incrementam
   minor/patch; mudanças que removem ou alteram campos existentes
   exigem incremento de major e um ciclo de depreciação documentado.
6. O contrato deve ser consumível de forma isolada — tanto `apps/ui`
   quanto `providers/aws` devem poder depender dele sem importar
   código interno um do outro.
7. O contrato não deve conter nenhuma lógica de negócio, chamada de
   rede ou implementação de adapter — apenas formas de dado e seu
   contrato de versionamento. Lógica pertence às specs 005+ (provider)
   e 009+ (UI).
8. O conjunto de capabilities reconhecidas pelo contrato deve incluir,
   desde já, identificadores para todas as capabilities previstas no
   escopo do Eventpier além do MVP (storage, queue, topic, secret,
   logs) — mesmo que só `storage` tenha implementação real nesta fase
   — para que adicionar uma capability futura não exija redefinir o
   tipo que enumera capabilities conhecidas.

## Critérios de Sucesso

- Uma pessoa desenvolvendo `providers/aws` (spec 005+) consegue montar
  o endpoint de manifesto preenchendo os campos do contrato existente,
  sem precisar decidir ou redefinir nenhuma forma de dado.
- Uma pessoa desenvolvendo `apps/ui` (spec 009+) consegue renderizar o
  estado de uma capability (disponível/indisponível/degradado) e
  paginar uma listagem consumindo apenas os tipos do contrato, sem
  inspecionar o código-fonte do provider.
- É possível adicionar um campo novo ao contrato (ex.: um novo código
  de motivo de falha de saúde) sem quebrar nenhum consumidor
  existente — validando que o contrato é, de fato, aditivo por padrão.
- O pacote de contrato é consumível pelos demais workspaces do
  monorepo (`apps/ui`, `providers/aws`) como dependência de workspace,
  sem duplicação de definição de tipos em mais de um lugar.

## Fora do escopo desta spec

- Endpoint HTTP real de manifesto (`GET /api/v1/manifest`) — spec 005.
- Health-check com cache em memória e TTL — spec 006.
- Implementação de qualquer adapter (ex.: `StorageAdapter` para
  MiniStack) — spec 008.
- Consumo do contrato pela UI (renderização condicional, telas) —
  specs 009-011.
- Contract testing formalizado (consumer-driven) — fora do MVP,
  conforme `docs/product.md` e `.pipeline/roadmap.md` ("Fora do MVP").

## Alinhamento com `docs/product.md`

A seção "Escopo do MVP" de `docs/product.md` já lista este contrato
mínimo (`ProviderManifest`, `CapabilityDescriptor` com os três status,
`Page<T>`, `ProviderError`) como parte do MVP — sem contradição com
`docs/arquitetura.md`. Nenhum ponto desta spec toca a seção "Fora do
MVP" de `docs/product.md` ou do roadmap.

## Clarificações

Nenhuma lacuna relevante identificada: `docs/arquitetura.md` (seção
"Contrato Mínimo") e a `memory/constitution.md` (princípios 4, 5, 12 e
13) já fixam a forma e as regras de versionamento do contrato de
forma não-ambígua e testável. Esta spec traduz essas decisões já
tomadas em requisitos verificáveis, sem introduzir decisão nova.
