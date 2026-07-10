import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { BarcodeLookupResponse, Product } from '../models/barcode-product.model';
import { MealType } from '../models/meal-plan.model';
import { buildProductMealPlanInput } from '../../shared/utils/barcode-product.utils';
import { MealPlanService } from './meal-plan.service'; import { SupabaseService } from './supabase.service';

@Injectable({providedIn:'root'}) export class BarcodeProductService {
  private supabase=inject(SupabaseService); private mealPlan=inject(MealPlanService);
  async lookup(barcode:string):Promise<BarcodeLookupResponse>{
    if(environment.useLocalApi) return {status:'temporarily_unavailable',retryable:true};
    const client=this.supabase.getClient(); if(!client)return {status:'temporarily_unavailable',retryable:true};
    const {data,error}=await client.functions.invoke<BarcodeLookupResponse>('lookup-barcode-product',{body:{barcode}});
    return error||!data?{status:'temporarily_unavailable',retryable:true}:data;
  }
  async add(product:Product,date:string,mealType:MealType,grams:number,servings:number){
    const result=await this.mealPlan.addSlotItem(buildProductMealPlanInput(product,date,mealType,grams,servings)); if(result.error)return result;
    const client=this.supabase.getClient(); if(client&&!environment.useLocalApi){const userId=(await client.auth.getUser()).data.user?.id;if(userId){const {data:pref}=await client.from('user_product_preferences').select('times_used').eq('user_id',userId).eq('product_id',product.id).maybeSingle();await client.from('user_product_preferences').upsert({user_id:userId,product_id:product.id,default_serving_quantity:servings,default_serving_unit:'serving',default_serving_grams:grams/servings,default_meal_slot:mealType,times_used:Number(pref?.times_used??0)+1,last_used_at:new Date().toISOString()},{onConflict:'user_id,product_id'});}}
    return result;
  }
}
