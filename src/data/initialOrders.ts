import { Order, OrderStatus } from '../types';
import { INITIAL_MENU_ITEMS } from './initialMenu';

/**
 * Generates realistic seed orders for initial application launch,
 * ensuring rich analytics and charts on Cloudflare Pages or any environment.
 */
export function getInitialSeedOrders(): Order[] {
  const sampleNames = [
    'امیرحسین',
    'سارا رضایی',
    'نیما کاظمی',
    'مریم حسینی',
    'پویا شمس',
    'نگین احمدی',
    'علی مرادی',
    'روژان ناصری',
  ];
  const now = new Date();
  const orders: Order[] = [];

  // Generate 24 realistic orders distributed over past hours/days
  for (let i = 1; i <= 24; i++) {
    // Stagger hours backwards over the last 3-4 days
    const hoursAgo = (25 - i) * 3 + (i % 3);
    const orderDate = new Date(now.getTime() - hoursAgo * 3600 * 1000);

    const item1 = INITIAL_MENU_ITEMS[i % INITIAL_MENU_ITEMS.length];
    const item2 = INITIAL_MENU_ITEMS[(i + 3) % INITIAL_MENU_ITEMS.length];
    const q1 = (i % 2) + 1;
    const q2 = i % 3 === 0 ? 1 : 0;

    const items = [
      {
        menuItemId: item1.id,
        name: item1.name,
        price: item1.price,
        quantity: q1,
      },
    ];

    if (q2 > 0) {
      items.push({
        menuItemId: item2.id,
        name: item2.name,
        price: item2.price,
        quantity: q2,
      });
    }

    const totalPrice = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
    const isRecent = i >= 21;
    const status: OrderStatus = isRecent
      ? i === 24
        ? 'pending'
        : i === 23
        ? 'preparing'
        : 'ready'
      : 'completed';

    orders.push({
      id: `ord_seed_${1000 + i}`,
      orderNumber: 1000 + i,
      customerName: sampleNames[i % sampleNames.length],
      customerPhone: `0912${Math.floor(1000000 + (i * 354671) % 9000000)}`,
      orderType: i % 4 === 0 ? 'takeaway' : 'dine-in',
      tableNumber: i % 4 === 0 ? undefined : ((i % 8) + 1),
      items,
      totalPrice,
      status,
      createdAt: orderDate.toISOString(),
      updatedAt: new Date(orderDate.getTime() + 15 * 60000).toISOString(),
      notes: i % 5 === 0 ? 'لطفاً نوشیدنی‌ها همزمان سرو شوند' : undefined,
    });
  }

  return orders;
}
