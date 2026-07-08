import { useEffect, useState } from 'react'

// 리뷰 작성/수정 공용 폼 (review/write.html · review/edit.html 의 form 재현)
//  - 별점 / 기계 힘 / 리뷰 내용 / 인형 크기별 지출(천원 단위) / 이미지
//  - DOM 조작을 React 상태로 변환. 비용은 천원 단위로 입력받아 제출 시 원 단위로 변환한다.
//
// props:
//   mode         : 'write' | 'edit'  (write 에서만 단계 표시)
//   title        : 페이지 제목
//   submitLabel  : 제출 버튼 라벨
//   shop         : { businessName, address } | null  (상단 가게 정보 박스)
//   initial      : { rating, machineStrength, content, largeDollCost, mediumDollCost, smallDollCost } (비용은 원 단위)
//   existingImages : FileDetailDTO[] [{ fileId, previewUrl }]  (수정 시 기존 이미지)
//   submitting   : boolean
//   error        : string | null  (API 에러)
//   onSubmit(payload, { newFiles, removedFileIds })
//   onCancel()
const STARS = [1, 2, 3, 4, 5]

// 원 단위 -> 천원 단위 입력값
function toThousands(won) {
  if (won == null || won === '') return ''
  return String(Math.round(Number(won) / 1000))
}

// 천원 단위 입력값 -> 원 단위 (빈 값이면 null)
function toWon(thousands) {
  if (thousands === '' || thousands == null) return null
  return parseInt(thousands, 10) * 1000
}

export default function ReviewForm({
  mode = 'write',
  title = '리뷰 작성',
  submitLabel = '리뷰 등록',
  shop = null,
  initial = {},
  existingImages = [],
  submitting = false,
  error = null,
  onSubmit,
  onCancel,
}) {
  const [rating, setRating] = useState(initial.rating ?? 0)
  const [machineStrength, setMachineStrength] = useState(initial.machineStrength ?? 0)
  const [content, setContent] = useState(initial.content ?? '')
  const [largeDollCost, setLargeDollCost] = useState(toThousands(initial.largeDollCost))
  const [mediumDollCost, setMediumDollCost] = useState(toThousands(initial.mediumDollCost))
  const [smallDollCost, setSmallDollCost] = useState(toThousands(initial.smallDollCost))

  const [newImages, setNewImages] = useState([]) // { file, preview }
  const [removedFileIds, setRemovedFileIds] = useState([])
  const [formError, setFormError] = useState(null)

  // 언마운트 시 미리보기 URL 정리
  useEffect(() => {
    return () => {
      newImages.forEach((img) => URL.revokeObjectURL(img.preview))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visibleExisting = existingImages.filter((img) => !removedFileIds.includes(img.fileId))

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files || [])
    e.target.value = ''
    const images = selected.filter((f) => f.type.startsWith('image/'))
    if (images.length !== selected.length) {
      setFormError('이미지 파일만 업로드 가능합니다. (JPG, PNG, GIF 등)')
    }
    if (images.length === 0) return
    setNewImages((prev) => [...prev, ...images.map((file) => ({ file, preview: URL.createObjectURL(file) }))])
  }

  const removeNewImage = (idx) => {
    setNewImages((prev) => {
      const target = prev[idx]
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const removeExistingImage = (fileId) => {
    setRemovedFileIds((prev) => (prev.includes(fileId) ? prev : [...prev, fileId]))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!rating) {
      setFormError('전체 별점을 선택해주세요.')
      return
    }
    if (!machineStrength) {
      setFormError('기계 힘을 선택해주세요.')
      return
    }
    if (!content.trim()) {
      setFormError('리뷰 내용은 필수입니다.')
      return
    }
    setFormError(null)

    const payload = {
      content: content.trim(),
      rating,
      machineStrength,
      largeDollCost: toWon(largeDollCost),
      mediumDollCost: toWon(mediumDollCost),
      smallDollCost: toWon(smallDollCost),
    }
    onSubmit(payload, {
      newFiles: newImages.map((img) => img.file),
      removedFileIds,
    })
  }

  const shownError = error || formError

  const costFields = [
    ['대형 인형', '예: 10', largeDollCost, setLargeDollCost],
    ['중형 인형', '예: 5', mediumDollCost, setMediumDollCost],
    ['소형 인형', '예: 2', smallDollCost, setSmallDollCost],
  ]

  return (
    <div className="review-form-page">
      <style>{FORM_STYLES}</style>

      <div className="form-container">
        <div className="form-header">
          <h1>{title}</h1>
        </div>

        {mode === 'write' && (
          <div className="step-indicator">
            <div className="step">
              <span className="material-icons">check_circle</span>
              <span>1. 가게 선택</span>
            </div>
            <div className="step active">
              <span className="material-icons">rate_review</span>
              <span>2. 리뷰 작성</span>
            </div>
          </div>
        )}

        {shop && (
          <div className="shop-info-box">
            <h3>
              <span className="material-icons">store</span>
              <span>{shop.businessName}</span>
            </h3>
            <p>{shop.address}</p>
          </div>
        )}

        <form className="review-form" onSubmit={handleSubmit} encType="multipart/form-data">
          {/* 전체 별점 */}
          <div className="form-group">
            <label className="form-label">
              전체 별점 <span className="required">*</span>
            </label>
            <div className="rating-input">
              {STARS.map((v) => (
                <span
                  key={v}
                  className={`material-icons rating-star${v <= rating ? ' active' : ''}`}
                  data-value={v}
                  onClick={() => setRating(v)}
                >
                  star
                </span>
              ))}
            </div>
          </div>

          {/* 기계 힘 평가 */}
          <div className="form-group">
            <label className="form-label">
              기계 힘 평가 (1: 약함 ~ 5: 강함) <span className="required">*</span>
            </label>
            <div className="strength-input">
              {STARS.map((v) => (
                <span
                  key={v}
                  className={`strength-btn${v === machineStrength ? ' active' : ''}`}
                  data-value={v}
                  onClick={() => setMachineStrength(v)}
                >
                  {v}
                </span>
              ))}
            </div>
          </div>

          {/* 리뷰 내용 */}
          <div className="form-group">
            <label className="form-label" htmlFor="content">
              리뷰 내용 <span className="required">*</span>
            </label>
            <textarea
              id="content"
              className="form-textarea"
              placeholder="이 인형뽑기방에 대한 솔직한 후기를 남겨주세요"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* 인형 크기별 지출 금액 */}
          <div className="form-group">
            <label className="form-label">인형 크기별 지출 금액 (천원 단위, 선택)</label>
            <div className="cost-inputs">
              {costFields.map(([label, placeholder, value, setter]) => (
                <div className="cost-input-group" key={label}>
                  <label className="cost-label">{label}</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="number"
                      className="form-input"
                      placeholder={placeholder}
                      min="1"
                      max="100"
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#757575',
                        fontSize: 12,
                      }}
                    >
                      천원
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="helper-text">인형 1개당 대략 지출한 금액 (천원 단위)</div>
          </div>

          {/* 사진 첨부 */}
          <div className="form-group">
            <label className="form-label">사진 첨부 (이미지 파일만 가능, 선택)</label>
            <div className="image-preview-list">
              {visibleExisting.map((img) => (
                <div className="image-preview-item" key={`exist-${img.fileId}`}>
                  <img src={img.previewUrl} alt="리뷰 이미지" />
                  <button
                    type="button"
                    className="image-remove-btn"
                    onClick={() => removeExistingImage(img.fileId)}
                  >
                    <span className="material-icons" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>
              ))}
              {newImages.map((img, idx) => (
                <div className="image-preview-item" key={img.preview}>
                  <img src={img.preview} alt={`새 이미지 ${idx + 1}`} />
                  <button type="button" className="image-remove-btn" onClick={() => removeNewImage(idx)}>
                    <span className="material-icons" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>
              ))}
              <label className="image-add-btn">
                <span className="material-icons">add_photo_alternate</span>
                <span>사진 추가</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          </div>

          {shownError && (
            <div className="error-text" style={{ marginBottom: 12 }}>
              {shownError}
            </div>
          )}

          {/* 버튼 */}
          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
              취소
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '처리 중...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const FORM_STYLES = `
.review-form-page .form-container { max-width: 800px; margin: 0 auto; }
.review-form-page .form-header { margin-bottom: 32px; }
.review-form-page .form-header h1 { font-size: 24px; font-weight: 500; color: #212121; margin-bottom: 8px; }
.review-form-page .step-indicator { display: flex; gap: 16px; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #e0e0e0; }
.review-form-page .step { flex: 1; display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 4px; color: #9e9e9e; }
.review-form-page .step.active { background-color: #ede7f6; color: #6200ea; font-weight: 500; }
.review-form-page .shop-info-box { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 24px; }
.review-form-page .shop-info-box h3 { font-size: 18px; font-weight: 500; margin-bottom: 12px; color: #212121; display: flex; align-items: center; gap: 8px; }
.review-form-page .shop-info-box p { color: #616161; font-size: 14px; margin-bottom: 4px; }
.review-form-page .review-form { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.review-form-page .form-group { margin-bottom: 24px; }
.review-form-page .form-label { display: block; font-size: 14px; font-weight: 500; color: #212121; margin-bottom: 8px; }
.review-form-page .required { color: #c62828; }
.review-form-page .rating-input { display: flex; gap: 8px; }
.review-form-page .rating-star { font-size: 32px; color: #e0e0e0; cursor: pointer; transition: color 0.2s; }
.review-form-page .rating-star:hover, .review-form-page .rating-star.active { color: #ffd700; }
.review-form-page .strength-input { display: flex; gap: 8px; }
.review-form-page .strength-btn { width: 40px; height: 40px; border: 2px solid #e0e0e0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 500; cursor: pointer; transition: all 0.2s; background: white; }
.review-form-page .strength-btn:hover { border-color: #6200ea; color: #6200ea; }
.review-form-page .strength-btn.active { background: #6200ea; border-color: #6200ea; color: white; }
.review-form-page .form-input, .review-form-page .form-textarea { width: 100%; padding: 12px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; font-family: 'Roboto', sans-serif; }
.review-form-page .form-textarea { min-height: 150px; resize: vertical; }
.review-form-page .form-input:focus, .review-form-page .form-textarea:focus { outline: none; border-color: #6200ea; }
.review-form-page .cost-inputs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.review-form-page .cost-input-group { display: flex; flex-direction: column; gap: 4px; }
.review-form-page .cost-label { font-size: 13px; color: #616161; }
.review-form-page .helper-text { font-size: 12px; color: #9e9e9e; margin-top: 4px; }
.review-form-page .image-preview-list { display: flex; flex-wrap: wrap; gap: 12px; }
.review-form-page .image-preview-item { position: relative; width: 100px; height: 100px; border-radius: 8px; overflow: hidden; border: 1px solid #e0e0e0; }
.review-form-page .image-preview-item img { width: 100%; height: 100%; object-fit: cover; }
.review-form-page .image-remove-btn { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border: none; border-radius: 50%; background: rgba(0,0,0,0.6); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
.review-form-page .image-add-btn { width: 100px; height: 100px; border: 2px dashed #e0e0e0; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: #9e9e9e; font-size: 12px; cursor: pointer; }
.review-form-page .image-add-btn:hover { border-color: #6200ea; color: #6200ea; }
.review-form-page .form-actions { display: flex; gap: 12px; margin-top: 32px; }
.review-form-page .form-actions .btn { flex: 1; padding: 14px; border: none; border-radius: 4px; font-size: 16px; font-weight: 500; cursor: pointer; transition: background-color 0.2s; }
.review-form-page .form-actions .btn-primary { background-color: #6200ea; color: white; }
.review-form-page .form-actions .btn-primary:hover { background-color: #5100d3; }
.review-form-page .form-actions .btn-primary:disabled { background-color: #b39ddb; cursor: not-allowed; }
.review-form-page .form-actions .btn-secondary { background-color: #f5f5f5; color: #616161; }
.review-form-page .form-actions .btn-secondary:hover { background-color: #eeeeee; }
@media (max-width: 768px) { .review-form-page .cost-inputs { grid-template-columns: 1fr; } }
`
