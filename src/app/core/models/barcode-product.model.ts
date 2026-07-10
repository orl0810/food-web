import { MealType } from './meal-plan.model';

export interface NutritionPer100g { calories: number|null; protein: number|null; carbohydrates: number|null; fat: number|null; sugar: number|null; fiber: number|null; sodiumMg: number|null; }
export type CalculatedNutrition = NutritionPer100g;
export interface Product {
  id:string; barcode:string; name:string; brand:string|null; imageUrl:string|null;
  packageQuantity:number|null; packageUnit:string|null; servingQuantity:number|null;
  servingUnit:string|null; servingGrams:number|null; nutrition:NutritionPer100g;
  ingredients:string|null; allergens:string[]; nutritionGrade:string|null;
  source:'open_food_facts'|'user_created'; verificationStatus:'unverified'|'provider'|'verified';
  dataCompleteness:number|null; lastVerifiedAt:string|null;
}
export interface UserProductPreference { productId:string; defaultServingQuantity:number|null; defaultServingUnit:string|null; defaultServingGrams:number|null; defaultMealSlot:MealType|null; timesUsed:number; }
export type BarcodeLookupResponse =
  | {status:'found';source:'local'|'external';product:Product;userPreference:UserProductPreference|null}
  | {status:'not_found';barcode:string}
  | {status:'invalid_barcode';barcode:string}
  | {status:'temporarily_unavailable';retryable:boolean};
