-- Create business_cards table
CREATE TABLE IF NOT EXISTS business_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  full_name TEXT NOT NULL,
  structured_name TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  organization TEXT,
  title TEXT,
  address TEXT,
  note TEXT,
  profile_image_url TEXT,
  business_card_image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0
);

-- Create function to automatically update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at column
CREATE TRIGGER update_business_cards_updated_at 
    BEFORE UPDATE ON business_cards 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to increment view count
CREATE OR REPLACE FUNCTION increment_view_count(card_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE business_cards 
    SET view_count = view_count + 1 
    WHERE id = card_id;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (optional)
ALTER TABLE business_cards ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (you can customize this)
CREATE POLICY "Allow all operations on business_cards" ON business_cards
FOR ALL USING (true);