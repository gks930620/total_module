-- Create download_tokens table for secure token-based downloads
CREATE TABLE IF NOT EXISTS download_tokens (
    token VARCHAR(64) PRIMARY KEY,
    card_id UUID NOT NULL REFERENCES business_cards(id) ON DELETE CASCADE,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('vcf', 'image')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP WITH TIME ZONE NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_download_tokens_card_id ON download_tokens(card_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_expires_at ON download_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_download_tokens_token_active ON download_tokens(token) WHERE is_used = FALSE AND expires_at > NOW();

-- Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM download_tokens
    WHERE expires_at < NOW() OR is_used = TRUE;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate download token
CREATE OR REPLACE FUNCTION generate_download_token(
    p_card_id UUID,
    p_file_type VARCHAR(10),
    p_expires_minutes INTEGER DEFAULT 5
)
RETURNS VARCHAR(64) AS $$
DECLARE
    new_token VARCHAR(64);
    token_exists BOOLEAN;
BEGIN
    -- Generate unique token
    LOOP
        new_token := encode(gen_random_bytes(32), 'hex');

        SELECT EXISTS(SELECT 1 FROM download_tokens WHERE token = new_token) INTO token_exists;

        EXIT WHEN NOT token_exists;
    END LOOP;

    -- Insert new token
    INSERT INTO download_tokens (token, card_id, file_type, expires_at)
    VALUES (
        new_token,
        p_card_id,
        p_file_type,
        NOW() + INTERVAL '1 minute' * p_expires_minutes
    );

    RETURN new_token;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate and use token
CREATE OR REPLACE FUNCTION use_download_token(p_token VARCHAR(64))
RETURNS TABLE(
    card_id UUID,
    file_type VARCHAR(10),
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    UPDATE download_tokens
    SET is_used = TRUE, used_at = NOW()
    WHERE token = p_token
      AND is_used = FALSE
      AND expires_at > NOW()
    RETURNING download_tokens.card_id, download_tokens.file_type, TRUE as is_valid;

    -- If no rows were updated, return invalid result
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::UUID, NULL::VARCHAR(10), FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE download_tokens ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (tokens are meant to be temporary)
CREATE POLICY "Allow all operations on download_tokens" ON download_tokens
FOR ALL USING (true);