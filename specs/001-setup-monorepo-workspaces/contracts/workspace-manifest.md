# Contrato — Manifesto de Workspace (001)

Esta spec não expõe API HTTP. O "contrato" aqui é a forma que todo
`package.json` de workspace deve seguir, para que `pnpm` reconheça o
pacote e para que specs/tasks futuras (002+) possam assumir essa forma
como dada.

## Root `package.json`

```json
{
  "name": "eventpier-monorepo",
  "private": true,
  "version": "0.0.0",
  "devDependencies": {
    "typescript": "<versão a fixar em /tasks ou /implement>"
  }
}
```

- `private: true` obrigatório — a raiz nunca é publicada.
- Sem campo `workspaces` (isso é sintaxe do npm) — a lista de
  workspaces vive em `pnpm-workspace.yaml` (ver abaixo).

## `pnpm-workspace.yaml` (raiz)

```yaml
packages:
  - "apps/*"
  - "providers/*"
  - "packages/*"
```

## `package.json` de cada workspace (`apps/ui`, `providers/aws`, `packages/contracts`)

```json
{
  "name": "@eventpier/<slug>",
  "version": "0.1.0",
  "private": true,
  "scripts": {}
}
```

Campos obrigatórios:
- `name`: exatamente `@eventpier/<slug>` (ver `data-model.md` para os
  três valores concretos desta spec).
- `version`: `0.1.0` — semver válido, nunca `0.0.0` para um workspace
  já criado (constitution, princípio 13).
- `private`: `true` para os três workspaces desta spec (mesmo
  `packages/contracts` — só deixa de ser `private` no Estado 2, ver
  `research.md` Decisão 3 e `arquitetura.md` seção 2).
- `scripts`: objeto presente, mesmo que vazio — specs futuras
  adicionam `build`/`test`/`lint` conforme `ARQUIVO_QUALITY_GATES` for
  preenchido.

## `tsconfig.json` de cada workspace

```json
{
  "extends": "<caminho relativo até tsconfig.base.json na raiz>",
  "compilerOptions": {
    "outDir": "dist"
  },
  "include": ["src"]
}
```

## Validação esperada (para `/tasks` gerar tasks testáveis)

- `pnpm install` na raiz termina sem erro e sem warning de workspace
  não resolvido.
- `pnpm -r exec tsc --noEmit` (rodando em cada workspace) passa sem
  erro — mesmo com `src/index.ts` vazio, confirma que `tsconfig.json`
  e `tsconfig.base.json` estão corretos.
- `pnpm ls -r --depth -1` lista exatamente os três pacotes de
  `data-model.md`, nenhum a mais nem a menos.
