import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.107.0';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const valid=(code:string)=>/^(\d{8}|\d{12}|\d{13})$/.test(code);
const num=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?value:null;

serve(async(req)=>{
  if(req.method==='OPTIONS') return json({}); if(req.method!=='POST') return json({error:'Method not allowed'},405);
  const authorization=req.headers.get('Authorization'); if(!authorization) return json({error:'Unauthorized'},401);
  const url=Deno.env.get('SUPABASE_URL')!; const anon=Deno.env.get('SUPABASE_ANON_KEY')!; const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
  const {data:{user}}=await userClient.auth.getUser(); if(!user) return json({error:'Unauthorized'},401);
  const barcode=String((await req.json()).barcode??'').trim(); if(!valid(barcode)) return json({status:'invalid_barcode',barcode});
  const admin=createClient(url,service,{auth:{persistSession:false}});
  const {data:cached}=await admin.from('products').select('*').eq('barcode',barcode).or(`owner_id.is.null,owner_id.eq.${user.id}`).order('owner_id',{ascending:false}).limit(1).maybeSingle();
  const age=cached?.last_verified_at?(Date.now()-Date.parse(cached.last_verified_at))/86400000:Infinity;
  if(cached&&(cached.source==='user_created'||cached.verification_status==='verified'||age<((cached.data_completeness??0)>=.7?90:14))) return found(cached,'local',userClient);
  try {
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8000);
    const response=await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,{signal:controller.signal,headers:{'User-Agent':'PantryFlow/1.0 (hello@pantryflow.app)'}}); clearTimeout(timer);
    if(!response.ok) return cached?found(cached,'local',userClient):json({status:'temporarily_unavailable',retryable:true},503);
    const payload=await response.json(); const p=payload?.product;
    if(payload?.status!==1||!p) return cached?found(cached,'local',userClient):json({status:'not_found',barcode});
    const name=String(p.product_name_en||p.product_name||'').trim(); if(!name) return json({status:'not_found',barcode});
    const row={barcode,name,brand:String(p.brands||'').split(',')[0].trim()||null,image_url:p.image_front_url||p.image_url||null,
      serving_grams:num(p.serving_quantity),serving_quantity:num(p.serving_quantity),serving_unit:p.serving_quantity?'g':null,
      calories_per_100g:num(p.nutriments?.['energy-kcal_100g']),protein_per_100g:num(p.nutriments?.proteins_100g),carbohydrates_per_100g:num(p.nutriments?.carbohydrates_100g),fat_per_100g:num(p.nutriments?.fat_100g),sugar_per_100g:num(p.nutriments?.sugars_100g),fiber_per_100g:num(p.nutriments?.fiber_100g),sodium_mg_per_100g:num(p.nutriments?.sodium_100g)===null?null:num(p.nutriments?.sodium_100g)!*1000,
      ingredients:p.ingredients_text_en||p.ingredients_text||null,allergens:Array.isArray(p.allergens_tags)?p.allergens_tags.map((x:string)=>x.replace(/^en:/,'')):[],nutrition_grade:p.nutrition_grades||null,source:'open_food_facts',source_product_id:String(p.code||barcode),verification_status:'provider',data_completeness:num(p.completeness),provider_payload:payload,last_verified_at:new Date().toISOString(),owner_id:null};
    if(cached){for(const [key,value] of Object.entries(row)){if(value===null)delete (row as Record<string,unknown>)[key];}}
    const write=cached?.owner_id===null
      ?admin.from('products').update(row).eq('id',cached.id).select().single()
      :admin.from('products').insert(row).select().single();
    const {data:saved,error}=await write;
    if(error) return json({status:'temporarily_unavailable',retryable:true},503); return found(saved,'external',userClient);
  } catch { return cached?found(cached,'local',userClient):json({status:'temporarily_unavailable',retryable:true},503); }
});

async function found(row:Record<string,unknown>,source:'local'|'external',client:ReturnType<typeof createClient>){
  const {data:pref}=await client.from('user_product_preferences').select('*').eq('product_id',row.id).maybeSingle();
  return json({status:'found',source,product:{id:row.id,barcode:row.barcode,name:row.name,brand:row.brand,imageUrl:row.image_url,packageQuantity:row.package_quantity,packageUnit:row.package_unit,servingQuantity:row.serving_quantity,servingUnit:row.serving_unit,servingGrams:row.serving_grams,nutrition:{calories:row.calories_per_100g,protein:row.protein_per_100g,carbohydrates:row.carbohydrates_per_100g,fat:row.fat_per_100g,sugar:row.sugar_per_100g,fiber:row.fiber_per_100g,sodiumMg:row.sodium_mg_per_100g},ingredients:row.ingredients,allergens:row.allergens??[],nutritionGrade:row.nutrition_grade,source:row.source,verificationStatus:row.verification_status,dataCompleteness:row.data_completeness,lastVerifiedAt:row.last_verified_at},userPreference:pref?{productId:row.id,defaultServingQuantity:pref.default_serving_quantity,defaultServingUnit:pref.default_serving_unit,defaultServingGrams:pref.default_serving_grams,defaultMealSlot:pref.default_meal_slot,timesUsed:pref.times_used}:null});
}
