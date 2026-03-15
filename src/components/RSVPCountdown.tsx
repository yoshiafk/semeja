import { useState, useEffect } from 'react';

interface RSVPCountdownProps {
  deadline: string;
}

export function RSVPCountdown({ deadline }: RSVPCountdownProps) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Sudah tutup');
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (h > 24) {
        setRemaining(`${Math.floor(h / 24)} hari lagi`);
      } else {
        setRemaining(`${h}j ${m}m lagi`);
      }
    };

    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [deadline]);

  if (!remaining) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg w-fit">
      <span>⏰</span>
      <span>RSVP {remaining}</span>
    </div>
  );
}
