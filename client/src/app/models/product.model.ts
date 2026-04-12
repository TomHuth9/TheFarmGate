export interface FarmRef {
  _id: string;
  farmName: string;
  farmLocation?: string;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: 'Dairy' | 'Beef' | 'Pork' | 'Vegetables' | 'Eggs' | 'Poultry';
  imageUrl: string;
  unit: string;
  stock: number;
  featured: boolean;
  farm?: FarmRef | null;
}
