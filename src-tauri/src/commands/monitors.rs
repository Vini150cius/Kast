use serde::Serialize;
use tauri::{AppHandle, Manager, Monitor};

use crate::error::{AppError, AppResult};

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub index: usize,
    pub name: Option<String>,
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
    /// Monitor do Controlador (onde a janela principal está), não necessariamente o primário do SO.
    pub is_primary: bool,
}

type MonitorKey = (i32, i32, u32, u32);

fn key_of(m: &Monitor) -> MonitorKey {
    (m.position().x, m.position().y, m.size().width, m.size().height)
}

/// Descobre qual monitor pertence ao Controlador. Ordem de preferência:
/// 1) monitor onde a janela "main" está agora; 2) monitor primário do SO;
/// 3) primeiro da lista. `primary_monitor()` pode devolver `None` (ex.: Linux/Wayland)
/// e a janela principal pode estar oculta, por isso há fallbacks.
fn controller_key(app: &AppHandle, monitors: &[Monitor]) -> Option<MonitorKey> {
    let keys: Vec<MonitorKey> = monitors.iter().map(key_of).collect();
    [
        app.get_webview_window("main")
            .and_then(|w| w.current_monitor().ok().flatten()),
        app.primary_monitor().ok().flatten(),
        monitors.first().cloned(),
    ]
    .into_iter()
    .flatten()
    .map(|m| key_of(&m))
    .find(|k| keys.contains(k))
}

pub fn collect_monitors(app: &AppHandle) -> AppResult<Vec<MonitorInfo>> {
    let monitors = app
        .available_monitors()
        .map_err(|e| AppError::Monitor(e.to_string()))?;
    let controller = controller_key(app, &monitors);

    let list: Vec<MonitorInfo> = monitors
        .iter()
        .enumerate()
        .map(|(index, m)| MonitorInfo {
            index,
            name: m.name().cloned(),
            x: m.position().x,
            y: m.position().y,
            width: m.size().width,
            height: m.size().height,
            scale_factor: m.scale_factor(),
            is_primary: Some(key_of(m)) == controller,
        })
        .collect();

    // Diagnóstico: aparece no terminal do `npm run tauri dev`.
    eprintln!("[kast] {} monitor(es) detectado(s)", list.len());
    for m in &list {
        eprintln!(
            "[kast]   #{} {:?} pos=({}, {}) {}x{} escala={} controlador={}",
            m.index, m.name, m.x, m.y, m.width, m.height, m.scale_factor, m.is_primary
        );
    }
    Ok(list)
}

/// Mapeia todos os monitores conectados (winit, exposto pelo Tauri).
#[tauri::command]
pub fn list_monitors(app: AppHandle) -> AppResult<Vec<MonitorInfo>> {
    collect_monitors(&app)
}
