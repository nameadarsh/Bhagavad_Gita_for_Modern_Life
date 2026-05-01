import os
import logging
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger("analytics")

class FeedbackService:
    def __init__(self):
        self.supabase_url = os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
        
        if not all([self.supabase_url, self.supabase_key]):
            logger.error("[Feedback] Supabase credentials missing")
            self.supabase = None
        else:
            try:
                self.supabase: Client = create_client(self.supabase_url, self.supabase_key)
                logger.info("[Feedback] Supabase client initialized")
            except Exception as e:
                logger.error(f"[Feedback] Failed to initialize Supabase: {e}")
                self.supabase = None

    def submit_feedback(self, rating: int, name: Optional[str], feedback: Optional[str]):
        if not (1 <= rating <= 5):
            return False, "Rating must be between 1 and 5"
        
        if feedback and len(feedback) > 500:
            return False, "Feedback is too long (max 500 characters)"

        if not self.supabase:
            logger.error("[Feedback] Cannot submit feedback: Supabase client not initialized")
            return False, "Database connection unavailable"
        
        try:
            data = {
                "rating": rating,
                "name": name,
                "feedback": feedback
            }
            response = self.supabase.table("feedback").insert(data).execute()
            
            if hasattr(response, 'data') and len(response.data) > 0:
                return True, "Feedback submitted successfully"
            else:
                logger.error(f"[Feedback] Unexpected response from Supabase: {response}")
                return False, "Failed to store feedback"
                
        except Exception as e:
            logger.error(f"[Feedback] Error submitting feedback: {e}")
            return False, str(e)
