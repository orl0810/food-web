import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-landing-product-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="overflow-hidden rounded-[1.75rem] border border-[#ddcfbd] bg-white shadow-[0_28px_70px_rgba(67,78,68,.16)]" aria-label="PantryFlow weekly plan preview">
      <div class="flex items-center justify-between border-b border-stone-100 px-4 py-3 sm:px-6">
        <div class="flex items-center gap-2 font-semibold text-pantry-charcoal"><span class="grid size-7 place-items-center rounded-lg bg-pantry-mint">⌂</span> This week</div>
        <span class="text-xs font-medium text-stone-500">May 12–18</span>
      </div>
      <div class="grid grid-cols-4 gap-2 p-3 sm:grid-cols-7 sm:p-5">
        @for (day of days; track day.name) {
          <div class="min-w-0 rounded-xl border p-2" [class]="day.today ? 'border-sage bg-brand-50' : 'border-stone-100 bg-stone-50/60'">
            <p class="text-[10px] font-semibold text-stone-500">{{ day.name }}</p>
            <p class="mt-2 truncate text-xs font-semibold text-pantry-charcoal">{{ day.meal }}</p>
            <span class="mt-3 inline-flex rounded-full px-2 py-0.5 text-[9px] font-semibold" [class]="day.state === 'Ready' ? 'bg-pantry-mint text-brand-800' : 'bg-pantry-beige text-stone-700'">{{ day.state }}</span>
          </div>
        }
      </div>
      <div class="grid gap-px bg-stone-100 sm:grid-cols-3">
        <div class="bg-white p-4"><p class="text-xs text-stone-500">Ready portions</p><p class="mt-1 text-2xl font-semibold text-pantry-charcoal">8</p><p class="text-xs text-brand-700">in the fridge</p></div>
        <div class="bg-white p-4"><p class="text-xs text-stone-500">Use soon</p><p class="mt-1 text-2xl font-semibold text-pantry-charcoal">5</p><p class="text-xs text-pantry-coral">ingredients</p></div>
        <div class="bg-white p-4"><p class="text-xs text-stone-500">Meal progress</p><div class="mt-2 flex gap-3 text-[10px] text-stone-600"><span>● Planned</span><span class="text-sage-dark">● Ready</span></div></div>
      </div>
    </div>
  `,
})
export class LandingProductPreviewComponent {
  readonly days = [
    { name: 'MON', meal: 'Couscous bowl', state: 'Ready', today: false },
    { name: 'TUE', meal: 'Lentil soup', state: 'Planned', today: true },
    { name: 'WED', meal: 'Veggie wrap', state: 'Ready', today: false },
    { name: 'THU', meal: 'Pasta verde', state: 'Planned', today: false },
    { name: 'FRI', meal: 'Grain bowl', state: 'Planned', today: false },
    { name: 'SAT', meal: 'Chickpea tray', state: 'Planned', today: false },
    { name: 'SUN', meal: 'Leftovers', state: 'Ready', today: false },
  ] as const;
}
