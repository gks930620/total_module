// 커뮤니티 게시글 수정 페이지. 원본 templates/community/edit.html 이식.
//  - 인증은 라우트의 ProtectedRoute 가 보장한다.
//  - 게시글 데이터를 먼저 불러온 뒤에야 Quill 에디터를 마운트해 초기 내용을 주입한다.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  fetchCommunityDetail,
  fetchAttachments,
  updateCommunity,
  uploadFiles,
  deleteFile,
} from '../../api/community.js'
import QuillEditor from './components/QuillEditor.jsx'
import { formatFileSize } from './components/format.js'

function newFileIcon(type) {
  if (type.startsWith('image/')) return 'image'
  if (type.includes('pdf')) return 'picture_as_pdf'
  if (type.includes('word') || type.includes('document')) return 'description'
  if (type.includes('excel') || type.includes('sheet')) return 'table_chart'
  return 'insert_drive_file'
}

function existingFileIcon(name) {
  const lower = name.toLowerCase()
  if (/\.(jpg|jpeg|png|gif|bmp)$/.test(lower)) return 'image'
  if (/\.pdf$/.test(lower)) return 'picture_as_pdf'
  if (/\.(doc|docx)$/.test(lower)) return 'description'
  if (/\.(xls|xlsx)$/.test(lower)) return 'table_chart'
  return 'insert_drive_file'
}

export default function CommunityEditPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const communityId = searchParams.get('id')

  const editorRef = useRef(null)
  const fileInputRef = useRef(null)

  const [loading, setLoading] = useState(true)
  const [initialContent, setInitialContent] = useState(null) // null 이면 아직 로드 전
  const [title, setTitle] = useState('')
  const [existingFiles, setExistingFiles] = useState([])
  const [deletedFileIds, setDeletedFileIds] = useState([])
  const [newFiles, setNewFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const loadData = useCallback(async () => {
    try {
      const data = await fetchCommunityDetail(communityId)
      setTitle(data.title || '')
      setInitialContent(data.content || '')

      try {
        const files = await fetchAttachments(communityId)
        setExistingFiles(
          (files || []).map((f) => ({
            fileId: f.fileId,
            originalFileName: f.originalFileName,
            fileSize: f.fileSize,
            downloadUrl: f.downloadUrl,
          }))
        )
      } catch {
        setExistingFiles([])
      }

      setLoading(false)
    } catch (error) {
      alert('게시글을 불러오는데 실패했습니다.')
      navigate('/community')
    }
  }, [communityId, navigate])

  useEffect(() => {
    if (!communityId) {
      alert('잘못된 접근입니다.')
      navigate('/community')
      return
    }
    loadData()
  }, [communityId, navigate, loadData])

  const toggleDeleteFile = (fileId) => {
    setDeletedFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    )
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    setNewFiles((prev) => [...prev, ...files])
    e.target.value = ''
  }

  const removeNewFile = (index) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const goBack = () => {
    if (window.confirm('수정을 취소하시겠습니까?')) {
      navigate(`/community/detail?id=${communityId}`)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (submitting) return

    const trimmedTitle = title.trim()
    const content = editorRef.current ? editorRef.current.getHTML().trim() : ''
    const textContent = editorRef.current ? editorRef.current.getText().trim() : ''

    if (!trimmedTitle) {
      alert('제목을 입력해주세요.')
      return
    }
    if (!textContent || textContent.length < 5) {
      alert('내용을 5자 이상 입력해주세요.')
      return
    }

    setSubmitting(true)
    try {
      // 1. 게시글 수정
      await updateCommunity(communityId, { title: trimmedTitle, content })

      // 2. 기존 파일 삭제
      for (const fileId of deletedFileIds) {
        try {
          await deleteFile(fileId)
        } catch {
          /* 개별 파일 삭제 실패 무시 */
        }
      }

      // 3. 새 파일 업로드
      if (newFiles.length > 0) {
        try {
          await uploadFiles(newFiles, communityId, 'ATTACHMENT')
        } catch {
          /* 파일 업로드 실패는 경고만 (게시글은 수정됨) */
        }
      }

      alert('게시글이 수정되었습니다.')
      navigate(`/community/detail?id=${communityId}`)
    } catch (error) {
      alert(error.message || '게시글 수정에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || initialContent === null) {
    return (
      <div className="community-edit-page">
        <style>{PAGE_CSS}</style>
        <div id="loadingState">
          <div style={{ fontSize: 14 }}>로딩 중...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="community-edit-page">
      <style>{PAGE_CSS}</style>

      <div className="page-header">
        <h1>
          <span className="material-icons">edit</span>
          게시글 수정
        </h1>
      </div>

      <form className="write-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label required" htmlFor="title">
            제목
          </label>
          <input
            type="text"
            className="form-input"
            id="title"
            placeholder="제목을 입력하세요"
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label required">내용</label>
          <QuillEditor editorRef={editorRef} initialHTML={initialContent} />
          <div className="form-help">최소 5자 이상 작성해주세요.</div>
        </div>

        <div className="form-group">
          <label className="form-label">첨부파일 관리</label>

          <div style={{ marginBottom: 16 }}>
            {existingFiles.map((file) => {
              const isDeleted = deletedFileIds.includes(file.fileId)
              return (
                <div key={file.fileId} className={isDeleted ? 'existing-file file-deleted' : 'existing-file'}>
                  <div className="uploaded-file-info">
                    <span className="material-icons">{existingFileIcon(file.originalFileName)}</span>
                    <span>
                      {file.originalFileName} ({formatFileSize(file.fileSize)}){isDeleted ? ' - 삭제 예정' : ''}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="remove-file-btn"
                    style={isDeleted ? { color: '#4caf50' } : undefined}
                    onClick={() => toggleDeleteFile(file.fileId)}
                  >
                    <span className="material-icons">{isDeleted ? 'undo' : 'delete'}</span>
                  </button>
                </div>
              )
            })}
          </div>

          <div className="file-upload-area" onClick={() => fileInputRef.current?.click()}>
            <span className="material-icons">attach_file</span>
            <p>클릭하여 파일을 추가하세요</p>
            <p style={{ fontSize: 12, marginTop: 8 }}>모든 파일 형식 가능 (이미지, PDF, 문서 등)</p>
          </div>
          <input type="file" ref={fileInputRef} className="file-input" multiple onChange={handleFileSelect} />
          <div className="uploaded-files">
            {newFiles.map((file, index) => (
              <div key={index} className="uploaded-file">
                <div className="uploaded-file-info">
                  <span className="material-icons">{newFileIcon(file.type)}</span>
                  <span>
                    {file.name} ({formatFileSize(file.size)})
                  </span>
                </div>
                <button type="button" className="remove-file-btn" onClick={() => removeNewFile(index)}>
                  <span className="material-icons">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={goBack} className="btn btn-secondary">
            <span className="material-icons">close</span>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <span className="material-icons">check</span>
            수정 완료
          </button>
        </div>
      </form>
    </div>
  )
}

const PAGE_CSS = `
.community-edit-page #loadingState { text-align: center; padding: 60px 20px; color: #757575; }
.community-edit-page .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.community-edit-page .page-header h1 { font-size: 28px; font-weight: 500; color: #212121; display: flex; align-items: center; gap: 8px; }
.community-edit-page .page-header .material-icons { font-size: 32px; color: #6200ea; }
.community-edit-page .write-form { background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.community-edit-page .form-group { margin-bottom: 24px; }
.community-edit-page .form-label { display: block; font-size: 14px; font-weight: 500; color: #424242; margin-bottom: 8px; }
.community-edit-page .form-label.required::after { content: ' *'; color: #d32f2f; }
.community-edit-page .form-input { width: 100%; padding: 12px 16px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; font-family: 'Roboto', sans-serif; outline: none; transition: border-color 0.2s; }
.community-edit-page .form-input:focus { border-color: #6200ea; }
.community-edit-page .form-help { font-size: 12px; color: #757575; margin-top: 6px; }
.community-edit-page .form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 32px; }
.community-edit-page .btn { padding: 12px 24px; border-radius: 4px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
.community-edit-page .btn-primary { background-color: #6200ea; color: white; box-shadow: 0 2px 4px rgba(98,0,234,0.3); }
.community-edit-page .btn-primary:hover { background-color: #5000ca; box-shadow: 0 4px 8px rgba(98,0,234,0.4); }
.community-edit-page .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.community-edit-page .btn-secondary { background-color: #f5f5f5; color: #424242; }
.community-edit-page .btn-secondary:hover { background-color: #e0e0e0; }
.community-edit-page .btn .material-icons { font-size: 18px; }
.community-edit-page .ql-container { height: calc(100% - 42px); overflow-y: auto; }
.community-edit-page .ql-editor { min-height: 100%; }
.community-edit-page .file-upload-area { border: 2px dashed #e0e0e0; border-radius: 8px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s; }
.community-edit-page .file-upload-area:hover { border-color: #6200ea; background-color: #f5f5f5; }
.community-edit-page .file-upload-area .material-icons { font-size: 36px; color: #9e9e9e; margin-bottom: 8px; }
.community-edit-page .file-upload-area p { font-size: 14px; color: #757575; margin: 4px 0; }
.community-edit-page .file-input { display: none; }
.community-edit-page .uploaded-files { margin-top: 16px; }
.community-edit-page .uploaded-file { display: flex; align-items: center; justify-content: space-between; padding: 12px; background-color: #f5f5f5; border-radius: 4px; margin-bottom: 8px; }
.community-edit-page .uploaded-file-info { display: flex; align-items: center; gap: 8px; flex: 1; }
.community-edit-page .uploaded-file-info .material-icons { color: #757575; }
.community-edit-page .remove-file-btn { background: none; border: none; color: #d32f2f; cursor: pointer; padding: 4px; }
.community-edit-page .remove-file-btn .material-icons { font-size: 20px; }
.community-edit-page .existing-file { display: flex; align-items: center; justify-content: space-between; padding: 12px; background-color: #e3f2fd; border-radius: 4px; margin-bottom: 8px; border-left: 3px solid #2196f3; }
.community-edit-page .existing-file .uploaded-file-info { color: #1565c0; }
.community-edit-page .file-deleted { opacity: 0.5; text-decoration: line-through; }
`
