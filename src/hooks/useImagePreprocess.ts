import { useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { validateImageFile, createImagePreview } from '../utils/imageProcessor';

export function useImagePreprocess() {
  const { uploadImage, clearImage, setError } = useAppStore();

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!validateImageFile(file)) {
        setError('Please select a valid image file (JPG, PNG, or WebP)');
        return;
      }

      try {
        const preview = await createImagePreview(file);
        uploadImage(file, preview);
        setError(null);
      } catch (error) {
        setError('Failed to process image');
        console.error('Image processing error:', error);
      }
    },
    [uploadImage, setError]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect]
  );

  return {
    handleFileSelect,
    handleDrop,
    handleDragOver,
    handleInputChange,
    clearImage,
  };
}
