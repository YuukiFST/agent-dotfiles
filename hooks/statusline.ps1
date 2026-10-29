# Statusline: uso da janela de contexto + segmento do caveman.
# Fonte oficial dos numeros: campo context_window do JSON que o Claude Code manda
# no stdin da statusLine (docs: code.claude.com/docs/en/statusline.md).
# Fallback: o transcript JSONL, cujo formato e interno e pode quebrar entre versoes.

$ErrorActionPreference = 'SilentlyContinue'
# Formatacao numerica sempre com ponto decimal, independente do locale do Windows.
[System.Threading.Thread]::CurrentThread.CurrentCulture = [System.Globalization.CultureInfo]::InvariantCulture
$Esc = [char]27
$Raw = [Console]::In.ReadToEnd()
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ClaudeDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME ".claude" }

# segmento caveman (reusa o script existente)
$Caveman = Join-Path $ClaudeDir "hooks\caveman-statusline.ps1"
if (Test-Path $Caveman) { & powershell -NoProfile -ExecutionPolicy Bypass -File $Caveman }

function Write-Seg([string]$Text, [int]$Color) {
    [Console]::Write(" ${Esc}[38;5;${Color}m${Text}${Esc}[0m")
}
function Format-K([double]$N) {
    if ($N -ge 1000000) { return ('{0:0.00}M' -f ($N / 1000000)) }
    if ($N -ge 1000)    { return ('{0:0.0}k'  -f ($N / 1000)) }
    return [string][int]$N
}

try { $In = $Raw | ConvertFrom-Json } catch { exit 0 }

# Segmento modelo + effort. Campos do JSON da statusLine (claude 2.1.259):
# model.display_name, effort.level (so aparece em modelo que suporta) e fast_mode.
$ModelName = $In.model.display_name
if (-not $ModelName) { $ModelName = $In.model.id }
# display_name vem como "Opus 5 (1M context)". Mantem o tamanho da janela, corta
# a palavra "context" e os parenteses: "Opus 5 1M".
$ModelName = $ModelName -replace '\s*\((\S+)\s+context\)', ' $1'
$ModelName = $ModelName -replace '\s*\(.*\)', ''
if ($ModelName) {
    $Effort = $In.effort.level
    $Label = $ModelName
    if ($Effort) { $Label = "$ModelName/$Effort" }
    if ($In.fast_mode) { $Label = "$Label fast" }
    Write-Seg $Label 111
}

$Used = 0; $Window = 0; $Out = 0
$Cw = $In.context_window
if ($Cw) {
    $Used   = [int]$Cw.total_input_tokens
    $Out    = [int]$Cw.total_output_tokens
    $Window = [int]$Cw.context_window_size
}

if ($Used -le 0 -and $In.transcript_path -and (Test-Path -LiteralPath $In.transcript_path)) {
    $Lines = Get-Content -LiteralPath $In.transcript_path
    for ($i = $Lines.Count - 1; $i -ge 0; $i--) {
        if ($Lines[$i] -notmatch '"usage"') { continue }
        try { $O = $Lines[$i] | ConvertFrom-Json } catch { continue }
        if ($O.isSidechain -eq $true) { continue }
        $U = $O.message.usage
        if (-not $U) { continue }
        $Used = [int]$U.input_tokens + [int]$U.cache_creation_input_tokens + [int]$U.cache_read_input_tokens
        $Out  = [int]$U.output_tokens
        break
    }
}
if ($Used -le 0) { exit 0 }

if ($Window -le 0) { $Window = 200000 }
if ($env:CLAUDE_CONTEXT_WINDOW) { $Window = [int]$env:CLAUDE_CONTEXT_WINDOW }
if ($Used -gt $Window) { $Window = 1000000 }

$Total = $Used + $Out

# Dois limites, severidades diferentes (decisao do usuario, 2026-09-04):
#  - cap  = 40% da janela: limite duro, nunca ultrapassar.
#  - soft = 120k tokens: alvo de sessao de planejamento; tarefa de codigo pode
#    passar, entao estourar o soft avisa mas nao alarma.
$Cap  = [int](0.40 * $Window)
$Soft = 120000
if ($env:CLAUDE_HARD_CAP)    { $Cap  = [int]$env:CLAUDE_HARD_CAP }
if ($env:CLAUDE_SOFT_TARGET) { $Soft = [int]$env:CLAUDE_SOFT_TARGET }
$HasSoft = $Soft -lt $Cap

$PctCap  = [math]::Round(100.0 * $Total / $Cap, 1)
$PctSoft = [math]::Round(100.0 * $Total / $Soft, 1)

if ($Total -ge $Cap) {
    $Color = 196; $Zone = 'DUMB'
} elseif ($PctCap -ge 85) {
    $Color = 196; $Zone = 'EDGE'
} elseif ($HasSoft -and $Total -ge $Soft) {
    $Color = 208; $Zone = 'CODE'
} elseif ($PctCap -ge 85 -or ($HasSoft -and $PctSoft -ge 85)) {
    $Color = 220; $Zone = 'SMART'
} else {
    $Color = 41;  $Zone = 'SMART'
}

# Barra escalada no cap; o marcador mostra onde fica o alvo de 120k.
$Slots = 12
$Fill  = [int][math]::Floor($Slots * $Total / $Cap)
if ($Fill -gt $Slots) { $Fill = $Slots }
if ($Fill -lt 0) { $Fill = 0 }
$Full  = [string][char]0x2588
$Empty = [string][char]0x2591
$Chars = @()
for ($s = 0; $s -lt $Slots; $s++) { $Chars += (& { if ($s -lt $Fill) { $Full } else { $Empty } }) }
if ($HasSoft) {
    $Mark = [int][math]::Floor($Slots * $Soft / $Cap)
    if ($Mark -ge $Slots) { $Mark = $Slots - 1 }
    if ($Chars[$Mark] -eq $Empty) { $Chars[$Mark] = [string][char]0x254E }
}
$Bar = -join $Chars

Write-Seg ("{0} {1} {2}" -f $Zone, $Bar, (Format-K $Total)) $Color
if ($HasSoft) {
    $SoftColor = & { if ($Total -ge $Soft) { 208 } else { 245 } }
    Write-Seg ("soft {0}%" -f $PctSoft) $SoftColor
}
Write-Seg ("cap {0}%" -f $PctCap) (& { if ($PctCap -ge 85) { 196 } else { 245 } })
if ($Zone -eq 'DUMB') { Write-Seg "-> /compact or /clear" 196 }
