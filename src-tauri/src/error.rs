use serde::Serialize;

use crate::domain::path_validator::PathError;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("Falha ao consultar monitores: {0}")]
    Monitor(String),
    #[error("Falha ao gerenciar janela: {0}")]
    Window(String),
    #[error("Caminho inválido: {0}")]
    Path(#[from] PathError),
    #[error("Arquivo não registrado. Adicione-o pela biblioteca antes de usar.")]
    NotRegistered,
    #[error("Erro no motor de áudio: {0}")]
    Audio(String),
    #[error("Estado interno indisponível")]
    StatePoisoned,
}

// Tauri exige que o erro de um command seja Serialize.
impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
