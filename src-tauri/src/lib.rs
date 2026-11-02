mod commands;
mod domain;
mod error;
mod infra;
mod state;

use tauri::{Manager, WindowEvent};

use infra::audio_engine::AudioHandle;
use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        .setup(|app| {
            // Thread de áudio própria, independente do vídeo e da UI.
            let audio = AudioHandle::spawn(app.handle().clone());
            app.manage(audio);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Fechar o controlador encerra o app inteiro (e os exibidores).
            if window.label() == "main" {
                if let WindowEvent::Destroyed = event {
                    window.app_handle().exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::monitors::list_monitors,
            commands::windows::app_ready,
            commands::windows::open_display_windows,
            commands::windows::close_display_windows,
            commands::windows::set_displays_fullscreen,
            commands::media::register_media,
            commands::display::send_display_command,
            commands::audio::audio_play,
            commands::audio::audio_pause,
            commands::audio::audio_resume,
            commands::audio::audio_stop,
            commands::audio::audio_set_volume,
            commands::audio::audio_set_loop,
        ])
        .run(tauri::generate_context!())
        .expect("erro ao executar a aplicação Tauri");
}
