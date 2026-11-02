use tauri::{AppHandle, Emitter};

use crate::domain::playback::DisplayCommand;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

/// Valida o caminho contra a allowlist e repassa o comando a todos os exibidores.
#[tauri::command]
pub fn send_display_command(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    command: DisplayCommand,
) -> AppResult<()> {
    let command = match command {
        DisplayCommand::Show { play_id, path, kind, loop_playback, transition_ms, style } => {
            let safe = state.ensure_registered(&path)?;
            DisplayCommand::Show {
                play_id,
                path: safe.to_string_lossy().into_owned(),
                kind,
                loop_playback,
                transition_ms: transition_ms.min(10_000),
                style,
            }
        }
        DisplayCommand::Clear { transition_ms } => {
            DisplayCommand::Clear { transition_ms: transition_ms.min(10_000) }
        }
        DisplayCommand::Blackout { on, transition_ms } => {
            DisplayCommand::Blackout { on, transition_ms: transition_ms.min(10_000) }
        }
        other @ (DisplayCommand::Freeze { .. } | DisplayCommand::Seek { .. }) => other,
    };

    let labels: Vec<String> = state
        .displays
        .lock()
        .map_err(|_| AppError::StatePoisoned)?
        .keys()
        .cloned()
        .collect();

    for label in labels {
        // Janela já fechada pelo usuário: ignora.
        let _ = app.emit_to(label.as_str(), "display://command", &command);
    }
    Ok(())
}
