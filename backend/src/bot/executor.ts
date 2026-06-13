import { Composer, Markup } from 'telegraf';
import { prisma } from '../lib/client.js';
import { translateStatus } from './utils.js';
import { positionCategoryMap } from '../lib/reports.js';
import { Role, TicketStatus } from '@prisma/client';

export const executorHandler = new Composer<any>();

// 1. ОТКРЫТЫЕ ЗАЯВКИ (С ФИЛЬТРАЦИЕЙ ПО ДОЛЖНОСТИ)
executorHandler.hears('📋 Открытые заявки', async (ctx) => {
  // Подтягиваем пользователя вместе с его должностью
  const user = await prisma.user.findUnique({
    where: { telegramChatId: String(ctx.chat.id) },
    include: { position: true }
  });
  if (!user || user.role !== Role.EXECUTOR) return;

  // ЛОГИКА ФИЛЬТРАЦИИ ПО КАТЕГОРИЯМ маппинг тот же, что и в вебе
  const allowedCategories = positionCategoryMap[user.position?.name ?? ''] ?? [];

  const tickets = await prisma.ticket.findMany({
    where: {
      status: TicketStatus.NEW,
      ...(allowedCategories.length > 0 ? { category: { name: { in: allowedCategories } } } : {}),
      // Если за сотрудником закреплён конкретный корпус, то показываем только его заявки
      ...(user.building ? { building: user.building } : {}),
    },
    include: { category: true, initiator: true }
  });

  if (tickets.length === 0) return ctx.reply('🎉 В вашей зоне ответственности открытых заявок нет!');

  ctx.reply('Загружаю список профильных заявок...');

  for (const t of tickets) {
    const text = `🚨 <b>Новая заявка #${t.id}</b>\n📍 Кабинет: ${t.room} (корпус ${t.building})\n🛠 Категория: ${t.category.name}\n📝 Описание: ${t.description}\n👤 От: ${t.initiator?.fullName ?? 'Неизвестный'}`;
    await ctx.reply(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([ Markup.button.callback('👨‍🔧 Взять в работу', `take_${t.id}`) ])
    });
  }
});

// 2. МОИ ЗАДАЧИ
executorHandler.hears('🛠 Мои задачи', async (ctx) => {
  const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
  if (!user || user.role !== Role.EXECUTOR) return;

  const tickets = await prisma.ticket.findMany({
    where: { executorId: user.id, status: { in: [TicketStatus.IN_PROGRESS, TicketStatus.WAITING_FOR_PURCHASE] } },
    include: { category: true }
  });

  if (tickets.length === 0) return ctx.reply('📭 У вас сейчас нет активных задач.');

  for (const t of tickets) {
    const text = `📌 <b>Заявка #${t.id}</b> [${translateStatus(t.status)}]\n📍 Кабинет: ${t.room} (корпус ${t.building})\n🛠 Категория: ${t.category.name}\n📝 Описание: ${t.description}`;

    const buttons = [];

    if (t.status === TicketStatus.WAITING_FOR_PURCHASE) {
      // Заявка ждёт закупки, можно только вернуть её в работу
      buttons.push([Markup.button.callback('↩️ Вернуть в работу', `resume_${t.id}`)]);
    } else {
      // Кнопки "Решена" и "Отклонить" есть всегда
      buttons.push([
        Markup.button.callback('✅ Решена', `complete_${t.id}`),
        Markup.button.callback('❌ Отклонить', `reject_${t.id}`)
      ]);
      buttons.push([Markup.button.callback('🛒 Ждем закупку деталей', `wait_${t.id}`)]);
    }

    await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  }
});

// 3. ИСТОРИЯ ЗАЯВОК ИТ-ОТДЕЛА
executorHandler.hears('📁 Закрытые заявки', async (ctx) => {
  const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
  if (!user || user.role !== Role.EXECUTOR) return;

  const tickets = await prisma.ticket.findMany({
    where: { executorId: user.id, status: { in: [TicketStatus.COMPLETED, TicketStatus.CANCELED] } },
    orderBy: { updatedAt: 'desc' },
    take: 10,
    include: { category: true }
  });

  if (tickets.length === 0) return ctx.reply('📭 Вы еще не закрыли ни одной заявки.');

  let text = '<b>Последние 10 закрытых вами заявок:</b>\n\n';
  tickets.forEach(t => {
    text += `📌 <b>Заявка #${t.id}</b> [<i>${translateStatus(t.status)}</i>]\nКатегория: ${t.category.name}\n\n`;
  });
  ctx.reply(text, { parse_mode: 'HTML' });
});

// ================= ОБРАБОТЧИКИ КНОПОК =================

// Взять заявку в работу. Пишем запись в историю, как и веб-эндпоинт PATCH /status
executorHandler.action(/^take_(\d+)$/, async (ctx) => {
  if (!ctx.chat) return;
  const ticketId = parseInt(ctx.match[1]);
  const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
  if (!user) return;

  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) return;

  // Если заявку уже взял в работу другой исполнитель, то не перехватываем ее
  if (existing.status !== TicketStatus.NEW) {
    await ctx.answerCbQuery('⚠️ Заявку уже взяли в работу.');
    return;
  }

  const [, ticket] = await prisma.$transaction([
    prisma.ticketHistory.create({
      data: { ticketId, changedById: user.id, oldStatus: existing.status, newStatus: TicketStatus.IN_PROGRESS, comment: null },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: { executorId: user.id, status: TicketStatus.IN_PROGRESS },
      include: { initiator: true },
    }),
  ]);

  await ctx.editMessageText(`✅ <b>Вы взяли заявку #${ticket.id} в работу!</b>`, { parse_mode: 'HTML' });

  if (ticket.initiator?.telegramChatId) {
    await ctx.telegram.sendMessage(ticket.initiator.telegramChatId, `🔔 <b>Ваша заявка #${ticket.id} взята в работу!</b>\n👨‍🔧 Исполнитель: ${user.fullName}`, { parse_mode: 'HTML' }).catch(() => {});
  }
});

// Завершить заявку. Запрашиваем комментарий (необязательный), как CompleteModal в вебе
executorHandler.action(/^complete_(\d+)$/, async (ctx) => {
  if (!ctx.chat) return;
  const ticketId = parseInt(ctx.match[1]);
  const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
  if (!user) return;

  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing || existing.executorId !== user.id) {
    await ctx.answerCbQuery('⚠️ Эта заявка закреплена за другим исполнителем.');
    return;
  }

  await ctx.answerCbQuery();
  await ctx.scene.enter('complete_wizard', { ticketId });
});

// Ждём закупку деталей. Пишем запись в историю
executorHandler.action(/^wait_(\d+)$/, async (ctx) => {
  if (!ctx.chat) return;
  const ticketId = parseInt(ctx.match[1]);
  const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
  if (!user) return;

  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) return;

  if (existing.executorId !== user.id) {
    await ctx.answerCbQuery('⚠️ Эта заявка закреплена за другим исполнителем.');
    return;
  }

  const [, ticket] = await prisma.$transaction([
    prisma.ticketHistory.create({
      data: { ticketId, changedById: user.id, oldStatus: existing.status, newStatus: TicketStatus.WAITING_FOR_PURCHASE, comment: null },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.WAITING_FOR_PURCHASE },
      include: { initiator: true },
    }),
  ]);

  await ctx.editMessageText(`🛒 Заявка #${ticketId} переведена в статус "Ожидание закупки".`);

  if (ticket.initiator?.telegramChatId) {
    await ctx.telegram.sendMessage(ticket.initiator.telegramChatId, `⏳ <b>Статус заявки #${ticket.id} изменен!</b>\nДля ремонта требуется закупка деталей/оборудования. Ожидайте.`, { parse_mode: 'HTML' }).catch(() => {});
  }
});

// Вернуть заявку из "Ожидание закупки" обратно в работу
executorHandler.action(/^resume_(\d+)$/, async (ctx) => {
  if (!ctx.chat) return;
  const ticketId = parseInt(ctx.match[1]);
  const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
  if (!user) return;

  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing) return;

  if (existing.executorId !== user.id) {
    await ctx.answerCbQuery('⚠️ Эта заявка закреплена за другим исполнителем.');
    return;
  }

  await prisma.$transaction([
    prisma.ticketHistory.create({
      data: { ticketId, changedById: user.id, oldStatus: existing.status, newStatus: TicketStatus.IN_PROGRESS, comment: null },
    }),
    prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.IN_PROGRESS },
    }),
  ]);

  await ctx.editMessageText(`↩️ Заявка #${ticketId} возвращена в работу.`);
});

// Отклонить заявку. Причина обязательна (как RejectModal в вебе)
executorHandler.action(/^reject_(\d+)$/, async (ctx) => {
  if (!ctx.chat) return;
  const ticketId = parseInt(ctx.match[1]);
  const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
  if (!user) return;

  const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!existing || existing.executorId !== user.id) {
    await ctx.answerCbQuery('⚠️ Эта заявка закреплена за другим исполнителем.');
    return;
  }

  await ctx.answerCbQuery();
  await ctx.scene.enter('reject_wizard', { ticketId });
});
