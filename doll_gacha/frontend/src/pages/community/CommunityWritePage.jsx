// 커뮤니티 게시글 작성 페이지. 원본 templates/community/write.html 이식.
//  - 인증은 라우트의 ProtectedRoute 가 보장한다.
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createCommunity, uploadFiles } from '../../api/community.js'
import QuillEditor from './components/QuillEditor.jsx'
import { formatFileSize } from './components/format.js'

function fileIcon(type) {
  if (type.startsWith('image/')) return 'image'
  if (type.includes('pdf')) return 'picture_as_pdf'
  if (type.includes('word') || type.includes('document')) return 'description'
  if (type.includes('excel') || type.includes('sheet')) return 'table_chart'
  return 'insert_drive_file'
}

export default function CommunityWritePage() {
  const navigate = useNavigate()
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)

  const [title, setTitle] = useState('')
  const [attachedFiles, setAttachedFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    setAttachedFiles((prev) => [...prev, ...files])
    e.target.value = '' // 같은 파일 다시 선택 가능하도록
  }

  const removeFile = (index) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
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
      // 1. 게시글 등록
      const communityId = await createCommunity({ title: trimmedTitle, content })

      // 2. 첨부파일 업로드 (실패해도 게시글은 등록됨)
      if (attachedFiles.length > 0) {
        try {
          await uploadFiles(attachedFiles, communityId, 'ATTACHMENT')
        } catch {
          /* 파일 업로드 실패는 경고만 (게시글은 등록됨) */
        }
      }

      alert('게시글이 등록되었습니다.')
      navigate('/community')
    } catch (error) {
      alert(error.message || '게시글 등록에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="community-write-page">
      <style>{PAGE_CSS}</style>

      <div className="page-header">
        <h1>
          <span className="material-icons">edit</span>
          게시글 작성
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
          <QuillEditor editorRef={editorRef} />
          <div className="form-help">
            최소 5자 이상 작성해주세요. (에디터 툴바의 이미지 버튼으로 본문에 이미지 삽입 가능)
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">첨부파일 (선택)</label>
          <div className="file-upload-area" onClick={() => fileInputRef.current?.click()}>
            <span className="material-icons">attach_file</span>
            <p>클릭하여 파일을 첨부하세요</p>
            <p style={{ fontSize: 12, marginTop: 8 }}>모든 파일 형식 가능 (이미지, PDF, 문서 등)</p>
          </div>
          <input type="file" ref={fileInputRef} className="file-input" multiple onChange={handleFileSelect} />
          <div className="uploaded-files">
            {attachedFiles.map((file, index) => (
              <div key={index} className="uploaded-file">
                <div className="uploaded-file-info">
                  <span className="material-icons">{fileIcon(file.type)}</span>
                  <span>
                    {file.name} ({formatFileSize(file.size)})
                  </span>
                </div>
                <button type="button" className="remove-file-btn" onClick={() => removeFile(index)}>
                  <span className="material-icons">close</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="form-actions">
          <Link to="/community" className="btn btn-secondary">
            <span className="material-icons">close</span>
            취소
          </Link>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <span className="material-icons">check</span>
            등록
          </button>
        </div>
      </form>
    </div>
  )
}

const PAGE_CSS = `
.community-write-page .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.community-write-page .page-header h1 { font-size: 28px; font-weight: 500; color: #212121; display: flex; align-items: center; gap: 8px; }
.community-write-page .page-header .material-icons { font-size: 32px; color: #6200ea; }
.community-write-page .write-form { background: white; border-radius: 8px; padding: 32px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.community-write-page .form-group { margin-bottom: 24px; }
.community-write-page .form-label { display: block; font-size: 14px; font-weight: 500; color: #424242; margin-bottom: 8px; }
.community-write-page .form-label.required::after { content: ' *'; color: #d32f2f; }
.community-write-page .form-input { width: 100%; padding: 12px 16px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; font-family: 'Roboto', sans-serif; outline: none; transition: border-color 0.2s; }
.community-write-page .form-input:focus { border-color: #6200ea; }
.community-write-page .form-help { font-size: 12px; color: #757575; margin-top: 6px; }
.community-write-page .file-upload-area { border: 2px dashed #e0e0e0; border-radius: 8px; padding: 32px; text-align: center; cursor: pointer; transition: all 0.2s; }
.community-write-page .file-upload-area:hover { border-color: #6200ea; background-color: #f5f5f5; }
.community-write-page .file-upload-area .material-icons { font-size: 48px; color: #9e9e9e; margin-bottom: 8px; }
.community-write-page .file-upload-area p { font-size: 14px; color: #757575; }
.community-write-page .file-input { display: none; }
.community-write-page .uploaded-files { margin-top: 16px; }
.community-write-page .uploaded-file { display: flex; align-items: center; justify-content: space-between; padding: 12px; background-color: #f5f5f5; border-radius: 4px; margin-bottom: 8px; }
.community-write-page .uploaded-file-info { display: flex; align-items: center; gap: 8px; }
.community-write-page .uploaded-file-info .material-icons { color: #757575; }
.community-write-page .remove-file-btn { background: none; border: none; color: #d32f2f; cursor: pointer; padding: 4px; }
.community-write-page .remove-file-btn .material-icons { font-size: 20px; }
.community-write-page .form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 32px; }
.community-write-page .btn { padding: 12px 24px; border-radius: 4px; border: none; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 8px; text-decoration: none; }
.community-write-page .btn-primary { background-color: #6200ea; color: white; box-shadow: 0 2px 4px rgba(98,0,234,0.3); }
.community-write-page .btn-primary:hover { background-color: #5000ca; box-shadow: 0 4px 8px rgba(98,0,234,0.4); }
.community-write-page .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.community-write-page .btn-secondary { background-color: #f5f5f5; color: #424242; }
.community-write-page .btn-secondary:hover { background-color: #e0e0e0; }
.community-write-page .btn .material-icons { font-size: 18px; }
.community-write-page .ql-container { height: calc(100% - 42px); overflow-y: auto; }
.community-write-page .ql-editor { min-height: 100%; }
`
