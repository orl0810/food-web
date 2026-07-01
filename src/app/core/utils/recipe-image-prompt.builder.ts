import { Recipe, RecipeCategory } from '../models/recipe.model';

const BRAND_STYLE =
  'Realistic premium food photography, warm natural daylight, cream background, soft shadows, clean minimalist styling, ceramic plate or bowl, subtle sage green accent, fresh ingredients, appetizing but realistic portions, premium delivery-app quality, modern healthy home-cooking aesthetic.';

const AVOID_LIST =
  'Avoid: text, logos, people, hands, branded packaging, messy table, dark lighting, unrealistic food, excessive garnish, watermarks.';

const CATEGORY_COMPOSITION_MAP: Record<RecipeCategory, string> = {
  Burgers: 'burger on a plate, 45-degree angle',
  Healthy: 'top-down grain bowl composition',
  Oriental: 'stir-fry on a plate, 45-degree angle',
  Chicken: 'chicken on a dinner plate, 45-degree angle',
  Meat: 'steak on a dinner plate, 45-degree angle',
  Breakfast: 'breakfast plate, top-down composition',
  Asian: 'rice bowl, top-down composition',
  Dessert: 'small dessert glass or plate, top-down',
  Italian: 'pasta on a ceramic plate, 45-degree angle',
  Oats: 'top-down bowl composition',
  'Yogurt Bowl': 'top-down bowl composition',
  Eggs: 'ceramic plate, 45-degree angle',
  Toast: 'top-down plate composition',
  Cereal: 'top-down bowl composition',
  Smoothie: 'glass on cream background, 45-degree angle',
  'Rice Bowl': 'top-down bowl composition',
  Pasta: '45-degree angle ceramic bowl',
  Soup: 'top-down soup bowl',
  Salad: 'top-down salad bowl',
  Wrap: 'wrap cut in half on a plate, 45-degree angle',
  Sandwich: 'sandwich cut in half on a plate, 45-degree angle',
  'Main Dish': '45-degree angle dinner plate',
  'Light Dinner': 'clean plate, 45-degree angle',
  'Dinner Main': '45-degree angle dinner plate',
  Snack: 'small plate top-down composition',
};

export class RecipeImagePromptBuilder {
  static buildPrompt(
    recipe: Pick<Recipe, 'title' | 'meal_type' | 'category' | 'tags'> & {
      ingredients?: string[];
    }
  ): string {
    const parts: string[] = [];

    parts.push(`A photo of "${recipe.title.trim()}".`);

    if (recipe.meal_type) {
      parts.push(`Meal type: ${recipe.meal_type}.`);
    }

    if (recipe.category) {
      const composition =
        CATEGORY_COMPOSITION_MAP[recipe.category as RecipeCategory] ??
        '45-degree angle on a ceramic plate or bowl';
      parts.push(`Category: ${recipe.category}. Composition: ${composition}.`);
    }

    const ingredientNames = (recipe.ingredients ?? [])
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 5);

    if (ingredientNames.length > 0) {
      parts.push(`Main ingredients: ${ingredientNames.join(', ')}.`);
    }

    const styleTags = (recipe.tags ?? []).filter(Boolean).slice(0, 4);
    if (styleTags.length > 0) {
      parts.push(`Style hints: ${styleTags.join(', ')}.`);
    }

    parts.push(BRAND_STYLE);
    parts.push(AVOID_LIST);

    return parts.join(' ');
  }
}
