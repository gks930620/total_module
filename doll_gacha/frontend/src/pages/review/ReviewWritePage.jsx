import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import ReviewForm from './ReviewForm.jsx'
import { fetchShop, createReview, uploadReviewImages } from '../../api/review.js'

// 리뷰 작성 페이지 (review/write.html 재현)
//  - 대상 가게 id 는 URL 쿼리(shopId)로 받는다: /review/write?shopId=X
//  - 제출 후 매장 상세(/doll-shop/detail?id=shopId)로 이동한다.
export default function ReviewWritePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const shopId = searchParams.get('shopId')

  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    if (!shopId) {
      setLoadError('가게 정보가 없습니다.')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    fetchShop(shopId)
      .then((data) => {
        if (!alive) return
        setShop(data)
        setLoadError(null)
      })
      .catch((err) => {
        if (alive) setLoadError(err.message || '가게 정보를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [shopId])

  const handleSubmit = async (payload, { newFiles }) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const created = await createReview({ ...payload, dollShopId: Number(shopId) })
      if (newFiles.length > 0 && created?.id) {
        await uploadReviewImages(created.id, newFiles)
      }
      navigate(`/doll-shop/detail?id=${shopId}`)
    } catch (err) {
      setSubmitError(err.message || '리뷰 등록에 실패했습니다.')
      setSubmitting(false)
    }
  }

  const handleCancel = () => navigate(-1)

  if (loading) return <div className="state-msg">불러오는 중...</div>
  if (loadError) return <div className="state-msg error-text">{loadError}</div>

  return (
    <ReviewForm
      mode="write"
      title="리뷰 작성"
      submitLabel="리뷰 등록"
      shop={shop}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      submitting={submitting}
      error={submitError}
    />
  )
}
