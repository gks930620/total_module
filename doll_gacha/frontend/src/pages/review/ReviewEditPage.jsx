import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ReviewForm from './ReviewForm.jsx'
import {
  fetchShop,
  findReview,
  updateReview,
  fetchReviewImages,
  uploadReviewImages,
  deleteFile,
} from '../../api/review.js'

// 리뷰 수정 페이지 (review/edit.html 재현)
//  - 리뷰 id 는 URL 쿼리(id)로 받는다: /review/edit?id=X
//  - 백엔드에 리뷰 단건 GET 이 없으므로, 라우터 state.review 를 우선 사용하고
//    없으면 shopId(쿼리 또는 state)로 매장 리뷰 목록에서 찾는다.
//  - 제출 후 매장 상세(/doll-shop/detail?id=shopId)로 이동한다.
export default function ReviewEditPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const reviewId = searchParams.get('id')
  const shopIdParam = searchParams.get('shopId')

  const [review, setReview] = useState(null)
  const [shop, setShop] = useState(null)
  const [existingImages, setExistingImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    if (!reviewId) {
      setLoadError('리뷰 정보가 없습니다.')
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        // 1) 리뷰 데이터 확보 (state 우선 → 매장 리뷰 목록 조회)
        let r = location.state?.review || null
        const shopId = r?.dollShopId ?? shopIdParam
        if (!r) {
          if (!shopId) throw { message: '가게 정보가 없어 리뷰를 불러올 수 없습니다.' }
          r = await findReview(shopId, reviewId)
          if (!r) throw { message: '리뷰를 찾을 수 없습니다.' }
        }
        if (!alive) return
        setReview(r)

        // 2) 가게 정보 + 기존 이미지 병렬 로드 (실패해도 폼은 표시)
        const [shopData, images] = await Promise.all([
          fetchShop(r.dollShopId).catch(() => null),
          fetchReviewImages(r.id).catch(() => []),
        ])
        if (!alive) return
        setShop(shopData)
        setExistingImages(images)
        setLoadError(null)
      } catch (err) {
        if (alive) setLoadError(err.message || '리뷰를 불러오지 못했습니다.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [reviewId, shopIdParam, location.state])

  const handleSubmit = async (payload, { newFiles, removedFileIds }) => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      await updateReview(review.id, payload)
      // 삭제 표시된 기존 이미지 제거
      for (const fileId of removedFileIds) {
        await deleteFile(fileId).catch(() => {})
      }
      // 새로 추가된 이미지 업로드
      if (newFiles.length > 0) {
        await uploadReviewImages(review.id, newFiles)
      }
      navigate(`/doll-shop/detail?id=${review.dollShopId}`)
    } catch (err) {
      setSubmitError(err.message || '리뷰 수정에 실패했습니다.')
      setSubmitting(false)
    }
  }

  const handleCancel = () => navigate(-1)

  if (loading) return <div className="state-msg">불러오는 중...</div>
  if (loadError) return <div className="state-msg error-text">{loadError}</div>

  return (
    <ReviewForm
      mode="edit"
      title="리뷰 수정"
      submitLabel="수정 완료"
      shop={shop}
      initial={{
        rating: review.rating,
        machineStrength: review.machineStrength,
        content: review.content,
        largeDollCost: review.largeDollCost,
        mediumDollCost: review.mediumDollCost,
        smallDollCost: review.smallDollCost,
      }}
      existingImages={existingImages}
      onSubmit={handleSubmit}
      onCancel={handleCancel}
      submitting={submitting}
      error={submitError}
    />
  )
}
