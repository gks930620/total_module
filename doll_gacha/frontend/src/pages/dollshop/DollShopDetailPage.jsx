import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  fetchShop,
  fetchShopImages,
  fetchReviews,
  fetchReviewStats,
  createReview,
  deleteReview,
  uploadReviewFiles,
} from '../../api/dollshop.js'
import ReviewForm from './components/ReviewForm.jsx'
import Lightbox from './components/Lightbox.jsx'

const PAGE_SIZE = 10
const DEFAULT_IMAGE = '/images/default-shop.png'

export default function DollShopDetailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const shopId = searchParams.get('id')
  const { isAuthenticated, user } = useAuth()
  const currentUserId = user?.id ?? null

  const [shop, setShop] = useState(null)
  const [shopImage, setShopImage] = useState(DEFAULT_IMAGE)
  const [shopError, setShopError] = useState('')

  const [stats, setStats] = useState(null)

  const [reviewPage, setReviewPage] = useState(null)
  const [page, setPage] = useState(0)

  const [showForm, setShowForm] = useState(false)
  const [lightbox, setLightbox] = useState(null) // { images, index }

  // 잘못된 접근 방어
  useEffect(() => {
    if (!shopId) {
      alert('잘못된 접근입니다. 가게 ID가 없습니다.')
      navigate('/map')
    }
  }, [shopId, navigate])

  // 매장 상세 + 이미지
  useEffect(() => {
    if (!shopId) return
    let cancelled = false
    setShopError('')
    fetchShop(shopId)
      .then((data) => { if (!cancelled) setShop(data) })
      .catch((err) => { if (!cancelled) setShopError(err.message || '가게 정보를 불러오지 못했습니다.') })

    fetchShopImages(shopId)
      .then((images) => {
        if (!cancelled && images && images.length > 0) setShopImage(images[0])
      })
      .catch(() => { /* 실패 시 기본 이미지 유지 */ })

    return () => { cancelled = true }
  }, [shopId])

  // 리뷰 통계
  const loadStats = useCallback(() => {
    if (!shopId) return
    fetchReviewStats(shopId)
      .then(setStats)
      .catch(() => setStats(null))
  }, [shopId])

  // 리뷰 목록
  const loadReviews = useCallback((p) => {
    if (!shopId) return
    fetchReviews(shopId, { page: p, size: PAGE_SIZE })
      .then(setReviewPage)
      .catch(() => setReviewPage(null))
  }, [shopId])

  useEffect(() => { loadStats() }, [loadStats])
  useEffect(() => { loadReviews(page) }, [loadReviews, page])

  const goToPage = (p) => {
    setPage(p)
    document.querySelector('.review-list')?.scrollIntoView({ behavior: 'smooth' })
  }

  // 리뷰 등록 (JSON 생성 → 이미지 업로드)
  const handleCreateReview = async (payload, files) => {
    const created = await createReview({ ...payload, dollShopId: parseInt(shopId, 10) })
    if (files.length > 0 && created?.id) {
      try {
        await uploadReviewFiles(created.id, files)
        alert('리뷰와 사진이 등록되었습니다!')
      } catch {
        alert('리뷰는 등록되었으나 사진 업로드에 실패했습니다.')
      }
    } else {
      alert('리뷰가 등록되었습니다!')
    }
    setShowForm(false)
    setPage(0)
    loadReviews(0)
    loadStats()
  }

  const handleDelete = async (reviewId) => {
    if (!confirm('정말 이 리뷰를 삭제하시겠습니까?\n삭제 후 재등록이 필요합니다.')) return
    try {
      await deleteReview(reviewId)
      alert('리뷰가 삭제되었습니다.')
      loadReviews(page)
      loadStats()
    } catch (err) {
      alert(err.message || '리뷰 삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <>
      <style>{DETAIL_STYLES}</style>

      <div className="detail-container">
        <div className="image-section">
          <div className="main-image" style={{ background: 'none', padding: 0 }}>
            <img
              src={shopImage}
              alt="매장 이미지"
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
              onError={(e) => { e.target.src = DEFAULT_IMAGE }}
            />
          </div>
        </div>

        <div className="info-section">
          <h1 className="doll-title">{shop ? shop.businessName : shopError ? '정보를 불러올 수 없습니다' : '로딩중...'}</h1>
          <div className="info-divider" />
          <div className="info-items">
            <InfoItem icon="location_on" label="주소" value={shop?.address || '-'} />
            <InfoItem icon="phone" label="전화번호" value={shop?.phone || '정보 없음'} />
            <InfoItem icon="videogame_asset" label="기계 수" value={shop ? `${shop.totalGameMachines}대` : '-'} />
            <InfoItem icon="verified" label="운영 상태" value={shop ? (shop.isOperating ? '운영중' : '폐업') : '-'} />
          </div>
        </div>
      </div>

      {/* Review Statistics */}
      <div className="review-stats">
        <h2 style={{ fontSize: 20, marginBottom: 20 }}>리뷰 통계</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <StatCard bg="#f5f5f5" color="#6200ea" label="총 리뷰"
            value={stats ? `${stats.totalReviews}개` : '-'} />
          <StatCard bg="#fff3e0" color="#ff9800" label="평균 별점"
            value={
              <>
                <span className="material-icons" style={{ fontSize: 28 }}>star</span>
                <span>{stats && stats.avgRating ? stats.avgRating.toFixed(1) : '0.0'}</span>
              </>
            }
            flex
          />
          <StatCard bg="#e8f5e9" color="#4caf50" label="평균 기계 힘"
            value={`${stats && stats.avgMachineStrength ? stats.avgMachineStrength.toFixed(1) : '0.0'} / 5`} />
          <StatCard bg="#fce4ec" color="#e91e63" label="평균 대형 비용" small
            value={formatCost(stats?.avgLargeDollCost)} />
          <StatCard bg="#e3f2fd" color="#2196f3" label="평균 중형 비용" small
            value={formatCost(stats?.avgMediumDollCost)} />
          <StatCard bg="#f3e5f5" color="#9c27b0" label="평균 소형 비용" small
            value={formatCost(stats?.avgSmallDollCost)} />
        </div>
      </div>

      {/* Reviews */}
      <div className="review-list">
        <div className="review-header-section">
          <h2 style={{ fontSize: 20 }}>리뷰</h2>
          {isAuthenticated && (
            <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>리뷰 작성</button>
          )}
        </div>

        {showForm && isAuthenticated && (
          <ReviewForm onSubmit={handleCreateReview} onCancel={() => setShowForm(false)} />
        )}

        <div>
          {!reviewPage || reviewPage.content.length === 0 ? (
            <p style={{ color: '#757575', padding: 20 }}>등록된 리뷰가 없습니다.</p>
          ) : (
            reviewPage.content.map((review) => (
              <ReviewItem
                key={review.id}
                review={review}
                canDelete={isAuthenticated && currentUserId === review.userId}
                onDelete={() => handleDelete(review.id)}
                onOpenImage={(index) => setLightbox({ images: review.imageUrls, index })}
              />
            ))
          )}
        </div>

        {reviewPage && reviewPage.totalPages > 1 && (
          <ReviewPagination pageData={reviewPage} onPage={goToPage} />
        )}
      </div>

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  )
}

function InfoItem({ icon, label, value }) {
  return (
    <div className="info-item">
      <div className="info-item-icon">
        <span className="material-icons">{icon}</span>
      </div>
      <div className="info-item-content">
        <div className="info-item-label">{label}</div>
        <div className="info-item-value">{value}</div>
      </div>
    </div>
  )
}

function StatCard({ bg, color, label, value, small, flex }) {
  return (
    <div style={{ padding: 16, background: bg, borderRadius: 8, textAlign: 'center' }}>
      <div style={{ fontSize: 13, color: '#757575', marginBottom: 8 }}>{label}</div>
      <div style={{
        fontSize: small ? 20 : 24, fontWeight: 'bold', color,
        ...(flex ? { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 } : {}),
      }}>
        {value}
      </div>
    </div>
  )
}

function formatCost(cost) {
  return cost ? `${Math.round(cost).toLocaleString()}원` : '데이터 없음'
}

function Stars({ rating }) {
  return (
    <>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="material-icons" style={{ fontSize: 16 }}>
          {i < rating ? 'star' : 'star_border'}
        </span>
      ))}
    </>
  )
}

function ReviewItem({ review, canDelete, onDelete, onOpenImage }) {
  const hasImages = review.imageUrls && review.imageUrls.length > 0
  return (
    <div className="review-item">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>{review.nickname || '익명'}</strong>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#FF9800', display: 'flex', alignItems: 'center' }}>
            <Stars rating={review.rating} />
          </span>
          {canDelete && (
            <button
              onClick={onDelete}
              style={{ padding: '4px 8px', background: '#f44336', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
            >
              삭제
            </button>
          )}
        </div>
      </div>
      <div style={{ fontSize: 13, color: '#757575', marginBottom: 8 }}>
        기계 힘: {review.machineStrength}/5
        {review.largeDollCost ? ` | 대형: ${review.largeDollCost.toLocaleString()}원` : ''}
        {review.mediumDollCost ? ` | 중형: ${review.mediumDollCost.toLocaleString()}원` : ''}
        {review.smallDollCost ? ` | 소형: ${review.smallDollCost.toLocaleString()}원` : ''}
      </div>
      <p>{review.content}</p>
      {hasImages && (
        <div className="review-images">
          {review.imageUrls.map((url, index) => (
            <img
              key={url}
              src={url}
              alt={`리뷰 이미지 ${index + 1}`}
              className="review-image-thumb"
              onClick={() => onOpenImage(index)}
            />
          ))}
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
        {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
      </div>
    </div>
  )
}

function ReviewPagination({ pageData, onPage }) {
  const { totalPages, page } = pageData
  const startPage = Math.max(0, page - 2)
  const endPage = Math.min(totalPages - 1, startPage + 4)
  const pages = []
  for (let i = startPage; i <= endPage; i++) pages.push(i)

  const btnStyle = (active) => ({
    padding: '8px 12px', border: '1px solid #ddd',
    background: active ? '#6200ea' : 'white', color: active ? 'white' : 'black',
    borderRadius: 4, cursor: 'pointer', fontWeight: active ? 'bold' : 'normal',
  })

  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
      {page > 0 && <button onClick={() => onPage(page - 1)} style={btnStyle(false)}>이전</button>}
      {pages.map((i) => (
        <button key={i} onClick={() => onPage(i)} style={btnStyle(i === page)}>{i + 1}</button>
      ))}
      {page < totalPages - 1 && <button onClick={() => onPage(page + 1)} style={btnStyle(false)}>다음</button>}
    </div>
  )
}

const DETAIL_STYLES = `
  .detail-container { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
  @media (max-width: 968px) { .detail-container { grid-template-columns: 1fr; } }
  .image-section { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  .main-image { width: 100%; aspect-ratio: 16/9; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; overflow: hidden; }
  .info-section { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  .doll-title { font-size: 28px; font-weight: 500; color: #212121; margin-bottom: 16px; }
  .info-divider { height: 1px; background-color: #e0e0e0; margin: 24px 0; }
  .info-items { display: flex; flex-direction: column; gap: 16px; }
  .info-item { display: flex; align-items: flex-start; gap: 12px; }
  .info-item-icon { width: 40px; height: 40px; border-radius: 50%; background-color: #f5f5f5; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .info-item-content { flex: 1; }
  .info-item-label { font-size: 13px; color: #757575; margin-bottom: 4px; }
  .info-item-value { font-size: 15px; color: #212121; font-weight: 500; }
  .review-stats { margin-top: 32px; background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  .review-list { margin-top: 32px; background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  .review-header-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
  .review-item { padding: 20px 0; border-bottom: 1px solid #f5f5f5; }
  .review-form { background: #f9f9f9; padding: 20px; border-radius: 8px; margin-top: 20px; margin-bottom: 20px; }
  .review-form .form-group { margin-bottom: 16px; }
  .review-form .form-group label { display: block; margin-bottom: 8px; font-weight: 500; }
  .review-form .form-control { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit; }
  .rating-input { display: flex; gap: 4px; color: #ddd; cursor: pointer; }
  .rating-input .material-icons.active { color: #ff9800; }
  .strength-input { display: flex; gap: 8px; }
  .strength-btn { width: 40px; height: 40px; border: 2px solid #e0e0e0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 500; cursor: pointer; transition: all 0.2s; background: white; }
  .strength-btn:hover { border-color: #6200ea; color: #6200ea; }
  .strength-btn.active { background: #6200ea; border-color: #6200ea; color: white; }
  .image-upload-container { display: flex; flex-direction: column; gap: 12px; }
  .image-preview-list { display: flex; gap: 12px; flex-wrap: wrap; }
  .image-preview-item { position: relative; width: 120px; height: 120px; border: 2px solid #e0e0e0; border-radius: 8px; overflow: hidden; }
  .image-preview-item img { width: 100%; height: 100%; object-fit: cover; }
  .image-remove-btn { position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border-radius: 50%; background: rgba(0,0,0,0.7); color: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; padding: 0; }
  .image-remove-btn:hover { background: rgba(0,0,0,0.9); }
  .image-add-btn { width: 120px; height: 120px; border: 2px dashed #bdbdbd; border-radius: 8px; background: #f5f5f5; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
  .image-add-btn:hover { border-color: #6200ea; background: #f0e6ff; }
  .image-add-btn.disabled { opacity: 0.5; cursor: not-allowed; border-color: #e0e0e0; background: #fafafa; }
  .image-add-btn .material-icons { font-size: 36px; color: #9e9e9e; }
  .image-add-btn span:last-child { font-size: 12px; color: #757575; margin-top: 4px; }
  .review-images { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
  .review-image-thumb { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; cursor: pointer; border: 2px solid #e0e0e0; transition: all 0.2s; }
  .review-image-thumb:hover { border-color: #6200ea; transform: scale(1.05); }
  .lightbox-modal { position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.95); animation: dsFadeIn 0.3s; }
  @keyframes dsFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .lightbox-content { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
  .lightbox-image { max-width: 90%; max-height: 90%; object-fit: contain; animation: dsZoomIn 0.3s; }
  @keyframes dsZoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .lightbox-close { position: absolute; top: 20px; right: 40px; color: white; font-size: 40px; font-weight: bold; cursor: pointer; transition: color 0.2s; z-index: 10000; }
  .lightbox-close:hover { color: #ff5252; }
  .lightbox-nav { position: absolute; top: 50%; transform: translateY(-50%); color: white; font-size: 48px; cursor: pointer; padding: 20px; user-select: none; transition: color 0.2s; z-index: 10000; }
  .lightbox-nav:hover { color: #6200ea; }
  .lightbox-prev { left: 20px; }
  .lightbox-next { right: 20px; }
  .lightbox-counter { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); color: white; font-size: 16px; background: rgba(0,0,0,0.7); padding: 8px 16px; border-radius: 20px; }
`
