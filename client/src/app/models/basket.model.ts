import { Product } from './product.model';

export interface BasketItem {
  product: Product;
  quantity: number;
}
