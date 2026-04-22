-- Add business_card_image_url column to business_cards table
ALTER TABLE business_cards 
ADD COLUMN business_card_image_url TEXT;

-- Add comment for the new column
COMMENT ON COLUMN business_cards.business_card_image_url IS 'URL of the business card image stored in Supabase Storage';