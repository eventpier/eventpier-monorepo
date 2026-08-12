# Comando: Docs Sync

Atualiza a documentação viva de domínio/funcionalidade
(`DOCS_FEATURES_DIR`) com o que uma spec concluída mudou. Não gera os
artefatos completos do `software-dev-panel` (DFD, diagramas, plano de
manutenção etc.) — mantém só o doc do domínio afetado em dia, de forma
**incremental**, nunca regenerando o arquivo inteiro do zero.

## Configuração

Leia `.pipeline/config.md` para obter `DOCS_FEATURES_DIR`, `ESTADO_DIR`
e `SPECS_DIR`. Se `DOCS_FEATURES_DIR` estiver vazio, informe ao usuário
que a documentação viva não está configurada neste projeto e encerre
sem erro.

## Quando é chamado

- Automaticamente pelo `/review-pr`, Etapa 8 (pós-merge)
- Manualmente a qualquer momento: `/docs-sync <slug-da-feature>`

## Entrada

```text
$ARGUMENTS
```

Slug ou número da feature. Se ausente, use a feature ativa em
`<ESTADO_DIR>/*.json` cujo `current_phase` seja `done` mais recente.

---

## Execução

### 1. Identificar o tipo de spec e o domínio afetado

- Leia `<ESTADO_DIR>/<slug>.json` → `feature_dir`.
- Determine o tipo pela estrutura de `spec.md`: seções
  "Problema"/"Comportamento Atual vs. Esperado" indicam spec técnica
  (via `/specify-tech`, provavelmente bug fix); seções "Cenários de
  Uso"/"Requisitos Funcionais" indicam spec de produto (via
  `/specify`, provavelmente feature nova).
- Identifique o(s) domínio(s) afetado(s): olhe `data-model.md` e
  `contracts/` da feature (entidades e endpoints tocados costumam
  indicar o módulo). Se não for possível inferir com confiança,
  pergunte ao usuário qual arquivo em `DOCS_FEATURES_DIR` atualizar.

### 2. Atualizar (ou criar) o doc de domínio

Para cada domínio afetado, em `DOCS_FEATURES_DIR/<dominio>.md`:

- **Se o arquivo não existir**: crie usando a estrutura de
  `docs/features/_template.md` (seções: O que o módulo faz,
  Comportamentos-chave, Contrato de API, Limitações conhecidas, Specs
  Relacionadas).
- **Se existir**:
  - **Spec de produto** (feature nova): adicione ou atualize a seção
    "Comportamentos-chave e regras de negócio" com o que foi
    introduzido. Não reescreva seções não afetadas.
  - **Spec técnica** (bug fix): corrija o texto da seção que descrevia
    o comportamento incorretamente. Se o bug estava listado em
    "Limitações conhecidas", remova a entrada — não deixe limitação
    "fantasma" depois de corrigida.

### 3. Registrar na tabela "Specs Relacionadas"

Adicione uma linha **no topo** da tabela (mais recente primeiro):

```
| <NNN> | [<NNN>-<slug>](<caminho relativo para SPECS_DIR>/<NNN>-<slug>/) | <✨ Feature ou 🐛 Bug fix> | <resumo em 1 linha> | <data de hoje> |
```

### 4. Verificação de recorrência (só para bug fix)

Se a spec sendo sincronizada for um bug fix, verifique se já existem
outras entradas 🐛 Bug fix na mesma tabela **antes** desta. Se houver
uma ou mais, e o resumo indicar área/sintoma semelhante, adicione uma
nota logo abaixo da tabela:

```
> ⚠ Possível padrão recorrente: ver também <NNN-slug-anterior>. Se
> este for o segundo ou terceiro bug fix na mesma área, considere
> revisar se a causa raiz real ainda não foi endereçada.
```

---

## Checklist de conclusão (gate)

- [ ] Domínio(s) afetado(s) identificado(s) corretamente
- [ ] Atualização foi incremental — não regenerou o documento inteiro
- [ ] Linha nova adicionada em "Specs Relacionadas", no topo, com link
      relativo correto
- [ ] Se bug fix: limitação/comportamento incorreto anterior foi
      removido ou corrigido no texto, não apenas anotado como resolvido
- [ ] Se houver padrão recorrente detectado (Passo 4), nota adicionada

---

## Fechamento

```bash
git add <DOCS_FEATURES_DIR>/<dominio>.md
git commit -m "docs(<dominio>): sync from <slug>"
```

Reporte ao usuário quais documentos de domínio foram atualizados e se
algum padrão recorrente foi sinalizado.
