import { LEGAL_PLACEHOLDERS, LegalPageContent } from '../legal.model';

export const COOKIE_POLICY_CONTENT: LegalPageContent = {
  title: 'Cookie Policy',
  lastUpdated: LEGAL_PLACEHOLDERS.lastUpdated,
  intro: `This Cookie Policy explains how ${LEGAL_PLACEHOLDERS.appName}, operated by ${LEGAL_PLACEHOLDERS.companyName}, uses cookies and similar technologies such as local storage. For broader information about how we handle personal data, see our Privacy Policy. This is a draft intended for legal review.`,
  sections: [
    {
      id: 'what-are-cookies',
      title: '1. What cookies and similar technologies are',
      paragraphs: [
        'Cookies are small text files stored on your device by your browser. Similar technologies include local storage and session storage, which also store data in your browser.',
        `${LEGAL_PLACEHOLDERS.appName} uses browser storage to keep you signed in, remember certain preferences, and operate core features. We do not currently use third-party advertising or marketing cookies on our domain.`,
      ],
    },
    {
      id: 'how-we-use',
      title: '2. How the app uses cookies and similar technologies',
      paragraphs: ['We use cookies and browser storage for the following purposes:'],
      list: [
        'Authentication and session management — to keep you signed in securely between visits.',
        'Functional preferences — to remember UI choices such as dismissed dashboard actions or daily suggestion rotation.',
        'App performance — our production build may use a service worker to cache static assets for faster loading.',
        'Operational analytics — first-party usage events stored in our database to improve reliability. We do not load third-party analytics scripts such as Google Analytics.',
      ],
    },
    {
      id: 'types-of-cookies',
      title: '3. Types of cookies and storage we use',
      paragraphs: ['We categorize storage as follows:'],
      list: [
        'Strictly necessary — required for authentication and core app functionality. These cannot be disabled while using the signed-in app.',
        'Functional / preferences — optional storage that improves your experience, such as remembering dismissed tips or featured suggestions.',
        'Analytics — we do not currently use non-essential third-party analytics cookies. First-party operational events are stored in our database, not in advertising trackers.',
        'Marketing — we do not use marketing cookies.',
      ],
    },
    {
      id: 'specific-storage',
      title: '4. Specific storage used by Soozi',
      paragraphs: ['Examples of storage keys used by the app include:'],
      list: [
        'Supabase authentication session (localStorage) — keeps you signed in using secure tokens.',
        'soozi.smartAction.dismissed (localStorage) — remembers dashboard smart actions you dismissed for the day.',
        'soozi.suggestions.dailyFeatured (localStorage) — rotates featured recipe suggestions.',
        'Local development tokens (localStorage, development only) — used when running the app against a local API during development.',
      ],
    },
    {
      id: 'managing-cookies',
      title: '5. Managing cookies and storage',
      paragraphs: [
        'You can control cookies and local storage through your browser settings. Most browsers let you block or delete cookies and site data.',
        'Blocking strictly necessary storage will prevent you from staying signed in and may limit core functionality.',
        'We do not currently show a cookie consent banner because we do not use non-essential third-party tracking cookies. If we add third-party analytics or marketing tools in the future, we will introduce a consent mechanism and update this policy.',
        'You can return to this page at any time to review how we use storage technologies.',
      ],
    },
    {
      id: 'third-party',
      title: '6. Third-party cookies and services',
      paragraphs: [
        'Some features involve third-party services that may set their own cookies when you interact with them directly:',
      ],
      list: [
        'Stripe — when you subscribe or manage billing, you are redirected to Stripe-hosted pages that use Stripe\'s own cookies and privacy practices.',
        'Open Food Facts — product images from barcode lookups may load from external servers when you use barcode features.',
        'Hosting and infrastructure providers — our app is served from our hosting platform; they process requests but do not place marketing cookies in the app by default.',
        'We do not control third-party cookies. Please review the privacy and cookie policies of those services for more information.',
      ],
    },
    {
      id: 'changes',
      title: '7. Changes to this policy',
      paragraphs: [
        'We may update this Cookie Policy when our use of cookies or similar technologies changes. We will update the "Last updated" date at the top of this page.',
      ],
    },
    {
      id: 'contact',
      title: '8. Contact',
      paragraphs: [
        `Questions about cookies or storage? Contact us at ${LEGAL_PLACEHOLDERS.supportEmail}.`,
        'For broader privacy questions, see our Privacy Policy.',
      ],
    },
  ],
};
