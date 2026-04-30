use std::path::PathBuf;
use std::io::Write;
use serde::Serialize;
use tauri::{command, AppHandle, Emitter};
use walkdir::WalkDir;
use zip::{ZipArchive, ZipWriter, write::SimpleFileOptions};

use crate::commands::filesystem::{build_tree, safe_join, ProjectEntry};

#[derive(Debug, Serialize)]
pub struct ProjectInfo {
    pub tmp_path: String,
    pub tree: Vec<ProjectEntry>,
}

#[derive(Clone, Serialize)]
struct ProgressPayload {
    label: String,
    current: usize,
    total: usize,
}

fn tmp_dir_for(name: &str) -> PathBuf {
    let safe_name: String = name.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    std::env::temp_dir().join(format!("typst-editor-{}", safe_name))
}

fn validate_tmp_path(path: &std::path::Path) -> Result<(), String> {
    let prefix = std::env::temp_dir().join("typst-editor-");
    if !path.starts_with(&prefix) {
        return Err(format!("path is not a managed tmp directory: {}", path.display()));
    }
    Ok(())
}

#[command]
pub async fn new_project(name: String) -> Result<ProjectInfo, String> {
    let tmp = tmp_dir_for(&name);
    tokio::fs::create_dir_all(&tmp).await.map_err(|e| e.to_string())?;
    tokio::fs::write(tmp.join("main.typ"), "").await.map_err(|e| e.to_string())?;
    let tmp_for_tree = tmp.clone();
    let tree = tokio::task::spawn_blocking(move || build_tree(&tmp_for_tree, &tmp_for_tree))
        .await
        .map_err(|e| e.to_string())?;
    Ok(ProjectInfo {
        tmp_path: tmp.to_string_lossy().to_string(),
        tree,
    })
}

#[command]
pub async fn open_project(
    app: AppHandle,
    typz_path: String,
) -> Result<ProjectInfo, String> {
    let typz = PathBuf::from(&typz_path);
    let stem = typz.file_stem()
        .ok_or_else(|| "invalid .typz path: no file stem".to_string())?
        .to_string_lossy()
        .to_string();
    let tmp = tmp_dir_for(&stem);

    if tmp.exists() {
        tokio::fs::remove_dir_all(&tmp).await.map_err(|e| e.to_string())?;
    }
    tokio::fs::create_dir_all(&tmp).await.map_err(|e| e.to_string())?;

    let tmp_clone = tmp.clone();
    let typz_clone = typz.clone();

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let file = std::fs::File::open(&typz_clone).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
        let total = archive.len();

        for i in 0..total {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            let outpath = safe_join(&tmp_clone, entry.name()).map_err(|e| e.to_string())?;

            if entry.name().ends_with('/') {
                std::fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
            } else {
                if let Some(p) = outpath.parent() {
                    std::fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
                let mut out = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
                std::io::copy(&mut entry, &mut out).map_err(|e| e.to_string())?;
            }

            let _ = app.emit("progress", ProgressPayload {
                label: "Ouverture du projet...".into(),
                current: i + 1,
                total,
            });
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())??;

    let tmp_for_tree = tmp.clone();
    let tree = tokio::task::spawn_blocking(move || build_tree(&tmp_for_tree, &tmp_for_tree))
        .await
        .map_err(|e| e.to_string())?;
    Ok(ProjectInfo {
        tmp_path: tmp.to_string_lossy().to_string(),
        tree,
    })
}

#[command]
pub async fn save_project(
    app: AppHandle,
    tmp_path: String,
    typz_path: String,
) -> Result<(), String> {
    let tmp = PathBuf::from(&tmp_path);
    validate_tmp_path(&tmp)?;
    let typz = PathBuf::from(&typz_path);

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let entries: Vec<_> = WalkDir::new(&tmp)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path() != tmp)
            .collect();
        let total = entries.len();

        let file = std::fs::File::create(&typz).map_err(|e| e.to_string())?;
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        for (i, entry) in entries.iter().enumerate() {
            let path = entry.path();
            let rel = path.strip_prefix(&tmp).unwrap_or(path)
                .to_string_lossy().to_string();

            if path.is_dir() {
                zip.add_directory(format!("{}/", rel), options).map_err(|e| e.to_string())?;
            } else {
                zip.start_file(&rel, options).map_err(|e| e.to_string())?;
                let data = std::fs::read(path).map_err(|e| e.to_string())?;
                zip.write_all(&data).map_err(|e| e.to_string())?;
            }

            let _ = app.emit("progress", ProgressPayload {
                label: "Sauvegarde en cours...".into(),
                current: i + 1,
                total,
            });
        }

        zip.finish().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[command]
pub async fn cleanup_tmp(tmp_path: String) -> Result<(), String> {
    let path = PathBuf::from(&tmp_path);
    validate_tmp_path(&path)?;
    if path.exists() {
        tokio::fs::remove_dir_all(&path).await.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_new_project_creates_main_typ() {
        let project = new_project("test-proj-123".into()).await.unwrap();
        let main = PathBuf::from(&project.tmp_path).join("main.typ");
        assert!(main.exists());
        assert!(project.tree.iter().any(|e| e.name == "main.typ"));
        // cleanup
        let _ = cleanup_tmp(project.tmp_path).await;
    }

    #[tokio::test]
    async fn test_zip_slip_rejected() {
        // create a zip with a malicious entry name
        let dir = tempfile::tempdir().unwrap();
        let zip_path = dir.path().join("evil.typz");
        {
            let file = std::fs::File::create(&zip_path).unwrap();
            let mut zip = zip::ZipWriter::new(file);
            let opts = zip::write::SimpleFileOptions::default();
            zip.start_file("../evil.txt", opts).unwrap();
            zip.write_all(b"evil").unwrap();
            zip.finish().unwrap();
        }
        // Test safe_join directly with the malicious path
        use crate::commands::filesystem::safe_join;
        let base = std::env::temp_dir().join("typst-editor-test-zipslip");
        let result = safe_join(&base, "../evil.txt");
        assert!(result.is_err(), "zip slip path should be rejected");
    }
}
