# Roadmap — Eventpier

Lista mestre de specs planejadas, em ordem de implementação. Diferente
de `.pipeline/state/*.json` (estado detalhado por feature, usado pelos
comandos), este arquivo é a **visão agregada e legível** do projeto —
serve pra você, um colaborador, ou qualquer pessoa abrir no GitHub sem
rodar comando nenhum e entender o que existe, o que está em andamento
e o que falta.

**Como este arquivo é mantido**: os comandos do pipeline atualizam o
status automaticamente ao final de cada fase (ver `.pipeline/config.md`
→ `ARQUIVO_ROADMAP`). Você pode editar manualmente para adicionar
specs novas planejadas (ainda sem `/specify` rodado) ou reordenar
prioridade — mas não edite o status de uma spec já iniciada; deixe o
pipeline atualizar.

Nenhuma spec teve `/specify` rodado ainda — este roadmap reflete o
plano de MVP descrito em `docs/product.md` e `docs/arquitetura.md`,
quebrado em specs candidatas. A numeração e o agrupamento por fase
abaixo são um ponto de partida; ajuste ao rodar `/specify` de cada uma.

---

## Fase 1 — Fundação (monorepo e contrato)

| # | Spec | Status | Última atualização |
|---|------|--------|---------------------|
| 001 | Setup do monorepo (workspaces `apps/*`, `providers/*`, `packages/*`) | 🟡 Em andamento | 2026-08-12 |
| 002 | `packages/contracts`: `ProviderManifest`, `Page<T>`, `ProviderError`, `CapabilityDescriptor` com versionamento semântico desde o commit inicial | 🔲 Pendente | 2026-08-12 |
| 003 | Docker Compose do MVP (rede interna `eventpier-net`, `ministack` opcional via profile, apenas `eventpier-ui` exposta ao host entre os serviços do Eventpier) | 🔲 Pendente | 2026-08-12 |
| 004 | CI com gatilho por path para `providers/*` (antecipando o comportamento do monorepo permanente do Estado 3 de `arquitetura.md`) | 🔲 Pendente | 2026-08-12 |

## Fase 2 — Provider AWS (`providers/aws`)

| # | Spec | Status | Última atualização |
|---|------|--------|---------------------|
| 005 | Endpoint de manifesto (`GET /api/v1/manifest`) | 🔲 Pendente | 2026-08-12 |
| 006 | Health-check com cache em memória por capability (TTL configurável via `HEALTH_CHECK_TTL_MS`, default 3-5s, com invalidação ativa em falha de chamada real) | 🔲 Pendente | 2026-08-12 |
| 007 | `EnvironmentConfig` (`endpoint` / `managed`) apontando para MiniStack gerenciado pelo compose ou externo já em execução | 🔲 Pendente | 2026-08-12 |
| 008 | Capability Storage (listar buckets, abrir bucket, listar objetos, navegar por prefixos) via MiniStack Adapter, usando AWS SDK apontando o `endpoint` do MiniStack | 🔲 Pendente | 2026-08-12 |

## Fase 3 — UI (`apps/ui`)

| # | Spec | Status | Última atualização |
|---|------|--------|---------------------|
| 009 | Skeleton Next.js + consumo do manifesto do provider | 🔲 Pendente | 2026-08-12 |
| 010 | Renderização condicional por capability (`available`/`unavailable`/`degraded`) | 🔲 Pendente | 2026-08-12 |
| 011 | Tela de exploração de Storage (buckets → objetos → navegação por prefixos) | 🔲 Pendente | 2026-08-12 |

## Fase 4 — Validação

| # | Spec | Status | Última atualização |
|---|------|--------|---------------------|
| 012 | Validação ponta a ponta do vertical slice (`eventpier-ui` → `providers/aws` → MiniStack) via `docker compose up` — valida contrato, provider, API, UI, Docker, conexão com emulador e descoberta de capabilities | 🔲 Pendente | 2026-08-12 |

---

## Fora do MVP (adiado deliberadamente)

Escopo explicitamente fora do MVP atual, conforme `docs/product.md` —
não é esquecimento, é decisão registrada. Promover qualquer item daqui
para uma fase acima exige atualizar `docs/product.md` primeiro.

| Item | Motivo do adiamento |
|---|---|
| LocalStack como Environment adicional do provider AWS | Arquitetura já suporta (Provider ≠ Environment); implementar só quando houver necessidade concreta além do MiniStack |
| Migração do monorepo `eventpier` para `eventpier-contracts` + `eventpier-providers` + `eventpier-ui` | Gatilho: ao finalizar o provider AWS e iniciar Azure ou GCP — ver `docs/arquitetura.md`, seção "Estrutura de Repositórios" |
| `providers/shared` / `@eventpier/provider-core` (código compartilhado entre providers) | Extrair só o que se repetir de fato entre AWS e o segundo provider real (Azure/GCP) — não antecipar (princípio 12 da constitution) |
| `eventpier-azure` (provider: Azurite + Service Bus Emulator + Cosmos DB Emulator separados) | Próximo provider a avaliar após o AWS estar validado, para confirmar se o contrato definido pelo AWS se sustenta com um segundo provider real |
| `eventpier-azure-emulator` (ambiente unificado próprio, gerenciado pelo Eventpier) | Ideia registrada, sem compromisso de escopo ou data; só avança se a dor de orquestrar os três emuladores Azure separadamente se confirmar na prática |
| `eventpier-gcp` | Não iniciado |
| Autenticação entre UI e providers | Só necessária quando suporte a cloud real (credenciais legítimas) entrar em pauta |
| Gateway de autenticação centralizado | Mesma dependência acima |
| Contract testing formalizado (consumer-driven, Pact ou equivalente) | Prática recomendada para quando o número de providers/consumidores crescer; não bloqueante para o MVP com um único provider |

---

## Legenda

- 🔲 **Pendente** — ainda sem `/specify` (ou `/specify-tech`) rodado
- 🟡 **Em andamento** — alguma fase (`specify`/`plan`/`tasks`/`implement`/`review`) já rodou, mas não concluiu o ciclo
- ✅ **Concluído** — PR revisada, aprovada e mergeada (`review-pr` Etapa 8 já rodou)
- 🚧 **Bloqueado** — `current_phase: blocked` no estado da feature (ver `status_detail` no JSON ou `/pipeline-status` para o motivo)
- ⛔ **Cancelado** — `current_phase: cancelled`
- ❌ **Falhou** — `current_phase: failed`

Os três últimos são mapeamento direto do `current_phase` de exceção em
`.pipeline/state/<slug>.json` (ver "Estados de exceção" em
`.pipeline/feature-state.schema.md`) — nunca setados manualmente aqui
sem o estado correspondente refletir o mesmo valor.

## Notas

- A numeração (`#`) segue a mesma sequência usada em `specs/<NNN>-<slug>/`
  — não pule números nem reordene depois de atribuídos.
- Se uma spec for cancelada, bloqueada ou falhar, não delete a linha —
  marque com o símbolo correspondente da legenda e mantenha o
  histórico visível.
