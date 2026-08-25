# Spec 014 — Atualizar actions/checkout e actions/setup-node (deprecação Node 20)

## Problema

Toda execução de `.github/workflows/ci.yml` e
`.github/workflows/publish-provider-aws.yml` gera a seguinte anotação
de aviso do GitHub Actions:

> Node.js 20 is deprecated. The following actions target Node.js 20
> but are being forced to run on Node.js 24: actions/checkout@v4,
> actions/setup-node@v4.

Isso não tem relação com o `node-version: "24"` que `ci.yml` já passa
para `actions/setup-node` (esse input controla o runtime usado para
buildar/testar o código do projeto). O aviso é sobre o runtime interno
que as próprias actions `actions/checkout@v4` e `actions/setup-node@v4`
usam para executar seu JavaScript (`runs.using: "node20"` no
`action.yml` de cada uma) — runtime que o GitHub está descontinuando
nos runners hospedados.

## Causa Raiz

`ci.yml` e `publish-provider-aws.yml` fixam `actions/checkout` e (só
`ci.yml`) `actions/setup-node` por tag de major version `@v4`. Essas
versões declaram `runs.using: node20`. O GitHub confirmou o seguinte
cronograma de depreciação (ver fontes abaixo):

- Node.js 24 passa a ser o runtime **padrão** para actions JavaScript
  em 16/06/2026 (já ocorrido na data desta spec).
- Runners hospedados continuam **forçando** (shim de compatibilidade)
  actions ainda presas a `node20` a rodar sob Node 24 — é esse shim
  que hoje gera o aviso em vez de uma falha.
- Node.js 20 é **removido por completo** dos runners hospedados no
  outono (boreal) de 2026 — quando isso acontecer, o shim deixa de
  existir e qualquer action ainda fixada numa versão `node20` passa a
  **falhar**, não apenas avisar.

`actions/checkout@v5` e `actions/setup-node@v5` já foram publicados
pelos mantenedores e declaram `runs.using: node24` nativamente — a
remediação é fazer bump de major version nas duas actions, nos dois
workflows.

Fontes consultadas nesta investigação:
- https://github.com/actions/setup-node/releases
- https://github.com/actions/checkout/pull/2226
- https://github.com/orgs/community/discussions/189324
- https://tenki.cloud/blog/migrate-github-actions-node-24

## Comportamento Atual vs. Esperado

| | Atual | Esperado |
|---|---|---|
| `actions/checkout` | `@v4` (tag mutável), runtime `node20`, aviso de depreciação em toda run | Versão com runtime `node24`, fixada por SHA de commit completo (40 chars) com comentário `# vX.Y.Z` |
| `actions/setup-node` | `@v4` (tag mutável), runtime `node20`, aviso de depreciação em toda run | Versão com runtime `node24`, fixada por SHA de commit completo, mesmo padrão acima |
| Validação estrutural (`scripts/validate-ci-workflow-shape.mjs`) | Só exige pin por SHA para `docker/login-action` e `docker/build-push-action` (achado da PR #6); não enxerga `actions/checkout`/`actions/setup-node` | Exige pin por SHA também para `actions/checkout` e `actions/setup-node`, nos dois workflows onde aparecem — fecha a lacuna que deixou essa depreciação passar despercebida |
| Resultado da run | Aviso "Node.js 20 is deprecated" nas Annotations de toda execução de `ci.yml` e `publish-provider-aws.yml` | Nenhum aviso de depreciação; workflows seguem funcionando após a remoção completa do runtime `node20` dos runners, prevista para o outono de 2026 |

## Critérios de Aceite

1. `actions/checkout` e `actions/setup-node` (onde cada um aparece) são
   atualizados para uma versão major cujo `action.yml` declare
   `runs.using: node24` (ou runtime mais novo ainda não depreciado) —
   nenhuma referência a `node20` restando em nenhum dos dois workflows.
2. As duas actions passam a ser fixadas por SHA de commit completo (40
   caracteres hexadecimais), com comentário `# vX.Y.Z` ao lado — mesmo
   padrão já aplicado a `docker/login-action` e
   `docker/build-push-action` em `publish-provider-aws.yml`.
3. `scripts/validate-ci-workflow-shape.mjs` passa a chamar
   `checkPinnedBySha` também para `actions/checkout` (em `ci.yml` e em
   `publish-provider-aws.yml`) e para `actions/setup-node` (em
   `ci.yml`) — uma regressão futura (alguém trocando o pin por uma tag
   mutável de novo) deve falhar o gate "Testes de integração", não só
   ser pega em code review.
4. Uma execução real de `ci.yml` (PR de teste) e, se possível de
   verificar sem disparar publicação indevida, de
   `publish-provider-aws.yml`, não apresenta a anotação "Node.js 20 is
   deprecated" nas Annotations da run.
5. Nenhum outro comportamento dos dois workflows muda — mesmos
   triggers, mesmos steps, mesmas permissions, mesmas tags de imagem
   publicada (ver "Fora do escopo" abaixo).

## Impacto

**Módulos/arquivos afetados:**
- `.github/workflows/ci.yml` — bump de `actions/checkout@v4` e
  `actions/setup-node@v4`.
- `.github/workflows/publish-provider-aws.yml` — bump de
  `actions/checkout@v4`.
- `scripts/validate-ci-workflow-shape.mjs` — extensão das chamadas a
  `checkPinnedBySha` para cobrir as duas actions em todos os workflows
  onde aparecem.
- `docs/features/ci.md` — sua seção "Specs Relacionadas" deve ganhar
  esta entrada (`/docs-sync`, já automático no `/review-pr`).

**Contratos/APIs**: nenhum. Não toca `packages/contracts`,
`providers/aws` nem `apps/ui` — é infraestrutura de CI pura.

**Conformidade com `ARQUIVO_REGRAS` (`memory/constitution.md`) e
`ARQUIVO_ARQUITETURA` (`docs/arquitetura.md`)**: nenhum conflito
identificado. A extensão do pin por SHA para actions first-party do
GitHub é uma decisão desta spec (ver seção Clarificações) que
**estende** — sem contradizer — o precedente já registrado em
`validate-ci-workflow-shape.mjs` (achado da PR #6), aumentando a
cobertura de hardening de supply-chain do pipeline de CI.

## Fora do escopo desta spec

- Qualquer mudança nos triggers, filtros de path, permissions, steps
  de build/test ou tags de imagem publicada dos dois workflows — só a
  versão/pin das duas actions e a validação estrutural correspondente
  mudam.
- Cache de dependências pnpm em `ci.yml` e build multi-arch em
  `publish-provider-aws.yml` — já registrados como adiados em
  `docs/features/ci.md` ("Limitações conhecidas"), continuam fora.
- Configurar Dependabot (ou similar) para manter actions atualizadas
  automaticamente — reduziria a chance de recorrência deste tipo de
  débito, mas é uma decisão de processo maior que o `/plan` desta spec
  pode registrar como sugestão de trabalho futuro, não como requisito
  aqui.
- Qualquer outra action de terceiro além das duas citadas — nenhuma
  outra apareceu na anotação original nem foi identificada com
  `runs.using: node20` durante esta investigação.

## Clarificações

Uma pergunta foi feita ao usuário (dentro do limite de
`MAX_PERGUNTAS_CLARIFICACAO: 5`): como fixar a referência de versão de
`actions/checkout`/`actions/setup-node` ao atualizá-las. Resposta:
fixar por SHA de commit completo, igual ao padrão já usado para
`docker/login-action`/`docker/build-push-action`, estendendo também
`validate-ci-workflow-shape.mjs` para checar isso — refletido nos
Critérios de Aceite 2 e 3 acima.

Nenhuma outra lacuna exigiu pergunta: a versão exata (SHA completo) a
fixar fica para o `/plan`/`/implement` resolverem no momento da
implementação (consultando a release mais recente disponível
naquele momento), já que fixar aqui um SHA específico envelheceria o
artefato desnecessariamente.
