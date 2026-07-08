// 댓글 섹션 (목록 + 페이징 + 작성/수정/삭제). 원본 detail.html 댓글 로직 재현.
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext.jsx'
import {
  fetchComments,
  createComment,
  updateComment,
  deleteComment,
} from '../../../api/community.js'
import { formatDate } from './format.js'

const PAGE_SIZE = 10

export default function CommentList({ communityId }) {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  const [comments, setComments] = useState([])
  const [pageData, setPageData] = useState(null)
  const [totalElements, setTotalElements] = useState(0)
  const [page, setPage] = useState(0)
  const [content, setContent] = useState('')

  const load = useCallback(
    async (p = 0) => {
      try {
        const data = await fetchComments(communityId, p, PAGE_SIZE)
        setComments(data.content || [])
        setPageData(data)
        setTotalElements(data.totalElements || 0)
        setPage(p)
      } catch (error) {
        setComments([])
        setPageData(null)
        setTotalElements(0)
      }
    },
    [communityId]
  )

  useEffect(() => {
    load(0)
  }, [load])

  const handleSubmit = async () => {
    const text = content.trim()
    if (!text) {
      alert('댓글 내용을 입력해주세요.')
      return
    }
    if (!isAuthenticated) {
      alert('로그인이 필요합니다.')
      navigate('/login')
      return
    }
    try {
      await createComment({ communityId, content: text })
      setContent('')
      await load(0) // 최신 댓글 확인을 위해 첫 페이지로
    } catch (error) {
      alert(error.message || '댓글 작성에 실패했습니다.')
    }
  }

  const handleEdit = async (comment) => {
    const newContent = window.prompt('댓글 수정', comment.content)
    if (newContent === null) return
    if (!newContent.trim()) {
      alert('댓글 내용을 입력해주세요.')
      return
    }
    try {
      await updateComment(comment.id, newContent.trim())
      await load(page)
    } catch (error) {
      alert(error.message || '댓글 수정에 실패했습니다.')
    }
  }

  const handleDelete = async (commentId) => {
    if (!window.confirm('댓글을 삭제하시겠습니까?')) return
    try {
      await deleteComment(commentId)
      await load(page)
    } catch (error) {
      alert(error.message || '댓글 삭제에 실패했습니다.')
    }
  }

  const totalPages = pageData?.totalPages ?? 0

  const renderPagination = () => {
    if (totalPages <= 1) return null
    const startPage = Math.max(0, page - 2)
    const endPage = Math.min(totalPages - 1, page + 2)
    const nums = []
    for (let i = startPage; i <= endPage; i++) nums.push(i)

    return (
      <div className="pagination" style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
          {page > 0 && (
            <button onClick={() => load(page - 1)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
              이전
            </button>
          )}
          {nums.map((i) =>
            i === page ? (
              <button key={i} className="btn btn-primary" style={{ padding: '8px 16px' }}>
                {i + 1}
              </button>
            ) : (
              <button
                key={i}
                onClick={() => load(i)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px' }}
              >
                {i + 1}
              </button>
            )
          )}
          {page < totalPages - 1 && (
            <button onClick={() => load(page + 1)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
              다음
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="comments-section">
      <div className="comments-header">
        <span className="material-icons">comment</span>
        <span>댓글 {totalElements}</span>
      </div>

      {isAuthenticated && (
        <div className="comment-write">
          <textarea
            className="comment-textarea"
            placeholder="댓글을 입력하세요..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="comment-write-actions">
            <button className="btn btn-primary" onClick={handleSubmit}>
              <span className="material-icons">send</span>
              댓글 작성
            </button>
          </div>
        </div>
      )}

      <div className="comment-list">
        {comments.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#9e9e9e', padding: '40px 0' }}>첫 댓글을 작성해보세요!</p>
        ) : (
          comments.map((comment) => {
            const isMine = user && user.username === comment.username
            return (
              <div key={comment.id} className="comment-item">
                <div className="comment-header">
                  <div className="comment-author">
                    <span className="material-icons">account_circle</span>
                    <span>{comment.nickname || comment.username}</span>
                  </div>
                  <span className="comment-date">{formatDate(comment.createdAt)}</span>
                </div>
                <div className="comment-content">{comment.content}</div>
                {isMine && (
                  <div className="comment-actions">
                    <button className="comment-action-btn" onClick={() => handleEdit(comment)}>
                      <span className="material-icons">edit</span>
                      수정
                    </button>
                    <button className="comment-action-btn" onClick={() => handleDelete(comment.id)}>
                      <span className="material-icons">delete</span>
                      삭제
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {renderPagination()}
    </section>
  )
}
