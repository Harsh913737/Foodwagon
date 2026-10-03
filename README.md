# Food Wagon - Free 24/7 Cloud WhatsApp Gateway

Free, self-hosted WhatsApp OTP Gateway for Food Wagon built with Baileys and Express.
Runs 24/7 on Render.com free tier with session backup to Hostinger.

## Features
- **Zero Cost**: Runs 100% free on Render.com free tier.
- **24/7 Always Online**: PC does not need to stay on.
- **Session Persistence**: WhatsApp credentials are automatically backed up to your Hostinger database so restarts never log you out.
- **Visual Web QR**: Link your WhatsApp (`8879511519`) easily via your mobile browser.
- **Self-Ping Keep-Alive**: Automatically pings itself to prevent spinning down.

## Deployment on Render.com (2 Minutes)
1. Push this folder to a GitHub repository (e.g. `foodwagon-whatsapp-gateway`).
2. Go to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Web Service**.
4. Connect your GitHub repository.
5. Set:
   - **Name**: `foodwagon-whatsapp-gateway`
   - **Region**: Singapore (closest to India)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
6. Under **Environment Variables**, add:
   - `HOSTINGER_API`: `https://admin.foodwagon.in/api/wa_session`
   - `WA_SECRET`: `FoodWagon_WA_Secret_2026`
7. Click **Deploy Web Service**!
8. Copy your Render URL (e.g. `https://foodwagon-whatsapp-gateway.onrender.com`).
9. Open the URL in your phone browser, scan the QR code using WhatsApp on `8879511519` (**Linked Devices > Link a Device**).
10. Update your Hostinger database `whatsapp_gateway_url` to your Render URL.
