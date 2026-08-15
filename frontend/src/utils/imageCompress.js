// Downscale + re-encode an uploaded image before storing it as a base64 data URI.
// Uncompressed phone-camera photos (2-3MB each) were bloating API payloads that
// embed images inline (no external storage/CDN) — 10MB+ for a shop's service
// catalog, and hundreds of KB for a single logo or payment QR code.
const DEFAULT_MAX_DIM = 800;
const DEFAULT_QUALITY = 0.72;

// type: 'image/jpeg' for photos (lossy is fine, much smaller). Use 'image/png'
// for QR codes — JPEG artifacts risk breaking scannability, and PNG compresses
// a QR's flat black/white pattern to a few KB anyway, so there's no size cost.
export function compressImage(file, { maxDim = DEFAULT_MAX_DIM, quality = DEFAULT_QUALITY, type = 'image/jpeg' } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL(type, type === 'image/png' ? undefined : quality));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
