// 예시 파일을 브라우저에서 만든다 — 이미지 도구가 "뭘 넣어야 하는지" 를 보여 주려면
// 손에 파일이 있어야 하는데, 그걸 받아 올 방법이 없다.
//
// CSP 의 connect-src 'none' 이 fetch·XHR 을 원천 차단한다(그게 "입력이 서버로 안 간다" 를
// 브라우저가 보증하게 하는 장치다). public/ 에 파일을 둬도 **바이트를 읽어 올 수가 없다.**
// 그래서 캔버스에 그려서 File 로 만든다 — 파일도 안 늘고 번들도 안 커진다.
//
// ⚠️ 캔버스로 만든 이미지에는 EXIF 가 없다. 촬영 정보·GPS 를 보여 줘야 하는 /image-privacy 는
//    그래서 예시를 두지 않는다(넣으려면 실제 사진을 소스에 base64 로 박아야 한다).

/** 캔버스 → File */
function toFile(canvas, name, type = "image/png") {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(new File([blob], name, { type })) : reject(new Error("이미지를 만들지 못했습니다."))),
      type,
      0.92
    );
  });
}

function canvasOf(width, height) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

/**
 * 사진 대신 쓸 그림 한 장.
 *
 * <p>단색이면 압축·품질 조절의 효과가 안 보이므로 그러데이션과 도형을 섞는다 —
 * JPG 품질을 낮췄을 때 어디가 뭉개지는지 눈에 들어와야 한다.
 */
export function makeSamplePhoto({ width = 1600, height = 1067, name = "sample-photo.jpg" } = {}) {
  const c = canvasOf(width, height);
  const ctx = c.getContext("2d");

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#4c6fd8");
  sky.addColorStop(0.55, "#9db8f0");
  sky.addColorStop(1, "#f2e5c8");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.beginPath();
  ctx.arc(width * 0.78, height * 0.22, height * 0.09, 0, Math.PI * 2);
  ctx.fill();

  // 능선 세 겹 — 겹칠수록 색이 진해져 그러데이션이 생긴다
  const ridge = (baseY, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += width / 24) {
      const y = baseY + Math.sin(x / (width / 6)) * height * 0.06 + Math.sin(x / (width / 17)) * height * 0.03;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();
  };
  ridge(height * 0.62, "#3f5f7a");
  ridge(height * 0.74, "#2c4459");
  ridge(height * 0.86, "#1d2e3d");

  return toFile(c, name, "image/jpeg");
}

/** 정사각형 로고 — 파비콘용. 작게 줄여도 알아볼 수 있게 단순한 도형만 쓴다. */
export function makeSampleLogo({ size = 512, name = "sample-logo.png" } = {}) {
  const c = canvasOf(size, size);
  const ctx = c.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#6d5efc");
  g.addColorStop(1, "#a78bfa");
  ctx.fillStyle = g;
  ctx.beginPath();
  // roundRect 는 비교적 최근에 들어온 API 다. 없으면 그냥 사각형으로 — 예시가 안 나오는 것보다 낫다.
  if (typeof ctx.roundRect === "function") ctx.roundRect(0, 0, size, size, size * 0.22);
  else ctx.rect(0, 0, size, size);
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.font = `700 ${size * 0.5}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("D", size / 2, size * 0.54);

  return toFile(c, name, "image/png");
}

/**
 * 이어붙이기용 캡처 두 장.
 *
 * <p>이어붙였을 때 경계가 보이도록 배경색과 줄 위치를 다르게 그린다 —
 * 똑같이 생긴 두 장을 합치면 붙었는지 아닌지 알 수 없다.
 */
export function makeSampleCaptures({ width = 720, height = 480 } = {}) {
  const draw = (index, tint, rows) => {
    const c = canvasOf(width, height);
    const ctx = c.getContext("2d");
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.fillRect(0, 0, width, 56);
    ctx.fillStyle = "#63608a";
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.fillText(`캡처 ${index}`, 24, 36);

    ctx.fillStyle = "rgba(255,255,255,.72)";
    rows.forEach((w, i) => ctx.fillRect(24, 92 + i * 52, width * w, 30));
    return toFile(c, `capture-${index}.png`, "image/png");
  };
  return Promise.all([
    draw(1, "#eef1fb", [0.9, 0.72, 0.84, 0.58, 0.8, 0.66]),
    draw(2, "#f6eef7", [0.66, 0.88, 0.54, 0.78, 0.7, 0.9]),
  ]);
}
