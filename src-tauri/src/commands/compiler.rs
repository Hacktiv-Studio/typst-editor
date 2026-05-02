use std::path::{Path, PathBuf};

use chrono::Datelike;
use serde::{Deserialize, Serialize};
use typst::diag::{FileError, FileResult, SourceDiagnostic};
use typst::foundations::{Bytes, Datetime};
use typst::layout::{Frame, FrameItem, PagedDocument};
use typst::syntax::{FileId, Span, VirtualPath, Source};
use typst::text::{Font, FontBook};
use typst::utils::LazyHash;
use typst::{Library, World};

// ---------------------------------------------------------------------------
// Public structs
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CompileError {
    pub file: String,
    pub line: usize,
    pub col: usize,
    pub message: String,
    pub severity: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct CompileResult {
    pub pages: Vec<String>,
    pub errors: Vec<CompileError>,
    pub output: String,
    /// For each page index: the minimum 0-based source line of the entry file
    /// that appears on that page. Used by the editor to scroll the preview.
    pub source_map: Vec<u32>,
}

// ---------------------------------------------------------------------------
// TypstWorld
// ---------------------------------------------------------------------------

pub struct TypstWorld {
    root: PathBuf,
    main_id: FileId,
    library: LazyHash<Library>,
    book: LazyHash<FontBook>,
    fonts: Vec<Font>,
}

impl TypstWorld {
    pub fn new(root: PathBuf, main_file: &str) -> Self {
        let main_id = FileId::new(None, VirtualPath::new(main_file));

        // Load system fonts via fontdb
        let mut fontdb = fontdb::Database::new();
        fontdb.load_system_fonts();

        let mut book = FontBook::new();
        let mut fonts = Vec::new();

        for face_info in fontdb.faces() {
            let face_id = face_info.id;
            let index = face_info.index;
            if let Some((source, _)) = fontdb.face_source(face_id) {
                let data = match source {
                    fontdb::Source::Binary(data) => {
                        (*data).as_ref().to_vec()
                    }
                    fontdb::Source::File(path) => {
                        match std::fs::read(&path) {
                            Ok(d) => d,
                            Err(_) => continue,
                        }
                    }
                    fontdb::Source::SharedFile(_, data) => {
                        (*data).as_ref().to_vec()
                    }
                };
                let bytes = Bytes::new(data);
                if let Some(font) = Font::new(bytes, index) {
                    book.push(font.info().clone());
                    fonts.push(font);
                }
            }
        }

        let library = LazyHash::new(Library::default());
        let book = LazyHash::new(book);

        TypstWorld {
            root,
            main_id,
            library,
            book,
            fonts,
        }
    }

    /// Resolve a FileId to an absolute path on disk.
    /// Enforces a sandbox: the resolved path must stay inside `self.root`.
    fn resolve_path(&self, id: FileId) -> Result<PathBuf, FileError> {
        let resolved = id
            .vpath()
            .resolve(&self.root)
            .ok_or(FileError::AccessDenied)?;

        // Enforce sandbox: resolved path must stay inside root
        let is_inside = if resolved.exists() {
            resolved
                .canonicalize()
                .ok()
                .and_then(|c| self.root.canonicalize().ok().map(|r| c.starts_with(r)))
                .unwrap_or(false)
        } else {
            // File doesn't exist yet or can't be canonicalized — check component-wise
            !resolved
                .components()
                .any(|c| c == std::path::Component::ParentDir)
        };

        if !is_inside {
            return Err(FileError::AccessDenied);
        }

        Ok(resolved)
    }
}

impl World for TypstWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }

    fn book(&self) -> &LazyHash<FontBook> {
        &self.book
    }

    fn main(&self) -> FileId {
        self.main_id
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        let path = self.resolve_path(id)?;
        let text =
            std::fs::read_to_string(&path).map_err(|e| FileError::from_io(e, &path))?;
        Ok(Source::new(id, text))
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        let path = self.resolve_path(id)?;
        let data = std::fs::read(&path).map_err(|e| FileError::from_io(e, &path))?;
        Ok(Bytes::new(data))
    }

    fn font(&self, index: usize) -> Option<Font> {
        self.fonts.get(index).cloned()
    }

    fn today(&self, offset: Option<i64>) -> Option<Datetime> {
        let now = if let Some(hours) = offset {
            let utc = chrono::Utc::now();
            let secs = hours.checked_mul(3600).and_then(|s| i32::try_from(s).ok())?;
            let offset = chrono::FixedOffset::east_opt(secs)?;
            utc.with_timezone(&offset).naive_local()
        } else {
            chrono::Local::now().naive_local()
        };
        Datetime::from_ymd(
            now.year(),
            now.month() as u8,
            now.day() as u8,
        )
    }
}

// ---------------------------------------------------------------------------
// Helper: extract errors from diagnostics
// ---------------------------------------------------------------------------

fn diagnostics_to_errors(
    world: &TypstWorld,
    diags: &[SourceDiagnostic],
) -> Vec<CompileError> {
    diags
        .iter()
        .map(|diag| {
            let (file, line, col) = if let Some(id) = diag.span.id() {
                let file_name = id
                    .vpath()
                    .as_rootless_path()
                    .to_string_lossy()
                    .to_string();
                if let Ok(source) = world.source(id) {
                    if let Some(range) = source.range(diag.span) {
                        let byte = range.start;
                        let line = source.byte_to_line(byte).unwrap_or(0);
                        let col = source.byte_to_column(byte).unwrap_or(0);
                        (file_name, line, col)
                    } else {
                        (file_name, 0, 0)
                    }
                } else {
                    (file_name, 0, 0)
                }
            } else {
                ("<unknown>".to_string(), 0, 0)
            };

            let severity = match diag.severity {
                typst::diag::Severity::Error => "error",
                typst::diag::Severity::Warning => "warning",
            };

            CompileError {
                file,
                line,
                col,
                message: diag.message.to_string(),
                severity: severity.to_string(),
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Helper: build source map (page index → min source line in entry file)
// ---------------------------------------------------------------------------

fn build_source_map(world: &TypstWorld, document: &PagedDocument) -> Vec<u32> {
    let n = document.pages.len();
    let mut page_min: Vec<Option<usize>> = vec![None; n];

    for (page_idx, page) in document.pages.iter().enumerate() {
        collect_frame(world, &page.frame, page_idx, &mut page_min);
    }

    // Forward-fill gaps so every page has a valid line number
    let mut last = 0u32;
    page_min
        .iter()
        .map(|opt| {
            if let Some(line) = opt {
                last = *line as u32;
            }
            last
        })
        .collect()
}

fn collect_frame(world: &TypstWorld, frame: &Frame, page_idx: usize, map: &mut Vec<Option<usize>>) {
    for (_, item) in frame.items() {
        match item {
            FrameItem::Text(text) => {
                for glyph in &text.glyphs {
                    record_span(world, glyph.span.0, page_idx, map);
                }
            }
            FrameItem::Group(group) => {
                collect_frame(world, &group.frame, page_idx, map);
            }
            FrameItem::Shape(_, span) => record_span(world, *span, page_idx, map),
            FrameItem::Image(_, _, span) => record_span(world, *span, page_idx, map),
            _ => {}
        }
    }
}

fn record_span(world: &TypstWorld, span: Span, page_idx: usize, map: &mut Vec<Option<usize>>) {
    let Some(id) = span.id() else { return };
    if id != world.main() { return }
    let Ok(source) = world.source(id) else { return };
    let Some(range) = source.range(span) else { return };
    let line = source.byte_to_line(range.start).unwrap_or(0);
    let entry = &mut map[page_idx];
    if entry.is_none() || entry.unwrap() > line {
        *entry = Some(line);
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn compile_preview(
    tmp_path: String,
    entry_file: String,
) -> Result<CompileResult, String> {
    tokio::task::spawn_blocking(move || {
        let root = PathBuf::from(&tmp_path).join("data");
        let world = TypstWorld::new(root, &entry_file);

        let warned = typst::compile::<PagedDocument>(&world);

        match warned.output {
            Ok(document) => {
                let pages: Vec<String> = document
                    .pages
                    .iter()
                    .map(|page| typst_svg::svg(page))
                    .collect();

                let warning_errors = diagnostics_to_errors(&world, &warned.warnings);
                let source_map = build_source_map(&world, &document);

                Ok(CompileResult {
                    pages,
                    errors: warning_errors,
                    output: String::new(),
                    source_map,
                })
            }
            Err(diags) => {
                let errors = diagnostics_to_errors(&world, &diags);
                Ok(CompileResult {
                    pages: vec![],
                    errors,
                    output: String::new(),
                    source_map: vec![],
                })
            }
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn export_project(
    tmp_path: String,
    entry_file: String,
    format: String,
    out_path: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let out = PathBuf::from(&out_path);
        if let Some(parent) = out.parent() {
            if !parent.exists() {
                return Err(format!(
                    "Export directory does not exist: {}",
                    parent.display()
                ));
            }
        }

        let root = PathBuf::from(&tmp_path).join("data");
        let world = TypstWorld::new(root, &entry_file);

        let warned = typst::compile::<PagedDocument>(&world);

        let document = warned
            .output
            .map_err(|diags| {
                let msgs: Vec<String> = diags.iter().map(|d| d.message.to_string()).collect();
                format!("Compilation errors: {}", msgs.join("; "))
            })?;

        match format.as_str() {
            "pdf" => {
                let options = typst_pdf::PdfOptions::default();
                let pdf_data = typst_pdf::pdf(&document, &options)
                    .map_err(|diags| {
                        let msgs: Vec<String> =
                            diags.iter().map(|d| d.message.to_string()).collect();
                        format!("PDF export errors: {}", msgs.join("; "))
                    })?;
                std::fs::write(&out, pdf_data)
                    .map_err(|e| format!("Failed to write PDF: {}", e))?;
            }
            "svg" => {
                // For SVG, if multiple pages, write them as separate files
                if document.pages.len() == 1 {
                    let svg_str = typst_svg::svg(&document.pages[0]);
                    std::fs::write(&out, svg_str)
                        .map_err(|e| format!("Failed to write SVG: {}", e))?;
                } else {
                    let stem = out
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let parent = out.parent().unwrap_or(Path::new("."));
                    let ext = out
                        .extension()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    for (i, page) in document.pages.iter().enumerate() {
                        let svg_str = typst_svg::svg(page);
                        let page_path =
                            parent.join(format!("{}_{}.{}", stem, i + 1, ext));
                        std::fs::write(&page_path, svg_str)
                            .map_err(|e| format!("Failed to write SVG page: {}", e))?;
                    }
                }
            }
            "png" => {
                let pixel_per_pt = 2.0;
                if document.pages.len() == 1 {
                    let pixmap = typst_render::render(&document.pages[0], pixel_per_pt);
                    let png_data = pixmap
                        .encode_png()
                        .map_err(|e| format!("PNG encoding error: {}", e))?;
                    std::fs::write(&out, png_data)
                        .map_err(|e| format!("Failed to write PNG: {}", e))?;
                } else {
                    let stem = out
                        .file_stem()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    let parent = out.parent().unwrap_or(Path::new("."));
                    for (i, page) in document.pages.iter().enumerate() {
                        let pixmap = typst_render::render(page, pixel_per_pt);
                        let png_data = pixmap
                            .encode_png()
                            .map_err(|e| format!("PNG encoding error: {}", e))?;
                        let page_path =
                            parent.join(format!("{}_{}.png", stem, i + 1));
                        std::fs::write(&page_path, png_data)
                            .map_err(|e| format!("Failed to write PNG page: {}", e))?;
                    }
                }
            }
            _ => return Err(format!("Unsupported format: {}", format)),
        }

        Ok(())
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_compile_simple_document() {
        let dir = TempDir::new().unwrap();
        let main_path = dir.path().join("main.typ");
        fs::write(&main_path, "= Hello World\n\nUn paragraphe.").unwrap();

        let world = TypstWorld::new(dir.path().to_path_buf(), "main.typ");
        let warned = typst::compile::<PagedDocument>(&world);

        let document = warned.output.expect("Compilation should succeed");
        assert_eq!(document.pages.len(), 1, "Should have exactly 1 page");

        let svg_str = typst_svg::svg(&document.pages[0]);
        assert!(
            svg_str.contains("<svg"),
            "SVG output should contain <svg tag"
        );

        // No error diagnostics expected
        let errors: Vec<_> = warned
            .warnings
            .iter()
            .filter(|d| d.severity == typst::diag::Severity::Error)
            .collect();
        assert!(errors.is_empty(), "Should have no errors");
    }

    #[test]
    fn test_compile_returns_errors_on_invalid_typst() {
        let dir = TempDir::new().unwrap();
        let main_path = dir.path().join("main.typ");
        fs::write(&main_path, "#nonexistent-function()").unwrap();

        let world = TypstWorld::new(dir.path().to_path_buf(), "main.typ");
        let warned = typst::compile::<PagedDocument>(&world);

        assert!(
            warned.output.is_err(),
            "Compilation of invalid typst should fail"
        );

        let diags = warned.output.unwrap_err();
        let errors = diagnostics_to_errors(&world, &diags);
        assert!(
            !errors.is_empty(),
            "Should have at least one error diagnostic"
        );
    }
}
