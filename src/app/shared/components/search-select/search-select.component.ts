import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { SearchSelectOption } from '../../../core/models/search-select-option.model';

@Component({
  selector: 'app-search-select',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="relative">
      <input
        #inputRef
        [id]="inputId()"
        type="text"
        [formControl]="control()"
        [placeholder]="placeholder()"
        class="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        (focus)="openDropdown()"
        (input)="onInput()"
        (keydown)="onKeydown($event)"
        autocomplete="off"
        role="combobox"
        [attr.aria-expanded]="isOpen()"
        aria-autocomplete="list"
      />

      @if (isOpen() && filteredOptions().length > 0) {
        <ul
          class="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          @for (option of filteredOptions(); track option.id; let index = $index) {
            <li>
              <button
                type="button"
                class="w-full px-3 py-2 text-left text-sm hover:bg-stone-50"
                [class.bg-brand-50]="highlightedIndex() === index"
                role="option"
                (mousedown.prevent="selectOption(option)"
              >
                <span class="block font-medium text-stone-900">{{ option.label }}</span>
                @if (option.subtitle) {
                  <span class="block text-xs text-stone-500">{{ option.subtitle }}</span>
                }
              </button>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class SearchSelectComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  readonly control = input.required<FormControl<string | null>>();
  readonly options = input.required<SearchSelectOption[]>();
  readonly inputId = input('search-select');
  readonly placeholder = input('Search...');

  readonly selected = output<SearchSelectOption>();

  readonly query = signal('');
  readonly isOpen = signal(false);
  readonly highlightedIndex = signal(0);

  readonly filteredOptions = computed(() => {
    const normalizedQuery = this.query().trim().toLowerCase();
    const items = this.options();

    if (!normalizedQuery) {
      return items;
    }

    return items.filter((entry) => entry.label.toLowerCase().includes(normalizedQuery));
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.closeDropdown();
    }
  }

  openDropdown(): void {
    this.isOpen.set(true);
    this.highlightedIndex.set(0);
  }

  closeDropdown(): void {
    this.isOpen.set(false);
    this.highlightedIndex.set(0);
  }

  onInput(): void {
    this.query.set(this.control().value ?? '');
    this.openDropdown();
  }

  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        this.openDropdown();
      }
      return;
    }

    const options = this.filteredOptions();

    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDropdown();
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.highlightedIndex.update((index) => Math.min(index + 1, options.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.highlightedIndex.update((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === 'Enter' && options.length > 0) {
      event.preventDefault();
      const option = options[this.highlightedIndex()] ?? options[0];
      this.selectOption(option);
    }
  }

  selectOption(option: SearchSelectOption): void {
    this.control().setValue(option.label);
    this.query.set(option.label);
    this.selected.emit(option);
    this.closeDropdown();
  }
}
