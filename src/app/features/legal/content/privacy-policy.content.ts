import { LEGAL_PLACEHOLDERS, LegalPageContent } from '../legal.model';

export const PRIVACY_POLICY_CONTENT: LegalPageContent = {
  title: 'Privacy Policy',
  lastUpdated: LEGAL_PLACEHOLDERS.lastUpdated,
  intro: `${LEGAL_PLACEHOLDERS.appName} ("we", "us", or "our") is a meal planning web application operated by ${LEGAL_PLACEHOLDERS.companyName}. This Privacy Policy explains how we collect, use, store, and share information when you use ${LEGAL_PLACEHOLDERS.appName}. By using the app, you acknowledge this policy. This is a draft intended for legal review.`,
  sections: [
    {
      id: 'introduction',
      title: '1. Introduction',
      paragraphs: [
        `${LEGAL_PLACEHOLDERS.appName} helps you plan meals, track food at home, manage recipes, and reduce waste. To provide these features, we process information you provide and information generated through your use of the app.`,
        'This policy applies to the PantryFlow web application and related services. It does not cover third-party websites or services you may access through links in the app, such as payment pages hosted by our payment provider.',
      ],
    },
    {
      id: 'information-we-collect',
      title: '2. Information we collect',
      paragraphs: ['Depending on how you use the app, we may collect the following categories of information:'],
      list: [
        'Account information, such as your email address, display name, and authentication credentials.',
        'Meal planning data, including planned meals, meal slots, completion status, and related notes.',
        'Inventory items, including food names, quantities, locations, and expiration dates.',
        'Recipes you create or save, including ingredients, instructions, tags, and portions.',
        'Prepared portions and ready-to-eat meal data.',
        'Food logs, including manual entries and items linked to meals or recipes.',
        'Nutrition profile data you choose to provide, such as weight, height, activity level, dietary goals, allergies, and preferences.',
        'Photos you upload when using features such as food logging, recipe creation, or meal capture.',
        'Voice input and transcripts when you use voice-based features to add inventory, recipes, or food logs.',
        'Usage and operational data, such as feature interactions and error events stored in our database to improve reliability. We do not use third-party advertising or marketing trackers.',
        'Technical data, such as browser type, device information, and general usage patterns, where needed to operate and secure the service.',
      ],
    },
    {
      id: 'how-we-use-information',
      title: '3. How we use information',
      paragraphs: ['We use the information described above to:'],
      list: [
        'Create and manage your account and authenticate you securely.',
        'Build and maintain your meal plans, shopping lists, and dashboard progress.',
        'Personalize recipe suggestions and smart actions based on your inventory and preferences.',
        'Track inventory, expiration reminders, and prepared portions.',
        'Process photos and voice input only for the features you choose to use.',
        'Improve app performance, reliability, and user experience.',
        'Maintain security, prevent abuse, and troubleshoot issues.',
        'Process subscriptions and billing when you choose a paid plan.',
        'Comply with legal obligations and respond to lawful requests.',
      ],
    },
    {
      id: 'nutrition-health-data',
      title: '4. Nutrition and health-related data',
      paragraphs: [
        'If you provide nutrition profile information, we use it to estimate targets and support meal planning features within the app.',
        'Nutrition information in PantryFlow is provided for general planning purposes only. Calorie and macro estimates are approximations and may not be accurate for your individual needs.',
        `${LEGAL_PLACEHOLDERS.appName} is not a medical device and does not provide medical, dietary, or health advice. You should consult a qualified healthcare or nutrition professional before making decisions about allergies, medical conditions, or significant dietary changes.`,
      ],
    },
    {
      id: 'photos-voice',
      title: '5. Photos and voice input',
      paragraphs: [
        'Photos you upload are used only to support features you actively choose, such as logging meals, creating recipes, or capturing food items.',
        'Voice input and resulting transcripts are used only to help you create food logs, inventory entries, recipes, or related content within the app.',
        'Where AI-assisted features are enabled, your input may be processed by server-side functions to generate suggestions or parse entries. We do not use photos or voice data for advertising.',
      ],
    },
    {
      id: 'data-sharing',
      title: '6. Data sharing',
      paragraphs: [
        'We do not sell your personal information.',
        'We may share information with service providers that help us operate the app, subject to appropriate safeguards. These may include:',
      ],
      list: [
        'Hosting provider (for example, Vercel or a similar platform) — to serve the web application.',
        'Database, authentication, and storage provider (for example, Supabase) — to store account and app data securely.',
        'Payment provider (for example, Stripe) — to process subscriptions when you choose a paid plan. Payment details are handled on Stripe\'s own secure pages.',
        'AI or processing providers — only where you use AI-assisted features, and only to deliver those features.',
        'We may also disclose information if required by law, to protect our rights, or to prevent fraud or abuse.',
      ],
    },
    {
      id: 'data-retention',
      title: '7. Data retention',
      paragraphs: [
        'We retain your information for as long as your account is active and as needed to provide the service.',
        'If you delete content within the app or request account deletion, we will delete or anonymize your data within a reasonable period, except where retention is required for legal, security, or backup purposes.',
      ],
    },
    {
      id: 'user-rights',
      title: '8. Your rights',
      paragraphs: [
        'Depending on your location, including if you are in the European Union or Malta, you may have rights regarding your personal data. These may include the right to:',
        `To exercise these rights, contact us at ${LEGAL_PLACEHOLDERS.supportEmail}. We will respond within a reasonable time and may need to verify your identity.`,
      ],
      list: [
        'Access the personal data we hold about you.',
        'Correct inaccurate or incomplete data.',
        'Delete your data or request account deletion.',
        'Restrict or object to certain processing.',
        'Receive a copy of your data in a portable format, where applicable.',
        'Withdraw consent where processing is based on consent.',
        'Lodge a complaint with a supervisory authority.',
      ],
    },
    {
      id: 'security',
      title: '9. Security',
      paragraphs: [
        'We use reasonable technical and organizational measures to protect your information, including encryption in transit, access controls, and secure authentication.',
        'No method of transmission or storage is completely secure. We cannot guarantee absolute security, but we work to reduce risk and respond to incidents appropriately.',
      ],
    },
    {
      id: 'children',
      title: '10. Children',
      paragraphs: [
        `${LEGAL_PLACEHOLDERS.appName} is not intended for children under the age required by applicable law to consent to data processing without parental approval (typically 16 in the EU, or as defined by local law).`,
        'If you believe a child has provided us with personal information without appropriate consent, please contact us and we will take steps to delete it.',
      ],
    },
    {
      id: 'changes',
      title: '11. Changes to this policy',
      paragraphs: [
        'We may update this Privacy Policy from time to time. When we make material changes, we will update the "Last updated" date at the top of this page and, where appropriate, notify you through the app or by email.',
        'Your continued use of the app after changes take effect constitutes acceptance of the updated policy, unless applicable law requires a different approach.',
      ],
    },
    {
      id: 'contact',
      title: '12. Contact',
      paragraphs: [
        `If you have questions about this Privacy Policy or how we handle your data, contact us at ${LEGAL_PLACEHOLDERS.supportEmail}.`,
        `Data controller: ${LEGAL_PLACEHOLDERS.companyName}.`,
      ],
    },
  ],
};
