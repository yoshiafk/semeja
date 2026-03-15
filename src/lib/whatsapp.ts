/**
 * src/lib/whatsapp.ts
 * WhatsApp message formatters — pure frontend, no backend changes.
 * All functions return a plain string ready for encodeURIComponent.
 * Use shareToWhatsApp() to open the native WA deep link.
 */

import { formatRupiah } from './utils';

// ─── Type definitions ────────────────────────────────────────

interface BuyListItem {
  name: string;
  shortage_quantity: number;
  unit: string;
  cost_to_buy: number;
  cheapest_supplier: string | null;
  category: string;
  has_enough_stock?: boolean;
}

interface DayMenu {
  day_name: string;
  date: string;
  items: Array<{ custom_name: string; category: string }>;
  participant_count?: number;
}

interface Purchase {
  ingredient_name: string;
  quantity?: number;
  unit?: string;
  total_price: number;
  supplier_name?: string;
}

interface MemberSettlement {
  name: string;
  days_joined: number;
  total: number;
}

// ─── 1. Menu Proposal ────────────────────────────────────────
// Triggered when admin moves plan to 'proposed'

export function formatMenuProposal(
  weekLabel: string,
  days: DayMenu[],
  rsvpDeadline: string,
  appUrl: string = 'https://semeja.vercel.app'
): string {
  const menuLines = days.map(day => {
    const allItems = day.items.map(i => i.custom_name).filter(Boolean);
    return `${day.day_name}: ${allItems.length > 0 ? allItems.join(', ') : 'Menu belum diset'}`;
  });

  const deadline = new Date(rsvpDeadline).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });

  return [
    `🍽️ *Menu Pekan ${weekLabel}*`,
    '',
    menuLines.join('\n'),
    '',
    `📅 Silakan konfirmasi keikutsertaan sebelum:`,
    `*${deadline}*`,
    '',
    `👉 Klik link untuk join/skip setiap hari:`,
    appUrl,
    '',
    '_Kalau tidak konfirmasi, dianggap tidak ikut_',
  ].join('\n');
}

// ─── 2. Daily Buy List ────────────────────────────────────────
// Triggered from DailyBriefingCard "Share ke WA" button

export function formatWhatsAppBuyList(buyList: {
  day_name: string;
  date: string;
  participant_count: number;
  items: BuyListItem[];
  total_estimated_cost: number;
}): string {
  const dateStr = new Date(buyList.date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long',
  });

  const itemsToBuy = buyList.items.filter(i => !i.has_enough_stock);

  // Group by category
  const byCategory = itemsToBuy.reduce((acc: Record<string, BuyListItem[]>, item) => {
    const cat = item.category || 'Lainnya';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const categoryLines: string[] = [];
  for (const [category, items] of Object.entries(byCategory)) {
    categoryLines.push(`*${category}*`);
    items.forEach(item => {
      const qtyStr = `${item.shortage_quantity} ${item.unit}`;
      const costStr = item.cost_to_buy > 0 ? ` (~${formatRupiah(item.cost_to_buy)})` : '';
      const supplierStr = item.cheapest_supplier ? ` @ ${item.cheapest_supplier}` : '';
      categoryLines.push(`• ${item.name} — ${qtyStr}${costStr}${supplierStr}`);
    });
    categoryLines.push('');
  }

  return [
    `🛒 *Belanja ${buyList.day_name}, ${dateStr}*`,
    `👥 Untuk ${buyList.participant_count} orang`,
    '',
    categoryLines.join('\n').trimEnd(),
    '',
    `💰 Estimasi total: *${formatRupiah(buyList.total_estimated_cost)}*`,
    '',
    '_Catat struk di aplikasi setelah belanja ya!_',
  ].join('\n');
}

// ─── 3. Daily Recap ───────────────────────────────────────────
// Triggered after all purchases for a day are logged

export function formatDailyRecap(recap: {
  day_name: string;
  date: string;
  participant_count: number;
  purchases: Purchase[];
  actual_cost: number;
  estimated_cost: number;
}): string {
  const dateStr = new Date(recap.date).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long',
  });

  const costPerPerson = recap.participant_count > 0
    ? Math.round(recap.actual_cost / recap.participant_count)
    : 0;

  const purchaseLines = recap.purchases.map(p => {
    const supplierStr = p.supplier_name ? ` (${p.supplier_name})` : '';
    return `• ${p.ingredient_name} — ${formatRupiah(p.total_price)}${supplierStr}`;
  });

  const diff = recap.actual_cost - recap.estimated_cost;
  const diffStr = diff === 0
    ? ''
    : diff > 0
      ? `\n⚠️ Lebih ${formatRupiah(diff)} dari estimasi`
      : `\n✅ Hemat ${formatRupiah(Math.abs(diff))} dari estimasi`;

  return [
    `📋 *Rekap Belanja — ${recap.day_name}, ${dateStr}*`,
    '',
    '*Yang dibeli:*',
    purchaseLines.join('\n'),
    '',
    `💰 Total belanja: *${formatRupiah(recap.actual_cost)}*${diffStr}`,
    `👥 Untuk ${recap.participant_count} orang → *${formatRupiah(costPerPerson)}/orang*`,
    '',
    '✅ Selesai belanja hari ini',
  ].join('\n');
}

// ─── 4. Weekly Settlement ─────────────────────────────────────
// Triggered when admin closes the week

export function formatWeeklySettlement(settlement: {
  weekLabel: string;
  totalActualCost: number;
  members: MemberSettlement[];
  adminName?: string;
}): string {
  const memberLines = [...settlement.members]
    .sort((a, b) => b.total - a.total)
    .map(m => `• *${m.name}* (${m.days_joined} hari) → *${formatRupiah(m.total)}*`);

  const transferNote = settlement.adminName
    ? `\nTransfer ke: *${settlement.adminName}*`
    : '';

  return [
    `🧾 *Rekap Biaya Makan — ${settlement.weekLabel}*`,
    '',
    `Total belanja minggu ini: *${formatRupiah(settlement.totalActualCost)}*`,
    '',
    '*Tagihan per anggota:*',
    memberLines.join('\n'),
    '',
    `_Mohon transfer sebelum akhir minggu ini_${transferNote}`,
    '',
    '_Terima kasih sudah masak bareng! 🙏_',
  ].join('\n');
}

// ─── 5. Weekly Shopping List (non-daily mode) ─────────────────

export function formatWeeklyShoppingList(data: {
  weekLabel: string;
  shoppingList: Array<{
    name: string;
    shortage_quantity: number;
    unit: string;
    cost_to_buy: number;
    category: string;
    cheapest_supplier?: string | null;
  }>;
  totalCost: number;
}): string {
  const itemLines = data.shoppingList
    .filter(i => i.shortage_quantity > 0)
    .map(i => {
      const cost = i.cost_to_buy > 0 ? ` ~${formatRupiah(i.cost_to_buy)}` : '';
      const supplier = i.cheapest_supplier ? ` @ ${i.cheapest_supplier}` : '';
      return `• ${i.name}: ${i.shortage_quantity} ${i.unit}${cost}${supplier}`;
    });

  return [
    `📦 *Daftar Belanja — ${data.weekLabel}*`,
    '',
    itemLines.join('\n'),
    '',
    `💰 Estimasi total: *${formatRupiah(data.totalCost)}*`,
  ].join('\n');
}

// ─── Helper ───────────────────────────────────────────────────

export function shareToWhatsApp(message: string): void {
  const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
