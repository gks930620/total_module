// 업로드 전에 사진을 다듬는다.
//
// 폰 사진은 3~12MB 라 그대로 올리면 서버 한도(10MB)에 걸리고, 모바일 데이터로는 한참 걸린다.
// 명함 이미지는 화면에 보여줄 크기면 충분해서, 긴 변 1600px JPEG 로 줄인다(대개 수백 KB).
// 덤으로 EXIF 회전을 실제 픽셀에 반영해, 세로 사진이 눕혀 보이는 문제를 없앤다.
import { ApiError } from "./http.js";

/** 서버 multipart 한도(spring.servlet.multipart.max-file-size)와 같은 값 */
export const MAX_UPLOAD_MB = 10;

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.85;
/** 서버(CardImageStorage)가 받는 형식과 같다 */
const SERVER_ACCEPTS = ["image/jpeg", "image/png", "image/gif", "image/bmp", "image/webp"];
const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/gif": "gif", "image/bmp": "bmp", "image/webp": "webp" };

/** @returns {Promise<{ blob: Blob, name: string }>} */
export async function prepareImage(file) {
  if (!file?.type?.startsWith("image/")) {
    throw new ApiError({ errorCode: "UNSUPPORTED_IMAGE" });
  }

  // GIF 는 캔버스를 거치면 움직임이 사라진다 — 크기만 보고 그대로 보낸다.
  if (file.type === "image/gif") {
    return withinLimit({ blob: file, name: "card.gif" });
  }

  try {
    return withinLimit(await reencode(file));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    // 브라우저가 못 여는 형식(예: 데스크톱 크롬의 HEIC). 서버가 받는 형식이면 원본을 그대로 보낸다.
    if (SERVER_ACCEPTS.includes(file.type)) {
      return withinLimit({ blob: file, name: `card.${EXTENSION[file.type]}` });
    }
    throw new ApiError({ errorCode: "UNSUPPORTED_IMAGE" });
  }
}

async function reencode(file) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    // 투명 PNG 를 JPEG 로 바꾸면 투명한 부분이 검게 된다 — 흰 바탕을 먼저 깐다.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve, reject) =>
      canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("encode failed"))), "image/jpeg", JPEG_QUALITY),
    );
    return { blob, name: "card.jpg" };
  } finally {
    bitmap.close?.();
  }
}

function withinLimit(image) {
  if (image.blob.size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new ApiError({ errorCode: "IMAGE_TOO_LARGE" });
  }
  return image;
}
