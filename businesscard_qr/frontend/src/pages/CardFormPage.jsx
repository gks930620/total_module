// 명함 등록·수정. 같은 폼을 쓴다 — 주소에 cardId 가 있으면 수정.
import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useI18n } from "../lib/I18nProvider.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCards } from "../context/CardsContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { api } from "../lib/api.js";
import { errorText } from "../lib/errorText.js";
import { prepareImage } from "../lib/image.js";
import { isAtCardLimit } from "../lib/limits.js";
import { AppBar, Page } from "../components/AppShell.jsx";
import Field from "../components/Field.jsx";
import Icon from "../components/Icon.jsx";
import { ErrorState, SkeletonRows } from "../components/States.jsx";

/**
 * 입력 길이 한도 — 서버 BusinessCardUpsertRequest 의 @Size(=DB 컬럼 길이)와 같은 값.
 * 여기서 먼저 막아야 사용자가 다 쓰고 나서 서버 400 을 받지 않는다.
 */
const MAX = {
  fullName: 120,
  phone: 50,
  email: 120,
  website: 200,
  organization: 120,
  title: 120,
  address: 300,
  note: 500,
};

const EMPTY_FIELDS = {
  fullName: "",
  phone: "",
  email: "",
  website: "",
  organization: "",
  title: "",
  address: "",
  note: "",
};

/** 서버 응답(snake_case) → 폼 필드 */
function toFields(card) {
  return {
    fullName: card.full_name ?? "",
    phone: card.phone ?? "",
    email: card.email ?? "",
    website: card.website ?? "",
    organization: card.organization ?? "",
    title: card.title ?? "",
    address: card.address ?? "",
    note: card.note ?? "",
  };
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(fields, t) {
  const errors = {};
  if (!fields.fullName.trim()) errors.fullName = t("validationFullNameRequired");
  if (fields.email.trim() && !EMAIL_SHAPE.test(fields.email.trim())) errors.email = t("validationEmail");
  for (const [key, max] of Object.entries(MAX)) {
    if (fields[key].length > max) errors[key] = t("validationTooLong", { max });
  }
  return errors;
}

export default function CardFormPage() {
  const { cardId } = useParams();
  const isEdit = Boolean(cardId);
  const { t, lang } = useI18n();
  const { entitlement } = useAuth();
  const { find, added, updated } = useCards();
  const toast = useToast();
  const navigate = useNavigate();

  const cached = isEdit ? find(cardId) : null;
  const [original, setOriginal] = useState(cached);
  const [loadError, setLoadError] = useState(null);
  const [attempt, setAttempt] = useState(0); // "다시 시도" 가 실제로 다시 요청하게 하는 값
  const [fields, setFields] = useState(() => (cached ? toFields(cached) : EMPTY_FIELDS));
  const [errors, setErrors] = useState({});
  const [image, setImage] = useState(null); // { blob, name, previewUrl } — 새로 고른 이미지
  const [saving, setSaving] = useState(false);
  const fileInput = useRef(null);

  // 수정 화면에 링크로 바로 들어왔으면(캐시에 없음) 서버에서 받는다.
  useEffect(() => {
    if (!isEdit || original) return;
    api
      .getCard(cardId)
      .then((card) => {
        setOriginal(card);
        setFields(toFields(card));
      })
      .catch(setLoadError);
  }, [isEdit, cardId, original, attempt]);

  // 미리보기용 blob URL 은 다 쓰면 놓아 준다 — 안 그러면 사진을 고를 때마다 메모리에 쌓인다.
  useEffect(() => () => image && URL.revokeObjectURL(image.previewUrl), [image]);

  // 한도가 찬 상태로 등록 화면에 "들어왔으면" 프로 안내로 보낸다.
  // ⚠️ 들어올 때 한 번만 판정한다. 매 렌더마다 보면, 한도를 채우는 저장 직후 늘어난 장수(added)로
  // 가드가 다시 걸려 새 명함 상세로 가는 이동을 덮어쓴다(QA 2026-11-26 결함 1).
  const [atLimitOnEntry] = useState(() => !isEdit && isAtCardLimit(entitlement));
  if (atLimitOnEntry) {
    return <Navigate to="/pro?limit=1" replace />;
  }

  const set = (key) => (value) => {
    setFields((previous) => ({ ...previous, [key]: value }));
    if (errors[key]) setErrors((previous) => ({ ...previous, [key]: undefined }));
  };

  async function onPickImage(event) {
    const file = event.target.files?.[0];
    event.target.value = ""; // 같은 파일을 다시 골라도 change 가 오게
    if (!file) return;
    try {
      const prepared = await prepareImage(file);
      setImage({ ...prepared, previewUrl: URL.createObjectURL(prepared.blob) });
    } catch (e) {
      toast(errorText(t, lang, e), "err");
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    const found = validate(fields, t);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // 첫 오류 칸으로 데려간다 — 긴 폼에서 어디가 틀렸는지 찾지 않게.
      document.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    setSaving(true);
    try {
      const { id } = isEdit ? await api.updateCard(cardId, fields, image) : await api.createCard(fields, image);
      // 저장 응답엔 id 만 온다. 이미지 URL 등 서버가 만든 값을 보려면 한 번 받아 와야 한다.
      const saved = await api.getCard(id);
      if (isEdit) {
        updated(saved);
        toast(t("cardUpdated"), "ok");
      } else {
        added(saved);
        toast(t("cardSaved"), "ok");
      }
      // replace — 뒤로가기로 방금 저장한 폼에 돌아와 같은 명함을 또 만들지 않게.
      navigate(`/cards/${id}`, { replace: true });
    } catch (e) {
      if (e.errorCode === "CARD_LIMIT_EXCEEDED") {
        navigate("/pro?limit=1", { replace: true });
        return;
      }
      toast(t("saveFailed", { error: errorText(t, lang, e) }), "err");
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit ? t("formTitleEdit") : t("formTitleCreate");
  const back = isEdit ? `/cards/${cardId}` : "/cards";

  if (loadError) {
    return (
      <Page appBar={<AppBar title={title} back={back} />}>
        <ErrorState error={loadError} onRetry={() => { setLoadError(null); setAttempt((n) => n + 1); }} />
      </Page>
    );
  }
  if (isEdit && !original) {
    return (
      <Page appBar={<AppBar title={title} back={back} />}>
        <SkeletonRows count={5} />
      </Page>
    );
  }

  const previewSrc = image?.previewUrl ?? original?.business_card_image_url ?? null;

  return (
    <Page appBar={<AppBar title={title} back={back} />}>
      <form className="k-stack" onSubmit={onSubmit} noValidate>
        <section className="k-card k-stack">
          <h2 className="bq-section-title">{t("sectionCardImage")}</h2>
          {previewSrc ? (
            <img className="bq-card-image" src={previewSrc} alt={t("sectionCardImage")} />
          ) : (
            <button type="button" className="bq-image-drop" onClick={() => fileInput.current?.click()}>
              <Icon name="image" size={28} />
              <span>{t("pickImage")}</span>
              <span className="k-muted">{t("imageHint")}</span>
            </button>
          )}
          {/* accept=image/* — 폰에서는 카메라/갤러리 고르는 창이 뜬다 */}
          <input ref={fileInput} className="k-sr" type="file" accept="image/*" onChange={onPickImage} tabIndex={-1} />
          {previewSrc && (
            <div className="k-flex">
              <button type="button" className="k-btn k-btn--secondary k-btn--sm" onClick={() => fileInput.current?.click()}>
                <Icon name="image" size={18} />
                <span>{t("changeImage")}</span>
              </button>
              {/* 새로 고른 사진만 뺄 수 있다. 이미 저장된 사진은 바꾸기만 된다(서버에 삭제 API 가 없다). */}
              {image && (
                <button type="button" className="k-btn k-btn--ghost k-btn--sm" onClick={() => setImage(null)}>
                  {t("removeImage")}
                </button>
              )}
            </div>
          )}
        </section>

        <section className="k-card">
          <h2 className="bq-section-title">{t("sectionBasicInfo")}</h2>
          <Field label={t("fieldFullName")} value={fields.fullName} onChange={set("fullName")} error={errors.fullName}
            required maxLength={MAX.fullName} autoComplete="name" placeholder={t("hintFullName")} />
        </section>

        <section className="k-card">
          <h2 className="bq-section-title">{t("sectionContactInfo")}</h2>
          <Field label={t("fieldPhone")} value={fields.phone} onChange={set("phone")} error={errors.phone}
            type="tel" inputMode="tel" autoComplete="tel" maxLength={MAX.phone} placeholder="010-1234-5678" />
          <Field label={t("fieldEmail")} value={fields.email} onChange={set("email")} error={errors.email}
            type="email" inputMode="email" autoComplete="email" maxLength={MAX.email} placeholder="name@example.com" />
          <Field label={t("fieldWebsite")} value={fields.website} onChange={set("website")} error={errors.website}
            type="url" inputMode="url" autoComplete="url" maxLength={MAX.website} placeholder="example.com" />
        </section>

        <section className="k-card">
          <h2 className="bq-section-title">{t("sectionOrgInfo")}</h2>
          <Field label={t("fieldOrganization")} value={fields.organization} onChange={set("organization")}
            error={errors.organization} autoComplete="organization" maxLength={MAX.organization} placeholder={t("hintOrganization")} />
          <Field label={t("fieldJobTitle")} value={fields.title} onChange={set("title")} error={errors.title}
            autoComplete="organization-title" maxLength={MAX.title} placeholder={t("hintJobTitle")} />
        </section>

        <section className="k-card">
          <h2 className="bq-section-title">{t("sectionExtraInfo")}</h2>
          <Field label={t("fieldAddress")} value={fields.address} onChange={set("address")} error={errors.address}
            autoComplete="street-address" maxLength={MAX.address} placeholder={t("hintAddress")} />
          <Field label={t("fieldNote")} value={fields.note} onChange={set("note")} error={errors.note}
            multiline maxLength={MAX.note} placeholder={t("hintNote")} />
        </section>

        <button type="submit" className="k-btn k-btn--primary k-btn--lg k-btn--block" disabled={saving}>
          {saving ? t("statusSaving") : t("actionSave")}
        </button>
      </form>
    </Page>
  );
}
