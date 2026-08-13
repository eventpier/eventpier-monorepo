// Arquivo temporário — spec 013, T002: prova proposital de erro de tipo
// para validar que o required status check bloqueia merge de verdade.
// Este arquivo nunca é mergeado em main; o PR que o introduz é fechado
// sem merge assim que a prova (T006) for confirmada.
const brokenTypeCheck: number = "isto não é um number";
