import { TestBed } from '@angular/core/testing';
import { StorageService } from '../services/storage.service';
import { FirstTourStorageService } from './first-tour-storage.service';

describe('FirstTourStorageService', () => {
  let service: FirstTourStorageService;
  let values: Map<string, string>;

  beforeEach(() => {
    values = new Map<string, string>();
    TestBed.configureTestingModule({
      providers: [
        FirstTourStorageService,
        {
          provide: StorageService,
          useValue: {
            getJson: <T>(key: string): T | null => {
              const value = values.get(key);
              return value ? JSON.parse(value) as T : null;
            },
            setJson: (key: string, value: unknown) => values.set(key, JSON.stringify(value)),
            removeItem: (key: string) => values.delete(key),
          },
        },
      ],
    });
    service = TestBed.inject(FirstTourStorageService);
  });

  it('stores progress independently for each user', () => {
    service.save('user-a', 'in_progress', 3);
    service.save('user-b', 'completed', 5);

    expect(service.get('user-a')).toEqual(jasmine.objectContaining({
      userId: 'user-a',
      status: 'in_progress',
      currentStep: 3,
    }));
    expect(service.get('user-b')).toEqual(jasmine.objectContaining({
      userId: 'user-b',
      status: 'completed',
      currentStep: 5,
    }));
  });

  it('resets only the requested user tour', () => {
    service.save('user-a', 'skipped', 2);
    service.save('user-b', 'completed', 5);

    service.reset('user-a');

    expect(service.get('user-a')).toBeNull();
    expect(service.get('user-b')?.status).toBe('completed');
  });

  it('ignores data from another tour version', () => {
    service.save('user-a', 'in_progress', 2);
    const [key] = [...values.keys()];
    const saved = JSON.parse(values.get(key)!) as Record<string, unknown>;
    values.set(key, JSON.stringify({ ...saved, version: 99 }));

    expect(service.get('user-a')).toBeNull();
  });
});
