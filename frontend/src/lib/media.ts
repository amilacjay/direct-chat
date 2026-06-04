// Convert a Blob/File to a base64 data URL. Unlike URL.createObjectURL, data
// URLs are self-contained strings, so they can be persisted to localStorage and
// survive a full page reload (object URLs die when the document is torn down).
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
