import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { COOKIE_POLICY_CONTENT } from './content/cookie-policy.content';
import { LegalPageLayoutComponent } from './legal-page-layout.component';
import { LEGAL_PLACEHOLDERS } from './legal.model';

@Component({
  selector: 'app-cookie-policy-page',
  standalone: true,
  imports: [LegalPageLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-legal-page-layout [content]="content" />`,
})
export class CookiePolicyPageComponent implements OnInit {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly content = COOKIE_POLICY_CONTENT;

  ngOnInit(): void {
    const pageTitle = `Cookie Policy | ${LEGAL_PLACEHOLDERS.appName}`;
    const description = `Learn how ${LEGAL_PLACEHOLDERS.appName} uses cookies and similar technologies.`;
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
  }
}
