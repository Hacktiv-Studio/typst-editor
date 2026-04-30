mod commands;

use commands::{
    filesystem::{list_project, create_file, create_folder, rename_path, delete_path, read_file, write_file},
    project::{new_project, open_project, save_project, cleanup_tmp},
    compiler::{compile_preview, export_project},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            list_project, create_file, create_folder,
            rename_path, delete_path, read_file, write_file,
            new_project, open_project, save_project, cleanup_tmp,
            compile_preview, export_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
