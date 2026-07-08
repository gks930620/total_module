// 리뷰 + 리뷰 첨부 이미지 REST 계약 래퍼 (review/write.html, review/edit.html 계약 그대로)
//  - 공개 읽기는 callPublicApi, 인증 쓰기는 callApi, 파일 업로드는 authFetch+FormData 사용.
//  - 백엔드 응답은 대부분 ApiResponse { success, message, data } → data 를 추출해 반환한다.
//  - 리뷰 단건 GET 엔드포인트가 없으므로, 수정 화면은 매장 리뷰 목록에서 해당 리뷰를 찾는다.
//  - 삭제를 지원하려면 fileId 가 필요하므로 이미지 목록은 GET /api/files/detail (fileId 포함) 을 사용한다.
import { callApi, callPublicApi, authFetch, toApiError } from '../lib/http.js'

const REF_TYPE = 'REVIEW'
const USAGE_IMAGES = 'IMAGES'

/* ===== 매장 (리뷰 폼 상단 가게 정보 박스용) ===== */

/** 매장 상세 (공개). GET /api/doll-shops/{id} -> DollShopDTO */
export async function fetchShop(shopId) {
  const body = await callPublicApi(`/api/doll-shops/${shopId}`)
  return body.data
}

/* ===== 리뷰 ===== */

/** 매장 리뷰 목록 (공개, 페이징). GET /api/reviews/doll-shop/{shopId}?page=&size= -> PageResponse<ReviewDTO> */
export async function fetchShopReviews(shopId, { page = 0, size = 100 } = {}) {
  const params = new URLSearchParams({ page, size })
  const body = await callPublicApi(`/api/reviews/doll-shop/${shopId}?${params.toString()}`)
  return body.data
}

/**
 * 단일 리뷰 조회.
 * 백엔드에 GET /api/reviews/{id} 가 없으므로 매장 리뷰 목록을 순회해 해당 리뷰를 찾는다.
 */
export async function findReview(shopId, reviewId) {
  const id = Number(reviewId)
  let page = 0
  // 대부분 한 페이지(size 100)에서 발견되지만, 안전하게 마지막 페이지까지 순회한다.
  for (;;) {
    const data = await fetchShopReviews(shopId, { page, size: 100 })
    const found = (data.content || []).find((r) => r.id === id)
    if (found) return found
    if (data.last || page + 1 >= data.totalPages) return null
    page += 1
  }
}

/** 리뷰 작성 (인증). POST /api/reviews  body: ReviewCreateDTO -> ReviewDTO */
export async function createReview(payload) {
  const body = await callApi('/api/reviews', { method: 'POST', body: JSON.stringify(payload) })
  return body.data
}

/** 리뷰 수정 (인증). PUT /api/reviews/{reviewId}  body: ReviewUpdateDTO -> ReviewDTO */
export async function updateReview(reviewId, payload) {
  const body = await callApi(`/api/reviews/${reviewId}`, { method: 'PUT', body: JSON.stringify(payload) })
  return body.data
}

/** 리뷰 삭제 (인증). DELETE /api/reviews/{reviewId} */
export async function deleteReview(reviewId) {
  return callApi(`/api/reviews/${reviewId}`, { method: 'DELETE' })
}

/* ===== 리뷰 첨부 이미지 ===== */

/**
 * 리뷰 이미지 상세 목록 (공개). fileId 를 포함하므로 삭제까지 지원 가능.
 * GET /api/files/detail?refId=&refType=REVIEW&usage=IMAGES -> FileDetailDTO[]
 */
export async function fetchReviewImages(reviewId) {
  const params = new URLSearchParams({ refId: reviewId, refType: REF_TYPE, usage: USAGE_IMAGES })
  const body = await callPublicApi(`/api/files/detail?${params.toString()}`)
  return body.data || []
}

/**
 * 리뷰 이미지 업로드 (인증, multipart). POST /api/files/upload
 *  - Content-Type 을 수동 지정하지 않는다(FormData 가 boundary 를 설정).
 *  - FormData(files[], refId, refType=REVIEW, usage=IMAGES)
 */
export async function uploadReviewImages(reviewId, files) {
  if (!files || files.length === 0) return []
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  form.append('refId', reviewId)
  form.append('refType', REF_TYPE)
  form.append('usage', USAGE_IMAGES)

  const res = await authFetch('/api/files/upload', { method: 'POST', body: form })
  if (!res.ok) throw await toApiError(res)
  const body = await res.json()
  return body.data || body // List<String> (저장 경로/URL)
}

/** 파일 삭제 (인증). DELETE /api/files/{fileId} */
export async function deleteFile(fileId) {
  return callApi(`/api/files/${fileId}`, { method: 'DELETE' })
}
