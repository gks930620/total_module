// 매장(doll-shop) + 리뷰 REST 계약 래퍼 (doll-shop/list.html, detail.html 계약 그대로)
//  - 공개 읽기는 callPublicApi, 인증 쓰기는 callApi, 파일 업로드는 authFetch+FormData 사용.
//  - 백엔드 응답은 ApiResponse({ data }) 로 통일되어 있다.
import { callApi, callPublicApi, authFetch, toApiError } from '../lib/http.js'

// 정렬 UI 값 -> 스프링 표준 sort 파라미터 (list.html 과 동일)
const SORT_MAP = {
  latest: 'id,desc',
  rating: 'averageRating,desc',
  reviewCount: 'reviewCount,desc',
  totalGameMachines: 'totalGameMachines,desc',
  machineStrength: 'averageMachineStrength,desc',
  largeCost: 'averageLargeCost,desc',
  mediumCost: 'averageMediumCost,desc',
  smallCost: 'averageSmallCost,desc',
}

/**
 * 매장 목록 검색 (공개)
 * GET /api/doll-shops/search?page=&size=&sort=&gubun1=&gubun2=&keyword=
 * @returns PageResponse: { content, page, size, totalElements, totalPages, first, last }
 */
export async function searchShops({ page = 0, size = 10, sort = 'latest', gubun1 = '', gubun2 = '', keyword = '' }) {
  const params = new URLSearchParams()
  params.append('page', page)
  params.append('size', size)
  params.append('sort', SORT_MAP[sort] || SORT_MAP.latest)
  if (gubun1) params.append('gubun1', gubun1)
  if (gubun2) params.append('gubun2', gubun2)
  if (keyword) params.append('keyword', keyword)

  const body = await callPublicApi(`/api/doll-shops/search?${params.toString()}`)
  return body.data
}

/**
 * 매장 상세 (공개)
 * GET /api/doll-shops/{id}
 * @returns DollShopDTO
 */
export async function fetchShop(id) {
  const body = await callPublicApi(`/api/doll-shops/${id}`)
  return body.data
}

/**
 * 매장 이미지 경로 목록 (공개). GET /api/files?refId=&refType=DOLL_SHOP&usage=THUMBNAIL
 * @returns string[]
 */
export async function fetchShopImages(shopId) {
  const params = new URLSearchParams({ refId: shopId, refType: 'DOLL_SHOP', usage: 'THUMBNAIL' })
  // 구버전(List<String> 직접 반환) 호환을 위해 배열이면 그대로, 아니면 ApiResponse.data 사용
  const body = await callPublicApi(`/api/files?${params.toString()}`)
  return Array.isArray(body) ? body : (body?.data ?? [])
}

/**
 * 매장 리뷰 목록 (공개, 페이징)
 * GET /api/reviews/doll-shop/{shopId}?page=&size=
 * @returns PageResponse<ReviewDTO>
 */
export async function fetchReviews(shopId, { page = 0, size = 10 } = {}) {
  const params = new URLSearchParams({ page, size })
  const body = await callPublicApi(`/api/reviews/doll-shop/${shopId}?${params.toString()}`)
  return body.data
}

/**
 * 매장 리뷰 통계 (공개)
 * GET /api/reviews/doll-shop/{shopId}/stats
 * @returns ReviewStatsDTO
 */
export async function fetchReviewStats(shopId) {
  const body = await callPublicApi(`/api/reviews/doll-shop/${shopId}/stats`)
  return body.data
}

/**
 * 리뷰 작성 (인증)
 * POST /api/reviews  body: ReviewCreateDTO
 * @returns ReviewDTO (생성됨)
 */
export async function createReview(payload) {
  const body = await callApi('/api/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return body.data
}

/**
 * 리뷰 수정 (인증)
 * PUT /api/reviews/{reviewId}  body: ReviewUpdateDTO
 * @returns ReviewDTO (수정됨)
 */
export async function updateReview(reviewId, payload) {
  const body = await callApi(`/api/reviews/${reviewId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return body.data
}

/**
 * 리뷰 삭제 (인증)
 * DELETE /api/reviews/{reviewId}
 */
export async function deleteReview(reviewId) {
  return callApi(`/api/reviews/${reviewId}`, { method: 'DELETE' })
}

/**
 * 리뷰 이미지 업로드 (인증, multipart)
 * POST /api/files/upload  FormData(files[], refId, refType=REVIEW, usage=IMAGES)
 * FormData 전송이므로 Content-Type 을 직접 지정하지 않는다(브라우저가 boundary 설정).
 */
export async function uploadReviewFiles(reviewId, files) {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  form.append('refId', reviewId)
  form.append('refType', 'REVIEW')
  form.append('usage', 'IMAGES')

  const res = await authFetch('/api/files/upload', { method: 'POST', body: form })
  if (!res.ok) throw await toApiError(res)
  return res.json()
}
