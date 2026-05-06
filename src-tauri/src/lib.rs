mod commands;

use tauri::Manager;
use commands::{
    filesystem::{
        list_project, create_file, create_folder, rename_path, delete_path,
        read_file, read_file_base64, write_file, import_file, import_folder, import_path,
        read_preview_cache, write_preview_cache,
    },
    project::{new_project, open_project, save_project, cleanup_tmp, cleanup_stale_projects},
    compiler::{compile_preview, export_project, list_cached_packages, list_universe_packages, list_fonts, FontCache},
    ide::{get_completions, get_tooltip, goto_definition, jump_from_click_cmd, invalidate_compile_hashes},
    versioning::{create_version, list_versions, restore_version, render_version_preview},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(FontCache::load())
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            if let Some(typz_path) = args.get(1).filter(|a| a.ends_with(".typz")) {
                let typz = typz_path.clone();
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = tauri::Emitter::emit(&handle, "open-typz", typz);
                });
            }

            // Force-quit when the main window closes, even if the preview popup is hidden.
            let handle = app.handle().clone();
            if let Some(main_win) = app.get_webview_window("main") {
                main_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Destroyed = event {
                        handle.exit(0);
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_project, create_file, create_folder,
            rename_path, delete_path, read_file, read_file_base64, write_file,
            import_file, import_folder, import_path,
            read_preview_cache, write_preview_cache,
            new_project, open_project, save_project, cleanup_tmp, cleanup_stale_projects,
            compile_preview, export_project,
            list_cached_packages, list_universe_packages, list_fonts,
            get_completions, get_tooltip, goto_definition,
            jump_from_click_cmd, invalidate_compile_hashes,
            create_version, list_versions, restore_version, render_version_preview,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
