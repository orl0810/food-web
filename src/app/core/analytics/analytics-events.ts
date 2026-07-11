export const ProductEvent = {
  AiRecipeGenerationStarted: 'ai_recipe_generation_started',
  AiRecipeGenerationCompleted: 'ai_recipe_generation_completed',
  AiRecipeGenerationFailed: 'ai_recipe_generation_failed',
  ShoppingListGenerationFailed: 'shopping_list_generation_failed',
  BarcodeLookupFailed: 'barcode_lookup_failed',
  CriticalWorkflowFailed: 'critical_workflow_failed',
} as const;

export type ProductEventName = (typeof ProductEvent)[keyof typeof ProductEvent];

export interface ProductEventProperties {
  source?: string;
  method?: string;
  failure_stage?: string;
  error_code?: string;
  duration_ms?: number;
}
