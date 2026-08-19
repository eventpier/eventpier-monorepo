# Spec 005 — Endpoint de Manifesto (`GET /api/v1/manifest`)

## Cenários de Uso

1. Como desenvolvedor(a) da UI (Eventpier), preciso fazer uma
   requisição HTTP ao provider AWS e receber de volta um manifesto que
   descreve quem é esse provider, qual environment ele expõe e quais
   capabilities estão disponíveis — sem precisar conhecer nenhum
   detalhe interno do provider ou do emulador por trás dele.
2. Como desenvolvedor(a) validando a integração `eventpier-ui` ↔
   `providers/aws` pela primeira vez (spec 009, ainda não implementada),
   preciso que o provider já responda de forma previsível e
   padronizada no endpoint de manifesto, mesmo antes de qualquer
   capability real (Storage) existir — para poder construir e testar o
   consumo do manifesto na UI independentemente do restante da Fase 2.
3. Como mantenedor(a) do provider, ao evoluir o contrato de forma
   aditiva (princípio 4 da constitution), preciso que o endpoint
   continue respondendo de forma compatível com consumidores que ainda
   esperam o formato anterior do manifesto.
4. Como desenvolvedor(a) investigando um problema de integração,
   preciso que uma requisição malformada ou um método HTTP incorreto
   nesse endpoint retorne um erro claro e padronizado, não um
   comportamento silencioso ou uma resposta ambígua.

Esta feature não expõe UI própria — o "usuário" direto do endpoint é a
UI do Eventpier (consumidora HTTP) e quem desenvolve/mantém o
provider. Os itens do checklist de fluxos visuais de UI não se
aplicam; os equivalentes aqui são "resposta esperada" e "resposta de
erro" da API.

## Requisitos Funcionais

1. O provider AWS deve expor um endpoint HTTP `GET /api/v1/manifest`
   que retorna o manifesto do provider no formato já definido pelo
   contrato compartilhado (`ProviderManifest`, spec 002/`packages/contracts`),
   contendo: versão do contrato, identificação do provider (`aws`),
   identificação do environment, versão do provider e a lista de
   capabilities.
2. O campo `provider` do manifesto deve identificar de forma fixa este
   provider como AWS (`id`/`name`), já que este provider só existe
   para representar a cloud AWS.
3. O campo `environment` do manifesto deve declarar, nesta spec,
   valores fixos consistentes com o único environment previsto para o
   MVP (MiniStack) e `managed: true` — configuração real de endpoint
   externo/`managed: false` é escopo da spec 007 e não é implementada
   aqui (ver "Fora do escopo").
4. O campo `capabilities` do manifesto deve retornar uma lista vazia
   nesta spec — nenhuma capability real está implementada ainda
   (Storage é spec 008, health-check com cache é spec 006). Uma lista
   vazia comunica corretamente "nenhuma capability implementada",
   distinto de "capability implementada mas indisponível agora"
   (princípio 5 da constitution).
5. O endpoint deve responder com sucesso (HTTP 200) e o corpo do
   manifesto em todas as requisições `GET` válidas ao path, sem exigir
   nenhum parâmetro de entrada, corpo de requisição ou autenticação
   (princípio 10 da constitution — sem autenticação em ambientes
   locais).
6. Uma requisição a este endpoint com método HTTP diferente de `GET`
   (ex.: `POST`, `PUT`, `DELETE`) deve retornar um erro HTTP claro de
   método não permitido, não uma resposta de sucesso nem um erro
   genérico.
7. Uma requisição a um path diferente de `/api/v1/manifest` no
   provider deve continuar retornando um erro de recurso não
   encontrado — este endpoint não deve alterar o comportamento do
   provider para paths não relacionados.
8. O manifesto retornado deve ser válido de acordo com o contrato
   compartilhado vigente (`contractVersion` atual do pacote
   `packages/contracts`) no momento da resposta — o provider nunca
   retorna um manifesto desalinhado com a versão do contrato que ele
   de fato importa.
9. Este endpoint substitui integralmente o placeholder HTTP mínimo
   introduzido pela spec 003 (`providers/aws/src/index.ts`) — após
   esta spec, o provider não deve mais responder com o texto de
   placeholder em nenhum path.

## Critérios de Sucesso

- Uma requisição `GET /api/v1/manifest` ao provider AWS em execução
  retorna HTTP 200 com um corpo JSON contendo `contractVersion`,
  `provider`, `environment`, `version` e `capabilities` (lista vazia),
  no formato exato do contrato compartilhado.
- O corpo retornado é validável programaticamente contra os tipos de
  `packages/contracts` (`ProviderManifest`) sem exigir nenhum campo
  extra não previsto no contrato nem omitir nenhum campo obrigatório.
- Uma requisição com método diferente de `GET` a `/api/v1/manifest`
  retorna um erro HTTP (não um manifesto), com um `ProviderError`
  estruturado no corpo, consistente com o restante do contrato.
- O placeholder da spec 003 não é mais alcançável em nenhum path do
  provider após esta spec.
- Rodando `docker compose up`, o provider AWS responde corretamente
  neste endpoint sem exigir nenhuma configuração adicional além do que
  já existe hoje no Compose (spec 003) — validando que o vertical
  slice consegue avançar incrementalmente antes das specs 006-008
  existirem.

## Fora do escopo desta spec

- Health-check real de qualquer capability e seu cache em memória
  (spec 006) — não há capability real para checar ainda, então o
  campo `capabilities` é sempre uma lista vazia nesta spec.
- `EnvironmentConfig` configurável (endpoint externo customizado,
  alternância `managed: true`/`false`) — o campo `environment` é fixo
  nesta spec; configurabilidade real é spec 007.
- Qualquer capability real, incluindo Storage (spec 008) — este
  endpoint não expõe listagem de buckets, objetos ou qualquer dado do
  MiniStack, apenas o manifesto descritivo do provider.
- Consumo do manifesto pela UI (spec 009) — esta spec cobre somente o
  lado do provider que expõe o endpoint, não quem o consome.
- Autenticação entre UI e provider — fora de escopo enquanto o
  ambiente for local (princípio 10 da constitution, já registrado como
  fora do MVP em `docs/product.md`).
- Versionamento/depreciação de uma versão anterior do contrato — não
  se aplica ainda, pois esta é a primeira versão do endpoint.

## Alinhamento com `docs/product.md` e `docs/arquitetura.md`

`docs/product.md` já lista o "Contrato mínimo entre UI e provider"
(`ProviderManifest`, `CapabilityDescriptor`, `Page<T>`, `ProviderError`)
como parte explícita do escopo do MVP — esta spec é a primeira a expor
esse contrato via HTTP real, dando sequência ao que `packages/contracts`
(spec 002) definiu apenas como tipos. `docs/arquitetura.md` (seção 3)
já especifica o formato exato do `ProviderManifest` implementado em
`packages/contracts/src/manifest.ts`; esta spec não introduz nenhum
campo novo, apenas expõe o manifesto já contratado via
`GET /api/v1/manifest`. Nenhuma seção "Fora do MVP" de `docs/product.md`
é tocada por esta spec.

## Clarificações

- **Campo `capabilities` nesta spec**: confirmado explicitamente com o
  usuário durante esta sessão de `/specify` que o manifesto retorna
  `capabilities: []` (lista vazia) nesta spec, já que nenhuma
  capability real está implementada ainda (Storage é spec 008,
  health-check é spec 006). Motivo: uma lista vazia comunica
  corretamente "provider não implementa capability nenhuma ainda",
  distinto de "capability implementada mas indisponível agora"
  (princípio 5 da constitution) — evita declarar uma capability como
  `unavailable` por um motivo que não é falha de ambiente, mas
  ausência de implementação. Reflete-se no requisito funcional 4 e no
  primeiro item de "Fora do escopo".
- **Campo `environment` nesta spec**: confirmado explicitamente com o
  usuário que o manifesto retorna valores fixos (`id: "ministack"`,
  `managed: true`, sem `endpoint` customizável) nesta spec, já que
  `EnvironmentConfig` configurável é escopo da spec 007. Motivo: evita
  antecipar configurabilidade antes de sua spec própria existir,
  mantendo o escopo desta spec restrito ao endpoint em si. Reflete-se
  no requisito funcional 3 e no segundo item de "Fora do escopo".
