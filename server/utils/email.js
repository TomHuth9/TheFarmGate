const nodemailer = require('nodemailer');

const FROM = process.env.EMAIL_FROM || 'The Farm Gate <noreply@thefarmgate.co.uk>';
const APP_URL = process.env.CLIENT_ORIGIN || 'http://localhost:4200';

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
}

function gbp(amount) {
  return `£${Number(amount).toFixed(2)}`;
}

function formatAddress(addr) {
  return [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean).join(', ');
}

function shortId(id) {
  return String(id).slice(-8).toUpperCase();
}

// ─── Shared layout wrapper ────────────────────────────────────────────────────

function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f9f5ef;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5ef;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e8e0d4;">
        <!-- Header -->
        <tr>
          <td style="background:#1f4f29;padding:28px 40px;">
            <p style="margin:0;font-family:Georgia,serif;font-size:22px;color:#f9f5ef;letter-spacing:0.02em;">
              🌿 The Farm Gate
            </p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;color:#333;font-size:15px;line-height:1.7;">
            ${bodyHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f9f5ef;padding:20px 40px;border-top:1px solid #e8e0d4;">
            <p style="margin:0;font-size:12px;color:#888;">
              The Farm Gate &mdash; connecting communities with local farms.<br>
              Questions? Reply to this email or visit <a href="${APP_URL}" style="color:#1f4f29;">${APP_URL}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Items table ──────────────────────────────────────────────────────────────

function itemsTable(items) {
  const rows = items.map(i => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e8e0d4;">${i.name}</td>
      <td style="padding:10px 12px;text-align:center;border-bottom:1px solid #e8e0d4;">${i.quantity}</td>
      <td style="padding:10px 12px;text-align:right;border-bottom:1px solid #e8e0d4;">${gbp(i.price * i.quantity)}</td>
    </tr>`).join('');

  return `
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border-collapse:collapse;margin:20px 0;font-size:14px;">
      <tr style="background:#f9f5ef;">
        <th style="padding:10px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e8e0d4;">Item</th>
        <th style="padding:10px 12px;text-align:center;font-weight:600;border-bottom:2px solid #e8e0d4;">Qty</th>
        <th style="padding:10px 12px;text-align:right;font-weight:600;border-bottom:2px solid #e8e0d4;">Price</th>
      </tr>
      ${rows}
    </table>`;
}

function ctaButton(href, label) {
  return `<p style="margin:28px 0 0;">
    <a href="${href}"
       style="display:inline-block;padding:12px 28px;background:#1f4f29;color:#fff;
              border-radius:6px;text-decoration:none;font-family:Georgia,serif;font-size:15px;">
      ${label}
    </a>
  </p>`;
}

// ─── sendPasswordReset ────────────────────────────────────────────────────────

async function sendPasswordReset(toEmail, resetUrl) {
  if (!process.env.EMAIL_HOST) {
    console.log(`\n[Password Reset] Link for ${toEmail}:\n${resetUrl}\n`);
    return;
  }

  const html = layout('Reset your Farm Gate password', `
    <p>You requested a password reset.</p>
    <p>Click the button below to set a new password.
       This link expires in <strong>1 hour</strong>.</p>
    ${ctaButton(resetUrl, 'Reset Password')}
    <p style="margin-top:24px;font-size:13px;color:#888;">
      If you did not request this, you can safely ignore this email.
    </p>
  `);

  await createTransporter().sendMail({
    from: FROM,
    to: toEmail,
    subject: 'Reset your Farm Gate password',
    text: `You requested a password reset.\n\nClick the link below to set a new password (expires in 1 hour):\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html,
  });
}

// ─── sendOrderConfirmation ────────────────────────────────────────────────────
// user: { name, email }   order: Order document

async function sendOrderConfirmation(user, order) {
  const id = shortId(order._id);
  const subject = `Your Farm Gate order has been received – #${id}`;

  if (!process.env.EMAIL_HOST) {
    console.log(`\n[Order Confirmation] Sending to ${user.email} for order #${id}`);
    console.log(`  Items: ${order.items.map(i => `${i.name} x${i.quantity}`).join(', ')}`);
    console.log(`  Total: ${gbp(order.total)}\n`);
    return;
  }

  const addrText = formatAddress(order.deliveryAddress);
  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:#1f4f29;font-size:20px;">Order received!</h2>
    <p>Hi ${user.name},</p>
    <p>Thank you for your order. We've passed it on to the farm and will keep you updated.</p>
    <p style="margin:4px 0;"><strong>Order reference:</strong> #${id}</p>
    ${itemsTable(order.items)}
    <p style="text-align:right;font-size:16px;font-weight:bold;color:#1f4f29;margin:0 0 24px;">
      Total: ${gbp(order.total)}
    </p>
    <p><strong>Delivering to:</strong><br>${addrText}</p>
    ${ctaButton(`${APP_URL}/my-orders`, 'View My Orders')}
  `);

  const text = [
    `Hi ${user.name},`,
    ``,
    `Your Farm Gate order #${id} has been received.`,
    ``,
    `Items:`,
    ...order.items.map(i => `  ${i.name} x${i.quantity}  ${gbp(i.price * i.quantity)}`),
    ``,
    `Total: ${gbp(order.total)}`,
    ``,
    `Delivering to: ${addrText}`,
    ``,
    `View your orders: ${APP_URL}/my-orders`,
  ].join('\n');

  await createTransporter().sendMail({ from: FROM, to: user.email, subject, text, html });
}

// ─── sendOrderReceived ────────────────────────────────────────────────────────
// farmUser: { name, email, farmName }   farmItems: subset of order.items for this farm

async function sendOrderReceived(farmUser, farmItems, order) {
  const id = shortId(order._id);
  const farmName = farmUser.farmName || farmUser.name;
  const subject = `New order on The Farm Gate – #${id}`;

  if (!process.env.EMAIL_HOST) {
    console.log(`\n[Order Received] Sending to ${farmUser.email} (${farmName}) for order #${id}`);
    console.log(`  Items: ${farmItems.map(i => `${i.name} x${i.quantity}`).join(', ')}\n`);
    return;
  }

  const addrText = formatAddress(order.deliveryAddress);
  const farmTotal = farmItems.reduce((s, i) => s + i.price * i.quantity, 0);

  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:#1f4f29;font-size:20px;">You have a new order!</h2>
    <p>Hi ${farmName},</p>
    <p>A customer has placed an order for your products. Please log in to confirm it.</p>
    <p style="margin:4px 0;"><strong>Order reference:</strong> #${id}</p>
    ${itemsTable(farmItems)}
    <p style="text-align:right;font-size:16px;font-weight:bold;color:#1f4f29;margin:0 0 24px;">
      Your items total: ${gbp(farmTotal)}
    </p>
    <p><strong>Deliver to:</strong><br>${addrText}</p>
    ${ctaButton(`${APP_URL}/farm-dashboard`, 'Go to My Dashboard')}
  `);

  const text = [
    `Hi ${farmName},`,
    ``,
    `You have a new order on The Farm Gate! Order reference: #${id}`,
    ``,
    `Items:`,
    ...farmItems.map(i => `  ${i.name} x${i.quantity}  ${gbp(i.price * i.quantity)}`),
    ``,
    `Your items total: ${gbp(farmTotal)}`,
    ``,
    `Deliver to: ${addrText}`,
    ``,
    `Log in to confirm: ${APP_URL}/farm-dashboard`,
  ].join('\n');

  await createTransporter().sendMail({ from: FROM, to: farmUser.email, subject, text, html });
}

// ─── sendStatusUpdate ─────────────────────────────────────────────────────────
// user: { name, email }   order: Order document (with updated status)

const STATUS_DESCRIPTIONS = {
  confirmed:  'The farm has received your order and is preparing it.',
  dispatched: 'Your order is on its way!',
  delivered:  'Your order has been delivered. We hope you enjoy your produce!',
  cancelled:  'Your order has been cancelled. If you have questions, please reply to this email.',
};

async function sendStatusUpdate(user, order) {
  const id = shortId(order._id);
  const statusLabel = order.status.charAt(0).toUpperCase() + order.status.slice(1);
  const description = STATUS_DESCRIPTIONS[order.status] ?? `Your order status is now: ${order.status}.`;
  const subject = `Your Farm Gate order has been updated – #${id}`;

  if (!process.env.EMAIL_HOST) {
    console.log(`\n[Status Update] Sending to ${user.email} — order #${id} is now ${order.status}\n`);
    return;
  }

  const html = layout(subject, `
    <h2 style="margin:0 0 16px;color:#1f4f29;font-size:20px;">Order update</h2>
    <p>Hi ${user.name},</p>
    <p>Your order <strong>#${id}</strong> has been updated.</p>
    <table width="100%" cellpadding="0" cellspacing="0"
           style="border-collapse:collapse;margin:20px 0;">
      <tr>
        <td style="background:#f9f5ef;padding:20px 24px;border-radius:8px;border:1px solid #e8e0d4;">
          <p style="margin:0 0 4px;font-size:13px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">
            New Status
          </p>
          <p style="margin:0;font-size:20px;font-weight:bold;color:#1f4f29;">${statusLabel}</p>
          <p style="margin:8px 0 0;font-size:14px;color:#555;">${description}</p>
        </td>
      </tr>
    </table>
    ${ctaButton(`${APP_URL}/my-orders`, 'View My Orders')}
  `);

  const text = [
    `Hi ${user.name},`,
    ``,
    `Your Farm Gate order #${id} has been updated.`,
    ``,
    `New status: ${statusLabel}`,
    description,
    ``,
    `View your orders: ${APP_URL}/my-orders`,
  ].join('\n');

  await createTransporter().sendMail({ from: FROM, to: user.email, subject, text, html });
}

module.exports = { sendPasswordReset, sendOrderConfirmation, sendOrderReceived, sendStatusUpdate };
