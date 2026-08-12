# Contrato Compartilhado — `packages/contracts`

## O que o módulo faz

`packages/contracts` (`@eventpier/contracts`) define o contrato mínimo
que atravessa a fronteira UI ↔ Provider: `ProviderManifest`, `Page<T>`,
`ProviderError`, `CapabilityDescriptor`, com versionamento semântico
próprio (`contractVersion`/`CONTRACT_VERSION`) desde o primeiro
conteúdo real. Nenhuma lógica de negócio, chamada de rede ou adapter —
só tipos e constantes.

## Comportamentos-chave e regras de negócio

- Union types (`Capability`, `CapabilityStatus`, `HealthFailureCode`)
  são sempre derivados de um array `as const` exportado em runtime
  (`CAPABILITIES`, `CAPABILITY_STATUSES`, `HEALTH_FAILURE_CODES`) —
  nunca declarados em paralelo ao array correspondente. Isso permite
  que provider/UI iterem/validem contra a lista conhecida em runtime,
  não só em tempo de compilação.
- `CapabilityDescriptor.status` é sempre um dos três valores
  (`available`/`unavailable`/`degraded`), nunca booleano. `reason`
  (`HealthFailureCode`) é esperado por convenção quando `unavailable`,
  opcional quando `degraded`, e deve estar ausente quando `available`
  — invariante documentada mas **não imposta pelo tipo** (decisão
  consciente para não divergir da interface de `docs/arquitetura.md`
  §3; ver "Limitações conhecidas" abaixo).
- `Page<T>.nextCursor` ausente significa "fim da paginação" — nenhum
  outro valor (string vazia, `null`) deve carregar esse significado.
- `ProviderError.retryable` é sempre obrigatório — quem consome nunca
  precisa inferir "tentar de novo?" por heurística de `code`/`message`.
- Pacote consumível via `main`/`types`/`exports` apontando para
  `dist/` (`pnpm --filter @eventpier/contracts build`); nenhum
  consumidor deve importar de `src/` diretamente.

## Contrato de API

TypeScript puro, sem endpoint HTTP ainda (isso é escopo da spec 005).
Barrel público (`packages/contracts/src/index.ts`) reexporta:

- `manifest.ts`: `CONTRACT_VERSION`, `CAPABILITIES`/`Capability`,
  `CAPABILITY_STATUSES`/`CapabilityStatus`,
  `HEALTH_FAILURE_CODES`/`HealthFailureCode`, `Provider`,
  `Environment`, `CapabilityDescriptor`, `ProviderManifest`.
- `pagination.ts`: `Page<T>`.
- `errors.ts`: `ProviderError`.

Forma exata em
`specs/002-definir-contrato-compartilhado/contracts/contract-shape.md`
e `docs/arquitetura.md` §3 (fonte normativa).

## Limitações conhecidas

- Invariante de `CapabilityDescriptor.reason` não é imposta pelo type
  system — um union discriminado por `status` foi considerado e
  rejeitado para não divergir da interface documentada em
  `docs/arquitetura.md` §3. Reavaliar se a spec 006 (health-check)
  revelar bugs reais de omissão de `reason`.
- Sem validação de runtime (zod ou equivalente) — adequado enquanto o
  contrato só é consumido internamente entre workspaces TypeScript do
  mesmo monorepo. Reavaliar quando a spec 005 expuser o manifesto via
  endpoint HTTP a um boundary não confiável.

## Specs Relacionadas

| # | Spec | Tipo | Resumo | Data |
|---|------|------|--------|------|
| 002 | [002-definir-contrato-compartilhado](../../specs/002-definir-contrato-compartilhado/) | ✨ Feature | Cria `ProviderManifest`, `Page<T>`, `ProviderError`, `CapabilityDescriptor` com versionamento semântico | 2026-08-12 |
