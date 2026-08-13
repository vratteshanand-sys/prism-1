/**
 * PRISM Hardware & Network Guard — Windows PowerShell agent.
 * Collects hardware and network telemetry using standard Windows CLI.
 * Read-only, single-shot. Requires PowerShell 5+ (built into Windows 10+).
 */
export function buildWindowsAgentScript(baseUrl: string, code: string): string {
  return `# PRISM Hardware & Network Guard agent — Windows edition (read-only, one-shot).
# Run in PowerShell as your normal user. No administrator rights needed.
# You can read this script before running it — nothing is installed or modified.
$ErrorActionPreference = "SilentlyContinue"

function Encode-B64($text) {
  [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($text))
}
function Grab($cmd) {
  try { Encode-B64((& powershell -Command $cmd 2>&1 | Out-String)) } catch { Encode-B64("") }
}

Write-Host "PRISM Guard: reading hardware and network info (read-only)..."

$hostname = Encode-B64($env:COMPUTERNAME)
$sysinfo  = Grab "Get-ComputerInfo | Select-Object CsName,OsName,OsVersion,CsProcessors,CsPhyicallyInstalledMemory | ConvertTo-Json"
$cpu      = Grab "Get-WmiObject Win32_Processor | Select-Object Name,NumberOfCores,LoadPercentage | ConvertTo-Json"
$mem      = Grab "Get-WmiObject Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory | ConvertTo-Json"
$usb      = Grab "Get-PnpDevice -PresentOnly | Where-Object {\\$_.Class -eq 'USB' -or \\$_.Class -eq 'DiskDrive' -or \\$_.Class -eq 'WPD'} | Select-Object FriendlyName,Class,InstanceId | ConvertTo-Json"
$disk     = Grab "Get-WmiObject Win32_LogicalDisk | Select-Object DeviceID,DriveType,Size,FreeSpace,VolumeName | ConvertTo-Json"
$net      = Grab "Get-NetAdapter | Where-Object Status -eq Up | Select-Object Name,InterfaceDescription,LinkSpeed,MediaType | ConvertTo-Json"
$wifi     = Grab "(netsh wlan show interfaces) 2>&1"
$routes   = Grab "Get-NetRoute | Where-Object DestinationPrefix -eq '0.0.0.0/0' | Select-Object DestinationPrefix,NextHop,InterfaceAlias | ConvertTo-Json"
$arp      = Grab "Get-NetNeighbor | Where-Object State -ne Unreachable | Select-Object IPAddress,LinkLayerAddress,State | ConvertTo-Json"
$uptime   = Grab "(Get-Date) - (Get-CimInstance -ClassName Win32_OperatingSystem).LastBootUpTime | Select-Object Days,Hours,Minutes | ConvertTo-Json"
$uname    = Encode-B64([System.Environment]::OSVersion.VersionString)

Write-Host "PRISM Guard: sending results to PRISM..."

$body = [PSCustomObject]@{
  pairingCode = "${code}"
  os = "windows"
  raw = [PSCustomObject]@{
    hostname = $hostname; sysinfo = $sysinfo; cpu = $cpu; mem = $mem
    usb = $usb; disk = $disk; net = $net; wifi = $wifi; routes = $routes
    arp = $arp; uptime = $uptime; uname = $uname
  }
} | ConvertTo-Json -Depth 10

try {
  $resp = Invoke-RestMethod -Method POST -Uri "${baseUrl}/api/guard/ingest" \`
    -ContentType "application/json" -Body $body
  Write-Host "PRISM Guard: done — switch back to the PRISM tab to see your results."
} catch {
  Write-Host ("PRISM Guard: upload failed — " + $_.Exception.Message)
  Write-Host "The pairing code may have expired. Get a fresh command from the Guard page."
}
`;
}
