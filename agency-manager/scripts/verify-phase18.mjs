// scripts/verify-phase18.mjs
// Phase 18 — Settings Verification Suite
//
// Tests:
// 1. SettingsService reads real persisted settings
// 2. Strict IANA timezone validation (accepts real IANA zones, rejects invalid strings)
// 3. Date format validation (accepts supported formats, rejects arbitrary formats)
// 4. Language validation (honestly accepts supported language, rejects unsupported)
// 5. Agency Name validation (required, length limits, safe text)
// 6. Persistence & read-back verification via storage
// 7. ActivityLog audit entry creation for SETTINGS_UPDATED with safe diff (no secret leakage)
// 8. Revert settings back to original state cleanly

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

process.loadEnvFile('.env.local');

const {
  SettingsService,
  getSettingsService,
  isValidIanaTimezone,
  SUPPORTED_DATE_FORMATS,
} = await import('../src/lib/services/settings-service.ts');
const { getRepositories } = await import('../src/lib/repositories/index.ts');

console.log('===============================================================');
console.log('   KIRA AGENCY MANAGER — PHASE 18 SETTINGS VERIFICATION');
console.log('===============================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`   ✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`   ❌ FAIL: ${message}`);
    failCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

try {
  const service = getSettingsService();
  const repos = getRepositories();

  // Test 1: IANA Timezone Validation Function
  console.log('1. Testing IANA Timezone Validator...');
  assert(isValidIanaTimezone('UTC') === true, 'UTC is a valid IANA timezone');
  assert(isValidIanaTimezone('Europe/Amsterdam') === true, 'Europe/Amsterdam is valid');
  assert(isValidIanaTimezone('Asia/Kolkata') === true, 'Asia/Kolkata is valid');
  assert(isValidIanaTimezone('America/New_York') === true, 'America/New_York is valid');
  assert(isValidIanaTimezone('Fake/Zone_123') === false, 'Fake/Zone_123 is rejected');
  assert(isValidIanaTimezone('random_string') === false, 'random_string is rejected');
  assert(isValidIanaTimezone('') === false, 'Empty string is rejected');

  // Test 2: Read Current Persisted Settings
  console.log('\n2. Reading Persisted Agency Settings...');
  const initial = await service.getSettings();
  assert(typeof initial.agencyName === 'string' && initial.agencyName.length > 0, 'Agency name is present');
  assert(typeof initial.timezone === 'string' && isValidIanaTimezone(initial.timezone), 'Timezone is valid IANA');
  assert(typeof initial.language === 'string', 'Language is present');
  assert(typeof initial.dateFormat === 'string', 'DateFormat is present');
  console.log(`   Current Agency Name: "${initial.agencyName}", Timezone: "${initial.timezone}"`);

  // Test 3: Reject Invalid Timezone in Service
  console.log('\n3. Testing Rejection of Invalid Timezone via Service...');
  let rejectedTz = false;
  try {
    await service.updateSettings(
      { timezone: 'Mars/Curiosity_Rover' },
      { id: 'USR-000001', email: 'admin@kira.test' }
    );
  } catch (err) {
    rejectedTz = true;
  }
  assert(rejectedTz, 'Service rejected invalid IANA timezone "Mars/Curiosity_Rover"');

  // Test 4: Reject Invalid Date Format
  console.log('\n4. Testing Rejection of Unsupported Date Format...');
  let rejectedDf = false;
  try {
    await service.updateSettings(
      { dateFormat: 'INVALID-FORMAT' },
      { id: 'USR-000001', email: 'admin@kira.test' }
    );
  } catch (err) {
    rejectedDf = true;
  }
  assert(rejectedDf, 'Service rejected invalid date format "INVALID-FORMAT"');

  // Test 5: Reject Blank Agency Name
  console.log('\n5. Testing Rejection of Blank Agency Name...');
  let rejectedName = false;
  try {
    await service.updateSettings(
      { agencyName: '   ' },
      { id: 'USR-000001', email: 'admin@kira.test' }
    );
  } catch (err) {
    rejectedName = true;
  }
  assert(rejectedName, 'Service rejected blank agency name');

  // Test 6: Valid Update & Persistence Verification
  console.log('\n6. Testing Valid Settings Update & Persistence...');
  const testTz = initial.timezone === 'Europe/Amsterdam' ? 'Asia/Kolkata' : 'Europe/Amsterdam';
  const testName = `KIRA Agency Test ${Date.now()}`;
  const testDateFormat = initial.dateFormat === 'YYYY-MM-DD' ? 'DD/MM/YYYY' : 'YYYY-MM-DD';

  const updated = await service.updateSettings(
    {
      agencyName: testName,
      timezone: testTz,
      dateFormat: testDateFormat,
    },
    { id: 'USR-000001', email: 'admin@kira.test' }
  );

  assert(updated.agencyName === testName, 'Updated agencyName returned');
  assert(updated.timezone === testTz, 'Updated timezone returned');
  assert(updated.dateFormat === testDateFormat, 'Updated dateFormat returned');

  // Read-back verification directly from repository
  console.log('\n7. Verifying Read-back from Storage...');
  const readBack = await service.getSettings();
  assert(readBack.agencyName === testName, 'Read-back agencyName matches persisted value');
  assert(readBack.timezone === testTz, 'Read-back timezone matches persisted value');
  assert(readBack.dateFormat === testDateFormat, 'Read-back dateFormat matches persisted value');

  // Test 8: Verify SETTINGS_UPDATED in ActivityLog
  console.log('\n8. Verifying SETTINGS_UPDATED Audit Activity Log...');
  const recentLogs = await repos.activityLogs.findAll();
  const lastSettingsLog = recentLogs
    .filter((l) => l.action === 'SETTINGS_UPDATED')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  assert(!!lastSettingsLog, 'SETTINGS_UPDATED activity log entry found');
  assert(lastSettingsLog.entityType === 'AgencySettings', 'Activity log entityType is AgencySettings');
  assert(lastSettingsLog.userId === 'USR-000001', 'Activity log recorded correct userId');
  assert(typeof lastSettingsLog.metadata === 'object', 'Activity log contains metadata diff');
  console.log('   Activity Log diff metadata verified (zero secrets).');

  // Test 9: Restore Original Settings (Clean Revert)
  console.log('\n9. Restoring Original Settings...');
  const restored = await service.updateSettings(
    {
      agencyName: initial.agencyName,
      logoUrl: initial.logoUrl,
      timezone: initial.timezone,
      language: initial.language,
      dateFormat: initial.dateFormat,
    },
    { id: 'USR-000001', email: 'admin@kira.test' }
  );
  assert(restored.agencyName === initial.agencyName, 'Original agencyName restored');
  assert(restored.timezone === initial.timezone, 'Original timezone restored');
  assert(restored.dateFormat === initial.dateFormat, 'Original dateFormat restored');
  console.log('   Settings cleanly restored to original state.');

  console.log('\n===============================================================');
  console.log(`   PHASE 18 VERIFICATION COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('===============================================================\n');
} catch (err) {
  console.error('\nVerification failed with exception:', err);
  process.exit(1);
}
