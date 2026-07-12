import { LEGAL_PLACEHOLDERS, LegalPageContent } from '../legal.model';

export const TERMS_OF_SERVICE_CONTENT: LegalPageContent = {
  title: 'Terms of Service',
  lastUpdated: LEGAL_PLACEHOLDERS.lastUpdated,
  intro: `These Terms of Service ("Terms") govern your access to and use of ${LEGAL_PLACEHOLDERS.appName}, operated by ${LEGAL_PLACEHOLDERS.companyName}. By creating an account or using the app, you agree to these Terms. This is a draft intended for legal review.`,
  sections: [
    {
      id: 'acceptance',
      title: '1. Acceptance of terms',
      paragraphs: [
        'By accessing or using PantryFlow, you confirm that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.',
        'If you do not agree, do not use the app.',
      ],
    },
    {
      id: 'description',
      title: '2. Description of the service',
      paragraphs: [
        `${LEGAL_PLACEHOLDERS.appName} is a web-based meal planning application that helps you track food at home, plan meals, manage recipes, generate shopping lists, and organize prepared portions.`,
        'Features may change over time as we improve the product. We may add, modify, or remove features with reasonable notice where appropriate.',
      ],
    },
    {
      id: 'user-accounts',
      title: '3. User accounts',
      paragraphs: [
        'You must provide accurate account information and keep your login credentials secure. You are responsible for all activity under your account.',
        'You must notify us promptly if you suspect unauthorized access to your account.',
        'We may suspend or terminate accounts that violate these Terms or pose a security risk.',
      ],
    },
    {
      id: 'user-responsibilities',
      title: '4. User responsibilities',
      paragraphs: [
        'You agree to use the app lawfully and in a way that does not harm other users, our systems, or third parties.',
        'You are responsible for verifying that meal plans, recipes, and food logs meet your dietary needs, allergies, and restrictions.',
        'You are responsible for maintaining backups of any important information you store in the app, where applicable.',
      ],
    },
    {
      id: 'nutrition-health-disclaimer',
      title: '5. Meal planning, nutrition, and health disclaimer',
      paragraphs: [
        `${LEGAL_PLACEHOLDERS.appName} provides planning, organization, and estimated nutrition support. It does not provide medical, dietary, or professional health advice.`,
        'Nutrition targets, calorie counts, and macro estimates are approximations and may be inaccurate. Do not rely on the app for medical decisions.',
        'You are solely responsible for checking allergies, dietary restrictions, ingredient labels, and portion sizes before preparing or consuming food.',
        'Consult a qualified healthcare or nutrition professional for medical conditions, pregnancy, eating disorders, or other health-related concerns.',
      ],
    },
    {
      id: 'food-safety',
      title: '6. Food safety disclaimer',
      paragraphs: [
        'You are responsible for checking expiration dates, storage conditions, and safe food handling practices.',
        `${LEGAL_PLACEHOLDERS.appName} may show reminders about expiring items, but these are estimates and cannot guarantee food safety.`,
        'Always use your own judgment before consuming food. When in doubt, discard the item.',
      ],
    },
    {
      id: 'user-generated-content',
      title: '7. User-generated content',
      paragraphs: [
        'You may add recipes, photos, notes, food logs, inventory items, and other content to the app.',
        'You retain ownership of content you create, but you grant us a limited license to store, process, and display it solely to provide the service.',
        'You are responsible for the content you upload and must not upload illegal, harmful, infringing, or misleading content.',
      ],
    },
    {
      id: 'uploaded-photos',
      title: '8. Uploaded photos and content',
      paragraphs: [
        'Only upload images and content you have the right to use.',
        'Photos may be stored to support features such as food logging, recipe creation, and meal capture.',
        'We may remove content that violates these Terms or applicable law.',
      ],
    },
    {
      id: 'acceptable-use',
      title: '9. Acceptable use',
      paragraphs: ['You agree not to:'],
      list: [
        'Abuse, harass, or harm others through the service.',
        'Attempt unauthorized access to accounts, systems, or data.',
        'Reverse engineer, scrape, or misuse the platform except where permitted by law.',
        'Upload malware, spam, or harmful content.',
        'Use the service for unlawful purposes or to infringe intellectual property rights.',
        'Interfere with the normal operation or security of the app.',
      ],
    },
    {
      id: 'subscriptions',
      title: '10. Subscriptions and payments',
      paragraphs: [
        `${LEGAL_PLACEHOLDERS.appName} may offer free and paid plans. Paid subscriptions, trials, and billing are processed through our payment provider (for example, Stripe).`,
        'Pricing, billing intervals, and plan features are shown at checkout or on the pricing page and may change with notice where required by law.',
        'You can manage or cancel subscriptions through the billing portal provided in the app. Refund terms, if any, will be stated at purchase or in separate billing terms.',
        'If paid plans are not yet available in your region or account, this section will apply when they become available.',
      ],
    },
    {
      id: 'termination',
      title: '11. Account termination',
      paragraphs: [
        'You may stop using the app at any time. You may request account deletion by contacting us.',
        'We may suspend or terminate your access if you violate these Terms, create security risks, or where required by law.',
        'Upon termination, your right to use the app ends. Some provisions of these Terms will survive termination where appropriate.',
      ],
    },
    {
      id: 'limitation-of-liability',
      title: '12. Limitation of liability',
      paragraphs: [
        `To the fullest extent permitted by applicable law, ${LEGAL_PLACEHOLDERS.companyName} and ${LEGAL_PLACEHOLDERS.appName} are provided "as is" and "as available" without warranties of any kind, whether express or implied.`,
        'We do not guarantee that the app will be uninterrupted, error-free, or meet your specific requirements.',
        'To the extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of data, profits, or goodwill arising from your use of the app.',
        'Our total liability for any claim relating to the service is limited to the amount you paid us in the twelve months before the claim, or zero if you use a free plan, unless applicable law requires otherwise.',
      ],
    },
    {
      id: 'changes-to-terms',
      title: '13. Changes to terms',
      paragraphs: [
        'We may update these Terms from time to time. We will update the "Last updated" date and, where appropriate, provide notice through the app or by email.',
        'Continued use after changes take effect constitutes acceptance of the updated Terms, unless applicable law requires a different approach.',
      ],
    },
    {
      id: 'governing-law',
      title: '14. Governing law',
      paragraphs: [
        `These Terms are governed by the laws of ${LEGAL_PLACEHOLDERS.jurisdiction}, without regard to conflict-of-law principles.`,
        'Any disputes will be subject to the exclusive jurisdiction of the courts in that location, unless mandatory consumer protection laws in your country require otherwise.',
      ],
    },
    {
      id: 'contact',
      title: '15. Contact',
      paragraphs: [
        `Questions about these Terms? Contact us at ${LEGAL_PLACEHOLDERS.supportEmail}.`,
      ],
    },
  ],
};
