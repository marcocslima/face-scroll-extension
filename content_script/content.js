// content_scripts/content.js
let faceScrollGloballyActive = false;
let videoElement, model, rafId, stream;

const SCROLL_SENSITIVITY = 20;
const SCROLL_AMOUNT = 30;
const FRAME_CENTER_Y_RATIO = 0.5;
const DEAD_ZONE_RATIO = 0.1;

// Função para carregar bibliotecas TF.js se estiverem empacotadas
async function loadScript(scriptName) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(`libs/${scriptName}`); // Caminho para libs
    script.onload = resolve;
    script.onerror = (err) => { console.error(`Erro ao carregar ${scriptName}`, err); reject(err); };
    (document.head || document.documentElement).appendChild(script);
  });
}

async function loadTensorFlowAndModel() {
  if (typeof tf === 'undefined') { // Carregar apenas se não estiverem carregadas
    try {
      // Ajuste os nomes dos arquivos conforme o que você empacotou
      await loadScript('tfjs-core.js');
      await loadScript('tfjs-converter.js');
      await loadScript('tfjs-backend-webgl.js');
      await loadScript('tensorflow-models-face-detection.js'); // Exemplo, pode ser @tensorflow-models/face-detection
      console.log("TensorFlow.js e modelo carregados via content script.");
    } catch (error) {
      console.error("Falha ao carregar bibliotecas TensorFlow.js:", error);
      return false;
    }
  }

  if (!model) {
    try {
      await tf.setBackend('webgl');
      model = await faceDetection.createDetector(
        faceDetection.SupportedModels.MediaPipeFaceDetector,
        { runtime: 'tfjs' }
      );
      console.log("Modelo de detecção facial carregado.");
    } catch (err) {
      console.error("Erro ao carregar o modelo de detecção facial: ", err);
      return false;
    }
  }
  return true;
}


async function setupCamera() {
  if (stream) return videoElement; // Já configurada

  videoElement = document.createElement('video');
  videoElement.setAttribute('id', 'chrome-extension-face-scroll-webcam');
  videoElement.style.display = 'none'; // Manter oculto
  // videoElement.style.position = 'fixed'; videoElement.style.top = '0'; videoElement.style.left = '0'; videoElement.style.width = '160px'; videoElement.style.height = '120px'; videoElement.style.zIndex = '9999'; // Para debug
  document.body.appendChild(videoElement);

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user' },
      audio: false
    });
    videoElement.srcObject = stream;
    return new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play(); // Iniciar reprodução
        resolve(videoElement);
      };
    });
  } catch (err) {
    console.error("Erro ao acessar a câmera no content script: ", err);
    alert("Não foi possível acessar a câmera para o Face Scroll. Verifique as permissões do site.");
    if (videoElement) videoElement.remove();
    videoElement = null;
    stream = null;
    throw err;
  }
}

async function detectFaceAndScroll() {
  if (!faceScrollGloballyActive || !model || !videoElement || videoElement.readyState < videoElement.HAVE_METADATA || videoElement.paused) {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    return;
  }

  const faces = await model.estimateFaces(videoElement, { flipHorizontal: false });

  if (faces.length > 0) {
    const face = faces[0];
    const faceCenterY = face.box.yMin + face.box.height / 2;
    const normalizedFaceY = faceCenterY / videoElement.videoHeight;

    const upperThreshold = FRAME_CENTER_Y_RATIO - DEAD_ZONE_RATIO;
    const lowerThreshold = FRAME_CENTER_Y_RATIO + DEAD_ZONE_RATIO;

    if (normalizedFaceY > lowerThreshold) {
      window.scrollBy(0, SCROLL_AMOUNT);
    } else if (normalizedFaceY < upperThreshold) {
      window.scrollBy(0, -SCROLL_AMOUNT);
    }
  }
  rafId = requestAnimationFrame(detectFaceAndScroll);
}

async function startFaceScroll() {
  if (rafId) return; // Já rodando
  console.log("Tentando iniciar Face Scroll...");
  try {
    const modelLoaded = await loadTensorFlowAndModel();
    if (!modelLoaded) {
      faceScrollGloballyActive = false; // Desativa se o modelo não carregar
      chrome.storage.local.set({ faceScrollActive: false }); // Atualiza o storage
      return;
    }
    await setupCamera();
    if (videoElement && stream) {
      detectFaceAndScroll();
      console.log("Face Scroll iniciado.");
    }
  } catch (error) {
    console.error("Falha ao iniciar o Face Scroll:", error);
    faceScrollGloballyActive = false;
    chrome.storage.local.set({ faceScrollActive: false });
  }
}

function stopFaceScroll() {
  console.log("Parando Face Scroll...");
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (videoElement) {
    videoElement.remove();
    videoElement = null;
  }
  // Não descarregamos o modelo aqui, para evitar recarregar sempre.
  // Poderia ser uma otimização se o uso de memória for um problema.
  console.log("Face Scroll parado.");
}

// Ouvir mensagens do popup/background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "toggleFaceScroll") {
    faceScrollGloballyActive = request.active;
    if (faceScrollGloballyActive) {
      startFaceScroll();
    } else {
      stopFaceScroll();
    }
    sendResponse({ status: "ok", active: faceScrollGloballyActive });
  }
  return true; // Para respostas assíncronas
});

// Verificar o estado inicial ao carregar a página
chrome.storage.local.get(['faceScrollActive'], (result) => {
  faceScrollGloballyActive = !!result.faceScrollActive;
  if (faceScrollGloballyActive) {
    // Adicionar um pequeno delay para garantir que a página esteja pronta
    // e para o usuário perceber que a funcionalidade está ativa.
    setTimeout(startFaceScroll, 500);
  }
});