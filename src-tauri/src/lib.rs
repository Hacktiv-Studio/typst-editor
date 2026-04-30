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
        .setup(|app| {
            let args: Vec<String> = std::env::args().collect();
            if let Some(typz_path) = args.get(1).filter(|a| a.ends_with(".typz")) {
                let typz = typz_path.clone();
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = tauri::Emitter::emit(&handle, "open-typz", typz);
                });
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_project, create_file, create_folder,
            rename_path, delete_path, read_file, write_file,
            new_project, open_project, save_project, cleanup_tmp,
            compile_preview, export_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
