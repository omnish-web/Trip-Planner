$file = "c:\Data\Projects\TripPlanner\src\components\TripSnapshotTab.tsx"
$content = Get-Content $file
# Chart Block
$content[777] = "                                        icon = '🍔'"
$content[781] = "                                        icon = '✈️'"
$content[785] = "                                        icon = '🏨'"
$content[789] = "                                        icon = '🎉'"

# Parent Block
$content[901] = "                                                    let icon = '💸'"
$content[902] = "                                                    if (category === 'Food') icon = '🍔'"
$content[903] = "                                                    else if (category === 'Transport') icon = '✈️'"
$content[904] = "                                                    else if (category === 'Accommodation') icon = '🏨'"
$content[905] = "                                                    else if (category === 'Entertainment') icon = '🎉'"

# Child Block
$content[970] = "                                                                let icon = '💸'"
$content[971] = "                                                                if (category === 'Food') icon = '🍔'"
$content[972] = "                                                                else if (category === 'Transport') icon = '✈️'"
$content[973] = "                                                                else if (category === 'Accommodation') icon = '🏨'"
$content[974] = "                                                                else if (category === 'Entertainment') icon = '🎉'"

$content | Set-Content $file -Encoding UTF8
Write-Host "Fixed encoding issues"
