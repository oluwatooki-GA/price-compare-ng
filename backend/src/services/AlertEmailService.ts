import nodemailer from 'nodemailer';
import { config } from '../config/env';
import type { AlertJobData } from '../queue/types';
import { logger } from '../config/logger';

export class AlertEmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    if (config.GMAIL_USER && config.GMAIL_APP_PASSWORD) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.GMAIL_USER,
          pass: config.GMAIL_APP_PASSWORD,
        },
      });
    } else {
      logger.warn('Gmail credentials not configured — email alerts disabled');
    }
  }

  async sendPriceAlert(data: AlertJobData): Promise<void> {
    if (!this.transporter) {
      logger.warn({ userEmail: data.userEmail }, 'Skipping alert email — no credentials');
      return;
    }

    const subject = `Price Alert: ${data.productName} is now ${data.currency} ${data.newPrice.toLocaleString()}`;
    const html = this.buildEmailHtml(data);

    await this.transporter.sendMail({
      from: `"PriceCompare NG" <${config.GMAIL_USER}>`,
      to: data.userEmail,
      subject,
      html,
    });

    logger.info({ userEmail: data.userEmail, trackedProductId: data.trackedProductId }, 'Price alert sent');
  }

  private buildEmailHtml(data: AlertJobData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .header { background: #0A0A0A; padding: 24px 32px; }
    .header h1 { color: #1edc6a; margin: 0; font-size: 22px; }
    .body { padding: 32px; }
    .price-box { background: #f0fdf4; border: 2px solid #1edc6a; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .new-price { font-size: 32px; font-weight: 700; color: #1edc6a; }
    .threshold { color: #666; font-size: 14px; margin-top: 4px; }
    .product-name { font-size: 18px; font-weight: 600; color: #111; margin-bottom: 8px; }
    .platform { font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
    .cta { display: inline-block; background: #1edc6a; color: #0A0A0A; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; margin-top: 20px; }
    .footer { background: #f9f9f9; padding: 16px 32px; font-size: 12px; color: #999; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>PriceCompare NG</h1>
    </div>
    <div class="body">
      <p style="color:#444; font-size:15px;">Great news! A product you're tracking has dropped below your alert threshold.</p>
      <p class="product-name">${data.productName}</p>
      <p class="platform">${data.platform}</p>
      <div class="price-box">
        <div class="new-price">${data.currency} ${data.newPrice.toLocaleString()}</div>
        <div class="threshold">Your threshold: ${data.currency} ${data.threshold.toLocaleString()}</div>
      </div>
      <a href="${data.productUrl}" class="cta">View Product →</a>
    </div>
    <div class="footer">
      You received this because you enabled price alerts on PriceCompare NG. Manage your tracked products on your dashboard.
    </div>
  </div>
</body>
</html>`;
  }
}
