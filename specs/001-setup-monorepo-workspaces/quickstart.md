# Quickstart — Validação manual (001)

Passos para uma pessoa desenvolvedora confirmar, na própria máquina,
que o skeleton do monorepo está correto. Não substitui quality gates
automatizados (ainda `<preencher>` em `.pipeline/quality-gates.md` —
serão preenchidos quando houver o que testar de fato, a partir da
spec 002 em diante).

## 1. Clonar e instalar

```bash
git clone <repo>
cd eventpier-monorepo
pnpm install
```

**Esperado**: instala sem erro, sem warning de "workspace not found".

## 2. Listar workspaces

```bash
pnpm ls -r --depth -1
```

**Esperado**: exatamente três pacotes listados —
`@eventpier/ui`, `@eventpier/provider-aws`, `@eventpier/contracts` —
nenhum a mais.

## 3. Confirmar isolamento por workspace

```bash
pnpm --filter @eventpier/contracts install
```

**Esperado**: só afeta o workspace `packages/contracts`, sem reinstalar
os demais.

## 4. Confirmar que cada workspace compila (vazio)

```bash
pnpm -r exec tsc --noEmit
```

**Esperado**: sem erros — cada `tsconfig.json` resolve corretamente o
`tsconfig.base.json` da raiz.

## 5. Confirmar ausência de lógica de negócio

```bash
find apps providers packages -name "*.ts" -not -name "index.ts"
```

**Esperado**: nenhum resultado — só os `src/index.ts` placeholder
criados por esta spec devem existir; qualquer outro arquivo `.ts`
indicaria escopo vazado de uma spec futura (002+).

## 6. Confirmar direção de dependência

```bash
cat apps/ui/package.json providers/aws/package.json | grep -A3 dependencies
```

**Esperado**: se houver `dependencies`, a única entrada possível é
`@eventpier/contracts`. `packages/contracts/package.json` não deve ter
nenhuma dependência de `@eventpier/ui` ou `@eventpier/provider-aws`.
