# Spec 008 — Capability Storage (Listar Buckets e Objetos)

## Cenários de Uso

1. Como desenvolvedor(a) da UI (spec 011, ainda não implementada),
   preciso listar os buckets existentes no environment configurado
   (MiniStack), para exibir a lista inicial de recursos de Storage sem
   precisar consultar o MiniStack por fora do Eventpier.
2. Como desenvolvedor(a) da UI, preciso abrir um bucket específico e
   listar seu conteúdo navegando por prefixos ("pastas"), distinguindo
   pastas de objetos reais em cada nível, para inspecionar a estrutura
   de um bucket do mesmo jeito que um explorador de storage
   convencional apresenta.
3. Como desenvolvedor(a) da UI, preciso que listagens grandes de
   objetos sejam paginadas usando o formato de paginação já definido
   no contrato (`Page<T>`, spec 002), para não sobrecarregar a UI nem
   o provider com uma resposta única contendo todo o conteúdo de um
   bucket.
4. Como desenvolvedor(a) consumindo o manifesto
   (`GET /api/v1/manifest`, specs 005/006), preciso que a capability
   `storage` passe a aparecer na lista `capabilities` com status real
   (`available`/`unavailable`) calculado a partir do mecanismo de
   cache de health-check já existente, para saber se a exploração de
   Storage está disponível antes de tentar usá-la.
5. Como desenvolvedor(a) rodando localmente, preciso que uma falha de
   conexão com o MiniStack durante uma listagem de buckets ou objetos
   resulte em um erro estruturado e compreensível, e invalide
   ativamente o cache de health-check da capability `storage` — para
   que a leitura seguinte do manifesto não continue reportando
   `available` de forma desatualizada.
6. Como desenvolvedor(a) investigando um bucket que não existe (ou já
   foi removido por fora do Eventpier), preciso receber um erro
   estruturado e específico, não uma lista vazia ambígua que pareça
   "bucket existe mas está vazio".

Esta feature não expõe UI própria — o "usuário" direto é a UI do
Eventpier (consumidora HTTP, spec 011) e quem desenvolve/mantém o
provider. Os itens do checklist de fluxos visuais de UI não se
aplicam; os equivalentes aqui são "resposta esperada" e "resposta de
erro" da API.

## Requisitos Funcionais

1. O provider AWS deve expor uma forma de listar os buckets existentes
   no environment configurado (spec 007 — `EnvironmentConfig`),
   retornando ao menos o identificador (nome) de cada bucket.
2. O provider deve expor uma forma de listar o conteúdo de um bucket
   específico, aceitando um prefixo opcional para navegação por
   "pastas". Cada página de resultado deve distinguir explicitamente
   as subpastas (prefixos comuns) dos objetos reais existentes naquele
   nível — nunca uma lista plana e indiferenciada de chaves completas.
3. Para cada objeto listado, o retorno deve incluir ao menos: chave
   (key) relativa ao nível navegado, tamanho em bytes e data da última
   modificação — os campos mínimos para uma inspeção útil de conteúdo.
4. Tanto a listagem de buckets quanto a de objetos devem suportar
   paginação usando o formato `Page<T>` já definido no contrato
   (spec 002), incluindo cursor opaco para buscar a página seguinte
   quando o resultado não couber em uma única página.
5. A capability `storage` deve passar a integrar a lista
   `capabilities` do manifesto (`GET /api/v1/manifest`, spec 005), com
   `status` calculado através do mecanismo de cache de health-check já
   existente (spec 006) — este endpoint deixa de retornar
   `capabilities: []` para provider AWS a partir desta spec.
6. O `status` da capability `storage` no manifesto deve refletir
   `available` quando a conexão com o environment configurado
   funciona, e `unavailable` com um `HealthFailureCode` apropriado
   quando não — respeitando o TTL e a política de cache já definidos
   pela spec 006. Esta spec não introduz nenhuma condição nova de
   `degraded` para `storage` — o mecanismo de cache herdado da spec
   006 só produz `available`/`unavailable`.
7. Uma falha real de conexão durante uma chamada de listagem de
   buckets ou de objetos deve invalidar ativamente o cache de
   health-check da capability `storage` (mecanismo da spec 006) e
   retornar um `ProviderError` estruturado ao chamador — nunca lançar
   uma exceção não tratada.
8. Uma tentativa de listar objetos de um bucket inexistente deve
   retornar um `ProviderError` estruturado com código identificável
   (ex.: recurso não encontrado), distinto de uma listagem vazia de um
   bucket existente sem conteúdo naquele prefixo.
9. Esta capability é somente leitura — não deve incluir nenhuma
   operação de criação, upload, exclusão ou modificação de buckets ou
   objetos. Isso está fora do escopo do MVP definido em
   `docs/product.md` ("listar buckets, abrir bucket, listar objetos,
   navegar por prefixos/pastas").
10. Nenhuma autenticação é exigida entre a UI e o provider, nem entre
    o provider e o MiniStack, para operações desta capability
    (princípio 10 da constitution, mesma postura das specs 005-007).

## Critérios de Sucesso

- Com o MiniStack configurado e acessível, uma chamada ao provider
  retorna a lista de buckets existentes no formato `Page<T>`, com pelo
  menos o nome de cada bucket.
- Com um bucket existente, uma chamada de listagem retorna seu
  conteúdo no nível raiz (sem prefixo) distinguindo pastas de objetos,
  e uma chamada subsequente informando um prefixo de pasta retorna o
  conteúdo daquele nível, também distinguindo pastas de objetos.
- Cada objeto retornado numa listagem inclui chave, tamanho e data de
  última modificação.
- Uma listagem cujo resultado exceda uma única página retorna um
  `nextCursor` válido, e uma nova chamada usando esse cursor retorna a
  página seguinte sem repetir nem pular itens.
- `GET /api/v1/manifest` passa a incluir a capability `storage` em
  `capabilities`, com `status: "available"` quando o MiniStack está
  acessível.
- Derrubando o MiniStack (ou apontando para um endpoint inválido),
  `GET /api/v1/manifest` passa a refletir `status: "unavailable"` para
  `storage` com um `HealthFailureCode` válido, dentro do TTL de cache
  já definido pela spec 006, e uma chamada de listagem de buckets
  nesse cenário retorna `ProviderError` (nunca lança exceção não
  tratada nem trava o processo).
- Uma chamada de listagem de objetos para um nome de bucket inexistente
  retorna `ProviderError` com código identificável de recurso não
  encontrado, nunca uma lista vazia.
- Nenhuma regressão no restante do manifesto: `contractVersion`,
  `provider`, `version` e `environment` continuam exatamente como
  especificado nas specs 002/005/006/007.

## Fora do escopo desta spec

- Qualquer operação de escrita sobre buckets/objetos (criar, subir,
  excluir, renomear) — o MVP é somente leitura (`docs/product.md`).
- Qualquer capability além de `storage` (`queue`, `topic`, `secret`,
  `logs`) — union fechado em `docs/arquitetura.md`, fora do MVP.
- Consumo desta capability pela UI (tela de exploração de Storage é
  spec 011; skeleton de consumo do manifesto é spec 009; renderização
  condicional por status é spec 010) — esta spec cobre somente o lado
  do provider.
- Suporte a environment diferente de MiniStack (LocalStack é
  explicitamente fora do MVP em `docs/product.md`).
- Autenticação entre UI e provider, ou entre provider e o MiniStack —
  fora de escopo enquanto o ambiente for local (princípio 10 da
  constitution).
- Qualquer condição de `degraded` para a capability `storage` — o
  mecanismo de cache de health-check (spec 006) não produz esse status
  hoje; introduzi-lo exigiria reabrir a spec 006, não é escopo desta
  spec.
- Metadados adicionais de bucket ou objeto além dos definidos no
  Requisito Funcional 3 (ex.: tags, ACL, versionamento, classe de
  armazenamento) — podem ser adicionados em specs futuras de forma
  aditiva ao contrato (princípio 4 da constitution), sem necessidade
  antecipada agora.

## Alinhamento com `docs/product.md` e `docs/arquitetura.md`

`docs/product.md` já lista, no escopo do MVP, a capability única
"Storage — listar buckets, abrir bucket, listar objetos, navegar por
prefixos/pastas" — esta spec implementa exatamente esse item, a
primeira capability real do provider AWS. `docs/arquitetura.md` (seção
6) já define a interface `StorageAdapter` (`listBuckets`,
`listObjects`) e o princípio de acesso via AWS SDK apontando o
`endpoint` do `EnvironmentConfig` (spec 007) — esta spec não altera
essas decisões já registradas, apenas as torna observáveis via
comportamento do provider. A spec 006 (cache de health-check)
explicitamente adiou a integração real ao endpoint de manifesto para
"a primeira capability real (spec 008)" — esta spec fecha essa lacuna,
conforme Requisito Funcional 5 e "Fora do escopo" de
`specs/006-cachear-health-check/spec.md`. Os princípios 5 (status
enumerado, não booleano), 6 (cache por capability com invalidação
ativa) e 12 (abstração só após necessidade comprovada — nenhum
contrato cross-provider de Storage é criado aqui) da
`memory/constitution.md` são o fundamento direto dos Requisitos
Funcionais 5-7. Nenhuma seção "Fora do MVP" de `docs/product.md` é
tocada por esta spec.

## Clarificações

- **Distinção entre pastas e objetos na navegação por prefixo**:
  confirmado explicitamente com o usuário durante esta sessão de
  `/specify` que a listagem de objetos deve distinguir pastas
  (prefixos comuns) de objetos reais em cada nível, seguindo a
  convenção padrão do S3 baseada em delimiter — em vez de retornar uma
  lista plana de chaves completas e empurrar a inferência de estrutura
  de pastas para a UI. Motivo: alinhado ao comportamento nativo do S3
  (e de qualquer explorador de storage do mercado), e evita que a
  spec 011 (tela de exploração) precise reconstruir client-side uma
  lógica que o próprio SDK já resolve. Reflete-se no Requisito
  Funcional 2 e no segundo Critério de Sucesso.
