import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { invoke } from '@tauri-apps/api/core';

interface DownloadTask {
    url: string;
    priority: number;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
    progress?: number;
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

    constructor() {
        this.startPeriodicCheck();
    }

    getDownloadCompleteObservable() {
        return this.downloadCompleteSubject.asObservable();
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
                body: JSON.stringify({ num: 1 }) // 只请求一张图片
            });

            if (!response.ok) {
                console.error('Failed to fetch test image:', response.statusText);
                return false;
            }

            const duration = Date.now() - startTime;
            const speed = 1000 / duration; // 简单的速度计算
            console.log(`Network speed: ${speed} requests per second`);
            return speed > 0.5; 
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

    private startPeriodicCheck() {
        setInterval(async () => {
            if (await this.isNetworkFastEnough()) {
                console.log('Network is fast enough, starting idle download...');
                this.startIdleDownload();
            } else {
                console.log('Network is too slow, pausing downloads...');
                this.pauseIdleDownload();
            }

            const urls = await this.fetchImageUrls();
            for (const url of urls) {
                const exists = await invoke<boolean>('check_local_image', { url });
                if (!exists) {
                    this.addToQueue(url, 3);
                }
            }
        }, 6000); // 每60秒检查一次
    }

    private async fetchImageUrls(): Promise<string[]> {
        try {
            return await invoke<string[]>('fetch_images', { num: 10 });
        } catch (error) {
            console.error('Failed to fetch image URLs:', error);
            return [];
        }
    }

    addToQueue(url: string, priority: number = 3) {
        const currentQueue = this.downloadQueue.value;
        if (!currentQueue.some(task => task.url === url)) {
            currentQueue.push({
                url,
                priority,
                status: 'pending'
            });
            this.downloadQueue.next(currentQueue);
            this.checkAndStartDownload();
        }
    }

    private checkAndStartDownload() {
        if (this.isIdle && !this.isDownloading) {
            this.processQueue();
        }
    }

    private async processQueue() {
        if (this.isDownloading || !this.isIdle) return;

        const queue = this.downloadQueue.value;
        const pendingTasks = queue.filter(task => task.status === 'pending');

        if (pendingTasks.length === 0) return;

        this.isDownloading = true;
        const task = pendingTasks[0];
        task.status = 'downloading';
        this.downloadQueue.next(queue);

        try {
            const cachePath = await invoke<string>('download_image', { url: task.url });
            task.status = 'completed';
            this.downloadCompleteSubject.next({ url: task.url, cachePath });
        } catch (error) {
            task.status = 'failed';
            console.error('Download failed:', error);
        }

        this.isDownloading = false;
        this.downloadQueue.next(queue);
        this.processQueue();
    }

    getQueueStatus() {
        return this.downloadQueue.asObservable();
    }

    getIdleStatus() {
        return this.isIdleSubject.asObservable();
    }
} 