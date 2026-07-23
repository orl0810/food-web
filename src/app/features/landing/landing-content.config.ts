export interface LandingBenefit {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
}

export interface LandingFaq {
  readonly question: string;
  readonly answer: string;
}

export const LANDING_BENEFITS: readonly LandingBenefit[] = [
  { icon: 'sun', title: 'Less daily decision fatigue', description: 'Know what to prepare and eat without improvising every day.' },
  { icon: 'leaf', title: 'Use food while it is fresh', description: 'See what needs attention and plan those ingredients first.' },
  { icon: 'pot', title: 'Fewer cooking sessions', description: 'Prepare extra portions and reuse them across several meals.' },
  { icon: 'calendar', title: 'A plan that reflects real life', description: 'Move meals between planned, cooked, and consumed as your week changes.' },
  { icon: 'basket', title: 'Smarter grocery shopping', description: 'Build a shopping list from the meals you have actually planned.' },
];

export const LANDING_FAQS: readonly LandingFaq[] = [
  { question: 'Is Soozi a calorie tracker?', answer: 'No. Soozi is built around meal planning, ingredients, prepared portions, and a more manageable weekly cooking routine.' },
  { question: 'Can I create my own recipes?', answer: 'Yes. You can save your own recipes, ingredients, portions, steps, and tags, then add them to your meal plan.' },
  { question: 'Can I plan several foods for one meal?', answer: 'Yes. A meal slot can include more than one item, so a prepared main, side, or other food can share the same meal.' },
  { question: 'Can I reuse prepared food during the week?', answer: 'Yes. Prepared portions are tracked separately and can be added to future meal slots while they are available.' },
  { question: 'Does it help me use ingredients before they expire?', answer: 'Yes. Inventory views highlight expired and expiring items, and suggestions can prioritize ingredients that need attention.' },
  { question: 'Can I generate a shopping list?', answer: 'Yes. The app can create shopping needs from planned recipes and lets you manage the resulting list.' },
  { question: 'Is it suitable for vegetarian users?', answer: 'Yes. Dietary preferences are part of profile and onboarding settings, including vegetarian and vegan options.' },
  { question: 'Is it free during beta?', answer: 'The current registration flow does not require payment. Pricing for a future public release has not been announced.' },
  { question: 'Can I use it on mobile?', answer: 'Yes. Soozi is a responsive web app designed for phones, tablets, and desktop browsers.' },
  { question: 'Is my information private?', answer: 'Your account is protected by authentication. See our Privacy Policy for how we handle your data, and our Cookie Policy for how we use browser storage.' },
];

export const LANDING_ANALYTICS_EVENTS = [
  'landing_view', 'hero_primary_cta_clicked', 'hero_secondary_cta_clicked',
  'header_cta_clicked', 'feature_section_viewed', 'how_it_works_viewed',
  'faq_opened', 'final_cta_clicked', 'signup_started', 'login_clicked',
] as const;

export type LandingAnalyticsEvent = (typeof LANDING_ANALYTICS_EVENTS)[number];
