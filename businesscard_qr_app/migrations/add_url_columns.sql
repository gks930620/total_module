-- VCF 파일 다운로드 URL과 이미지 파일 다운로드 URL 컬럼 추가
ALTER TABLE business_cards 
ADD COLUMN vcf_download_url TEXT,
ADD COLUMN business_card_image_url TEXT;

-- 컬럼에 대한 주석 추가
COMMENT ON COLUMN business_cards.vcf_download_url IS 'VCF 파일 다운로드를 위한 Storage 경로';
COMMENT ON COLUMN business_cards.business_card_image_url IS '명함 이미지 파일 다운로드를 위한 Storage URL';