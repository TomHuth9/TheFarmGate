jest.mock('nodemailer');

const nodemailer = require('nodemailer');
const { sendOrderConfirmation, sendOrderReceived, sendStatusUpdate } = require('../utils/email');

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });

beforeEach(() => {
  jest.clearAllMocks();
  nodemailer.createTransport.mockReturnValue({ sendMail: mockSendMail });
  delete process.env.EMAIL_HOST;
});

afterEach(() => {
  delete process.env.EMAIL_HOST;
});

const user = { name: 'Alice', email: 'alice@example.com' };
const farmUser = { name: 'Farm Owner', email: 'farm@example.com', farmName: 'Green Acres' };

const order = {
  _id: '000000000000000012345678',
  items: [
    { name: 'Organic Milk', quantity: 2, price: 1.5 },
    { name: 'Free Range Eggs', quantity: 1, price: 2.0 },
  ],
  total: 5.0,
  deliveryAddress: { line1: '1 Farm Road', city: 'London', postcode: 'SW1 1AA' },
  status: 'confirmed',
};

const farmItems = [{ name: 'Organic Milk', quantity: 2, price: 1.5 }];

// ─── sendOrderConfirmation ────────────────────────────────────────────────────

describe('sendOrderConfirmation', () => {
  describe('dev mode (no EMAIL_HOST)', () => {
    it('logs to console and does not call sendMail', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await sendOrderConfirmation(user, order);
      const output = logSpy.mock.calls.flat().join(' ');
      expect(output).toContain('[Order Confirmation]');
      expect(output).toContain('alice@example.com');
      expect(mockSendMail).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('logs the item names', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await sendOrderConfirmation(user, order);
      const output = logSpy.mock.calls.flat().join(' ');
      expect(output).toContain('Organic Milk');
      logSpy.mockRestore();
    });
  });

  describe('production mode (EMAIL_HOST set)', () => {
    beforeEach(() => { process.env.EMAIL_HOST = 'smtp.example.com'; });

    it('calls sendMail with the customer email address', async () => {
      await sendOrderConfirmation(user, order);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'alice@example.com' })
      );
    });

    it('includes the order shortId in the subject', async () => {
      await sendOrderConfirmation(user, order);
      const { subject } = mockSendMail.mock.calls[0][0];
      expect(subject).toContain('12345678');
    });

    it('includes item names and the order total in the HTML', async () => {
      await sendOrderConfirmation(user, order);
      const { html } = mockSendMail.mock.calls[0][0];
      expect(html).toContain('Organic Milk');
      expect(html).toContain('£5.00');
    });

    it('includes the delivery address in the HTML', async () => {
      await sendOrderConfirmation(user, order);
      const { html } = mockSendMail.mock.calls[0][0];
      expect(html).toContain('1 Farm Road');
      expect(html).toContain('London');
    });
  });
});

// ─── sendOrderReceived ────────────────────────────────────────────────────────

describe('sendOrderReceived', () => {
  describe('dev mode (no EMAIL_HOST)', () => {
    it('logs to console and does not call sendMail', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await sendOrderReceived(farmUser, farmItems, order);
      const output = logSpy.mock.calls.flat().join(' ');
      expect(output).toContain('[Order Received]');
      expect(output).toContain('farm@example.com');
      expect(mockSendMail).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe('production mode (EMAIL_HOST set)', () => {
    beforeEach(() => { process.env.EMAIL_HOST = 'smtp.example.com'; });

    it('sends to the farm email address', async () => {
      await sendOrderReceived(farmUser, farmItems, order);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'farm@example.com' })
      );
    });

    it('includes the farm name and item names in the HTML', async () => {
      await sendOrderReceived(farmUser, farmItems, order);
      const { html } = mockSendMail.mock.calls[0][0];
      expect(html).toContain('Green Acres');
      expect(html).toContain('Organic Milk');
    });

    it('includes the delivery address in the HTML', async () => {
      await sendOrderReceived(farmUser, farmItems, order);
      const { html } = mockSendMail.mock.calls[0][0];
      expect(html).toContain('1 Farm Road');
    });

    it('shows the farm subtotal (not the full order total)', async () => {
      await sendOrderReceived(farmUser, farmItems, order);
      const { html } = mockSendMail.mock.calls[0][0];
      // farmItems: Milk x2 @ £1.50 = £3.00
      expect(html).toContain('£3.00');
    });
  });
});

// ─── sendStatusUpdate ─────────────────────────────────────────────────────────

describe('sendStatusUpdate', () => {
  describe('dev mode (no EMAIL_HOST)', () => {
    it('logs to console with the new status and does not call sendMail', async () => {
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      await sendStatusUpdate(user, order);
      const output = logSpy.mock.calls.flat().join(' ');
      expect(output).toContain('[Status Update]');
      expect(output).toContain('alice@example.com');
      expect(output).toContain('confirmed');
      expect(mockSendMail).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe('production mode (EMAIL_HOST set)', () => {
    beforeEach(() => { process.env.EMAIL_HOST = 'smtp.example.com'; });

    it('sends to the customer email address', async () => {
      await sendStatusUpdate(user, order);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'alice@example.com' })
      );
    });

    it('includes the new status label in the HTML body', async () => {
      await sendStatusUpdate(user, order);
      const { html } = mockSendMail.mock.calls[0][0];
      expect(html).toContain('Confirmed');
    });

    it('includes the human-readable status description', async () => {
      await sendStatusUpdate(user, order);
      const { html } = mockSendMail.mock.calls[0][0];
      expect(html).toContain('The farm has received your order');
    });
  });
});
