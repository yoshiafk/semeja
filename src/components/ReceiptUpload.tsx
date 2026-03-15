import React, { useState, useRef } from 'react';
import imageCompression from 'browser-image-compression';
import { Button } from "@/components/ui/button";
import { Loader2, Upload, X, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ReceiptUploadProps {
  onUploadSuccess: (id: number) => void;
  onScanSuccess?: (data: any, receiptId: number) => void;
  onClear: () => void;
  initialId?: number | null;
  label?: string;
  className?: string;
  autoScan?: boolean;
}

export const ReceiptUpload: React.FC<ReceiptUploadProps> = ({ 
  onUploadSuccess, 
  onScanSuccess,
  onClear, 
  initialId,
  label = "Upload Struk",
  className,
  autoScan = false
}) => {
  const [uploading, setUploading] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(initialId || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    const isImage = file.type.startsWith('image/');
    const isPDF = file.type === 'application/pdf';

    if (!isImage && !isPDF) {
      toast.error("Format file tidak didukung. Gunakan JPG, PNG, atau PDF.");
      return;
    }

    setUploading(true);
    try {
      let fileToUpload = file;

      // Compress if it's an image
      if (isImage) {
        const options = {
          maxSizeMB: 0.2, // 200KB is plenty for Gemini OCR
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        };
        try {
          fileToUpload = await imageCompression(file, options);
          console.log(`Compressed: ${file.size} -> ${fileToUpload.size}`);
        } catch (compressErr) {
          console.warn("Compression failed, using original", compressErr);
        }
      } else if (isPDF && file.size > 4 * 1024 * 1024) {
        toast.error("File PDF terlalu besar (Maks 4MB)");
        setUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', fileToUpload);

      // We use fetch directly here because our 'api' helper is for JSON
      const token = localStorage.getItem('semeja_auth_token');
      const deviceId = localStorage.getItem('semeja_device_id');
      
      const response = await fetch('/api/attachments', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'X-Device-ID': deviceId || '',
        },
        body: formData
      });

      if (!response.ok) throw new Error("Gagal mengupload struk");
      
      const data = await response.json();
      setCurrentId(data.id);
      onUploadSuccess(data.id);
      
      // OCR Scan if enabled
      if (autoScan && onScanSuccess) {
        setUploading(true); // Keep loading state for scanning
        try {
          const scanFormData = new FormData();
          scanFormData.append('receipt', fileToUpload);
          
          const scanResponse = await fetch('/api/ocr/receipt', {
            method: 'POST',
            headers: {
              'Authorization': token ? `Bearer ${token}` : '',
              'X-Device-ID': deviceId || '',
            },
            body: scanFormData
          });
          
          if (scanResponse.ok) {
            const scanData = await scanResponse.json();
            onScanSuccess(scanData, data.id);
          } else {
            console.error("OCR Scan failed but file uploaded");
          }
        } catch (scanErr) {
          console.error("OCR Scan error:", scanErr);
        }
      }
      
      toast.success("Struk berhasil diupload" + (autoScan ? " & di-scan" : ""));
    } catch (err) {
      console.error(err);
      toast.error("Gagal upload: " + (err instanceof Error ? err.message : "Error tidak diketahui"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!currentId) return;
    if (!confirm("Hapus struk ini?")) return;

    try {
      await api.delete(`/attachments/${currentId}`);
      setCurrentId(null);
      onClear();
      toast.success("Struk dihapus");
    } catch (err) {
      toast.error("Gagal hapus struk");
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <label className="text-xs font-medium text-muted-foreground">{label}</label>}
      
      <div className="flex items-center gap-2">
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
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-xs">{uploading ? "Sedang Upload..." : "Upload File Struk"}</span>
          </Button>
        ) : (
          <div className="flex items-center justify-between w-full p-2 bg-primary/5 border border-primary/10 rounded-xl">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-primary/80 uppercase tracking-tight">Struk Tersimpan</span>
                <a 
                  href={`/api/attachments/${currentId}`} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="text-[10px] text-muted-foreground hover:underline"
                >
                  Lihat File
                </a>
              </div>
            </div>
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              className="h-7 w-7 text-muted-foreground hover:text-rose-500 hover:bg-rose-50 rounded-lg"
              onClick={handleDelete}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
      
      {!currentId && !uploading && (
        <p className="text-[10px] text-center text-muted-foreground/60 italic">
          Mendukung JPG, PNG, PDF (Maks 4MB)
        </p>
      )}
    </div>
  );
};
