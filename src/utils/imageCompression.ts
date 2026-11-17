export interface CompressedImageResult {
  dataUrl: string;
  sizeBytes: number;
  width: number;
  height: number;
}

const DEFAULT_MAX_BYTES = 1024 * 1024; // 1 Mo max

function estimateDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return 0;
  const base64 = dataUrl.slice(commaIdx + 1);
  return Math.floor((base64.length * 3) / 4);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Impossible de lire le fichier image fourni.'));
    };
    img.src = objectUrl;
  });
}

export async function compressImageFile(
  file: File,
  maxBytes: number = DEFAULT_MAX_BYTES
): Promise<CompressedImageResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Veuillez sélectionner un fichier image valide (JPG, PNG, WebP).');
  }

  const img = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Votre navigateur ne supporte pas le traitement d’image.');
  }

  let maxDim = 1400;
  let quality = 0.84;
  let dataUrl = '';
  let sizeBytes = 0;
  let targetW = img.naturalWidth || 800;
  let targetH = img.naturalHeight || 600;

  for (let attempt = 0; attempt < 7; attempt++) {
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    targetW = Math.max(1, Math.round((img.naturalWidth || 800) * scale));
    targetH = Math.max(1, Math.round((img.naturalHeight || 600) * scale));

    canvas.width = targetW;
    canvas.height = targetH;
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    dataUrl = canvas.toDataURL('image/jpeg', quality);
    sizeBytes = estimateDataUrlBytes(dataUrl);

    if (sizeBytes <= maxBytes) {
      return {
        dataUrl,
        sizeBytes,
        width: targetW,
        height: targetH,
      };
    }

    if (quality > 0.5) {
      quality = Number((quality - 0.12).toFixed(2));
    } else {
      maxDim = Math.round(maxDim * 0.72);
      quality = 0.72;
    }
  }

  if (sizeBytes > maxBytes) {
    throw new Error('L’image dépasse encore 1 Mo après compression. Choisissez un fichier plus léger.');
  }

  return {
    dataUrl,
    sizeBytes,
    width: targetW,
    height: targetH,
  };
}
