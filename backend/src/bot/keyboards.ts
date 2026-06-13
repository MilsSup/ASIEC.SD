import { Markup } from 'telegraf';
import { Role } from '@prisma/client';

export const getInitiatorKeyboard = () => {
  return Markup.keyboard([
    ['➕ Новая заявка'],
    ['⏳ Активные заявки', '📁 Архив заявок'],
    ['👤 Профиль', '🆘 Помощь']
  ]).resize();
};

export const getExecutorKeyboard = () => {
  return Markup.keyboard([
    ['📋 Открытые заявки', '🛠 Мои задачи'],
    ['📁 Закрытые заявки', '👤 Профиль']
  ]).resize();
};

export const getKeyboardByRole = (role: Role) => {
  if (role === Role.EXECUTOR) {
    return getExecutorKeyboard();
  }
  return getInitiatorKeyboard();
};

export const MANAGER_NOT_SUPPORTED_MESSAGE =
  '🤖 Бот доступен только сотрудникам, оформляющим заявки, и специалистам ИТ-отдела.\nДля руководителя предусмотрен веб-кабинет — все функции (сводки, отчёты, склад) доступны там.';
