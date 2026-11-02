use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::error::{AppError, AppResult};

/// Estado compartilhado. Cada subsistema tem seu próprio lock
/// para evitar contenção entre mídia e janelas.
#[derive(Default)]
pub struct AppState {
    /// label da janela exibidora -> índice do monitor
    pub displays: Mutex<HashMap<String, usize>>,
    /// Allowlist: só caminhos já validados e registrados podem ser tocados/exibidos.
    pub media: Mutex<HashSet<PathBuf>>,
}

impl AppState {
    pub fn register(&self, path: PathBuf) -> AppResult<()> {
        self.media
            .lock()
            .map_err(|_| AppError::StatePoisoned)?
            .insert(path);
        Ok(())
    }

    /// Revalida contra a allowlist. O front-end envia strings; nunca confiamos nelas.
    pub fn ensure_registered(&self, raw: &str) -> AppResult<PathBuf> {
        let canon = dunce::canonicalize(Path::new(raw)).map_err(|_| AppError::NotRegistered)?;
        let set = self.media.lock().map_err(|_| AppError::StatePoisoned)?;
        if set.contains(&canon) {
            Ok(canon)
        } else {
            Err(AppError::NotRegistered)
        }
    }
}
