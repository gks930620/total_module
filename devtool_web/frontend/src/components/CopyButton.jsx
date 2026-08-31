// 결과물 원클릭 클립보드 복사 (COM-06) — 클릭 시 "복사됨" 토스트 1.5초
import { useState, useCallback, useRef, useEffect } from "react";

export function CopyButton({ value, label = "복사", className = "" }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = useCallback(async () => {
    const text = typeof value === "function" ? value() : value;
    if (text === undefined || text === null || text === "") return;
    try {
      await navigator.clipboard.writeText(String(text));
    } catch {
      // 클립보드 API 미지원/거부 시 폴백
      const ta = document.createElement("textarea");
      ta.value = String(text);
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* 무시 */
      }
      document.body.removeChild(ta);
    }
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1500);
  }, [value]);

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? "copied" : ""} ${className}`}
      onClick={handleCopy}
      aria-live="polite"
    >
      <span className="material-icons">{copied ? "check" : "content_copy"}</span>
      <span>{copied ? "복사됨" : label}</span>
    </button>
  );
}
