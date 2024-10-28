import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { invoke } from "@tauri-apps/api/core";
import { ImageService } from './services/image.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  imageUrls$ = this.imageService.getImages();
  imageCount = 5;

  constructor(private imageService: ImageService) {
    // 初始化时就加载图片
    this.loadImages();
  }

  loadImages() {
    this.imageService.fetchImages(this.imageCount);
  }
}
