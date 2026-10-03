import subprocess
import re
import time
import sys
import webbrowser
import paramiko

SSH_HOST = "145.79.212.253"
SSH_PORT = 65002
SSH_USER = "u335891047"
SSH_PASS = "Testing_@121"
DB_NAME = "u335891047_foodwagon"
DB_USER = "u335891047_foodwagon"
DB_PASS = "FoodWagon@Host2026#"

def update_hostinger_gateway_url(tunnel_url):
    print(f"\n[Hostinger Sync] Updating Hostinger server database with URL: {tunnel_url}")
    try:
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect(SSH_HOST, port=SSH_PORT, username=SSH_USER, password=SSH_PASS, timeout=25)
        
        sql = f"INSERT INTO settings (variable, value) VALUES ('whatsapp_gateway_url', '{tunnel_url}') ON DUPLICATE KEY UPDATE value = '{tunnel_url}';"
        cmd = f"""mysql -u {DB_USER} -p'{DB_PASS}' {DB_NAME} -e "{sql}" """
        
        stdin, stdout, stderr = client.exec_command(cmd)
        stdout.read()
        
        # Verify
        verify_cmd = f"""mysql -u {DB_USER} -p'{DB_PASS}' {DB_NAME} -e "SELECT variable, value FROM settings WHERE variable = 'whatsapp_gateway_url';" """
        stdin, stdout, stderr = client.exec_command(verify_cmd)
        result = stdout.read().decode('utf-8', errors='replace')
        print(f"[Hostinger Sync] Database response:\n{result}")
        client.close()
        print("[Hostinger Sync] SUCCESS: Hostinger backend is now linked to this WhatsApp Gateway!\n")
        return True
    except Exception as e:
        print(f"[Hostinger Sync] ERROR updating Hostinger: {e}")
        return False

def main():
    print("=" * 60)
    print("  FOOD WAGON WHATSAPP GATEWAY & CLOUDFLARE SYNC")
    print("=" * 60)
    print("Starting Cloudflare Tunnel to expose http://localhost:3000 to the web...\n")

    cloudflared_path = r"F:\Programs\cloudflared.exe"
    proc = subprocess.Popen(
        [cloudflared_path, "tunnel", "--url", "http://localhost:3000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    tunnel_url = None
    url_pattern = re.compile(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com')

    # Wait for tunnel URL
    for line in proc.stdout:
        print(line, end="")
        match = url_pattern.search(line)
        if match and not tunnel_url:
            tunnel_url = match.group(0)
            print("\n" + "=" * 60)
            print(f">>> DETECTED TUNNEL URL: {tunnel_url} <<<")
            print("=" * 60)
            update_hostinger_gateway_url(tunnel_url)
            print("Opening browser for easy QR scanning...")
            try:
                webbrowser.open("http://localhost:3000")
            except:
                pass
            print("Tunnel is live! Keep this window open while testing OTP.")
            break

    proc.wait()

if __name__ == "__main__":
    main()
