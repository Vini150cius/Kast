use serde::Serialize;
use tauri::AppHandle;

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
    pub is_primary: bool,
}

pub fn collect_monitors(app: &AppHandle) -> AppResult<Vec<MonitorInfo>> {
    let monitors = app
        .available_monitors()
        .map_err(|e| AppError::Monitor(e.to_string()))?;
    let primary = app
        .primary_monitor()
        .map_err(|e| AppError::Monitor(e.to_string()))?;
    let primary_pos = primary.as_ref().map(|m| (m.position().x, m.position().y));

    Ok(monitors
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
            is_primary: Some((m.position().x, m.position().y)) == primary_pos,
        })
        .collect())
}

/// Mapeia todos os monitores conectados (winit, exposto pelo Tauri).
#[tauri::command]
pub fn list_monitors(app: AppHandle) -> AppResult<Vec<MonitorInfo>> {
    collect_monitors(&app)
}
