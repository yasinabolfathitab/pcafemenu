export type CategoryId = 
  | 'hot-coffee'
  | 'cold-coffee'
  | 'milk-chocolate'
  | 'shakes'
  | 'tea-infusions'
  | 'cakes-desserts'
  | 'cookies'
  | 'puffy'
  | 'mocktails'
  | 'food-snacks';

export interface Category {
  id: CategoryId;
  name: string;
  enName: string;
  icon: string;
  badge?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  enName: string;
  category: CategoryId;
  price: number; // in Tomans
  description: string;
  ingredients: string[];
  image: string;
  prepTime: number; // in minutes
  calories?: number;
  isPopular?: boolean;
  isSpecial?: boolean;
  isAvailable: boolean;
  customizationOptions?: {
    milk?: string[];
    sugar?: string[];
    extraShot?: boolean;
    syrup?: string[];
  };
}

export interface CartItemOption {
  milk?: string;
  sugar?: string;
  extraShot?: boolean;
  syrup?: string;
}

export interface CartItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  options?: CartItemOption;
  itemTotal: number;
  specialNote?: string;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone?: string;
  orderType: 'dine-in' | 'takeaway';
  tableNumber?: number | string;
  items: {
    menuItemId: string;
    name: string;
    price: number;
    quantity: number;
    options?: CartItemOption;
    specialNote?: string;
  }[];
  totalPrice: number;
  status: OrderStatus;
  createdAt: string; // ISO string
  updatedAt: string;
  notes?: string;
}

export interface CafeStats {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  activeOrdersCount: number;
  todayRevenue: number;
  todayOrdersCount: number;
  weeklyRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
}
