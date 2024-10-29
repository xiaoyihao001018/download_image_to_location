# Tauri + Angular

This template should help get you started developing with Tauri and Angular.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) + [Angular Language Service](https://marketplace.visualstudio.com/items?itemName=Angular.ng-template).

::: mermaid
graph TD
    A[用户界面] -->|点击加载| B[Angular Service]
    B -->|invoke| C[Tauri Backend]
    C -->|fetch_images| D[远程服务器]
    D -->|返回URL列表| C
    C -->|返回数据| B
    B -->|检查缓存| C
    C -->|检查结果| B
    B -->|下载未缓存图片| C
    C -->|保存到本地| E[本地缓存]
    B -->|更新状态| A
:::