import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Upload, Loader2, AlertTriangle } from "lucide-react";
import { removeBackground, loadImage, validateImageFile, checkWebGPUSupport, ImageValidationError, WebGPUError } from "@/utils/removeBackground";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { IMAGE_LIMITS } from "@/lib/constants";

const BackgroundRemoval = () => {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [webGPUSupported, setWebGPUSupported] = useState<boolean | null>(null);
  const [webGPUError, setWebGPUError] = useState<string | null>(null);
  const { toast } = useToast();

  // Issue #36: Check WebGPU support on mount
  useEffect(() => {
    const checkSupport = async () => {
      const result = await checkWebGPUSupport();
      setWebGPUSupported(result.supported);
      if (!result.supported) {
        setWebGPUError(result.error || 'WebGPU is not supported');
      }
    };
    checkSupport();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Issue #5: Validate file before processing
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast({
        title: "Invalid File",
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setOriginalImage(e.target?.result as string);
      setProcessedImage(null);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = async () => {
    if (!originalImage) return;

    setIsProcessing(true);
    try {
      const blob = await fetch(originalImage).then((r) => r.blob());
      const img = await loadImage(blob);
      const resultBlob = await removeBackground(img);
      const url = URL.createObjectURL(resultBlob);
      setProcessedImage(url);
      toast({
        title: "Success!",
        description: "Background removed successfully",
      });
    } catch (error) {
      console.error("Background removal error:", error);
      
      // Issue #1 & #36: Provide specific error messages
      let errorMessage = "Failed to remove background. Please try again.";
      
      if (error instanceof ImageValidationError) {
        errorMessage = error.message;
      } else if (error instanceof WebGPUError) {
        errorMessage = error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!processedImage) return;
    const link = document.createElement("a");
    link.href = processedImage;
    link.download = "favicon-transparent.png";
    link.click();
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Background Removal Tool</h1>
          <p className="text-muted-foreground">
            Upload your favicon and remove the background to make it transparent
          </p>
        </div>

        {/* Issue #36: Show WebGPU compatibility warning */}
        {webGPUSupported === false && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Browser Not Supported</AlertTitle>
            <AlertDescription>
              {webGPUError}
            </AlertDescription>
          </Alert>
        )}

        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary transition-colors">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">Click to upload image</p>
                  <p className="text-sm text-muted-foreground">PNG, JPG up to {IMAGE_LIMITS.MAX_SIZE_MB}MB</p>
                </div>
                <input
                  id="file-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {originalImage && (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Original</h3>
                  <div className="bg-muted rounded-lg p-4">
                    <img
                      src={originalImage}
                      alt="Original"
                      className="w-full h-auto mx-auto"
                    />
                  </div>
                </div>

                {processedImage && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Processed</h3>
                    <div className="bg-muted rounded-lg p-4" style={{ backgroundImage: 'repeating-conic-gradient(#e5e7eb 0% 25%, #f3f4f6 0% 50%) 50% / 20px 20px' }}>
                      <img
                        src={processedImage}
                        alt="Processed"
                        className="w-full h-auto mx-auto"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-4 justify-center">
              {originalImage && !processedImage && (
                <Button
                  onClick={handleRemoveBackground}
                  disabled={isProcessing || webGPUSupported === false}
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Remove Background"
                  )}
                </Button>
              )}

              {processedImage && (
                <Button onClick={handleDownload} size="lg">
                  <Download className="w-4 h-4 mr-2" />
                  Download PNG
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default BackgroundRemoval;
