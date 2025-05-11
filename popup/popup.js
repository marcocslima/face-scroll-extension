const toggleSwitch = document.getElementById('toggleSwitch');

// Carregar o estado salvo quando o popup abrir
chrome.storage.local.get(['faceScrollActive'], (result) => {
  toggleSwitch.checked = !!result.faceScrollActive;
});

toggleSwitch.addEventListener('change', () => {
  const isActive = toggleSwitch.checked;
  chrome.storage.local.set({ faceScrollActive: isActive });

  // Enviar mensagem para o content script da aba ativa para atualizar o estado
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        command: "toggleFaceScroll",
        active: isActive
      });
    }
  });
});