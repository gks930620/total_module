import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { searchShops } from '../../api/dollshop.js'
import { SIDO_LIST, SIGUNGU_DATA } from './components/regionData.js'

const PAGE_SIZE = 10

const SORT_OPTIONS = [
  ['latest', '최신순'],
  ['rating', '평점순'],
  ['reviewCount', '리뷰많은순'],
  ['totalGameMachines', '기계많은순'],
  ['machineStrength', '기계힘순'],
  ['largeCost', '대형비용순'],
  ['mediumCost', '중형비용순'],
  ['smallCost', '소형비용순'],
]

export default function DollShopListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // 커밋된(=URL 반영된) 검색 조건
  const gubun1 = searchParams.get('gubun1') || ''
  const gubun2 = searchParams.get('gubun2') || ''
  const keyword = searchParams.get('keyword') || ''
  const sort = searchParams.get('sort') || 'latest'
  const page = parseInt(searchParams.get('page') || '0', 10)

  // 폼 입력 상태 (검색 버튼 클릭 전까지 URL 미반영)
  const [formGubun1, setFormGubun1] = useState(gubun1)
  const [formGubun2, setFormGubun2] = useState(gubun2)
  const [formKeyword, setFormKeyword] = useState(keyword)

  const [pageData, setPageData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // 뒤로가기/앞으로가기 등으로 URL 이 바뀌면 폼 입력 상태도 동기화
  useEffect(() => {
    setFormGubun1(gubun1)
    setFormGubun2(gubun2)
    setFormKeyword(keyword)
  }, [gubun1, gubun2, keyword])

  // URL(검색 조건) 변경 시 목록 조회
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    searchShops({ page, size: PAGE_SIZE, sort, gubun1, gubun2, keyword })
      .then((data) => {
        if (!cancelled) setPageData(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || '매장 목록을 불러오는데 실패했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [page, sort, gubun1, gubun2, keyword])

  // 검색 조건을 URL 에 반영 (page 는 기본 0으로 리셋)
  const commit = useCallback((next) => {
    const params = {}
    const g1 = next.gubun1 ?? gubun1
    const g2 = next.gubun2 ?? gubun2
    const kw = next.keyword ?? keyword
    const st = next.sort ?? sort
    const pg = next.page ?? 0
    if (g1) params.gubun1 = g1
    if (g2) params.gubun2 = g2
    if (kw) params.keyword = kw
    if (st && st !== 'latest') params.sort = st
    if (pg > 0) params.page = String(pg)
    setSearchParams(params)
  }, [gubun1, gubun2, keyword, sort, setSearchParams])

  const onGubun1Change = (value) => {
    setFormGubun1(value)
    setFormGubun2('') // 시/도 변경 시 시/군/구 초기화
  }

  const applyFilters = () => {
    commit({ gubun1: formGubun1, gubun2: formGubun2, keyword: formKeyword.trim(), sort, page: 0 })
  }

  const resetFilters = () => {
    setFormGubun1('')
    setFormGubun2('')
    setFormKeyword('')
    setSearchParams({})
  }

  const onSortChange = (value) => {
    commit({ gubun1: formGubun1, gubun2: formGubun2, keyword: formKeyword.trim(), sort: value, page: 0 })
  }

  const goToPage = (p) => {
    if (p < 0) return
    commit({ gubun1, gubun2, keyword, sort, page: p })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goToDetail = (shopId) => navigate(`/doll-shop/detail?id=${shopId}`)

  const gubun2Options = SIGUNGU_DATA[formGubun1] || []

  return (
    <>
      <style>{LIST_STYLES}</style>

      <div className="page-header">
        <h1 className="page-title">매장 목록</h1>
        <p className="page-description">전국의 인형뽑기방 매장을 확인하세요</p>
      </div>

      {/* Filter Section */}
      <div className="filter-section">
        <select className="filter-select" value={formGubun1} onChange={(e) => onGubun1Change(e.target.value)}>
          <option value="">전체 시/도</option>
          {SIDO_LIST.map((sido) => (
            <option key={sido} value={sido}>{sido}</option>
          ))}
        </select>

        <select className="filter-select" value={formGubun2} onChange={(e) => setFormGubun2(e.target.value)}>
          <option value="">전체 시/군/구</option>
          {gubun2Options.map((sgg) => (
            <option key={sgg} value={sgg}>{sgg}</option>
          ))}
        </select>

        <input
          type="text"
          className="filter-select"
          placeholder="매장명 검색..."
          style={{ flex: 1, minWidth: 200 }}
          value={formKeyword}
          onChange={(e) => setFormKeyword(e.target.value)}
          onKeyPress={(e) => { if (e.key === 'Enter') applyFilters() }}
        />

        <select className="filter-select" value={sort} onChange={(e) => onSortChange(e.target.value)}>
          {SORT_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        <button className="filter-btn" onClick={applyFilters}>
          <span className="material-icons">search</span>
          <span>검색</span>
        </button>

        <button className="filter-btn" onClick={resetFilters} style={{ backgroundColor: '#757575' }}>
          <span className="material-icons">refresh</span>
          <span>초기화</span>
        </button>
      </div>

      {/* Shop List */}
      <div className="shop-list">
        {loading ? (
          <div className="loading-state">
            <div className="material-icons">hourglass_empty</div>
            <div>매장 목록을 불러오는 중...</div>
          </div>
        ) : error ? (
          <div className="empty-state">
            <div className="material-icons">error_outline</div>
            <div>{error}</div>
          </div>
        ) : !pageData || pageData.content.length === 0 ? (
          <div className="empty-state">
            <div className="material-icons">store</div>
            <div>등록된 매장이 없습니다.</div>
          </div>
        ) : (
          pageData.content.map((shop) => (
            <ShopItem key={shop.id} shop={shop} onClick={() => goToDetail(shop.id)} />
          ))
        )}
      </div>

      {/* Pagination */}
      {pageData && pageData.totalPages > 1 && (
        <Pagination pageData={pageData} onPage={goToPage} />
      )}
    </>
  )
}

function ShopItem({ shop, onClick }) {
  const hasReviews = shop.reviewCount > 0
  const showCost = hasReviews && (shop.averageLargeCost > 0 || shop.averageMediumCost > 0 || shop.averageSmallCost > 0)
  return (
    <div className="shop-item" onClick={onClick}>
      <div className="shop-image">
        <img
          src={shop.imagePath || '/images/default-shop.png'}
          alt={shop.businessName}
          onError={(e) => { e.target.src = '/images/default-shop.png' }}
        />
      </div>
      <div className="shop-info">
        <div className="shop-name">{shop.businessName}</div>
        <div className="shop-address">
          <span className="material-icons" style={{ fontSize: 16 }}>location_on</span>
          <span>{shop.address}</span>
        </div>
        <div className="shop-meta">
          {hasReviews ? (
            <div className="shop-meta-item">
              <span className="material-icons" style={{ fontSize: 16, color: '#ffc107' }}>star</span>
              <span>{shop.averageRating.toFixed(1)} ({shop.reviewCount})</span>
            </div>
          ) : (
            <div className="shop-meta-item">
              <span className="material-icons" style={{ fontSize: 16, color: '#ccc' }}>star_outline</span>
              <span style={{ color: '#999' }}>리뷰 없음</span>
            </div>
          )}
          <div className="shop-meta-item">
            <span className="material-icons" style={{ fontSize: 16 }}>videogame_asset</span>
            <span>기계 {shop.totalGameMachines}대</span>
          </div>
          {hasReviews && shop.averageMachineStrength > 0 && (
            <div className="shop-meta-item">
              <span className="material-icons" style={{ fontSize: 16, color: '#ff5722' }}>fitness_center</span>
              <span>기계힘 {shop.averageMachineStrength.toFixed(1)}</span>
            </div>
          )}
          {showCost && (
            <div className="shop-meta-item">
              <span className="material-icons" style={{ fontSize: 16, color: '#4caf50' }}>paid</span>
              <span>
                {shop.averageLargeCost > 0 ? `대 ${Math.round(shop.averageLargeCost)}원` : ''}
                {shop.averageMediumCost > 0 ? ` 중 ${Math.round(shop.averageMediumCost)}원` : ''}
                {shop.averageSmallCost > 0 ? ` 소 ${Math.round(shop.averageSmallCost)}원` : ''}
              </span>
            </div>
          )}
          {shop.phone && (
            <div className="shop-meta-item">
              <span className="material-icons" style={{ fontSize: 16 }}>phone</span>
              <span>{shop.phone}</span>
            </div>
          )}
        </div>
      </div>
      <div className="shop-status">
        <span className={`status-badge ${shop.isOperating ? 'status-operating' : 'status-closed'}`}>
          {shop.isOperating ? '운영중' : '폐업'}
        </span>
        <span className="shop-id">#{shop.id}</span>
      </div>
    </div>
  )
}

function Pagination({ pageData, onPage }) {
  const { totalPages, page } = pageData
  const startPage = Math.max(0, page - 5)
  const endPage = Math.min(totalPages - 1, startPage + 9)
  const pages = []
  for (let i = startPage; i <= endPage; i++) pages.push(i)

  return (
    <div className="pagination-container">
      <button className="pagination-btn" onClick={() => onPage(page - 1)} disabled={page === 0}>이전</button>
      {pages.map((i) => (
        <button
          key={i}
          className={`pagination-btn${i === page ? ' active' : ''}`}
          onClick={() => onPage(i)}
        >
          {i + 1}
        </button>
      ))}
      <button className="pagination-btn" onClick={() => onPage(page + 1)} disabled={page === totalPages - 1}>다음</button>
    </div>
  )
}

const LIST_STYLES = `
  .page-header { margin-bottom: 24px; }
  .page-title { font-size: 28px; font-weight: 500; color: #212121; margin-bottom: 8px; }
  .page-description { color: #757575; font-size: 14px; }
  .filter-section { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 24px; display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
  .filter-select { padding: 10px 16px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; background: white; cursor: pointer; min-width: 120px; }
  .filter-btn { padding: 10px 20px; background-color: #6200ea; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 500; font-size: 14px; display: flex; align-items: center; gap: 4px; }
  .filter-btn:hover { background-color: #5000d0; }
  .shop-list { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
  .shop-item { display: grid; grid-template-columns: 120px 1fr auto; gap: 16px; padding: 20px; border-bottom: 1px solid #f5f5f5; cursor: pointer; transition: background-color 0.2s; }
  .shop-item:hover { background-color: #f9f9f9; }
  .shop-item:last-child { border-bottom: none; }
  .shop-image { width: 120px; height: 90px; border-radius: 8px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .shop-image img { width: 100%; height: 100%; object-fit: cover; }
  .shop-info { flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .shop-name { font-size: 18px; font-weight: 500; color: #212121; margin-bottom: 4px; }
  .shop-address { font-size: 14px; color: #757575; display: flex; align-items: center; gap: 4px; }
  .shop-meta { display: flex; gap: 16px; font-size: 13px; color: #757575; flex-wrap: wrap; }
  .shop-meta-item { display: flex; align-items: center; gap: 4px; }
  .shop-status { display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: 8px; }
  .status-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; }
  .status-operating { background-color: #e8f5e9; color: #4caf50; }
  .status-closed { background-color: #ffebee; color: #f44336; }
  .shop-id { font-size: 12px; color: #999; }
  .pagination-container { display: flex; justify-content: center; gap: 8px; margin-top: 24px; flex-wrap: wrap; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  .pagination-btn { padding: 8px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s; }
  .pagination-btn:hover:not(:disabled) { background-color: #f5f5f5; }
  .pagination-btn.active { background-color: #6200ea; color: white; border-color: #6200ea; font-weight: bold; }
  .pagination-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .loading-state, .empty-state { text-align: center; padding: 60px 20px; color: #757575; }
  .loading-state .material-icons, .empty-state .material-icons { font-size: 64px; color: #ccc; margin-bottom: 16px; }
  @media (max-width: 768px) {
    .shop-item { grid-template-columns: 1fr; }
    .shop-image { width: 100%; height: 200px; }
    .shop-status { flex-direction: row; justify-content: flex-start; }
  }
`
