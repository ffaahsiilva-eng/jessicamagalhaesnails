# Corrigir falha persistente no iOS

## O que será feito
- Corrigir uma chamada de inicialização que não é suportada por algumas versões do Safari e pode interromper a página.
- Impedir que a prévia registre ou reutilize arquivos offline antigos.
- Manter o modo instalável/offline apenas no site publicado, com atualização segura e navegação sempre buscando a versão atual primeiro.
- Testar a página e o agendamento em tamanhos de iPhone, iPad e desktop.

## Detalhes técnicos
- Usar fallback compatível quando `requestIdleCallback` não existir.
- Centralizar o registro do service worker com bloqueio para desenvolvimento, prévias, iframes e `?sw=off`.
- Configurar `injectRegister: null`, `devOptions.enabled: false`, navegação `NetworkFirst` e exclusão de `/~oauth`.
- Confirmar compilação, ausência de erros de execução e abertura do agendamento nas telas testadas.
