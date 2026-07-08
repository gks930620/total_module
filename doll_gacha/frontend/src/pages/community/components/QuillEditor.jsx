// Quill 리치 에디터 래퍼 (원본 write/edit 템플릿의 Quill 설정을 그대로 재현)
//  - editorRef.current 에 { getHTML, getText } 를 심어 부모가 내용을 읽는다.
//  - 툴바 이미지 버튼은 서버 업로드 후 URL 을 본문에 삽입한다.
import { useEffect, useRef } from 'react'
import { loadQuill } from './loadScript.js'
import { uploadEditorImage } from '../../../api/community.js'

export default function QuillEditor({ editorRef, initialHTML = '' }) {
  const containerRef = useRef(null)
  const quillRef = useRef(null)

  useEffect(() => {
    let mounted = true

    loadQuill().then((Quill) => {
      if (!mounted || !containerRef.current || quillRef.current) return

      const quill = new Quill(containerRef.current, {
        theme: 'snow',
        placeholder: '내용을 입력하세요...',
        modules: {
          toolbar: {
            container: [
              [{ header: [1, 2, 3, false] }],
              ['bold', 'italic', 'underline', 'strike'],
              ['blockquote', 'code-block'],
              [{ list: 'ordered' }, { list: 'bullet' }],
              [{ color: [] }, { background: [] }],
              ['link', 'image'],
              ['clean'],
            ],
            handlers: {
              image: () => imageHandler(quill),
            },
          },
        },
      })

      quillRef.current = quill
      if (initialHTML) quill.root.innerHTML = initialHTML

      if (editorRef) {
        editorRef.current = {
          getHTML: () => quill.root.innerHTML,
          getText: () => quill.getText(),
        }
      }
    })

    return () => {
      mounted = false
      if (editorRef) editorRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function imageHandler(quill) {
    const input = document.createElement('input')
    input.setAttribute('type', 'file')
    input.setAttribute('accept', 'image/*')
    input.click()

    input.onchange = async () => {
      const file = input.files[0]
      if (!file) return

      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.')
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        alert(
          '파일 크기가 너무 큽니다!\n\n최대 10MB까지 업로드 가능합니다.\n현재 파일 크기: ' +
            (file.size / 1024 / 1024).toFixed(2) +
            'MB'
        )
        return
      }

      try {
        const imageUrl = await uploadEditorImage(file)
        const range = quill.getSelection(true)
        const index = range ? range.index : quill.getLength()
        quill.insertEmbed(index, 'image', imageUrl)
        quill.setSelection(index + 1)
      } catch (error) {
        alert(error.message || '이미지 업로드에 실패했습니다.')
      }
    }
  }

  return <div ref={containerRef} style={{ height: 400, background: 'white' }} />
}
