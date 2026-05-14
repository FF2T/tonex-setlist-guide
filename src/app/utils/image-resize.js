// src/app/utils/image-resize.js — Phase 7.29.9.
//
// Helper pour redimensionner une image uploadée par l'utilisateur en
// thumbnail compressée (data-URL JPEG), afin de la stocker dans
// localStorage / Firestore sans exploser les quotas.

function resizeImageToDataUrl(file, maxWidth = 240, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('Fichier non supporté (image attendue)'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Lecture du fichier impossible'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image illisible"));
      img.onload = () => {
        const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export { resizeImageToDataUrl };
