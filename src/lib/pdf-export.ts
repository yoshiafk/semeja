import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Extend jsPDF type for autotable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
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

export function exportShoppingListPDF(data: ExportData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // Colors as tuples
  const primaryColor: [number, number, number] = [13, 148, 136]; // Teal
  const textColor: [number, number, number] = [30, 30, 30];
  const mutedColor: [number, number, number] = [120, 120, 120];

  // Title
  doc.setFontSize(20);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Daftar Belanja Semeja', margin, 20);

  // Week info
  doc.setFontSize(11);
  doc.setTextColor(...mutedColor);
  doc.setFont('helvetica', 'normal');
  doc.text(`Periode: ${data.weekRange}`, margin, 28);
  doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, margin, 34);

  let currentY = 45;

  // Loop through each day
  data.dailyBreakdown.forEach((day) => {
    // Check if we need a new page
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    // Day Header with background
    doc.setFillColor(240, 253, 250); // Light teal bg
    doc.rect(margin, currentY - 5, pageWidth - margin * 2, 12, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text(`${day.day_name}`, margin + 3, currentY + 2);
    
    doc.setFontSize(9);
    doc.setTextColor(...mutedColor);
    doc.setFont('helvetica', 'normal');
    const dateStr = new Date(day.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    doc.text(dateStr, pageWidth - margin - 15, currentY + 2);
    
    currentY += 12;

    // Menu items
    const menus = [
      { label: 'Lauk', value: day.main_course_menu || '-' },
      { label: 'Sayur', value: day.second_course_menu || '-' },
      { label: 'Dessert', value: day.dessert_menu || '-' }
    ];

    doc.setFontSize(9);
    menus.forEach(menu => {
      doc.setTextColor(...mutedColor);
      doc.setFont('helvetica', 'normal');
      doc.text(`${menu.label}:`, margin + 3, currentY);
      doc.setTextColor(...textColor);
      doc.setFont('helvetica', 'bold');
      doc.text(menu.value, margin + 20, currentY);
      currentY += 5;
    });

    currentY += 3;

    // Ingredients table for this day
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

    // Add 3 empty rows for manual additions
    for (let i = 0; i < 3; i++) {
      tableBody.push(['☐', '', '', '', '']);
    }

    doc.autoTable({
      startY: currentY,
      head: [['✓', 'Bahan', 'Jumlah', 'Harga', 'Toko']],
      body: tableBody,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [245, 245, 245],
        textColor: [80, 80, 80],
        fontStyle: 'bold',
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 30 },
        3: { cellWidth: 35 },
        4: { cellWidth: 40 },
      },
      margin: { left: margin, right: margin },
      tableLineColor: [200, 200, 200],
      tableLineWidth: 0.1,
    });

    currentY = doc.lastAutoTable.finalY + 10;
  });

  // Summary section at the end
  if (currentY > pageHeight - 50) {
    doc.addPage();
    currentY = 20;
  }

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 8;

  // Full Shopping List Summary
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Ringkasan Total Belanja', margin, currentY);
  currentY += 8;

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
  for (let i = 0; i < 5; i++) {
    summaryBody.push(['☐', '', '', '', '']);
  }

  doc.autoTable({
    startY: currentY,
    head: [['✓', 'Bahan', 'Jumlah', 'Est. Harga', 'Toko Rekomendasi']],
    body: summaryBody,
    theme: 'striped',
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [...primaryColor],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 50 },
      2: { cellWidth: 30 },
      3: { cellWidth: 35 },
      4: { cellWidth: 45 },
    },
    margin: { left: margin, right: margin },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...mutedColor);
    doc.text(
      `Semeja - Daftar Belanja | Halaman ${i} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Save the PDF
  const filename = `Daftar-Belanja-Semeja-${data.weekRange.replace(/\s/g, '-')}.pdf`;
  doc.save(filename);
}
