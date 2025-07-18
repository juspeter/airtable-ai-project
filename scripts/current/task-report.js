// Final Task Report Script with Guaranteed Clearing
// Purpose: Match milestone objects with string references for task scheduling

async function updateTaskReport() {
    try {
        console.log("Starting task report update...");
        
        // Get table references
        const checklistTable = base.getTable("Checklist Tasks");
        const milestonesTable = base.getTable("Build Milestones");
        const outputTable = base.getTable("Task Report");
        
        // ALWAYS CLEAR THE TASK REPORT TABLE FIRST - regardless of whether we find tasks
        console.log("Clearing existing task records...");
        let existingRecords = await outputTable.selectRecordsAsync();
        if (existingRecords.records.length > 0) {
            let recordsToDelete = existingRecords.records.map(record => record.id);
            while (recordsToDelete.length > 0) {
                await outputTable.deleteRecordsAsync(recordsToDelete.splice(0, 50));
            }
            console.log(`Deleted ${existingRecords.records.length} existing records`);
        } else {
            console.log("No existing records to clear");
        }
        
        // Fetch all records
        console.log("Fetching tasks and milestones...");
        const checklistQuery = await checklistTable.selectRecordsAsync();
        const milestonesQuery = await milestonesTable.selectRecordsAsync();
        
        console.log(`Found ${checklistQuery.records.length} tasks and ${milestonesQuery.records.length} milestones`);
        
        // Get today's date and upcoming threshold
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const upcomingThreshold = new Date(today);
        upcomingThreshold.setDate(today.getDate() + 3);
        
        console.log(`Today: ${today.toISOString().split('T')[0]}`);
        console.log(`Upcoming threshold: ${upcomingThreshold.toISOString().split('T')[0]}`);
        
        // Create map of active milestones (today or upcoming)
        // Key: milestone name (string), Value: milestone data
        const activeMilestones = new Map();
        
        console.log("\nProcessing milestones...");
        for (const record of milestonesQuery.records) {
            try {
                // Get milestone from object format
                const milestoneObj = record.getCellValue("Milestone");
                if (!milestoneObj) continue;
                
                // Extract the name from the object
                let milestoneName;
                if (typeof milestoneObj === 'object' && milestoneObj.name) {
                    milestoneName = milestoneObj.name;
                } else if (typeof milestoneObj === 'string') {
                    milestoneName = milestoneObj;
                } else {
                    continue; // Skip invalid milestone formats
                }
                
                // Get other milestone info
                const dueDate = record.getCellValue("Due Date + Time (ET)");
                if (!dueDate) continue;
                
                const builds = record.getCellValue("Builds") || "Unknown";
                
                // Parse date consistently
                const parsedDate = new Date(dueDate);
                parsedDate.setHours(0, 0, 0, 0);
                
                // Check if milestone is active (today or upcoming)
                let isActive = false;
                if (parsedDate.getTime() === today.getTime()) {
                    console.log(`Milestone "${milestoneName}" (${builds}) is TODAY`);
                    isActive = true;
                } else if (parsedDate > today && parsedDate <= upcomingThreshold) {
                    console.log(`Milestone "${milestoneName}" (${builds}) is UPCOMING (within 3 days)`);
                    isActive = true;
                }
                
                // Only store active milestones
                if (isActive) {
                    activeMilestones.set(milestoneName, {
                        name: milestoneName,
                        dueDate: parsedDate,
                        builds
                    });
                }
            } catch (error) {
                console.log(`Error processing milestone: ${error.message}`);
            }
        }
        
        console.log(`Found ${activeMilestones.size} active milestones`);
        
        // Process tasks
        console.log("\nProcessing tasks...");
        const dueTasks = [];
        
        for (const record of checklistQuery.records) {
            try {
                const task = record.getCellValue("Task");
                if (!task) continue;
                
                const team = record.getCellValue("Team") || "";
                
                // Get milestone as string
                const milestone = record.getCellValue("Associated Milestone");
                if (!milestone) continue;
                
                // Extract milestone name - handle both object and string formats
                let milestoneName;
                if (typeof milestone === 'object' && milestone.name) {
                    milestoneName = milestone.name;
                } else if (typeof milestone === 'string') {
                    milestoneName = milestone;
                } else {
                    continue;
                }
                
                // Check if task's milestone matches an active milestone
                if (activeMilestones.has(milestoneName)) {
                    const milestoneData = activeMilestones.get(milestoneName);
                    
                    // Get offset days
                    let offsetDays = 0;
                    const offsetValue = record.getCellValue("Offset Days");
                    if (offsetValue !== null && offsetValue !== undefined && offsetValue !== "") {
                        offsetDays = parseInt(offsetValue, 10);
                        if (isNaN(offsetDays)) offsetDays = 0;
                    }
                    
                    // Get other task fields
                    const notes = record.getCellValue("Notes") || "";
                    const steps = record.getCellValue("Steps to Complete") || "";
                    const slackPost = record.getCellValue("Suggested Slack Post Text") || "";
                    const slackThread = record.getCellValue("Suggested Slack Thread Text") || "";
                    
                    // Calculate task due date
                    const taskDueDate = new Date(milestoneData.dueDate);
                    taskDueDate.setDate(milestoneData.dueDate.getDate() + offsetDays);
                    taskDueDate.setHours(0, 0, 0, 0);
                    
                    // Determine status
                    let status = "";
                    if (taskDueDate.getTime() === today.getTime()) {
                        status = "Due";
                        console.log(`Task: "${task}" is DUE TODAY`);
                    } else if (taskDueDate > today && taskDueDate <= upcomingThreshold) {
                        status = "Upcoming";
                        console.log(`Task: "${task}" is UPCOMING (within 3 days)`);
                    }
                    
                    if (status) {
                        dueTasks.push({
                            fields: {
                                "Version": milestoneData.builds,
                                "Milestone": milestoneData.name,
                                "Task": task,
                                "Team": team,
                                "Notes": notes,
                                "Steps to Complete": steps,
                                "Suggested Slack Post Text": slackPost,
                                "Suggested Slack Thread Text": slackThread,
                                "Status": status,
                                "Due Date": taskDueDate.toISOString().split("T")[0]
                            }
                        });
                    }
                }
            } catch (error) {
                console.log(`Error processing task: ${error.message}`);
            }
        }
        
        console.log(`\nFound ${dueTasks.length} due or upcoming tasks`);
        
        // Create new task records if any were found
        if (dueTasks.length > 0) {
            console.log(`Creating ${dueTasks.length} new task records...`);
            while (dueTasks.length > 0) {
                let batch = dueTasks.splice(0, 50);
                await outputTable.createRecordsAsync(batch);
            }
            console.log("Task records created successfully");
        } else {
            console.log("No tasks to create");
        }
        
        console.log("\nTask report update completed!");
        
    } catch (error) {
        console.error(`Error updating task report: ${error.message}`);
        console.error(error.stack);
    }
}

// Run the function
await updateTaskReport();