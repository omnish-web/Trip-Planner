import fs from 'fs';

const FILE_PATH = 'src/components/TripSnapshotTab.tsx';

try {
    let content = fs.readFileSync(FILE_PATH, 'utf8');

    // Helper - Log and Replace
    const replaceAndLog = (target, replacement, description) => {
        if (content.includes(target)) {
            content = content.replaceAll(target, replacement);
            console.log(`✅ Replaced: ${description}`);
        } else {
            console.log(`⚠️ Not found: ${description} (might be already fixed or different encoding)`);
        }
    };

    // 1. Chart Section replacements
    replaceAndLog("icon = 'ðŸ ”'", "icon = '🍔'", "Burger (Chart)");
    replaceAndLog("icon = 'âœˆï¸ '", "icon = '✈️'", "Plane (Chart)");
    replaceAndLog("icon = 'ðŸ ¨'", "icon = '🏨'", "Hotel (Chart)");
    replaceAndLog("icon = 'ðŸŽ‰'", "icon = '🎉'", "Party (General)");

    // 2. Parent Breakdown
    replaceAndLog("if (category === 'Food') icon = 'ðŸ ”'", "if (category === 'Food') icon = '🍔'", "Burger (Parent)");
    replaceAndLog("else if (category === 'Transport') icon = 'âœˆï¸ '", "else if (category === 'Transport') icon = '✈️'", "Plane (Parent)");
    replaceAndLog("else if (category === 'Accommodation') icon = 'ðŸ ¨'", "else if (category === 'Accommodation') icon = '🏨'", "Hotel (Parent)");

    // 3. Child Breakdown
    // Note: The 'let icon = ...' line was also corrupted for billing?
    replaceAndLog("let icon = 'ðŸ’¸'", "let icon = '💸'", "Billing (Child)");
    replaceAndLog("if (category === 'Food') icon = 'ðŸ ”'", "if (category === 'Food') icon = '🍔'", "Burger (Child)");
    // The Child block might have identical strings so replaceAll should cover it if strings match.

    // Also handle the general fallback if present
    // 'ðŸ’¸' is 💸
    replaceAndLog("icon = 'ðŸ’¸'", "icon = '💸'", "Billing Icon General");

    // Specific fallback for "Billing" if it was corrupted differently
    replaceAndLog("let icon = 'ðŸ’¸'", "let icon = '💸'", "Billing (Let)");

    fs.writeFileSync(FILE_PATH, content, 'utf8');
    console.log('🎉 Operations complete.');

} catch (err) {
    console.error('Error:', err);
}
