# Kast: controle multimídia (Tauri + Angular)

Software de Digital Signage para eventos e auditórios. O **Controlador** fica no monitor
principal e comanda janelas **Exibidoras** sem borda nos monitores secundários.
O áudio sai por uma thread dedicada em Rust, independente do vídeo.

## Requisitos
- Node.js 18+ e npm
- Rust (stable) via https://rustup.rs
- Pré-requisitos do Tauri v2: https://v2.tauri.app/start/prerequisites/
  - Windows: WebView2 e Build Tools do Visual Studio (C++)
  - Linux: `libwebkit2gtk-4.1-dev`, `libasound2-dev` e demais itens da página acima

## Rodando
```bash
npm install
npm run tauri dev        # desenvolvimento
npm run tauri build      # instalador
cargo test --manifest-path src-tauri/Cargo.toml   # testes da validação de caminhos
```
Com um único monitor, "Abrir exibidores" cria uma janela de pré-visualização (960x540).

## Atalhos
F8 tela preta · F11 abrir/fechar exibidores · Ctrl+O adicionar arquivos

## O que cada botão faz
- **Congelar**: pausa o vídeo no frame atual e segura o avanço automático.
- **Modo Seguro**: bloqueia remover, limpar, reordenar, trocar fallback e exibir direto da lista.
- **Tela Preta**: cobre a saída sem parar a mídia por baixo; ligar de novo libera.
- **Contador regressivo**: clique no relógio para escolher minutos, iniciar, pausar e zerar.
- **Tela Cheia**: alterna tela cheia nas janelas de exibição.
- **Transição**: duração e estilo (fade suave, corte seco, cross-dissolve).
- **Cena de fundo**: imagem exibida ao fim da fila ou ao parar.
- **Áudio**: fila, crossfade automático, volume, VU real, loop (faixa, fila inteira ou trecho).
- **Recarregar** (biblioteca): revalida os arquivos no disco e marca os ausentes.
- **Configurações**: padrões de imagem, transição, crossfade e volume (salvos).

## Estrutura
```
src/app/core/{models,ports,adapters,services}   Angular: contratos, Tauri e estado (BehaviorSubject)
src/app/features/{controller,display,splash}    telas
src-tauri/src/domain                            regras puras (path_validator, media_kind, playback)
src-tauri/src/infra/audio_engine.rs             thread de áudio (rodio)
src-tauri/src/commands                          camada IPC fina
```

## Segurança
`register_media` valida cada caminho (absoluto, sem `..`, existe, é arquivo, extensão permitida),
resolve symlinks e registra numa allowlist; só então libera aquele arquivo no `assetProtocol`
(escopo inicial vazio). `audio_play` e `send_display_command` revalidam contra a allowlist.
O front guarda só paths; o exibidor descarta o vídeo anterior (`removeAttribute('src')` + `load()`).

## Limitações
- Sem arrastar da biblioteca para as filas (o drop nativo do Tauri desativa o DnD HTML5 no Windows): use o botão +.
- Áudio: mp3, wav, flac, ogg. Duração de áudio/vídeo depende de o WebView ler os metadados.
- Crossfade automático exige duração conhecida da faixa.
- Desligar o loop com a faixa tocando deixa a repetição já enfileirada terminar.
- Remover da biblioteca não revoga o asset protocol até fechar o app.
