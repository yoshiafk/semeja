import React, { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Loader2, Upload, CheckCircle2, X } from "lucide-react";
import browserImageCompression from 'browser-image-compression';
import { toast } from "sonner";

interface ReceiptUploadProps {
  onUploadSuccess: (id: number) => void;
  onScanSuccess?: (data: any, receiptId: number) => void;
  onScanStart?: () => void;
  onClear?: () => void;
  initialId?: number | null;
  label?: string;
  className?: string;
  autoScan?: boolean;
  isScanning?: boolean;
}

export const ReceiptUpload: React.FC<ReceiptUploadProps> = ({ 
  onUploadSuccess, 
  onScanSuccess, 
  onScanStart,
  onClear, 
  initialId,
  label = "Upload Struk",
  className,
  autoScan = false,
  isScanning = false
}) => {
  const [uploading, setUploading] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(initialId || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      
      // Compress image
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true
      };
      
      const compressedFile = await browserImageCompression(file, options);
      
      // Upload to attachment API
      const formData = new FormData();
      formData.append('file', compressedFile);
      
      const token = localStorage.getItem('semeja_auth_token');
      const deviceId = localStorage.getItem('semeja_device_id');
      
      const uploadRes = await fetch('/api/attachments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Device-ID': deviceId || ''
        },
        body: formData
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      
      const uploadData = await uploadRes.json();
      setCurrentId(uploadData.id);
      onUploadSuccess(uploadData.id);
      
      // Trigger OCR Scan
      if (autoScan) {
        if (onScanStart) onScanStart();
        
        const scanRes = await fetch('/api/ocr/receipt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Device-ID': deviceId || ''
          },
          body: JSON.stringify({ attachmentId: uploadData.id })
        });

        if (scanRes.ok) {
          const scanData = await scanRes.json();
          if (onScanSuccess) onScanSuccess(scanData, uploadData.id);
        } else {
          console.error('OCR Scan failed');
          // Don't throw here so we don't break the successful upload
        }
      }
      
      toast.success("Struk berhasil diupload");
    } catch (error) {
      console.error('Upload/Scan error:', error);
      toast.error("Gagal memproses struk");
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    setCurrentId(null);
    if (onClear) onClear();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={className}>
      <div className="space-y-2">
        <input 
          type="file" 
          className="hidden" 
          ref={fileInputRef} 
          accept="image/*,.pdf" 
          onChange={handleFileChange}
        />

        {!currentId ? (
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            className="w-full h-10 border-dashed border-2 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || isScanning}
          >
            {uploading || isScanning ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs">
              {uploading ? (isScanning || autoScan ? "Membaca Struk..." : "Sedang Upload...") : label}
            </span>
          </Button>
        ) : (
          <div className="flex items-center justify-between w-full p-2 bg-primary/5 border border-primary/10 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">File Terupload</span>
                <span className="text-xs font-bold text-foreground">Struk #{currentId}</span>
              </div>
            </div>
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
              onClick={handleClear}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
