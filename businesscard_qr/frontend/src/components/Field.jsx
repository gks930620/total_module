import { useId } from "react";

/**
 * 입력 한 칸 — .k-field / .k-label / .k-input / .k-help 조합.
 * 오류는 aria-invalid + aria-describedby 로 입력과 묶는다(스크린리더가 같이 읽는다).
 */
export default function Field({
  label,
  value,
  onChange,
  error,
  hint,
  required = false,
  multiline = false,
  type = "text",
  inputMode,
  autoComplete,
  maxLength,
  placeholder,
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const InputTag = multiline ? "textarea" : "input";

  return (
    <div className="k-field">
      <label className="k-label" htmlFor={id}>
        {label}
        {required && (
          <span className="bq-required" aria-hidden="true">
            {" *"}
          </span>
        )}
      </label>
      <InputTag
        id={id}
        className={multiline ? "k-textarea" : "k-input"}
        type={multiline ? undefined : type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        inputMode={inputMode}
        autoComplete={autoComplete}
        // 서버 컬럼 길이와 같은 값. 넘기면 서버가 400 을 주기 전에 입력에서 막는다.
        maxLength={maxLength}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error || hint ? helpId : undefined}
      />
      {(error || hint) && (
        <p id={helpId} className={`k-help${error ? " k-help--err" : ""}`}>
          {error || hint}
        </p>
      )}
    </div>
  );
}
