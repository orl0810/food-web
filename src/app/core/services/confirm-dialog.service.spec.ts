import { TestBed } from '@angular/core/testing';
import { ConfirmDialogService } from './confirm-dialog.service';

describe('ConfirmDialogService', () => {
  let service: ConfirmDialogService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConfirmDialogService);
  });

  it('resolves confirm to true when accepted', async () => {
    const promise = service.confirm({ message: 'Delete item?' });
    expect(service.pending()?.request.message).toBe('Delete item?');
    service.resolve(true);
    await expectAsync(promise).toBeResolvedTo(true);
    expect(service.pending()).toBeNull();
  });

  it('resolves confirm to false when cancelled', async () => {
    const promise = service.confirm({ message: 'Sure?' });
    service.resolve(false);
    await expectAsync(promise).toBeResolvedTo(false);
  });

  it('resolves prompt with entered text', async () => {
    const promise = service.prompt({ message: 'How many?', defaultValue: '1' });
    expect(service.pending()?.request.variant).toBe('prompt');
    service.resolve('3');
    await expectAsync(promise).toBeResolvedTo('3');
  });

  it('resolves alert after acknowledge', async () => {
    const promise = service.alert({ message: 'Done' });
    service.resolve(true);
    await expectAsync(promise).toBeResolved();
  });
});
