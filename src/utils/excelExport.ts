import { Order, OrderStatus } from '../types';

/**
 * Persian Date Time Formatter
 */
export function formatPersianDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return dateString;
  }
}

/**
 * Translates order status to clean Persian label
 */
function getOrderStatusPersian(status: OrderStatus): string {
  switch (status) {
    case 'pending':
      return 'در انتظار تایید';
    case 'preparing':
      return 'در حال آماده‌سازی';
    case 'ready':
      return 'آماده تحویل';
    case 'completed':
      return 'تحویل شده (تسویه)';
    case 'cancelled':
      return 'لغو شده';
    default:
      return status;
  }
}

/**
 * Filter orders based on selected time window
 */
export function filterOrdersByTime(
  orders: Order[],
  timeFilter: 'today' | 'weekly' | 'monthly' | 'yearly' | 'all'
): Order[] {
  if (timeFilter === 'all') return orders;
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return orders.filter((o) => {
    try {
      const orderTime = new Date(o.createdAt).getTime();
      if (isNaN(orderTime)) return true;
      if (timeFilter === 'today') {
        return orderTime >= startOfDay;
      }
      if (timeFilter === 'weekly') {
        const sevenDaysAgo = startOfDay - 6 * 24 * 60 * 60 * 1000;
        return orderTime >= sevenDaysAgo;
      }
      if (timeFilter === 'monthly') {
        const thirtyDaysAgo = startOfDay - 29 * 24 * 60 * 60 * 1000;
        return orderTime >= thirtyDaysAgo;
      }
      if (timeFilter === 'yearly') {
        const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();
        return orderTime >= startOfYear;
      }
      return true;
    } catch {
      return true;
    }
  });
}

export interface ExcelExportOptions {
  filterLabel?: string;
  cafeName?: string;
  format?: 'xls' | 'csv';
}

/**
 * Generates and downloads an Excel (.xls) file with full RTL styling,
 * formatting, formulas, and Persian typography.
 */
export function exportOrdersToExcel(
  orders: Order[],
  options: ExcelExportOptions = {}
): void {
  const {
    filterLabel = 'تمام سفارشات',
    cafeName = 'کافه پی (P Cafe)',
    format = 'xls',
  } = options;

  if (format === 'csv') {
    exportOrdersToCsv(orders, options);
    return;
  }

  const exportDate = formatPersianDateTime(new Date().toISOString());
  const totalRevenue = orders.reduce((sum, o) => (o.status !== 'cancelled' ? sum + o.totalPrice : sum), 0);
  const validOrdersCount = orders.filter((o) => o.status !== 'cancelled').length;
  const avgOrderValue = validOrdersCount > 0 ? Math.round(totalRevenue / validOrdersCount) : 0;

  // Build items rows
  const rowsHtml = orders
    .map((order, index) => {
      const itemsText = (order.items || [])
        .map((it) => {
          let desc = `${it.name} (${it.quantity} عدد)`;
          const opts: string[] = [];
          if (it.options?.milk) opts.push(it.options.milk);
          if (it.options?.sugar) opts.push(it.options.sugar);
          if (it.options?.extraShot) opts.push('اکسترا شات');
          if (it.options?.syrup) opts.push(it.options.syrup);
          if (it.specialNote) opts.push(it.specialNote);
          if (opts.length > 0) desc += ` [${opts.join('، ')}]`;
          return desc;
        })
        .join(' | ');

      const orderTypeFa = order.orderType === 'dine-in' ? 'سالن' : 'بیرون‌بر';
      const tableFa = order.tableNumber ? `میز ${order.tableNumber}` : '-';
      const statusFa = getOrderStatusPersian(order.status);
      const createdAtFa = formatPersianDateTime(order.createdAt);
      const rowBg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      const statusColor =
        order.status === 'completed'
          ? '#15803d'
          : order.status === 'cancelled'
          ? '#b91c1c'
          : order.status === 'preparing'
          ? '#0284c7'
          : '#b45309';

      return `
        <tr style="background-color: ${rowBg};">
          <td style="text-align: center; border: 1px solid #d1d5db; padding: 8px;">${index + 1}</td>
          <td style="text-align: center; font-weight: bold; border: 1px solid #d1d5db; padding: 8px; font-family: monospace;">PC-${order.orderNumber}</td>
          <td style="text-align: center; border: 1px solid #d1d5db; padding: 8px;">${createdAtFa}</td>
          <td style="text-align: right; font-weight: 500; border: 1px solid #d1d5db; padding: 8px;">${escapeXml(order.customerName || 'مشتری کافه')}</td>
          <td style="text-align: center; border: 1px solid #d1d5db; padding: 8px; font-family: monospace;">${escapeXml(order.customerPhone || '-')}</td>
          <td style="text-align: center; border: 1px solid #d1d5db; padding: 8px;">${orderTypeFa}</td>
          <td style="text-align: center; border: 1px solid #d1d5db; padding: 8px;">${tableFa}</td>
          <td style="text-align: right; border: 1px solid #d1d5db; padding: 8px; font-size: 11px;">${escapeXml(itemsText)}</td>
          <td style="text-align: right; border: 1px solid #d1d5db; padding: 8px; font-size: 11px; color: #6b7280;">${escapeXml(order.notes || '-')}</td>
          <td style="text-align: left; font-weight: bold; border: 1px solid #d1d5db; padding: 8px; mso-number-format: '\\#\\,\\#\\#0\\ &quot;تومان&quot;';">${order.totalPrice.toLocaleString('en-US')} تومان</td>
          <td style="text-align: center; font-weight: bold; color: ${statusColor}; border: 1px solid #d1d5db; padding: 8px;">${statusFa}</td>
        </tr>
      `;
    })
    .join('');

  // XML/HTML Template for native Excel opening with RTL, colors, and formatting
  const excelTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" 
          xmlns:x="urn:schemas-microsoft-com:office:excel" 
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>گزارش سفارشات کافه</x:Name>
              <x:WorksheetOptions>
                <x:DisplayRightToLeft/>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body { font-family: 'Vazirmatn', 'Tahoma', 'Segoe UI', Arial, sans-serif; direction: rtl; }
        table { border-collapse: collapse; width: 100%; direction: rtl; }
        .header-cell {
          background-color: #f59e0b;
          color: #1c1917;
          font-weight: bold;
          text-align: center;
          border: 1px solid #d97706;
          padding: 10px;
          font-size: 12px;
        }
        .meta-title {
          font-size: 18px;
          font-weight: bold;
          color: #78350f;
          padding: 12px;
          background-color: #fef3c7;
          text-align: center;
        }
        .meta-box {
          font-size: 12px;
          color: #374151;
          padding: 6px 12px;
          background-color: #f3f4f6;
          border: 1px solid #e5e7eb;
        }
      </style>
    </head>
    <body dir="rtl">
      <table>
        <tr>
          <td colspan="11" class="meta-title">
            📋 گزارش جامع فروش و سفارشات ${escapeXml(cafeName)}
          </td>
        </tr>
        <tr>
          <td colspan="3" class="meta-box"><b>بازه زمانی گزارش:</b> ${escapeXml(filterLabel)}</td>
          <td colspan="3" class="meta-box"><b>تاریخ و زمان استخراج:</b> ${exportDate}</td>
          <td colspan="3" class="meta-box"><b>تعداد کل فاکتورها:</b> ${orders.length} عدد (${validOrdersCount} فعال)</td>
          <td colspan="2" class="meta-box"><b>میانگین هر سفارش:</b> ${avgOrderValue.toLocaleString('en-US')} تومان</td>
        </tr>
        <tr>
          <td colspan="11" style="height: 10px;"></td>
        </tr>
        <thead>
          <tr>
            <th class="header-cell" style="width: 40px;">ردیف</th>
            <th class="header-cell" style="width: 100px;">شماره فاکتور</th>
            <th class="header-cell" style="width: 140px;">تاریخ و زمان</th>
            <th class="header-cell" style="width: 130px;">نام مشتری</th>
            <th class="header-cell" style="width: 110px;">شماره تماس</th>
            <th class="header-cell" style="width: 90px;">نوع سفارش</th>
            <th class="header-cell" style="width: 70px;">شماره میز</th>
            <th class="header-cell" style="width: 280px;">اقلام و جزئیات سفارش</th>
            <th class="header-cell" style="width: 150px;">یادداشت مشتری</th>
            <th class="header-cell" style="width: 120px;">مبلغ کل (تومان)</th>
            <th class="header-cell" style="width: 120px;">وضعیت سفارش</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr style="background-color: #fef3c7; font-weight: bold;">
            <td colspan="9" style="text-align: left; padding: 12px; border: 1px solid #d97706; font-size: 14px;">
              جمع کل فروش در این دوره (تومان):
            </td>
            <td colspan="2" style="text-align: center; padding: 12px; border: 1px solid #d97706; font-size: 15px; color: #b45309;">
              ${totalRevenue.toLocaleString('en-US')} تومان
            </td>
          </tr>
        </tfoot>
      </table>
    </body>
    </html>
  `;

  // Create downloadable blob
  const blob = new Blob([excelTemplate], {
    type: 'application/vnd.ms-excel;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const dateSlug = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const filename = `PCafe-Orders-Report-${dateSlug}.xls`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a UTF-8 BOM CSV file for accounting and spreadsheet software
 */
export function exportOrdersToCsv(
  orders: Order[],
  options: ExcelExportOptions = {}
): void {
  const headers = [
    'ردیف',
    'شماره فاکتور',
    'تاریخ و زمان',
    'نام مشتری',
    'شماره تماس',
    'نوع سفارش',
    'شماره میز',
    'اقلام فاکتور',
    'یادداشت',
    'مبلغ کل (تومان)',
    'وضعیت فاکتور',
  ];

  const escapeCsv = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvRows: string[] = [headers.map(escapeCsv).join(',')];

  orders.forEach((order, index) => {
    const itemsText = (order.items || [])
      .map((it) => `${it.name} (${it.quantity}x)`)
      .join(' + ');

    const orderTypeFa = order.orderType === 'dine-in' ? 'سالن' : 'بیرون‌بر';
    const tableFa = order.tableNumber ? String(order.tableNumber) : '-';
    const statusFa = getOrderStatusPersian(order.status);
    const createdAtFa = formatPersianDateTime(order.createdAt);

    csvRows.push(
      [
        index + 1,
        `PC-${order.orderNumber}`,
        createdAtFa,
        order.customerName || 'مشتری کافه',
        order.customerPhone || '-',
        orderTypeFa,
        tableFa,
        itemsText,
        order.notes || '-',
        order.totalPrice,
        statusFa,
      ]
        .map(escapeCsv)
        .join(',')
    );
  });

  // UTF-8 BOM (\uFEFF) ensures Excel opens Persian text without Mojibake
  const csvContent = '\uFEFF' + csvRows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const dateSlug = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const filename = `PCafe-Orders-Report-${dateSlug}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
