export interface LegalSection {
  id: string;
  title: string;
  paragraphs: string[];
  list?: string[];
}

export interface LegalPageContent {
  title: string;
  lastUpdated: string;
  intro: string;
  sections: LegalSection[];
}

/** Editable placeholders — update before legal review. */
export const LEGAL_PLACEHOLDERS = {
  appName: 'PantryFlow',
  companyName: '[Company/Owner Name]',
  supportEmail: 'hello@pantryflow.app',
  lastUpdated: '[Last Updated Date]',
  jurisdiction: '[Jurisdiction]',
} as const;
