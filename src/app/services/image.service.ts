import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { BehaviorSubject } from 'rxjs';
import { convertFileSrc } from '@tauri-apps/api/core';
import { DownloadQueueService } from './download-queue.service';

interface ImageState {
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
    this.downloadQueueService.getDownloadCompleteObservable().subscribe(({ url, cachePath }) => {
      this.updateImageState(url, cachePath);
    });
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
            console.log(`Converted file URL: ${displayUrl}`);
          } else {
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

  getImages() {
    return this.imageUrls.asObservable();
  }

  getLoadingState() {
    return this.isLoading.asObservable();
  }
}
