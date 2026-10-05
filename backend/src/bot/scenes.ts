import { Scenes, Markup } from 'telegraf';
import { prisma } from '../lib/client.js';
import { getKeyboardByRole } from './keyboards.js';
import { positionCategoryMap } from '../lib/reports.js';
import { Role, TicketStatus } from '@prisma/client';

// Подписи срочности такие же как в вебе (PRIORITY_CONFIG)
const PRIORITY_LABELS: Record<'LOW' | 'NORMAL' | 'HIGH', string> = {
  HIGH: '🔴 Срочная',
  NORMAL: '⚪ Обычная',
  LOW: '🔵 Низкая',
};

export const ticketWizard = new Scenes.WizardScene(
  'ticket_wizard',

  // Шаг 1: Запрашиваем аудиторию
  (ctx: any) => {
    ctx.reply('📍 Шаг 1/5. Укажите номер кабинета или аудитории (например, 302):', Markup.removeKeyboard());
    ctx.wizard.state.ticketData = {};
    return ctx.wizard.next();
  },

  // Шаг 2: Валидация аудитории и запрос корпуса
  async (ctx: any) => {
    // ЗАЩИТА: Проверяем, что пользователь ввел именно текст, а не прислал фото/стикер
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply('⚠️ Пожалуйста, напишите номер кабинета обычным текстом.');
      return; // return без next() оставляет пользователя на этом же шаге
    }
    ctx.wizard.state.ticketData.room = ctx.message.text;

    ctx.reply('🏢 Шаг 2/5. Выберите корпус:', Markup.inlineKeyboard([
      [Markup.button.callback('Корпус 1', 'building_1'), Markup.button.callback('Корпус 2', 'building_2')],
    ]));
    return ctx.wizard.next();
  },

  // Шаг 3: Валидация корпуса и вывод кнопок категорий
  async (ctx: any) => {
    if (ctx.message) {
      ctx.reply('⚠️ Пожалуйста, выберите корпус, нажав на одну из кнопок выше 👆');
      return;
    }
    if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('building_')) {
      return;
    }

    const building = parseInt(ctx.callbackQuery.data.replace('building_', ''));
    ctx.wizard.state.ticketData.building = building;
    ctx.answerCbQuery();

    const categories = await prisma.category.findMany();
    if (categories.length === 0) {
      ctx.reply('❌ Ошибка: В базе данных нет категорий.');
      return ctx.scene.leave();
    }

    const buttons = categories.map(cat => Markup.button.callback(cat.name, `cat_${cat.id}`));
    const chunkedButtons = [];
    for (let i = 0; i < buttons.length; i += 2) chunkedButtons.push(buttons.slice(i, i + 2));

    ctx.reply('🛠 Шаг 3/5. Выберите категорию проблемы:', Markup.inlineKeyboard(chunkedButtons));
    return ctx.wizard.next();
  },

  // Шаг 4: Валидация категории и запрос описания
  (ctx: any) => {
    // ЗАЩИТА: Если пользователь напечатал текст вместо нажатия кнопки
    if (ctx.message) {
      ctx.reply('⚠️ Пожалуйста, выберите категорию, нажав на одну из кнопок выше 👆');
      return;
    }
    // ЗАЩИТА: Игнорируем любые левые нажатия кнопок (от других меню)
    if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('cat_')) {
      return;
    }

    const categoryId = parseInt(ctx.callbackQuery.data.replace('cat_', ''));
    ctx.wizard.state.ticketData.categoryId = categoryId;
    ctx.answerCbQuery();
    ctx.reply('📝 Шаг 4/5. Опишите проблему максимально подробно:');
    return ctx.wizard.next();
  },

  // Шаг 5: Валидация описания и запрос срочности
  async (ctx: any) => {
    // ЗАЩИТА: Описание тоже должно быть текстом
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply('⚠️ Пожалуйста, опишите проблему текстом.');
      return;
    }

    ctx.wizard.state.ticketData.description = ctx.message.text;

    ctx.reply('⏱ Шаг 5/5. Укажите срочность заявки:', Markup.inlineKeyboard([
      [Markup.button.callback(PRIORITY_LABELS.HIGH, 'priority_HIGH')],
      [Markup.button.callback(PRIORITY_LABELS.NORMAL, 'priority_NORMAL')],
      [Markup.button.callback(PRIORITY_LABELS.LOW, 'priority_LOW')],
    ]));
    return ctx.wizard.next();
  },

  // Шаг 6: Валидация срочности и сохранение в БД
  async (ctx: any) => {
    if (ctx.message) {
      ctx.reply('⚠️ Пожалуйста, выберите срочность, нажав на одну из кнопок выше 👆');
      return;
    }
    if (!ctx.callbackQuery || !ctx.callbackQuery.data.startsWith('priority_')) {
      return;
    }

    const priority = ctx.callbackQuery.data.replace('priority_', '') as 'LOW' | 'NORMAL' | 'HIGH';
    ctx.answerCbQuery();

    const data = ctx.wizard.state.ticketData;
    data.priority = priority;

    const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });

    if (user) {
      const newTicket = await prisma.ticket.create({
        data: {
          room: data.room,
          building: data.building,
          categoryId: data.categoryId,
          description: data.description,
          priority: data.priority,
          initiatorId: user.id
        },
        include: { category: true }
      });

      await ctx.reply(
        `✅ <b>Заявка #${newTicket.id} успешно зарегистрирована!</b>\n\n` +
        `📍 Кабинет: ${newTicket.room} (корпус ${newTicket.building})\n` +
        `🛠 Категория: ${newTicket.category.name}\n` +
        `📝 Описание: ${newTicket.description}\n` +
        `⏱ Срочность: ${PRIORITY_LABELS[newTicket.priority]}\n` +
        `📊 Статус: Новая`,
        { parse_mode: 'HTML' }
      );

      const executors = await prisma.user.findMany({
        where: { role: Role.EXECUTOR, telegramChatId: { not: null } },
        include: { position: true }
      });

      for (const executor of executors) {
        if (!executor.telegramChatId) continue;

        // Уведомляем только профильных исполнителей — по тому же правилу, что и
        // фильтр «Открытые заявки»: специализация из positionCategoryMap + корпус.
        // Пустой список категорий (должность не в маппинге) = исполнитель видит все.
        const allowed = positionCategoryMap[executor.position?.name ?? ''] ?? [];
        const categoryOk = allowed.length === 0 || allowed.includes(newTicket.category.name);
        const buildingOk = !executor.building || executor.building === newTicket.building;
        if (!categoryOk || !buildingOk) continue;

        await ctx.telegram.sendMessage(
          executor.telegramChatId,
          `🚨 <b>НОВАЯ ЗАЯВКА #${newTicket.id}</b>\n\n` +
          `📍 Кабинет: ${newTicket.room}\n` +
          `🛠 Категория: ${newTicket.category.name}\n` +
          `📝 Описание: ${newTicket.description}\n` +
          `👤 От: ${user.fullName}\n\n` +
          `Зайдите в <b>«📋 Открытые заявки»</b>, чтобы взять её в работу.`,
          { parse_mode: 'HTML' }
        ).catch(() => {});
      }
    }

    const keyboard = user ? getKeyboardByRole(user.role) : Markup.removeKeyboard();
    await ctx.reply('Возвращаемся в главное меню:', keyboard);
    return ctx.scene.leave();
  }
);

// ==========================================
// СЦЕНАРИЙ: "Проблема не решена" (инициатор)
// Аналог PATCH /tickets/:id/reopen. Требует комментарий (≥5 символов),
// сохраняет исполнителя, переводит заявку в "В работе" и пишет запись в историю.
// ==========================================
export const reopenWizard = new Scenes.WizardScene(
  'reopen_wizard',

  (ctx: any) => {
    ctx.reply('✏️ Опишите, что именно не было исправлено (минимум 5 символов):', Markup.removeKeyboard());
    return ctx.wizard.next();
  },

  async (ctx: any) => {
    if (!ctx.message || !ctx.message.text || ctx.message.text.trim().length < 5) {
      await ctx.reply('⚠️ Опишите проблему подробнее (минимум 5 символов).');
      return;
    }

    const comment = ctx.message.text.trim();
    const ticketId = ctx.wizard.state.ticketId;
    const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
    if (!user) return ctx.scene.leave();

    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existing) {
      await ctx.reply('❌ Заявка не найдена.', getKeyboardByRole(user.role));
      return ctx.scene.leave();
    }
    if (existing.initiatorId !== user.id) {
      await ctx.reply('❌ Доступно только автору заявки.', getKeyboardByRole(user.role));
      return ctx.scene.leave();
    }
    if (existing.status !== TicketStatus.COMPLETED) {
      await ctx.reply('❌ Вернуть в работу можно только выполненную заявку.', getKeyboardByRole(user.role));
      return ctx.scene.leave();
    }

    await prisma.$transaction([
      prisma.ticketHistory.create({
        data: {
          ticketId,
          changedById: user.id,
          oldStatus: existing.status,
          newStatus: TicketStatus.IN_PROGRESS,
          comment: `Проблема не решена: ${comment}`,
        },
      }),
      prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.IN_PROGRESS },
      }),
    ]);

    await ctx.reply(`✅ Заявка #${ticketId} возвращена в работу.`, getKeyboardByRole(user.role));
    return ctx.scene.leave();
  }
);

// ==========================================
// СЦЕНАРИЙ: "Завершить заявку" (исполнитель)
// Аналог PATCH /tickets/:id/status (COMPLETED). Комментарий необязателен.
// ==========================================
export const completeWizard = new Scenes.WizardScene(
  'complete_wizard',

  (ctx: any) => {
    ctx.reply('📝 Опишите выполненные работы (или отправьте «-», чтобы пропустить):', Markup.removeKeyboard());
    return ctx.wizard.next();
  },

  async (ctx: any) => {
    if (!ctx.message || !ctx.message.text) {
      await ctx.reply('⚠️ Пожалуйста, напишите текстом (или «-», чтобы пропустить).');
      return;
    }

    const text = ctx.message.text.trim();
    const comment = text === '-' ? null : text;
    const ticketId = ctx.wizard.state.ticketId;
    const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
    if (!user) return ctx.scene.leave();

    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existing) {
      await ctx.reply('❌ Заявка не найдена.', getKeyboardByRole(user.role));
      return ctx.scene.leave();
    }

    if (existing.executorId !== user.id) {
      await ctx.reply('⚠️ Эта заявка закреплена за другим исполнителем.', getKeyboardByRole(user.role));
      return ctx.scene.leave();
    }

    const [, ticket] = await prisma.$transaction([
      prisma.ticketHistory.create({
        data: { ticketId, changedById: user.id, oldStatus: existing.status, newStatus: TicketStatus.COMPLETED, comment },
      }),
      prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.COMPLETED },
        include: { initiator: true },
      }),
    ]);

    await ctx.reply(`✅ Заявка #${ticketId} успешно закрыта!`, getKeyboardByRole(user.role));

    if (ticket.initiator?.telegramChatId) {
      await ctx.telegram.sendMessage(ticket.initiator.telegramChatId, `🎉 <b>Ваша заявка #${ticket.id} выполнена!</b>\nОборудование должно работать штатно.`, { parse_mode: 'HTML' }).catch(() => {});
    }
    return ctx.scene.leave();
  }
);

// ==========================================
// СЦЕНАРИЙ: "Отклонить заявку" (исполнитель)
// Аналог PATCH /tickets/:id/status (CANCELED). Причина обязательна (≥5 символов),
// видна инициатору.
// ==========================================
export const rejectWizard = new Scenes.WizardScene(
  'reject_wizard',

  (ctx: any) => {
    ctx.reply('✏️ Укажите причину отклонения заявки (минимум 5 символов). Причина будет видна инициатору:', Markup.removeKeyboard());
    return ctx.wizard.next();
  },

  async (ctx: any) => {
    if (!ctx.message || !ctx.message.text || ctx.message.text.trim().length < 5) {
      await ctx.reply('⚠️ Укажите причину отклонения подробнее (минимум 5 символов).');
      return;
    }

    const comment = ctx.message.text.trim();
    const ticketId = ctx.wizard.state.ticketId;
    const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
    if (!user) return ctx.scene.leave();

    const existing = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!existing) {
      await ctx.reply('❌ Заявка не найдена.', getKeyboardByRole(user.role));
      return ctx.scene.leave();
    }

    if (existing.executorId !== user.id) {
      await ctx.reply('⚠️ Эта заявка закреплена за другим исполнителем.', getKeyboardByRole(user.role));
      return ctx.scene.leave();
    }

    const [, ticket] = await prisma.$transaction([
      prisma.ticketHistory.create({
        data: { ticketId, changedById: user.id, oldStatus: existing.status, newStatus: TicketStatus.CANCELED, comment },
      }),
      prisma.ticket.update({
        where: { id: ticketId },
        data: { status: TicketStatus.CANCELED },
        include: { initiator: true },
      }),
    ]);

    await ctx.reply(`❌ Заявка #${ticketId} отклонена.`, getKeyboardByRole(user.role));

    if (ticket.initiator?.telegramChatId) {
      await ctx.telegram.sendMessage(ticket.initiator.telegramChatId, `❌ <b>Ваша заявка #${ticket.id} была отклонена ИТ-отделом.</b>\nПричина: ${comment}`, { parse_mode: 'HTML' }).catch(() => {});
    }
    return ctx.scene.leave();
  }
);
