use std::path::PathBuf;
use std::process::Command;

use chrono::{Datelike, Local, Timelike};
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

fn git(data: &PathBuf, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(data)
        .env("GIT_AUTHOR_NAME", "typst-editor")
        .env("GIT_AUTHOR_EMAIL", "typst-editor@local")
        .env("GIT_COMMITTER_NAME", "typst-editor")
        .env("GIT_COMMITTER_EMAIL", "typst-editor@local")
        .output()
        .map_err(|e| format!("git not found: {e}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
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

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[command]
pub async fn create_version(tmp_path: String) -> Result<VersionInfo, String> {
    tokio::task::spawn_blocking(move || {
        let data = data_dir(&tmp_path);

        // Init git repo if needed
        if !data.join(".git").exists() {
            git(&data, &["init", "-b", "main"])
                .or_else(|_| git(&data, &["init"]))?;
        }

        // Stage all changes
        git(&data, &["add", "-A"])?;

        // Only commit if the working tree changed
        let status = git(&data, &["status", "--porcelain"])?;
        if !status.is_empty() {
            let label = now_label();
            git(&data, &["commit", "-m", &label])?;
        }

        // Return current HEAD
        let id = git(&data, &["rev-parse", "--short", "HEAD"])
            .unwrap_or_default();
        let label = git(&data, &["log", "-1", "--pretty=format:%s"])
            .unwrap_or_default();

        Ok(VersionInfo { id, label, size: 0 })
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

        let output = match git(&data, &["log", "--pretty=format:%h %s"]) {
            Ok(o) => o,
            Err(_) => return Ok(Vec::new()),
        };

        Ok(output
            .lines()
            .filter_map(|line| {
                let (id, label) = line.split_once(' ')?;
                Some(VersionInfo {
                    id: id.to_string(),
                    label: label.to_string(),
                    size: 0,
                })
            })
            .collect())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[command]
pub async fn restore_version(tmp_path: String, version_id: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let data = data_dir(&tmp_path);
        // Reset working tree and HEAD to the target commit
        git(&data, &["reset", "--hard", &version_id])?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
