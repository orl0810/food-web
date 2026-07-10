import { CalculatedNutrition, NutritionPer100g, Product } from '../../core/models/barcode-product.model';
import { MealSlotItemInput } from '../../core/models/meal-slot-item.model';
import { MealType } from '../../core/models/meal-plan.model';

export function normalizeBarcode(value:string):string { return value.trim().replace(/[\s-]/g,''); }
export function isSupportedBarcode(value:string):boolean {
  const code=normalizeBarcode(value); if(!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  // Eight-digit values may be EAN-8 or zero-compressed UPC-E; format metadata is
  // unavailable for manual entry, so length/digits are the safe common validation.
  if(code.length===8) return true;
  const digits=[...code].map(Number); const check=digits.pop()!;
  const sum=digits.reverse().reduce((total,digit,index)=>total+digit*(index%2===0?3:1),0);
  return (10-(sum%10))%10===check;
}
export function calculateNutritionForGrams(n:NutritionPer100g,grams:number):CalculatedNutrition {
  if(!Number.isFinite(grams)||grams<=0) throw new Error('Consumed grams must be greater than zero.');
  const scale=(value:number|null)=>value===null?null:value*grams/100;
  return {calories:scale(n.calories),protein:scale(n.protein),carbohydrates:scale(n.carbohydrates),fat:scale(n.fat),sugar:scale(n.sugar),fiber:scale(n.fiber),sodiumMg:scale(n.sodiumMg)};
}
export function productCompleteness(product:Pick<Product,'name'|'nutrition'|'servingGrams'|'imageUrl'>):number {
  const values=[product.name,product.imageUrl,product.servingGrams,...Object.values(product.nutrition)];
  return values.filter(v=>v!==null&&v!=='').length/values.length;
}
export function shouldRefreshProduct(product:Product,now=new Date()):boolean {
  if(product.source==='user_created'||product.verificationStatus==='verified') return false;
  if(!product.lastVerifiedAt) return true;
  const days=(now.getTime()-new Date(product.lastVerifiedAt).getTime())/86400000;
  return days>(productCompleteness(product)>=.7?90:14);
}
export function buildProductMealPlanInput(product:Product,date:string,mealType:MealType,grams:number,servings:number):MealSlotItemInput {
  const n=calculateNutritionForGrams(product.nutrition,grams);
  return {date,meal_type:mealType,item_type:'product',product_id:product.id,custom_name:product.name,quantity:grams,unit:'g',grams_consumed:grams,servings,
    calories_snapshot:n.calories,protein_snapshot:n.protein,carbohydrates_snapshot:n.carbohydrates,fat_snapshot:n.fat,sugar_snapshot:n.sugar,fiber_snapshot:n.fiber,sodium_mg_snapshot:n.sodiumMg,
    product_name_snapshot:product.name,brand_snapshot:product.brand,image_url:product.imageUrl,product_image_url_snapshot:product.imageUrl};
}
