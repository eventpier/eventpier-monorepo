# Spec 003 — Docker Compose do MVP

## Cenários de Uso

1. Como desenvolvedor(a) validando o vertical slice do MVP (spec 012 em
   diante), preciso subir todos os serviços do Eventpier com um único
   comando, para validar contrato, provider, API, UI e conexão com o
   MiniStack sem orquestração manual de cada peça.
2. Como desenvolvedor(a) que já mantém uma instância própria de
   MiniStack rodando para outro projeto, preciso poder apontar o
   `eventpier-aws` para esse MiniStack externo, sem que o Compose suba
   um MiniStack duplicado e sem conflito de porta.
3. Como mantenedor(a) da segurança da rede local, preciso que apenas os
   serviços que precisam ser alcançados de fora do Eventpier (a UI, e o
   MiniStack quando gerenciado) exponham porta ao host — o provider
   AWS não deve ser alcançável diretamente pelo host.
4. Como desenvolvedor(a) ajustando o TTL do health-check ou o endpoint
   do MiniStack, preciso poder mudar esses parâmetros via variável de
   ambiente, sem editar código do provider nem reconstruir a imagem.
5. Como desenvolvedor(a) clonando o repositório pela primeira vez,
   preciso conseguir rodar o comando de subida do Compose imediatamente
   após o clone, sem depender de nenhuma imagem publicada em registry
   externo — a CI de publicação de imagens (spec 004) ainda não existe
   neste ponto do roadmap.

Esta feature não expõe UI nem fluxo de usuário final — o "usuário" dela
é quem desenvolve ou opera o Eventpier localmente. Os itens do
checklist de fluxos/estados de erro de UI não se aplicam.

## Requisitos Funcionais

1. Deve existir uma única definição de orquestração que sobe três
   serviços: `eventpier-ui`, `eventpier-aws` (provider) e `ministack`
   (environment).
2. `eventpier-ui` e `eventpier-aws` devem ser construídos a partir do
   código-fonte local de cada workspace (`apps/ui`, `providers/aws`)
   — não de uma imagem publicada em registry — já que a publicação de
   imagens (spec 004, CI) ainda não existe neste ponto do roadmap.
3. Deve existir uma rede interna nomeada, compartilhada pelos três
   serviços, isolando a comunicação entre eles do host.
4. Apenas `eventpier-ui` expõe porta ao host entre os serviços do
   próprio Eventpier — `eventpier-aws` não publica nenhuma porta,
   sendo alcançável apenas pela rede interna.
5. O serviço `ministack`, quando gerenciado pelo Eventpier, deve expor
   sua porta ao host, preservando seu propósito de ser um substituto
   drop-in acessível por qualquer SDK externo ao Eventpier, com ou sem
   o restante do Eventpier em execução.
6. A subida do `ministack` pelo Compose deve ser opcional (via
   mecanismo de perfil/flag), permitindo ao desenvolvedor optar por não
   subi-lo e, em vez disso, apontar `eventpier-aws` para uma instância
   de MiniStack já em execução externamente.
7. O endpoint do MiniStack usado por `eventpier-aws` deve ser
   configurável via variável de ambiente, funcionando da mesma forma
   independente do MiniStack estar sendo gerenciado pelo próprio
   Compose ou ser externo.
8. O TTL do cache de health-check do provider deve ser configurável via
   variável de ambiente, sem exigir alteração de código nem rebuild de
   imagem.
9. Subir o conjunto de serviços com um único comando deve deixar o
   ambiente em condição de suportar a validação ponta a ponta descrita
   nas métricas de sucesso de `docs/product.md` (contrato, provider,
   API, UI, Docker, conexão com o emulador e descoberta de
   capabilities) — a validação funcional em si é escopo da spec 012.

## Critérios de Sucesso

- Um(a) desenvolvedor(a) que acabou de clonar o repositório roda o
  comando de subida do Compose com o perfil do MiniStack habilitado, e
  os três serviços sobem com sucesso, sem precisar de nenhuma imagem
  publicada externamente — a UI e o MiniStack ficam acessíveis pelo
  host.
- Um(a) desenvolvedor(a) roda o Compose sem o perfil do MiniStack,
  aponta `eventpier-aws` para um MiniStack externo via variável de
  ambiente, e o provider se conecta normalmente a ele.
- Nenhuma tentativa de acessar `eventpier-aws` diretamente por uma
  porta do host tem sucesso — ele só é alcançável pela rede interna.
- Alterar o TTL do health-check ou o endpoint do MiniStack não exige
  rebuild de imagem — apenas reconfiguração de variável de ambiente e
  reinício do serviço.

## Fora do escopo desta spec

- Implementação do endpoint de manifesto do provider (spec 005).
- Lógica de health-check em si (spec 006) — aqui garante-se apenas que
  o TTL é configurável via variável de ambiente no Compose, não a
  lógica de cache/invalidação.
- Implementação do adapter de Storage (spec 008).
- UI real de consumo do manifesto (specs 009-011).
- Validação funcional ponta a ponta completa do vertical slice (spec
  012) — esta spec entrega a orquestração dos containers; a validação
  funcional plena é spec 012.
- CI com gatilho por path e publicação de imagens (spec 004) — esta
  spec assume build local justamente para não depender dela.

## Alinhamento com `docs/product.md`

A seção "Escopo do MVP" já prevê "Docker Compose com rede interna
nomeada; apenas eventpier-ui expõe porta ao host entre os serviços do
Eventpier — o ministack também expõe porta, pois seu propósito nativo
é ser acessível por qualquer SDK externo ao Eventpier" e o suporte a
`managed: true`/`managed: false` para o environment. Nenhum ponto desta
spec contradiz ou amplia a seção "Fora do MVP" de `docs/product.md` ou
do roadmap.

## Clarificações

- **Origem das imagens de `eventpier-ui` e `eventpier-aws`**: build
  local a partir do Dockerfile de cada workspace (`build:` no lugar de
  `image:` publicada), confirmado explicitamente com o usuário durante
  esta sessão de `/specify`. Motivo: a spec 004 (CI de publicação de
  imagens) ainda não existe nesta fase do roadmap, e depender de uma
  imagem publicada inverteria a ordem de dependência entre as specs 003
  e 004. Este ponto implica que os workspaces `apps/ui` e
  `providers/aws` ganham um Dockerfile como parte da implementação
  desta spec — decisão de estrutura de arquivo, não de arquitetura;
  detalhes de conteúdo do Dockerfile ficam para `/plan`.
