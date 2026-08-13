/**
 * PRISM Hardware & Network Guard — Linux agent script.
 * Collects the same categories as the macOS agent (CPU, USB/block devices,
 * network) using standard Linux CLI tools. Read-only, single-shot.
 */
export function buildLinuxAgentScript(baseUrl: string, code: string): string {
  return `#!/bin/bash
# PRISM Hardware & Network Guard agent — Linux edition (read-only, one-shot).
set -u

if [ "$(uname -s)" != "Linux" ]; then
  echo "PRISM Guard: this script is for Linux. On macOS, use the command shown in the PRISM app."
  exit 1
fi

echo "PRISM Guard: reading hardware and network info (read-only, takes a few seconds)..."

b64() { base64 -w 0 2>/dev/null || base64; }
grab() { ( "$@" 2>&1 || true ) | b64; }

HOSTNAME_B64=$(grab hostname)
CPUINFO_B64=$(grab cat /proc/cpuinfo)
MEMINFO_B64=$(grab cat /proc/meminfo)
UPTIME_B64=$(grab uptime)
LSUSB_B64=$(grab lsusb -v 2>/dev/null || lsusb)
LSBLK_B64=$(grab lsblk -J -o NAME,SIZE,TYPE,TRAN,VENDOR,MODEL,SERIAL,MOUNTPOINT)
LSPCI_B64=$(grab lspci 2>/dev/null || true)
IFCONFIG_B64=$(grab ip -j addr show 2>/dev/null || ip addr show)
IWCONFIG_B64=$(grab iwconfig 2>/dev/null || true)
ROUTES_B64=$(grab ip route 2>/dev/null || route)
ARP_B64=$(grab arp -n 2>/dev/null || ip neigh)
UNAME_B64=$(grab uname -a)
THERMAL_B64=$(grab cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null || true)

echo "PRISM Guard: sending results to PRISM..."
RESP_FILE=\$(mktemp -t prism_guard_resp) || exit 1
trap 'rm -f "\$RESP_FILE"' EXIT
HTTP_CODE=\$(/usr/bin/curl -s -o "\$RESP_FILE" -w "%{http_code}" \\
  -X POST "${baseUrl}/api/guard/ingest" \\
  -H "Content-Type: application/json" \\
  --data @- <<PAYLOAD
{
  "pairingCode": "${code}",
  "os": "linux",
  "raw": {
    "hostname": "\$HOSTNAME_B64",
    "cpuinfo": "\$CPUINFO_B64",
    "meminfo": "\$MEMINFO_B64",
    "uptime": "\$UPTIME_B64",
    "lsusb": "\$LSUSB_B64",
    "lsblk": "\$LSBLK_B64",
    "lspci": "\$LSPCI_B64",
    "ifconfig": "\$IFCONFIG_B64",
    "iwconfig": "\$IWCONFIG_B64",
    "routes": "\$ROUTES_B64",
    "arp": "\$ARP_B64",
    "uname": "\$UNAME_B64",
    "thermal": "\$THERMAL_B64"
  }
}
PAYLOAD
)

if [ "\$HTTP_CODE" = "200" ]; then
  echo "PRISM Guard: done — switch back to the PRISM tab to see your results."
else
  echo "PRISM Guard: upload failed (HTTP \$HTTP_CODE). The pairing code may have expired."
  cat "\$RESP_FILE" 2>/dev/null
fi
`;
}
