import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { FoodPhotoAnalysisResult } from '../models/photo-food-capture.model';
import { AuthService } from './auth.service';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_DISPLAY_WIDTH = 1200;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic']);

type FoodPhotoBucket = 'food-log-photos' | 'recipe-images';

@Injectable({ providedIn: 'root' })
export class FoodLogPhotoService {
  private readonly localApiService = inject(LocalApiService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  async uploadFoodPhoto(file: File): Promise<string> {
    return this.uploadPhoto(file, 'food-log-photos', (userId) => `users/${userId}/${crypto.randomUUID()}`);
  }

  async uploadRecipePhoto(file: File): Promise<string> {
    return this.uploadPhoto(file, 'recipe-images', (userId) => `users/${userId}/uploads/${crypto.randomUUID()}`);
  }

  /**
   * Future hook for AI-based food recognition from photos.
   * Returns null when AI is not configured (MVP).
   */
  async analyzeFoodPhoto(_file: File): Promise<FoodPhotoAnalysisResult | null> {
    // TODO: connect to vision/AI service when available
    return null;
  }

  async optimizeImage(file: File): Promise<File> {
    const isHeic = file.type === 'image/heic' || file.type === 'image/heif';
    if (isHeic || !this.canOptimizeInBrowser(file.type)) {
      if (isHeic) {
        try {
          return await this.compressBitmapToJpeg(file);
        } catch {
          throw new Error(
            'This HEIC photo cannot be processed here. Please choose a JPEG or PNG, or convert the photo first.'
          );
        }
      }
      return file;
    }

    try {
      return await this.compressBitmapToJpeg(file, file.type === 'image/png' ? 'image/png' : 'image/jpeg');
    } catch {
      return file;
    }
  }

  private async compressBitmapToJpeg(
    file: File,
    outputType: 'image/jpeg' | 'image/png' = 'image/jpeg'
  ): Promise<File> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DISPLAY_WIDTH / bitmap.width);
    if (scale >= 1 && file.type === 'image/webp' && file.size <= MAX_PHOTO_BYTES) {
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      bitmap.close();
      throw new Error('Could not process the selected image.');
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, outputType === 'image/jpeg' ? 0.85 : undefined)
    );

    if (!blob) {
      throw new Error('Could not process the selected image.');
    }

    const extension = outputType === 'image/png' ? '.png' : '.jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'food-photo';
    return new File([blob], `${baseName}${extension}`, { type: outputType });
  }

  private async uploadPhoto(
    file: File,
    bucket: FoodPhotoBucket,
    buildPath: (userId: string) => string
  ): Promise<string> {
    const optimized = await this.optimizeImage(file);
    this.validatePhotoFile(optimized);

    if (environment.useLocalApi) {
      const dataBase64 = await this.readFileAsDataUrl(optimized);
      return this.localApiService.uploadFoodPhoto(optimized.name, dataBase64);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      throw new Error('You must be signed in to upload a photo.');
    }

    const extension = this.getExtension(optimized);
    const storagePath = `${buildPath(userId)}${extension}`;

    const { error } = await client.storage.from(bucket).upload(storagePath, optimized, {
      cacheControl: '3600',
      upsert: false,
      contentType: optimized.type || undefined,
    });

    if (error) {
      throw new Error('Photo upload failed. Please try another image.');
    }

    const { data } = client.storage.from(bucket).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  private validatePhotoFile(file: File): void {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new Error('This image format is not supported. Please choose a PNG, JPEG, or WebP image.');
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new Error('The image is too large. Please choose a smaller one (max 5 MB).');
    }
  }

  private canOptimizeInBrowser(mimeType: string): boolean {
    return mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/webp';
  }

  private getExtension(file: File): string {
    const fromName = file.name.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase();
    if (fromName) {
      return fromName;
    }
    if (file.type === 'image/png') {
      return '.png';
    }
    if (file.type === 'image/webp') {
      return '.webp';
    }
    if (file.type === 'image/heic') {
      return '.heic';
    }
    return '.jpg';
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not read the selected image.'));
      reader.readAsDataURL(file);
    });
  }
}
