$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeExe = "C:\Program Files\nodejs\node.exe"
$sshExe = "C:\Windows\System32\OpenSSH\ssh.exe"
$publicUrlFile = Join-Path $projectRoot "public-url.txt"
$serverUrl = "http://localhost:3000/api/health"
$urlSaved = $false

function Test-Server {
    try {
        Invoke-RestMethod -Uri $serverUrl -TimeoutSec 5 | Out-Null
        return $true
    } catch {
        return $false
    }
}

if (-not (Test-Server)) {
    Start-Process -FilePath $nodeExe -ArgumentList "server.js" -WorkingDirectory $projectRoot | Out-Null
    Start-Sleep -Seconds 3
}

Write-Output ""
Write-Output "Starting the public quiz tunnel..."
Write-Output "Keep this window open while your friends are using the site."
Write-Output ""

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tunnelLog = Join-Path ([System.IO.Path]::GetTempPath()) "hmykw-ssh-tunnel-$timestamp.log"

& $sshExe -o StrictHostKeyChecking=no -o ServerAliveInterval=60 -R 80:localhost:3000 nokey@localhost.run 2>&1 |
    Tee-Object -FilePath $tunnelLog |
    ForEach-Object {
        $line = $_.ToString()

        if (-not $urlSaved -and $line -match "tunneled with tls termination, (https://[^\s]+)") {
            $publicUrl = $Matches[1]
            Set-Content -Path $publicUrlFile -Value $publicUrl -Encoding ascii -Force
            Write-Output ""
            Write-Output "Public quiz URL saved to:"
            Write-Output $publicUrlFile
            Write-Output $publicUrl
            Write-Output ""
            $urlSaved = $true
        }

        $line
    }
