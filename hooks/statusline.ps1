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

# Uso por sessao para o painel do Herdr (mods/agents-edited): em state\ctx, <terminal>.json e
# <terminal>.tally.json, a soma do transcript desde o offset lido. Transcript novo (/clear,
# /resume) zera a soma. Conta mensagens do transcript principal; subagentes tem o proprio.
$Utf8 = New-Object System.Text.UTF8Encoding($false)
$CtxBase = if ($env:HC_TERMINAL_ID -and $In.transcript_path) { Join-Path $ClaudeDir "state\ctx\$($env:HC_TERMINAL_ID)" }

function New-SessionTally([string]$Transcript) {
    [pscustomobject][ordered]@{ transcript = $Transcript; offset = [long]0; last_id = ''; input = [long]0; cache_write = [long]0; cache_read = [long]0; output = [long]0; background = @() }
}

# Tarefas em background da sessao: a tool_result anuncia o id, <task-notification> ou TaskStop o encerra.
# Texto comum pode citar essas frases, entao so vale o comeco do conteudo de um registro real.
function Update-BackgroundTasks($Tally, $O) {
    if ($O.isSidechain -eq $true) { return }
    $Content = $O.message.content
    $Notice = if ($O.attachment.prompt) { [string]$O.attachment.prompt } elseif ($Content -is [string]) { $Content }
    if ($Notice -and $Notice -match '^<task-notification>\s*<task-id>(\w+)</task-id>') {
        $Done = $Matches[1]
        $Tally.background = @($Tally.background | Where-Object { $_ -ne $Done })
        return
    }
    if ($O.type -ne 'user' -or $Content -is [string]) { return }
    $BackgroundTaskId = [string]$O.toolUseResult.backgroundTaskId
    if ($BackgroundTaskId -and @($Tally.background) -notcontains $BackgroundTaskId) { $Tally.background = @($Tally.background) + $BackgroundTaskId }
    foreach ($Part in @($Content)) {
        if ($Part.type -ne 'tool_result') { continue }
        $Text = if ($Part.content -is [string]) { $Part.content } else { [string](@($Part.content)[0].text) }
        $Started = $null
        if ($Text -match '^Command running in background with ID: (\w+)') { $Started = $Matches[1] }
        elseif ($Text -match '^Command did not complete within its \d+s timeout and was moved to the background \(ID: (\w+)\)') { $Started = $Matches[1] }
        elseif ($Text -match '^Async agent launched successfully[\s\S]*?agentId: (\w+)') { $Started = $Matches[1] }
        elseif ($Text -match '^\{"message":"Successfully stopped task: (\w+)') {
            $Done = $Matches[1]
            $Tally.background = @($Tally.background | Where-Object { $_ -ne $Done })
        }
        if ($Started -and @($Tally.background) -notcontains $Started) { $Tally.background = @($Tally.background) + $Started }
    }
}

function Read-NewTranscriptBytes([string]$Transcript, $Tally) {
    $Stream = [System.IO.File]::Open($Transcript, 'Open', 'Read', 'ReadWrite, Delete')
    try {
        $Stream.Position = $Tally.offset
        $Bytes = New-Object byte[] ($Stream.Length - $Tally.offset)
        $Read = 0
        while ($Read -lt $Bytes.Length) {
            $Got = $Stream.Read($Bytes, $Read, $Bytes.Length - $Read)
            if ($Got -le 0) { break }
            $Read += $Got
        }
        return ,$Bytes
    } finally { $Stream.Dispose() }
}

function Update-SessionTally([string]$TallyPath, [string]$Transcript) {
    $Tally = $null
    if (Test-Path -LiteralPath $TallyPath) { try { $Tally = [System.IO.File]::ReadAllText($TallyPath) | ConvertFrom-Json } catch {} }
    $Size = if (Test-Path -LiteralPath $Transcript) { (Get-Item -LiteralPath $Transcript).Length } else { 0 }
    if ($Tally -and $null -eq $Tally.background) { $Tally | Add-Member -NotePropertyName background -NotePropertyValue @() }
    if (-not $Tally -or $Tally.transcript -ne $Transcript -or $Tally.offset -gt $Size) {
        $Tally = New-SessionTally $Transcript
        [System.IO.File]::WriteAllText($TallyPath, ($Tally | ConvertTo-Json -Compress), $Utf8)
    }
    if ($Size -le $Tally.offset) { return $Tally }

    $Bytes = Read-NewTranscriptBytes $Transcript $Tally
    # Linha ainda sendo escrita fica para a proxima leitura.
    $End = [array]::LastIndexOf($Bytes, [byte]10)
    if ($End -lt 0) { return $Tally }
    foreach ($Line in $Utf8.GetString($Bytes, 0, $End).Split("`n")) {
        $IsBackground = $Line -match 'backgroundTaskId|in background with ID|moved to the background|Async agent launched|<task-notification>|Successfully stopped task'
        $IsUsage = $Line -match '"usage"' -and $Line -match '"assistant"'
        if (-not $IsBackground -and -not $IsUsage) { continue }
        try { $O = $Line | ConvertFrom-Json } catch { continue }
        if ($IsBackground) { Update-BackgroundTasks $Tally $O }
        if (-not $IsUsage) { continue }
        if (-not $O -or $O.isSidechain -eq $true) { continue }
        $U = $O.message.usage
        $Id = $O.message.id
        # Uma mensagem ocupa varias linhas seguidas, todas com o mesmo usage.
        if (-not $U -or -not $Id -or $Id -eq $Tally.last_id) { continue }
        $Tally.last_id = $Id
        $Tally.input += [long]$U.input_tokens
        $Tally.cache_write += [long]$U.cache_creation_input_tokens
        $Tally.cache_read += [long]$U.cache_read_input_tokens
        $Tally.output += [long]$U.output_tokens
    }
    $Tally.offset += $End + 1
    [System.IO.File]::WriteAllText($TallyPath, ($Tally | ConvertTo-Json -Compress), $Utf8)
    return $Tally
}

function Write-ContextState([string]$Zone, [int]$SoftTokens, [int]$CapTokens, [double]$CapPct, [int]$TotalTokens, [int]$WindowTokens) {
    if (-not $CtxBase) { return }
    try {
        [void](New-Item -ItemType Directory -Force -Path (Split-Path $CtxBase))
        $Tally = Update-SessionTally "$CtxBase.tally.json" $In.transcript_path
        $State = [ordered]@{
            zone = $Zone; soft = $SoftTokens; cap = $CapTokens; pct_cap = $CapPct; total = $TotalTokens; window = $WindowTokens
            background = @($Tally.background).Count
            session = [ordered]@{ input = $Tally.input; cache_write = $Tally.cache_write; cache_read = $Tally.cache_read; output = $Tally.output; cost_usd = [double]$In.cost.total_cost_usd }
            at = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        }
        [System.IO.File]::WriteAllText("$CtxBase.json", ($State | ConvertTo-Json -Compress), $Utf8)
    } catch {}
}

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
if ($Used -le 0) {
    Write-ContextState 'SMART' 0 0 0 0 0
    exit 0
}

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

Write-ContextState $Zone $Soft $Cap $PctCap $Total $Window

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
