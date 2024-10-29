// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            fetch_images,
            check_local_image,
            download_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use reqwest;
use tokio;
use serde::{Deserialize, Serialize};
use std::env;
use serde_json;

#[derive(Debug, Serialize, Deserialize)]
struct ImageResponse {
    success: bool,
    message: String,
    status: i32,
    data: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ImageRequest {
    num: i32,
}

#[tauri::command]
async fn fetch_images(num: i32) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let response = client
        .post("https://backend.nebularfantasy.com:9001/api/backend/getSmallGameTemplateImg")
        .json(&ImageRequest { num })
        .send()
        .await
        .map_err(|e| format!("Request error: {}", e))?;
    
    let text = response.text().await
        .map_err(|e| format!("Failed to get response text: {}", e))?;
    
    let image_response: ImageResponse = serde_json::from_str(&text)
        .map_err(|e| format!("JSON parse error: {} for text: {}", e, text))?;
    
    Ok(image_response.data)
}

#[tauri::command]
async fn check_local_image(url: &str) -> Result<bool, String> {
    let file_name = url.split('/').last().unwrap_or_default();
    let cache_dir = std::path::Path::new("C:\\ProgramData\\TauriImageCache");
    let file_path = cache_dir.join(file_name);
    Ok(file_path.exists())
}

#[tauri::command]
async fn download_image(url: &str) -> Result<String, String> {
    let file_name = url.split('/').last().unwrap_or_default();
    let cache_dir = std::path::Path::new("C:\\ProgramData\\TauriImageCache");
    
    // 确保缓存目录存在
    std::fs::create_dir_all(cache_dir).map_err(|e| e.to_string())?;
    let file_path = cache_dir.join(file_name);
    
    // 如果文件已存在，直接返回路径
    if file_path.exists() {
        return Ok(file_path.to_string_lossy().to_string());
    }
    
    let response = reqwest::get(url)
        .await
        .map_err(|e| e.to_string())?;
    
    let bytes = response.bytes()
        .await
        .map_err(|e| e.to_string())?;
    
    tokio::fs::write(&file_path, bytes)
        .await
        .map_err(|e| e.to_string())?;
    
    Ok(file_path.to_string_lossy().to_string())
}
