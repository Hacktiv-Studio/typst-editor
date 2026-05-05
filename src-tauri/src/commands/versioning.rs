use std::io::Write;
use std::path::PathBuf;

use chrono::{Datelike, Local, Timelike};
use serde::{Deserialize, Serialize};
use tauri::command;
use walkdir::WalkDir;
use zip::{write::SimpleFileOptions, ZipArchive, ZipWriter};

use crate::commands::filesystem::safe_join;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VersionInfo {
    pub id: String,
    pub label: String,
    pub size: u64,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn versions_dir(tmp_path: &str) -> PathBuf {
    PathBuf::from(tmp_path).join("versions")
}

fn id_to_label(id: &str) -> String {
    // id format: YYYYMMDD_HHMMSS
    if id.len() < 15 {
        return id.to_string();
    }
    let date = &id[0..8];
    let time = &id[9..15];
    let y = &date[0..4];
    let mo = &date[4..6];
    let d = &date[6..8];
    let h = &time[0..2];
    let mi = &time[2..4];
    let s = &time[4..6];
    format!("{}/{}/{} {}:{}:{}", d, mo, y, h, mi, s)
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[command]
pub async fn create_version(tmp_path: String) -> Result<VersionInfo, String> {
    tokio::task::spawn_blocking(move || {
        let now = Local::now();
        let id = format!(
            "{}{:02}{:02}_{:02}{:02}{:02}",
            now.year(),
            now.month(),
            now.day(),
            now.hour(),
            now.minute(),
            now.second(),
        );

        let versions = versions_dir(&tmp_path);
        std::fs::create_dir_all(&versions).map_err(|e| e.to_string())?;

        let zip_path = versions.join(format!("{}.zip", id));
        let data_dir = PathBuf::from(&tmp_path).join("data");

        let entries: Vec<_> = WalkDir::new(&data_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path() != data_dir)
            .collect();

        let file = std::fs::File::create(&zip_path).map_err(|e| e.to_string())?;
        let mut zip = ZipWriter::new(file);
        let opts = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        for entry in &entries {
            let path = entry.path();
            let rel = path
                .strip_prefix(&data_dir)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();
            if path.is_dir() {
                zip.add_directory(format!("{}/", rel), opts)
                    .map_err(|e| e.to_string())?;
            } else {
                zip.start_file(&rel, opts).map_err(|e| e.to_string())?;
                let data = std::fs::read(path).map_err(|e| e.to_string())?;
                zip.write_all(&data).map_err(|e| e.to_string())?;
            }
        }
        zip.finish().map_err(|e| e.to_string())?;

        let size = std::fs::metadata(&zip_path)
            .map(|m| m.len())
            .unwrap_or(0);

        Ok(VersionInfo {
            label: id_to_label(&id),
            id,
            size,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[command]
pub async fn list_versions(tmp_path: String) -> Result<Vec<VersionInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let versions = versions_dir(&tmp_path);
        if !versions.exists() {
            return Ok(Vec::new());
        }

        let mut result: Vec<VersionInfo> = std::fs::read_dir(&versions)
            .map_err(|e| e.to_string())?
            .flatten()
            .filter_map(|e| {
                let path = e.path();
                let name = path.file_name()?.to_string_lossy().to_string();
                if !name.ends_with(".zip") {
                    return None;
                }
                let id = name.trim_end_matches(".zip").to_string();
                let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                Some(VersionInfo {
                    label: id_to_label(&id),
                    id,
                    size,
                })
            })
            .collect();

        // Sort newest first (lexicographic on YYYYMMDD_HHMMSS works fine)
        result.sort_by(|a, b| b.id.cmp(&a.id));
        Ok(result)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[command]
pub async fn restore_version(tmp_path: String, version_id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let zip_path = versions_dir(&tmp_path).join(format!("{}.zip", version_id));
        if !zip_path.exists() {
            return Err(format!("Version not found: {}", version_id));
        }

        let data_dir = PathBuf::from(&tmp_path).join("data");

        // Clear data dir
        if data_dir.exists() {
            std::fs::remove_dir_all(&data_dir).map_err(|e| e.to_string())?;
        }
        std::fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;

        // Extract zip
        let file = std::fs::File::open(&zip_path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

        for i in 0..archive.len() {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            let name = entry.name().to_string();
            let outpath = safe_join(&data_dir, &name).map_err(|e| e.to_string())?;

            if name.ends_with('/') {
                std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = outpath.parent() {
                    std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
                let mut out =
                    std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
            }
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
