import { pipeline, env } from '@huggingface/transformers';
import { IMAGE_LIMITS } from '@/lib/constants';

// Configure transformers.js to always download models
env.allowLocalModels = false;
env.useBrowserCache = false;

// Issue #5: Validation types and errors
export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageValidationError';
  }
}

export class WebGPUError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebGPUError';
  }
}

// Issue #5: Check if WebGPU is available
export const checkWebGPUSupport = async (): Promise<{ supported: boolean; error?: string }> => {
  try {
    // Check if WebGPU API exists (may not be in TypeScript definitions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    
    if (!nav.gpu) {
      return { 
        supported: false, 
        error: 'WebGPU is not supported in this browser. Please use Chrome 113+ or Edge 113+.' 
      };
    }
    
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) {
      return { 
        supported: false, 
        error: 'No WebGPU adapter found. Your device may not support GPU acceleration.' 
      };
    }
    
    return { supported: true };
  } catch (error) {
    return { 
      supported: false, 
      error: 'Failed to initialize WebGPU. GPU acceleration is not available.' 
    };
  }
};

// Issue #5: Validate image file before processing
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image (PNG, JPG, etc.)' };
  }
  
  // Check file size
  if (file.size > IMAGE_LIMITS.MAX_SIZE_BYTES) {
    return { 
      valid: false, 
      error: `Image size must be less than ${IMAGE_LIMITS.MAX_SIZE_MB}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB.` 
    };
  }
  
  return { valid: true };
};

// Issue #5: Validate image dimensions
export const validateImageDimensions = (image: HTMLImageElement): { valid: boolean; error?: string } => {
  const maxDimension = Math.max(image.naturalWidth, image.naturalHeight);
  
  if (maxDimension > 4096) {
    return { 
      valid: false, 
      error: `Image dimensions too large (${image.naturalWidth}x${image.naturalHeight}). Maximum dimension is 4096px.` 
    };
  }
  
  if (image.naturalWidth < 10 || image.naturalHeight < 10) {
    return { 
      valid: false, 
      error: 'Image is too small. Minimum dimension is 10px.' 
    };
  }
  
  return { valid: true };
};

function resizeImageIfNeeded(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, image: HTMLImageElement) {
  let width = image.naturalWidth;
  let height = image.naturalHeight;

  if (width > IMAGE_LIMITS.MAX_DIMENSION || height > IMAGE_LIMITS.MAX_DIMENSION) {
    if (width > height) {
      height = Math.round((height * IMAGE_LIMITS.MAX_DIMENSION) / width);
      width = IMAGE_LIMITS.MAX_DIMENSION;
    } else {
      width = Math.round((width * IMAGE_LIMITS.MAX_DIMENSION) / height);
      height = IMAGE_LIMITS.MAX_DIMENSION;
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);
    return true;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0);
  return false;
}

export const removeBackground = async (imageElement: HTMLImageElement): Promise<Blob> => {
  // Issue #5: Validate image dimensions before processing
  const dimensionValidation = validateImageDimensions(imageElement);
  if (!dimensionValidation.valid) {
    throw new ImageValidationError(dimensionValidation.error!);
  }

  // Issue #5: Check WebGPU support
  const webGPUCheck = await checkWebGPUSupport();
  if (!webGPUCheck.supported) {
    throw new WebGPUError(webGPUCheck.error!);
  }

  try {
    const segmenter = await pipeline('image-segmentation', 'Xenova/segformer-b0-finetuned-ade-512-512', {
      device: 'webgpu',
    });
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error('Could not get canvas context');
    
    resizeImageIfNeeded(canvas, ctx, imageElement);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    
    const result = await segmenter(imageData);
    
    if (!result || !Array.isArray(result) || result.length === 0 || !result[0].mask) {
      throw new Error('Segmentation failed - no mask generated. Try a different image.');
    }
    
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = canvas.width;
    outputCanvas.height = canvas.height;
    const outputCtx = outputCanvas.getContext('2d');
    
    if (!outputCtx) throw new Error('Could not get output canvas context');
    
    outputCtx.drawImage(canvas, 0, 0);
    
    const outputImageData = outputCtx.getImageData(
      0, 0,
      outputCanvas.width,
      outputCanvas.height
    );
    const data = outputImageData.data;
    
    for (let i = 0; i < result[0].mask.data.length; i++) {
      const alpha = Math.round((1 - result[0].mask.data[i]) * 255);
      data[i * 4 + 3] = alpha;
    }
    
    outputCtx.putImageData(outputImageData, 0, 0);
    
    return new Promise((resolve, reject) => {
      outputCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create output image blob'));
          }
        },
        'image/png',
        1.0
      );
    });
  } catch (error) {
    // Re-throw validation errors as-is
    if (error instanceof ImageValidationError || error instanceof WebGPUError) {
      throw error;
    }
    
    // Wrap other errors with context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Background removal failed: ${errorMessage}`);
  }
};

export const loadImage = (file: Blob): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image. The file may be corrupted or in an unsupported format.'));
    };
    
    img.src = url;
  });
};
