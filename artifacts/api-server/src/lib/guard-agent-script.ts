/**
 * Generates the PRISM Guard Terminal agent — a single, self-contained,
 * strictly read-only bash script for macOS. It collects raw command output,
 * base64-encodes each blob, and POSTs one JSON payload back with the
 * one-time pairing code. All interpretation happens server-side.
 */
export function buildAgentScript(baseUrl: string, code: string): string {
  return `#!/bin/bash
# PRISM Hardware & Network Guard agent (read-only, one-shot).
# It runs standard macOS reporting commands, sends the raw text to PRISM,
# and exits. No files are read or uploaded, nothing is installed.
set -u

if [ "$(uname -s)" != "Darwin" ]; then
  echo "PRISM Guard: this agent only supports macOS."
  exit 1
fi

echo "PRISM Guard: collecting read-only system readings (about 20 seconds)..."

b64() { /usr/bin/base64 | /usr/bin/tr -d '\\n'; }
grab() { ( "$@" 2>/dev/null || true ) | b64; }

HOSTNAME_B64=$(grab /bin/hostname)
SYSCTL_B64=$(grab /usr/sbin/sysctl machdep.cpu.brand_string hw.ncpu hw.memsize vm.loadavg)
TOP_B64=$(grab /usr/bin/top -l 1 -n 0 -s 0)
MEMP_B64=$(grab /usr/bin/memory_pressure -Q)
THERM_B64=$(grab /usr/bin/pmset -g therm)
UPTIME_B64=$(grab /usr/bin/uptime)
echo "PRISM Guard: inventorying connected hardware..."
SPUSB_B64=$(grab /usr/sbin/system_profiler -json SPUSBDataType)
SPTB_B64=$(grab /usr/sbin/system_profiler -json SPThunderboltDataType)
SPSTORAGE_B64=$(grab /usr/sbin/system_profiler -json SPStorageDataType)
SPDISPLAYS_B64=$(grab /usr/sbin/system_profiler -json SPDisplaysDataType)
SPPOWER_B64=$(grab /usr/sbin/system_profiler -json SPPowerDataType)
echo "PRISM Guard: checking network posture..."
SPAIR_B64=$(grab /usr/sbin/system_profiler -json SPAirPortDataType)
NETIF_B64=$( { /sbin/route -n get default 2>/dev/null; /usr/sbin/networksetup -listallhardwareports 2>/dev/null; } | b64 )
ARP_B64=$(grab /usr/sbin/arp -a)

echo "PRISM Guard: sending results to PRISM..."
HTTP_CODE=$(/usr/bin/curl -s -o /tmp/prism_guard_resp.txt -w "%{http_code}" \\
  -X POST "${baseUrl}/api/guard/ingest" \\
  -H "Content-Type: application/json" \\
  --data @- <<PAYLOAD
{
  "pairingCode": "${code}",
  "raw": {
    "hostname": "$HOSTNAME_B64",
    "sysctl": "$SYSCTL_B64",
    "top": "$TOP_B64",
    "memoryPressure": "$MEMP_B64",
    "thermal": "$THERM_B64",
    "uptime": "$UPTIME_B64",
    "spusb": "$SPUSB_B64",
    "spthunderbolt": "$SPTB_B64",
    "spstorage": "$SPSTORAGE_B64",
    "spdisplays": "$SPDISPLAYS_B64",
    "sppower": "$SPPOWER_B64",
    "spairport": "$SPAIR_B64",
    "netif": "$NETIF_B64",
    "arp": "$ARP_B64"
  }
}
PAYLOAD
)

if [ "$HTTP_CODE" = "200" ]; then
  echo "PRISM Guard: done — switch back to the PRISM tab to see your results."
else
  echo "PRISM Guard: upload failed (HTTP $HTTP_CODE). The pairing code may have expired — get a fresh command from the Guard page and try again."
  cat /tmp/prism_guard_resp.txt 2>/dev/null
fi
rm -f /tmp/prism_guard_resp.txt
`;
}
