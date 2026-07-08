// 커뮤니티 상세 페이지 (본문 + 첨부파일 + 댓글). 원본 templates/community/detail.html 이식.
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  fetchCommunityDetail,
  fetchAttachments,
  deleteCommunity,
  deleteFile,
} from '../../api/community.js'
import { loadDOMPurify } from './components/loadScript.js'
import { formatDate, formatFileSize } from './components/format.js'
import CommentList from './components/CommentList.jsx'

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'u', 's', 'span', 'div',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a',
    'img',
  ],
  ALLOWED_ATTR: ['style', 'class', 'href', 'target', 'rel', 'src', 'alt', 'width', 'height'],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
}

export default function CommunityDetailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const communityId = searchParams.get('id')

  const [post, setPost] = useState(null)
  const [safeContent, setSafeContent] = useState('')
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCommunityDetail(communityId)
      setPost(data)
      // DOMPurify 로 XSS 방어 후 렌더링
      try {
        const DOMPurify = await loadDOMPurify()
        setSafeContent(DOMPurify.sanitize(data.content || '', SANITIZE_CONFIG))
      } catch {
        setSafeContent('') // 살균기 로드 실패 시 본문 비표시 (안전 우선)
      }
    } catch (error) {
      alert('게시글을 불러오는데 실패했습니다.')
      navigate('/community')
      return
    } finally {
      setLoading(false)
    }
  }, [communityId, navigate])

  const loadFiles = useCallback(async () => {
    try {
      const files = await fetchAttachments(communityId)
      setAttachments(files || [])
    } catch {
      // 첨부파일은 선택사항이므로 조용히 무시
    }
  }, [communityId])

  useEffect(() => {
    if (!communityId) {
      alert('잘못된 접근입니다.')
      navigate('/community')
      return
    }
    loadDetail()
    loadFiles()
  }, [communityId, navigate, loadDetail, loadFiles])

  const handleDelete = async () => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return
    try {
      // 1. 첨부파일 먼저 삭제
      try {
        const files = await fetchAttachments(communityId)
        for (const file of files) {
          try {
            await deleteFile(file.fileId)
          } catch {
            /* 개별 파일 삭제 실패는 무시 */
          }
        }
      } catch {
        /* 파일 조회 실패 무시 */
      }
      // 2. 게시글 삭제
      await deleteCommunity(communityId)
      alert('게시글이 삭제되었습니다.')
      navigate('/community')
    } catch (error) {
      alert(error.message || '게시글 삭제에 실패했습니다.')
    }
  }

  const isAuthor = post && user && user.username === post.username

  return (
    <div className="community-detail-page">
      <style>{PAGE_CSS}</style>

      {loading || !post ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#757575' }}>
          <div style={{ fontSize: 14 }}>로딩 중...</div>
        </div>
      ) : (
        <>
          <article className="post-detail">
            <div className="post-detail-header">
              <h1 className="post-detail-title">{post.title}</h1>
              <div className="post-detail-meta">
                <span className="post-meta-item">
                  <span className="material-icons">person</span>
                  <span>{post.nickname || post.username}</span>
                </span>
                <span className="post-meta-item">
                  <span className="material-icons">schedule</span>
                  <span>{formatDate(post.createdAt)}</span>
                </span>
              </div>
            </div>

            <div className="post-detail-stats">
              <span className="post-stat">
                <span className="material-icons">visibility</span>
                <span>{post.viewCount || 0}</span>
              </span>
            </div>

            <div className="post-detail-content" dangerouslySetInnerHTML={{ __html: safeContent }} />

            {attachments.length > 0 && (
              <div style={{ padding: '0 24px 24px 24px' }}>
                <div style={{ border: '1px solid #e0e0e0', borderRadius: 4, padding: 16, background: '#f5f5f5' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#424242' }}>첨부파일</h4>
                  {attachments.map((file) => (
                    <div key={file.fileId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span className="material-icons" style={{ fontSize: 20, color: '#757575' }}>
                        attach_file
                      </span>
                      <a href={file.downloadUrl} style={{ color: '#6200ea', textDecoration: 'none' }}>
                        {file.originalFileName}
                      </a>
                      <span style={{ color: '#9e9e9e', fontSize: 12 }}>({formatFileSize(file.fileSize)})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="post-nav-actions">
              <Link to="/community" className="btn btn-secondary">
                <span className="material-icons">list</span>
                목록
              </Link>
              {isAuthor && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => navigate(`/community/edit?id=${communityId}`)}>
                    <span className="material-icons">edit</span>
                    수정
                  </button>
                  <button className="btn btn-danger" onClick={handleDelete}>
                    <span className="material-icons">delete</span>
                    삭제
                  </button>
                </div>
              )}
            </div>
          </article>

          <CommentList communityId={communityId} />
        </>
      )}
    </div>
  )
}

const PAGE_CSS = `
.community-detail-page .post-detail { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
.community-detail-page .post-detail-header { padding: 24px; border-bottom: 1px solid #e0e0e0; }
.community-detail-page .post-detail-title { font-size: 24px; font-weight: 500; color: #212121; margin-bottom: 16px; }
.community-detail-page .post-detail-meta { display: flex; gap: 24px; font-size: 14px; color: #757575; flex-wrap: wrap; }
.community-detail-page .post-meta-item { display: flex; align-items: center; gap: 6px; }
.community-detail-page .post-meta-item .material-icons { font-size: 18px; }
.community-detail-page .post-detail-stats { display: flex; gap: 16px; padding: 16px 24px; background-color: #f5f5f5; border-bottom: 1px solid #e0e0e0; }
.community-detail-page .post-stat { display: flex; align-items: center; gap: 6px; font-size: 14px; color: #757575; }
.community-detail-page .post-stat .material-icons { font-size: 18px; }
.community-detail-page .post-detail-content { padding: 32px 24px; line-height: 1.8; color: #424242; font-size: 15px; }
.community-detail-page .post-detail-content img { max-width: 100%; border-radius: 8px; margin: 16px 0; }
.community-detail-page .btn { padding: 10px 16px; border-radius: 4px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; white-space: nowrap; }
.community-detail-page .btn .material-icons { font-size: 18px; }
.community-detail-page .post-nav-actions { display: flex; justify-content: space-between; padding: 24px; background-color: #fafafa; }
.community-detail-page .btn-secondary { background-color: #f5f5f5; color: #424242; }
.community-detail-page .btn-secondary:hover { background-color: #e0e0e0; }
.community-detail-page .btn-primary { background-color: #6200ea; color: white; }
.community-detail-page .btn-primary:hover { background-color: #5000ca; }
.community-detail-page .btn-primary .material-icons { color: white; }
.community-detail-page .btn-danger { background-color: #d32f2f; color: white; }
.community-detail-page .btn-danger:hover { background-color: #b71c1c; }
.community-detail-page .comments-section { background: white; border-radius: 8px; margin-top: 24px; padding: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.community-detail-page .comments-header { font-size: 18px; font-weight: 500; margin-bottom: 20px; display: flex; align-items: center; gap: 8px; color: #212121; }
.community-detail-page .comments-header .material-icons { color: #6200ea; }
.community-detail-page .comment-write { margin-bottom: 24px; }
.community-detail-page .comment-textarea { width: 100%; padding: 12px 16px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; font-family: 'Roboto', sans-serif; resize: vertical; min-height: 80px; outline: none; }
.community-detail-page .comment-textarea:focus { border-color: #6200ea; }
.community-detail-page .comment-write-actions { display: flex; justify-content: flex-end; margin-top: 8px; }
.community-detail-page .comment-list { border-top: 1px solid #e0e0e0; padding-top: 20px; }
.community-detail-page .comment-item { padding: 16px 0; border-bottom: 1px solid #f5f5f5; }
.community-detail-page .comment-item:last-child { border-bottom: none; }
.community-detail-page .comment-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.community-detail-page .comment-author { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; color: #424242; }
.community-detail-page .comment-author .material-icons { font-size: 20px; color: #757575; }
.community-detail-page .comment-date { font-size: 12px; color: #9e9e9e; }
.community-detail-page .comment-content { font-size: 14px; color: #616161; line-height: 1.6; margin-bottom: 8px; white-space: pre-wrap; }
.community-detail-page .comment-actions { display: flex; gap: 12px; }
.community-detail-page .comment-action-btn { background: none; border: none; padding: 4px 8px; font-size: 12px; color: #757575; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.community-detail-page .comment-action-btn:hover { color: #6200ea; }
.community-detail-page .comment-action-btn .material-icons { font-size: 16px; }
.community-detail-page .btn-primary { background-color: #6200ea; color: white; }
`
