use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::command;

pub(crate) fn safe_join(root: &std::path::Path, rel: &str) -> Result<std::path::PathBuf, String> {
    let mut result = root.to_path_buf();
    for component in std::path::Path::new(rel).components() {
        match component {
            std::path::Component::ParentDir => {
                if !result.pop() || !result.starts_with(root) {
                    return Err(format!("path traversal denied: '{}'", rel));
                }
            }
            std::path::Component::Normal(c) => result.push(c),
            std::path::Component::CurDir | std::path::Component::RootDir => {}
            std::path::Component::Prefix(_) => {
                return Err("absolute paths not allowed".into());
            }
        }
    }
    if !result.starts_with(root) {
        return Err(format!("path traversal denied: '{}'", rel));
    }
    Ok(result)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectEntry {
    pub name: String,
    pub path: String,      // chemin relatif
    pub is_dir: bool,
    pub children: Option<Vec<ProjectEntry>>,
}

pub fn build_tree(root: &std::path::Path, dir: &std::path::Path) -> Vec<ProjectEntry> {
    let mut entries = Vec::new();
    let Ok(read) = std::fs::read_dir(dir) else { return entries };

    let mut items: Vec<_> = read.filter_map(|e| e.ok()).collect();
    items.sort_by(|a, b| {
        let a_dir = a.path().is_dir();
        let b_dir = b.path().is_dir();
        b_dir.cmp(&a_dir).then(a.file_name().cmp(&b.file_name()))
    });

    for entry in items {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') { continue }
        let rel = path.strip_prefix(root).unwrap_or(&path)
            .to_string_lossy().to_string();
        let is_dir = path.is_dir();
        let children = if is_dir { Some(build_tree(root, &path)) } else { None };
        entries.push(ProjectEntry { name, path: rel, is_dir, children });
    }
    entries
}

#[command]
pub async fn list_project(tmp_path: String) -> Result<Vec<ProjectEntry>, String> {
    let root = PathBuf::from(&tmp_path);
    let tree = tokio::task::spawn_blocking(move || build_tree(&root, &root))
        .await
        .map_err(|e| e.to_string())?;
    Ok(tree)
}

#[command]
pub async fn create_file(tmp_path: String, rel_path: String) -> Result<(), String> {
    let path = safe_join(&PathBuf::from(&tmp_path), &rel_path)?;
    if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|e| e.to_string())?;
    }
    tokio::fs::write(&path, "").await.map_err(|e| e.to_string())
}

#[command]
pub async fn create_folder(tmp_path: String, rel_path: String) -> Result<(), String> {
    let path = safe_join(&PathBuf::from(&tmp_path), &rel_path)?;
    tokio::fs::create_dir_all(&path).await.map_err(|e| e.to_string())
}

#[command]
pub async fn rename_path(tmp_path: String, old_rel: String, new_rel: String) -> Result<(), String> {
    let root = PathBuf::from(&tmp_path);
    let old = safe_join(&root, &old_rel)?;
    let new = safe_join(&root, &new_rel)?;
    tokio::fs::rename(&old, &new).await.map_err(|e| e.to_string())
}

#[command]
pub async fn delete_path(tmp_path: String, rel_path: String) -> Result<(), String> {
    let path = safe_join(&PathBuf::from(&tmp_path), &rel_path)?;
    tokio::task::spawn_blocking(move || {
        if path.is_dir() {
            std::fs::remove_dir_all(&path)
        } else {
            std::fs::remove_file(&path)
        }
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

#[command]
pub async fn read_file(tmp_path: String, rel_path: String) -> Result<String, String> {
    let path = safe_join(&PathBuf::from(&tmp_path), &rel_path)?;
    tokio::fs::read_to_string(&path).await.map_err(|e| e.to_string())
}

#[command]
pub async fn write_file(tmp_path: String, rel_path: String, content: String) -> Result<(), String> {
    let path = safe_join(&PathBuf::from(&tmp_path), &rel_path)?;
    tokio::fs::write(&path, content).await.map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_create_and_read_file() {
        let dir = tempdir().unwrap();
        let tmp = dir.path().to_string_lossy().to_string();
        create_file(tmp.clone(), "main.typ".into()).await.unwrap();
        write_file(tmp.clone(), "main.typ".into(), "= Hello".into()).await.unwrap();
        let content = read_file(tmp.clone(), "main.typ".into()).await.unwrap();
        assert_eq!(content, "= Hello");
    }

    #[tokio::test]
    async fn test_list_project() {
        let dir = tempdir().unwrap();
        let tmp = dir.path().to_string_lossy().to_string();
        create_file(tmp.clone(), "main.typ".into()).await.unwrap();
        create_folder(tmp.clone(), "figures".into()).await.unwrap();
        let tree = list_project(tmp).await.unwrap();
        assert!(tree.iter().any(|e| e.name == "main.typ" && !e.is_dir));
        assert!(tree.iter().any(|e| e.name == "figures" && e.is_dir));
    }

    #[tokio::test]
    async fn test_rename_path() {
        let dir = tempdir().unwrap();
        let tmp = dir.path().to_string_lossy().to_string();
        create_file(tmp.clone(), "old.typ".into()).await.unwrap();
        rename_path(tmp.clone(), "old.typ".into(), "new.typ".into()).await.unwrap();
        let tree = list_project(tmp).await.unwrap();
        assert!(tree.iter().any(|e| e.name == "new.typ"));
        assert!(!tree.iter().any(|e| e.name == "old.typ"));
    }

    #[tokio::test]
    async fn test_path_traversal_denied() {
        let dir = tempdir().unwrap();
        let tmp = dir.path().to_string_lossy().to_string();
        let result = create_file(tmp, "../../evil.txt".into()).await;
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("traversal"));
    }
}
