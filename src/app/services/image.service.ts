import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { BehaviorSubject } from 'rxjs';

interface ImageState {
  url: string;
  isCached: boolean;
  cachePath: string | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class ImageService {
  private imageUrls = new BehaviorSubject<ImageState[]>([]);
  private isLoading = new BehaviorSubject<boolean>(false);
  
  constructor() {
    this.initializeImages();
  }

  private async initializeImages() {
    try {
      // 首先获取远程图片列表
      const urls = await invoke<string[]>('fetch_images');
      
      // 检查每个图片的本地状态
      for (const url of urls) {
        const exists = await invoke<boolean>('check_local_image', { url });
        if (!exists) {
          // 在后台下载缺失的图片
          this.downloadImage(url);
        }
      }
      
      this.imageUrls.next(urls.map(url => ({ url, isCached: true, cachePath: undefined })));
    } catch (error) {
      console.error('Failed to initialize images:', error);
    }
  }

  private async downloadImage(url: string) {
    try {
      const cachePath = await invoke<string>('download_image', { url });
      // 更新缓存状态
      const currentImages = this.imageUrls.value;
      const updatedImages = currentImages.map(img => 
        img.url === url ? { ...img, isCached: true, cachePath } : img
      );
      this.imageUrls.next(updatedImages);
    } catch (error) {
      console.error('Failed to download image:', error);
    }
  }

  async fetchImages(num: number) {
    try {
      this.isLoading.next(true);
      const urls = await invoke<string[]>('fetch_images', { num });
      
      const imageStates = await Promise.all(
        urls.map(async (url) => {
          const exists = await invoke<boolean>('check_local_image', { url });
          let cachePath: string | undefined;
          
          if (exists) {
            cachePath = await invoke<string>('download_image', { url });
          } else {
            this.downloadImage(url);
          }
          
          return { url, isCached: exists, cachePath };
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
