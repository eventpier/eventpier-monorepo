# Spec 007 — EnvironmentConfig (`endpoint` / `managed`)

## Cenários de Uso

1. Como desenvolvedor(a) rodando o Eventpier localmente sem nenhuma
   configuração adicional, quero que o `eventpier-aws` funcione contra
   o MiniStack gerenciado pelo próprio Docker Compose (`managed:
   true`), sem precisar definir nenhuma variável de ambiente.
2. Como desenvolvedor(a) que já roda um MiniStack para outro projeto,
   quero apontar o `eventpier-aws` para essa instância externa via
   configuração explícita (`managed: false` + endpoint customizado),
   sem precisar subir uma segunda instância gerenciada pelo Eventpier.
3. Como desenvolvedor(a) consumindo o manifesto
   (`GET /api/v1/manifest`), quero que o campo `environment` reflita
   com precisão o endpoint e o modo (`managed`) que o provider está de
   fato usando — sem precisar adivinhar ou inspecionar variáveis de
   ambiente do container para saber contra o que estou operando.
4. Como mantenedor(a) do provider, quero que uma configuração
   incompleta ou inválida (ex.: `managed: false` sem endpoint
   informado) impeça o provider de subir com um comportamento
   ambíguo, em vez de assumir silenciosamente um default que pode
   estar errado.
5. Como desenvolvedor(a) da UI (spec 009 em diante), preciso poder
   confiar que, quando `managed: false`, o dado exposto no manifesto é
   só uma descrição do ambiente — nenhuma ação de gerenciamento de
   ciclo de vida (restart, start, stop) é ou será inferida a partir
   dele (princípio 9 da constitution).

Esta feature não expõe UI própria — o comportamento observável é via
`GET /api/v1/manifest` (campo `environment`) e via comportamento de
inicialização do processo do provider. Os itens de checklist de fluxos
visuais de UI não se aplicam.

## Requisitos Funcionais

1. O provider deve construir o campo `environment` do manifesto
   (`EnvironmentConfig`: `id`, `endpoint`, `managed`, formato já
   definido em `docs/arquitetura.md`) a partir de configuração
   externa (variáveis de ambiente), substituindo o valor
   atualmente fixo no código.
2. Sem nenhuma variável de ambiente customizada, o provider deve se
   comportar exatamente como hoje: `id: "ministack"`, `managed: true`,
   apontando para o MiniStack gerenciado pelo Compose.
3. O manifesto deve sempre expor `environment.endpoint` com o valor
   efetivamente em uso pelo provider — inclusive quando esse valor é
   o default do serviço gerenciado pelo Compose, nunca omitindo o
   campo só por ser um default.
4. O campo `environment.managed` deve refletir fielmente a
   configuração fornecida (`true` ou `false`), com default `true`
   quando nenhuma configuração é informada.
5. Quando `managed: false` for configurado sem um endpoint explícito,
   o provider deve falhar ao iniciar, com uma mensagem de erro que
   deixe claro que um endpoint é obrigatório nesse modo — nunca subir
   assumindo silenciosamente o endpoint do MiniStack gerenciado (que
   pode nem estar em execução).
6. Quando a configuração de `managed` recebida não for reconhecível
   como verdadeiro/falso, o provider deve falhar ao iniciar, com uma
   mensagem de erro clara sobre o valor inválido — nunca assumir um
   default silenciosamente para um valor não reconhecido.
7. `GET /api/v1/manifest` deve continuar respondendo com sucesso
   (200) independente de o endpoint configurado estar de fato
   acessível ou não — `EnvironmentConfig` é uma declaração de "para
   onde apontar", não uma verificação de saúde da conexão (isso já é
   papel do mecanismo de health-check da spec 006, ainda não integrado
   a nenhuma capability real).
8. Nenhuma ação de gerenciamento de ciclo de vida (restart, start,
   stop) sobre o MiniStack gerenciado ou externo deve ser introduzida
   por esta spec — `managed: false` permanece, também depois desta
   spec, apenas uma descrição de estado (princípio 9 da constitution).

## Critérios de Sucesso

- Rodando sem nenhuma variável de ambiente customizada, `GET
  /api/v1/manifest` responde `environment: { id: "ministack",
  endpoint: <endpoint do serviço gerenciado>, managed: true }`.
- Configurando um endpoint externo customizado com `managed: false`,
  `GET /api/v1/manifest` reflete exatamente esse endpoint e
  `managed: false`, sem exigir nenhuma mudança de código.
- Configurar `managed: false` sem informar endpoint impede o processo
  de subir, com mensagem de erro identificável explicando a causa.
- Configurar um valor não reconhecível para `managed` (diferente de
  verdadeiro/falso) impede o processo de subir, com mensagem de erro
  identificável explicando a causa.
- `GET /api/v1/manifest` responde 200 mesmo quando o endpoint
  configurado (gerenciado ou externo) não está de fato acessível —
  nenhuma tentativa de conexão real é feita como parte desta spec.
- Nenhuma regressão no restante do manifesto: `contractVersion`,
  `provider`, `version` e `capabilities` continuam exatamente como
  especificado nas specs 002/005/006.

## Fora do escopo desta spec

- Validação ativa de conectividade com o endpoint configurado (ex.:
  ping ou chamada real ao MiniStack) — isso é papel do health-check
  (specs 006/008), não da declaração de `EnvironmentConfig`.
- Qualquer capability real consumindo esse endpoint para operações de
  fato (Storage é spec 008).
- Qualquer ação de gerenciamento de ciclo de vida (restart/start/stop)
  sobre o MiniStack, gerenciado ou externo — não existe em nenhuma
  spec até aqui, e `managed: false` nunca deve ganhar isso (princípio
  9 da constitution).
- Suporte a environment diferente de MiniStack (LocalStack é
  explicitamente fora do MVP em `docs/product.md`).
- Qualquer exibição ou configuração de environment pela UI (specs 009
  em diante) — esta spec cobre apenas o comportamento do provider e o
  campo `environment` do manifesto.

## Alinhamento com `docs/product.md` e `docs/arquitetura.md`

`docs/product.md` já lista, no escopo do MVP, suporte a "uma instância
já em execução em outro projeto (`managed: false` + `endpoint`
configurável) ou a uma instância gerenciada pelo próprio Docker
Compose do Eventpier (`managed: true`)" — esta spec implementa
exatamente esse item, hoje ausente (o manifesto expõe `environment`
fixo no código). `docs/arquitetura.md` (seção 5) já define o formato
`EnvironmentConfig` e as regras de `managed: true`/`false` que esta
spec segue sem alterar; as variáveis `MINISTACK_ENDPOINT` e
`MINISTACK_MANAGED` já existem em `docker-compose.yml`/`.env.example`
desde a spec 003, mas ainda não são lidas pelo provider — esta spec
fecha essa lacuna. Os princípios 2, 8 e 9 da `memory/constitution.md`
(Provider/Environment distintos; endpoint sempre configurável; sem
ações de ciclo de vida sobre `managed: false`) são o fundamento direto
dos Requisitos Funcionais 1-2, 4-6 e 8. A spec 006 (cache de
health-check) explicitamente adiou `EnvironmentConfig` configurável
para esta spec — ver "Fora do escopo" de `specs/006-cachear-health-
check/spec.md`. Nenhuma seção "Fora do MVP" de `docs/product.md` é
tocada por esta spec.

## Clarificações

- **Configuração inválida/incompleta (fail-fast)**: confirmado com o
  usuário durante esta sessão de `/specify` que `managed: false` sem
  endpoint, ou um valor não reconhecível para `managed`, devem impedir
  o provider de iniciar (fail-fast com mensagem de erro clara), em vez
  de assumir um default seguro silenciosamente. Motivo: evitar que o
  provider suba numa configuração ambígua — especialmente
  `managed: false` sem endpoint, caso em que não há default seguro
  possível (o serviço gerenciado pode nem estar em execução). Reflete-
  se nos Requisitos Funcionais 5 e 6 e nos Critérios de Sucesso
  correspondentes.
- **Visibilidade do endpoint no manifesto**: confirmado que
  `environment.endpoint` deve ser sempre exposto no manifesto com o
  valor efetivo em uso, mesmo quando é o default gerenciado pelo
  Compose — nunca omitido só por ser um default. Motivo: o Eventpier é
  uma ferramenta de inspeção/debug; esconder o endpoint real por ele
  ser "apenas o default" tira do consumidor do manifesto justamente a
  informação que ele mais precisaria para confirmar contra o que está
  operando. Reflete-se no Requisito Funcional 3 e no primeiro Critério
  de Sucesso.
