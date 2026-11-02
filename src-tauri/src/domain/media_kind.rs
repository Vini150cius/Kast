use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MediaKind {
    Audio,
    Video,
    Image,
}

// Áudio: apenas formatos que o rodio decodifica com as features padrão.
// SVG fica de fora de propósito (pode conter scripts).
const AUDIO: &[&str] = &["mp3", "wav", "flac", "ogg"];
const VIDEO: &[&str] = &["mp4", "m4v", "webm", "mov", "ogv"];
const IMAGE: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp"];

impl MediaKind {
    pub fn from_extension(ext: &str) -> Option<Self> {
        let ext = ext.to_ascii_lowercase();
        let ext = ext.as_str();
        if AUDIO.contains(&ext) {
            Some(Self::Audio)
        } else if VIDEO.contains(&ext) {
            Some(Self::Video)
        } else if IMAGE.contains(&ext) {
            Some(Self::Image)
        } else {
            None
        }
    }
}
