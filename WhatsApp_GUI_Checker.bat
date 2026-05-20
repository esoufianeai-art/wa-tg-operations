@echo off
setlocal

set "PS1=%TEMP%\whatsapp_gui_checker_%RANDOM%%RANDOM%.ps1"

> "%PS1%" (
  echo Add-Type -AssemblyName System.Windows.Forms
  echo Add-Type -AssemblyName System.Drawing
  echo.
  echo [System.Windows.Forms.Application]::EnableVisualStyles^(^)
  echo.
  echo $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  echo $resultFile = Join-Path ^(Get-Location^) 'whatsapp_results.csv'
  echo.
  echo $form = New-Object System.Windows.Forms.Form
  echo $form.Text = 'WhatsApp GUI Checker'
  echo $form.StartPosition = 'CenterScreen'
  echo $form.Size = New-Object System.Drawing.Size^(560, 310^)
  echo $form.FormBorderStyle = 'FixedDialog'
  echo $form.MaximizeBox = $false
  echo.
  echo $label = New-Object System.Windows.Forms.Label
  echo $label.Text = 'Phone number with country code:'
  echo $label.Location = New-Object System.Drawing.Point^(18, 18^)
  echo $label.Size = New-Object System.Drawing.Size^(500, 22^)
  echo $form.Controls.Add^($label^)
  echo.
  echo $input = New-Object System.Windows.Forms.TextBox
  echo $input.Location = New-Object System.Drawing.Point^(18, 45^)
  echo $input.Size = New-Object System.Drawing.Size^(500, 24^)
  echo $input.Text = '32456942784'
  echo $form.Controls.Add^($input^)
  echo.
  echo $status = New-Object System.Windows.Forms.Label
  echo $status.Location = New-Object System.Drawing.Point^(18, 82^)
  echo $status.Size = New-Object System.Drawing.Size^(500, 58^)
  echo $status.ForeColor = [System.Drawing.Color]::FromArgb^(70, 70, 70^)
  echo $status.Text = 'Open the official WhatsApp link. If WhatsApp opens chat, click Has WhatsApp. If WhatsApp says the number is invalid or unavailable, click No WhatsApp.'
  echo $form.Controls.Add^($status^)
  echo.
  echo $openButton = New-Object System.Windows.Forms.Button
  echo $openButton.Text = 'Open WhatsApp'
  echo $openButton.Location = New-Object System.Drawing.Point^(18, 155^)
  echo $openButton.Size = New-Object System.Drawing.Size^(130, 34^)
  echo $form.Controls.Add^($openButton^)
  echo.
  echo $validButton = New-Object System.Windows.Forms.Button
  echo $validButton.Text = 'Has WhatsApp'
  echo $validButton.Location = New-Object System.Drawing.Point^(158, 155^)
  echo $validButton.Size = New-Object System.Drawing.Size^(120, 34^)
  echo $validButton.BackColor = [System.Drawing.Color]::FromArgb^(217, 245, 224^)
  echo $form.Controls.Add^($validButton^)
  echo.
  echo $invalidButton = New-Object System.Windows.Forms.Button
  echo $invalidButton.Text = 'No WhatsApp'
  echo $invalidButton.Location = New-Object System.Drawing.Point^(288, 155^)
  echo $invalidButton.Size = New-Object System.Drawing.Size^(120, 34^)
  echo $invalidButton.BackColor = [System.Drawing.Color]::FromArgb^(255, 225, 225^)
  echo $form.Controls.Add^($invalidButton^)
  echo.
  echo $copyButton = New-Object System.Windows.Forms.Button
  echo $copyButton.Text = 'Copy Link'
  echo $copyButton.Location = New-Object System.Drawing.Point^(418, 155^)
  echo $copyButton.Size = New-Object System.Drawing.Size^(100, 34^)
  echo $form.Controls.Add^($copyButton^)
  echo.
  echo $lastLabel = New-Object System.Windows.Forms.Label
  echo $lastLabel.Location = New-Object System.Drawing.Point^(18, 205^)
  echo $lastLabel.Size = New-Object System.Drawing.Size^(500, 22^)
  echo $lastLabel.ForeColor = [System.Drawing.Color]::FromArgb^(20, 110, 60^)
  echo $lastLabel.Text = "Results save to: $resultFile"
  echo $form.Controls.Add^($lastLabel^)
  echo.
  echo $closeButton = New-Object System.Windows.Forms.Button
  echo $closeButton.Text = 'Close'
  echo $closeButton.Location = New-Object System.Drawing.Point^(418, 235^)
  echo $closeButton.Size = New-Object System.Drawing.Size^(100, 34^)
  echo $form.Controls.Add^($closeButton^)
  echo.
  echo function Get-Phone {
  echo     $phone = $input.Text -replace '[^\d]', ''
  echo     if ^([string]::IsNullOrWhiteSpace^($phone^)^) {
  echo         [System.Windows.Forms.MessageBox]::Show^('Enter a phone number with country code.', 'Missing phone number', 'OK', 'Warning'^) ^| Out-Null
  echo         return $null
  echo     }
  echo     return $phone
  echo }
  echo.
  echo function Get-WhatsAppUrl {
  echo     $phone = Get-Phone
  echo     if ^($phone^) { return "https://api.whatsapp.com/send?phone=$phone" }
  echo     return $null
  echo }
  echo.
  echo function Save-Result^([string] $result^) {
  echo     $phone = Get-Phone
  echo     if ^(-not $phone^) { return }
  echo     if ^(-not ^(Test-Path $resultFile^)^) {
  echo         'Timestamp,Phone,Result,Url' ^| Set-Content -Path $resultFile -Encoding UTF8
  echo     }
  echo     $url = "https://api.whatsapp.com/send?phone=$phone"
  echo     $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
  echo     "$timestamp,$phone,$result,$url" ^| Add-Content -Path $resultFile -Encoding UTF8
  echo     $lastLabel.Text = "Saved: $phone = $result"
  echo }
  echo.
  echo $openButton.Add_Click^({
  echo     $url = Get-WhatsAppUrl
  echo     if ^($url^) {
  echo         Start-Process $url
  echo         $status.Text = "Opened: $url"
  echo     }
  echo }^)
  echo.
  echo $validButton.Add_Click^({ Save-Result 'HAS_WHATSAPP' }^)
  echo $invalidButton.Add_Click^({ Save-Result 'NO_WHATSAPP' }^)
  echo.
  echo $copyButton.Add_Click^({
  echo     $url = Get-WhatsAppUrl
  echo     if ^($url^) {
  echo         [System.Windows.Forms.Clipboard]::SetText^($url^)
  echo         $status.Text = "Copied: $url"
  echo     }
  echo }^)
  echo.
  echo $closeButton.Add_Click^({ $form.Close^(^) }^)
  echo $form.AcceptButton = $openButton
  echo $form.CancelButton = $closeButton
  echo.
  echo [void] $form.ShowDialog^(^)
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
del "%PS1%" >nul 2>nul
