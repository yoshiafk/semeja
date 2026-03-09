import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: typeof autoTable;
    lastAutoTable: { finalY: number };
  }
}

interface DailyBreakdown {
  meal_id: number;
  date: string;
  day_name: string;
  main_course_menu: string;
  second_course_menu: string;
  dessert_menu: string;
  participant_count: number;
  total_cost: number;
  cost_per_person: number;
}

interface ShoppingItem {
  ingredient_id?: number;
  name: string;
  unit: string;
  total_quantity: number;
  shortage_quantity: number;
  has_enough_stock: boolean;
  cost_to_buy: number;
  price_per_unit: number;
  cheapest_supplier: string | null;
}

interface ExportData {
  weekRange: string;
  dailyBreakdown: DailyBreakdown[];
  shoppingList: ShoppingItem[];
}

export function exportShoppingListPDF(
  data: ExportData,
  onProgress?: (progress: number, message: string) => void
) {
  onProgress?.(10, 'Mempersiapkan dokumen...');
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Colors as tuples
  const primaryColor: [number, number, number] = [13, 148, 136]; // Teal
  const textColor: [number, number, number] = [30, 30, 30];
  const mutedColor: [number, number, number] = [120, 120, 120];

  onProgress?.(20, 'Membuat header...');
  
  // Title
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Daftar Belanja Semeja', margin, 15);

  // Week info
  doc.setFontSize(8);
  doc.setTextColor(...mutedColor);
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.weekRange} • Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`, margin, 20);

  let currentY = 28;

  onProgress?.(30, 'Menyusun daftar per hari...');
  
  // Loop through each day
  const totalDays = data.dailyBreakdown.length;
  for (let dayIdx = 0; dayIdx < data.dailyBreakdown.length; dayIdx++) {
    const day = data.dailyBreakdown[dayIdx];
    const dayProgress = 30 + ((dayIdx / totalDays) * 40);
    onProgress?.(dayProgress, `Memproses ${day.day_name}...`);
    // Check if we need a new page
    if (currentY > pageHeight - 40) {
      doc.addPage();
      currentY = 12;
    }

    // Day Header with background
    doc.setFillColor(240, 253, 250); // Light teal bg
    doc.rect(margin, currentY - 3, pageWidth - margin * 2, 8, 'F');
    
    doc.setFontSize(9);
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    const dateStr = new Date(day.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    doc.text(`${day.day_name} (${dateStr})`, margin + 2, currentY + 2);
    
    currentY += 8;

    // Menu items inline
    const menuText = `${day.main_course_menu || '-'} • ${day.second_course_menu || '-'}${day.dessert_menu ? ` • ${day.dessert_menu}` : ''}`;
    
    doc.setFontSize(7);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'normal');
    doc.text(menuText, margin + 2, currentY + 3);
    currentY += 6;

    // Ingredients table for this day
    // Only show ingredients if this day has any menu assigned
    const hasMenu = day.main_course_menu || day.second_course_menu || day.dessert_menu;
    if (!hasMenu) {
      currentY += 3;
      doc.setFontSize(7);
      doc.setTextColor(...mutedColor);
      doc.setFont('helvetica', 'italic');
      doc.text('(Belum ada menu untuk hari ini)', margin + 2, currentY);
      currentY += 6;
      continue;
    }
    
    // Filter shopping items (show all items that need to be bought)
    const dayIngredients = data.shoppingList.filter(item => !item.has_enough_stock);
    
    // Table with checkboxes and empty rows for manual additions
    const tableBody: any[] = [];
    
    // Add existing ingredients
    dayIngredients.forEach((item) => {
      tableBody.push([
        '☐', // Checkbox
        item.name,
        `${item.shortage_quantity.toFixed(2)} ${item.unit}`,
        '', // Empty for manual price
        item.cheapest_supplier || ''
      ]);
    });

    // Add 1 empty row for manual additions
    tableBody.push(['☐', '', '', '', '']);

    autoTable(doc, {
      startY: currentY,
      head: [['', 'Bahan', 'Jumlah', 'Harga', 'Toko']],
      body: tableBody,
      theme: 'plain',
      styles: {
        fontSize: 7,
        cellPadding: 1,
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [80, 80, 80],
        fontStyle: 'bold',
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 6, halign: 'center' },
        1: { cellWidth: 60 },
        2: { cellWidth: 28 },
        3: { cellWidth: 30 },
        4: { cellWidth: 42 },
      },
      margin: { left: margin, right: margin },
      tableLineColor: [200, 200, 200],
      tableLineWidth: 0.1,
    });

    currentY = (doc as any).lastAutoTable.finalY + 6;
  }

  onProgress?.(70, 'Membuat ringkasan belanja...');
  
  // Summary section at the end
  if (currentY > pageHeight - 40) {
    doc.addPage();
    currentY = 12;
  }

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // Full Shopping List Summary
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan Total Belanja', margin, currentY);
  currentY += 6;

  onProgress?.(80, 'Menambahkan detail harga...');

  const summaryBody = data.shoppingList
    .filter(item => !item.has_enough_stock)
    .map(item => [
      '☐',
      item.name,
      `${item.shortage_quantity.toFixed(2)} ${item.unit}`,
      `Rp ${item.cost_to_buy.toLocaleString('id-ID')}`,
      item.cheapest_supplier || '-'
    ]);

  // Add empty rows
  for (let i = 0; i < 2; i++) {
    summaryBody.push(['☐', '', '', '', '']);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['', 'Bahan', 'Jumlah', 'Est. Harga', 'Toko Rekomendasi']],
    body: summaryBody,
    theme: 'striped',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
    },
    headStyles: {
      fillColor: [...primaryColor],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 6, halign: 'center' },
      1: { cellWidth: 55 },
      2: { cellWidth: 28 },
      3: { cellWidth: 32 },
      4: { cellWidth: 45 },
    },
    margin: { left: margin, right: margin },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });

  onProgress?.(90, 'Menambahkan footer...');
  
  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...mutedColor);
    doc.text(
      `Semeja | Hal. ${i}/${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  onProgress?.(95, 'Menyimpan PDF...');
  
  // Save the PDF
  const filename = `Daftar-Belanja-Semeja-${data.weekRange.replace(/\s/g, '-')}.pdf`;
  doc.save(filename);
  
  onProgress?.(100, 'PDF berhasil diunduh!');
}
