/**
 * Generates the PRISM MacBook Deep Scan agent — a single, self-contained,
 * strictly read-only bash script for macOS. It reads real security posture
 * (FileVault, firewall, SIP, Gatekeeper, updates, disk), base64-encodes each
 * raw output, and POSTs one JSON payload back with the one-time pairing
 * code. All interpretation happens server-side.
 */
export function buildDeepAgentScript(baseUrl: string, code: string): string {
  return `#!/bin/bash
# PRISM MacBook Deep Scan agent (read-only, one-shot).
# It runs standard macOS security-status commands, sends the raw text to
# PRISM, and exits. No files are read or uploaded, nothing is installed.
set -u

if [ "$(uname -s)" != "Darwin" ]; then
  echo "PRISM Deep Scan: this agent only supports macOS."
  exit 1
fi

echo "PRISM Deep Scan: reading security settings (read-only, about 30 seconds)..."

b64() { /usr/bin/base64 | /usr/bin/tr -d '\\n'; }
grab() { ( "$@" 2>&1 || true ) | b64; }

HOSTNAME_B64=$(grab /bin/hostname)
SWVERS_B64=$(grab /usr/bin/sw_vers)
FDE_B64=$(grab /usr/bin/fdesetup status)
FW_B64=$(grab /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate)
FWS_B64=$(grab /usr/libexec/ApplicationFirewall/socketfilterfw --getstealthmode)
SPCTL_B64=$(grab /usr/sbin/spctl --status)
CSR_B64=$(grab /usr/bin/csrutil status)
DF_B64=$(grab /bin/df -h /)
UPTIME_B64=$(grab /usr/bin/uptime)
echo "PRISM Deep Scan: asking Apple for pending updates (this is the slow part)..."
SU_B64=$(grab /usr/sbin/softwareupdate -l --no-scan)
if [ -z "$SU_B64" ]; then
  SU_B64=$(grab /usr/sbin/softwareupdate -l)
fi

echo "PRISM Deep Scan: sending results to PRISM..."
RESP_FILE=$(/usr/bin/mktemp -t prism_deep) || exit 1
trap 'rm -f "$RESP_FILE"' EXIT
HTTP_CODE=$(/usr/bin/curl -s -o "$RESP_FILE" -w "%{http_code}" \\
  -X POST "${baseUrl}/api/devicescan/deep-ingest" \\
  -H "Content-Type: application/json" \\
  --data @- <<PAYLOAD
{
  "pairingCode": "${code}",
  "raw": {
    "hostname": "$HOSTNAME_B64",
    "swVers": "$SWVERS_B64",
    "fdesetup": "$FDE_B64",
    "firewall": "$FW_B64",
    "firewallStealth": "$FWS_B64",
    "spctl": "$SPCTL_B64",
    "csrutil": "$CSR_B64",
    "softwareupdate": "$SU_B64",
    "df": "$DF_B64",
    "uptime": "$UPTIME_B64"
  }
}
PAYLOAD
)

if [ "$HTTP_CODE" = "200" ]; then
  echo "PRISM Deep Scan: done — switch back to the PRISM tab to see your results."
else
  echo "PRISM Deep Scan: upload failed (HTTP $HTTP_CODE). The pairing code may have expired — get a fresh command from the Device Scan page and try again."
  cat "$RESP_FILE" 2>/dev/null
fi
`;
}
