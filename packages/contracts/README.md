# @eventpier/contracts

Contrato compartilhado entre `apps/ui` e `providers/*`
(`ProviderManifest`, `CapabilityDescriptor`, `Page<T>`,
`ProviderError`) — vive em pacote próprio porque atravessa a
fronteira UI↔Provider (constitution, princípio 13). Versionado via
`contractVersion`, evoluindo por padrão de forma aditiva (princípio
4).

## CI

Uma mudança aqui também dispara republish de todo provider que
consome este pacote (hoje: `providers/aws`) — nunca deixa uma imagem
publicada com um contrato desatualizado. Ver
`specs/004-configurar-ci-path-providers/`.

## Build

```bash
pnpm --filter @eventpier/contracts build
```
