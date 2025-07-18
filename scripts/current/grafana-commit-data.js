/*****************************************************************
 * Simple Build Processor - No Extra Tables Needed
 * 
 * INSTRUCTIONS:
 * 1. Update START_VERSION before each run
 * 2. Run the script
 * 3. Check console for next version to process
 * 4. Repeat until all versions are done
 * 
 * PROCESSING LOG (Update this as you go):
 * ✅ 28.10 - 29.40: Done
 * 🔄 30.00 - ?: Current <-- YOU ARE HERE
 * ⏸️ Rest: Pending
 *****************************************************************/

// 🔶 CHANGE THIS BEFORE EACH RUN
const START_VERSION = "36.30";  // <-- Update this value
const MAX_BUILDS_PER_RUN = 5;  // Process 9 builds (45 requests)

// Webhook URL
const WORKATO_WEBHOOK_URL =
  'https://webhooks.workato.com/webhooks/rest/aaaea857-ced8-42ed-9401-a069db9a2fa5/grafana-to-airtable';

const BUILDS_TABLE = base.getTable('Builds');

async function processBuilds() {
  console.log(`# Build Processing - Starting from ${START_VERSION}\n`);
  
  // Fetch all records
  const queryResult = await BUILDS_TABLE.selectRecordsAsync({
    view: 'Build Milestones',
    fields: ['Build Version (Milestones)', 'Milestone Type', 'Due Date']
  });
  const allBuildRecords = queryResult.records;
  
  // Get all versions
  const allVersions = getAllUniqueVersions(allBuildRecords);
  
  // Find start position
  const startIdx = allVersions.indexOf(START_VERSION);
  if (startIdx === -1) {
    console.error(`❌ Version ${START_VERSION} not found!`);
    console.log("\nAvailable versions:");
    console.log(allVersions.slice(0, 20).join(", ") + "...");
    return;
  }
  
  // Get versions for this run
  const endIdx = Math.min(startIdx + MAX_BUILDS_PER_RUN, allVersions.length);
  const versionsToProcess = allVersions.slice(startIdx, endIdx);
  
  console.log(`Processing ${versionsToProcess.length} versions:\n`);
  
  // Track results
  let totalSent = 0;
  let totalErrors = 0;
  let lastProcessed = null;
  
  // Process each version
  for (let i = 0; i < versionsToProcess.length; i++) {
    const version = versionsToProcess[i];
    console.log(`[${i + 1}/${versionsToProcess.length}] Processing ${version}...`);
    
    const milestones = getBuildMilestonesFromPrefetched(version, allBuildRecords);
    if (Object.keys(milestones).length === 0) {
      console.log(`   ⚠️ No milestones found - skipping\n`);
      lastProcessed = version;
      continue;
    }
    
    const nextLive = getNextVersionLiveDateFromPrefetched(version, allBuildRecords);
    const periods = calculateMilestonePeriods(milestones, nextLive);
    
    let versionSent = 0;
    let versionErrors = 0;
    
    for (const period of periods) {
      try {
        const res = await fetch(WORKATO_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            buildVersion: version,
            periodName: period.name,
            stream: `//Fortnite/Release-${version}`,
            startDate: period.startDate.toISOString(),
            endDate: period.endDate.toISOString()
          })
        });
        
        if (res.ok) {
          console.log(`   ✅ ${period.name}`);
          versionSent++;
        } else {
          console.log(`   ❌ ${period.name} (HTTP ${res.status})`);
          versionErrors++;
        }
      } catch (err) {
        console.error(`   ❌ ${period.name} (${err.message})`);
        versionErrors++;
      }
    }
    
    totalSent += versionSent;
    totalErrors += versionErrors;
    lastProcessed = version;
    console.log(`   Summary: ${versionSent} sent, ${versionErrors} errors\n`);
  }
  
  // Final summary
  console.log("=".repeat(60));
  console.log("🎉 RUN COMPLETE");
  console.log("=".repeat(60));
  console.log(`Processed: ${versionsToProcess.length} versions`);
  console.log(`Webhooks sent: ${totalSent}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`Last version: ${lastProcessed}\n`);
  
  // Next steps
  if (endIdx < allVersions.length) {
    const nextVersion = allVersions[endIdx];
    console.log("📌 TO CONTINUE:");
    console.log(`   1. Update START_VERSION to: "${nextVersion}"`);
    console.log(`   2. Run the script again`);
    console.log(`   3. Versions remaining: ${allVersions.length - endIdx}`);
    
    // Show preview of next batch
    const nextBatch = allVersions.slice(endIdx, Math.min(endIdx + MAX_BUILDS_PER_RUN, allVersions.length));
    console.log(`\n   Next batch will process: ${nextBatch.join(", ")}`);
  } else {
    console.log("✅ ALL VERSIONS COMPLETE!");
    console.log("   No more versions to process.");
  }
  
  // Copy-paste helper
  console.log("\n" + "=".repeat(60));
  console.log("COPY THIS FOR YOUR NEXT RUN:");
  console.log("=".repeat(60));
  if (endIdx < allVersions.length) {
    console.log(`const START_VERSION = "${allVersions[endIdx]}";`);
  } else {
    console.log("// All done! 🎉");
  }
}

// Helper functions
function getAllUniqueVersions(records) {
  const versions = records.map(r => {
    const versionCell = r.getCellValue('Build Version (Milestones)');
    return Array.isArray(versionCell) ? versionCell[0]?.name : versionCell;
  }).filter(v => v && !v.includes('HF'));
  
  return [...new Set(versions)].sort((a, b) => {
    const [aMajor, aMinor] = a.split('.').map(Number);
    const [bMajor, bMinor] = b.split('.').map(Number);
    if (isNaN(aMajor) || isNaN(aMinor) || isNaN(bMajor) || isNaN(bMinor)) return 0;
    return aMajor !== bMajor ? aMajor - bMajor : aMinor - bMinor;
  });
}

function getBuildMilestonesFromPrefetched(buildVersion, allBuildRecords) {
  const buildRecords = allBuildRecords.filter(r => {
    const versionCellValue = r.getCellValue('Build Version (Milestones)');
    const version = Array.isArray(versionCellValue) ? versionCellValue[0]?.name : versionCellValue; 
    return version === buildVersion && version && !version.includes('HF');
  });

  const milestones = {};
  for (const rec of buildRecords) {
    const milestoneType = rec.getCellValue('Milestone Type');
    const dueDate = rec.getCellValue('Due Date');
    if (milestoneType && dueDate) {
      let milestoneName = typeof milestoneType === 'string' ? milestoneType : milestoneType.name;
      if (milestoneName === "Pencil's Down") {
        milestoneName = "Pencils Down";
      }
      milestones[milestoneName] = dueDate;
    }
  }
  return milestones;
}

function getNextVersionLiveDateFromPrefetched(currentVersion, allBuildRecords) {
  const allVersionValues = allBuildRecords.map(r => {
    const versionCellValue = r.getCellValue('Build Version (Milestones)');
    return Array.isArray(versionCellValue) ? versionCellValue[0]?.name : versionCellValue;
  });

  const versions = [...new Set(allVersionValues
    .filter(v => v && !v.includes('HF')))]
    .sort((a, b) => {
      const [aMajor, aMinor] = a.split('.').map(Number);
      const [bMajor, bMinor] = b.split('.').map(Number);
      if (isNaN(aMajor) || isNaN(aMinor) || isNaN(bMajor) || isNaN(bMinor)) return 0;
      return aMajor !== bMajor ? aMajor - bMajor : aMinor - bMinor;
    });

  const currentIndex = versions.indexOf(currentVersion);
  if (currentIndex === -1 || currentIndex === versions.length - 1) {
    return null;
  }
  const nextVersionString = versions[currentIndex + 1];
  
  const nextVersionLiveRecord = allBuildRecords.find(r => {
    const versionCellValue = r.getCellValue('Build Version (Milestones)');
    const recordVersion = Array.isArray(versionCellValue) ? versionCellValue[0]?.name : versionCellValue;
    const milestoneType = r.getCellValue('Milestone Type');
    if (!milestoneType || !recordVersion) return false;
    const typeName = typeof milestoneType === 'string' ? milestoneType : milestoneType.name;
    return recordVersion === nextVersionString && typeName === 'Live';
  });

  return nextVersionLiveRecord ? nextVersionLiveRecord.getCellValue('Due Date') : null;
}

function calculateMilestonePeriods(ms, nextVersionLiveDate) {
  const order = ['Hard Lock', "Pencils Down", 'Cert Sub', 'Live'];
  const list = order
    .filter(k => ms[k])
    .map(k => ({ name: k, date: new Date(ms[k]) }))
    .sort((a, b) => a.date - b.date);

  if (list.length === 0 && !(ms['Branch Create'] && nextVersionLiveDate && list.some(x => x.name === 'Live'))) {
    return [];
  }
  
  const periods = [];
  const hardLock = list.find(x => x.name === 'Hard Lock');
  if (hardLock && ms['Branch Create']) {
    periods.push({
      name: 'Before Hard Lock',
      startDate: new Date(ms['Branch Create']),
      endDate: hardLock.date
    });
  }
  
  for (let i = 0; i < list.length - 1; i++) {
    periods.push({
      name: `${list[i].name} -> ${list[i+1].name}`,
      startDate: list[i].date,
      endDate: list[i+1].date
    });
  }
  
  const live = list.find(x => x.name === 'Live');
  if (live && nextVersionLiveDate) {
    periods.push({
      name: 'Live+',
      startDate: live.date,
      endDate: new Date(nextVersionLiveDate)
    });
  }
  
  return periods;
}

// Run it!
await processBuilds();