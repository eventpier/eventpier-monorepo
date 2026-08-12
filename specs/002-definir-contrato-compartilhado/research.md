# Research — Contrato Compartilhado (002)

## Contexto lido

- `ARQUIVO_REGRAS` (`memory/constitution.md`), princípios 1, 4, 5, 12
  e 13.
- `ARQUIVO_ARQUITETURA` (`docs/arquitetura.md`), seções 2 (Estado 1),
  3 (Contrato Mínimo) e 9.
- `spec.md` desta feature.
- `specs/001-setup-monorepo-workspaces/research.md` (Decisões 3 e 4) —
  esta spec herda o `tsconfig.base.json` já fixado lá
  (`moduleResolution: "Bundler"`, `module: "ESNext"`) e resolve o
  risco que a Decisão 4 daquela spec já havia sinalizado para quando
  `packages/contracts` ganhasse código real com imports internos.

Nenhum conflito entre spec e regras/arquitetura foi encontrado — a
seção 3 de `arquitetura.md` já fixa a forma exata do contrato; esta
spec traduz essa forma em decisões de implementação (layout de
arquivo, forma de exportar constantes em runtime, empacotamento).

## Decisão 1 — Tipos + `as const` como fonte única, sem biblioteca de validação em runtime

**Decisão**: os tipos union (`Capability`, `CapabilityStatus`,
`HealthFailureCode`) são derivados de arrays `as const` exportados em
runtime (`CAPABILITIES`, `CAPABILITY_STATUSES`,
`HEALTH_FAILURE_CODES`), não apenas declarados como `type` puro. Sem
`zod`, `io-ts` ou qualquer validador de schema em runtime nesta spec.

**Alternativas consideradas**:
- *Apenas `type` (sem array runtime)* — rejeitado. Um `type` puro
  desaparece na compilação; o provider (spec 006, health-check) precisa
  iterar/validar contra a lista de capabilities ou motivos de falha
  conhecidos em tempo de execução, não só em tempo de compilação. Sem
  o array `as const`, cada consumidor recriaria sua própria cópia da
  lista, violando "fonte única" do contrato.
- *Validação em runtime com `zod`* — rejeitado por princípio 12
  (abstração só após necessidade comprovada). Nenhum boundary não
  confiável existe ainda: o contrato é consumido internamente entre
  workspaces TypeScript do mesmo monorepo, não por uma requisição HTTP
  externa. Validação de payload untrusted é relevante a partir da
  spec 005 (endpoint HTTP real do provider) — reavaliar lá, não aqui.

**Consequência para `/tasks`**: cada union type do contrato
(`Capability`, `CapabilityStatus`, `HealthFailureCode`) deve ser
derivado via `(typeof ARRAY)[number]`, nunca declarado em paralelo ao
array correspondente.

## Decisão 2 — Layout de arquivo: exatamente o já previsto em `arquitetura.md` §2

**Decisão**: `packages/contracts/src/manifest.ts` (Provider,
Environment, CAPABILITIES/Capability, CAPABILITY_STATUSES/
CapabilityStatus, HEALTH_FAILURE_CODES/HealthFailureCode,
CapabilityDescriptor, ProviderManifest, CONTRACT_VERSION),
`pagination.ts` (`Page<T>`), `errors.ts` (`ProviderError`), e
`index.ts` como barrel público (`export * from "./manifest.js"` etc.).

**Justificativa**: `arquitetura.md` §2 já nomeia esses três arquivos
explicitamente na árvore do Estado 1 — não há decisão nova aqui, só
confirmação e detalhamento de conteúdo por arquivo (ver
`contracts/contract-shape.md`).

## Decisão 3 — Imports internos relativos usam extensão `.js`

**Decisão**: todo import relativo dentro de `packages/contracts/src`
(ex.: `index.ts` importando de `manifest.ts`) usa a extensão `.js`
explícita (`from "./manifest.js"`), mesmo apontando para um arquivo
fonte `.ts`.

**Justificativa**: resolve o risco já registrado em
`specs/001-setup-monorepo-workspaces/research.md` ("Decisões durante a
implementação") — `moduleResolution: "Bundler"` não exige extensão,
mas `providers/aws` (Node.js puro, sem bundler — ver arquitetura §6)
vai consumir `packages/contracts` compilado (`dist/`) diretamente pelo
runtime ESM do Node a partir da spec 005+, que **exige** extensão
explícita em imports relativos. Escrever a extensão `.js` desde já
(apontando para o `.ts` fonte, resolvido pelo TypeScript normalmente)
evita reescrever os imports quando `providers/aws` começar a consumir
o pacote.

**Alternativa considerada**: omitir extensão (permitido por
`moduleResolution: "Bundler"`) e resolver o problema só quando
`providers/aws` de fato importar o pacote — rejeitado porque adiar
geraria um diff maior e desnecessário mais tarde, para um custo hoje
de uma única convenção de nomenclatura de import.

## Decisão 4 — `CapabilityDescriptor` permanece uma interface plana, não um union discriminado

**Decisão**: seguir exatamente a forma de `arquitetura.md` §3 —
`{ id: Capability; status: CapabilityStatus; reason?: HealthFailureCode }`
— e não reforçar em tipo que `reason` só é preenchido quando
`status !== 'available'`.

**Alternativa considerada**: um union discriminado por `status` (ex.:
`{ status: 'unavailable'; reason: HealthFailureCode } | { status:
'available' } | ...`), que tornaria a invariante checável pelo
compilador. Rejeitada nesta spec para não divergir silenciosamente da
interface já documentada em `arquitetura.md` §3, que outras specs
(005, 006) já assumem como dada. A invariante (`reason` obrigatório
quando `unavailable`, opcional quando `degraded`, ausente quando
`available`) é registrada em `data-model.md` como regra de
convenção/revisão, não de tipo. Se a spec 006 (health-check) revelar
bugs reais de omissão de `reason`, essa decisão deve ser reaberta ali
— não antecipar agora (princípio 12).

## Decisão 5 — Empacotamento: `packages/contracts` ganha build real (`dist/`)

**Decisão**: `package.json` ganha `main`/`types`/`exports` apontando
para `dist/index.{js,d.ts}` e um script `build` (`tsc -p
tsconfig.json`). `tsconfig.json` já tinha `outDir: "dist"` desde a
spec 001 — esta spec é a primeira a de fato emitir algo nele. `dist/`
continua fora do controle de versão (já coberto por `.gitignore`,
regra `dist/` existente desde a raiz do projeto).

**Justificativa**: sem `main`/`types`/`exports`, nenhum consumidor
(spec 005 em `providers/aws`, spec 009 em `apps/ui`) consegue resolver
`@eventpier/contracts` como dependência de workspace de forma
confiável — isso bloquearia diretamente o Critério de Sucesso de
`spec.md` sobre consumibilidade. `main`/`types` apontando para `dist/`
(não para `src/`) é necessário especificamente para `providers/aws`,
que não passa por bundler (ver Decisão 3); `apps/ui` (Next.js) também
funciona contra `dist/` sem necessidade de configuração adicional
(`transpilePackages`), então não há razão para dois caminhos de
resolução diferentes.

**Consequência para `/tasks`**: nenhuma task desta spec cria ou edita
`apps/ui/package.json` nem `providers/aws/package.json` — a
dependência de workspace (`"@eventpier/contracts": "workspace:*"`) só
é adicionada quando essas specs (005, 009) de fato importarem algo do
pacote (ver "Fora do escopo" em `spec.md`).

**Versão do pacote**: `package.json` de `packages/contracts` sobe de
`0.1.0` (placeholder da spec 001, sem exports reais) para `0.2.0`
(primeira superfície pública real, mudança aditiva — não há API
anterior para quebrar). Distinto de `CONTRACT_VERSION`/
`contractVersion` (ver Decisão 6), que é o versionamento semântico do
*conteúdo* do contrato, não do pacote npm que o distribui (mesma
distinção já registrada na Decisão 3 de `specs/001.../research.md`).

## Decisão 6 — `contractVersion` inicial: `"1.0.0"`, exportado como constante `CONTRACT_VERSION`

**Decisão**: `CONTRACT_VERSION = "1.0.0"` exportado de `manifest.ts`,
usado pelo provider (spec 005+) para preencher
`ProviderManifest.contractVersion` — nunca hardcoded de forma
duplicada em `providers/aws`.

**Justificativa**: `arquitetura.md` §3 já usa `"1.0.0"` como exemplo;
constitution princípio 4 exige que o contrato evolua de forma aditiva
a partir de uma versão base — `1.0.0` é o ponto de partida correto
para um contrato que já nasce com todos os quatro tipos mínimos
(`ProviderManifest`, `Page<T>`, `ProviderError`,
`CapabilityDescriptor`) presentes, não um `0.x` "ainda instável".

## Decisão 7 — Testes: sem novo test runner; estender o padrão de scripts Node já existente

**Decisão**: dois mecanismos, nenhum deles introduz `jest`/`vitest`:

1. **Verificação de forma em tempo de compilação**: um arquivo
   `packages/contracts/src/contract-shape.check.ts`, incluído no
   `tsconfig.json` (`include: ["src"]`) mas **não** reexportado pelo
   `index.ts` público, constrói um valor de exemplo válido para cada
   tipo exportado (`ProviderManifest`, `Page<T>`, `ProviderError`).
   Já coberto pelo gate "Typecheck" existente
   (`pnpm -r exec tsc --noEmit`) — nenhuma mudança em
   `quality-gates.md` necessária para esta parte.
2. **Verificação de constantes em runtime**: novo script
   `scripts/validate-contract-constants.mjs` (mesmo padrão dos scripts
   da spec 001), que importa `packages/contracts/dist/index.js` já
   buildado e confere: `CONTRACT_VERSION` casa com semver válido,
   `CAPABILITIES`/`CAPABILITY_STATUSES`/`HEALTH_FAILURE_CODES` batem
   exatamente com os arrays esperados. Falha com mensagem clara se
   `dist/index.js` não existir, instruindo a rodar o build primeiro —
   não builda implicitamente (Build e Testes são gates separados e
   ordenados).

**Justificativa**: mantém o padrão de "script Node puro, sem
dependência nova" que a spec 001 já estabeleceu (ver seu
`quality-gates.md`, linha "Testes"), evitando introduzir um test
runner real antes de haver lógica de negócio de fato com ramificação
condicional (a nota em `quality-gates.md` já previa isso para "a
primeira spec com lógica de negócio" — esta spec é só tipos e
constantes, não lógica condicional; a primeira candidata real a
justificar um test runner é a spec 006, health-check com cache e
invalidação).

**Consequência para `/tasks`**: `quality-gates.md` ganha uma linha
nova de gate **Build** (`pnpm --filter @eventpier/contracts build`,
critério: `dist/index.js` e `dist/index.d.ts` gerados sem erro) e a
linha **Testes** existente passa a encadear também
`validate-contract-constants.mjs`, na ordem: Typecheck → Build →
Testes.

## Decisões durante a implementação

- **`packages/contracts/tsconfig.json` ganhou `rootDir: "src"`**, não
  previsto na Decisão 5 (que dizia "`tsconfig.json` não muda"). Ao
  rodar `pnpm --filter @eventpier/contracts build` (T009) pela primeira
  vez com declaração de tipos (`declaration: true`, herdado de
  `tsconfig.base.json` desde a spec 001) e múltiplos arquivos fonte
  (`manifest.ts`, `pagination.ts`, `errors.ts`, `index.ts`,
  `contract-shape.check.ts`), o TypeScript 7 falhou com
  `TS5011: The common source directory ... rootDir must be explicitly
  set`, e sem a correção o output caía em `dist/src/index.js` em vez
  de `dist/index.js` — incompatível com `main`/`types` do
  `package.json` (Decisão 5). A spec 001 nunca builda de verdade (só
  `tsc --noEmit`), por isso esse gap não apareceu antes. Corrigido
  adicionando `"rootDir": "src"` ao `compilerOptions` de
  `packages/contracts/tsconfig.json`; `pnpm -r exec tsc --noEmit`
  confirmado ainda verde em todos os workspaces após a mudança. Sinal
  para specs futuras que também builda com `declaration: true`
  (`providers/aws`, `apps/ui`): esperar o mesmo erro e aplicar a mesma
  correção (`rootDir` explícito) na primeira vez que rodarem um build
  real, não só `--noEmit`.
- **`packages/contracts/tsconfig.build.json` criado** (achado do
  `/review-pr` desta PR, não previsto originalmente): sem ele,
  `contract-shape.check.ts` — fixture interna de verificação de forma,
  nunca reexportada por `index.ts` — era compilada para
  `dist/contract-shape.check.{js,d.ts}` junto com a API pública, por
  estar em `src/` e incluída pelo `tsconfig.json` original. Não era
  alcançável externamente (`package.json.exports` restringe a `"."`),
  mas inflava o artefato de build sem necessidade. Corrigido com um
  `tsconfig.build.json` (`extends: "./tsconfig.json"`,
  `exclude: ["src/contract-shape.check.ts"]`) usado só pelo script
  `build`; o gate Typecheck (`pnpm -r exec tsc --noEmit`) continua
  usando `tsconfig.json` original, então a checagem de forma não perde
  cobertura — só para de ser emitida.
