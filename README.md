# Tauri + Angular 图片缓存应用

## 功能概述

### A. 初始化流程
1. 应用启动时，`DownloadQueueService` 开始周期性检查
2. `ImageService` 订阅下载完成事件
3. `AppComponent` 订阅闲时下载状态

### B. 图片加载流程
1. 用户点击加载按钮
2. `ImageService` 调用后端 API 获取图片 URL
3. 检查每个图片是否已缓存
4. 未缓存的图片添加到下载队列

### C. 闲时下载流程
1. 周期性检查网络状态
2. 如果网络状况良好，启动闲时下载
3. 从队列中获取待下载任务
4. 下载完成后更新缓存状态

## 开发环境设置

### 1. 安装依赖

```bash
# 创建项目
pnpm create tauri-app
cd tauri-app

# 安装依赖
pnpm install
```

### 2. 后端实现

创建 Rust 后端文件 `src-tauri/src/lib.rs`:

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::Manager;

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
        .map_err(|e| e.to_string())?;
    
    let image_response: ImageResponse = response
        .json()
        .await
        .map_err(|e| e.to_string())?;
    
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
    std::fs::create_dir_all(cache_dir).map_err(|e| e.to_string())?;
    let file_path = cache_dir.join(file_name);
    
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

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            fetch_images,
            check_local_image,
            download_image
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3. 前端组件实现

创建 `src/app/app.component.html`:

```html
<main class="container">
  <div class="controls">
    <input type="number" [(ngModel)]="imageCount" min="1" max="20">
    <button (click)="loadImages()">加载图片</button>
  </div>

  <div class="download-queue" *ngIf="(downloadQueue$ | async)?.length">
    <h3>下载队列状态</h3>
    <div class="queue-controls">
      <button (click)="startIdleDownload()" [disabled]="isIdleDownloading">开始闲时下载</button>
      <button (click)="pauseIdleDownload()" [disabled]="!isIdleDownloading">暂停闲时下载</button>
    </div>
    <div class="queue-items">
      <div class="queue-item" *ngFor="let task of downloadQueue$ | async">
        <div class="task-info">
          <span class="filename">{{ getFileName(task.url) }}</span>
          <span class="status" [class]="task.status">
            {{ getStatusText(task.status) }}
          </span>
        </div>
        <div class="priority">
          优先级: {{ getPriorityText(task.priority) }}
        </div>
      </div>
    </div>
  </div>

  <div class="image-container">
    <ng-container *ngFor="let image of imageUrls$ | async">
      <div class="image-wrapper" [class.cached]="image.isCached">
        <img [src]="image.displayUrl" loading="eager" alt="template image" />
        <div class="cache-info" *ngIf="image.isCached">
          <div class="cache-badge">已缓存</div>
          <div class="cache-path">{{ image.cachePath }}</div>
        </div>
        <div>Debug: {{image.displayUrl}}</div>
      </div>
    </ng-container>
  </div>
</main>
```

创建 `src/app/app.component.css`:

```css
.container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.controls {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

.image-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
  padding: 20px 0;
}

.image-wrapper {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  background: #f5f5f5;
}

.image-wrapper img {
  width: 100%;
  height: auto;
  display: block;
}

.image-wrapper.cached {
  border: 2px solid #4CAF50;
}

.cache-info {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(0,0,0,0.7);
  padding: 8px;
  color: white;
}

.cache-badge {
  font-weight: bold;
  margin-bottom: 4px;
}

.cache-path {
  font-size: 12px;
  word-break: break-all;
  opacity: 0.8;
}

.download-queue {
  width: 100%;
  max-width: 800px;
  margin: 20px auto;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.download-queue h3 {
  margin: 0 0 15px;
  color: #333;
}

.queue-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.queue-item {
  padding: 10px;
  background: white;
  border-radius: 4px;
  border-left: 4px solid #4CAF50;
}

.task-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.filename {
  font-weight: 500;
  color: #333;
}

.status {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.status.pending {
  background: #FFF3E0;
  color: #E65100;
}

.status.downloading {
  background: #E3F2FD;
  color: #1565C0;
}

.status.completed {
  background: #E8F5E9;
  color: #2E7D32;
}

.status.failed {
  background: #FFEBEE;
  color: #C62828;
}

.queue-controls {
  margin-bottom: 15px;
  display: flex;
  gap: 10px;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: #2196F3;
  color: white;
  cursor: pointer;
  transition: background 0.3s;
}

button:hover {
  background: #1976D2;
}

button:disabled {
  background: #BDBDBD;
  cursor: not-allowed;
}

input[type="number"] {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 80px;
}
```

创建 `src/app/app.component.ts`:

```typescript
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { ImageService } from './services/image.service';
import { FormsModule } from '@angular/forms';
import { DownloadQueueService } from './services/download-queue.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  imageUrls$ = this.imageService.getImages();
  downloadQueue$ = this.downloadQueueService.getQueueStatus();
  imageCount = 5;
  isIdleDownloading = false;

  constructor(
    private imageService: ImageService,
    private downloadQueueService: DownloadQueueService
  ) {
    this.downloadQueueService.getIdleStatus().subscribe(
      isIdle => this.isIdleDownloading = isIdle
    );
  }

  loadImages() {
    this.imageService.fetchImages(this.imageCount);
  }

  getFileName(url: string): string {
    return url.split('/').pop() || url;
  }

  getStatusText(status: string): string {
    const statusMap: { [key: string]: string } = {
      'pending': '等待下载',
      'downloading': '正在下载',
      'completed': '已完成',
      'failed': '下载失败'
    };
    return statusMap[status] || status;
  }

  getPriorityText(priority: number): string {
    const priorityMap: { [key: number]: string } = {
      1: '高',
      2: '中',
      3: '低（闲时下载）'
    };
    return priorityMap[priority] || String(priority);
  }

  startIdleDownload() {
    this.downloadQueueService.startIdleDownload();
  }

  pauseIdleDownload() {
    this.downloadQueueService.pauseIdleDownload();
  }
}
```

### 4. 服务层实现

创建 `src/app/services/image.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { DownloadQueueService } from './download-queue.service';

export interface ImageState {
  url: string;
  displayUrl: string;
  isCached: boolean;
  cachePath: string | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private imageUrls = new BehaviorSubject<ImageState[]>([]);
  private isLoading = new BehaviorSubject<boolean>(false);

  constructor(private downloadQueueService: DownloadQueueService) {
    this.initializeService();
  }

  private initializeService() {
    this.downloadQueueService.getDownloadCompleteObservable().subscribe(
      ({ url, cachePath }) => {
        this.updateImageState(url, cachePath);
      }
    );
  }

  getImages(): Observable<ImageState[]> {
    return this.imageUrls.asObservable();
  }

  getLoadingState(): Observable<boolean> {
    return this.isLoading.asObservable();
  }

  updateImageState(url: string, cachePath: string) {
    const currentImages = this.imageUrls.value;
    const imageIndex = currentImages.findIndex(image => image.url === url);

    if (imageIndex !== -1) {
      currentImages[imageIndex].isCached = true;
      currentImages[imageIndex].cachePath = cachePath;
      currentImages[imageIndex].displayUrl = convertFileSrc(cachePath);
    } else {
      currentImages.push({
        url,
        displayUrl: convertFileSrc(cachePath),
        isCached: true,
        cachePath
      });
    }

    this.imageUrls.next([...currentImages]);
  }

  async fetchImages(num: number) {
    try {
      this.isLoading.next(true);
      const urls = await invoke<string[]>('fetch_images', { num });

      const imageStates = await Promise.all(
        urls.map(async (url) => {
          const exists = await invoke<boolean>('check_local_image', { url });
          let cachePath: string | undefined;
          let displayUrl = url;
          
          if (exists) {
            cachePath = await invoke<string>('download_image', { url });
            displayUrl = convertFileSrc(cachePath);
            console.log(`Using cached image: ${displayUrl}`);
          } else {
            console.log(`Adding to download queue: ${url}`);
            this.downloadQueueService.addToQueue(url, 3);
          }
          
          return { 
            url, 
            displayUrl,
            isCached: exists, 
            cachePath 
          };
        })
      );

      this.imageUrls.next(imageStates);
    } catch (error) {
      console.error('Failed to fetch images:', error);
    } finally {
      this.isLoading.next(false);
    }
  }

  async preloadImages(urls: string[]) {
    for (const url of urls) {
      const exists = await invoke<boolean>('check_local_image', { url });
      if (!exists) {
        this.downloadQueueService.addToQueue(url, 2); // 优先级2表示预加载
      }
    }
  }

  clearCache() {
    this.imageUrls.next([]);
  }
}
```

创建 `src/app/services/download-queue.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { invoke } from '@tauri-apps/api/core';

export interface DownloadTask {
  url: string;
  priority: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  retryCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class DownloadQueueService {
  private downloadQueue = new BehaviorSubject<DownloadTask[]>([]);
  private isDownloading = false;
  private isIdle = false;
  private isIdleSubject = new BehaviorSubject<boolean>(false);
  private downloadCompleteSubject = new Subject<{ url: string, cachePath: string }>();
  private maxRetries = 3;
  private maxConcurrentDownloads = 2;

  constructor() {
    this.startPeriodicCheck();
  }

  getQueueStatus() {
    return this.downloadQueue.asObservable();
  }

  getIdleStatus() {
    return this.isIdleSubject.asObservable();
  }

  getDownloadCompleteObservable() {
    return this.downloadCompleteSubject.asObservable();
  }

  addToQueue(url: string, priority: number) {
    const currentQueue = this.downloadQueue.value;
    if (!currentQueue.some(task => task.url === url)) {
      currentQueue.push({
        url,
        priority,
        status: 'pending',
        retryCount: 0
      });
      this.downloadQueue.next(this.sortQueue(currentQueue));
      this.checkAndStartDownload();
    }
  }

  private sortQueue(queue: DownloadTask[]): DownloadTask[] {
    return [...queue].sort((a, b) => {
      if (a.status === 'downloading') return -1;
      if (b.status === 'downloading') return 1;
      return a.priority - b.priority;
    });
  }

  async isNetworkFastEnough(): Promise<boolean> {
    if (!navigator.onLine) {
      console.warn('No internet connection');
      return false;
    }

    const testImageUrl = 'https://backend.nebularfantasy.com:9001/api/backend/getSmallGameTemplateImg';
    const startTime = Date.now();

    try {
      const response = await fetch(testImageUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ num: 1 })
      });

      if (!response.ok) {
        console.error('Failed to fetch test image:', response.statusText);
        return false;
      }

      const duration = Date.now() - startTime;
      const speed = 1000 / duration; // 请求每秒的速度
      console.log(`Network speed: ${speed} requests per second`);
      return speed > 0.5; // 如果每秒可以处理超过0.5个请求，则认为网络足够快
    } catch (error) {
      console.error('Error during network speed test:', error);
      return false;
    }
  }

  startIdleDownload() {
    this.isIdle = true;
    this.isIdleSubject.next(this.isIdle);
    this.checkAndStartDownload();
  }

  pauseIdleDownload() {
    this.isIdle = false;
    this.isIdleSubject.next(this.isIdle);
  }

  private async checkAndStartDownload() {
    if (this.isDownloading) {
      return;
    }

    const currentQueue = this.downloadQueue.value;
    const pendingTasks = currentQueue.filter(
      task => task.status === 'pending'
    );

    if (pendingTasks.length === 0) {
      return;
    }

    const downloadingTasks = currentQueue.filter(
      task => task.status === 'downloading'
    );

    if (downloadingTasks.length >= this.maxConcurrentDownloads) {
      return;
    }

    const nextTask = pendingTasks[0];
    if (nextTask.priority === 3 && !this.isIdle) {
      return; // 如果是闲时下载任务且当前不是闲时，则不开始下载
    }

    this.isDownloading = true;
    nextTask.status = 'downloading';
    this.downloadQueue.next(this.sortQueue(currentQueue));

    try {
      const cachePath = await invoke<string>('download_image', { url: nextTask.url });
      nextTask.status = 'completed';
      this.downloadCompleteSubject.next({ url: nextTask.url, cachePath });
    } catch (error) {
      console.error(`Failed to download ${nextTask.url}:`, error);
      nextTask.status = 'failed';
      nextTask.retryCount++;
      
      if (nextTask.retryCount < this.maxRetries) {
        nextTask.status = 'pending';
      }
    } finally {
      this.isDownloading = false;
      this.downloadQueue.next(this.sortQueue(currentQueue));
      this.checkAndStartDownload(); // 检查是否有更多任务需要下载
    }
  }

  private startPeriodicCheck() {
    setInterval(async () => {
      if (await this.isNetworkFastEnough()) {
        console.log('Network is fast enough, starting idle download...');
        this.startIdleDownload();
      } else {
        console.log('Network is too slow, pausing downloads...');
        this.pauseIdleDownload();
      }
    }, 60000); // 每60秒检查一次
  }
}
```

### 5. 项目配置文件

#### package.json 的变化:

```json
{
  "name": "tauri-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "ng": "ng",
    "start": "ng serve",
    "build": "ng build",
    "watch": "ng build --watch --configuration development",
    "test": "ng test",
    "tauri": "tauri",
    "dev": "tauri dev",
    "build:tauri": "tauri build"
  },
  "dependencies": {
    "@angular/animations": "^17.0.0",
    "@angular/common": "^17.0.0",
    "@angular/compiler": "^17.0.0",
    "@angular/core": "^17.0.0",
    "@angular/forms": "^17.0.0",
    "@angular/platform-browser": "^17.0.0",
    "@angular/platform-browser-dynamic": "^17.0.0",
    "@angular/router": "^17.0.0",
    "@tauri-apps/api": "^1.5.2",
    "rxjs": "~7.8.0",
    "tslib": "^2.3.0",
    "zone.js": "~0.14.2"
  },
  "devDependencies": {
    "@angular-devkit/build-angular": "^17.0.0",
    "@angular/cli": "^17.0.0",
    "@angular/compiler-cli": "^17.0.0",
    "@tauri-apps/cli": "^1.5.8",
    "@types/jasmine": "~5.1.0",
    "jasmine-core": "~5.1.0",
    "karma": "~6.4.0",
    "karma-chrome-launcher": "~3.2.0",
    "karma-coverage": "~2.2.0",
    "karma-jasmine": "~5.1.0",
    "karma-jasmine-html-reporter": "~2.1.0",
    "typescript": "~5.2.2"
  }
}
```

#### Cargo.toml (src-tauri/Cargo.toml) 的变化:

```toml
[package]
name = "tauri-app"
version = "0.0.0"
description = "A Tauri App"
authors = ["you"]
license = ""
repository = ""
edition = "2021"

[build-dependencies]
tauri-build = { version = "1.5", features = [] }

[dependencies]
tauri = { version = "1.5", features = [ "shell-open", "protocol-asset"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.28.1", features = ["full"] }
reqwest = { version = "0.11", features = ["json"] }
futures = "0.3"

[features]
custom-protocol = ["tauri/custom-protocol"]
```

#### tauri.conf.json 的完整配置:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "build": {
    "beforeDevCommand": "pnpm start",
    "beforeBuildCommand": "pnpm build",
    "devPath": "http://localhost:4200",
    "distDir": "../dist/tauri-app/browser"
  },
  "package": {
    "productName": "Tauri Image Cache App",
    "version": "0.1.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "all": false,
        "open": true
      },
      "protocol": {
        "asset": true,
        "assetScope": {
          "allow": ["**"],
          "deny": []
        }
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.tauri.image.cache",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "resources": [],
      "externalBin": [],
      "copyright": "",
      "category": "DeveloperTool",
      "shortDescription": "",
      "longDescription": "",
      "deb": {
        "depends": []
      },
      "macOS": {
        "frameworks": [],
        "minimumSystemVersion": "",
        "exceptionDomain": "",
        "signingIdentity": null,
        "entitlements": null
      },
      "windows": {
        "certificateThumbprint": null,
        "digestAlgorithm": "sha256",
        "timestampUrl": ""
      }
    },
    "security": {
      "csp": {
        "default-src": ["'self'"],
        "img-src": [
          "'self'",
          "asset:",
          "https:",
          "http:",
          "data:",
          "https://backend.nebularfantasy.com:9001",
          "https://oss.nebularfantasy.com"
        ],
        "connect-src": [
          "'self'",
          "https:",
          "http:",
          "tauri:",
          "https://backend.nebularfantasy.com:9001",
          "https://oss.nebularfantasy.com"
        ]
      }
    },
    "windows": [
      {
        "title": "Tauri Image Cache App",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false,
        "center": true
      }
    ]
  }
}
```

#### angular.json 的主要变化:

```json
{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "tauri-app": {
      "projectType": "application",
      "schematics": {},
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:browser",
          "options": {
            "outputPath": "dist/tauri-app/browser",
            "index": "src/index.html",
            "main": "src/main.ts",
            "polyfills": [
              "zone.js"
            ],
            "tsConfig": "tsconfig.app.json",
            "assets": [
              "src/favicon.ico",
              "src/assets"
            ],
            "styles": [
              "src/styles.css"
            ],
            "scripts": []
          },          "configurations": {
            "production": {
              "budgets": [
                {
                  "type": "initial",
                  "maximumWarning": "500kb",
                  "maximumError": "1mb"
                },
                {
                  "type": "anyComponentStyle",
                  "maximumWarning": "2kb",
                  "maximumError": "4kb"
                }
              ],
              "outputHashing": "all"
