use std::collections::HashMap;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock};
use rayon::prelude::*;
use std::time::SystemTime;
use typst::syntax::package::PackageSpec;
use comemo;

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
#[serde(rename_all = "camelCase")]
pub struct PageUpdate {
    pub index: usize,
    pub svg: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CompileResult {
    pub page_count: usize,
    pub page_updates: Vec<PageUpdate>,
    pub errors: Vec<CompileError>,
    pub output: String,
    pub source_map: HashMap<String, Vec<Option<u32>>>,
}

// ---------------------------------------------------------------------------
// FontCache — load system fonts once at startup, share across compilations
// ---------------------------------------------------------------------------

pub struct FontCache {
    pub book: Arc<LazyHash<FontBook>>,
    pub fonts: Arc<Vec<Font>>,
    pub library: Arc<LazyHash<Library>>,
    /// Source file cache: absolute path → (mtime, parsed Source).
    /// Shared across all compilations; invalidated by mtime change.
    pub source_cache: Arc<Mutex<HashMap<PathBuf, (SystemTime, Source)>>>,
    /// Binary file cache: absolute path → (mtime, raw bytes).
    pub file_cache: Arc<Mutex<HashMap<PathBuf, (SystemTime, Bytes)>>>,
    /// SVG page cache from last successful compilation, per project (tmp_path).
    /// Stores (frame_hash, svg_string) per page so unchanged pages skip serialization.
    pub page_cache: Mutex<(String, Vec<(u64, String)>)>,
}

// FontBook and Font are not Send/Sync by default because of raw pointers in
// fontdb data, but we only ever read from them after creation.
unsafe impl Send for FontCache {}
unsafe impl Sync for FontCache {}

impl FontCache {
    pub fn load() -> Self {
        let mut fontdb = fontdb::Database::new();
        fontdb.load_system_fonts();

        let mut book = FontBook::new();
        let mut fonts = Vec::new();

        for face_info in fontdb.faces() {
            let face_id = face_info.id;
            let index = face_info.index;
            if let Some((source, _)) = fontdb.face_source(face_id) {
                let data = match source {
                    fontdb::Source::Binary(data) => (*data).as_ref().to_vec(),
                    fontdb::Source::File(path) => match std::fs::read(&path) {
                        Ok(d) => d,
                        Err(_) => continue,
                    },
                    fontdb::Source::SharedFile(_, data) => (*data).as_ref().to_vec(),
                };
                let bytes = Bytes::new(data);
                if let Some(font) = Font::new(bytes, index) {
                    book.push(font.info().clone());
                    fonts.push(font);
                }
            }
        }

        FontCache {
            book: Arc::new(LazyHash::new(book)),
            fonts: Arc::new(fonts),
            library: Arc::new(LazyHash::new(Library::default())),
            source_cache: Arc::new(Mutex::new(HashMap::new())),
            file_cache: Arc::new(Mutex::new(HashMap::new())),
            page_cache: Mutex::new((String::new(), Vec::new())),
        }
    }
}

// ---------------------------------------------------------------------------
// TypstWorld
// ---------------------------------------------------------------------------

pub struct TypstWorld {
    root: PathBuf,
    main_id: FileId,
    library: Arc<LazyHash<Library>>,
    book: Arc<LazyHash<FontBook>>,
    fonts: Arc<Vec<Font>>,
    source_cache: Arc<Mutex<HashMap<PathBuf, (SystemTime, Source)>>>,
    file_cache: Arc<Mutex<HashMap<PathBuf, (SystemTime, Bytes)>>>,
    /// In-memory content override — bypasses disk for the file being actively edited.
    live_source: Option<(FileId, Source)>,
}

unsafe impl Send for TypstWorld {}

impl TypstWorld {
    pub fn from_cache(
        root: PathBuf,
        main_file: &str,
        book: Arc<LazyHash<FontBook>>,
        fonts: Arc<Vec<Font>>,
        library: Arc<LazyHash<Library>>,
        source_cache: Arc<Mutex<HashMap<PathBuf, (SystemTime, Source)>>>,
        file_cache: Arc<Mutex<HashMap<PathBuf, (SystemTime, Bytes)>>>,
        live_source: Option<(FileId, Source)>,
    ) -> Self {
        let main_id = FileId::new(None, VirtualPath::new(main_file));
        TypstWorld { root, main_id, library, book, fonts, source_cache, file_cache, live_source }
    }

    /// Resolve a FileId to an absolute path on disk.
    /// Package IDs are resolved from the Typst package cache.
    /// Local IDs are sandboxed to `self.root`.
    fn resolve_path(&self, id: FileId) -> Result<PathBuf, FileError> {
        if let Some(spec) = id.package() {
            return self.resolve_package_path(spec, id);
        }

        // Local file — sandbox to project root
        let resolved = id
            .vpath()
            .resolve(&self.root)
            .ok_or(FileError::AccessDenied)?;

        let is_inside = if resolved.exists() {
            resolved
                .canonicalize()
                .ok()
                .and_then(|c| self.root.canonicalize().ok().map(|r| c.starts_with(r)))
                .unwrap_or(false)
        } else {
            !resolved
                .components()
                .any(|c| c == std::path::Component::ParentDir)
        };

        if !is_inside {
            return Err(FileError::AccessDenied);
        }

        Ok(resolved)
    }

    fn resolve_package_path(&self, spec: &PackageSpec, id: FileId) -> Result<PathBuf, FileError> {
        let pkg_root = typst_package_cache_dir()
            .join(spec.namespace.as_str())
            .join(spec.name.as_str())
            .join(spec.version.to_string());

        if !pkg_root.exists() {
            return Err(FileError::NotFound(pkg_root));
        }

        id.vpath()
            .resolve(&pkg_root)
            .ok_or(FileError::AccessDenied)
    }
}

impl World for TypstWorld {
    fn library(&self) -> &LazyHash<Library> {
        &self.library
    }

    fn book(&self) -> &LazyHash<FontBook> {
        &*self.book
    }

    fn main(&self) -> FileId {
        self.main_id
    }

    fn source(&self, id: FileId) -> FileResult<Source> {
        // Live source always wins — used when content is passed directly via IPC
        if let Some((live_id, live_src)) = &self.live_source {
            if *live_id == id {
                return Ok(live_src.clone());
            }
        }
        let path = self.resolve_path(id)?;
        let mtime = std::fs::metadata(&path).and_then(|m| m.modified()).ok();
        if let Some(mt) = mtime {
            let cache = self.source_cache.lock().unwrap();
            if let Some((cached_mt, src)) = cache.get(&path) {
                if *cached_mt == mt {
                    return Ok(src.clone());
                }
            }
        }
        let text = std::fs::read_to_string(&path).map_err(|e| FileError::from_io(e, &path))?;
        let source = Source::new(id, text);
        if let Some(mt) = mtime {
            self.source_cache.lock().unwrap().insert(path, (mt, source.clone()));
        }
        Ok(source)
    }

    fn file(&self, id: FileId) -> FileResult<Bytes> {
        let path = self.resolve_path(id)?;
        let mtime = std::fs::metadata(&path).and_then(|m| m.modified()).ok();
        if let Some(mt) = mtime {
            let cache = self.file_cache.lock().unwrap();
            if let Some((cached_mt, bytes)) = cache.get(&path) {
                if *cached_mt == mt {
                    return Ok(bytes.clone());
                }
            }
        }
        let data = std::fs::read(&path).map_err(|e| FileError::from_io(e, &path))?;
        let bytes = Bytes::new(data);
        if let Some(mt) = mtime {
            self.file_cache.lock().unwrap().insert(path, (mt, bytes.clone()));
        }
        Ok(bytes)
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

fn build_source_map(world: &TypstWorld, document: &PagedDocument) -> HashMap<String, Vec<Option<u32>>> {
    let n = document.pages.len();

    let mut line_first_page: HashMap<(String, usize), usize> = HashMap::new();
    // Cache (Source, file_path) per FileId to avoid locking source_cache per glyph.
    // A 30-page document can have 20k+ spans across 2-3 source files — without this
    // we'd acquire the mutex once per span instead of once per unique file.
    let mut local_srcs: HashMap<FileId, Option<(Source, String)>> = HashMap::new();

    for (page_idx, page) in document.pages.iter().enumerate() {
        collect_frame(world, &page.frame, page_idx, &mut line_first_page, &mut local_srcs);
    }

    let mut per_file: HashMap<String, Vec<Option<usize>>> = HashMap::new();
    for ((file_path, line), first_page) in &line_first_page {
        let page_map = per_file
            .entry(file_path.clone())
            .or_insert_with(|| vec![None; n]);
        let entry = &mut page_map[*first_page];
        if entry.is_none() || entry.unwrap() > *line {
            *entry = Some(*line);
        }
    }

    per_file
        .into_iter()
        .map(|(k, v)| (k, v.iter().map(|opt| opt.map(|l| l as u32)).collect()))
        .collect()
}

fn collect_frame(
    world: &TypstWorld,
    frame: &Frame,
    page_idx: usize,
    map: &mut HashMap<(String, usize), usize>,
    local_srcs: &mut HashMap<FileId, Option<(Source, String)>>,
) {
    for (_, item) in frame.items() {
        match item {
            FrameItem::Text(text) => {
                for glyph in &text.glyphs {
                    record_span(world, glyph.span.0, page_idx, map, local_srcs);
                }
            }
            FrameItem::Group(group) => {
                collect_frame(world, &group.frame, page_idx, map, local_srcs);
            }
            FrameItem::Shape(_, span) => record_span(world, *span, page_idx, map, local_srcs),
            FrameItem::Image(_, _, span) => record_span(world, *span, page_idx, map, local_srcs),
            _ => {}
        }
    }
}

fn record_span(
    world: &TypstWorld,
    span: Span,
    page_idx: usize,
    map: &mut HashMap<(String, usize), usize>,
    local_srcs: &mut HashMap<FileId, Option<(Source, String)>>,
) {
    let Some(id) = span.id() else { return };
    if id.package().is_some() { return }
    let entry = local_srcs.entry(id).or_insert_with(|| {
        world.source(id).ok().map(|src| {
            let path = id.vpath().as_rootless_path().to_string_lossy().to_string();
            (src, path)
        })
    });
    let Some((source, file_path)) = entry else { return };
    let Some(range) = source.range(span) else { return };
    let line = source.byte_to_line(range.start).unwrap_or(0);
    map.entry((file_path.clone(), line)).or_insert(page_idx);
}

// ---------------------------------------------------------------------------
// Package cache utilities
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CachedPackage {
    pub namespace: String,
    pub name: String,
    pub version: String,
}

fn typst_package_cache_dir() -> PathBuf {
    // Typst stores packages in $XDG_CACHE_HOME/typst/packages/ (Linux/macOS)
    // or $LOCALAPPDATA/typst/packages/ (Windows)
    #[cfg(target_os = "windows")]
    {
        std::env::var("LOCALAPPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."))
            .join("typst")
            .join("packages")
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("XDG_CACHE_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                std::env::var("HOME")
                    .map(|h| PathBuf::from(h).join(".cache"))
                    .unwrap_or_else(|_| PathBuf::from(".cache"))
            })
            .join("typst")
            .join("packages")
    }
}

#[tauri::command]
pub async fn list_fonts(font_cache: tauri::State<'_, FontCache>) -> Result<Vec<String>, String> {
    let mut families: std::collections::BTreeSet<String> = std::collections::BTreeSet::new();
    for font in font_cache.fonts.iter() {
        families.insert(font.info().family.to_string());
    }
    Ok(families.into_iter().collect())
}

#[tauri::command]
pub async fn list_cached_packages() -> Vec<CachedPackage> {
    tokio::task::spawn_blocking(|| {
        let cache = typst_package_cache_dir();
        let mut result = Vec::new();
        let Ok(ns_entries) = std::fs::read_dir(&cache) else { return result };
        for ns in ns_entries.flatten() {
            if !ns.path().is_dir() { continue }
            let namespace = ns.file_name().to_string_lossy().into_owned();
            let Ok(name_entries) = std::fs::read_dir(ns.path()) else { continue };
            for n in name_entries.flatten() {
                if !n.path().is_dir() { continue }
                let name = n.file_name().to_string_lossy().into_owned();
                let Ok(ver_entries) = std::fs::read_dir(n.path()) else { continue };
                for v in ver_entries.flatten() {
                    if !v.path().is_dir() { continue }
                    let version = v.file_name().to_string_lossy().into_owned();
                    result.push(CachedPackage {
                        namespace: namespace.clone(),
                        name: name.clone(),
                        version,
                    });
                }
            }
        }
        result
    })
    .await
    .unwrap_or_default()
}

static UNIVERSE_CACHE: OnceLock<Vec<CachedPackage>> = OnceLock::new();

#[derive(Deserialize)]
struct UniverseEntry {
    name: String,
    version: String,
}

fn parse_semver(v: &str) -> (u32, u32, u32) {
    let p: Vec<u32> = v.split('.').map(|s| s.parse().unwrap_or(0)).collect();
    (
        p.first().copied().unwrap_or(0),
        p.get(1).copied().unwrap_or(0),
        p.get(2).copied().unwrap_or(0),
    )
}

fn fetch_universe_blocking() -> Vec<CachedPackage> {
    let entries: Vec<UniverseEntry> = match ureq::get("https://packages.typst.org/preview/index.json")
        .call()
        .and_then(|r| Ok(r.into_json()?))
    {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let mut latest: HashMap<String, String> = HashMap::new();
    for e in entries {
        let cur = latest.entry(e.name.clone()).or_insert_with(|| e.version.clone());
        if parse_semver(&e.version) > parse_semver(cur) {
            *cur = e.version;
        }
    }

    let mut result: Vec<CachedPackage> = latest
        .into_iter()
        .map(|(name, version)| CachedPackage {
            namespace: "preview".to_string(),
            name,
            version,
        })
        .collect();
    result.sort_by(|a, b| a.name.cmp(&b.name));
    result
}

#[tauri::command]
pub async fn list_universe_packages() -> Vec<CachedPackage> {
    if let Some(cached) = UNIVERSE_CACHE.get() {
        return cached.clone();
    }
    let pkgs = tokio::task::spawn_blocking(fetch_universe_blocking)
        .await
        .unwrap_or_default();
    let _ = UNIVERSE_CACHE.set(pkgs.clone());
    UNIVERSE_CACHE.get().cloned().unwrap_or(pkgs)
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn compile_preview(
    font_cache: tauri::State<'_, FontCache>,
    tmp_path: String,
    entry_file: String,
    current_file: Option<String>,
    content: Option<String>,
) -> Result<CompileResult, String> {
    let book = Arc::clone(&font_cache.book);
    let fonts = Arc::clone(&font_cache.fonts);
    let library = Arc::clone(&font_cache.library);
    let source_cache = Arc::clone(&font_cache.source_cache);
    let file_cache = Arc::clone(&font_cache.file_cache);

    // Build live source and kick off background disk write concurrently.
    // The compilation uses in-memory content; disk write catches up for persistence
    // and IDE operations (goto-def, completions) that read from disk.
    let live_source: Option<(FileId, Source)> = match (current_file, content) {
        (Some(cf), Some(cnt)) => {
            let disk_path = PathBuf::from(&tmp_path).join("data")
                .join(cf.trim_start_matches('/'));
            let cnt_disk = cnt.clone();
            tokio::spawn(async move {
                let _ = tokio::fs::write(disk_path, cnt_disk).await;
            });
            let id = FileId::new(None, VirtualPath::new(&cf));
            let src = Source::new(id, cnt);
            Some((id, src))
        }
        _ => None,
    };

    // Read previous page cache (reset if project changed)
    let prev_cache: Vec<(u64, String)> = {
        let mut pc = font_cache.page_cache.lock().unwrap();
        if pc.0 != tmp_path {
            *pc = (tmp_path.clone(), Vec::new());
        }
        pc.1.clone()
    };

    let (result, new_cache) = tokio::task::spawn_blocking(move || {
        let root = PathBuf::from(&tmp_path).join("data");
        let world = TypstWorld::from_cache(root, &entry_file, book, fonts, library, source_cache, file_cache, live_source);
        let warned = typst::compile::<PagedDocument>(&world);
        // Evict stale comemo cache entries to prevent unbounded memory growth
        comemo::evict(30);

        match warned.output {
            Ok(document) => {
                let page_count = document.pages.len();
                let use_prev = prev_cache.len() == page_count;

                // Hash all frames cheaply (no string allocation) to detect changes
                let frame_hashes: Vec<u64> = document.pages.iter().map(|page| {
                    let mut h = DefaultHasher::new();
                    page.frame.hash(&mut h);
                    h.finish()
                }).collect();

                // Serialize only changed pages in parallel
                let new_svgs: Vec<Option<String>> = document.pages
                    .par_iter()
                    .zip(frame_hashes.par_iter())
                    .enumerate()
                    .map(|(i, (page, &fh))| {
                        if use_prev && prev_cache.get(i).map(|(ph, _)| *ph) == Some(fh) {
                            None // frame unchanged — skip serialization
                        } else {
                            Some(typst_svg::svg(page))
                        }
                    })
                    .collect();

                let mut new_cache: Vec<(u64, String)> = Vec::with_capacity(page_count);
                let mut page_updates: Vec<PageUpdate> = Vec::new();

                for (i, (&fh, svg_opt)) in frame_hashes.iter().zip(new_svgs.into_iter()).enumerate() {
                    match svg_opt {
                        Some(svg) => {
                            page_updates.push(PageUpdate { index: i, svg: svg.clone() });
                            new_cache.push((fh, svg));
                        }
                        None => {
                            // Reuse cached SVG string — frame is visually identical
                            new_cache.push((fh, prev_cache[i].1.clone()));
                        }
                    }
                }

                let result = Ok(CompileResult {
                    page_count,
                    page_updates,
                    errors: diagnostics_to_errors(&world, &warned.warnings),
                    output: String::new(),
                    source_map: build_source_map(&world, &document),
                });
                (result, new_cache)
            }
            Err(diags) => {
                let result = Ok(CompileResult {
                    page_count: 0,
                    page_updates: vec![],
                    errors: diagnostics_to_errors(&world, &diags),
                    output: String::new(),
                    source_map: HashMap::new(),
                });
                (result, vec![])
            }
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    // Persist page cache for next compilation
    if !new_cache.is_empty() {
        font_cache.page_cache.lock().unwrap().1 = new_cache;
    }

    result
}

#[tauri::command]
pub async fn export_project(
    font_cache: tauri::State<'_, FontCache>,
    tmp_path: String,
    entry_file: String,
    format: String,
    out_path: String,
) -> Result<(), String> {
    let book = Arc::clone(&font_cache.book);
    let fonts = Arc::clone(&font_cache.fonts);
    let library = Arc::clone(&font_cache.library);
    let source_cache = Arc::clone(&font_cache.source_cache);
    let file_cache = Arc::clone(&font_cache.file_cache);

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
        let world = TypstWorld::from_cache(root, &entry_file, book, fonts, library, source_cache, file_cache, None);

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
