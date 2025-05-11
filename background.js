// background.js
chrome.runtime.onInstalled.addListener(() => {
  // Definir um estado inicial se necessário
  chrome.storage.local.set({ faceScrollActive: false });
});

// Opcional: Ouvir mensagens se precisar de lógica centralizada
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.command === "getInitialState") {
//     chrome.storage.local.get(['faceScrollActive'], (result) => {
//       sendResponse({ active: !!result.faceScrollActive });
//     });
//     return true; // Indica resposta assíncrona
//   }
// });