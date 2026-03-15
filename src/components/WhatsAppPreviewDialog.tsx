import { MessageCircle } from 'lucide-react';
import { shareToWhatsApp } from '@/lib/whatsapp';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface WhatsAppPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  message: string;
  title: string;
}

export function WhatsAppPreviewDialog({
  open,
  onClose,
  message,
  title,
}: WhatsAppPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Preview pesan yang akan dikirim</DialogDescription>
        </DialogHeader>
        <div className="bg-[#DCF8C6] rounded-xl p-3 text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto">
          {message}
        </div>
        <DialogFooter className="gap-2 flex-row">
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Batal
          </Button>
          <Button
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={() => {
              shareToWhatsApp(message);
              onClose();
            }}
          >
            <MessageCircle className="h-4 w-4 mr-1.5" />
            Kirim ke WA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
