use std::path::{Path, PathBuf};
use std::io::Write;
use serde::Serialize;
use tauri::{command, AppHandle, Emitter, Manager};
use walkdir::WalkDir;
use zip::{ZipArchive, ZipWriter, write::SimpleFileOptions};

use crate::commands::filesystem::{build_tree, safe_join, ProjectEntry};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
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

/// Returns the base directory for all project working dirs: <app_local_data_dir>/projects/
pub fn projects_base_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))
        .map(|d| d.join("projects"))
}

fn project_dir_for(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let safe_name: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    Ok(projects_base_dir(app)?.join(safe_name))
}

fn validate_project_path(app: &AppHandle, path: &Path) -> Result<(), String> {
    let base = projects_base_dir(app)?;
    if !path.starts_with(&base) {
        return Err(format!(
            "path is not a managed project directory: {}",
            path.display()
        ));
    }
    Ok(())
}

/// Pure helper used by both the command and tests.
async fn create_project_at(dir: PathBuf) -> Result<ProjectInfo, String> {
    let data_dir = dir.join("data");
    tokio::fs::create_dir_all(&data_dir).await.map_err(|e| e.to_string())?;
    tokio::fs::write(data_dir.join("main.typ"), "").await.map_err(|e| e.to_string())?;
    let data_for_tree = data_dir.clone();
    let tree = tokio::task::spawn_blocking(move || build_tree(&data_for_tree, &data_for_tree))
        .await
        .map_err(|e| e.to_string())?;
    Ok(ProjectInfo {
        tmp_path: dir.to_string_lossy().to_string(),
        tree,
    })
}

#[command]
pub async fn new_project(app: AppHandle, name: String) -> Result<ProjectInfo, String> {
    let base = projects_base_dir(&app)?;
    tokio::fs::create_dir_all(&base).await.map_err(|e| e.to_string())?;
    let dir = project_dir_for(&app, &name)?;
    create_project_at(dir).await
}

#[command]
pub async fn open_project(
    app: AppHandle,
    typz_path: String,
) -> Result<ProjectInfo, String> {
    let typz = PathBuf::from(&typz_path);
    let stem = typz
        .file_stem()
        .ok_or_else(|| "invalid .typz path: no file stem".to_string())?
        .to_string_lossy()
        .to_string();

    let dir = project_dir_for(&app, &stem)?;
    let base = projects_base_dir(&app)?;
    tokio::fs::create_dir_all(&base).await.map_err(|e| e.to_string())?;

    if dir.exists() {
        tokio::fs::remove_dir_all(&dir).await.map_err(|e| e.to_string())?;
    }
    let data_dir = dir.join("data");
    tokio::fs::create_dir_all(&data_dir).await.map_err(|e| e.to_string())?;

    let dir_clone = dir.clone();
    let data_dir_clone = data_dir.clone();
    let typz_clone = typz.clone();

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        let file = std::fs::File::open(&typz_clone).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;
        let total = archive.len();

        // Detect new format: at least one entry starts with "data/"
        let new_format = (0..total).any(|i| {
            archive.by_index(i).ok()
                .map(|e| e.name().starts_with("data/"))
                .unwrap_or(false)
        });

        for i in 0..total {
            let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
            let name = entry.name().to_string();

            let outpath = if new_format {
                if let Some(rel) = name.strip_prefix("data/") {
                    safe_join(&data_dir_clone, rel).map_err(|e| e.to_string())?
                } else if let Some(rel) = name.strip_prefix("cache/") {
                    let cache_dir = dir_clone.join("cache");
                    safe_join(&cache_dir, rel).map_err(|e| e.to_string())?
                } else {
                    // Skip unknown top-level entries in new format
                    continue;
                }
            } else {
                // Old format: all entries go into data/
                safe_join(&data_dir_clone, &name).map_err(|e| e.to_string())?
            };

            if name.ends_with('/') {
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

    let data_for_tree = data_dir.clone();
    let tree = tokio::task::spawn_blocking(move || build_tree(&data_for_tree, &data_for_tree))
        .await
        .map_err(|e| e.to_string())?;
    Ok(ProjectInfo {
        tmp_path: dir.to_string_lossy().to_string(),
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
    validate_project_path(&app, &tmp)?;
    let typz = PathBuf::from(&typz_path);
    let data_dir = tmp.join("data");
    let cache_dir = tmp.join("cache");

    tokio::task::spawn_blocking(move || -> Result<(), String> {
        // Collect data/ entries (always present)
        let data_entries: Vec<_> = WalkDir::new(&data_dir)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.path() != data_dir)
            .collect();
        // Collect cache/ entries (optional)
        let cache_entries: Vec<_> = if cache_dir.exists() {
            WalkDir::new(&cache_dir)
                .into_iter()
                .filter_map(|e| e.ok())
                .filter(|e| e.path() != cache_dir)
                .collect()
        } else {
            vec![]
        };
        let total = data_entries.len() + cache_entries.len();

        let file = std::fs::File::create(&typz).map_err(|e| e.to_string())?;
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        let mut i = 0usize;
        for entry in &data_entries {
            let path = entry.path();
            let rel = format!(
                "data/{}",
                path.strip_prefix(&data_dir).unwrap_or(path).to_string_lossy()
            );
            if path.is_dir() {
                zip.add_directory(format!("{}/", rel), options).map_err(|e| e.to_string())?;
            } else {
                zip.start_file(&rel, options).map_err(|e| e.to_string())?;
                let data = std::fs::read(path).map_err(|e| e.to_string())?;
                zip.write_all(&data).map_err(|e| e.to_string())?;
            }
            i += 1;
            let _ = app.emit("progress", ProgressPayload {
                label: "Sauvegarde en cours...".into(),
                current: i,
                total,
            });
        }
        for entry in &cache_entries {
            let path = entry.path();
            let rel = format!(
                "cache/{}",
                path.strip_prefix(&cache_dir).unwrap_or(path).to_string_lossy()
            );
            if path.is_dir() {
                zip.add_directory(format!("{}/", rel), options).map_err(|e| e.to_string())?;
            } else {
                zip.start_file(&rel, options).map_err(|e| e.to_string())?;
                let data = std::fs::read(path).map_err(|e| e.to_string())?;
                zip.write_all(&data).map_err(|e| e.to_string())?;
            }
            i += 1;
            let _ = app.emit("progress", ProgressPayload {
                label: "Sauvegarde en cours...".into(),
                current: i,
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
pub async fn cleanup_stale_projects(
    app: AppHandle,
    current_tmp: Option<String>,
) -> Result<(), String> {
    let base = projects_base_dir(&app)?;
    if !base.exists() {
        return Ok(());
    }
    let current = current_tmp.map(PathBuf::from);
    let mut dir = tokio::fs::read_dir(&base)
        .await
        .map_err(|e| e.to_string())?;
    while let Some(entry) = dir.next_entry().await.map_err(|e| e.to_string())? {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Some(ref cur) = current {
            if &path == cur {
                continue;
            }
        }
        let _ = tokio::fs::remove_dir_all(&path).await;
    }
    Ok(())
}

#[command]
pub async fn cleanup_tmp(app: AppHandle, tmp_path: String) -> Result<(), String> {
    let path = PathBuf::from(&tmp_path);
    validate_project_path(&app, &path)?;
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
        let base = tempfile::tempdir().unwrap();
        let dir = base.path().join("test-proj-123");
        let project = create_project_at(dir).await.unwrap();
        // main.typ lives in tmpPath/data/
        let main = PathBuf::from(&project.tmp_path).join("data").join("main.typ");
        assert!(main.exists());
        assert!(project.tree.iter().any(|e| e.name == "main.typ"));
    }

    #[tokio::test]
    async fn test_zip_slip_rejected() {
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
        use crate::commands::filesystem::safe_join;
        let base = tempfile::tempdir().unwrap();
        let result = safe_join(base.path(), "../evil.txt");
        assert!(result.is_err(), "zip slip path should be rejected");
    }
}
