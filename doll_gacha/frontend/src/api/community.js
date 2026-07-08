// 커뮤니티 + 댓글 + 첨부파일 API 래퍼
//  - 모든 호출은 공통 http 유틸(callApi / callPublicApi / authFetch)만 사용한다.
//  - 백엔드 응답은 ApiResponse { success, message, data } 형태이므로 data 를 추출해 반환한다.
//  - 엔드포인트/메서드/쿼리파라미터/JSON 형태는 백엔드와 정확히 일치시킨다.

import { callApi, callPublicApi, authFetch, toApiError } from '../lib/http.js'

const REF_TYPE = 'COMMUNITY'

/* ========== 게시글 ========== */

/** 목록/검색 (페이징). GET /api/community?page=&size=&sort=createdAt,desc[&searchType=&keyword=] */
export async function fetchCommunityList({ page = 0, size = 10, searchType = '', keyword = '' } = {}) {
  let url = `/api/community?page=${page}&size=${size}&sort=createdAt,desc`
  if (keyword && keyword.trim() !== '' && searchType) {
    url += `&searchType=${searchType}&keyword=${encodeURIComponent(keyword)}`
  }
  const res = await callPublicApi(url)
  return res.data // PageResponse<CommunityDTO>
}

/** 상세 조회 (조회수 증가). GET /api/community/{id} */
export async function fetchCommunityDetail(id) {
  const res = await callPublicApi(`/api/community/${id}`)
  return res.data // CommunityDTO
}

/** 작성 (auth). POST /api/community -> data: communityId */
export async function createCommunity({ title, content }) {
  const res = await callApi('/api/community', {
    method: 'POST',
    body: JSON.stringify({ title, content }),
  })
  return res.data // Long communityId
}

/** 수정 (auth, 작성자만). PUT /api/community/{id} */
export async function updateCommunity(id, { title, content }) {
  return callApi(`/api/community/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title, content }),
  })
}

/** 삭제 (auth, 작성자만). DELETE /api/community/{id} */
export async function deleteCommunity(id) {
  return callApi(`/api/community/${id}`, { method: 'DELETE' })
}

/* ========== 댓글 ========== */

/** 댓글 목록 (페이징). GET /api/comments/community/{communityId}?page=&size= */
export async function fetchComments(communityId, page = 0, size = 10) {
  const res = await callPublicApi(`/api/comments/community/${communityId}?page=${page}&size=${size}`)
  return res.data // PageResponse<CommentDTO>
}

/** 댓글 작성 (auth). POST /api/comments { communityId, content } */
export async function createComment({ communityId, content }) {
  const res = await callApi('/api/comments', {
    method: 'POST',
    body: JSON.stringify({ communityId, content }),
  })
  return res.data
}

/** 댓글 수정 (auth). PUT /api/comments/{id} { content } */
export async function updateComment(commentId, content) {
  return callApi(`/api/comments/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
  })
}

/** 댓글 삭제 (auth). DELETE /api/comments/{id} */
export async function deleteComment(commentId) {
  return callApi(`/api/comments/${commentId}`, { method: 'DELETE' })
}

/* ========== 첨부파일 ========== */

/** 첨부파일 상세 목록. GET /api/files/detail?refId=&refType=COMMUNITY&usage=ATTACHMENT */
export async function fetchAttachments(refId) {
  const res = await callPublicApi(`/api/files/detail?refId=${refId}&refType=${REF_TYPE}&usage=ATTACHMENT`)
  return res.data || [] // FileDetailDTO[]
}

/**
 * 파일 업로드 (auth, multipart). POST /api/files/upload
 *  - Content-Type 을 수동 지정하지 않는다(FormData 가 boundary 를 설정).
 *  - usage: 'ATTACHMENT' | 'IMAGES'
 */
export async function uploadFiles(files, refId, usage) {
  const formData = new FormData()
  files.forEach((f) => formData.append('files', f))
  formData.append('refId', refId)
  formData.append('refType', REF_TYPE)
  formData.append('usage', usage)

  const res = await authFetch('/api/files/upload', { method: 'POST', body: formData })
  if (!res.ok) throw await toApiError(res)
  const body = await res.json()
  return body.data || body // List<String> (저장 경로/URL)
}

/** 에디터 이미지 업로드 -> 삽입할 이미지 URL 반환 (usage=IMAGES, 임시 refId=0) */
export async function uploadEditorImage(file) {
  const urls = await uploadFiles([file], 0, 'IMAGES')
  return Array.isArray(urls) ? urls[0] : urls
}

/** 파일 삭제 (auth). DELETE /api/files/{fileId} */
export async function deleteFile(fileId) {
  const res = await authFetch(`/api/files/${fileId}`, { method: 'DELETE' })
  return res.ok
}
