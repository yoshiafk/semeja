import { MessageCircle } from 'lucide-react';
import { shareToWhatsApp } from '@/lib/whatsapp';
import { cn } from '@/lib/utils';

interface WhatsAppShareButtonProps {
  message: string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function WhatsAppShareButton({
  message,
  label = 'Share ke WA',
  size = 'sm',
  className,
}: WhatsAppShareButtonProps) {
  return (
    <button
      onClick={() => shareToWhatsApp(message)}
      className={cn(
        'flex items-center gap-1.5 font-medium rounded-lg border transition-colors',
        'border-green-600/30 text-green-700 hover:bg-green-50',
        size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        className
      )}
    >
      <MessageCircle className={size === 'sm' ? 'size-3' : 'size-4'} />
      {label}
    </button>
  );
}
