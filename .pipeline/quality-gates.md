# Quality Gates

Comandos que devem ser executados e passar (sem erros) antes de uma
implementação ser considerada concluída pelo `/implement`. Preencha os
comandos reais do seu projeto — o pipeline nunca assume nomes
específicos de scripts ou ferramentas.

| Gate | Comando | Critério de sucesso |
|---|---|---|
| Typecheck | `pnpm -r exec tsc --noEmit` | Zero erros em todos os workspaces |
| Testes | `node scripts/validate-workspace-manifests.mjs && node scripts/validate-workspace-dependencies.mjs` | Ambos os scripts terminam com exit code 0 |

Lint e Build ainda não se aplicam — nenhum linter (ESLint/Ruff/etc.)
nem build step real existe até este ponto do roadmap (spec 001 só cria
o skeleton de workspaces). Readicionar as linhas quando a spec que
introduzir cada ferramenta for implementada (Lint: quando ESLint for
configurado, provavelmente junto de `apps/ui`; Build: quando houver
algo real para compilar, ex. `pnpm build` do Next.js).

A linha "Testes" hoje aponta para os scripts de validação estrutural
criados pela spec 001 (`specs/001-setup-monorepo-workspaces/tasks.md`,
T004/T005) — não é um test runner real (jest/vitest/pytest). Trocar
por um runner de verdade quando a primeira spec com lógica de negócio
(002+) precisar de testes unitários.
