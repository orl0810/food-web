import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { PRIVACY_POLICY_CONTENT } from './content/privacy-policy.content';
import { LegalPageLayoutComponent } from './legal-page-layout.component';
import { LEGAL_PLACEHOLDERS } from './legal.model';

@Component({
  selector: 'app-privacy-policy-page',
  standalone: true,
  imports: [LegalPageLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-legal-page-layout [content]="content" />`,
})
export class PrivacyPolicyPageComponent implements OnInit {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly content = PRIVACY_POLICY_CONTENT;

  ngOnInit(): void {
    const pageTitle = `Privacy Policy | ${LEGAL_PLACEHOLDERS.appName}`;
    const description = `Learn how ${LEGAL_PLACEHOLDERS.appName} handles your information.`;
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
  }
}
