import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRupiah } from '@/lib/utils';
import { type PaymentRecord } from '@/lib/api';

interface MemberTotal {
  member_id: number;
  name: string;
  days_joined: number;
  total: number;
}

interface PaymentStatusRowProps {
  member: MemberTotal;
  payment?: PaymentRecord;
  isAdmin: boolean;
  onToggle: (member: MemberTotal, isPaid: boolean) => void;
}

export function PaymentStatusRow({ member, payment, isAdmin, onToggle }: PaymentStatusRowProps) {
  const isPaid = !!payment?.paid_at;

  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'size-8 rounded-full flex items-center justify-center text-xs font-bold',
            isPaid ? 'bg-teal-100 text-teal-700' : 'bg-muted text-muted-foreground'
          )}
        >
          {member.name[0]?.toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium">{member.name}</p>
          <p className="text-xs text-muted-foreground">{member.days_joined} hari</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-semibold">{formatRupiah(member.total)}</p>
          {isPaid && payment?.paid_at && (
            <p className="text-[11px] text-teal-600">
              Lunas{' '}
              {new Date(payment.paid_at).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
              })}
            </p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={() => onToggle(member, isPaid)}
            className={cn(
              'size-7 rounded-full border flex items-center justify-center transition-colors',
              isPaid
                ? 'bg-teal-500 border-teal-500 text-white hover:bg-teal-600'
                : 'border-border hover:border-teal-400'
            )}
          >
            {isPaid && <Check className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
