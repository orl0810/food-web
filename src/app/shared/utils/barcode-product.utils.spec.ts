import { buildProductMealPlanInput, calculateNutritionForGrams, isSupportedBarcode, normalizeBarcode, shouldRefreshProduct } from './barcode-product.utils';
import { Product } from '../../core/models/barcode-product.model';

describe('barcode product utilities',()=>{
 const product:Product={id:'p',barcode:'4006381333931',name:'Test bar',brand:'Test',imageUrl:null,packageQuantity:null,packageUnit:null,servingQuantity:25,servingUnit:'g',servingGrams:25,nutrition:{calories:500,protein:8,carbohydrates:60,fat:25,sugar:null,fiber:2,sodiumMg:100},ingredients:null,allergens:[],nutritionGrade:null,source:'open_food_facts',verificationStatus:'provider',dataCompleteness:.8,lastVerifiedAt:'2026-07-01T00:00:00Z'};
 it('normalizes without losing leading zeroes',()=>expect(normalizeBarcode(' 0 123-456  ')).toBe('0123456'));
 it('validates supported retail barcodes',()=>{expect(isSupportedBarcode('4006381333931')).toBeTrue();expect(isSupportedBarcode('123')).toBeFalse();expect(isSupportedBarcode('4006381333932')).toBeFalse();expect(isSupportedBarcode('12345670')).toBeTrue();});
 it('calculates nutrition while preserving unknown values',()=>{const value=calculateNutritionForGrams(product.nutrition,25);expect(value.calories).toBe(125);expect(value.protein).toBe(2);expect(value.sugar).toBeNull();});
 it('rejects invalid serving grams',()=>expect(()=>calculateNutritionForGrams(product.nutrition,0)).toThrow());
 it('uses the complete-product 90 day freshness window',()=>expect(shouldRefreshProduct(product,new Date('2026-07-10'))).toBeFalse());
 it('creates immutable meal snapshots',()=>{const input=buildProductMealPlanInput(product,'2026-07-10','snack',25,1);expect(input.item_type).toBe('product');expect(input.calories_snapshot).toBe(125);expect(input.product_name_snapshot).toBe('Test bar');});
});
