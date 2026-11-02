//! Prevenção de path traversal. Regras puras, sem dependência do Tauri.

use std::fs;
use std::path::{Component, Path, PathBuf};

use super::media_kind::MediaKind;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum PathError {
    #[error("caminho vazio ou com byte nulo")]
    Malformed,
    #[error("o caminho precisa ser absoluto")]
    NotAbsolute,
    #[error("caminhos com '..' não são permitidos")]
    ParentTraversal,
    #[error("arquivo não encontrado")]
    NotFound,
    #[error("o caminho não é um arquivo")]
    NotAFile,
    #[error("extensão não suportada")]
    UnsupportedExtension,
}

#[derive(Debug, Clone)]
pub struct ValidatedMedia {
    /// Caminho canônico (symlinks resolvidos).
    pub path: PathBuf,
    pub kind: MediaKind,
    pub size_bytes: u64,
}

pub fn validate_media_path(raw: &str) -> Result<ValidatedMedia, PathError> {
    if raw.trim().is_empty() || raw.contains('\0') {
        return Err(PathError::Malformed);
    }
    let p = Path::new(raw);
    if !p.is_absolute() {
        return Err(PathError::NotAbsolute);
    }
    // Checagem ANTES de canonicalizar: nunca aceitamos '..' vindo do front.
    if p.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(PathError::ParentTraversal);
    }
    let canon = dunce::canonicalize(p).map_err(|_| PathError::NotFound)?;
    let meta = fs::metadata(&canon).map_err(|_| PathError::NotFound)?;
    if !meta.is_file() {
        return Err(PathError::NotAFile);
    }
    let kind = canon
        .extension()
        .and_then(|e| e.to_str())
        .and_then(MediaKind::from_extension)
        .ok_or(PathError::UnsupportedExtension)?;

    Ok(ValidatedMedia { path: canon, kind, size_bytes: meta.len() })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn tmp_file(name: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("kast_test_{}_{}", std::process::id(), name));
        fs::File::create(&p).unwrap().write_all(b"x").unwrap();
        p
    }

    #[test]
    fn rejects_relative() {
        assert_eq!(validate_media_path("a/b.mp3").unwrap_err(), PathError::NotAbsolute);
    }

    #[test]
    fn rejects_empty_and_nul() {
        assert_eq!(validate_media_path("").unwrap_err(), PathError::Malformed);
        assert_eq!(validate_media_path("/tmp/a\0.mp3").unwrap_err(), PathError::Malformed);
    }

    #[test]
    fn rejects_parent_traversal() {
        let f = tmp_file("t.mp3");
        let sneaky = format!("{}/../{}", f.parent().unwrap().display(), f.file_name().unwrap().to_str().unwrap());
        assert_eq!(validate_media_path(&sneaky).unwrap_err(), PathError::ParentTraversal);
        let _ = fs::remove_file(f);
    }

    #[test]
    fn rejects_dir_bad_extension_and_missing() {
        assert_eq!(validate_media_path(&std::env::temp_dir().to_string_lossy()).unwrap_err(), PathError::NotAFile);
        let f = tmp_file("t.exe");
        assert_eq!(validate_media_path(&f.to_string_lossy()).unwrap_err(), PathError::UnsupportedExtension);
        let _ = fs::remove_file(f);
        assert_eq!(validate_media_path(&std::env::temp_dir().join("nope.mp4").to_string_lossy()).unwrap_err(), PathError::NotFound);
    }

    #[test]
    fn accepts_valid_file_case_insensitive() {
        let f = tmp_file("T.MP4");
        let v = validate_media_path(&f.to_string_lossy()).unwrap();
        assert_eq!(v.kind, MediaKind::Video);
        let _ = fs::remove_file(f);
    }
}
