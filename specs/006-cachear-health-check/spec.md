# Spec 006 — Cache de Health-check por Capability

## Cenários de Uso

1. Como mantenedor(a) do provider implementando uma nova capability
   real (ex.: Storage, spec 008), preciso de um mecanismo de cache de
   health-check já pronto para reutilizar, sem precisar reescrever
   lógica de TTL, cache e invalidação a cada capability nova que o
   provider ganhar.
2. Como desenvolvedor(a) da UI consumindo o manifesto no futuro (spec
   009), preciso que o status de uma capability (`available`/
   `unavailable`/`degraded`) reflita o estado real do ambiente sem que
   cada requisição HTTP ao manifesto dispare uma nova checagem cara
   (ex.: chamada de rede ao MiniStack) — evitando latência
   desnecessária e carga repetida sobre o ambiente emulado.
3. Como mantenedor(a) do provider, preciso que uma falha real durante
   o uso de uma capability (não apenas o health-check periódico)
   invalide imediatamente o cache daquela capability específica, para
   que a leitura seguinte do manifesto não continue reportando
   `available` de forma desatualizada.
4. Como mantenedor(a) evoluindo o provider com múltiplas capabilities
   (spec 008 em diante), preciso que o cache seja isolado por
   capability — uma falha ou expiração de TTL em uma capability nunca
   deve afetar o cache de outra.
5. Como desenvolvedor(a) rodando o provider localmente, preciso poder
   ajustar o TTL do cache via variável de ambiente
   (`HEALTH_CHECK_TTL_MS`) sem alterar código, para depurar
   comportamento de cache durante o desenvolvimento.

Esta feature não expõe UI própria nem endpoint HTTP novo — é um
mecanismo interno do provider, consumido por código de capability
(ainda inexistente nesta spec) e futuramente pelo endpoint de
manifesto (spec 005) quando a primeira capability real existir (spec
008). Os itens de checklist de fluxos visuais de UI não se aplicam; o
equivalente aqui é "comportamento observável via teste automatizado do
módulo".

## Requisitos Funcionais

1. O provider deve expor um mecanismo de cache de health-check em
   memória, isolado por capability — nunca um cache global
   compartilhado entre capabilities (princípio 6 da constitution).
2. Para cada capability, o mecanismo deve aceitar uma verificação real
   fornecida pelo código específico daquela capability e retornar um
   resultado cacheado no formato já definido em `docs/arquitetura.md`
   (`CachedHealth`: `status` `available`/`unavailable`, `reason?`
   `HealthFailureCode`, `checkedAt`).
3. O TTL do cache deve ter um valor default dentro do intervalo 3-5s
   definido no princípio 6 da constitution, e deve ser configurável via
   variável de ambiente `HEALTH_CHECK_TTL_MS`, sem exigir alteração de
   código.
4. Uma leitura do status de uma capability dentro do TTL vigente deve
   retornar o valor já cacheado, sem disparar nova verificação real.
5. Uma leitura do status de uma capability após o TTL expirar deve
   disparar uma nova verificação real e atualizar o cache com o novo
   resultado e um novo `checkedAt`.
6. O mecanismo deve expor uma forma explícita de invalidação ativa por
   capability, acionável pelo código da própria capability quando uma
   chamada real (distinta do health-check periódico) falhar — forçando
   a leitura seguinte a executar nova verificação real, independente do
   TTL restante.
7. Quando a verificação real de uma capability falhar, o cache deve
   armazenar `status: unavailable` com um `HealthFailureCode` válido
   (`CONNECTION_TIMEOUT`, `CONNECTION_REFUSED`, `AUTH_FAILED` ou
   `UNKNOWN`) — nunca propagar uma exceção não tratada para quem
   consome o cache.
8. O mecanismo não deve ter nenhum acoplamento com uma capability
   específica (Storage, Queue, etc.) — deve ser genérico o suficiente
   para ser reutilizado por qualquer capability futura sem alteração no
   próprio mecanismo de cache.
9. Esta spec não altera o comportamento observável do endpoint
   `GET /api/v1/manifest` (spec 005): `capabilities` continua
   retornando lista vazia, já que nenhuma capability real consome este
   mecanismo ainda. A integração visível via API só acontece quando a
   primeira capability real existir (spec 008).

## Critérios de Sucesso

- Existe um mecanismo de cache de health-check testável isoladamente
  (sem subir o servidor HTTP e sem depender de nenhuma capability
  real), cobrindo pelo menos: leitura dentro do TTL (cache hit),
  leitura após TTL expirado (nova verificação real), invalidação ativa
  forçando nova verificação antes do TTL expirar, e isolamento entre
  duas capabilities distintas usadas simultaneamente.
- O TTL default e sua configuração via `HEALTH_CHECK_TTL_MS` são
  verificáveis por teste automatizado (ex.: alterar a variável de
  ambiente e observar que o cache expira no tempo configurado).
- Uma falha simulada na verificação real de uma capability resulta em
  `CachedHealth` com `status: unavailable` e um `HealthFailureCode`
  válido, sem lançar exceção para quem chamou.
- `GET /api/v1/manifest` continua respondendo exatamente como
  especificado na spec 005 (`capabilities: []`) depois desta spec —
  nenhuma regressão introduzida no endpoint existente.
- O mecanismo está pronto para ser adotado pela spec 008 (Storage) sem
  exigir nenhuma mudança de comportamento ou de contrato externo
  (`CachedHealth`, `HealthFailureCode`).

## Fora do escopo desta spec

- Qualquer capability real (Storage é spec 008) — este mecanismo não é
  exercitado por nenhuma chamada real de capability nesta spec, apenas
  por verificações simuladas em teste.
- Alteração do endpoint `GET /api/v1/manifest` para popular
  `capabilities` com resultado real do cache — isso acontece junto da
  primeira capability real (spec 008), não aqui.
- `EnvironmentConfig` configurável (endpoint externo customizado,
  alternância `managed: true`/`false`) — spec 007.
- Qualquer exibição de status de capability na UI — spec 010
  (renderização condicional por capability).
- Persistência do cache entre reinicializações do processo (ex.: disco,
  Redis) — o princípio 6 da constitution exige cache em memória; nada
  nesta spec sugere necessidade de persistência entre reinícios.

## Alinhamento com `docs/product.md` e `docs/arquitetura.md`

`docs/product.md` já lista, no escopo do MVP, "Health-check com cache
em memória por capability, TTL curto (3-5s, configurável), com
invalidação ativa em falha de chamada real" — esta spec implementa
exatamente esse item. `docs/arquitetura.md` (seção 4) já define o
formato `CachedHealth` e as regras de TTL/invalidação que esta spec
segue sem alterar. Os princípios 5 e 6 da `memory/constitution.md`
(status enumerado por capability; cache isolado com invalidação ativa)
são o fundamento direto dos Requisitos Funcionais 1, 6 e 7. Nenhuma
seção "Fora do MVP" de `docs/product.md` é tocada por esta spec.

## Clarificações

- **Escopo sem capability real disponível**: confirmado explicitamente
  com o usuário durante esta sessão de `/specify` que esta spec
  constrói o mecanismo de cache como peça de infraestrutura genérica e
  isolada — testável sozinha, recebendo a verificação real como algo
  fornecido pela capability que a usar — **sem** integrá-lo ao endpoint
  de manifesto nem inventar uma capability sintética para provar o
  comportamento fim a fim. Motivo: o union de `Capability` já é fechado
  em `docs/arquitetura.md` (`storage`/`queue`/`topic`/`secret`/`logs`);
  criar uma capability fake para exercitar o mecanismo violaria esse
  contrato. A integração observável via API fica para a spec 008
  (Storage), primeira capability real. Reflete-se no Requisito
  Funcional 9, nos Critérios de Sucesso e na primeira e segunda linhas
  de "Fora do escopo".
