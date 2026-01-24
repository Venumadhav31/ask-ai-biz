-- Add missing UPDATE policy for business_analyses table
CREATE POLICY "Users can update their own analyses"
ON public.business_analyses
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);