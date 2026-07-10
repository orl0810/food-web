export interface AppFeedback {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  app_context: string | null;
  created_at: string;
}

export interface AppFeedbackInsert {
  rating: number;
  comment?: string | null;
  app_context?: string | null;
}
