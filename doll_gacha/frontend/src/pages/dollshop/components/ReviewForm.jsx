import { useRef, useState } from 'react'

const MAX_IMAGES = 3

// 리뷰 작성 폼 (detail.html 의 reviewForm 재현)
// 별점 / 기계 힘 / 비용(천원 단위) / 내용 / 이미지(최대 3개)
// props: onSubmit(payload, files) => Promise ; onCancel()
export default function ReviewForm({ onSubmit, onCancel }) {
  const [rating, setRating] = useState(5)
  const [machineStrength, setMachineStrength] = useState(3)
  const [costLarge, setCostLarge] = useState('')
  const [costMedium, setCostMedium] = useState('')
  const [costSmall, setCostSmall] = useState('')
  const [content, setContent] = useState('')
  const [files, setFiles] = useState([]) // { file, preview }
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const triggerFileInput = () => {
    if (files.length >= MAX_IMAGES) {
      alert(`최대 ${MAX_IMAGES}개의 이미지만 업로드할 수 있습니다.`)
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다. (JPG, PNG, GIF 등)')
      return
    }
    if (files.length >= MAX_IMAGES) {
      alert(`최대 ${MAX_IMAGES}개의 이미지만 업로드할 수 있습니다.`)
      return
    }
    setFiles((prev) => [...prev, { file, preview: URL.createObjectURL(file) }])
  }

  const removeImage = (idx) => {
    setFiles((prev) => {
      const target = prev[idx]
      if (target) URL.revokeObjectURL(target.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const toWon = (v) => (v ? parseInt(v, 10) * 1000 : null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!content.trim()) {
      setError('리뷰 내용은 필수입니다.')
      return
    }
    setError('')
    setSubmitting(true)
    const payload = {
      // dollShopId 는 부모가 채워 넣는다
      content: content.trim(),
      rating: parseInt(rating, 10),
      machineStrength: parseInt(machineStrength, 10),
      largeDollCost: toWon(costLarge),
      mediumDollCost: toWon(costMedium),
      smallDollCost: toWon(costSmall),
    }
    try {
      await onSubmit(payload, files.map((f) => f.file))
      // 성공 시 부모가 리로드/토글 처리
    } catch (err) {
      setError(err.message || '리뷰 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const atMax = files.length >= MAX_IMAGES

  return (
    <div className="review-form active">
      <h3>리뷰 작성하기</h3>
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <div className="form-group">
          <label>별점</label>
          <div className="rating-input">
            {[1, 2, 3, 4, 5].map((v) => (
              <span
                key={v}
                className={`material-icons${v <= rating ? ' active' : ''}`}
                data-value={v}
                onClick={() => setRating(v)}
              >
                {v <= rating ? 'star' : 'star_border'}
              </span>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>기계 힘 (1: 약함 ~ 5: 강함)</label>
          <div className="strength-input">
            {[1, 2, 3, 4, 5].map((v) => (
              <span
                key={v}
                className={`strength-btn${v === machineStrength ? ' active' : ''}`}
                onClick={() => setMachineStrength(v)}
              >
                {v}
              </span>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>비용 (천원 단위, 예: 3 = 3,000원)</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              ['대형', costLarge, setCostLarge],
              ['중형', costMedium, setCostMedium],
              ['소형', costSmall, setCostSmall],
            ].map(([placeholder, value, setter]) => (
              <div key={placeholder} style={{ flex: 1, position: 'relative' }}>
                <input
                  type="number"
                  className="form-control"
                  placeholder={placeholder}
                  min="1"
                  max="100"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                />
                <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#757575', fontSize: 12 }}>천원</span>
              </div>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>내용</label>
          <textarea
            className="form-control"
            rows="4"
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>사진 첨부 (최대 {MAX_IMAGES}개, 이미지 파일만 가능)</label>
          <div className="image-upload-container">
            <div className="image-preview-list">
              {files.map((f, idx) => (
                <div className="image-preview-item" key={f.preview}>
                  <img src={f.preview} alt={`미리보기 ${idx + 1}`} />
                  <button type="button" className="image-remove-btn" onClick={() => removeImage(idx)}>
                    <span className="material-icons" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>
              ))}
              <div
                className={`image-add-btn${atMax ? ' disabled' : ''}`}
                onClick={atMax ? undefined : triggerFileInput}
              >
                <span className="material-icons">add_photo_alternate</span>
                <span>사진 추가 ({files.length}/{MAX_IMAGES})</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
            />
            <div style={{ fontSize: 12, color: '#757575', marginTop: 4 }}>
              * JPG, PNG, GIF 등 이미지 파일만 업로드 가능합니다.
            </div>
          </div>
        </div>

        {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? '등록 중...' : '등록 완료'}
          </button>
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={submitting}>
              취소
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
