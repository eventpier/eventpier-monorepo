# Eventpier — Arquitetura

## 1. Visão Geral

O Eventpier separa claramente quatro camadas conceituais:

```text
UI
 │
 │ capabilities
 ▼
Provider
 │
 │ provider-specific API
 ▼
Adapter
 │
 │ runtime-specific behavior
 ▼
Environment
```

**Regra de ouro**: a UI conhece capabilities. Os providers conhecem clouds. Os adapters conhecem
runtimes e emuladores.

A UI e os providers vivem em repositórios/pacotes fisicamente separados por fronteira de consumo — a UI
nunca depende do código interno de um provider, e providers nunca dependem da UI. Ver seção "Estrutura de
Repositórios" abaixo para como essa separação evolui do MVP (monorepo único) até o estado final
(múltiplos repositórios, com providers agrupados entre si).

### Dimensões independentes: Provider × Environment

Provider (AWS, Azure, GCP) e Environment (MiniStack, LocalStack, AWS Cloud / Azurite, Service Bus
Emulator, Azure Cloud / GCP Local Emulators, GCP Cloud) são conceitos ortogonais. Um mesmo provider
suporta múltiplos environments sem alterar a UI nem o contrato.

```text
Provider: AWS
Environment:
├── ministack     (MVP)
├── localstack    (adiado)
└── aws-cloud     (adiado)
```

## 2. Estrutura de Repositórios (três estados)

### Estado 1 — MVP (agora): monorepo único

```text
eventpier/                        (monorepo, workspaces npm/pnpm)
├── apps/
│   └── ui/                       # Next.js app (futuro eventpier-ui)
│       ├── src/
│       └── Dockerfile
├── providers/
│   └── aws/                      # futuro conteúdo de eventpier-providers/aws
│       ├── src/
│       │   ├── manifest/
│       │   │   ├── manifest.service.ts
│       │   │   └── health-cache.ts
│       │   ├── capabilities/
│       │   │   └── storage.controller.ts
│       │   ├── adapters/
│       │   │   └── ministack/
│       │   │       └── storage.adapter.ts
│       │   └── config/
│       │       └── environment.config.ts
│       └── Dockerfile
├── packages/
│   └── contracts/                # @eventpier/contracts — consumido por ui/ e providers/aws/
│       └── src/
│           ├── manifest.ts       # ProviderManifest, CapabilityDescriptor
│           ├── pagination.ts     # Page<T>
│           └── errors.ts         # ProviderError
├── docker-compose.yml
└── package.json                  # workspace root: ["apps/*", "providers/*", "packages/*"]
```

`packages/contracts` já segue a disciplina de versionamento semântico (`contractVersion`, campos
aditivos) desde o primeiro commit, mesmo sendo workspace interno — ver princípios 4 e 13 da
`constitution.md`. Não existe `providers/shared` ainda: seria abstração antecipada com um único
provider real (princípio 12).

### Estado 2 — Gatilho de migração

Disparado ao finalizar o provider AWS e iniciar o desenvolvimento do Azure ou GCP — o ponto em que um
segundo provider real revela o que de fato é compartilhável entre providers, e em que a UI passa a
depender de um contrato usado por mais de um consumidor de forma independente.

```text
eventpier-contracts/              (extraído: repo próprio, pacote publicado, ex.: npm)
eventpier-providers/              (extraído: monorepo — aws/, e azure/ ou gcp/ conforme o caso)
eventpier-ui/                     (extraído: repo próprio)
```

Nesse ponto, avaliar se algo de `providers/aws` se repete no novo provider (ex.: `health-cache.ts`
idêntico) — só então extrair para um pacote compartilhado (`@eventpier/provider-core` ou similar).

### Estado 3 — Longo prazo

```text
eventpier-contracts/              # consumido por eventpier-ui e por todos os providers
eventpier-providers/              # monorepo permanente
├── aws/
├── azure/
└── gcp/
eventpier-ui/
```

O agrupamento permanente de providers em um único repositório é uma **exceção consciente** à
independência total de repositório — motivada por compartilhamento real de código entre providers
(config de environment, health-check, padrões de adapter), não por acoplamento de release. Cada
provider mantém publicação de imagem Docker independente via CI com gatilho por path (mudanças em
`aws/**` não disparam publish de `azure/**`), preservando o princípio 3 da constitution mesmo com
código físico compartilhado.

## 3. Contrato Mínimo (Fase 1)

```ts
// Manifesto do provider
interface ProviderManifest {
  contractVersion: string;   // semver do CONTRATO em si, ex: "1.0.0"
  provider: Provider;
  environment: Environment;
  version: string;           // versão do provider
  capabilities: CapabilityDescriptor[];
}

interface Provider {
  id: string;   // "aws"
  name: string; // "AWS"
}

interface Environment {
  id: string;    // "ministack" | "localstack" | "aws"
  endpoint?: string;
  managed: boolean; // true = Eventpier gerencia o container; false = externo
}

type Capability = 'storage' | 'queue' | 'topic' | 'secret' | 'logs';
type CapabilityStatus = 'available' | 'unavailable' | 'degraded';

interface CapabilityDescriptor {
  id: Capability;
  status: CapabilityStatus;
  reason?: HealthFailureCode;
}

type HealthFailureCode =
  | 'CONNECTION_TIMEOUT'
  | 'CONNECTION_REFUSED'
  | 'AUTH_FAILED'
  | 'UNKNOWN';

// Paginação genérica
interface Page<T> {
  items: T[];
  nextCursor?: string; // opaco para a UI, específico do provider por dentro
}

// Erro estruturado
interface ProviderError {
  code: string;         // ex: 'RESOURCE_NOT_FOUND', 'CONNECTION_FAILED'
  message: string;
  capability?: Capability;
  retryable: boolean;
}
```

### Regras de versionamento do contrato

- Minor/patch de `contractVersion`: apenas adiciona campos opcionais, nunca remove ou muda tipo de campo
  existente.
- Major: apenas em breaking change documentado, com ciclo de depreciação (provider aceita versão antiga
  por N releases).

## 4. Health-check e Cache

- Cache em memória, por capability (nunca global por provider).
- TTL default de 3-5s, configurável via `HEALTH_CHECK_TTL_MS`.
- Invalidação ativa: qualquer chamada real de capability que falhe por conexão invalida o cache daquela
  capability antes de propagar o erro, evitando reportar `available` desatualizado.

```ts
interface CachedHealth {
  status: 'available' | 'unavailable';
  reason?: HealthFailureCode;
  checkedAt: number;
}
```

## 5. Configuração de Environment

```ts
interface EnvironmentConfig {
  id: string;         // "ministack" | "localstack" | "aws"
  endpoint?: string;   // se ausente, usa o endpoint do serviço gerenciado pelo compose
  managed: boolean;    // true = Eventpier sobe o container; false = externo, já em execução
}
```

- `managed: true` (default): o Docker Compose do Eventpier sobe o próprio MiniStack.
- `managed: false`: o provider aponta para uma instância de MiniStack/LocalStack já em execução em outro
  projeto do desenvolvedor, via `endpoint` customizado.
- Recursos com `managed: false` **nunca** recebem ações de restart/gerenciamento de ciclo de vida pela UI
  — apenas refletem seu estado atual.

## 6. Padrões de Acesso a Dados e Integrações Externas

- `eventpier-aws` acessa o MiniStack exclusivamente via AWS SDK (o mesmo SDK que qualquer aplicação real
  usaria), configurando apenas o `endpoint` — nunca uma API proprietária do MiniStack.
- Cada capability (`storage`, e futuramente `queue`, `topic`, `secret`, `logs`) tem seu próprio Adapter,
  isolado atrás de uma interface (ex.: `StorageAdapter`), permitindo trocar o Environment (MiniStack →
  LocalStack → AWS Cloud) sem alterar controller nem contrato.

```ts
interface StorageAdapter {
  listBuckets(): Promise<Bucket[]>;
  listObjects(bucket: string, prefix?: string, cursor?: string): Promise<Page<StorageObject>>;
}
```

## 7. Autenticação

- **Fase 1-3 (ambientes locais)**: nenhuma autenticação entre `eventpier-ui` e providers, nem entre
  provider e emulador. Decisão válida apenas enquanto o escopo for local.
- **Fase futura (cloud real)**: requer definição própria antes de qualquer suporte a AWS Cloud real —
  não resolvido neste documento, fica registrado como dependência de escopo futuro.

## 8. Arquitetura de Containers (MVP)

```text
                    ┌─────────────────────────┐
                    │      Browser             │
                    └───────────┬──────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │     eventpier-ui         │  :3000 (exposta ao host)
                    └───────────┬──────────────┘
                                │ HTTP
                                ▼
                    ┌─────────────────────────┐
                    │     eventpier-aws        │  rede interna (sem porta pública)
                    └───────────┬──────────────┘
                                │ AWS SDK
                                ▼
                    ┌─────────────────────────┐
   App externa  ───▶│       MiniStack          │  :4566 (exposta ao host)
   (fora do compose)└─────────────────────────┘
```

- Rede interna nomeada (`eventpier-net`, driver `bridge`).
- `eventpier-ui`: única porta do lado Eventpier exposta ao host.
- `eventpier-aws`: sem porta publicada — só acessível pela `eventpier-ui` dentro da rede interna.
- `ministack`: porta publicada ao host — propósito nativo é ser consumido por qualquer SDK externo,
  independente do Eventpier estar rodando.
- Serviço `ministack` gerenciado pelo compose é **opcional** via Docker Compose `profiles`, permitindo
  que o desenvolvedor aponte para uma instância externa (`managed: false`) sem subir o container próprio.

```yaml
services:
  eventpier-ui:
    image: ghcr.io/eventpier/eventpier-ui:latest
    ports:
      - "3000:3000"
    networks: [eventpier-net]
    environment:
      - EVENTPIER_AWS_URL=http://eventpier-aws:4000

  eventpier-aws:
    image: ghcr.io/eventpier/eventpier-aws:latest
    networks: [eventpier-net]
    environment:
      - HEALTH_CHECK_TTL_MS=4000
      - MINISTACK_ENDPOINT=http://ministack:4566
      - MINISTACK_MANAGED=true

  ministack:
    image: ministack
    ports:
      - "4566:4566"
    networks: [eventpier-net]
    profiles: ["managed-env"]

networks:
  eventpier-net:
    driver: bridge
```

## 9. Notas sobre a Migração de Repositórios

- A extração do Estado 1 para o Estado 2 é uma operação majoritariamente mecânica: mover pastas +
  configurar publicação de pacote/imagem — não um redesenho, porque os limites de pacote do monorepo já
  correspondem aos futuros limites de repositório.
- `packages/contracts` é o único artefato que atravessa a fronteira UI↔Provider; por isso vira
  repositório próprio na migração, nunca fica agrupado com `eventpier-providers` nem com `eventpier-ui`.
- CI com gatilho por path (path-based triggers) já deve existir desde o MVP para os workspaces de
  `providers/*`, antecipando o comportamento que será necessário no monorepo permanente do Estado 3.

## 10. Decisões Técnicas Relevantes (histórico da discussão)

- Erro e paginação entram no contrato desde a Fase 1 — não é "abstração prematura de serviço", é
  esqueleto mínimo de protocolo HTTP necessário para qualquer capability funcionar.
- Capability com status enumerado (`available`/`unavailable`/`degraded`) em vez de booleano, para
  suportar degradação parcial (ex.: capability disponível com limitações do ambiente).
- Contract testing (consumer-driven, UI escreve as expectativas, provider valida no próprio CI) é a
  direção recomendada para evitar drift entre repositórios independentes — não implementado no MVP, mas
  registrado como prática recomendada para quando o número de consumidores/providers crescer.
