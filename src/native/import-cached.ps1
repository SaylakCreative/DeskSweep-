# Dot-sourced by the other helpers. Compiling C# with Add-Type costs a few hundred milliseconds
# (more with antivirus), so the compiled assembly is cached per source text and only loaded
# afterwards. Falls back to compiling in memory if the cache is unusable.
function Import-CachedType([string]$Name, [string]$Source) {
  try {
    $sha = [System.Security.Cryptography.SHA1]::Create()
    $hash = [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Source))).Replace('-', '').Substring(0, 12)
    $dir = Join-Path $env:LOCALAPPDATA 'DeskSweep\native'
    $dll = Join-Path $dir "$Name.$hash.dll"

    if (-not (Test-Path -LiteralPath $dll)) {
      New-Item -ItemType Directory -Force -Path $dir | Out-Null
      $tmp = "$dll.$PID.tmp"
      Add-Type -TypeDefinition $Source -OutputAssembly $tmp -OutputType Library
      Move-Item -LiteralPath $tmp -Destination $dll -Force
    }
    Add-Type -Path $dll
  } catch {
    Add-Type -TypeDefinition $Source
  }
}
