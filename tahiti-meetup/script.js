const IDLE_MS = 2000;
const PROCESS_WIDTH = 720;
const EXPOSURE = 0.12;
const MOTION_GAIN = 6.5;
const MOTION_DECAY = 0.94;
const MOTION_SENSITIVITY = 3.2;
const GLITCH_HOLD_MS = 700;
const GLITCH_FADE_MS = 450;
const GLITCH_COOLDOWN_MS = 1100;

const demoParam = new URLSearchParams(window.location.search).get("demo");
const DEMO_VIDEO =
  demoParam === null ? null : demoParam || "demo/person.mp4";

const BAYER_8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
];

const CURSOR_PATTERN = /\bcursors?\b/i;

const video = document.getElementById("camera");
const canvas = document.getElementById("dither");
const hint = document.getElementById("hint");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

let hideTimer = null;
let animationId = null;
let cameraReady = false;
let prevGray = null;
let motionTrail = null;
let monoBuffer = null;
let sourceBuffer = null;
let rowShift = null;
let glitchUntil = 0;
let lastGlitchTrigger = 0;
let recognition = null;
let heardCursor = false;

function showCursor() {
  document.body.classList.add("show-cursor");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    document.body.classList.remove("show-cursor");
  }, IDLE_MS);
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen().catch(() => {});
    return;
  }

  await document.exitFullscreen().catch(() => {});
}

function resizeCanvas() {
  if (!video.videoWidth || !video.videoHeight) {
    return;
  }

  const aspect = video.videoWidth / video.videoHeight;
  const width = PROCESS_WIDTH;
  const height = Math.max(1, Math.round(width / aspect));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    prevGray = null;
    motionTrail = null;
    monoBuffer = null;
    sourceBuffer = null;
    rowShift = null;
  }
}

function ensureBuffers(pixelCount, height) {
  if (!prevGray || prevGray.length !== pixelCount) {
    prevGray = new Float32Array(pixelCount);
    motionTrail = new Float32Array(pixelCount);
    monoBuffer = new Uint8Array(pixelCount);
    sourceBuffer = new Uint8ClampedArray(pixelCount * 4);
    rowShift = new Int16Array(height);
  }
}

function getGlitchAmount(now) {
  if (now < glitchUntil) {
    return 1;
  }

  const fade = now - glitchUntil;
  if (fade >= GLITCH_FADE_MS) {
    return 0;
  }

  return 1 - fade / GLITCH_FADE_MS;
}

function triggerGlitch() {
  const now = performance.now();
  if (now - lastGlitchTrigger < GLITCH_COOLDOWN_MS) {
    return;
  }

  lastGlitchTrigger = now;
  glitchUntil = now + GLITCH_HOLD_MS;
  canvas.classList.remove("is-glitch");
  void canvas.offsetWidth;
  canvas.classList.add("is-glitch");
}

function buildRowShifts(height, chaos) {
  let y = 0;

  while (y < height) {
    const bandHeight = 6 + Math.floor(Math.random() * (10 + chaos * 8));
    const shift =
      chaos < 0.02
        ? 0
        : Math.round((Math.random() - 0.5) * (10 + chaos * 28));

    for (let dy = 0; dy < bandHeight && y + dy < height; dy += 1) {
      rowShift[y + dy] = shift;
    }

    y += bandHeight;
  }
}

function sampleMono(x, y, width, height) {
  const sx = Math.min(width - 1, Math.max(0, x));
  const sy = Math.min(height - 1, Math.max(0, y));
  return monoBuffer[sy * width + sx];
}

function sampleSourceChannel(x, y, width, height, channel) {
  const sx = Math.min(width - 1, Math.max(0, x));
  const sy = Math.min(height - 1, Math.max(0, y));
  return sourceBuffer[(sy * width + sx) * 4 + channel];
}

function ditherFrame() {
  if (!cameraReady || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    animationId = requestAnimationFrame(ditherFrame);
    return;
  }

  resizeCanvas();

  const { width, height } = canvas;
  const pixelCount = width * height;
  const now = performance.now();
  const chaos = getGlitchAmount(now);

  if (chaos === 0) {
    canvas.classList.remove("is-glitch");
  }

  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, width, height);
  ctx.restore();

  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;
  ensureBuffers(pixelCount, height);

  const exposure = EXPOSURE * (1 + chaos * 4);
  const motionGain = MOTION_GAIN * (1 + chaos * 1.2);

  // Pass 1: stash original frame + build mono dither
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const i = pixel * 4;
      sourceBuffer[i] = data[i];
      sourceBuffer[i + 1] = data[i + 1];
      sourceBuffer[i + 2] = data[i + 2];
      sourceBuffer[i + 3] = 255;

      const luminance =
        data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

      const delta = Math.abs(luminance - prevGray[pixel]);
      const motion = Math.min(1, (delta / 255) * MOTION_SENSITIVITY);
      motionTrail[pixel] = Math.max(motion, motionTrail[pixel] * MOTION_DECAY);
      prevGray[pixel] = luminance;

      const boost = 1 + motionTrail[pixel] * motionGain;
      const gray = Math.min(255, luminance * exposure * boost);
      const threshold = ((BAYER_8[y & 7][x & 7] + 0.5) / 64) * 255;
      let lit = gray > threshold;

      if (chaos > 0 && Math.random() < chaos * 0.03) {
        lit = !lit;
      }

      monoBuffer[pixel] = lit ? 255 : 0;
    }
  }

  // Pass 2: while glitching, tear/split the real camera colors
  if (chaos > 0) {
    buildRowShifts(height, chaos);
    const split = Math.round(
      2 + chaos * 8 + Math.sin(now * 0.04) * 2 * chaos,
    );
    const jitterY = Math.round(Math.sin(now * 0.09) * 1 * chaos);
    // How much we "dial back to reality" vs abstract dither
    const reality = 0.9 + chaos * 0.08;

    for (let y = 0; y < height; y += 1) {
      const shift = rowShift[y];

      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        const sx = x + shift;

        const realR = sampleSourceChannel(
          sx - split,
          y + jitterY,
          width,
          height,
          0,
        );
        const realG = sampleSourceChannel(sx, y, width, height, 1);
        const realB = sampleSourceChannel(
          sx + split,
          y - jitterY,
          width,
          height,
          2,
        );

        const ditherR =
          sampleMono(sx - split, y + jitterY, width, height) * 0.12;
        const ditherG = sampleMono(sx, y, width, height) * 0.12;
        const ditherB =
          sampleMono(sx + split, y - jitterY, width, height) * 0.12;

        data[i] = realR * reality + ditherR * (1 - reality);
        data[i + 1] = realG * reality + ditherG * (1 - reality);
        data[i + 2] = realB * reality + ditherB * (1 - reality);
        data[i + 3] = 255;
      }
    }
  } else {
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      const i = pixel * 4;
      const value = monoBuffer[pixel];
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  animationId = requestAnimationFrame(ditherFrame);
}

function handleSpeechResult(event) {
  let transcript = "";

  for (let i = event.resultIndex; i < event.results.length; i += 1) {
    transcript += `${event.results[i][0].transcript} `;
  }

  if (!CURSOR_PATTERN.test(transcript)) {
    if (event.results[event.results.length - 1].isFinal) {
      heardCursor = false;
    }
    return;
  }

  const isFinal = event.results[event.results.length - 1].isFinal;

  if (!heardCursor) {
    heardCursor = true;
    triggerGlitch();
  }

  if (isFinal) {
    heardCursor = false;
  }
}

function startListening() {
  if (!SpeechRecognition || recognition) {
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.addEventListener("result", handleSpeechResult);

  recognition.addEventListener("end", () => {
    if (!cameraReady || !recognition) {
      return;
    }

    try {
      recognition.start();
    } catch {
      // Already started
    }
  });

  recognition.addEventListener("error", (event) => {
    if (event.error === "not-allowed") {
      hint.textContent = "Mic blocked — allow microphone to unlock glitch";
      hint.classList.remove("is-hidden");
      return;
    }
  });

  try {
    recognition.start();
  } catch (error) {
    console.error(error);
  }
}

async function startDemoVideo(src) {
  hint.textContent = "Loading demo video…";
  video.srcObject = null;
  video.src = src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;

  await new Promise((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = () => reject(new Error(`Failed to load demo video: ${src}`));
  });

  await video.play();
  cameraReady = true;
  hint.classList.add("is-hidden");
  animationId = requestAnimationFrame(ditherFrame);
}

async function startCamera() {
  if (cameraReady) {
    return;
  }

  if (DEMO_VIDEO) {
    try {
      await startDemoVideo(DEMO_VIDEO);
    } catch (error) {
      console.error(error);
      hint.textContent = "Demo video failed to load";
      hint.classList.remove("is-hidden");
    }
    return;
  }

  hint.textContent = "Starting camera…";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    video.srcObject = stream;
    await video.play();

    cameraReady = true;
    hint.classList.add("is-hidden");
    animationId = requestAnimationFrame(ditherFrame);
    startListening();
  } catch (error) {
    console.error(error);
    hint.textContent = "Camera blocked — allow access, then click again";
    hint.classList.remove("is-hidden");
  }
}

document.addEventListener("mousemove", showCursor);
document.addEventListener("mousedown", showCursor);
document.addEventListener("keydown", (event) => {
  showCursor();

  if (event.key === "f" || event.key === "F") {
    toggleFullscreen();
  }

  if (event.key === "c" || event.key === "C") {
    triggerGlitch();
  }

  if (event.key === "Enter" || event.key === " ") {
    startCamera();
  }
});

document.addEventListener("dblclick", () => {
  toggleFullscreen();
});

document.addEventListener("click", () => {
  startCamera();
});

startCamera();
