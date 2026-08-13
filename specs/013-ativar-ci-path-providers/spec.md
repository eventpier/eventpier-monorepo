# Spec 013 — Ativação Operacional do CI (follow-ups da spec 004)

## Contexto

A spec 004 entregou o código dos workflows de CI (`ci.yml`,
`publish-provider-aws.yml`) e foi mergeada em `main` (PR #6). Quatro
follow-ups ficaram documentados como pendentes naquele momento —
ações de configuração de repositório/organização e verificações que
não podem ser feitas por código de workflow nem por `GITHUB_TOKEN`
(ver `specs/004-configurar-ci-path-providers/research.md`, Decisões 5
e 8, e `review-pr-6.md`). Esta spec trata desses quatro itens como
feature própria — sem eles, o CI da spec 004 está "implementado" mas
não "operacional": nada garante hoje que o merge é de fato bloqueado
por gate quebrado, nem que a primeira publicação real funciona.

## Cenários de Uso

1. Como mantenedor(a) solo do repositório, preciso que um Pull Request
   com o job de validação (`ci.yml`) quebrado seja estruturalmente
   impedido de ser mergeado em `main` — hoje o job roda e reporta
   status, mas nada no GitHub impede um merge manual mesmo com ele
   falho.
2. Como mantenedor(a), preciso que a primeira publicação real da
   imagem do provider AWS no GHCR (disparada por um push legítimo)
   complete com sucesso — essa capacidade nunca foi exercitada de
   verdade, só desenhada.
3. Como desenvolvedor(a) externo(a) (ou eu mesmo, de outra máquina)
   tentando `docker pull ghcr.io/eventpier/eventpier-aws`, preciso que
   a imagem esteja acessível sem autenticação — hoje ela nasce
   privada por padrão do GHCR, independente do repositório ser
   público.
4. Como mantenedor(a) confiando no desenho da spec 004, preciso de
   confirmação real — não apenas teórica — de que: um PR tocando só
   `apps/ui/**` não publica nada; um merge tocando `providers/aws/**`
   publica; um merge tocando só `packages/contracts/**` também
   publica; e a imagem publicada é rastreável ao commit que a
   originou.

Esta feature não expõe UI nem fluxo de usuário final — o "usuário" é
quem mantém o Eventpier. Os itens do checklist de fluxos/estados de
erro de UI não se aplicam.

## Requisitos Funcionais

1. Um Pull Request contra `main` cujo job de validação (`ci.yml`)
   falhe deve ficar estruturalmente impedido de ser mergeado — o
   GitHub deve recusar o merge, não apenas exibir o status como
   falho.
2. A primeira execução real de `publish-provider-aws.yml`, disparada
   por um push legítimo que toque `providers/aws/**` e/ou
   `packages/contracts/**`, deve completar com sucesso — sem falhar
   por restrição de permissão de criação de pacote da organização.
3. A imagem `ghcr.io/eventpier/eventpier-aws` deve poder ser baixada
   (`docker pull`) por qualquer pessoa, sem autenticação, a partir da
   primeira publicação bem-sucedida.
4. Deve haver confirmação registrada, com evidência real de execução
   (não suposição de design), de que:
   - um PR tocando somente `apps/ui/**` não dispara nenhuma
     publicação de imagem;
   - um merge em `main` tocando `providers/aws/**` dispara
     publicação;
   - um merge em `main` tocando somente `packages/contracts/**`
     também dispara publicação;
   - a tag da imagem publicada é rastreável ao commit de `main` que a
     originou.
5. Nenhuma ação desta spec deve exigir credencial nova além do que já
   está disponível para o mantenedor (sessão já autenticada) — não
   introduzir PAT ou segredo adicional só para isso.

## Critérios de Sucesso

- Um PR de teste com um erro de tipo proposital (ex.: quebra de
  `tsc --noEmit`) não consegue ser mergeado em `main` enquanto o job
  de validação não passar — confirmado na prática, com o botão de
  merge do GitHub de fato desabilitado, não apenas inferido da
  configuração.
- `docker pull ghcr.io/eventpier/eventpier-aws:latest` funciona de uma
  sessão sem nenhuma autenticação prévia com o GHCR.
- Os quatro comportamentos do Requisito Funcional 4 estão confirmados
  com link/evidência de execução real do GitHub Actions (não apenas
  "deveria funcionar porque o gatilho está configurado assim").

## Fora do escopo desta spec

- Qualquer mudança no conteúdo de `ci.yml`/`publish-provider-aws.yml`
  além do estritamente necessário para satisfazer os requisitos acima
  — a spec 004 já entregou o desenho desses workflows; se a
  verificação revelar um defeito real neles (não apenas uma
  configuração externa faltando), isso vira débito técnico tratado à
  parte (`/specify-tech`), não escopo desta spec.
- Qualquer processo de release/versionamento semântico formal por
  provider — já fora do escopo da spec 004 (rastreabilidade por
  commit é suficiente), continua fora aqui.
- Provider Azure/GCP, LocalStack, autenticação real entre
  UI/providers — já fora do MVP conforme `docs/product.md`.

## Alinhamento com `docs/product.md`

Nenhuma seção "Fora do MVP" de `docs/product.md` é tocada por esta
spec — ela trata de tornar operacional uma capacidade de
infraestrutura (CI) já dentro do escopo do MVP, não de introduzir
capability nova de produto.

## Clarificações

Nenhuma pergunta de clarificação foi necessária: os quatro requisitos
descrevem estados observáveis e testáveis (merge bloqueado, imagem
pública, gatilho confirmado) sem depender de nenhuma decisão de
produto em aberto. A forma exata de atingir cada requisito (via `gh
api`/CLI automatizável pelo mantenedor, ou passo manual na UI do
GitHub) é decisão técnica, não de produto — fica para `/plan`.
