import { useEffect, useState } from 'react'

// 리뷰 이미지 라이트박스 (detail.html 의 lightbox 모달 재현)
// props: images: string[], startIndex: number, onClose: () => void
export default function Lightbox({ images, startIndex = 0, onClose }) {
  const [index, setIndex] = useState(startIndex)
  const multiple = images.length > 1

  useEffect(() => setIndex(startIndex), [startIndex])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && multiple) setIndex((i) => (i - 1 + images.length) % images.length)
      else if (e.key === 'ArrowRight' && multiple) setIndex((i) => (i + 1) % images.length)
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [images.length, multiple, onClose])

  const navigate = (dir, e) => {
    e.stopPropagation()
    setIndex((i) => (i + dir + images.length) % images.length)
  }

  return (
    <div className="lightbox-modal" onClick={onClose}>
      <span className="lightbox-close" onClick={onClose}>&times;</span>
      {multiple && (
        <span className="lightbox-nav lightbox-prev" onClick={(e) => navigate(-1, e)}>&#10094;</span>
      )}
      <div className="lightbox-content">
        <img
          className="lightbox-image"
          src={images[index]}
          alt="리뷰 이미지"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {multiple && (
        <span className="lightbox-nav lightbox-next" onClick={(e) => navigate(1, e)}>&#10095;</span>
      )}
      {multiple && (
        <div className="lightbox-counter">{index + 1} / {images.length}</div>
      )}
    </div>
  )
}
