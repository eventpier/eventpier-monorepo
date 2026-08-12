# Log de Decisões — Eventpier

Registro cronológico e agregado de decisões técnicas e de produto que
emergiram durante a implementação de specs — principalmente as que
**não** estavam previstas no `/plan` original (edge case descoberto na
hora, biblioteca que não se comportou como esperado, desvio consciente
do plano).

Diferente de `roadmap.md` (status, escaneável, uma linha por spec —
lido toda vez que `/specify` ou `/pipeline-status` roda), este arquivo
é de **leitura ocasional**: consulte quando precisar de contexto
histórico, ou periodicamente para revisar se algum padrão recorrente
merece virar princípio formal em `ARQUIVO_REGRAS`. Não é lido
automaticamente por nenhum comando do pipeline durante a execução
normal — só quando explicitamente pedido.

Cada spec concluída ganha uma entrada, adicionada pelo `/review-pr`
(Etapa 8, pós-merge). Decisões antecipadas no planejamento (o caso
comum) já ficam documentadas no `research.md` da própria spec — só
repita aqui o que for relevante além do que já está lá, ou um resumo
de 1 linha com link/referência se quiser evitar duplicação.

---

## <NNN>-<slug> — <título curto> (AAAA-MM-DD)

- <decisão 1, 1-2 frases, com o porquê>
- <decisão 2>

<!-- Exemplo (apagar ao usar):
## 017-user-auth — Autenticação de usuário (2026-08-08)

- Optamos por refresh token rotativo em vez de token de vida longa,
  após o Critic (software-dev-panel) apontar risco de replay em
  ambiente sem HTTPS obrigatório em dev. Ver research.md da spec para
  as alternativas consideradas e rejeitadas.
- A biblioteca X não suportava o fluxo Y nativamente durante o
  /implement; workaround aplicado em infrastructure/auth/. Se esse
  mesmo problema aparecer em outra spec, considerar abstrair como
  serviço compartilhado em vez de repetir o workaround.
-->

---

## Como revisar

Periodicamente (sugestão: a cada 5-10 specs concluídas, ou quando o
arquivo passar de uma tela de altura), releia as entradas e pergunte:
algum padrão aparece mais de uma vez? Se sim, é candidato a virar
princípio formal em `ARQUIVO_REGRAS`, em vez de continuar sendo
"lembrado" spec a spec neste log.

Depois de promover um padrão para `ARQUIVO_REGRAS`, as entradas antigas
que o originaram podem ficar como estão (histórico) — não é necessário
apagar ou reescrever o log.
