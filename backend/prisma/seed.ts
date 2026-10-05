import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/client.js';

async function main() {
  console.log('Очистка таблиц...');
  await prisma.stockWriteOff.deleteMany();
  await prisma.ticketHistory.deleteMany();
  await prisma.ticketPart.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.inventory.deleteMany();
  await prisma.nomenclature.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.unit.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.position.deleteMany();

  console.log('Справочники...');
  // Должности исполнителей ИТ-отдела соответствуют специализациям из positionCategoryMap
  const [posTech, posSysadmin, pos1C, posTeacher, posLaborant, posHead] = await Promise.all([
    prisma.position.create({ data: { name: 'Техник' } }),
    prisma.position.create({ data: { name: 'Системный администратор' } }),
    prisma.position.create({ data: { name: 'Специалист 1С' } }),
    prisma.position.create({ data: { name: 'Преподаватель' } }),
    prisma.position.create({ data: { name: 'Лаборант' } }),
    prisma.position.create({ data: { name: 'Руководитель отдела' } }),
  ]);

  const [deptIVT, deptPhysics, deptIT] = await Promise.all([
    prisma.department.create({ data: { name: 'Кафедра информатики и ВТ' } }),
    prisma.department.create({ data: { name: 'Кафедра физики' } }),
    prisma.department.create({ data: { name: 'Отдел информационных технологий' } }),
  ]);

  // Категории ИТ-поддержки. SLA в часах. «Другое» — для обращений вне специализаций.
  const [catComputers, catNetwork, catOffice, cat1C, catAccounts, catOther] = await Promise.all([
    prisma.category.create({ data: { name: 'Компьютерная техника', slaHours: 24 } }),
    prisma.category.create({ data: { name: 'Сеть и интернет', slaHours: 4 } }),
    prisma.category.create({ data: { name: 'Оргтехника', slaHours: 24 } }),
    prisma.category.create({ data: { name: 'Помощь с 1С', slaHours: 8 } }),
    prisma.category.create({ data: { name: 'Учётные записи и доступ', slaHours: 4 } }),
    prisma.category.create({ data: { name: 'Другое', slaHours: 24 } }),
  ]);

  const [eqPc101, eqPc205, eqProjector310, eqPrinterDekanat] = await Promise.all([
    prisma.equipment.create({ data: { inventoryNumber: 'ПК-00101', name: 'Системный блок', room: '101' } }),
    prisma.equipment.create({ data: { inventoryNumber: 'ПК-00205', name: 'Системный блок', room: '205' } }),
    prisma.equipment.create({ data: { inventoryNumber: 'ПРОЕКТОР-00310', name: 'Проектор Epson EB-X06', room: '310' } }),
    prisma.equipment.create({ data: { inventoryNumber: 'ПРИНТЕР-00001', name: 'Принтер HP LaserJet P1102', room: 'Деканат' } }),
  ]);

  const [unitPcs, unitMeters, unitPack] = await Promise.all([
    prisma.unit.create({ data: { shortName: 'шт', fullName: 'Штука' } }),
    prisma.unit.create({ data: { shortName: 'м', fullName: 'Метр' } }),
    prisma.unit.create({ data: { shortName: 'упак', fullName: 'Упаковка' } }),
  ]);

  console.log('Пользователи...');
  const password = await bcrypt.hash('password123', 10);

  const manager = await prisma.user.create({
    data: {
      login: 'manager',
      passwordHash: password,
      role: 'MANAGER',
      fullName: 'Иванова Анна Сергеевна',
      departmentId: deptIT.id,
      positionId: posHead.id,
      building: null,
    },
  });

  const executor1 = await prisma.user.create({
    data: {
      login: 'executor1',
      passwordHash: password,
      role: 'EXECUTOR',
      fullName: 'Петров Сергей Викторович',
      departmentId: deptIT.id,
      positionId: posTech.id,
      building: 1,
    },
  });

  const executor2 = await prisma.user.create({
    data: {
      login: 'executor2',
      passwordHash: password,
      role: 'EXECUTOR',
      fullName: 'Сидоров Алексей Павлович',
      departmentId: deptIT.id,
      positionId: posSysadmin.id,
      building: 2,
    },
  });

  // Специалист 1С обслуживает оба корпуса (building: null)
  const executor3 = await prisma.user.create({
    data: {
      login: 'executor3',
      passwordHash: password,
      role: 'EXECUTOR',
      fullName: 'Волкова Ольга Дмитриевна',
      departmentId: deptIT.id,
      positionId: pos1C.id,
      building: null,
    },
  });
  void executor3;

  const initiator1 = await prisma.user.create({
    data: {
      login: 'initiator1',
      passwordHash: password,
      role: 'INITIATOR',
      fullName: 'Кузнецова Мария Игоревна',
      departmentId: deptIVT.id,
      positionId: posTeacher.id,
      building: 1,
    },
  });

  const initiator2 = await prisma.user.create({
    data: {
      login: 'initiator2',
      passwordHash: password,
      role: 'INITIATOR',
      fullName: 'Смирнов Дмитрий Олегович',
      departmentId: deptPhysics.id,
      positionId: posLaborant.id,
      building: 2,
    },
  });

  console.log('Склады и номенклатура...');
  const [warehouse1, warehouse2] = await Promise.all([
    prisma.warehouse.create({ data: { name: 'Склад корпуса 1', building: 1 } }),
    prisma.warehouse.create({ data: { name: 'Склад корпуса 2', building: 2 } }),
  ]);

  const [nomRam, nomCable, nomToner, nomLamp] = await Promise.all([
    prisma.nomenclature.create({ data: { name: 'Модуль памяти DDR4 8GB', article: 'RAM-DDR4-8G', price: 2500, unitId: unitPcs.id } }),
    prisma.nomenclature.create({ data: { name: 'Патч-корд UTP cat.5e', article: 'CABLE-UTP-5E', price: 35, unitId: unitMeters.id } }),
    prisma.nomenclature.create({ data: { name: 'Картридж для HP LaserJet P1102', article: 'TONER-HP-85A', price: 1800, unitId: unitPcs.id } }),
    prisma.nomenclature.create({ data: { name: 'Лампа для проектора Epson', article: 'LAMP-EPSON-X06', price: 4200, unitId: unitPcs.id } }),
  ]);

  await Promise.all([
    prisma.inventory.create({ data: { warehouseId: warehouse1.id, nomenclatureId: nomRam.id, quantity: 5, minQuantity: 2 } }),
    prisma.inventory.create({ data: { warehouseId: warehouse1.id, nomenclatureId: nomCable.id, quantity: 50, minQuantity: 10 } }),
    prisma.inventory.create({ data: { warehouseId: warehouse1.id, nomenclatureId: nomToner.id, quantity: 1, minQuantity: 1 } }),
    prisma.inventory.create({ data: { warehouseId: warehouse2.id, nomenclatureId: nomLamp.id, quantity: 0, minQuantity: 1 } }),
    prisma.inventory.create({ data: { warehouseId: warehouse2.id, nomenclatureId: nomCable.id, quantity: 20, minQuantity: 10 } }),
  ]);

  console.log('Заявки...');

  // 1. Новая заявка
  const ticket1 = await prisma.ticket.create({
    data: {
      description: 'Не включается системный блок',
      room: '101',
      building: 1,
      status: 'NEW',
      priority: 'HIGH',
      categoryId: catComputers.id,
      equipmentId: eqPc101.id,
      initiatorId: initiator1.id,
    },
  });
  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket1.id,
      changedById: initiator1.id,
      oldStatus: null,
      newStatus: 'NEW',
      comment: 'Заявка создана',
    },
  });

  // 2. В работе, с запчастью из заявки
  const ticket2 = await prisma.ticket.create({
    data: {
      description: 'Низкая производительность ПК, нужна замена памяти',
      room: '205',
      building: 1,
      status: 'IN_PROGRESS',
      priority: 'NORMAL',
      categoryId: catComputers.id,
      equipmentId: eqPc205.id,
      initiatorId: initiator1.id,
      executorId: executor1.id,
    },
  });
  await prisma.ticketPart.create({
    data: {
      ticketId: ticket2.id,
      nomenclatureId: nomRam.id,
      requiredQuantity: 1,
      price: nomRam.price,
      isApproved: true,
      fulfilledFromStock: true,
    },
  });
  await prisma.stockWriteOff.create({
    data: {
      ticketId: ticket2.id,
      nomenclatureId: nomRam.id,
      warehouseId: warehouse1.id,
      quantity: 1,
      price: nomRam.price,
      writtenOffById: executor1.id,
    },
  });
  await prisma.inventory.update({
    where: { warehouseId_nomenclatureId: { warehouseId: warehouse1.id, nomenclatureId: nomRam.id } },
    data: { quantity: { decrement: 1 } },
  });
  await prisma.ticketHistory.createMany({
    data: [
      { ticketId: ticket2.id, changedById: initiator1.id, oldStatus: null, newStatus: 'NEW', comment: 'Заявка создана' },
      { ticketId: ticket2.id, changedById: executor1.id, oldStatus: 'NEW', newStatus: 'IN_PROGRESS', comment: 'Принято в работу, требуется замена модуля памяти' },
    ],
  });

  // 3. Ожидает закупки
  const ticket3 = await prisma.ticket.create({
    data: {
      description: 'Не работает проектор - перегорела лампа',
      room: '310',
      building: 2,
      status: 'WAITING_FOR_PURCHASE',
      priority: 'HIGH',
      categoryId: catComputers.id,
      equipmentId: eqProjector310.id,
      initiatorId: initiator2.id,
      executorId: executor2.id,
    },
  });
  await prisma.ticketPart.create({
    data: {
      ticketId: ticket3.id,
      nomenclatureId: nomLamp.id,
      requiredQuantity: 1,
      price: nomLamp.price,
      isApproved: false,
      fulfilledFromStock: false,
    },
  });
  await prisma.ticketHistory.createMany({
    data: [
      { ticketId: ticket3.id, changedById: initiator2.id, oldStatus: null, newStatus: 'NEW', comment: 'Заявка создана' },
      { ticketId: ticket3.id, changedById: executor2.id, oldStatus: 'NEW', newStatus: 'IN_PROGRESS', comment: 'Подтверждена неисправность лампы' },
      { ticketId: ticket3.id, changedById: executor2.id, oldStatus: 'IN_PROGRESS', newStatus: 'WAITING_FOR_PURCHASE', comment: 'Лампы нет на складе, требуется закупка' },
    ],
  });

  // 4. Завершённая заявка
  const ticket4 = await prisma.ticket.create({
    data: {
      description: 'Замена картриджа в принтере деканата',
      room: 'Деканат',
      building: 1,
      status: 'COMPLETED',
      priority: 'LOW',
      categoryId: catOffice.id,
      equipmentId: eqPrinterDekanat.id,
      initiatorId: manager.id,
      executorId: executor1.id,
    },
  });
  await prisma.ticketPart.create({
    data: {
      ticketId: ticket4.id,
      nomenclatureId: nomToner.id,
      requiredQuantity: 1,
      price: nomToner.price,
      isApproved: true,
      fulfilledFromStock: true,
    },
  });
  await prisma.stockWriteOff.create({
    data: {
      ticketId: ticket4.id,
      nomenclatureId: nomToner.id,
      warehouseId: warehouse1.id,
      quantity: 1,
      price: nomToner.price,
      writtenOffById: executor1.id,
    },
  });
  await prisma.inventory.update({
    where: { warehouseId_nomenclatureId: { warehouseId: warehouse1.id, nomenclatureId: nomToner.id } },
    data: { quantity: { decrement: 1 } },
  });
  await prisma.ticketHistory.createMany({
    data: [
      { ticketId: ticket4.id, changedById: manager.id, oldStatus: null, newStatus: 'NEW', comment: 'Заявка создана' },
      { ticketId: ticket4.id, changedById: executor1.id, oldStatus: 'NEW', newStatus: 'IN_PROGRESS', comment: 'Картридж заменён' },
      { ticketId: ticket4.id, changedById: executor1.id, oldStatus: 'IN_PROGRESS', newStatus: 'COMPLETED', comment: 'Заявка выполнена' },
    ],
  });

  // 5. Отменённая заявка
  const ticket5 = await prisma.ticket.create({
    data: {
      description: 'Прошу установить стороннюю программу на рабочий компьютер',
      room: '102',
      building: 1,
      status: 'CANCELED',
      priority: 'NORMAL',
      categoryId: catOther.id,
      initiatorId: initiator2.id,
    },
  });
  await prisma.ticketHistory.createMany({
    data: [
      { ticketId: ticket5.id, changedById: initiator2.id, oldStatus: null, newStatus: 'NEW', comment: 'Заявка создана' },
      { ticketId: ticket5.id, changedById: manager.id, oldStatus: 'NEW', newStatus: 'CANCELED', comment: 'Отклонено: установка ПО не согласована с ИТ-отделом' },
    ],
  });

  console.log('Готово!');
  console.log('');
  console.log('Тестовые пользователи (пароль для всех: password123):');
  console.log('  manager     - роль MANAGER (Руководитель отдела)');
  console.log('  executor1   - роль EXECUTOR (Техник, корпус 1)');
  console.log('  executor2   - роль EXECUTOR (Системный администратор, корпус 2)');
  console.log('  executor3   - роль EXECUTOR (Специалист 1С, оба корпуса)');
  console.log('  initiator1  - роль INITIATOR (корпус 1)');
  console.log('  initiator2  - роль INITIATOR (корпус 2)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
