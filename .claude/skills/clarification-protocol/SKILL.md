---
name: clarification-protocol
description: Protocolo padrão para levantar e resolver lacunas de especificação (funcional ou técnica) com o mínimo de fricção. Use sempre que precisar perguntar ao usuário algo para completar um spec.md — seja em /specify (produto) ou /specify-tech (técnico) — respeitando o limite de perguntas configurado no projeto.
---

# Protocolo de Clarificação

Objetivo: resolver lacunas de especificação com o mínimo de perguntas
possível, sem sacrificar qualidade. Este protocolo é o mesmo para
lacunas de produto (`/specify`) e lacunas técnicas (`/specify-tech`) —
só muda o *conteúdo* das perguntas, não o *processo*.

## Antes de perguntar

Verifique se a lacuna tem um default razoável de mercado ou de
convenção técnica comum. Se tiver, **não pergunte** — documente o
default assumido na seção de Pressupostos/Impacto do artefato e siga
em frente.

Exemplos de coisas que normalmente têm default razoável:
- Retenção de dados padrão do domínio
- Mensagens de erro amigáveis ao usuário
- Autenticação convencional (sessão ou OAuth2 para apps web)
- Formato de erro HTTP padrão (4xx para erro de cliente, 5xx para erro
  de servidor)

## Ao perguntar

Respeite o limite definido em `MAX_PERGUNTAS_CLARIFICACAO`
(`.pipeline/config.md`) para a sessão inteira — não por comando.

Para cada pergunta:

1. Apresente sua recomendação primeiro, com justificativa em 1 frase:
   ```
   **Recomendado:** <opção> — <motivo em uma frase>
   ```
2. Ofereça 2-4 alternativas em tabela markdown:

   | Opção | Descrição |
   |-------|-----------|
   | A | ... |
   | B | ... |
   | C | ... |

3. Aceite as respostas `"sim"` ou `"recomendado"` como atalho para a
   opção sugerida — não force o usuário a repetir a opção por extenso.
4. Se a resposta do usuário não mapear claramente para uma opção,
   peça uma única disambiguação rápida antes de seguir (isso não conta
   como uma nova pergunta para o limite).

## Se o limite for atingido antes de resolver tudo

Marque as lacunas restantes diretamente no artefato:
- Lacuna de produto/negócio → `[PRECISA ESCLARECIMENTO: pergunta
  específica]`
- Lacuna técnica/causa raiz → `[PRECISA INVESTIGAÇÃO: o que precisa
  ser investigado]`

Reporte ao usuário, ao final, quantas lacunas ficaram marcadas e
sugira se elas devem ser resolvidas antes de avançar para a próxima
fase do pipeline ou se podem ser resolvidas durante o `/plan`.

## Regra de ouro

Nunca faça duas perguntas de baixo impacto quando uma única pergunta de
alto impacto ainda estiver pendente. Priorize por: escopo > segurança/
privacidade > experiência do usuário > detalhe técnico.
