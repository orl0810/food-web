import { ProductEventName, ProductEventProperties } from './analytics-events';

export interface ProductEventInsert {
  user_id: string;
  event_name: ProductEventName;
  properties: ProductEventProperties;
}
