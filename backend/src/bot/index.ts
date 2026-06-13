// backend/src/bot/index.ts
import { Telegraf, Markup, session, Scenes } from 'telegraf';
import 'dotenv/config';
import { prisma } from '../lib/client.js';
import { Role } from '@prisma/client';
import { getKeyboardByRole, MANAGER_NOT_SUPPORTED_MESSAGE } from './keyboards.js';
import { ticketWizard, reopenWizard, completeWizard, rejectWizard } from './scenes.js';

import { initiatorHandler } from './initiator.js';
import { executorHandler } from './executor.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error('TELEGRAM_BOT_TOKEN не задан в переменных окружения');
}

const bot = new Telegraf(token);

const stage = new Scenes.Stage<any>([ticketWizard, reopenWizard, completeWizard, rejectWizard]);
bot.use(session());
bot.use(stage.middleware());

// ==========================================
// БЛОКИРОВКА РУКОВОДИТЕЛЕЙ
// (бот предназначен только для инициаторов и исполнителей,
//  у руководителя есть отдельный веб-кабинет)
// ==========================================
bot.use(async (ctx, next) => {
  const text = ctx.message && 'text' in ctx.message ? ctx.message.text : undefined;
  if (text?.startsWith('/start')) return next();

  if (!ctx.chat) return next();
  const user = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
  if (user?.role === Role.MANAGER) {
    if (ctx.callbackQuery) await ctx.answerCbQuery().catch(() => {});
    return ctx.reply(MANAGER_NOT_SUPPORTED_MESSAGE, Markup.removeKeyboard());
  }
  return next();
});

bot.use(initiatorHandler);
bot.use(executorHandler);

// ==========================================
// КОМАНДА /START
// ==========================================
bot.start(async (ctx) => {
  const payload = ctx.payload;
  const telegramId = String(ctx.chat.id);

  // Сначала проверяем, есть ли уже этот пользователь в нашей БД
  const existingUser = await prisma.user.findUnique({ where: { telegramChatId: telegramId } });

  // Сценарий А:пользователь перешел по ссылке для привязки аккаунта
  if (payload) {
    // Защита: если он уже привязан, не даем привязать заново
    if (existingUser) {
      if (existingUser.role === Role.MANAGER) {
        return ctx.reply(`ℹ️ Вы уже авторизованы как ${existingUser.fullName}.\n\n${MANAGER_NOT_SUPPORTED_MESSAGE}`, Markup.removeKeyboard());
      }
      return ctx.reply(`ℹ️ Вы уже авторизованы в системе как ${existingUser.fullName}!\nЕсли вам нужно сменить аккаунт, обратитесь к администратору.`, getKeyboardByRole(existingUser.role));
    }

    const userByCode = await prisma.user.findUnique({ where: { linkCode: payload } });
    if (userByCode) {
      await prisma.user.update({
        where: { id: userByCode.id },
        data: { telegramChatId: telegramId, linkCode: null }
      });

      if (userByCode.role === Role.MANAGER) {
        return ctx.reply(`✅ Отлично, ${userByCode.fullName}! Ваш аккаунт привязан.\n\n${MANAGER_NOT_SUPPORTED_MESSAGE}`, Markup.removeKeyboard());
      }
      return ctx.reply(`✅ Отлично, ${userByCode.fullName}! Ваш аккаунт успешно привязан.`, getKeyboardByRole(userByCode.role));
    } else {
      return ctx.reply('❌ Ошибка: неверный или уже использованный код привязки.');
    }
  }

  // Сценарий Б: пользователь уже авторизован и просто нажал /start (или написал сам)
  if (existingUser) {
      if (existingUser.role === Role.MANAGER) {
        return ctx.reply(`👋 С возвращением, ${existingUser.fullName}!\n\n${MANAGER_NOT_SUPPORTED_MESSAGE}`, Markup.removeKeyboard());
      }
      return ctx.reply(`👋 С возвращением, ${existingUser.fullName}! Выберите действие в меню ниже 👇`, getKeyboardByRole(existingUser.role));
  }

  // Сценарий В: гость без кода привязки
  ctx.reply('👋 Добро пожаловать в Service Desk!\nДля работы с ботом необходимо авторизоваться. Перейдите в веб-портал системы и нажмите кнопку «Привязать Telegram».', Markup.removeKeyboard());
});

bot.hears('👤 Профиль', async (ctx) => {
  const user = await prisma.user.findUnique({
    where: { telegramChatId: String(ctx.chat.id) },
    include: { position: true, department: true }
  });
  if (user) {
    const pos = user.position ? user.position.name : 'Не указана';
    const dep = user.department ? user.department.name : 'Не указано';
    ctx.reply(`👤 <b>Ваш профиль:</b>\nФИО: ${user.fullName}\nОтдел: ${dep}\nДолжность: ${pos}`, { parse_mode: 'HTML' });
  }
});

bot.hears('🆘 Помощь', (ctx) => ctx.reply('📞 Служба поддержки: +7 (999) 000-00-00\nКабинет: 201 (ИТ-отдел)'));

// ==========================================
// ГЛОБАЛЬНЫЙ ПЕРЕХВАТЧИК НЕИЗВЕСТНЫХ КОМАНД
// (Должен стоять строго последним перед запуском)
// ==========================================
bot.on('message', async (ctx) => {
  const existingUser = await prisma.user.findUnique({ where: { telegramChatId: String(ctx.chat.id) } });
  if (existingUser) {
    // Если пользователь написал какую-то хуйню мимо кнопок
    ctx.reply('🤖 Я не понимаю эту команду.\nПожалуйста, воспользуйтесь кнопками меню внизу экрана 👇', getKeyboardByRole(existingUser.role));
  } else {
    ctx.reply('Для работы с ботом необходимо привязать аккаунт через веб-портал.', Markup.removeKeyboard());
  }
});

// ==========================================
// ЗАПУСК БОТА
// ==========================================
bot.launch(async () => {
  await bot.telegram.setMyCommands([
    { command: 'start', description: 'Главное меню / Перезапуск' },
    { command: 'help', description: 'Справка и контакты' }
  ]);
  console.log('🤖 Telegram-бот успешно запущен!');
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
