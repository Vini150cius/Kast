use serde::{Deserialize, Serialize};

use super::media_kind::MediaKind;

/// Loop do áudio: desligado, faixa inteira ou trecho [start, end] em ms.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum LoopMode {
    Off,
    Track,
    Segment { start_ms: u64, end_ms: u64 },
}

/// Estilo de transição entre mídias nos exibidores.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TransitionStyle {
    /// A nova mídia surge por cima da antiga.
    Fade,
    /// Troca instantânea.
    Cut,
    /// A antiga some enquanto a nova surge.
    Dissolve,
}

/// Comando enviado do controlador para os exibidores.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum DisplayCommand {
    Show {
        play_id: u64,
        path: String,
        kind: MediaKind,
        loop_playback: bool,
        transition_ms: u32,
        style: TransitionStyle,
    },
    Clear {
        transition_ms: u32,
    },
    /// Congela (pausa) o vídeo atual.
    Freeze {
        frozen: bool,
    },
    /// Cobre a tela com preto sem interromper a mídia.
    Blackout {
        on: bool,
        transition_ms: u32,
    },
    Seek {
        position_ms: u64,
    },
}
