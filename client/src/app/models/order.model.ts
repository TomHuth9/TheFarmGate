export interface OrderItem {
  product: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  _id: string;
  user?: { _id: string; name: string; email: string };
  items: OrderItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled';
  createdAt: string;
  deliveryAddress?: {
    line1: string;
    line2?: string;
    city: string;
    postcode: string;
  };
}
