import { TestBed } from '@angular/core/testing';
import { StorageService } from './storage.service';
import { PlatformService } from './platform.service';

describe('StorageService', () => {
  let storage: StorageService;
  let platform: jasmine.SpyObj<PlatformService>;

  beforeEach(() => {
    localStorage.clear();
    platform = jasmine.createSpyObj<PlatformService>('PlatformService', ['isBrowser']);
    platform.isBrowser.and.returnValue(true);

    TestBed.configureTestingModule({
      providers: [StorageService, { provide: PlatformService, useValue: platform }],
    });
    storage = TestBed.inject(StorageService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('stores and reads string values', () => {
    storage.setItem('soozi.test', 'hello');
    expect(storage.getItem('soozi.test')).toBe('hello');
  });

  it('stores and reads JSON values', () => {
    storage.setJson('soozi.json', { a: 1 });
    expect(storage.getJson<{ a: number }>('soozi.json')).toEqual({ a: 1 });
  });

  it('removes values', () => {
    storage.setItem('soozi.test', 'x');
    storage.removeItem('soozi.test');
    expect(storage.getItem('soozi.test')).toBeNull();
  });

  it('returns null when not in a browser', () => {
    platform.isBrowser.and.returnValue(false);
    expect(storage.getItem('soozi.test')).toBeNull();
  });
});
