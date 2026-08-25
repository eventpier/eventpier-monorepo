# Review — PR #15: Capability Storage (spec 008)

```yaml
quality_gates:
  typecheck: pass
  test: pass
  lint: not_run
  build: pass
review_judgment:
  security: pass
  architecture: pass
  functionality: pass
  quality: pass
```

Evidência mecânica: 42/42 testes unitários, build/typecheck limpos,
`docker compose up` completo com MiniStack real (`storage: available`
de dentro do container) — local e reconfirmado no CI real da PR #15
(job `validate`, `success`, incluindo o novo step "Iniciar MiniStack"
e os 8 scripts de "Testes de integração"). **SonarCloud Code
Analysis** (check de CI conectado direto ao GitHub/SonarCloud, fora do
`ARQUIVO_QUALITY_GATES` deste pipeline): `success`, 0 issues não
resolvidos. Lint segue `not_run` — nenhum linter local configurado
ainda neste projeto.

## Resumo executivo

Primeira capability real do provider AWS: adapter isolado usando o AWS
SDK de verdade (nunca API proprietária do MiniStack), classificação de
erro limpa e testável sem mock do SDK, e a integração com o cache de
health-check da spec 006 finalmente tem seu primeiro consumidor real.
Todos os achados abaixo foram corrigidos e revalidados antes da
submissão deste review — nenhum ficou pendente.

## Achados e correções

| # | Origem | Severidade | Título | Status |
|---|--------|------------|--------|--------|
| 1 | Codex (bot, externo, comentário na PR) | **ALTO** | `decodeURIComponent` de um segmento de bucket malformado (`/api/v1/storage/buckets/%/objects`) derrubava o processo inteiro — `URIError` não tratado num handler `async` vira promise rejeitada não tratada, e o Node encerra o processo por padrão | ✅ Corrigido |
| 2 | Revisão própria | MÉDIO | Filtro do "objeto marcador de pasta" em `storage.adapter.ts` escondia qualquer objeto real cuja `Key` coincidisse com um `prefix` sem `/` no final | ✅ Corrigido |
| 3 | Revisão própria | MÉDIO | Erros `unknown` de storage não deixavam nenhum rastro server-side — só a mensagem genérica chegava ao chamador | ✅ Corrigido |
| 4 | Descoberto ao verificar #3 | MÉDIO | Falha de resolução DNS (`ENOTFOUND`/`EAI_AGAIN`) caía em `unknown` em vez de `connection`, deixando de invalidar o cache de health-check num cenário real e comum | ✅ Corrigido |
| 5 | Revisão própria | BAIXO | `environment.endpoint ?? ""` mascarava silenciosamente uma violação do invariante "endpoint sempre preenchido" (spec 007) | ✅ Corrigido |
| 6 | Revisão própria | BAIXO | Faltava teste de invalidação de cache para `listObjects` em falha de conexão (só `listBuckets` tinha) | ✅ Corrigido |
| 7 | SonarCloud | CRITICAL | Complexidade cognitiva do handler HTTP subiu para 21 (limite 15) após a correção do achado #1 | ✅ Corrigido |
| 8 | SonarCloud | MINOR | `spawn("node", ...)` em `validate-storage-endpoint.mjs` resolvendo o executável via `PATH` em vez de caminho absoluto | ✅ Corrigido |

Detalhes de cada correção (código exato, alternativas consideradas) em
`specs/008-implementar-storage/research.md` → "Decisões durante a
implementação".

## Recomendação de merge

- [ ] Bloquear merge
- [ ] Aprovar com ressalvas
- [x] **Aprovar**

## Fechamento da feature

Aplicado nesta mesma PR (commit "docs(implementar-storage): mark
feature as complete"):

- `.pipeline/state/implementar-storage.json`: `current_phase` → `done`.
- `.pipeline/roadmap.md`: linha da spec 008 → ✅ Concluído.
- `.pipeline/decisions-log.md`: nova entrada (versão do SDK rebaixada
  por segurança de supply-chain, fix do `Dockerfile`, achado externo
  do Codex + correções desta revisão, achados do SonarCloud).
- `docs/features/provider-aws.md`: capability Storage documentada
  (comportamentos-chave, contrato de API das duas rotas novas,
  proteção contra path malformado), limitações já resolvidas
  removidas, linha da spec 008 na tabela "Specs Relacionadas".

## Aprovação

Aprovado explicitamente pelo usuário no chat (Etapa 6 do `/review-pr`)
— GitHub bloqueia autoaprovação de PR pelo próprio autor
(`422 Review Can not approve your own pull request`), então o review
submetido ao GitHub usa `event: COMMENT` (`state: COMMENTED`); a
aprovação real é esta confirmação no chat.
