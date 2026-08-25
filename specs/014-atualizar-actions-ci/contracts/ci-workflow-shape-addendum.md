# Contrato (addendum) — Forma dos Workflows de CI após 014

Este arquivo **não substitui**
`specs/004-configurar-ci-path-providers/contracts/ci-workflow-shape.md`
— aquele continua sendo o registro histórico correto do estado
definido pela spec 004. Este addendum documenta apenas o *diff* de
forma que esta spec introduz, como referência normativa para
`/tasks`/`/implement`.

## `.github/workflows/ci.yml` — steps afetados

```yaml
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

      - name: Setup Node
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: "24"
```

Todo o restante de `ci.yml` (trigger, concurrency, permissions, demais
steps) permanece exatamente como está — ver `spec.md`, "Fora do
escopo desta spec".

## `.github/workflows/publish-provider-aws.yml` — step afetado

```yaml
      - name: Checkout
        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
```

Todo o restante de `publish-provider-aws.yml` (trigger, path filter,
permissions, `docker/login-action`, `docker/build-push-action`, tags)
permanece exatamente como está.

## `scripts/validate-ci-workflow-shape.mjs` — chamadas novas

Adicionar, respeitando a estrutura de blocos já existente no arquivo
(bloco `--- ci.yml ---` e bloco `--- publish-provider-aws.yml ---`,
ver `research.md`, Decisão 3):

```js
// bloco ci.yml, antes de checkNoSecretsBeyondGithubToken(CI_PATH, ciContent);
checkPinnedBySha(CI_PATH, ciContent, "actions/checkout");
checkPinnedBySha(CI_PATH, ciContent, "actions/setup-node");

// bloco publish-provider-aws.yml, junto das chamadas existentes de checkPinnedBySha
checkPinnedBySha(PUBLISH_PATH, publishContent, "actions/checkout");
```

## Validação esperada (para `/tasks` gerar tasks testáveis)

- `ci.yml` e `publish-provider-aws.yml` não contêm mais nenhuma
  ocorrência de `actions/checkout@v4` nem `actions/setup-node@v4`
  (busca textual simples).
- `actions/checkout` e `actions/setup-node`, em todo lugar onde
  aparecem, são referenciados por um SHA de 40 caracteres hexadecimais
  seguido de `# vX.Y.Z`.
- `node scripts/validate-ci-workflow-shape.mjs` termina com exit code
  0 e a nova cobertura (`checkPinnedBySha` para as duas actions) está
  de fato exercitada — i.e., se alguém reverter o pin para `@v7` (tag),
  o script deve falhar com a mesma mensagem já usada para
  `docker/login-action`/`docker/build-push-action` (achado do review
  da PR #6), só trocando o nome da action na mensagem de erro.
- Uma execução real de `ci.yml` (run do GitHub Actions) não contém a
  anotação "Node.js 20 is deprecated" — verificação manual, não
  automatizável pelo script (ver `quickstart.md`).
