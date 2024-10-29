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
