// 확인 대화상자(.k-modal)와 바텀시트(.k-sheet).
import { useEffect, useId, useRef } from "react";
import { useI18n } from "../lib/I18nProvider.jsx";

/** Esc 로 닫고, 열릴 때 안쪽으로 포커스를 옮긴다 — 키보드 사용자가 뒤 화면에 갇히지 않게. */
function useDialogBehavior(onClose, busy) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector("button, a, [tabindex]")?.focus();
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose, busy]);
  return ref;
}

export function ConfirmDialog({ title, message, confirmLabel, danger = false, busy = false, onConfirm, onCancel }) {
  const { t } = useI18n();
  const titleId = useId();
  const ref = useDialogBehavior(onCancel, busy);

  return (
    <div className="k-backdrop" onClick={busy ? undefined : onCancel}>
      <div
        ref={ref}
        className="k-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="k-modal__head">
          <h3 id={titleId}>{title}</h3>
        </div>
        <div className="k-modal__body">
          <p className="bq-preline">{message}</p>
        </div>
        <div className="k-modal__foot">
          {/* 되돌릴 수 없는 동작이라 취소에 먼저 포커스가 간다 */}
          <button type="button" className="k-btn k-btn--ghost" onClick={onCancel} disabled={busy}>
            {t("actionCancel")}
          </button>
          <button
            type="button"
            className={`k-btn ${danger ? "k-btn--danger" : "k-btn--primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t("statusSaving") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 계정 메뉴 등. items: [{ icon, label, onSelect, danger }] — 또는 children 으로 자유 구성. */
export function ActionSheet({ title, onClose, children }) {
  const titleId = useId();
  const ref = useDialogBehavior(onClose, false);

  return (
    <div className="bq-sheet-layer" onClick={onClose}>
      <div
        ref={ref}
        className="k-sheet bq-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="k-sheet__grip" />
        <h2 id={titleId} className="k-sr">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
