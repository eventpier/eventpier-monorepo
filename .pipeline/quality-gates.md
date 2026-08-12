# Quality Gates

Comandos que devem ser executados e passar (sem erros) antes de uma
implementação ser considerada concluída pelo `/implement`. Preencha os
comandos reais do seu projeto — o pipeline nunca assume nomes
específicos de scripts ou ferramentas.

| Gate | Comando | Critério de sucesso |
|---|---|---|
| Typecheck | `<preencher>` | Zero erros |
| Testes | `<preencher>` | Todos verdes; cobertura mínima: `<preencher>%` |
| Lint | `<preencher>` | Zero erros (warnings permitidos: `<preencher>`) |
| Build | `<preencher>` | Build sem falhas |

<!--
Exemplos de preenchimento (apagar este comentário após configurar):

Node.js / TypeScript:
| Typecheck | `tsc --noEmit` | Zero erros |
| Testes    | `pnpm test -- --coverage` | Cobertura ≥ 80% |
| Lint      | `eslint . --max-warnings=0` | Zero erros/warnings |
| Build     | `pnpm build` | Build sem falhas |

Python:
| Typecheck | `mypy .` | Zero erros |
| Testes    | `pytest --cov` | Cobertura ≥ 80% |
| Lint      | `ruff check .` | Zero erros |

Adicione ou remova linhas conforme as ferramentas reais do seu projeto.
Se um gate não se aplicar (ex.: projeto sem build step), remova a linha
em vez de deixar `<preencher>` vazio — comando ausente é interpretado
pelo /implement como "gate não existe", enquanto `<preencher>` sem
edição é interpretado como configuração pendente e gera aviso.
-->
