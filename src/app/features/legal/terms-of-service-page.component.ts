import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { TERMS_OF_SERVICE_CONTENT } from './content/terms-of-service.content';
import { LegalPageLayoutComponent } from './legal-page-layout.component';
import { LEGAL_PLACEHOLDERS } from './legal.model';

@Component({
  selector: 'app-terms-of-service-page',
  standalone: true,
  imports: [LegalPageLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-legal-page-layout [content]="content" />`,
})
export class TermsOfServicePageComponent implements OnInit {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly content = TERMS_OF_SERVICE_CONTENT;

  ngOnInit(): void {
    const pageTitle = `Terms of Service | ${LEGAL_PLACEHOLDERS.appName}`;
    const description = `Read the terms for using ${LEGAL_PLACEHOLDERS.appName}.`;
    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
  }
}
