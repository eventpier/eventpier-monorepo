# Spec 001 — Setup do Monorepo (workspaces)

## Nota de alinhamento com `docs/product.md`

Ao especificar esta feature foi identificada uma contradição entre
`docs/product.md` (seção "Escopo do MVP", que descreve `eventpier-ui`
e `eventpier-aws` como **repositórios independentes** desenvolvidos em
paralelo) e `docs/arquitetura.md`/`CLAUDE.md` (que descrevem o Estado 1
como **monorepo único**, com a divisão em repositórios próprios
adiada para o Estado 2 — início do segundo provider real).

Confirmado com o usuário: **o monorepo único é a decisão vigente**
para o MVP. Esta spec segue essa decisão. `docs/product.md` está
desatualizado nesse trecho específico e deveria ser corrigido
separadamente (fora do escopo desta spec, que não edita documentos de
produto).

## Cenários de Uso

1. Como desenvolvedor(a) do Eventpier, preciso de uma estrutura de
   repositório com workspaces claramente separados (UI, providers,
   pacotes compartilhados) para poder iniciar a implementação de cada
   camada de forma isolada, sem que uma mudança em uma camada exija
   tocar nas outras.
2. Como desenvolvedor(a) que vai especificar e implementar as
   próximas specs da Fase 1 (002 — contrato, 003 — Docker Compose,
   004 — CI), preciso que a estrutura de diretórios já exista e siga
   a convenção descrita em `docs/arquitetura.md`, para que essas specs
   possam assumir os caminhos como dado já resolvido, em vez de
   redefini-los.
3. Como contribuidor(a) nova no projeto, preciso que a raiz do
   repositório deixe claro, só de olhar a árvore de diretórios, onde
   cada tipo de código deve viver — sem precisar perguntar ou ler
   documentação externa para saber isso.

Esta feature não expõe UI nem fluxo de usuário final — o "usuário"
dela é quem desenvolve o Eventpier. Os itens do checklist de
fluxos/estados de erro de UI não se aplicam.

## Requisitos Funcionais

1. O repositório deve ter uma raiz de monorepo que reconhece e
   orquestra múltiplos workspaces — não apenas pastas soltas sem
   relação declarada entre si.
2. Deve existir um workspace dedicado à UI (`apps/ui`), um dedicado a
   providers de cloud (`providers/aws` como primeiro membro) e um
   dedicado a pacotes compartilhados (`packages/contracts` como
   primeiro membro), replicando a estrutura do Estado 1 descrita em
   `docs/arquitetura.md`.
3. Cada workspace deve poder ser operado isoladamente a partir da
   raiz (ex.: instalar/rodar comandos direcionados a um único
   workspace por vez), preparando o terreno para os quality gates que
   as specs seguintes vão configurar.
4. A estrutura deve ser extensível: adicionar um segundo provider ou
   um segundo pacote compartilhado no futuro não deve exigir
   reestruturar o que esta spec cria.
5. Cada workspace criado por esta spec deve conter o mínimo necessário
   para "existir" como pacote reconhecível pelo tooling do monorepo
   (identidade e versão), **sem** conter lógica de negócio, endpoints,
   componentes de UI, adapters ou testes reais — isso é escopo das
   specs 002+ e das fases seguintes do roadmap.
6. Não deve haver dependência funcional entre workspaces além da
   relação de consumo já definida em `docs/arquitetura.md`: `apps/ui`
   e `providers/aws` podem depender de `packages/contracts`; nunca o
   inverso, e `apps/ui` nunca depende diretamente do código-fonte
   interno de `providers/aws`.
7. A raiz do repositório deve documentar, de forma mínima, o
   propósito de cada diretório de nível superior (`apps/`,
   `providers/`, `packages/`), para orientar onde novo código deve ser
   adicionado.

## Critérios de Sucesso

- Um(a) desenvolvedor(a) que clona o repositório do zero identifica,
  sem ler nenhuma documentação externa ao próprio repositório, onde
  cada tipo de código (UI, provider, contrato) deve ser adicionado.
- É possível instalar/operar as dependências de um único workspace
  sem instalar ou afetar os demais.
- A spec 002 (`packages/contracts`) consegue começar a implementação
  assumindo que o workspace `packages/contracts` já existe como
  pacote reconhecido pelo monorepo, sem precisar recriar estrutura
  básica.
- Nenhuma mudança estrutural é necessária quando o segundo provider
  real (Azure ou GCP) for iniciado — apenas a adição de uma nova pasta
  sob `providers/`, conforme o Estado 2 da arquitetura.

## Fora do escopo desta spec

- Conteúdo funcional do contrato (`ProviderManifest`, `Page<T>`,
  `ProviderError`, `CapabilityDescriptor`) — spec 002.
- Docker Compose e orquestração de containers — spec 003.
- CI com gatilho por path — spec 004.
- Qualquer lógica de UI, provider ou adapter — fases 2 e 3 do roadmap.
- Correção do trecho desatualizado de `docs/product.md` (ver nota de
  alinhamento acima) — decisão do usuário, não automática desta spec.

## Clarificações

- **Organização de repositório (MVP)**: monorepo único, conforme
  `docs/arquitetura.md` — confirmado explicitamente com o usuário
  durante esta sessão de `/specify`, dada a contradição encontrada em
  `docs/product.md` (ver nota de alinhamento no topo deste documento).
