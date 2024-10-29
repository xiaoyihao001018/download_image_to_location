# 详细工作流程

## A. 初始化流程
1. 应用启动时，`DownloadQueueService` 开始周期性检查
2. `ImageService` 订阅下载完成事件
3. `AppComponent` 订阅闲时下载状态

## B. 图片加载流程
1. 用户点击加载按钮
2. `ImageService` 调用后端 API 获取图片 URL
3. 检查每个图片是否已缓存
4. 未缓存的图片添加到下载队列

## C. 闲时下载流程
1. 周期性检查网络状态
2. 如果网络状况良好，启动闲时下载
3. 从队列中获取待下载任务
4. 下载完成后更新缓存状态

---

### 详细说明

#### 初始化流程
- `DownloadQueueService` 在构造函数中启动 `startPeriodicCheck()`
- `ImageService` 通过 `getDownloadCompleteObservable()` 监听下载完成事件
- `AppComponent` 通过 `getIdleStatus()` 监听闲时下载状态

#### 图片加载流程
- 通过 `loadImages()` 触发图片加载
- `fetchImages()` 方法调用 Tauri 后端获取图片 URL
- `check_local_image` 命令检查本地缓存状态
- `addToQueue()` 将未缓存图片加入下载队列

#### 闲时下载流程
- `isNetworkFastEnough()` 检测网络状态
- `startIdleDownload()` 启动闲时下载
- `processQueue()` 处理下载队列
- `updateImageState()` 更新图片缓存状态

::: mermaid
graph TD
    subgraph 用户界面
        A[加载按钮]
        B[闲时下载控制]
        C[下载队列显示]
    end

    subgraph 服务层
        D[ImageService]
        E[DownloadQueueService]
        F[网络状态检测]
    end

    subgraph 后端
        G[Tauri Backend]
        H[本地缓存]
    end

    A -->|点击| D
    D -->|获取URLs| G
    G -->|返回URLs| D
    D -->|添加任务| E
    E -->|检查| F
    F -->|状态更新| E
    E -->|下载请求| G
    G -->|保存| H
    G -->|完成通知| E
    E -->|状态更新| C
    B -->|控制| E
    H -->|缓存状态| D
    D -->|更新显示| C
:::

