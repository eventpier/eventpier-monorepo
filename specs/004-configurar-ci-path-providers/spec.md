# Spec 004 — CI com Gatilho por Path para `providers/*`

## Cenários de Uso

1. Como mantenedor(a) do provider AWS, ao ter um Pull Request com
   mudanças em `providers/aws/**` mergeado em `main`, preciso que uma
   nova imagem Docker do provider seja construída e publicada
   automaticamente, sem rodar nenhum comando manual.
2. Como mantenedor(a) do contrato (`packages/contracts`), ao ter uma
   mudança que afeta o contrato mergeada em `main`, preciso que o(s)
   provider(s) que o consomem sejam reconstruídos e republicados
   automaticamente — para que nenhuma imagem publicada fique
   desalinhada com o contrato mais recente sem que ninguém perceba.
3. Como mantenedor(a) de um futuro segundo provider (ex.: Azure, ainda
   não implementado), preciso ter confiança de que uma mudança
   exclusiva em `providers/aws/**` nunca disparará rebuild/publish do
   provider Azure, e vice-versa — isolamento de release entre
   providers, mesmo compartilhando o mesmo repositório físico.
4. Como contribuidor(a) abrindo um Pull Request, preciso que a
   validação do projeto (os quality gates já definidos em
   `.pipeline/quality-gates.md`) rode automaticamente e bloqueie o
   merge caso falhe — até este ponto do roadmap, o repositório não tem
   nenhuma automação de CI, e essa validação é hoje inteiramente
   manual.
5. Como mantenedor(a) investigando um problema em produção/local,
   preciso conseguir identificar de qual commit de `main` uma imagem
   de provider publicada foi originada, mesmo sem um processo formal
   de versionamento semântico por provider ainda existir.

Esta feature não expõe UI nem fluxo de usuário final — o "usuário" dela
é quem desenvolve ou mantém o Eventpier. Os itens do checklist de
fluxos/estados de erro de UI não se aplicam.

## Requisitos Funcionais

1. Deve existir um pipeline de CI que executa automaticamente os
   quality gates definidos em `.pipeline/quality-gates.md` (typecheck,
   build, build Docker, testes) a cada Pull Request aberto ou
   atualizado contra `main`, cobrindo todos os workspaces do monorepo
   — não apenas `providers/*`. Esta validação geral é a base sobre a
   qual o comportamento de publish com gatilho por path (requisitos
   3-5) se apoia, já que nenhuma CI existe no repositório até este
   ponto do roadmap.
2. O merge de um Pull Request em `main` deve ficar bloqueado enquanto
   os quality gates do requisito 1 não passarem, consistente com a
   proteção de branch já existente no repositório.
3. Ao detectar, em um push/merge na branch `main`, mudanças dentro de
   `providers/<nome>/**` (ex.: `providers/aws/**`) e/ou dentro de
   `packages/contracts/**`, o pipeline deve construir e publicar
   automaticamente uma nova imagem Docker do(s) provider(s) afetado(s)
   em um registry de imagens acessível publicamente.
4. Uma mudança exclusiva em um provider (ex.: `providers/aws/**`)
   nunca deve disparar rebuild/publish de outro provider cujo path não
   foi alterado — o isolamento de release entre providers (princípio 3
   da constitution) deve se sustentar mesmo quando mais de um provider
   existir dentro de `providers/`.
5. Uma mudança que não toque nenhum caminho relevante para publish
   (ex.: apenas `apps/ui/**` ou documentação) não deve disparar
   nenhuma publicação de imagem de provider.
6. Cada imagem de provider publicada deve ser identificável de forma
   única e rastreável até o commit de `main` que a originou, mesmo sem
   um processo de versionamento semântico formal por provider ainda
   definido.
7. A publicação de imagem deve ocorrer sem exigir nenhuma ação manual
   do mantenedor além do merge do Pull Request em `main` — não deve
   depender de criação manual de tag/release.
8. O pipeline de CI deve funcionar usando apenas credenciais/segredos
   nativamente disponíveis na plataforma que hospeda o repositório,
   sem depender de nenhum segredo externo não documentado.

## Critérios de Sucesso

- Um Pull Request que altera apenas `apps/ui/**` roda os quality gates
  do requisito 1 com sucesso, mas não publica nenhuma imagem de
  provider.
- Um Pull Request mergeado em `main` que altera `providers/aws/**`
  resulta em uma nova imagem do provider AWS publicada, identificável
  pelo commit de `main` que a originou.
- Um Pull Request mergeado em `main` que altera apenas
  `packages/contracts/**` também resulta em uma nova imagem publicada
  do provider AWS (único provider existente hoje) — validando o
  comportamento que passará a isolar Azure/GCP quando existirem.
- Um Pull Request com um quality gate falhando (ex.: typecheck
  quebrado) não pode ser mergeado em `main` enquanto o gate não
  passar.
- (Projeção, não testável hoje com um único provider real) quando um
  segundo provider existir: uma mudança isolada em
  `providers/azure/**` não republica a imagem de `providers/aws/**`, e
  vice-versa. Este critério fica registrado para validação quando a
  spec do segundo provider existir — hoje só é verificável pela
  configuração do gatilho, não por execução real com dois providers.

## Fora do escopo desta spec

- Publicação de imagem Docker de `eventpier-ui` — o `docker-compose.yml`
  já referencia `ghcr.io/eventpier/eventpier-ui`, mas o pipeline de
  publish para essa imagem não é parte do gatilho por path aqui
  especificado, que trata especificamente do isolamento de release
  entre *providers*.
- Processo formal de versionamento semântico por provider (ex.:
  `aws-v1.2.0`) — fora desta spec; a rastreabilidade por commit
  (requisito 6) é suficiente para o estágio atual do MVP.
- Deploy/rollout da imagem publicada em qualquer ambiente (staging,
  produção) — esta spec cobre apenas build + publish da imagem no
  registry, não seu uso subsequente.
- Contract testing formalizado entre UI e providers (já registrado
  como fora do MVP em `docs/product.md`).
- Autenticação/controle de acesso ao registry além do necessário para
  publicar — assume-se registry público, consistente com o
  repositório já ser público.
- Implementação do endpoint de manifesto, health-check, ou qualquer
  capability do provider (specs 005 em diante).
- Configuração de LocalStack, `eventpier-azure` ou `eventpier-gcp` —
  já fora do MVP conforme `docs/product.md`.

## Alinhamento com `docs/product.md` e `docs/arquitetura.md`

`docs/product.md` não menciona CI diretamente; nenhuma seção "Fora do
MVP" do produto ou do roadmap é tocada por esta spec. `docs/arquitetura.md`
(seção 9) e `memory/constitution.md` (princípio 3) já preveem
explicitamente que "CI com gatilho por path já deve existir desde o
MVP para os workspaces de `providers/*`, antecipando o comportamento
que será necessário no monorepo permanente do Estado 3" — esta spec
implementa exatamente essa previsão, hoje com um único provider (AWS)
mas desenhada para não exigir redesenho quando um segundo provider
real for adicionado.

## Clarificações

- **Escopo do gatilho por path**: confirmado explicitamente com o
  usuário durante esta sessão de `/specify` que o gatilho considera
  tanto `providers/**` quanto `packages/contracts/**` — não apenas
  `providers/**`. Motivo: um provider publicado com um contrato
  desatualizado quebraria compatibilidade com a UI de forma
  silenciosa; o contrato é consumido diretamente pelos providers
  (princípio 4 da constitution). Reflete-se no requisito funcional 3.
- **Momento da publicação de imagem**: confirmado explicitamente com o
  usuário que a publicação ocorre automaticamente a cada merge em
  `main` que toque o path relevante, sem exigir tag/release explícita
  por provider. Motivo: mantém o processo simples e sem passo manual
  adicional, adequado ao estágio atual do MVP, que ainda não define
  uma cadência de release formal por provider. Reflete-se no requisito
  funcional 7 e no critério de sucesso correspondente.
