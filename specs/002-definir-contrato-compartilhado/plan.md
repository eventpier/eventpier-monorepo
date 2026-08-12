# Plan — Contrato Compartilhado (002)

## Contexto técnico

Primeira spec a colocar conteúdo real dentro de
`packages/contracts` (criado vazio pela spec 001): os quatro tipos
mínimos do contrato (`ProviderManifest`, `Page<T>`, `ProviderError`,
`CapabilityDescriptor`) descritos em `docs/arquitetura.md` §3, com
disciplina de versionamento semântico desde este primeiro conteúdo
real (constitution, princípio 13). Sem lógica de negócio, sem
endpoint HTTP, sem consumo pela UI ou pelo provider — isso é escopo
das specs 005+ e 009+ (ver "Fora do escopo" em `spec.md`).

Detalhes técnicos em `research.md`; entidades e invariantes em
`data-model.md`; forma exata do código e do `package.json` em
`contracts/contract-shape.md`; passos de validação manual em
`quickstart.md`.

## Conformidade com `ARQUIVO_REGRAS` / `ARQUIVO_ARQUITETURA`

| Princípio/seção | Como este plano respeita |
|---|---|
| Constitution §4 (contrato evolui de forma aditiva) | `CONTRACT_VERSION = "1.0.0"` como ponto de partida (research.md, Decisão 6); `data-model.md` documenta que todo campo novo futuro deve ser opcional, nunca alterar/remover campo existente sem major + depreciação. |
| Constitution §5 (capability tem status, não booleano) | `CapabilityStatus` é união de três valores (`available`/`unavailable`/`degraded`), nunca `boolean` — ver `contracts/contract-shape.md`. |
| Constitution §12 (abstração só após necessidade comprovada) | Guiou a rejeição de validação em runtime com `zod` (research.md, Decisão 1) e do union discriminado em `CapabilityDescriptor` (Decisão 4) — nenhuma complexidade nova sem um segundo caso real (endpoint HTTP, spec 005) que a exija. |
| Constitution §13 (contrato é artefato próprio, versionado desde o primeiro commit) | Conteúdo vive inteiramente em `packages/contracts`, nunca dentro de `apps/ui` ou `providers/aws`; `package.json` sobe para `0.2.0` já refletindo a primeira superfície pública real (research.md, Decisão 5). |
| Arquitetura §2 (Estado 1, árvore de arquivos) | Layout `manifest.ts`/`pagination.ts`/`errors.ts`/`index.ts` replicado exatamente (research.md, Decisão 2). |
| Arquitetura §3 (Contrato Mínimo) | Forma dos tipos seguida literalmente — ver `contracts/contract-shape.md`. Nenhum campo adicionado, removido ou renomeado em relação ao que está documentado ali. |
| Arquitetura §6 (provider acessa via SDK, sem bundler) | Motivou a Decisão 3 de `research.md` (extensão `.js` em imports internos) — antecipa que `providers/aws` vai consumir `dist/` diretamente pelo runtime ESM do Node, sem bundler. |

Nenhum conflito entre spec/plano e `ARQUIVO_REGRAS`/`ARQUIVO_ARQUITETURA`
foi identificado. Um ponto de tensão foi identificado e resolvido
conscientemente, não contornado: a interface `CapabilityDescriptor`
documentada em `arquitetura.md` §3 permite, estruturalmente, um estado
inconsistente (`status: "available"` com `reason` preenchido) — a
Decisão 4 de `research.md` opta por manter a interface exatamente como
documentada (evitando divergência silenciosa de um contrato que outras
specs já assumem como dado) e registrar a invariante como convenção em
`data-model.md`, não como restrição de tipo.

## Segurança e observabilidade

- **Sem superfície de ataque nova**: nenhum endpoint HTTP, nenhuma
  porta, nenhuma variável de ambiente sensível nesta spec — apenas
  tipos TypeScript e constantes compiladas para uma biblioteca interna
  do monorepo. Os pontos de atenção de segurança da constitution (§10
  sem autenticação local, §11 rede interna restrita) continuam não
  aplicáveis até a spec 003 (Docker Compose) / 005 (endpoint real).
- **Superfície de dados**: `ProviderError.message` é declarado como
  string livre em `contracts/contract-shape.md` — o plano desta spec
  não inclui nenhuma regra de sanitização (não há chamada real
  produzindo mensagens ainda). Sinalizar para a spec 005/006: mensagens
  de erro do provider não devem incluir credenciais, endpoints internos
  sensíveis ou stack traces brutos — a implementar quando `ProviderError`
  passar a ser produzido de verdade, não nesta spec.
- **Logging/segredos**: não aplicável — nenhum código executa em
  runtime de produção nesta spec, só constantes e tipos.
- **Observabilidade**: não aplicável ainda — health-check real só
  existe a partir da spec 006. Esta spec só define a *forma* de dado
  que o health-check vai popular (`CapabilityDescriptor`,
  `HealthFailureCode`).

## Artefatos desta fase

- [research.md](./research.md) — decisões técnicas e alternativas rejeitadas
- [data-model.md](./data-model.md) — entidades, invariantes e relacionamentos do contrato
- [contracts/contract-shape.md](./contracts/contract-shape.md) — código TypeScript exato e forma de `package.json`
- [quickstart.md](./quickstart.md) — validação manual passo a passo

## Observação para `/tasks`

Ordem sugerida: (1) `manifest.ts`, `pagination.ts`, `errors.ts` e
`index.ts` conforme `contracts/contract-shape.md`; (2)
`contract-shape.check.ts`; (3) atualizar `package.json` (versão,
`main`/`types`/`exports`, script `build`); (4) rodar o build e
confirmar `dist/` gerado; (5) criar
`scripts/validate-contract-constants.mjs`; (6) atualizar
`.pipeline/quality-gates.md` — nova linha **Build**
(`pnpm --filter @eventpier/contracts build`) antes da linha
**Testes**, e encadear `validate-contract-constants.mjs` na linha
**Testes** existente; (7) validar com `quickstart.md`.

Nenhuma task desta spec deve tocar `apps/ui/package.json`,
`providers/aws/package.json`, Docker Compose (spec 003), CI (spec 004)
ou qualquer endpoint HTTP real (spec 005+).
