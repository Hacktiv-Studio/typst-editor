use std::path::PathBuf;

use chrono::{Datelike, Local, Timelike};
use git2::{IndexAddOption, Repository, ResetType, Signature, Sort};
use serde::{Deserialize, Serialize};
use tauri::command;

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

fn data_dir(tmp_path: &str) -> PathBuf {
    PathBuf::from(tmp_path).join("data")
}

fn open_or_init(data: &PathBuf) -> Result<Repository, String> {
    if data.join(".git").exists() {
        Repository::open(data).map_err(|e| e.to_string())
    } else {
        Repository::init(data).map_err(|e| e.to_string())
    }
}

fn now_label() -> String {
    let now = Local::now();
    format!(
        "{:02}/{:02}/{} {:02}:{:02}:{:02}",
        now.day(),
        now.month(),
        now.year(),
        now.hour(),
        now.minute(),
        now.second()
    )
}

fn stage_all(repo: &Repository) -> Result<(), String> {
    let mut index = repo.index().map_err(|e| e.to_string())?;
    // Stage new + modified files
    index
        .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(|e| e.to_string())?;
    // Stage deletions
    index
        .update_all(["*"].iter(), None)
        .map_err(|e| e.to_string())?;
    index.write().map_err(|e| e.to_string())?;
    Ok(())
}

fn has_staged_changes(repo: &Repository) -> Result<bool, String> {
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_id = index.write_tree().map_err(|e| e.to_string())?;

    match repo.head() {
        Err(_) => {
            // No commits yet — check if the tree has entries
            let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;
            Ok(tree.len() > 0)
        }
        Ok(head) => {
            let head_tree = head.peel_to_tree().map_err(|e| e.to_string())?;
            let diff = repo
                .diff_tree_to_index(Some(&head_tree), Some(&index), None)
                .map_err(|e| e.to_string())?;
            Ok(diff.deltas().count() > 0)
        }
    }
}

fn commit(repo: &Repository, label: &str) -> Result<(), String> {
    let sig = Signature::now("typst-editor", "typst-editor@local")
        .map_err(|e| e.to_string())?;
    let mut index = repo.index().map_err(|e| e.to_string())?;
    let tree_id = index.write_tree().map_err(|e| e.to_string())?;
    let tree = repo.find_tree(tree_id).map_err(|e| e.to_string())?;

    match repo.head() {
        Err(_) => {
            // First commit — no parent
            repo.commit(Some("HEAD"), &sig, &sig, label, &tree, &[])
                .map_err(|e| e.to_string())?;
        }
        Ok(head) => {
            let parent = head.peel_to_commit().map_err(|e| e.to_string())?;
            repo.commit(Some("HEAD"), &sig, &sig, label, &tree, &[&parent])
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn head_info(repo: &Repository) -> Result<VersionInfo, String> {
    let head = repo.head().map_err(|e| e.to_string())?;
    let commit = head.peel_to_commit().map_err(|e| e.to_string())?;
    let id = commit.id().to_string()[..7].to_string();
    let label = commit.message().unwrap_or("").trim().to_string();
    Ok(VersionInfo { id, label, size: 0 })
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[command]
pub async fn create_version(tmp_path: String) -> Result<VersionInfo, String> {
    tokio::task::spawn_blocking(move || {
        let data = data_dir(&tmp_path);
        let repo = open_or_init(&data)?;

        stage_all(&repo)?;

        if has_staged_changes(&repo)? {
            commit(&repo, &now_label())?;
        }

        head_info(&repo)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[command]
pub async fn list_versions(tmp_path: String) -> Result<Vec<VersionInfo>, String> {
    tokio::task::spawn_blocking(move || {
        let data = data_dir(&tmp_path);
        if !data.join(".git").exists() {
            return Ok(Vec::new());
        }

        let repo = Repository::open(&data).map_err(|e| e.to_string())?;
        if repo.head().is_err() {
            return Ok(Vec::new());
        }

        let mut revwalk = repo.revwalk().map_err(|e| e.to_string())?;
        revwalk.push_head().map_err(|e| e.to_string())?;
        revwalk
            .set_sorting(Sort::TIME)
            .map_err(|e| e.to_string())?;

        let versions = revwalk
            .filter_map(|oid| {
                let oid = oid.ok()?;
                let commit = repo.find_commit(oid).ok()?;
                let id = oid.to_string()[..7].to_string();
                let label = commit.message().unwrap_or("").trim().to_string();
                Some(VersionInfo { id, label, size: 0 })
            })
            .collect();

        Ok(versions)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[command]
pub async fn restore_version(tmp_path: String, version_id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let data = data_dir(&tmp_path);
        let repo = Repository::open(&data).map_err(|e| e.to_string())?;
        let obj = repo
            .revparse_single(&version_id)
            .map_err(|e| e.to_string())?;
        repo.reset(&obj, ResetType::Hard, None)
            .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
