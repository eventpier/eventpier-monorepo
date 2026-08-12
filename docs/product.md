# Eventpier — Visão de Produto

## Problema que o produto resolve

Desenvolvedores que trabalham com ambientes cloud locais (MiniStack, LocalStack, Azurite, emuladores
GCP) não têm uma camada de experiência consistente para inspecionar, explorar e debugar os recursos
desses ambientes. Cada emulador expõe suas próprias ferramentas (ou nenhuma), forçando o desenvolvedor
a recorrer a CLIs específicas, consoles improvisados ou leitura direta de logs para entender o que está
rodando dentro do ambiente que ele mesmo configurou. O Eventpier resolve essa lacuna oferecendo uma UX
unificada de inspeção sobre esses ambientes, sem se tornar um substituto deles.

## Público-alvo

- **Principal**: desenvolvedores backend que usam ambientes cloud emulados localmente (hoje: MiniStack)
  durante o desenvolvimento, e precisam inspecionar buckets, filas, tópicos, segredos e logs sem sair do
  fluxo de trabalho local.
- **Secundário**: times que mantêm múltiplos serviços integrados a diferentes provedores cloud e querem
  uma ferramenta única de inspeção, independente de qual provider/emulador está por trás.

## Proposta de valor / diferencial

- **Observador, não proxy obrigatório**: o Eventpier nunca se interpõe entre o SDK do desenvolvedor e o
  emulador. O emulador (MiniStack, LocalStack, etc.) continua acessível e compatível com qualquer SDK
  padrão apontando o endpoint, exatamente como já funciona nativamente. O Eventpier apenas observa o que
  está lá dentro.
- **UI desacoplada de cloud**: uma única interface, sem duplicação de componentes/UX por provider, capaz
  de atender AWS, Azure e GCP no futuro através de um contrato comum baseado em capabilities.
- **Extensível sem reescrita**: novos providers e novos ambientes (cloud real, emuladores diferentes) se
  encaixam na arquitetura existente sem exigir mudanças na UI.

## Escopo do MVP

- Organização: `eventpier-ui` e `eventpier-aws` como repositórios independentes, desenvolvidos em
  paralelo.
- Provider único: **AWS**.
- Environment único: **MiniStack**, com suporte a apontar para uma instância já em execução em outro
  projeto (`managed: false` + `endpoint` configurável) ou a uma instância gerenciada pelo próprio
  Docker Compose do Eventpier (`managed: true`).
- Capability única: **Storage** — listar buckets, abrir bucket, listar objetos, navegar por
  prefixos/pastas.
- Contrato mínimo entre UI e provider: `ProviderManifest`, `CapabilityDescriptor` (com status
  `available`/`unavailable`/`degraded`), `Page<T>` (paginação genérica), `ProviderError` (erro
  estruturado).
- Health-check com cache em memória por capability, TTL curto (3-5s, configurável), com invalidação
  ativa em falha de chamada real.
- Docker Compose com rede interna nomeada; apenas `eventpier-ui` expõe porta ao host entre os serviços
  do Eventpier — o `ministack` também expõe porta, pois seu propósito nativo é ser acessível por
  qualquer SDK externo ao Eventpier.
- Sem autenticação entre UI e providers, válido apenas para ambientes locais.

## Fora do MVP (deliberadamente adiado)

- **LocalStack como Environment adicional do provider AWS** — arquitetura já suporta (Provider ≠
  Environment), implementação adiada até haver necessidade concreta.
- **`eventpier-azure`** (provider federado apontando para Azurite / Service Bus Emulator / Cosmos DB
  Emulator separadamente) — próximo provider a ser avaliado após o AWS estar validado, para confirmar se
  o contrato definido pelo AWS se sustenta com um segundo provider real.
- **`eventpier-azure-emulator`** (serviço próprio que unifica Azurite + Service Bus Emulator + Cosmos
  Emulator num ambiente único gerenciado pelo Eventpier) — ideia registrada, sem compromisso de escopo
  ou data; só avança se a dor de orquestrar os três emuladores separados se confirmar na prática.
- **`eventpier-gcp`** — não iniciado.
- **Autenticação real** entre UI e providers, ou entre provider e cloud real (AWS de verdade) — só
  entra em pauta quando o suporte a cloud real (não emulada) for implementado.
- **Gateway de autenticação centralizado** — mesma lógica acima.

## Métricas de sucesso

- O vertical slice (UI → `eventpier-aws` → MiniStack, capability Storage) funciona ponta a ponta via
  `docker compose up`, validando: contrato, provider, API, UI, Docker, conexão com emulador e descoberta
  de capabilities.
- O contrato definido na Fase 1 (AWS/MiniStack/Storage) se sustenta sem breaking changes quando um
  segundo provider real (Azure) for implementado — validação qualitativa de que a abstração não foi
  feita cedo demais nem tarde demais.
- Um desenvolvedor consegue apontar o Eventpier para um MiniStack que ele já roda em outro projeto
  (`managed: false`) sem nenhuma mudança de código, só configuração.
