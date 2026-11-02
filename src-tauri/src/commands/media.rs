use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::domain::media_kind::MediaKind;
use crate::domain::path_validator::validate_media_path;
use crate::state::AppState;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaItem {
    pub id: String,
    pub path: String,
    pub name: String,
    pub kind: MediaKind,
    pub size_bytes: u64,
}

#[derive(Serialize)]
pub struct RejectedPath {
    pub path: String,
    pub reason: String,
}

#[derive(Serialize)]
pub struct RegisterResult {
    pub accepted: Vec<MediaItem>,
    pub rejected: Vec<RejectedPath>,
}

/// Valida cada caminho (traversal, extensão, existência), registra na allowlist
/// e libera SOMENTE aquele arquivo no escopo do asset protocol.
/// O front-end guarda apenas o path; o conteúdo nunca é carregado em memória aqui.
#[tauri::command]
pub fn register_media(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    paths: Vec<String>,
) -> RegisterResult {
    let mut accepted = Vec::new();
    let mut rejected = Vec::new();

    for raw in paths {
        match validate_media_path(&raw) {
            Ok(v) => {
                if state.register(v.path.clone()).is_err()
                    || app.asset_protocol_scope().allow_file(&v.path).is_err()
                {
                    rejected.push(RejectedPath { path: raw, reason: "falha ao registrar o arquivo".into() });
                    continue;
                }
                let mut h = DefaultHasher::new();
                v.path.hash(&mut h);
                accepted.push(MediaItem {
                    id: format!("{:016x}", h.finish()),
                    path: v.path.to_string_lossy().into_owned(),
                    name: v
                        .path
                        .file_name()
                        .map(|n| n.to_string_lossy().into_owned())
                        .unwrap_or_default(),
                    kind: v.kind,
                    size_bytes: v.size_bytes,
                });
            }
            Err(e) => rejected.push(RejectedPath { path: raw, reason: e.to_string() }),
        }
    }
    RegisterResult { accepted, rejected }
}
