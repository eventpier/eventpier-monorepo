# Research — Ativação Operacional do CI (013)

## Contexto lido

- `ARQUIVO_REGRAS` (`memory/constitution.md`), princípio 3 (isolamento
  de release por path) e 10/12 (sem segredo além do necessário; sem
  abstração antecipada).
- `ARQUIVO_ARQUITETURA` (`docs/arquitetura.md`), seção 9.
- `spec.md` desta feature — 4 requisitos funcionais, todos definidos
  como estados observáveis, não como passos de implementação.
- `specs/004-configurar-ci-path-providers/` (spec, research, review-pr-6.md)
  — os workflows já existem e já foram usados numa PR real (PR #6):
  `ci.yml` (job `validate`) já rodou com sucesso; `publish-provider-aws.yml`
  nunca rodou de verdade ainda (nenhum push a `main` tocou
  `providers/aws/**`/`packages/contracts/**` desde o merge da spec 004).
- Investigação ativa nesta sessão de `/plan` (não só leitura de doc
  estático) para os 4 requisitos — resultados abaixo.

## Decisão 1 — Requisito 1 (merge bloqueado): via Rulesets API, não Branch Protection clássica

**Achado**: `gh api repos/eventpier/eventpier-monorepo/branches/main/protection`
retorna `404 Branch not protected`. A proteção real de `main` está
implementada via **Rulesets** (`gh api repos/eventpier/eventpier-monorepo/rulesets`
→ ruleset `id: 20759671`, nome "Protect main - PR only", `target:
branch`, regras atuais: `pull_request` com
`required_approving_review_count: 0`, `non_fast_forward`, `deletion`).
Nenhuma regra `required_status_checks` está presente hoje — por isso o
job `validate` roda e reporta, mas não bloqueia merge de fato
(confirma a lacuna do Requisito 1 da spec).

**Decisão**: adicionar uma regra `required_status_checks` a esse mesmo
ruleset (não criar um ruleset novo, não usar a API de Branch
Protection clássica — o repositório já usa Rulesets, introduzir os
dois mecanismos em paralelo seria confuso e redundante):

```bash
gh api repos/eventpier/eventpier-monorepo/rulesets/20759671 \
  --method PUT \
  --input <payload com todas as regras atuais + required_status_checks>
```

Payload (regras existentes preservadas, uma nova adicionada):
```json
{
  "name": "Protect main - PR only",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    { "type": "pull_request", "parameters": { "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false, "required_reviewers": [], "require_code_owner_review": false, "dismissal_restriction": { "enabled": false, "allowed_actors": [] }, "require_last_push_approval": false, "required_review_thread_resolution": false, "allowed_merge_methods": ["merge", "squash", "rebase"] } },
    { "type": "non_fast_forward" },
    { "type": "deletion" },
    { "type": "required_status_checks", "parameters": { "required_status_checks": [{ "context": "validate", "integration_id": null }], "strict_required_status_checks_policy": false } }
  ]
}
```

**Verificação, não só configuração**: o Requisito 1/Critério de
Sucesso exige confirmação prática, não apenas a regra existir. Depois
do PUT: abrir um PR de teste com um erro proposital de `tsc --noEmit`,
confirmar que `ci.yml` falha, e que o botão de merge no GitHub fica
desabilitado (`gh pr view --json mergeStateStatus` deve reportar
`BLOCKED`, não `CLEAN`). Fechar esse PR sem merge ao final — ele
existe só para o teste.

**Alternativa considerada**: usar a API de Branch Protection clássica
(`PUT /repos/{owner}/{repo}/branches/main/protection`) — rejeitada,
porque criaria um segundo mecanismo de proteção coexistindo com o
Ruleset já ativo, e o comportamento de precedência entre os dois não
está documentado como bem definido pelo GitHub. Trabalhar dentro do
mecanismo já escolhido pelo repositório é mais seguro.

## Decisão 2 — Requisito 2 (primeira publicação real não falha por permissão da org)

**Achado**: `gh api orgs/eventpier` não expõe nenhum campo de política
de criação de pacotes (confirmado lendo a resposta completa). Essa
configuração (Organization Settings → Packages → "Package Creation")
não tem endpoint de leitura/escrita na REST API pública do GitHub —
só é verificável/alterável pela UI, por quem administra a organização.

**Decisão**: não bloquear esta spec num passo manual de verificação
prévia "só por garantia". Em vez disso, **tratar a primeira publicação
real como o próprio teste**: disparar o gatilho (Decisão 3) e observar
o resultado.
- Se o job `publish` completar com sucesso: Requisito 2 satisfeito,
  nada mais a fazer — a política da org já permitia (default
  permissivo em orgs novas no plano gratuito, ou já configurada assim
  por quem criou a org).
- Se falhar com `403`/mensagem de permissão negada: reportar ao
  usuário o caminho exato descoberto nesta pesquisa (Organization
  Settings → Packages → "Package Creation" → habilitar criação de
  pacotes públicos) para ação manual — não há forma de contornar isso
  via `GITHUB_TOKEN` nem via `gh api` sem escopo de administração de
  pacotes que o token atual não tem.

**Justificativa**: evita gastar uma verificação manual do usuário que
pode nem ser necessária, e mantém o requisito funcional 5 (nenhuma
credencial nova) — não vale a pena pedir escopo adicional só para
checar algo que o próprio teste real já revela com uma execução.

## Decisão 3 — Requisito 4 (confirmação real dos 3 cenários de gatilho): três PRs reais mínimas, com conteúdo útil

**Decisão**: em vez de um "commit vazio só para disparar CI" (ruído no
histórico sem valor), cada cenário de `spec.md` FR4 é exercitado por
um PR real e pequeno que adiciona um `README.md` mínimo ao workspace
tocado — nenhum dos três workspaces reais (`apps/ui`, `providers/aws`,
`packages/contracts`) tem `README.md` próprio hoje (só a raiz do
monorepo tem); documentar cada um é valor real, não só pretexto para
disparar o gatilho.

1. PR tocando só `apps/ui/**` (`apps/ui/README.md`) → merge → **não**
   deve aparecer nenhum job de `publish-provider-aws.yml` nos checks.
2. PR tocando `providers/aws/**` (`providers/aws/README.md`) → merge
   → `publish-provider-aws.yml` deve rodar e completar com sucesso —
   este é também o teste real do Requisito 2, e a base para testar o
   Requisito 3 (imagem pública) depois.
3. PR tocando só `packages/contracts/**` (`packages/contracts/README.md`)
   → merge → `publish-provider-aws.yml` deve rodar de novo (confirma
   que o contrato sozinho já dispara republish do provider AWS).

**Ordem**: 1 → 2 → 3, sequencial — 2 precisa vir antes de qualquer
verificação do Requisito 3 (a imagem só existe depois da primeira
publicação bem-sucedida).

**Alternativa considerada**: um único PR tocando os três paths de uma
vez — rejeitada. Não distinguiria os três cenários do Requisito 4 uns
dos outros (ex.: não provaria que `apps/ui`-only de fato não publica,
porque nenhum PR isolado testaria só isso).

## Decisão 4 — Requisito 3 (imagem pública): ação manual, não automatizável nesta sessão

**Achado**: mudar a visibilidade de um pacote GHCR
(`PATCH /orgs/{org}/packages/container/{package}` com
`{"visibility": "public"}`) exige escopo de token `write:packages` —
o token atual do `gh auth status` tem `admin:public_key`, `gist`,
`read:org`, `repo`, **sem** `write:packages`. Ampliar escopo
(`gh auth refresh -s write:packages`) exige fluxo OAuth interativo no
navegador — impossível nesta sessão não-interativa (mesma limitação já
sinalizada para outros conectores neste ambiente).

**Decisão**: passo manual único do usuário na UI do GitHub
(`github.com/orgs/eventpier/packages/container/eventpier-aws/settings`
→ Change visibility → Public), depois que a Decisão 3/passo 2 publicar
a imagem pela primeira vez. Documentado em `quickstart.md`.
Verificação (essa sim automatizável, sem escopo novo): `docker pull
ghcr.io/eventpier/eventpier-aws:latest` de uma sessão sem login no
GHCR — sucesso confirma que o passo manual funcionou.

## Fora do escopo desta spec (reafirmado)

Nenhuma mudança no conteúdo funcional de `ci.yml`/`publish-provider-aws.yml`
além do necessário para os requisitos acima — nenhuma decisão aqui
altera gatilho, path filter, tags ou permissões já definidos pela spec
004.

## Segurança e Observabilidade (obrigações do Dev)

- **Ação em recurso compartilhado/difícil de reverter**: o PUT no
  Ruleset (Decisão 1) e os merges reais em `main` (Decisão 3) afetam o
  repositório de verdade, de forma visível a qualquer colaborador
  futuro. Confirmar com o usuário antes de executar cada uma dessas
  ações durante `/implement` — não assumir que `MODO_EXECUCAO:
  encadeado` dispensa essa confirmação; a regra geral de "ações
  difíceis de reverter merecem confirmação explícita" se aplica aqui
  mesmo fora do `/review-pr`.
- **Sem credencial nova**: nenhuma decisão acima introduz PAT ou
  segredo — Decisão 1 usa o escopo `repo` já presente no `gh` do
  usuário; Decisão 4 é deliberadamente manual por não haver escopo de
  pacotes disponível (requisito funcional 5).
- **PR de teste do Requisito 1 (typecheck quebrado) nunca é mergeada**
  — existe só para provar o bloqueio; fechar (não mergear) ao final,
  para não sujar `main` com uma quebra proposital.

## Decisões durante a implementação

