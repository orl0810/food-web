import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { MealSlotItem } from '../models/meal-slot-item.model';
import { AuthService } from './auth.service';
import { LocalApiService } from './local-api.service';
import { SupabaseService } from './supabase.service';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/heic']);

@Injectable({ providedIn: 'root' })
export class FoodLogPhotoService {
  private readonly localApiService = inject(LocalApiService);
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  async uploadFoodPhoto(file: File): Promise<string> {
    this.validatePhotoFile(file);

    if (environment.useLocalApi) {
      const dataBase64 = await this.readFileAsDataUrl(file);
      return this.localApiService.uploadFoodPhoto(file.name, dataBase64);
    }

    const client = this.supabaseService.getClient();
    const userId = this.authService.user()?.id;

    if (!client || !userId) {
      throw new Error('You must be signed in to upload a photo.');
    }

    const extension = this.getExtension(file);
    const storagePath = `users/${userId}/${crypto.randomUUID()}${extension}`;

    const { error } = await client.storage.from('food-log-photos').upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

    if (error) {
      throw new Error('Photo upload failed. Please try another image.');
    }

    const { data } = client.storage.from('food-log-photos').getPublicUrl(storagePath);
    return data.publicUrl;
  }

  /**
   * Future hook for AI-based food recognition from photos.
   * Not implemented in MVP.
   */
  async analyzeFoodPhoto(_file: File): Promise<Partial<MealSlotItem>> {
    // TODO: connect to vision/AI service when available
    throw new Error('Photo analysis is not implemented yet.');
  }

  private validatePhotoFile(file: File): void {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new Error('Please choose a PNG, JPEG, or WebP image.');
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new Error('Image is too large. Maximum size is 5 MB.');
    }
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
