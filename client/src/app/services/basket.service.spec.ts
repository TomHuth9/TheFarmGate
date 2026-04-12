import { TestBed } from '@angular/core/testing';
import { BasketService } from './basket.service';
import { Product } from '../models/product.model';

const mockProduct = (overrides: Partial<Product> = {}): Product => ({
  _id: '1',
  name: 'Test Milk',
  description: 'Desc',
  price: 1.50,
  category: 'Dairy',
  imageUrl: '',
  unit: 'per litre',
  stock: 100,
  featured: false,
  ...overrides,
});

describe('BasketService', () => {
  let service: BasketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BasketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('starts with an empty basket', () => {
    expect(service.items()).toEqual([]);
    expect(service.itemCount()).toBe(0);
    expect(service.total()).toBe(0);
  });

  describe('add()', () => {
    it('adds a new item to the basket', () => {
      service.add(mockProduct());
      expect(service.items()).toHaveSize(1);
      expect(service.items()[0].quantity).toBe(1);
    });

    it('increments quantity when the same product is added again', () => {
      service.add(mockProduct());
      service.add(mockProduct());
      expect(service.items()).toHaveSize(1);
      expect(service.items()[0].quantity).toBe(2);
    });

    it('adds a specified quantity', () => {
      service.add(mockProduct(), 3);
      expect(service.items()[0].quantity).toBe(3);
    });

    it('keeps separate items for different products', () => {
      service.add(mockProduct({ _id: '1' }));
      service.add(mockProduct({ _id: '2', name: 'Steak' }));
      expect(service.items()).toHaveSize(2);
    });
  });

  describe('remove()', () => {
    it('removes an item from the basket', () => {
      service.add(mockProduct({ _id: '1' }));
      service.add(mockProduct({ _id: '2', name: 'Eggs' }));
      service.remove('1');
      expect(service.items()).toHaveSize(1);
      expect(service.items()[0].product._id).toBe('2');
    });

    it('does nothing when the id does not exist', () => {
      service.add(mockProduct());
      service.remove('nonexistent');
      expect(service.items()).toHaveSize(1);
    });
  });

  describe('updateQuantity()', () => {
    it('updates the quantity of an existing item', () => {
      service.add(mockProduct());
      service.updateQuantity('1', 5);
      expect(service.items()[0].quantity).toBe(5);
    });

    it('removes the item when quantity is set to 0', () => {
      service.add(mockProduct());
      service.updateQuantity('1', 0);
      expect(service.items()).toHaveSize(0);
    });

    it('removes the item when quantity is negative', () => {
      service.add(mockProduct());
      service.updateQuantity('1', -1);
      expect(service.items()).toHaveSize(0);
    });
  });

  describe('clear()', () => {
    it('empties the basket', () => {
      service.add(mockProduct({ _id: '1' }));
      service.add(mockProduct({ _id: '2', name: 'Eggs' }));
      service.clear();
      expect(service.items()).toHaveSize(0);
    });
  });

  describe('computed signals', () => {
    it('itemCount reflects total number of items across all lines', () => {
      service.add(mockProduct({ _id: '1' }), 2);
      service.add(mockProduct({ _id: '2', name: 'Eggs' }), 3);
      expect(service.itemCount()).toBe(5);
    });

    it('total reflects the sum of price × quantity for all lines', () => {
      service.add(mockProduct({ _id: '1', price: 2.00 }), 3); // 6.00
      service.add(mockProduct({ _id: '2', name: 'Eggs', price: 1.50 }), 2); // 3.00
      expect(service.total()).toBeCloseTo(9.00);
    });

    it('updates total after removing an item', () => {
      service.add(mockProduct({ _id: '1', price: 5.00 }), 2);
      service.remove('1');
      expect(service.total()).toBe(0);
    });
  });
});
