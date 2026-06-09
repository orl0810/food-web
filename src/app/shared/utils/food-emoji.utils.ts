export const DEFAULT_FOOD_ICON = '🍽️';

const CATEGORY_EMOJI: Record<string, string> = {
  dairy: '🥛',
  produce: '🥬',
  fruit: '🍎',
  fruits: '🍎',
  vegetable: '🥕',
  vegetables: '🥕',
  meat: '🥩',
  poultry: '🍗',
  chicken: '🍗',
  fish: '🐟',
  seafood: '🦐',
  bread: '🍞',
  bakery: '🥖',
  grain: '🌾',
  grains: '🌾',
  pasta: '🍝',
  rice: '🍚',
  snack: '🍿',
  snacks: '🍿',
  beverage: '🥤',
  beverages: '🥤',
  drink: '🥤',
  drinks: '🥤',
  frozen: '🧊',
  spice: '🧂',
  spices: '🧂',
  condiment: '🫙',
  condiments: '🫙',
  egg: '🥚',
  eggs: '🥚',
  cheese: '🧀',
};

const NAME_EMOJI: Record<string, string> = {
  milk: '🥛',
  egg: '🥚',
  eggs: '🥚',
  bread: '🍞',
  rice: '🍚',
  chicken: '🍗',
  fish: '🐟',
  apple: '🍎',
  banana: '🍌',
  tomato: '🍅',
  cheese: '🧀',
  butter: '🧈',
  yogurt: '🥛',
  pasta: '🍝',
  potato: '🥔',
  onion: '🧅',
  carrot: '🥕',
  lettuce: '🥬',
  spinach: '🥬',
  beef: '🥩',
  pork: '🥩',
  salmon: '🐟',
  shrimp: '🦐',
  coffee: '☕',
  tea: '🍵',
  water: '💧',
  juice: '🧃',
  cereal: '🥣',
  flour: '🌾',
  sugar: '🍬',
  salt: '🧂',
  'chili pepper': '🌶️',
  oil: '🫒',
  honey: '🍯',
  jam: '🫙',
  soup: '🍲',
  pizza: '🍕',
  burger: '🍔',
  salad: '🥗',
  avocado: '🥑',
  lemon: '🍋',
  orange: '🍊',
  strawberry: '🍓',
  blueberry: '🫐',
  grape: '🍇',
  mushroom: '🍄',
  garlic: '🧄',
  'bell pepper': '🫑',
  cucumber: '🥒',
  broccoli: '🥦',
  corn: '🌽',
  beans: '🫘',
  tofu: '🧈',
  bacon: '🥓',
  sausage: '🌭',
  ham: '🍖',
  turkey: '🦃',
  cream: '🥛',
  chocolate: '🍫',
  cookie: '🍪',
  cookies: '🍪',
  cake: '🍰',
  ice: '🧊',
  'ice cream': '🍦',
  wine: '🍷',
  beer: '🍺',
};

export function getFoodEmoji(name: string, category?: string | null): string {
  const normalizedName = name.trim().toLowerCase();

  for (const [keyword, emoji] of Object.entries(NAME_EMOJI)) {
    if (normalizedName.includes(keyword)) {
      return emoji;
    }
  }

  if (category) {
    const normalizedCategory = category.trim().toLowerCase();
    for (const [keyword, emoji] of Object.entries(CATEGORY_EMOJI)) {
      if (normalizedCategory.includes(keyword)) {
        return emoji;
      }
    }
  }

  return DEFAULT_FOOD_ICON;
}
