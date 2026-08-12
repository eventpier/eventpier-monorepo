# Eventpier — Constitution

## Preâmbulo

O Eventpier é uma organização open-source de ferramentas para inspeção e debugging de ambientes cloud
locais. Cada provider cloud (AWS, Azure, GCP) é um projeto independente; a interface de usuário é um
projeto separado, desacoplado de qualquer cloud específica. Este documento define os princípios que
regem decisões técnicas em qualquer repositório da organização.

## Princípios Fundamentais

### 1. A UI conhece capabilities, não clouds
**DEVE** o `eventpier-ui` nunca importar ou depender de SDKs de cloud (AWS SDK, Azure SDK, GCP SDK) nem
conhecer regras específicas de nenhum emulador (MiniStack, LocalStack, Azurite, etc.).
*Justificativa*: é o que permite que a mesma UI atenda múltiplos providers sem duplicação de
componentes, navegação, design e testes (ver seção 17 do documento de arquitetura original).

### 2. Provider e Environment são conceitos distintos
**DEVE** todo provider suportar múltiplos environments (ex.: AWS suporta MiniStack, LocalStack e AWS
Cloud) sem que a UI precise saber qual environment está ativo além do que o manifesto declara.
*Justificativa*: permite trocar de emulador para cloud real sem alterar a UI, e permite adiar suporte a
novos environments sem reabrir o contrato.

### 3. Providers compartilham repositório, mas nunca ciclo de release
**DEVE** todo provider publicar sua própria imagem Docker, com sua própria versão e cadência de release,
independente dos demais — mesmo quando providers residem no mesmo repositório físico (`eventpier-providers`).
Isolamento de release é garantido por CI com gatilho por path (mudanças em `aws/**` não publicam `azure/**`),
não pela separação de repositório.
*Justificativa*: providers compartilham código real entre si (config de environment, health-check, padrões de
adapter), o que justifica um monorepo próprio para eles — **exceção consciente** à independência total de
repositório considerada inicialmente. O que continua inegociável é a independência de *release*, não de
*repositório*. Ver seção "Estrutura de Repositórios" em `arquitetura.md` para os três estados dessa evolução.

### 4. O contrato evolui de forma aditiva
**DEVE** o contrato entre UI e providers (`ProviderManifest`, `CapabilityDescriptor`, `Page<T>`,
`ProviderError`) evoluir por padrão via campos opcionais aditivos. Breaking changes exigem incremento de
versão major do `contractVersion` e um ciclo de depreciação documentado.
*Justificativa*: com múltiplos repositórios evoluindo separadamente, mudanças não-aditivas quebram
consumidores silenciosamente.

### 5. Capability tem status, não é booleano
**DEVE** toda capability exposta no manifesto ter status `available`, `unavailable` ou `degraded`, com
código de erro enumerado (`HealthFailureCode`) quando aplicável — nunca apenas presente/ausente.
*Justificativa*: distingue "provider não implementa" de "ambiente está fora do ar agora" de "disponível
com limitações", permitindo à UI degradar graciosamente.

### 6. Health-check é cacheado com invalidação ativa
**DEVE** o health-check de cada capability ser cacheado em memória, por capability (nunca globalmente
por provider), com TTL curto (default 3-5s, configurável via `HEALTH_CHECK_TTL_MS`) e invalidação ativa
quando uma chamada real da capability falhar.
*Justificativa*: cache sem invalidação ativa pode reportar "disponível" enquanto o ambiente já caiu,
prejudicando a confiabilidade da ferramenta.

### 7. Emuladores são infraestrutura pública, não detalhe interno
**DEVE** todo emulador gerenciado pelo Eventpier (MiniStack, e futuramente Azurite/Service Bus
Emulator/Cosmos Emulator) expor sua porta ao host, preservando compatibilidade com qualquer SDK padrão
apontando o endpoint diretamente — independente do Eventpier estar rodando ou não.
*Justificativa*: o propósito do emulador é ser um substituto drop-in da cloud real para qualquer
aplicação do desenvolvedor, não apenas para o Eventpier.

### 8. Endpoint do environment é sempre configurável
**DEVE** todo provider suportar apontar para um environment já em execução externamente (`managed:
false` + `endpoint` customizado), além de poder gerenciar sua própria instância (`managed: true`).
*Justificativa*: desenvolvedores frequentemente já rodam MiniStack/LocalStack para outros projetos; o
Eventpier deve se integrar a esse ambiente, não forçar uma instância própria.

### 9. Recursos não gerenciados não sofrem ações de ciclo de vida
**DEVE** a UI e o provider nunca oferecer ações de restart/gerenciamento de ciclo de vida sobre um
environment com `managed: false` — apenas refletir seu estado.
*Justificativa*: o Eventpier não é dono desse recurso; agir sobre ele seria comportamento inesperado e
potencialmente destrutivo para outro projeto do desenvolvedor.

### 10. Sem autenticação em ambientes locais (por enquanto)
**DEVE** nenhum provider exigir autenticação entre si e a UI enquanto o escopo for exclusivamente
ambientes locais (MiniStack, LocalStack, Azurite e afins).
*Justificativa*: simplicidade proporcional ao risco real — ambientes emulados locais não expõem dados
sensíveis. Esta premissa **não se estende** a suporte a cloud real (credenciais legítimas envolvidas) e
deve ser revisitada explicitamente quando esse suporte for implementado.

### 11. Rede interna restrita por padrão
**DEVE** o Docker Compose usar rede interna nomeada; apenas serviços que precisam ser acessados por algo
fora do Eventpier (a UI, e os emuladores) publicam porta ao host. Providers (`eventpier-aws`, etc.) não
publicam porta.
*Justificativa*: reduz superfície de rede desnecessária sem comprometer o propósito de compatibilidade
externa dos emuladores.

### 12. Abstração só após necessidade comprovada
**DEVE** nenhuma abstração cross-provider (ex.: contrato unificado de Storage entre AWS/Azure/GCP, ou um
pacote `provider-core`/`shared` entre providers) ser criada antes de existir uma segunda implementação
real que a exija.
*Justificativa*: princípio anti-overengineering central do projeto — evita desenhar abstrações
especulativas que não sobrevivem ao contato com um segundo caso real. Aplica-se tanto a contratos de
capability quanto a código compartilhado entre providers: só extrair o que se repetir de fato quando o
Azure (ou GCP) existir, não antecipar.

### 13. O contrato é consumido por UI e providers — logo, é um artefato próprio
**DEVE** `ProviderManifest`, `CapabilityDescriptor`, `Page<T>` e `ProviderError` viver em um pacote
próprio (`packages/contracts` no MVP; `eventpier-contracts` como repositório próprio pós-migração),
nunca dentro do código de um único provider.
*Justificativa*: o contrato atravessa a fronteira UI↔Provider — pertencer fisicamente a um dos dois
lados criaria dependência incorreta (ex.: UI importando de dentro do repositório de um provider
específico). Segue a mesma disciplina de versionamento semântico (princípio 4) desde o primeiro commit,
mesmo enquanto for workspace interno do monorepo do MVP.

## Estrutura de Repositórios (três estados)

Ver `arquitetura.md` para o detalhamento técnico. Resumo:

1. **MVP (agora)**: monorepo único `eventpier/`, com `apps/ui`, `providers/aws` e `packages/contracts`
   como workspaces.
2. **Gatilho de migração**: ao finalizar o provider AWS e iniciar o desenvolvimento do Azure ou GCP.
3. **Estado final**: `eventpier-contracts` (repo próprio, pacote publicado), `eventpier-providers`
   (monorepo permanente contendo aws/, azure/, gcp/) e `eventpier-ui` (repo próprio).

O agrupamento permanente de providers em um único repositório é uma exceção deliberada e documentada —
não uma contradição não intencional com o princípio de independência de release (princípio 3).

## Restrições de Stack Tecnológico

| Camada | Tecnologia |
|---|---|
| UI | Next.js, TypeScript, Storybook |
| Provider (eventpier-aws) | Node.js, TypeScript |
| Containerização | Docker, Docker Compose |
| Environment inicial | MiniStack |
| Environments futuros (não-MVP) | LocalStack, AWS Cloud, Azurite, Service Bus Emulator, Cosmos DB Emulator, GCP Local Emulators |

## Convenções de Commit e Branch

- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`).
- Branches: Git Flow — `main` (estável), `develop` (integração), `feature/<nome>`, `fix/<nome>`.
- O contrato (`ProviderManifest`, `Page<T>`, `ProviderError`, `CapabilityDescriptor`) é versionado junto
  com o primeiro commit visível de cada repositório que o consome, antes de qualquer endpoint real.

## Governança

- **Processo de emenda**: qualquer alteração a um princípio fundamental desta constitution exige
  registro explícito do motivo e impacto, discutido antes da implementação — não apenas um commit
  silencioso.
- **Versionamento semântico**: aplica-se tanto ao contrato entre UI/providers (`contractVersion`) quanto
  às imagens Docker publicadas por cada projeto, de forma independente entre si.
