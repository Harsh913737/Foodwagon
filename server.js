import express from 'express';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_DIR = './auth_session';

const HOSTINGER_API = process.env.HOSTINGER_API || 'https://admin.foodwagon.in/api/wa_session';
const WA_SECRET = process.env.WA_SECRET || 'FoodWagon_WA_Secret_2026';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let sock = null;
let isConnected = false;
let currentQr = null;
let currentQrImage = null;
let backupTimeout = null;

// Restore saved session from Hostinger cloud on startup
async function restoreSessionFromHostinger() {
  try {
    if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
      console.log('[Cloud Session] Local session files found.');
      return true;
    }

    console.log('[Cloud Session] Checking Hostinger for saved WhatsApp session...');
    const resp = await fetch(`${HOSTINGER_API}/restore?secret=${WA_SECRET}`);
    if (!resp.ok) {
      console.log('[Cloud Session] No previous session found on Hostinger. New QR required.');
      return false;
    }

    const files = await resp.json();
    if (!files || typeof files !== 'object' || Object.keys(files).length === 0) {
      console.log('[Cloud Session] Empty session received.');
      return false;
    }

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    for (const [filename, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(AUTH_DIR, filename), content, 'utf-8');
    }

    console.log(`[Cloud Session] Successfully restored ${Object.keys(files).length} session files from Hostinger!`);
    return true;
  } catch (err) {
    console.warn('[Cloud Session] Error restoring session:', err.message);
    return false;
  }
}

// Backup session files to Hostinger
function scheduleBackup() {
  if (backupTimeout) clearTimeout(backupTimeout);
  backupTimeout = setTimeout(async () => {
    try {
      if (!fs.existsSync(AUTH_DIR)) return;
      const filenames = fs.readdirSync(AUTH_DIR);
      const filesObj = {};
      for (const file of filenames) {
        const fullPath = path.join(AUTH_DIR, file);
        if (fs.statSync(fullPath).isFile()) {
          filesObj[file] = fs.readFileSync(fullPath, 'utf-8');
        }
      }

      if (Object.keys(filesObj).length === 0) return;

      console.log(`[Cloud Session] Backing up ${Object.keys(filesObj).length} session files to Hostinger...`);
      const resp = await fetch(`${HOSTINGER_API}/backup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-WA-SECRET': WA_SECRET
        },
        body: JSON.stringify({ session_data: filesObj, secret: WA_SECRET })
      });
      const data = await resp.json();
      console.log('[Cloud Session] Backup response:', data.message || 'Saved');
    } catch (err) {
      console.error('[Cloud Session] Backup failed:', err.message);
    }
  }, 2500);
}

async function startWhatsApp() {
  await restoreSessionFromHostinger();

  if (!fs.existsSync(AUTH_DIR)) {
    fs.mkdirSync(AUTH_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    browser: ['Food Wagon Cloud', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', () => {
    saveCreds();
    scheduleBackup();
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQr = qr;
      try {
        currentQrImage = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
      } catch (err) {
        console.error('Error creating QR image:', err);
      }
      console.log('\n======================================================');
      console.log('NEW QR CODE GENERATED - SCAN VIA BROWSER');
      console.log('======================================================\n');
    }

    if (connection === 'close') {
      isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[WhatsApp] Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startWhatsApp, 3000);
      } else {
        console.log('[WhatsApp] Logged out. Clearing local session...');
        try {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        } catch (e) {}
        setTimeout(startWhatsApp, 2000);
      }
    } else if (connection === 'open') {
      isConnected = true;
      currentQr = null;
      currentQrImage = null;
      console.log('\n======================================================');
      console.log('>>> WHATSAPP GATEWAY ONLINE & READY (24/7) <<<');
      console.log('======================================================\n');
      scheduleBackup();
    }
  });
}

// Send OTP endpoint
const handleSendOtp = async (req, res) => {
  const phone = req.body?.phone || req.query?.phone || req.body?.mobile || req.query?.mobile;
  const otp = req.body?.otp || req.query?.otp;
  const customMessage = req.body?.message || req.query?.message;

  if (!phone) {
    return res.status(400).json({ status: 0, message: 'Phone number is required' });
  }

  let cleanPhone = phone.toString().replace(/\D/g, '');
  if (cleanPhone.length === 10) {
    cleanPhone = '91' + cleanPhone;
  }

  const jid = `${cleanPhone}@s.whatsapp.net`;
  const messageText = customMessage || `Your Food Wagon verification code is: ${otp}. Valid for 10 minutes. Please do not share this OTP with anyone.`;

  console.log(`[WhatsApp Gateway] Dispatching OTP to ${cleanPhone}: "${messageText}"`);

  if (!isConnected || !sock) {
    console.warn('[WhatsApp Gateway] WhatsApp is not connected yet! Please scan QR code.');
    return res.status(503).json({
      status: 0,
      message: 'WhatsApp Gateway not linked yet. Scan QR code in browser.',
      cleanPhone,
      otp
    });
  }

  try {
    const result = await sock.sendMessage(jid, { text: messageText });
    console.log(`[WhatsApp Gateway] Successfully sent OTP to ${cleanPhone}`);
    return res.json({
      status: 1,
      message: 'OTP sent successfully via WhatsApp!',
      phone: cleanPhone,
      messageId: result?.key?.id
    });
  } catch (error) {
    console.error(`[WhatsApp Gateway] Error sending to ${cleanPhone}:`, error);
    return res.status(500).json({
      status: 0,
      message: 'Failed to send WhatsApp message',
      error: error.message
    });
  }
};

app.post('/send-otp', handleSendOtp);
app.get('/send-otp', handleSendOtp);
app.post('/send-message', handleSendOtp);

app.get('/status', (req, res) => {
  res.json({
    status: isConnected ? 1 : 0,
    connected: isConnected,
    qrRequired: !isConnected && !!currentQrImage,
    sender: '8879511519'
  });
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  let content = '';
  if (isConnected) {
    content = `
      <div style="background: #e8f5e9; border: 2px solid #4caf50; padding: 30px; border-radius: 12px; display: inline-block; max-width: 500px;">
        <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
        <h2 style="color: #2e7d32; margin: 0 0 10px 0;">WhatsApp Gateway Connected!</h2>
        <p style="font-size: 18px; color: #1b5e20; margin: 5px 0;">Sender: <strong>+91 8879511519</strong></p>
        <p style="color: #388e3c; font-size: 14px; margin-top: 15px;">
          Running 24/7 in the cloud on Render.<br>
          Your PC is NOT needed. All OTPs from App & Website are sent automatically.
        </p>
      </div>
    `;
  } else if (currentQrImage) {
    content = `
      <div style="background: #fff; border: 2px solid #ff9800; padding: 25px; border-radius: 12px; display: inline-block; max-width: 500px; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
        <h2 style="color: #e65100; margin-top: 0;">Scan QR Code to Link WhatsApp</h2>
        <p style="font-size: 15px; color: #555; margin-bottom: 15px;">
          Open WhatsApp on <strong>8879511519</strong><br>
          Tap <strong>Settings / 3 Dots</strong> &gt; <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong>
        </p>
        <div style="margin: 15px auto;">
          <img src="${currentQrImage}" alt="Scan QR Code" style="width: 280px; height: 280px; border-radius: 8px; border: 1px solid #ddd;" />
        </div>
        <p style="color: #888; font-size: 12px;">This page auto-refreshes every 4 seconds...</p>
      </div>
      <script>
        setTimeout(() => { location.reload(); }, 4000);
      </script>
    `;
  } else {
    content = `
      <div style="background: #e3f2fd; border: 2px solid #2196f3; padding: 25px; border-radius: 12px; display: inline-block; max-width: 500px;">
        <h2 style="color: #0d47a1; margin-top:0;">Initializing Cloud WhatsApp Gateway...</h2>
        <p style="color: #1565c0;">Generating WhatsApp QR code, please wait 5-10 seconds...</p>
      </div>
      <script>
        setTimeout(() => { location.reload(); }, 3000);
      </script>
    `;
  }

  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Food Wagon - Cloud WhatsApp Gateway</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; padding: 40px 15px; background: #f8fafc; color: #333; }
          h1 { color: #f97316; margin-bottom: 4px; }
          .subtitle { color: #64748b; margin-bottom: 25px; font-size: 15px; }
        </style>
      </head>
      <body>
        <h1>Food Wagon</h1>
        <div class="subtitle">Cloud WhatsApp OTP Gateway (Render 24/7)</div>
        ${content}
      </body>
    </html>
  `);
});

// Self-ping to keep Render awake 24/7
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
if (RENDER_EXTERNAL_URL) {
  console.log(`[Self-Ping] Enabling 24/7 keep-alive for ${RENDER_EXTERNAL_URL}`);
  setInterval(() => {
    fetch(`${RENDER_EXTERNAL_URL}/health`).catch(() => {});
  }, 8 * 60 * 1000); // Ping every 8 minutes
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Food Wagon WhatsApp Gateway running on port ${PORT}`);
  startWhatsApp();
});
