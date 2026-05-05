use std::path::PathBuf;
use std::sync::Arc;

use serde::Serialize;
use typst::layout::{PagedDocument, Point};
use typst::syntax::{FileId, Side, VirtualPath};
use typst::World;
use typst_ide::{
    autocomplete, definition, jump_from_click, tooltip, CompletionKind, Definition, IdeWorld,
    Jump, Tooltip,
};

use crate::commands::compiler::{FontCache, TypstWorld};

// ---------------------------------------------------------------------------
// IdeWorld impl
// ---------------------------------------------------------------------------

impl IdeWorld for TypstWorld {
    fn upcast(&self) -> &dyn World {
        self
    }
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionItem {
    pub kind: String,
    pub label: String,
    pub apply: Option<String>,
    pub detail: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompletionsResult {
    pub from: usize,
    pub items: Vec<CompletionItem>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JumpResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub byte_offset: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page: Option<usize>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn compile_for_ide(world: &TypstWorld) -> Option<PagedDocument> {
    typst::compile::<PagedDocument>(world).output.ok()
}

fn kind_to_str(kind: &CompletionKind) -> &'static str {
    match kind {
        CompletionKind::Syntax => "syntax",
        CompletionKind::Func => "func",
        CompletionKind::Type => "type",
        CompletionKind::Param => "param",
        CompletionKind::Constant => "constant",
        CompletionKind::Path => "path",
        CompletionKind::Package => "package",
        CompletionKind::Label => "label",
        CompletionKind::Font => "font",
        CompletionKind::Symbol(_) => "symbol",
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_completions(
    font_cache: tauri::State<'_, FontCache>,
    tmp_path: String,
    entry_file: String,
    current_file: String,
    cursor_byte: usize,
    explicit: bool,
) -> Result<Option<CompletionsResult>, String> {
    let book = Arc::clone(&font_cache.book);
    let fonts = Arc::clone(&font_cache.fonts);
    let library = Arc::clone(&font_cache.library);
    let source_cache = Arc::clone(&font_cache.source_cache);
    let file_cache = Arc::clone(&font_cache.file_cache);

    tokio::task::spawn_blocking(move || {
        let root = PathBuf::from(&tmp_path).join("data");
        let world = TypstWorld::from_cache(root, &entry_file, book, fonts, library, source_cache, file_cache, None);
        let document = compile_for_ide(&world);

        let current_id = FileId::new(None, VirtualPath::new(&current_file));
        let source = world
            .source(current_id)
            .map_err(|e| format!("{:?}", e))?;

        let result = autocomplete(&world, document.as_ref(), &source, cursor_byte, explicit);

        Ok(result.map(|(from, completions)| {
            let items = completions
                .into_iter()
                .map(|c| CompletionItem {
                    kind: kind_to_str(&c.kind).to_string(),
                    label: c.label.to_string(),
                    apply: c.apply.map(|a| a.to_string()),
                    detail: c.detail.map(|d| d.to_string()),
                })
                .collect();
            CompletionsResult { from, items }
        }))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn get_tooltip(
    font_cache: tauri::State<'_, FontCache>,
    tmp_path: String,
    entry_file: String,
    current_file: String,
    cursor_byte: usize,
) -> Result<Option<String>, String> {
    let book = Arc::clone(&font_cache.book);
    let fonts = Arc::clone(&font_cache.fonts);
    let library = Arc::clone(&font_cache.library);
    let source_cache = Arc::clone(&font_cache.source_cache);
    let file_cache = Arc::clone(&font_cache.file_cache);

    tokio::task::spawn_blocking(move || {
        let root = PathBuf::from(&tmp_path).join("data");
        let world = TypstWorld::from_cache(root, &entry_file, book, fonts, library, source_cache, file_cache, None);
        let document = compile_for_ide(&world);

        let current_id = FileId::new(None, VirtualPath::new(&current_file));
        let source = world
            .source(current_id)
            .map_err(|e| format!("{:?}", e))?;

        let tip = tooltip(&world, document.as_ref(), &source, cursor_byte, Side::Before);

        Ok(tip.map(|t| match t {
            Tooltip::Text(s) => s.to_string(),
            Tooltip::Code(s) => format!("`{}`", s),
        }))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn goto_definition(
    font_cache: tauri::State<'_, FontCache>,
    tmp_path: String,
    entry_file: String,
    current_file: String,
    cursor_byte: usize,
) -> Result<Option<JumpResult>, String> {
    let book = Arc::clone(&font_cache.book);
    let fonts = Arc::clone(&font_cache.fonts);
    let library = Arc::clone(&font_cache.library);
    let source_cache = Arc::clone(&font_cache.source_cache);
    let file_cache = Arc::clone(&font_cache.file_cache);

    tokio::task::spawn_blocking(move || {
        let root = PathBuf::from(&tmp_path).join("data");
        let world = TypstWorld::from_cache(root, &entry_file, book, fonts, library, source_cache, file_cache, None);
        let document = compile_for_ide(&world);

        let current_id = FileId::new(None, VirtualPath::new(&current_file));
        let source = world
            .source(current_id)
            .map_err(|e| format!("{:?}", e))?;

        let def = definition(&world, document.as_ref(), &source, cursor_byte, Side::Before);

        Ok(def.and_then(|d| match d {
            Definition::Span(span) => {
                let id = span.id()?;
                let Ok(src) = world.source(id) else {
                    return None;
                };
                let range = src.range(span)?;
                let file = id
                    .vpath()
                    .as_rootless_path()
                    .to_string_lossy()
                    .to_string();
                Some(JumpResult {
                    file: Some(file),
                    byte_offset: Some(range.start),
                    url: None,
                    page: None,
                })
            }
            Definition::Std(_) => None,
        }))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn jump_from_click_cmd(
    font_cache: tauri::State<'_, FontCache>,
    tmp_path: String,
    entry_file: String,
    page: usize,
    click_x_ratio: f64,
    click_y_ratio: f64,
) -> Result<Option<JumpResult>, String> {
    let book = Arc::clone(&font_cache.book);
    let fonts = Arc::clone(&font_cache.fonts);
    let library = Arc::clone(&font_cache.library);
    let source_cache = Arc::clone(&font_cache.source_cache);
    let file_cache = Arc::clone(&font_cache.file_cache);

    tokio::task::spawn_blocking(move || {
        let root = PathBuf::from(&tmp_path).join("data");
        let world = TypstWorld::from_cache(root, &entry_file, book, fonts, library, source_cache, file_cache, None);

        let Some(document) = compile_for_ide(&world) else {
            return Ok(None);
        };

        let Some(page_doc) = document.pages.get(page) else {
            return Ok(None);
        };

        let frame = &page_doc.frame;
        let size = frame.size();
        let click = Point::new(size.x * click_x_ratio, size.y * click_y_ratio);

        let jump = jump_from_click(&world, &document, frame, click);

        Ok(jump.map(|j| match j {
            Jump::File(id, offset) => {
                let file = id
                    .vpath()
                    .as_rootless_path()
                    .to_string_lossy()
                    .to_string();
                JumpResult {
                    file: Some(file),
                    byte_offset: Some(offset),
                    url: None,
                    page: None,
                }
            }
            Jump::Url(url) => JumpResult {
                file: None,
                byte_offset: None,
                url: Some(url.to_string()),
                page: None,
            },
            Jump::Position(pos) => JumpResult {
                file: None,
                byte_offset: None,
                url: None,
                page: Some(pos.page.get() - 1),
            },
        }))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn invalidate_compile_hashes(_tmp_path: String) -> Result<(), String> {
    Ok(())
}
