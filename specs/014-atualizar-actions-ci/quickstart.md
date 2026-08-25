# Quickstart — Validação manual (014)

Passos para confirmar, na prática, que a depreciação foi resolvida e
que nada mais quebrou.

## 1. Validação estrutural local

```bash
node scripts/validate-ci-workflow-shape.mjs
```

Esperado: `OK — forma dos workflows de CI bate com contracts/ci-workflow-shape.md`
(saída inalterada — o script continua genérico, só ganhou mais
chamadas à mesma função).

## 2. Confirmar ausência de `node20`/tag mutável nos workflows

```bash
grep -n "actions/checkout@v\|actions/setup-node@v" .github/workflows/*.yml
```

Esperado: nenhuma ocorrência (as duas actions agora são referenciadas
por SHA, não por tag `@vN`).

## 3. Regressão do gate (opcional, mas recomendado)

Reverter temporariamente uma das duas linhas para a tag antiga
(`actions/checkout@v7.0.1` sem SHA, por exemplo) e rodar novamente o
script do passo 1 — deve **falhar**, confirmando que
`checkPinnedBySha` está de fato cobrindo a action nova (não só
presente no arquivo, mas exercitada). Desfazer a reversão antes de
commitar.

## 4. Confirmação real via PR

1. Abrir um Pull Request de teste contra `main` (qualquer mudança
   trivial que dispare `ci.yml`).
2. Abrir a run do job `validate` no GitHub Actions.
3. Checar a aba "Annotations" (ou o resumo da run) — não deve aparecer
   "Node.js 20 is deprecated. The following actions target Node.js 20...".
4. Confirmar que o job `validate` ainda completa com sucesso (mesmo
   comportamento funcional de antes — só o pin mudou).
5. Fechar o PR de teste sem merge, a menos que já seja o PR real desta
   spec.

## 5. `publish-provider-aws.yml` (verificação adiada, não bloqueante)

Este workflow só dispara em `push` para `main` tocando
`providers/aws/**` ou `packages/contracts/**` — não há como forçar uma
run de teste sem esse gatilho real (e forçar um push desnecessário só
para testar seria fora do escopo). A validação estrutural do passo 1
já cobre sua forma; a confirmação de execução real acontece
organicamente no próximo push legítimo que toque um desses paths
(mesmo padrão de verificação adiada usado em
`specs/013-ativar-ci-path-providers/data-model.md`, requisito FR2).
