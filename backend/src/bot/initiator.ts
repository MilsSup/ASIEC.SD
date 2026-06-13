import { Composer, Markup } from 'telegraf';
import { prisma } from '../lib/client.js';
import { translateStatus } from './utils.js';
import { TicketStatus } from '@prisma/client';

export const initiatorHandler = new Composer<any>();

initiatorHandler.hears('➕ Новая заявка', (ctx) => ctx.scene.enter('ticket_wizard'));

// 1. АКТИВНЫЕ ЗАЯВКИ
initiatorHandler.hears('⏳ Активные заявки', async (ctx) => {
  const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
  if (!user) return;

  const tickets = await prisma.ticket.findMany({
    where: { initiatorId: user.id, status: { in: [TicketStatus.NEW, TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_PURCHASE] } },
    orderBy: { createdAt: 'desc' },
    include: { category: true, executor: true }
  });

  if (tickets.length === 0) return ctx.reply('📭 У вас нет активных заявок.');

  let text = '<b>Ваши активные заявки:</b>\n\n';
  tickets.forEach(t => {
    text += `📌 <b>Заявка #${t.id}</b> — <i>${translateStatus(t.status)}</i>\nКабинет: ${t.room} (корпус ${t.building}) | Проблема: ${t.category.name}\n`;
    if (t.executor) text += `👨‍🔧 Исполнитель: ${t.executor.fullName}\n`;
    text += `\n`;
  });

  ctx.reply(text, { parse_mode: 'HTML' });
});

// 2. АРХИВ С ПАГИНАЦИЕЙ И КНОПКОЙ ВОЗВРАТА
const sendArchivePage = async (ctx: any, page: number, isEdit = false) => {
  const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
  if (!user) return;

  const limit = 3; // показывать по 3 заявки на странице
  const offset = page * limit;

  const tickets = await prisma.ticket.findMany({
    where: { initiatorId: user.id, status: { in: [TicketStatus.COMPLETED, TicketStatus.CANCELED] } },
    orderBy: { updatedAt: 'desc' },
    skip: offset,
    take: limit,
    include: { category: true }
  });

  const total = await prisma.ticket.count({
    where: { initiatorId: user.id, status: { in: [TicketStatus.COMPLETED, TicketStatus.CANCELED] } }
  });

  if (total === 0) {
    return isEdit ? null : ctx.reply('📭 Ваш архив пуст.');
  }

  let text = `<b>📁 Архив заявок (Страница ${page + 1})</b>\n\n`;
  const buttons: any[] = [];

  // вычисляем дату "7 дней назад"
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  tickets.forEach(t => {
    const date = t.updatedAt.toLocaleDateString('ru-RU');
    text += `📌 <b>Заявка #${t.id}</b> [${date}]\nСтатус: <i>${translateStatus(t.status)}</i>\nОписание: ${t.description}\n\n`;

    if (t.status === TicketStatus.COMPLETED && t.updatedAt > sevenDaysAgo) {
      buttons.push([Markup.button.callback(`⚠️ Заявка #${t.id} не решена`, `unresolved_${t.id}`)]);
    }
  });

  // Кнопки Вперед/Назад
  const navButtons = [];
  if (page > 0) navButtons.push(Markup.button.callback('⬅️ Назад', `archive_page_${page - 1}`));
  if (offset + limit < total) navButtons.push(Markup.button.callback('Вперед ➡️', `archive_page_${page + 1}`));
  if (navButtons.length > 0) buttons.push(navButtons);

  if (isEdit) {
    await ctx.editMessageText(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  } else {
    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  }
};

initiatorHandler.hears('📁 Архив заявок', (ctx) => sendArchivePage(ctx, 0));

initiatorHandler.action(/^archive_page_(\d+)$/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  await sendArchivePage(ctx, page, true);
});

// ВОЗВРАТ ЗАЯВКИ В РАБОТУ ("Проблема не решена")
// Запрашиваем у инициатора комментарий перед возвратом заявки исполнителю
initiatorHandler.action(/^unresolved_(\d+)$/, async (ctx) => {
  const ticketId = parseInt(ctx.match[1]);
  await ctx.answerCbQuery();
  await ctx.scene.enter('reopen_wizard', { ticketId });
});
