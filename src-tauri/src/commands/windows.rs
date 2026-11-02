use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder,
};

use crate::commands::monitors::collect_monitors;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

fn win_err(e: tauri::Error) -> AppError {
    AppError::Window(e.to_string())
}

/// Chamado pelo Angular quando a interface terminou de carregar:
/// fecha a splash e mostra a janela principal.
#[tauri::command]
pub fn app_ready(app: AppHandle) -> AppResult<()> {
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(win_err)?;
        main.set_focus().map_err(win_err)?;
    }
    if let Some(splash) = app.get_webview_window("splash") {
        splash.close().map_err(win_err)?;
    }
    Ok(())
}

/// Abre uma janela sem bordas cobrindo cada monitor NÃO primário.
/// Sem monitor secundário, abre uma janela de pré-visualização (útil para testes).
#[tauri::command]
pub fn open_display_windows(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<Vec<String>> {
    let monitors = collect_monitors(&app)?;
    let mut opened = Vec::new();

    for m in monitors.iter().filter(|m| !m.is_primary) {
        let label = format!("display-{}", m.index);
        if app.get_webview_window(&label).is_some() {
            opened.push(label);
            continue;
        }

        let window = WebviewWindowBuilder::new(
            &app,
            &label,
            WebviewUrl::App(format!("index.html#/display/{}", m.index).into()),
        )
        .title("Kast - Exibidor")
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true)
        .always_on_top(true)
        .visible(false) // só aparece depois de posicionada
        .build()
        .map_err(win_err)?;

        // set_position + set_size é mais confiável que maximize() em multi-monitor.
        window
            .set_position(PhysicalPosition::new(m.x, m.y))
            .map_err(win_err)?;
        window
            .set_size(PhysicalSize::new(m.width, m.height))
            .map_err(win_err)?;
        window.show().map_err(win_err)?;

        state
            .displays
            .lock()
            .map_err(|_| AppError::StatePoisoned)?
            .insert(label.clone(), m.index);
        opened.push(label);
    }

    if opened.is_empty() {
        let label = "display-preview".to_string();
        if app.get_webview_window(&label).is_none() {
            WebviewWindowBuilder::new(
                &app,
                &label,
                WebviewUrl::App("index.html#/display/preview".into()),
            )
            .title("Kast - Pré-visualização")
            .inner_size(960.0, 540.0)
            .build()
            .map_err(win_err)?;
            state
                .displays
                .lock()
                .map_err(|_| AppError::StatePoisoned)?
                .insert(label.clone(), usize::MAX);
        }
        opened.push(label);
    }

    Ok(opened)
}

#[tauri::command]
pub fn close_display_windows(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
) -> AppResult<()> {
    let mut displays = state.displays.lock().map_err(|_| AppError::StatePoisoned)?;
    for label in displays.keys() {
        if let Some(w) = app.get_webview_window(label) {
            w.close().map_err(win_err)?;
        }
    }
    displays.clear();
    Ok(())
}

/// Alterna tela cheia nas janelas exibidoras (útil na janela de pré-visualização).
#[tauri::command]
pub fn set_displays_fullscreen(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    fullscreen: bool,
) -> AppResult<()> {
    let displays = state.displays.lock().map_err(|_| AppError::StatePoisoned)?;
    for label in displays.keys() {
        if let Some(w) = app.get_webview_window(label) {
            w.set_fullscreen(fullscreen).map_err(win_err)?;
        }
    }
    Ok(())
}
