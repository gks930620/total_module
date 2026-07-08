// 커뮤니티 목록 페이지 (원본 templates/community/list.html 을 React 로 이식)
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { fetchCommunityList } from '../../api/community.js'
import { formatRelativeTime } from './components/format.js'

const PAGE_SIZE = 10

export default function CommunityListPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [pageData, setPageData] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(false)

  // 검색 입력 상태
  const [searchType, setSearchType] = useState('title')
  const [searchInput, setSearchInput] = useState('')
  // 실제 적용된(조회 중인) 검색 조건
  const [appliedType, setAppliedType] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')

  const load = useCallback(async (page, type = '', keyword = '') => {
    setLoading(true)
    try {
      const data = await fetchCommunityList({ page, size: PAGE_SIZE, searchType: type, keyword })
      setPageData(data)
      setPosts(data.content || [])
      setAppliedType(type)
      setAppliedKeyword(keyword)
    } catch (error) {
      // 조회 실패 시 빈 상태로 표시 (원본 동작과 동일)
      setPageData(null)
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(0)
  }, [load])

  const handleSearch = () => {
    const keyword = searchInput.trim()
    if (!keyword) {
      load(0)
      return
    }
    load(0, searchType, keyword)
  }

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') handleSearch()
  }

  const goToDetail = (id) => navigate(`/community/detail?id=${id}`)

  const totalPages = pageData?.totalPages ?? 0
  const currentPage = pageData?.page ?? 0

  const renderPagination = () => {
    if (totalPages <= 1) return null
    const startPage = Math.max(0, currentPage - 2)
    const endPage = Math.min(totalPages - 1, startPage + 4)
    const nums = []
    for (let i = startPage; i <= endPage; i++) nums.push(i)

    return (
      <div className="pagination">
        <button
          className="pagination-btn"
          onClick={() => load(currentPage - 1, appliedType, appliedKeyword)}
          disabled={currentPage === 0}
        >
          <span className="material-icons">chevron_left</span>
        </button>
        {nums.map((i) => (
          <button
            key={i}
            className={`pagination-btn ${i === currentPage ? 'active' : ''}`}
            onClick={() => load(i, appliedType, appliedKeyword)}
          >
            {i + 1}
          </button>
        ))}
        <button
          className="pagination-btn"
          onClick={() => load(currentPage + 1, appliedType, appliedKeyword)}
          disabled={currentPage === totalPages - 1}
        >
          <span className="material-icons">chevron_right</span>
        </button>
      </div>
    )
  }

  return (
    <div className="community-list-page">
      <style>{PAGE_CSS}</style>

      <div className="page-header">
        <h1>
          <span className="material-icons">forum</span>
          커뮤니티
        </h1>
        {isAuthenticated && (
          <Link to="/community/write" className="btn btn-primary">
            <span className="material-icons">edit</span>
            글쓰기
          </Link>
        )}
      </div>

      <div className="search-filter-section">
        <select className="filter-select" value={searchType} onChange={(e) => setSearchType(e.target.value)}>
          <option value="title">제목</option>
          <option value="nickname">작성자</option>
        </select>
        <div className="search-input-wrapper">
          <span className="material-icons">search</span>
          <input
            type="text"
            placeholder="검색어를 입력하세요..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleSearchKeyPress}
          />
        </div>
        <button className="btn btn-primary" onClick={handleSearch}>
          <span className="material-icons">search</span>
          검색
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#757575' }}>
          <div style={{ fontSize: 14 }}>로딩 중...</div>
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-state">
          <span className="material-icons">article</span>
          <h3>게시글이 없습니다</h3>
          <p>첫 번째 게시글을 작성해보세요!</p>
        </div>
      ) : (
        <>
          <div className="post-list">
            {posts.map((post) => (
              <div key={post.id} className="post-item" onClick={() => goToDetail(post.id)}>
                <div className="post-header">
                  <div>
                    <div className="post-title">{post.title}</div>
                    <div className="post-meta">
                      <span className="post-meta-item">
                        <span className="material-icons">person</span>
                        <span>{post.nickname || post.username}</span>
                      </span>
                      <span className="post-meta-item">
                        <span className="material-icons">schedule</span>
                        <span>{formatRelativeTime(post.createdAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>
                <div className="post-stats">
                  <span className="post-stat">
                    <span className="material-icons">visibility</span>
                    <span>{post.viewCount || 0}</span>
                  </span>
                  <span className="post-stat">
                    <span className="material-icons">comment</span>
                    <span>{post.commentCount || 0}</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
          {renderPagination()}
        </>
      )}
    </div>
  )
}

const PAGE_CSS = `
.community-list-page .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.community-list-page .page-header h1 { font-size: 28px; font-weight: 500; color: #212121; display: flex; align-items: center; gap: 8px; }
.community-list-page .page-header .material-icons { font-size: 32px; color: #6200ea; }
.community-list-page .btn { padding: 10px 16px; border-radius: 4px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; white-space: nowrap; }
.community-list-page .btn-primary { background-color: #6200ea; color: white; box-shadow: 0 2px 4px rgba(98,0,234,0.3); }
.community-list-page .btn-primary:hover { background-color: #5000ca; box-shadow: 0 4px 8px rgba(98,0,234,0.4); }
.community-list-page .btn .material-icons { font-size: 18px; }
.community-list-page .btn-primary .material-icons { color: white; }
.community-list-page .search-filter-section { background: white; padding: 16px; border-radius: 8px; margin-bottom: 24px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
.community-list-page .search-input-wrapper { flex: 1; min-width: 250px; position: relative; }
.community-list-page .search-input-wrapper input { width: 100%; padding: 12px 16px 12px 40px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; outline: none; }
.community-list-page .search-input-wrapper input:focus { border-color: #6200ea; }
.community-list-page .search-input-wrapper .material-icons { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #757575; font-size: 20px; }
.community-list-page .filter-select { padding: 12px 16px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; outline: none; cursor: pointer; }
.community-list-page .filter-select:focus { border-color: #6200ea; }
.community-list-page .post-list { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
.community-list-page .post-item { padding: 20px; border-bottom: 1px solid #e0e0e0; cursor: pointer; transition: background-color 0.2s; }
.community-list-page .post-item:hover { background-color: #f5f5f5; }
.community-list-page .post-item:last-child { border-bottom: none; }
.community-list-page .post-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.community-list-page .post-title { font-size: 16px; font-weight: 500; color: #212121; margin-bottom: 8px; }
.community-list-page .post-meta { display: flex; gap: 16px; font-size: 13px; color: #757575; }
.community-list-page .post-meta-item { display: flex; align-items: center; gap: 4px; }
.community-list-page .post-meta-item .material-icons { font-size: 16px; }
.community-list-page .post-stats { display: flex; gap: 16px; font-size: 13px; color: #757575; }
.community-list-page .post-stat { display: flex; align-items: center; gap: 4px; }
.community-list-page .post-stat .material-icons { font-size: 16px; }
.community-list-page .pagination { display: flex; justify-content: center; gap: 8px; margin-top: 24px; }
.community-list-page .pagination-btn { width: 36px; height: 36px; border: 1px solid #e0e0e0; background: white; border-radius: 4px; cursor: pointer; font-size: 14px; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; }
.community-list-page .pagination-btn:hover { background-color: #f5f5f5; }
.community-list-page .pagination-btn.active { background-color: #6200ea; color: white; border-color: #6200ea; }
.community-list-page .pagination-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.community-list-page .empty-state { text-align: center; padding: 60px 20px; color: #757575; }
.community-list-page .empty-state .material-icons { font-size: 80px; opacity: 0.5; margin-bottom: 16px; }
.community-list-page .empty-state h3 { font-size: 18px; font-weight: 400; margin-bottom: 8px; }
`
