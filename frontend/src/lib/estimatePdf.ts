interface EstimateRow {
  name: string;
  unit: string;
  qty: number;
  price: number;
  tickets: number[];
}

// открывает окно печати с шаблонной сводной сметой на закупку.
export const exportEstimatePdf = (rows: EstimateRow[], total: number, author: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const today = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

  const tableRows = rows.map((item, idx) => `
    <tr>
      <td class="num">${idx + 1}</td>
      <td>${item.name}</td>
      <td class="center">${item.qty} ${item.unit}</td>
      <td class="center">${item.tickets.map(t => `#${t}`).join(', ')}</td>
      <td class="right">${item.price.toLocaleString('ru-RU')} ₽</td>
      <td class="right">${(item.price * item.qty).toLocaleString('ru-RU')} ₽</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8" />
      <title>Сводная смета на закупку</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; padding: 32px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { margin: 0; font-size: 22px; letter-spacing: 0.05em; }
        .header h1 span { color: #3b82f6; }
        .header .subtitle { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px; }
        .header .meta { text-align: right; font-size: 12px; color: #64748b; }
        h2 { font-size: 18px; margin: 0 0 4px; }
        .desc { font-size: 12px; color: #64748b; margin: 0 0 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #cbd5e1; padding: 8px 10px; }
        th { background: #f1f5f9; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; color: #475569; text-align: left; }
        td.num, td.center { text-align: center; }
        td.right { text-align: right; font-weight: 600; }
        tfoot td { font-weight: 700; }
        tfoot td.label { text-align: right; text-transform: uppercase; font-size: 11px; color: #64748b; }
        tfoot td.right { font-size: 15px; color: #4f46e5; }
        .signatures { display: flex; justify-content: space-between; margin-top: 64px; font-size: 12px; }
        .signatures .line { display: inline-block; min-width: 180px; border-bottom: 1px solid #0f172a; margin-left: 8px; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>АПЭК<span>.SD</span></h1>
          <div class="subtitle">Кабинет руководителя</div>
        </div>
        <div class="meta">
          Дата формирования: ${today}<br />
          Сформировал: ${author}
        </div>
      </div>

      <h2>Сводная смета на закупку</h2>
      <p class="desc">Все одобренные позиции для закупки</p>

      <table>
        <thead>
          <tr>
            <th style="width: 36px;">#</th>
            <th>Наименование</th>
            <th style="width: 100px;">Кол-во</th>
            <th style="width: 110px;">Заявки</th>
            <th style="width: 100px;">Цена</th>
            <th style="width: 120px;">Сумма</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows || '<tr><td colspan="6" class="center">Нет одобренных позиций</td></tr>'}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5" class="label">Итого к закупке:</td>
            <td class="right">${total.toLocaleString('ru-RU')} ₽</td>
          </tr>
        </tfoot>
      </table>

      <div class="signatures">
        <div>Руководитель ИТ-отдела: <span class="line"></span></div>
        <div>Директор колледжа: <span class="line"></span></div>
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => { printWindow.print(); };
};
