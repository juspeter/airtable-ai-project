//======================================================================================================================
// Fortnite Full Release Report Script
// Version: v24.1.0 (Updated with all requested modifications)
// Purpose: Generates a comprehensive release report by fetching data from various Airtable tables,
//          calculating scores, identifying trends, and producing Markdown & JSON outputs.
//======================================================================================================================

//==================================================
// SECTION: CONFIGURATION CONSTANTS
// Defines constant values for field names, Airtable table/field identifiers,
// scoring weights, thresholds, and other operational parameters.
//==================================================

const FIELD_NAME_FOR_JSON_OUTPUT = "Report Data JSON";
const FIELD_NAME_FOR_MARKDOWN_OUTPUT = "Report Content";
const FIELD_NAME_FOR_OVERALL_SCORE_NUMERIC = "Overall Score Numeric";
const FIELDS = Object.freeze({
    // Build Table Fields
    BUILD_VERSION_UNIFIED: "Build Version (Unified)",
    BUILD_VERSION_SCHEDULED: "Build Version (Scheduled)",
    LABELS: "Status", // Used generally, e.g., in Builds table
    DEPLOY_TYPE_DEPLOYS: "Deploy Type (Deploys)",
    DEPLOY_CLASSIFICATION: "Deploy Classification",
    DEPLOY_DUE_DATE_TIME: "Due Date w/ Time",
    LIVE_DATE_ACTUAL: "Start date",
    SUMMARY: "Summary", // Used generally, e.g., in Builds table
    SEASON_UNIFIED: "Season (Unified)",
    OPEN_IN_JIRA: "Open in Jira", // For Jira links in Deploys section
    MS_FEATURE_COMPLETE: "MS: Feature Complete",
    MS_BRANCH_CREATE: "MS: Branch Create",
    MS_BRANCH_OPEN: "MS: Branch Open",
    MS_DEV_COMPLETE: "MS: Dev Complete",
    MS_HARD_LOCK: "MS: Hard Lock",
    MS_PENCILS_DOWN: "MS: Pencil's Down",
    MS_CERT: "MS: Cert",
    MS_LIVE: "MS: Live",

    // Hotfix Table Fields
    PRIORITY: "Priority",
    COMPONENT_S: "Component/s", // Used in Hotfixes, SH
    QA_STATE: "QA State",
    URGENCY_CUSTOM_FIELD: "Urgency",
    HOTFIX_CREATED_FIELD: "Created",
    HOTFIX_RESOLVED_FIELD: "Resolved",

    // Integration Table Fields
    HL_TO_PD_FLAG: "HL to PD Flag",
    PD_TO_CERT_SUB_FLAG: "PD to Cert Sub Flag",
    CERT_SUB_TO_LIVE_FLAG: "Cert Sub to Live Flag",
    LIVE_PLUS_FLAG: "Live+ Flag",
    INTEGRATION_AREA: "Integration Area",
    INTEGRATION_PLATFORM: "Integration Platform",
    INTEGRATION_FN_DOMAIN: "Integration FN Domain",
    INTEGRATION_CREATED_FIELD: "Created",
    INTEGRATION_RESOLVED_FIELD: "Resolved",
    INTEGRATION_REQUESTOR: "Integration Requestor",
    INTEGRATION_SUMMARY_FIELD: "Summary",

    // ShitHappens (SH) Table Fields
    SH_LABELS: "Labels",
    SEVERITY_NORMALIZED: "Severity (Normalized)",
    SHITHAPPENS_ROOT_CAUSE: "Shithappens Root Cause",
    PRE_SH_FLAG: "Pre-SH Flag",
    SH_CREATED_FIELD: "Created",
    SH_RESOLVED_FIELD: "Resolved",

    // RQA Table Fields
    RQA_LABELS: "Labels",
    RQA_FIX_VERSION: "Fix Version/s",
    RQA_CREATED: "Created",
    RQA_RESOLVED: "Resolved",
    
    // Commit Fields
    COMMITS_PRE_HL: "Commits: Pre-Hard Lock",
    COMMITS_HL_TO_PD: "Commits: Hard Lock → Pencils Down",
    COMMITS_PD_TO_CERT: "Commits: Pencils Down → Cert Sub",
    COMMITS_CERT_TO_LIVE: "Commits: Cert Sub → Live",
    COMMITS_LIVE_PLUS: "Commits: Live+",
    
    // Open Issue Triaging Fields
    PLANNED_WORK: "Planned Work",
    PLANNED_WORK_LINK: "Planned Work (link)",
    COMPLETED_WORK: "Completed Work",
    COMPLETED_WORK_LINK: "Completed Work (link)",
    COMPLETED_ON_TIME: "Completed On Time",
    COMPLETED_ON_TIME_LINK: "Completed On Time (link)",
    COMPLETED_LATE: "Completed Late",
    COMPLETED_LATE_LINK: "Completed Late (link)",
    OPEN_BEYOND_HL: "Open Beyond Hard Lock",
    OPEN_BEYOND_HL_LINK: "Open Beyond Hard Lock (link)",
    OPEN_BEYOND_PD: "Open Beyond Pencils Down",
    OPEN_BEYOND_PD_LINK: "Open Beyond Pencils Down (link)",
    ALL_PUNTED_WORK: "All Punted Work",
    ALL_PUNTED_WORK_LINK: "All Punted Work (Link)",
});

const CONFIG = Object.freeze({
    // General Settings
    EXCLUDED_LABEL_PART: "BuildHealth",
    LOW_SCORE_THRESHOLD: 60,
    SIGNIFICANT_IMPROVEMENT_THRESHOLD: 25,
    POSITIVE_TREND_THRESHOLD_PERCENT: 20,
    CROSS_CORRELATION_MIN_COUNT: 3,
    SIGNIFICANT_COUNT_THRESHOLD: 3,
    SIGNIFICANT_RQA_COUNT_THRESHOLD: 5, // Threshold for "significant" unplanned/rebuild RQA

    // Scoring Weights
    SCORE_WEIGHTS: Object.freeze({
        DEPLOY: Object.freeze({ CLIENT: 5, SERVER: 2, MCP: 1 }),
        INTEGRATION: Object.freeze({ HL: 1, PD: 2, CERT: 3, LIVE: 4, MAX_POSSIBLE_PER_ITEM: 4 }),
        SH: Object.freeze({ SEV1: 5, SEV2: 3, SEV3: 1, SEV4: 0.5, MAX_POSSIBLE_PER_ITEM: 5 })
    }),

    // Score Display & Emojis
    BAR_THRESHOLDS: Object.freeze({ GREEN: 80, YELLOW: 50 }),
    EMOJIS: Object.freeze({
        GREEN: "🟢", YELLOW: "🟡", RED: "🔴", UNKNOWN: "❓", WARNING: "⚠️", ATTENTION: "🚨",
        INFO: "ℹ️", ROCKET: "🚀", FIRE: "🔥", LINK: "🔗", EXCLAMATION: "❗",
        CALENDAR: "📅", CHART: "📊", CHECK: "✅", CROSS: "❌", UP_TREND: "📈", DOWN_TREND: "📉", STAR: "🌟"
    }),
    SPARKLINE_CHARS: Object.freeze([' ', '▂', '▃', '▄', '▅', '▆', '▇', '█']),

    // Hotfix Specific Settings
    ASAP_URGENCY_VALUE: "ASAP",
    HOTFIX_URGENCIES_ORDER: Object.freeze(["ASAP", "Today", "Not Critical", "Scheduled", "Undefined"]),
    ASAP_HOTFIX_COUNT_THRESHOLD: 10,
    HOTFIX_QA_VERIFIED_TARGET_PERCENT: 80,

    // ShitHappens (SH) Specific Settings
    SH_SEVERITIES_ORDER: Object.freeze(["Sev 1", "Sev 2", "Sev 3", "Sev 4"]),
    SH_HIGH_SEVERITY_COMPONENT_THRESHOLD: 2,

    // RQA Specific Settings
    RQA_LABEL_WG: "RQA-WG",
    RQA_LABEL_PLANNED: "Planned", 
    RQA_LABEL_UNPLANNED: "Unplanned",
    RQA_LABEL_REBUILD: "Rebuild", 

    // Deploy Type Keywords
    DEPLOY_TYPE_MAJOR_RELEASE_KEYWORD: "major release",
    DEPLOY_TYPE_1P_PUBLISH_KEYWORD: "1p publish",
    DEPLOY_TYPE_CLIENT_KEYWORD: "client",
    DEPLOY_TYPE_SERVER_KEYWORD: "server",
    DEPLOY_TYPE_MCP_KEYWORD: "mcp",

    // Date/Time Settings
    TIMEZONE: 'America/New_York',
    DATE_FORMAT_OPTIONS: Object.freeze({
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/New_York'
    }),
    DATETIME_FORMAT_OPTIONS: Object.freeze({
        dateStyle: "full", timeStyle: "long", timeZone: 'America/New_York'
    }),

    // Jira Link Base URLs & Filters
    JIRA_BASE_URL: "https://jira.it.epicgames.com",
    JIRA_SH_FILTER_ID: "113578",
    JIRA_HOTFIX_FILTER_ID: "103124",
    JIRA_INTEGRATION_FILTER_ID: "103146",
});
const DAY_ORDER_CONSTANT = Object.freeze(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);

//==================================================
// SECTION: HELPER FUNCTIONS
//==================================================
function _formatPercent(count, total) {
    if (total === 0 || typeof count !== 'number' || typeof total !== 'number') return 0;
    const percent = (count / total) * 100;
    if (percent > 0 && percent < 1) return 1;
    return Math.round(percent);
}

function _isRelevantVersion(versionString) {
    if (typeof versionString !== 'string') return false;
    return !versionString.startsWith("5.");
}

// Format version numbers to ##.## format
function formatVersion(version) {
    if (!version || typeof version !== 'string') return version;
    const parts = version.split('.');
    if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}.${parts[1].padStart(2, '0')}`;
    }
    return version;
}

function _filterByVersion(records, versionField = FIELDS.BUILD_VERSION_UNIFIED, versionToFilter, mainTargetVersionForScript) {
    if (!Array.isArray(records)) {
        console.warn("_filterByVersion: Input 'records' is not an array. Returning empty.");
        return [];
    }
    const effectiveVersionToFilter = versionToFilter || mainTargetVersionForScript;
    if (!effectiveVersionToFilter) {
        console.warn(`_filterByVersion: effectiveVersionToFilter is undefined. Returning all valid records.`);
        return records.filter(r => r && typeof r.getCellValueAsString === 'function');
    }
    const lowerEffectiveVersionToFilter = String(effectiveVersionToFilter).toLowerCase();
    return records.filter(r => {
        if (!r || typeof r.getCellValueAsString !== 'function') return false;
        const ver = r.getCellValueAsString(versionField);
        if (!_isRelevantVersion(ver)) return false;
        if (lowerEffectiveVersionToFilter === "all") return true;
        return ver === effectiveVersionToFilter;
    });
}

function _filterRQAByVersion(records, versionToFilter) {
    if (!Array.isArray(records)) {
        console.warn("_filterRQAByVersion: Input 'records' is not an array. Returning empty.");
        return [];
    }
    if (!versionToFilter || typeof versionToFilter !== 'string' || versionToFilter.toLowerCase() === "all") {
        return records.filter(r => r && typeof r.getCellValue === 'function');
    }
    return records.filter(r => {
        if (!r || typeof r.getCellValue !== 'function') return false;
        const fixVersions = r.getCellValue(FIELDS.RQA_FIX_VERSION);
        if (!Array.isArray(fixVersions)) return false;
        return fixVersions.some(v => v && v.name === versionToFilter);
    });
}

function formatScoreDisplay(scoreValue, metricName = "") {
    if (typeof scoreValue !== "number" || isNaN(scoreValue)) {
        return "N/A";
    }
    const roundedScore = Math.round(scoreValue);
    let emoji = CONFIG.EMOJIS.UNKNOWN + " ";
    if (roundedScore >= CONFIG.BAR_THRESHOLDS.GREEN) emoji = CONFIG.EMOJIS.GREEN + " ";
    else if (roundedScore >= CONFIG.BAR_THRESHOLDS.YELLOW) emoji = CONFIG.EMOJIS.YELLOW + " ";
    else emoji = CONFIG.EMOJIS.RED + " ";
    return `${emoji}${roundedScore}/100`;
};

function _safeGet(r, fieldName, defaultValue = "Unspecified") {
    try {
        if (!r || typeof r.getCellValueAsString !== 'function') return defaultValue;
        if (typeof fieldName !== 'string') return defaultValue;
        const val = r.getCellValueAsString(fieldName);
        return val || defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

function _processDeployTypeString(typeStr) {
    if (!typeStr || typeof typeStr !== 'string') return [];
    return typeStr.split(',').map(t => ({ name: t.trim() })).filter(t => t.name);
}

function _countBy(records, field, exclude = [], limit = 5) {
    if (!Array.isArray(records) || typeof field !== 'string') return [];
    const map = {};
    for (const r of records) {
        const val = _safeGet(r, field);
        if (val && val !== "Unspecified") {
            const individualValues = val.split(',').map(v => v.trim());
            individualValues.forEach(individualVal => {
                if (individualVal && !exclude.includes(individualVal)) {
                    map[individualVal] = (map[individualVal] || 0) + 1;
                }
            });
        }
    }
    return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }));
}

function _MMDDYYYY(dateString) {
    try {
        const dateObj = new Date(dateString);
        if (isNaN(dateObj.getTime())) {
            return "Invalid Date";
        }
        return dateObj.toLocaleDateString('en-US', CONFIG.DATE_FORMAT_OPTIONS);
    } catch (e) {
        return "Invalid Date";
    }
}

function _buildN1ComparisonText(currentValue, previousValue, previousVersionString = "", label = "Previous Release", improvementThresholdPercent = CONFIG.POSITIVE_TREND_THRESHOLD_PERCENT) {
    if (previousValue === null || previousValue === undefined || typeof currentValue !== 'number') return "";
    if (typeof previousValue !== 'number') {
        return "";
    }
    let trendEmoji = "";
    let significantImprovementText = "";
    const percentageChange = previousValue === 0 ?
        (currentValue > 0 ? Infinity : 0) : ((currentValue - previousValue) / previousValue) * 100;
    const prevVersionLabel = previousVersionString ?
        `${label} (${formatVersion(previousVersionString)})` : label;

    if (currentValue < previousValue) {
        trendEmoji = ' ' + CONFIG.EMOJIS.DOWN_TREND;
        if (Math.abs(percentageChange) >= improvementThresholdPercent) {
            significantImprovementText = " - significant improvement!";
        }
    } else if (currentValue > previousValue) {
        trendEmoji = ' ' + CONFIG.EMOJIS.UP_TREND;
    }
    return ` (${prevVersionLabel}: ${previousValue}${trendEmoji}${significantImprovementText})`;
}

//==================================================
// SECTION: WEIGHTED SCORE CALCULATIONS
//==================================================
function _computeDeployScore(buildsToScore, deployConfigWeights, deployTypeFieldName) {
    if (!Array.isArray(buildsToScore)) return 100;
    if (!deployConfigWeights || typeof deployConfigWeights.CLIENT !== 'number' || typeof deployConfigWeights.SERVER !== 'number' || typeof deployConfigWeights.MCP !== 'number') {
        console.error("_computeDeployScore: Invalid SCORE_WEIGHTS.DEPLOY config!");
        return 0;
    }
    let clientDeploys = 0; let serverDeploys = 0; let mcpDeploys = 0;
    buildsToScore.forEach(b => {
        const typeStr = _safeGet(b, deployTypeFieldName, "").toLowerCase();
        if (typeStr.includes(CONFIG.DEPLOY_TYPE_CLIENT_KEYWORD)) clientDeploys++;
        if (typeStr.includes(CONFIG.DEPLOY_TYPE_SERVER_KEYWORD)) serverDeploys++;
        if (typeStr.includes(CONFIG.DEPLOY_TYPE_MCP_KEYWORD)) mcpDeploys++;
    });
    const totalDeployRecordsImpactingScore = buildsToScore.length;
    if (totalDeployRecordsImpactingScore === 0) return 100;
    const W = deployConfigWeights;
    const weightedSumOfActualDeploys = (clientDeploys * W.CLIENT) + (serverDeploys * W.SERVER) + (mcpDeploys * W.MCP);
    const maxPossibleWeightedImpact = totalDeployRecordsImpactingScore * W.CLIENT;
    if (maxPossibleWeightedImpact === 0) return (weightedSumOfActualDeploys > 0) ? 0 : 100;
    let scoreFraction = weightedSumOfActualDeploys / maxPossibleWeightedImpact;
    if (isNaN(scoreFraction) || !isFinite(scoreFraction)) {
        console.error(`_computeDeployScore: scoreFraction is NaN or Infinity (${scoreFraction})!`);
        scoreFraction = 1;
    }
    let score = (1 - scoreFraction) * 100;
    return Math.round(Math.max(0, Math.min(100, score)));
}

function _computeIntegrationScore(integrationsToScore, integrationConfigWeights, integrationFields) {
    if (!Array.isArray(integrationsToScore) || integrationsToScore.length === 0) return 100;
    const W = integrationConfigWeights;
    if (!W || typeof W.HL !== 'number' || typeof W.PD !== 'number' || typeof W.CERT !== 'number' || typeof W.LIVE !== 'number' || typeof W.MAX_POSSIBLE_PER_ITEM !== 'number') {
        console.error("_computeIntegrationScore: Invalid SCORE_WEIGHTS.INTEGRATION config!");
        return 0;
    }
    const total = integrationsToScore.length;
    const hl = integrationsToScore.filter(r => r.getCellValue(integrationFields.HL_TO_PD_FLAG)).length;
    const pd = integrationsToScore.filter(r => r.getCellValue(integrationFields.PD_TO_CERT_SUB_FLAG)).length;
    const cert = integrationsToScore.filter(r => r.getCellValue(integrationFields.CERT_SUB_TO_LIVE_FLAG)).length;
    const live = integrationsToScore.filter(r => r.getCellValue(integrationFields.LIVE_PLUS_FLAG)).length;
    const weightedSum = (hl * W.HL) + (pd * W.PD) + (cert * W.CERT) + (live * W.LIVE);
    const maxPossibleWeight = total * W.MAX_POSSIBLE_PER_ITEM;
    if (maxPossibleWeight === 0) return 100;
    let score = (1 - (weightedSum / maxPossibleWeight)) * 100;
    if (isNaN(score) || !isFinite(score)) {
        console.error(`_computeIntegrationScore: Score is NaN or Infinity (${score})!`);
        return 0;
    }
    return Math.round(Math.max(0, Math.min(100, score)));
}

function _computeSHScore(shToScore, shConfigWeights, shFields) {
    if (!Array.isArray(shToScore) || shToScore.length === 0) return 100;
    const W = shConfigWeights;
    if (!W || typeof W.SEV1 !== 'number' || typeof W.SEV2 !== 'number' || typeof W.SEV3 !== 'number' || typeof W.SEV4 !== 'number' || typeof W.MAX_POSSIBLE_PER_ITEM !== 'number') {
        console.error("_computeSHScore: Invalid SCORE_WEIGHTS.SH config!");
        return 0;
    }
    const total = shToScore.length;
    const sev1 = shToScore.filter(r => _safeGet(r, shFields.SEVERITY_NORMALIZED) === CONFIG.SH_SEVERITIES_ORDER[0]).length;
    const sev2 = shToScore.filter(r => _safeGet(r, shFields.SEVERITY_NORMALIZED) === CONFIG.SH_SEVERITIES_ORDER[1]).length;
    const sev3 = shToScore.filter(r => _safeGet(r, shFields.SEVERITY_NORMALIZED) === CONFIG.SH_SEVERITIES_ORDER[2]).length;
    const sev4 = shToScore.filter(r => _safeGet(r, shFields.SEVERITY_NORMALIZED) === CONFIG.SH_SEVERITIES_ORDER[3]).length;
    const weightedSum = (sev1 * W.SEV1) + (sev2 * W.SEV2) + (sev3 * W.SEV3) + (sev4 * W.SEV4);
    const maxPossibleWeight = total * W.MAX_POSSIBLE_PER_ITEM;
    if (maxPossibleWeight === 0) return 100;
    let score = (1 - (weightedSum / maxPossibleWeight)) * 100;
    if (isNaN(score) || !isFinite(score)) {
        console.error(`_computeSHScore: Score is NaN or Infinity (${score})!`);
        return 0;
    }
    return Math.round(Math.max(0, Math.min(100, score)));
}

function calculateRQAByMilestone(rqaRecords, specificBuildRecord) {
    if (!specificBuildRecord || !rqaRecords.length) return [];
    const milestones = [
        { name: "Hard Lock → Pencils Down", startField: FIELDS.MS_HARD_LOCK, endField: FIELDS.MS_PENCILS_DOWN },
        { name: "Pencils Down → Cert Sub", startField: FIELDS.MS_PENCILS_DOWN, endField: FIELDS.MS_CERT },
        { name: "Cert Sub → Live", startField: FIELDS.MS_CERT, endField: FIELDS.MS_LIVE },
        { name: "Post-Live", startField: FIELDS.MS_LIVE, endField: null }
    ];
    return milestones.map(milestone => {
        const startDate = specificBuildRecord.getCellValue(milestone.startField);
        const endDate = milestone.endField ? specificBuildRecord.getCellValue(milestone.endField) : new Date();

        if (!startDate) return { name: milestone.name, count: 0 };

        const count = rqaRecords.filter(r => {
            const createdDate = r.getCellValue(FIELDS.RQA_CREATED);
            if (!createdDate) return false;
            const created = new Date(createdDate);
            const start = new Date(startDate);
            const end = endDate ? new Date(endDate) : new Date();
            return created >= start && created <= end;
        }).length;
        return { name: milestone.name, count };
    });
}

//==================================================
// SECTION: MARKDOWN REPORT GENERATION
//==================================================
function generateMarkdownReport(data) {
    const md = [];
    try {
        md.push(`# Release Report – Version ${formatVersion(data.targetVersion) || 'N/A'}`);
        const overallScoreDisplay = data.scoresSection && data.scoresSection.overallScoreDisplay ? data.scoresSection.overallScoreDisplay : "N/A";
        md.push(`\n# ${CONFIG.EMOJIS.CHART || '📊'} Release Score: ${overallScoreDisplay}`);
        md.push(`_Note: 🟢 Green > 80, 🟡 Yellow 50–80, 🔴 Red < 50_`);
        if (data.scoresSection && Array.isArray(data.scoresSection.scores)) {
            data.scoresSection.scores.forEach(scoreItem => {
                if (scoreItem.metric !== "Overall Score") {
                    md.push(`**${scoreItem.metric}:** ${scoreItem.scoreDisplay}`);
                    if (scoreItem.notes) md.push(`_${scoreItem.notes}_\n`);
                }
            });
        } else {
            md.push("*No detailed score data available.*");
        }
        md.push("---");

        if (data.actionableInsightsSection) {
            md.push(`## ${CONFIG.EMOJIS.INFO || 'ℹ️'} Insights`);
            if (Array.isArray(data.actionableInsightsSection.points) && data.actionableInsightsSection.points.length > 0) {
                data.actionableInsightsSection.points.forEach(point => {
                    if (typeof point === 'string') {
                        md.push(point);
                    } else if (point.text) {
                        md.push(point.text);
                    } else {
                        md.push(String(point));
                    }
                });
            } else {
                md.push("- *No specific insights identified for this cycle based on current criteria.*");
            }
            md.push("---");
        }

        if (data.deploysSection) {
            md.push(`## ${data.deploysSection.title || CONFIG.EMOJIS.ROCKET + ' Deploys'}`);
            md.push(`**Summary:**`);
            md.push(`- Total Deploys: ${data.deploysSection.deploysByType.reduce((sum, item) => sum + item.count, 0)}`);
            
            // Always show comparison as a bullet
            if (data.deploysSection.previousReleaseDeploySummary) {
                const comparisonMatch = data.deploysSection.previousReleaseDeploySummary.match(/This release shows a (.+)\./);
                if (comparisonMatch) {
                    md.push(`- This release shows a ${comparisonMatch[1]}`);
                }
                // Extract just the previous release data without the comparison sentence
                const previousDetails = data.deploysSection.previousReleaseDeploySummary.split('\n')[0].replace(/This release shows a .+\.$/, '').trim();
                if (previousDetails) {
                    md.push(`- ${previousDetails.replace(/^_|_$/g, '')}`);
                }
            } else {
                // Even if no previous data, show that there's no comparison available
                md.push(`- No previous release data available for comparison`);
            }
            
            md.push(''); 
            md.push(`**Deploys by Type:**`);
            data.deploysSection.deploysByType.forEach(item => {
                md.push(`- **${item.name}:** ${item.count}`);
            });
            if (data.deploysSection.deployList && data.deploysSection.deployList.length > 0) {
                md.push(''); 
                md.push(`**Deploy Dates and Release Tickets:**`);
                data.deploysSection.deployList.forEach(deployItem => {
                    let deployLine = `- ${deployItem.date} - ${deployItem.summary} (${deployItem.type})`;
                    if (deployItem.jiraLink) {
                        deployLine += ` - [Jira Link](${deployItem.jiraLink})`;
                    }
                    md.push(deployLine);
                });
            } else {
                md.push(''); 
                md.push(`**Deploy Dates and Release Tickets:**`);
                md.push("- *No specific deploy events listed.*");
            }
            if (data.deploysSection.rqaWhitegloveSection) {
                md.push(''); 
                md.push(`**RQA Whiteglove Summary:**`);
                const rqaData = data.deploysSection.rqaWhitegloveSection;
                if (rqaData.totalWhitegloves !== undefined) {
                    md.push(`- **Total Whitegloves:** ${rqaData.totalWhitegloves}`);
                    md.push(`- **Unplanned/Rebuild Whitegloves:** ${rqaData.unplannedWhitegloves + rqaData.rebuildWhitegloves}`);
                    if (rqaData.byMilestone) {
                        md.push(''); 
                        md.push(`**RQA Whitegloves by Milestone Period:**`);
                        rqaData.byMilestone.forEach(milestone => {
                            md.push(`- **${milestone.name}:** ${milestone.count}`);
                        });
                    }
                } else {
                    md.push("- *No RQA Whiteglove data available.*");
                }
            }
            md.push("---");
        }

        if (data.integrationSection) {
            md.push(`## ${data.integrationSection.title || CONFIG.EMOJIS.LINK + ' Integrations'}`);
            md.push(`**Summary:**`);
            if (data.integrationSection.totalIntegrationsText) {
                const totalText = data.integrationSection.totalIntegrationsText.replace(/Total Integrations: \*\*(\d+)\*\*/, '**Total Integration Requests:** $1');
                md.push(`- ${totalText}`);
            }
            if (data.integrationSection.previousReleaseIntegrationSummary) {
                md.push(`- ${data.integrationSection.previousReleaseIntegrationSummary.replace(/^_|_$/g, '').replace(/integrations/g, 'integration requests')}`);
            }
            
            if (data.integrationSection.requestsByMilestoneTable) {
                md.push(''); 
                md.push(`**Integration Requests by Milestone Period:**`);
                
                // Add Pre-Hard Lock if available
                if (data.integrationSection.preHLData) {
                    const preHL = data.integrationSection.preHLData;
                    md.push(`**Pre-Hard Lock:**`);
                    md.push(`- Total Commits: ${preHL.commits}`);
                    md.push(`- Integration Requests: ${preHL.integrations} (${preHL.percent}% of all integration requests)`);
                    if (preHL.commits > 0) {
                        md.push(`- Integration Rate: ${preHL.integrationRate}% of commits`);
                        md.push(`- Direct Commits: ${preHL.commitsNotInIntegrations}`);
                    }
                }
                
                data.integrationSection.requestsByMilestoneTable.data.forEach(row => {
                    md.push(`**${row.name}:**`);
                    md.push(`- Total Commits: ${row.commits}`);
                    md.push(`- Integration Requests: ${row.count} (${row.percent}% of all integration requests)`);
                    if (row.commits > 0) {
                        md.push(`- Integration Rate: ${row.integrationRate}% of commits`);
                        md.push(`- Direct Commits: ${row.commitsNotInIntegrations}`);
                    }
                    if (row.platformBreakdown) {
                        if (row.platformBreakdown.client > 0) md.push(`  - Client: ${row.platformBreakdown.client}`);
                        if (row.platformBreakdown.server > 0) md.push(`  - Server: ${row.platformBreakdown.server}`);
                        if (row.platformBreakdown.mcp > 0) md.push(`  - MCP: ${row.platformBreakdown.mcp}`);
                    }
                });
                
                // Add overall summary if available
                if (data.integrationSection.totalCommits > 0) {
                    md.push('');
                    md.push(`**Overall Commit Activity:**`);
                    md.push(`- Total Commits: ${data.integrationSection.totalCommits}`);
                    md.push(`- Total Integration Requests: ${data.integrationSection.totalIntegrations}`);
                    md.push(`- Overall Integration Rate: ${Math.round((data.integrationSection.totalIntegrations / data.integrationSection.totalCommits) * 100)}%`);
                    md.push(`- Direct Commits (No Integration): ${data.integrationSection.totalCommitsNotInIntegrations}`);
                }
            }
            
            if (data.integrationSection.requestsByProductTable) {
                md.push(''); 
                md.push(`**${data.integrationSection.requestsByProductTable.title}**`);
                data.integrationSection.requestsByProductTable.data.forEach(row => {
                    md.push(`- **${row.name}:** ${row.count} (${row.percent}%)`);
                });
            }
            if (data.integrationSection.requestsByTypeTable) {
                md.push(''); 
                md.push(`**${data.integrationSection.requestsByTypeTable.title}**`);
                data.integrationSection.requestsByTypeTable.data.forEach(row => {
                    md.push(`- **${row.name}:** ${row.count} (${row.percent}%)`);
                });
            }
            if (data.integrationSection.jiraLink) {
                md.push(''); 
                md.push(`[View ${formatVersion(data.targetVersion)} Integration Requests in Jira](${data.integrationSection.jiraLink})`);
            }
            md.push("---");
        }

        if (data.shSection) {
            md.push(`## ${data.shSection.title || CONFIG.EMOJIS.EXCLAMATION + ' ShitHappens'}`);
            md.push(`**Summary:**`);
            if (data.shSection.totalShText) {
                md.push(`- **Total ShitHappens:** ${data.shSection.totalShText.replace(/Total ShitHappens: /, '')}`);
            }
            data.shSection.notes.forEach(note => {
                if (note.labelForBold === "Pre-Live ShitHappens" || note.labelForBold === "Post-Live ShitHappens") {
                    md.push(`- ${note.text}`);
                }
            });
            if (data.shSection.previousReleaseShSummary) {
                md.push(`- ${data.shSection.previousReleaseShSummary.replace(/^_|_$/g, '')}`);
            }
            if (data.shSection.bySeverityTable) {
                md.push(''); 
                md.push(`**ShitHappens by Severity:**`);
                data.shSection.bySeverityTable.data.forEach(row => {
                    md.push(`- **${row.severity}:** ${row.count} (${row.percent}%)`);
                });
            }
            if (data.shSection.resolutionBySeverityTable && data.shSection.resolutionBySeverityTable.data.length > 0) {
                md.push(''); 
                md.push(`**Resolution Time by Severity:**`);
                data.shSection.resolutionBySeverityTable.data.forEach(row => {
                    const avgDays = row.avgResolutionDays === '-' || row.avgResolutionDays === '0' ? 'N/A' : row.avgResolutionDays;
                    const medianDays = row.medianResolutionDays === '-' || row.medianResolutionDays === '0' ? 'N/A' : row.medianResolutionDays;
                    md.push(`- **${row.severity}:** Avg ${avgDays} days / Median ${medianDays} days`);
                });
            }
            if (data.shSection.byComponentTable) {
                md.push(''); 
                md.push(`**ShitHappens by Component (Top 5):**`);
                data.shSection.byComponentTable.data.forEach(row => {
                    md.push(`**${row.component}:**`);
                    md.push(`- Total ShitHappens: ${row.totalCount}`);
                    md.push(`- Severity breakdown: S1: ${row.sev1}, S2: ${row.sev2}, S3: ${row.sev3}, S4: ${row.sev4}`);
                    md.push(`- Percentage of all ShitHappens: ${row.percent}%`);
                });
            }
            if (data.shSection.byRootCauseTable) {
                md.push(''); 
                md.push(`**ShitHappens by Root Cause:**`);
                data.shSection.byRootCauseTable.data.forEach(row => {
                    md.push(`- **${row.name}:** ${row.count} (${row.percent}%)`);
                });
            }
            if (data.shSection.jiraLink) {
                md.push(''); 
                md.push(`[View ${formatVersion(data.targetVersion)} ShitHappens in Jira](${data.shSection.jiraLink})`);
            }
            md.push("---");
        }

        // Open Issue Triaging before Hotfixes
        if (data.issueTriagingSection) {
            md.push(`## 📋 Open Issue Triaging`);
            md.push(`**Work Summary:**`);
            md.push(`- **Planned Work:** ${data.issueTriagingSection.plannedWork} issues${data.issueTriagingSection.plannedWorkLink ? ` [View](${data.issueTriagingSection.plannedWorkLink})` : ''}`);
            md.push(`- **Completed Work:** ${data.issueTriagingSection.completedWork} (${data.issueTriagingSection.completionRate}%)${data.issueTriagingSection.completedWorkLink ? ` [View](${data.issueTriagingSection.completedWorkLink})` : ''}`);
            md.push(`- **Completed On Time:** ${data.issueTriagingSection.completedOnTime} (${data.issueTriagingSection.onTimeRate}% of completed)${data.issueTriagingSection.completedOnTimeLink ? ` [View](${data.issueTriagingSection.completedOnTimeLink})` : ''}`);
            md.push(`- **Completed Late:** ${data.issueTriagingSection.completedLate} (${data.issueTriagingSection.lateRate}% of completed)${data.issueTriagingSection.completedLateLink ? ` [View](${data.issueTriagingSection.completedLateLink})` : ''}`);
            
            md.push('');
            md.push(`**Open Issues:**`);
            md.push(`- **Open Beyond Hard Lock:** ${data.issueTriagingSection.openBeyondHL}${data.issueTriagingSection.openBeyondHLLink ? ` [View](${data.issueTriagingSection.openBeyondHLLink})` : ''}`);
            md.push(`- **Open Beyond Pencils Down:** ${data.issueTriagingSection.openBeyondPD}${data.issueTriagingSection.openBeyondPDLink ? ` [View](${data.issueTriagingSection.openBeyondPDLink})` : ''}`);
            md.push(`- **All Punted Work:** ${data.issueTriagingSection.puntedWork} issues (${data.issueTriagingSection.puntedRate}%)${data.issueTriagingSection.puntedWorkLink ? ` [View](${data.issueTriagingSection.puntedWorkLink})` : ''}`);
            md.push("---");
        }

        if (data.hotfixSection) {
            md.push(`## ${data.hotfixSection.title || CONFIG.EMOJIS.FIRE + ' Hotfixes'}`);
            md.push(`**Summary:**`);
            if (data.hotfixSection.totalHotfixesText) {
                const totalText = data.hotfixSection.totalHotfixesText.replace(/Total Hotfixes: \*\*(\d+)\*\*/, '**Total Hotfixes:** $1');
                md.push(`- ${totalText}`);
            }
            data.hotfixSection.notes.forEach(note => {
                if (note.labelForBold !== "Total Hotfixes") {
                    md.push(`- ${note.text}`);
                }
            });
            if (data.hotfixSection.previousReleaseHotfixSummary) {
                md.push(`- ${data.hotfixSection.previousReleaseHotfixSummary.replace(/^_|_$/g, '')}`);
            }
            if (data.hotfixSection.byUrgencyTable) {
                const orderedUrgencyData = CONFIG.HOTFIX_URGENCIES_ORDER
                    .map(urgencyName => data.hotfixSection.byUrgencyTable.data.find(item => item.name === urgencyName))
                    .filter(Boolean);
                const displayUrgencyTable = { ...data.hotfixSection.byUrgencyTable, data: orderedUrgencyData.length > 0 ? orderedUrgencyData : data.hotfixSection.byUrgencyTable.data };
                md.push(''); 
                md.push(`**${displayUrgencyTable.title}**`);
                displayUrgencyTable.data.forEach(row => {
                    md.push(`- **${row.name}:** ${row.count} (${row.percent}%)`);
                });
            }
            if (data.hotfixSection.componentsTable) {
                md.push(''); 
                md.push(`**${data.hotfixSection.componentsTable.title}**`);
                data.hotfixSection.componentsTable.data.forEach(row => {
                    md.push(`- **${row.name}:** ${row.count} (${row.percent}%)`);
                });
            }
            if (data.hotfixSection.jiraLink) {
                md.push(''); 
                md.push(`[View ${formatVersion(data.targetVersion)} Hotfixes in Jira](${data.hotfixSection.jiraLink})`);
            }
            md.push("---");
        }

        if (data.keyDatesSection) {
            md.push(`## ${data.keyDatesSection.title || CONFIG.EMOJIS.CALENDAR + ' Milestones'}`);
            if (data.keyDatesSection.timelineSummary) {
                md.push(data.keyDatesSection.timelineSummary);
                md.push(''); 
            }
            if (data.keyDatesSection.data && data.keyDatesSection.data.length > 0) {
                data.keyDatesSection.data.forEach(item => {
                    if (item.type === "Build Milestone" || !item.type)
                        md.push(`- ${item.date} - ${item.event}`);
                });
            } else {
                md.push("- *No milestones data.*");
            }
        }

        if (data.generationTimestamp) md.push(`\n\n_${data.generationTimestamp}_`);
    } catch (error) {
        console.error("Critical Error within generateMarkdownReport:", error.message, error.stack);
        md.push("\n\n--- CRITICAL ERROR DURING MARKDOWN GENERATION OF ENTIRE REPORT ---");
        md.push(`Error: ${error.message}`);
    }
    return md.join('\n');
}

//==================================================
// SECTION: SCRIPT EXECUTION FLOW (MAIN FUNCTION)
//==================================================
async function main() {
    console.log("Starting Fortnite Release Report generation...");
    let scriptStartTime = Date.now();

    let inputConfig = input.config();
    let buildRecordId = inputConfig.buildRecordId;
    let currentTargetVersion;
    let specificBuildRecordForDates = null;
    const reportDataObject = {};
    let prevFullVersionForN1 = "";
    const SCRIPT_TABLES = {
        builds: base.getTable("Builds"),
        hotfixes: base.getTable("Hotfixes"),
        integrations: base.getTable("Integrations"),
        sh: base.getTable("ShitHappens"),
        generatedReports: base.getTable("Generated Reports"),
        rqa: base.getTable("RQA")
    };
    const SCRIPT_MS_FIELD_KEYS = [
        FIELDS.MS_FEATURE_COMPLETE, FIELDS.MS_BRANCH_CREATE, FIELDS.MS_BRANCH_OPEN,
        FIELDS.MS_DEV_COMPLETE, FIELDS.MS_HARD_LOCK, FIELDS.MS_PENCILS_DOWN,
        FIELDS.MS_CERT, FIELDS.MS_LIVE
    ].filter(Boolean);
    let previousReleaseCycleData = {
        overallScore: null,
        deployCounts: { major: 0, client: 0, server: 0, mcp: 0, oneP: 0, totalRelevant: 0 },
        hotfixCount: null,
        integrationCount: null,
        shCount: null
    };

    if (buildRecordId) {
        const fieldsToFetchForSingleRecord = [
            FIELDS.BUILD_VERSION_UNIFIED, 
            FIELDS.SEASON_UNIFIED, 
            ...SCRIPT_MS_FIELD_KEYS,
            FIELDS.COMMITS_PRE_HL,
            FIELDS.COMMITS_HL_TO_PD,
            FIELDS.COMMITS_PD_TO_CERT,
            FIELDS.COMMITS_CERT_TO_LIVE,
            FIELDS.COMMITS_LIVE_PLUS,
            FIELDS.PLANNED_WORK,
            FIELDS.PLANNED_WORK_LINK,
            FIELDS.COMPLETED_WORK,
            FIELDS.COMPLETED_WORK_LINK,
            FIELDS.COMPLETED_ON_TIME,
            FIELDS.COMPLETED_ON_TIME_LINK,
            FIELDS.COMPLETED_LATE,
            FIELDS.COMPLETED_LATE_LINK,
            FIELDS.OPEN_BEYOND_HL,
            FIELDS.OPEN_BEYOND_HL_LINK,
            FIELDS.OPEN_BEYOND_PD,
            FIELDS.OPEN_BEYOND_PD_LINK,
            FIELDS.ALL_PUNTED_WORK,
            FIELDS.ALL_PUNTED_WORK_LINK
        ].filter(Boolean);
        try {
            const tempRecord = await SCRIPT_TABLES.builds.selectRecordAsync(buildRecordId, { fields: fieldsToFetchForSingleRecord });
            if (tempRecord) {
                currentTargetVersion = tempRecord.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                specificBuildRecordForDates = tempRecord;
                if (!currentTargetVersion) { throw new Error(`Critical: Could not retrieve version name from record ID ${buildRecordId}.`); }
                console.log(`Targeting specific build record ID: ${buildRecordId}, Version: ${currentTargetVersion}`);
            } else { throw new Error(`Critical: Build record with ID ${buildRecordId} not found.`); }
        } catch (e) { console.error(`Error fetching specific build record ${buildRecordId}: ${e.message}`); throw e; }
    } else {
        console.log("No buildRecordId provided, attempting to find latest live version...");
        try {
            const latestBuildsQuery = await SCRIPT_TABLES.builds.selectRecordsAsync({
                fields: [FIELDS.BUILD_VERSION_UNIFIED, FIELDS.MS_LIVE, FIELDS.SEASON_UNIFIED, ...SCRIPT_MS_FIELD_KEYS],
                sorts: [{ field: FIELDS.MS_LIVE, direction: "desc" }], maxRecords: 1
            });
            if (latestBuildsQuery.records.length > 0) {
                currentTargetVersion = latestBuildsQuery.records[0].getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                specificBuildRecordForDates = latestBuildsQuery.records[0];
                console.log(`Using latest live version: ${currentTargetVersion}`);
            } else {
                throw new Error("No build records found with MS_LIVE date to determine latest version.");
            }
        } catch (e) {
            currentTargetVersion = "all";
            specificBuildRecordForDates = null;
            console.warn(`Fallback: Using 'all' as target version due to error: ${e.message}`);
        }
    }
    reportDataObject.targetVersion = currentTargetVersion;

    if (currentTargetVersion.toLowerCase() !== 'all' && SCRIPT_TABLES.generatedReports) {
        try {
            const previousReportsQuery = await SCRIPT_TABLES.generatedReports.selectRecordsAsync({
                fields: ["Version Covered", FIELD_NAME_FOR_OVERALL_SCORE_NUMERIC, "Generated Date"],
                sorts: [{ field: "Generated Date", direction: "desc" }]
            });
            const otherReports = previousReportsQuery.records.filter(r =>
                r.getCellValueAsString("Version Covered") !== currentTargetVersion &&
                r.getCellValue(FIELD_NAME_FOR_OVERALL_SCORE_NUMERIC) !== null);
            if (otherReports.length > 0) {
                previousReleaseCycleData.overallScore = otherReports[0].getCellValue(FIELD_NAME_FOR_OVERALL_SCORE_NUMERIC);
            }
        } catch (e) { console.warn("Could not fetch previous report overall score:", e.message); }
    }

    const buildsFieldsToSelect = [...new Set([
        FIELDS.BUILD_VERSION_UNIFIED, 
        FIELDS.DEPLOY_TYPE_DEPLOYS, 
        FIELDS.SUMMARY, 
        FIELDS.DEPLOY_DUE_DATE_TIME, 
        FIELDS.OPEN_IN_JIRA, 
        ...SCRIPT_MS_FIELD_KEYS,
        FIELDS.COMMITS_PRE_HL,
        FIELDS.COMMITS_HL_TO_PD,
        FIELDS.COMMITS_PD_TO_CERT,
        FIELDS.COMMITS_CERT_TO_LIVE,
        FIELDS.COMMITS_LIVE_PLUS,
        FIELDS.PLANNED_WORK,
        FIELDS.PLANNED_WORK_LINK,
        FIELDS.COMPLETED_WORK,
        FIELDS.COMPLETED_WORK_LINK,
        FIELDS.COMPLETED_ON_TIME,
        FIELDS.COMPLETED_ON_TIME_LINK,
        FIELDS.COMPLETED_LATE,
        FIELDS.COMPLETED_LATE_LINK,
        FIELDS.OPEN_BEYOND_HL,
        FIELDS.OPEN_BEYOND_HL_LINK,
        FIELDS.OPEN_BEYOND_PD,
        FIELDS.OPEN_BEYOND_PD_LINK,
        FIELDS.ALL_PUNTED_WORK,
        FIELDS.ALL_PUNTED_WORK_LINK
    ])].filter(Boolean);
    const hotfixesFieldsToSelect = [...new Set([FIELDS.BUILD_VERSION_UNIFIED, FIELDS.COMPONENT_S, FIELDS.QA_STATE, FIELDS.URGENCY_CUSTOM_FIELD, FIELDS.HOTFIX_CREATED_FIELD, FIELDS.HOTFIX_RESOLVED_FIELD])].filter(Boolean);
    const integrationsFieldsToSelect = [...new Set([FIELDS.BUILD_VERSION_UNIFIED, FIELDS.HL_TO_PD_FLAG, FIELDS.PD_TO_CERT_SUB_FLAG, FIELDS.CERT_SUB_TO_LIVE_FLAG, FIELDS.LIVE_PLUS_FLAG, FIELDS.INTEGRATION_AREA, FIELDS.INTEGRATION_PLATFORM, FIELDS.INTEGRATION_CREATED_FIELD, FIELDS.INTEGRATION_RESOLVED_FIELD])].filter(Boolean);
    const shFieldsToSelect = [...new Set([FIELDS.BUILD_VERSION_UNIFIED, FIELDS.SH_LABELS, FIELDS.SEVERITY_NORMALIZED, FIELDS.COMPONENT_S, FIELDS.PRE_SH_FLAG, FIELDS.SH_CREATED_FIELD, FIELDS.SH_RESOLVED_FIELD, FIELDS.SHITHAPPENS_ROOT_CAUSE])].filter(Boolean);
    const rqaFieldsToSelect = [...new Set([FIELDS.RQA_LABELS, FIELDS.RQA_FIX_VERSION, FIELDS.RQA_CREATED, FIELDS.RQA_RESOLVED])].filter(Boolean);
    let allBuildsQuery, allHotfixesQuery, allIntegrationsQuery, allSHQuery, allRQAQuery;
    console.log("Fetching data from Airtable tables...");
    try {
        [allBuildsQuery, allHotfixesQuery, allIntegrationsQuery, allSHQuery, allRQAQuery] = await Promise.all([
            SCRIPT_TABLES.builds.selectRecordsAsync({ fields: buildsFieldsToSelect }),
            SCRIPT_TABLES.hotfixes.selectRecordsAsync({ fields: hotfixesFieldsToSelect }),
            SCRIPT_TABLES.integrations.selectRecordsAsync({ fields: integrationsFieldsToSelect }),
            SCRIPT_TABLES.sh.selectRecordsAsync({ fields: shFieldsToSelect }),
            SCRIPT_TABLES.rqa ? SCRIPT_TABLES.rqa.selectRecordsAsync({ fields: rqaFieldsToSelect }) : Promise.resolve({ records: [] })
        ]);
    } catch (e) { console.error(`FATAL: Error during initial data fetching: ${e.message}`); throw e; }

    const allBuildsForVersion = _filterByVersion(allBuildsQuery?.records, FIELDS.BUILD_VERSION_UNIFIED, currentTargetVersion, currentTargetVersion);
    const hotfixesForVersion = _filterByVersion(allHotfixesQuery?.records, FIELDS.BUILD_VERSION_UNIFIED, currentTargetVersion, currentTargetVersion);
    const integrationsForVersion = _filterByVersion(allIntegrationsQuery?.records, FIELDS.BUILD_VERSION_UNIFIED, currentTargetVersion, currentTargetVersion);
    const shForVersion = _filterByVersion(allSHQuery?.records, FIELDS.BUILD_VERSION_UNIFIED, currentTargetVersion, currentTargetVersion)
        .filter(r => { const labels = r.getCellValue(FIELDS.SH_LABELS); return !(Array.isArray(labels) && labels.some(l => l && l.name && l.name.includes(CONFIG.EXCLUDED_LABEL_PART))); });
    const rqaForVersion = _filterRQAByVersion(allRQAQuery?.records, currentTargetVersion);

    const rqaWhitegloves = rqaForVersion.filter(r => Array.isArray(r.getCellValue(FIELDS.RQA_LABELS)) && r.getCellValue(FIELDS.RQA_LABELS).some(l => l.name === CONFIG.RQA_LABEL_WG));
    const unplannedWhitegloves = rqaWhitegloves.filter(r => Array.isArray(r.getCellValue(FIELDS.RQA_LABELS)) && r.getCellValue(FIELDS.RQA_LABELS).some(l => l.name === CONFIG.RQA_LABEL_UNPLANNED));
    const rebuildWhitegloves = rqaWhitegloves.filter(r => Array.isArray(r.getCellValue(FIELDS.RQA_LABELS)) && r.getCellValue(FIELDS.RQA_LABELS).some(l => l.name === CONFIG.RQA_LABEL_REBUILD));

    if (currentTargetVersion.toLowerCase() !== 'all') {
        try {
            const currentVersionParts = currentTargetVersion.split('.');
            if (currentVersionParts.length >= 1) {
                let major = parseInt(currentVersionParts[0], 10);
                if (!isNaN(major) && major > 0) {
                    let potentialPrevMajor = major - 1;
                    const prevMajorBuilds = (allBuildsQuery?.records || [])
                        .filter(r => _safeGet(r,FIELDS.BUILD_VERSION_UNIFIED).startsWith(potentialPrevMajor + "."))
                        .sort((a,b) => _safeGet(b,FIELDS.BUILD_VERSION_UNIFIED).localeCompare(_safeGet(a,FIELDS.BUILD_VERSION_UNIFIED), undefined, {numeric:true, sensitivity:'base'}));
                    if (prevMajorBuilds.length > 0) {
                        prevFullVersionForN1 = _safeGet(prevMajorBuilds[0],FIELDS.BUILD_VERSION_UNIFIED);
                        if(prevFullVersionForN1){
                            const prevHotfixes = _filterByVersion(allHotfixesQuery?.records, FIELDS.BUILD_VERSION_UNIFIED, prevFullVersionForN1);
                            const prevIntegrations = _filterByVersion(allIntegrationsQuery?.records, FIELDS.BUILD_VERSION_UNIFIED, prevFullVersionForN1);
                            const prevSH = _filterByVersion(allSHQuery?.records, FIELDS.BUILD_VERSION_UNIFIED, prevFullVersionForN1);
                            const prevBuilds = _filterByVersion(allBuildsQuery?.records, FIELDS.BUILD_VERSION_UNIFIED, prevFullVersionForN1);
                            previousReleaseCycleData.hotfixCount = prevHotfixes.length;
                            previousReleaseCycleData.integrationCount = prevIntegrations.length;
                            previousReleaseCycleData.shCount = prevSH.length;
                            prevBuilds.forEach(b => {
                                const typeStr = _safeGet(b, FIELDS.DEPLOY_TYPE_DEPLOYS, "").toLowerCase();
                                if (typeStr.includes(CONFIG.DEPLOY_TYPE_MAJOR_RELEASE_KEYWORD)) previousReleaseCycleData.deployCounts.major++;
                                if (typeStr.includes(CONFIG.DEPLOY_TYPE_1P_PUBLISH_KEYWORD)) previousReleaseCycleData.deployCounts.oneP++;
                                if (!typeStr.includes(CONFIG.DEPLOY_TYPE_1P_PUBLISH_KEYWORD)) {
                                    previousReleaseCycleData.deployCounts.totalRelevant++;
                                    if (typeStr.includes(CONFIG.DEPLOY_TYPE_CLIENT_KEYWORD)) previousReleaseCycleData.deployCounts.client++;
                                    if (typeStr.includes(CONFIG.DEPLOY_TYPE_SERVER_KEYWORD)) previousReleaseCycleData.deployCounts.server++;
                                    if (typeStr.includes(CONFIG.DEPLOY_TYPE_MCP_KEYWORD)) previousReleaseCycleData.deployCounts.mcp++;
                                }
                            });
                        } else { console.warn("prevFullVersionForN1 was not determined, skipping N-1 data population for counts."); }
                    } else { console.log(`No builds found for previous major version ${potentialPrevMajor}. N-1 data will be limited.`); }
                }
            }
        } catch (e) { console.warn("Could not fetch N-1 cycle data for counts:", e.message); }
    }

    let countMajorReleaseDeploys = 0; let count1PPublishDeploys = 0;
    allBuildsForVersion.forEach(b => {
        const typeStr = _safeGet(b, FIELDS.DEPLOY_TYPE_DEPLOYS, "").toLowerCase();
        if (typeStr.includes(CONFIG.DEPLOY_TYPE_MAJOR_RELEASE_KEYWORD)) countMajorReleaseDeploys++;
        if (typeStr.includes(CONFIG.DEPLOY_TYPE_1P_PUBLISH_KEYWORD)) count1PPublishDeploys++;
    });
    const relevantBuildsForDeployAnalysis = allBuildsForVersion.filter(b => !_safeGet(b, FIELDS.DEPLOY_TYPE_DEPLOYS, "").toLowerCase().includes(CONFIG.DEPLOY_TYPE_1P_PUBLISH_KEYWORD));

    console.log("Calculating scores...");
    const scores = {
        Integration: _computeIntegrationScore(integrationsForVersion, CONFIG.SCORE_WEIGHTS.INTEGRATION, FIELDS),
        Deploy: _computeDeployScore(relevantBuildsForDeployAnalysis, CONFIG.SCORE_WEIGHTS.DEPLOY, FIELDS.DEPLOY_TYPE_DEPLOYS),
        SH: _computeSHScore(shForVersion, CONFIG.SCORE_WEIGHTS.SH, FIELDS)
    };
    const overall = (typeof scores.Integration === 'number' && typeof scores.Deploy === 'number' && typeof scores.SH === 'number' &&
        !isNaN(scores.Integration) && !isNaN(scores.Deploy) && !isNaN(scores.SH))
        ? Math.round((scores.Integration + scores.Deploy + scores.SH) / 3) : null;
    reportDataObject.overallScoreValue = overall;

    console.log("Populating report data object sections...");
    reportDataObject.scoresSection = {
        overallScoreDisplay: formatScoreDisplay(overall, "Overall Score"),
        scores: [
            { metric: "Integration Score", scoreDisplay: formatScoreDisplay(scores.Integration), notes: "The later the request, the more weighted." },
            { metric: "Deploy Score", scoreDisplay: formatScoreDisplay(scores.Deploy), notes: "Based on Client, Server, MCP deploy types (excludes 1P Publish)." },
            { metric: "ShitHappens Score", scoreDisplay: formatScoreDisplay(scores.SH), notes: "Weighted by severity." },
        ]
    };

    let keyDatesData = [];
    const milestoneFieldsInBuilds = SCRIPT_MS_FIELD_KEYS.map(fieldKey => ({ name: Object.keys(FIELDS).find(key => FIELDS[key] === fieldKey)?.replace(/^MS_/, '').replace(/_/g, ' ') || fieldKey, fieldKey }));
    const buildsToScanForMilestones = (specificBuildRecordForDates && currentTargetVersion.toLowerCase() !== "all") ? [specificBuildRecordForDates] : allBuildsForVersion;
    buildsToScanForMilestones.forEach(buildRecord => {
        const buildVersionForDate = _safeGet(buildRecord, FIELDS.BUILD_VERSION_UNIFIED, currentTargetVersion);
        milestoneFieldsInBuilds.forEach(mf => { const dateValue = buildRecord.getCellValue(mf.fieldKey); if (dateValue) keyDatesData.push({ event: `${mf.name} (${formatVersion(buildVersionForDate)})`, date: _MMDDYYYY(dateValue), type: "Build Milestone" }); });
    });
    keyDatesData.sort((a, b) => { try { const dA = new Date(a.date), dB = new Date(b.date); return dA - dB; } catch(e){return 0;} });
    let timelineSummary = "";
    if (specificBuildRecordForDates && currentTargetVersion.toLowerCase() !== "all") {
        const featureComplete = specificBuildRecordForDates.getCellValue(FIELDS.MS_FEATURE_COMPLETE);
        const liveDate = specificBuildRecordForDates.getCellValue(FIELDS.MS_LIVE);
        if (featureComplete && liveDate) {
            const startDate = new Date(featureComplete);
            const endDate = new Date(liveDate);
            const cycleDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
            timelineSummary = `${_MMDDYYYY(featureComplete)}: Feature Complete → ${_MMDDYYYY(liveDate)}: Live *(${cycleDays}-day cycle)*`;
        }
    }
    reportDataObject.keyDatesSection = { title: `${CONFIG.EMOJIS.CALENDAR} Milestones`, data: keyDatesData, timelineSummary: timelineSummary, noDataMessage: "- *No milestone data available.*" };
    
    const deployCountsForDisplay = { Client: 0, Server: 0, MCP: 0 };
    relevantBuildsForDeployAnalysis.forEach(b => {
        const typeStr = _safeGet(b, FIELDS.DEPLOY_TYPE_DEPLOYS, "").toLowerCase();
        if (typeStr.includes(CONFIG.DEPLOY_TYPE_CLIENT_KEYWORD)) deployCountsForDisplay.Client++;
        if (typeStr.includes(CONFIG.DEPLOY_TYPE_SERVER_KEYWORD)) deployCountsForDisplay.Server++;
        if (typeStr.includes(CONFIG.DEPLOY_TYPE_MCP_KEYWORD)) deployCountsForDisplay.MCP++;
    });
    let prevDeploySummary = "";
    if (prevFullVersionForN1 && previousReleaseCycleData.deployCounts) {
        const prevCounts = previousReleaseCycleData.deployCounts;
        const currentTotalRelevant = relevantBuildsForDeployAnalysis.length;
        const diff = prevCounts.totalRelevant === 0 ? (currentTotalRelevant > 0 ? Infinity : 0) : ((currentTotalRelevant - prevCounts.totalRelevant) / prevCounts.totalRelevant) * 100;
        const diffText = isFinite(diff) ? `${diff.toFixed(0)}% ${diff >= 0 ? 'increase' : 'decrease'}` : (currentTotalRelevant > 0 ? 'increase from zero' : 'same (zero)');
        prevDeploySummary = `_Previous Release (${formatVersion(prevFullVersionForN1)}) had ${prevCounts.major} Major, ${prevCounts.client} Client, ${prevCounts.server} Server, ${prevCounts.mcp} MCP, and ${prevCounts.oneP} 1P Publish deploys.\nThis release shows a ${diffText} in overall deploys._`;
    }
    const rqaByMilestoneData = calculateRQAByMilestone(rqaWhitegloves, specificBuildRecordForDates);
    reportDataObject.deploysSection = {
        title: `${CONFIG.EMOJIS.ROCKET} Deploys`,
        deploysByType: [ { name: "Major Release", count: countMajorReleaseDeploys }, { name: "Client", count: deployCountsForDisplay.Client }, { name: "Server", count: deployCountsForDisplay.Server }, { name: "MCP", count: deployCountsForDisplay.MCP }, { name: "1P Publish", count: count1PPublishDeploys } ],
        previousReleaseDeploySummary: prevDeploySummary,
        deployList: relevantBuildsForDeployAnalysis.filter(b => _safeGet(b, FIELDS.SUMMARY, "") && b.getCellValue(FIELDS.DEPLOY_DUE_DATE_TIME)).map(b => ({ date: _MMDDYYYY(b.getCellValue(FIELDS.DEPLOY_DUE_DATE_TIME)), summary: _safeGet(b, FIELDS.SUMMARY), type: _safeGet(b, FIELDS.DEPLOY_TYPE_DEPLOYS, "General Deploy"), jiraLink: _safeGet(b, FIELDS.OPEN_IN_JIRA, null) })).sort((a, b) => { try { return new Date(a.date) - new Date(b.date); } catch (e) { return 0; } }),
        rqaWhitegloveSection: { totalWhitegloves: rqaWhitegloves.length, unplannedWhitegloves: unplannedWhitegloves.length, rebuildWhitegloves: rebuildWhitegloves.length, byMilestone: rqaByMilestoneData }
    };

    const hotfixesByUrgencyCounts = {};
    hotfixesForVersion.forEach(r => { const urgency = _safeGet(r, FIELDS.URGENCY_CUSTOM_FIELD, CONFIG.HOTFIX_URGENCIES_ORDER.at(-1)); hotfixesByUrgencyCounts[urgency] = (hotfixesByUrgencyCounts[urgency] || 0) + 1; });
    const hotfixesByUrgencyTableData = Object.entries(hotfixesByUrgencyCounts).map(([name, count]) => ({ name, count, percent: _formatPercent(count, hotfixesForVersion.length) }));
    const qaVerified_hotfix = hotfixesForVersion.filter(r => { const state = _safeGet(r, FIELDS.QA_STATE, "").toLowerCase(); return state.includes("ready") || state.includes("verified"); }).length;
    const qaPercent_hotfix = _formatPercent(qaVerified_hotfix, hotfixesForVersion.length);
    let avgResTime_hotfix = null, medianResTime_hotfix = null;
    if (hotfixesForVersion.length > 0) {
        const times = hotfixesForVersion.filter(r => _safeGet(r, FIELDS.URGENCY_CUSTOM_FIELD) !== "Scheduled").map(r => { const cr = r.getCellValue(FIELDS.HOTFIX_CREATED_FIELD), rs = r.getCellValue(FIELDS.HOTFIX_RESOLVED_FIELD); if(cr&&rs){try{const d = new Date(rs).getTime()-new Date(cr).getTime(); return d>=0 ? d/36e5:null;}catch(e){return null;}} return null;}).filter(x=>x!==null&&!isNaN(x));
        if(times.length>0){avgResTime_hotfix=(times.reduce((a,b)=>a+b,0)/times.length).toFixed(1); const sT=[...times].sort((a,b)=>a-b); medianResTime_hotfix=sT[Math.floor(sT.length/2)].toFixed(1);}
    }
    const asapHotfixes = hotfixesForVersion.filter(r => _safeGet(r, FIELDS.URGENCY_CUSTOM_FIELD) === CONFIG.ASAP_URGENCY_VALUE).length;
    let asapComparison = ""; 
    let prevHotfixSummary = ""; 
    if (prevFullVersionForN1 && previousReleaseCycleData.hotfixCount !== null) {
        const prevHotfixes = _filterByVersion(allHotfixesQuery?.records, FIELDS.BUILD_VERSION_UNIFIED, prevFullVersionForN1);
        const prevAsapHotfixes = prevHotfixes.filter(r => _safeGet(r, FIELDS.URGENCY_CUSTOM_FIELD) === CONFIG.ASAP_URGENCY_VALUE).length;
        const asapDiff = prevAsapHotfixes === 0 ? (asapHotfixes > 0 ? Infinity : 0) : ((asapHotfixes - prevAsapHotfixes) / prevAsapHotfixes) * 100;
        const asapDiffText = isFinite(asapDiff) ? `${asapDiff.toFixed(0)}% ${asapDiff >= 0 ? 'increase' : 'decrease'}` : (asapHotfixes > 0 ? 'increase from zero' : 'same (zero)');
        asapComparison = ` ASAP hotfixes: ${asapHotfixes} vs ${prevAsapHotfixes} (${asapDiffText}).`;
        const diff = previousReleaseCycleData.hotfixCount === 0 ? (hotfixesForVersion.length > 0 ? Infinity : 0) : ((hotfixesForVersion.length - previousReleaseCycleData.hotfixCount) / previousReleaseCycleData.hotfixCount) * 100;
        const diffText_overall = isFinite(diff) ? `${diff.toFixed(0)}% ${diff >= 0 ? 'increase' : 'decrease'}` : (hotfixesForVersion.length > 0 ? 'increase from zero' : 'same (zero)');
        prevHotfixSummary = `_Previous Release (${formatVersion(prevFullVersionForN1)}) had ${previousReleaseCycleData.hotfixCount} hotfixes. This release shows a ${diffText_overall}.${asapComparison}_`;
    }
    const hotfixJiraLink = currentTargetVersion.toLowerCase() === 'all' ? null : `${CONFIG.JIRA_BASE_URL}/issues/?filter=${CONFIG.JIRA_HOTFIX_FILTER_ID}&jql=project%20%3D%20ERM%20AND%20issuetype%20in%20(%22Data%20Asset%20Directory%20(DAD)%20Change%22%2C%20Hotfix)%20AND%20fixVersion%20%3D%20${encodeURIComponent(currentTargetVersion)}%20ORDER%20BY%20created%20DESC`;
    reportDataObject.hotfixSection = { title: `${CONFIG.EMOJIS.FIRE} Hotfixes`, totalHotfixesText: `Total Hotfixes: **${hotfixesForVersion.length}**`, notes: [{ text: `QA Verified: **${qaVerified_hotfix} of ${hotfixesForVersion.length}** (${qaPercent_hotfix}%)`, labelForBold: "QA Verified" }, { text: `Avg Resolution (non-scheduled): **${avgResTime_hotfix || '-'} hrs**${medianResTime_hotfix ? ` (Median: **${medianResTime_hotfix} hrs**)` : ""}`, labelForBold: "Avg Resolution (non-scheduled)" }].filter(Boolean), previousReleaseHotfixSummary: prevHotfixSummary, byUrgencyTable: { title: "Hotfixes by Urgency:", data: hotfixesByUrgencyTableData, noDataMessage: "- *No hotfix data by urgency.*" }, componentsTable: { title: "Hotfixes by Component (Top 5):", data: _countBy(hotfixesForVersion, FIELDS.COMPONENT_S).map(item => ({ ...item, percent: _formatPercent(item.count, hotfixesForVersion.length) })), noDataMessage: "- *No component data.*" }, jiraLink: hotfixJiraLink };
    
    const calculatePlatformBreakdown = (records) => {
        let client = 0, server = 0, mcp = 0;
        records.forEach(r => {
            const platform = _safeGet(r, FIELDS.INTEGRATION_PLATFORM, "").toLowerCase();
            if (platform.includes(CONFIG.DEPLOY_TYPE_CLIENT_KEYWORD)) client++;
            if (platform.includes(CONFIG.DEPLOY_TYPE_SERVER_KEYWORD)) server++;
            if (platform.includes(CONFIG.DEPLOY_TYPE_MCP_KEYWORD)) mcp++;
        });
        return { client, server, mcp };
    };

    const totalIntegrations = integrationsForVersion.length;
    
    // Enhanced milestone integration data with commits
    const milestoneIntegrationData = ["HL_TO_PD_FLAG", "PD_TO_CERT_SUB_FLAG", "CERT_SUB_TO_LIVE_FLAG", "LIVE_PLUS_FLAG"].map((flagFieldKey, index) => {
        const milestoneNameMap = ["Hard Lock → Pencils Down", "Pencils Down → Cert Sub", "Cert Sub → Live", "Post-Live"];
        const commitFieldMap = [FIELDS.COMMITS_HL_TO_PD, FIELDS.COMMITS_PD_TO_CERT, FIELDS.COMMITS_CERT_TO_LIVE, FIELDS.COMMITS_LIVE_PLUS];
        
        const recordsForMilestone = integrationsForVersion.filter(r => r.getCellValue(FIELDS[flagFieldKey]));
        const commits = specificBuildRecordForDates ? 
            (specificBuildRecordForDates.getCellValue(commitFieldMap[index]) || 0) : 0;
        const integrationCount = recordsForMilestone.length;
        const commitsNotInIntegrations = Math.max(0, commits - integrationCount);
        const integrationRate = commits > 0 ? Math.round((integrationCount / commits) * 100) : 0;
        
        return {
            name: milestoneNameMap[index],
            count: integrationCount,
            percent: _formatPercent(integrationCount, totalIntegrations),
            platformBreakdown: calculatePlatformBreakdown(recordsForMilestone),
            commits: commits,
            commitsNotInIntegrations: commitsNotInIntegrations,
            integrationRate: integrationRate
        };
    });
    
    // Add Pre-Hard Lock data
    const preHLCommits = specificBuildRecordForDates ? 
        (specificBuildRecordForDates.getCellValue(FIELDS.COMMITS_PRE_HL) || 0) : 0;
    const preHLIntegrations = integrationsForVersion.filter(r => 
        !r.getCellValue(FIELDS.HL_TO_PD_FLAG) && 
        !r.getCellValue(FIELDS.PD_TO_CERT_SUB_FLAG) && 
        !r.getCellValue(FIELDS.CERT_SUB_TO_LIVE_FLAG) && 
        !r.getCellValue(FIELDS.LIVE_PLUS_FLAG)
    ).length;
    
    const preHLData = {
        commits: preHLCommits,
        integrations: preHLIntegrations,
        percent: _formatPercent(preHLIntegrations, totalIntegrations),
        integrationRate: preHLCommits > 0 ? Math.round((preHLIntegrations / preHLCommits) * 100) : 0,
        commitsNotInIntegrations: Math.max(0, preHLCommits - preHLIntegrations)
    };
    
    // Calculate totals
    const totalCommits = preHLCommits + milestoneIntegrationData.reduce((sum, m) => sum + m.commits, 0);
    const totalCommitsNotInIntegrations = Math.max(0, totalCommits - totalIntegrations);

    const lateIntegrationsByProduct = {};
    milestoneIntegrationData.slice(2).forEach(milestone => { if (milestone.name === "Cert Sub → Live" || milestone.name === "Post-Live") { const recordsForMilestone = integrationsForVersion.filter(r => r.getCellValue(FIELDS[["CERT_SUB_TO_LIVE_FLAG", "LIVE_PLUS_FLAG"][milestone.name === "Post-Live" ? 1 : 0]])); recordsForMilestone.forEach(r => { const product = _safeGet(r, FIELDS.INTEGRATION_AREA, "Unknown"); const platform = _safeGet(r, FIELDS.INTEGRATION_PLATFORM, "Unknown"); if (!lateIntegrationsByProduct[product]) { lateIntegrationsByProduct[product] = { count: 0, types: [] }; } lateIntegrationsByProduct[product].count++; if (!lateIntegrationsByProduct[product].types.includes(platform)) { lateIntegrationsByProduct[product].types.push(platform); } }); } });
    const top3LateProducts = Object.entries(lateIntegrationsByProduct).sort((a, b) => b[1].count - a[1].count).slice(0, 3).map(([product, data]) => `${product} (${data.count} - ${data.types.join(', ')})`).join(', ');
    let lateIntegrationSummary = ""; if (top3LateProducts) { lateIntegrationSummary = ` Top products with post-certification integration requests: ${top3LateProducts}.`; }
    let prevIntegrationSummary = ""; if (prevFullVersionForN1 && previousReleaseCycleData.integrationCount !== null) { const diff = previousReleaseCycleData.integrationCount === 0 ? (totalIntegrations > 0 ? Infinity : 0) : ((totalIntegrations - previousReleaseCycleData.integrationCount) / previousReleaseCycleData.integrationCount) * 100; const diffText = isFinite(diff) ? `${diff.toFixed(0)}% ${diff >= 0 ? 'increase' : 'decrease'}` : (totalIntegrations > 0 ? 'increase from zero' : 'same (zero)'); prevIntegrationSummary = `_Previous Release (${formatVersion(prevFullVersionForN1)}) had ${previousReleaseCycleData.integrationCount} integration requests. This release shows a ${diffText}.${lateIntegrationSummary}_`; }
    const integrationP4StreamVersion = currentTargetVersion.toLowerCase() === 'all' ? "LATEST" : `Release-${currentTargetVersion}`;
    const integrationJiraLink = currentTargetVersion.toLowerCase() === 'all' ? null : `${CONFIG.JIRA_BASE_URL}/issues/?filter=${CONFIG.JIRA_INTEGRATION_FILTER_ID}&jql=project%20%3D%20ERM%20AND%20issuetype%20%3D%20Integration%20AND%20%22P4%20Streams%22%20~%20%22%2F%2FFortnite%2F${encodeURIComponent(integrationP4StreamVersion)}%22`;
    
    reportDataObject.integrationSection = { 
        title: `${CONFIG.EMOJIS.LINK} Integrations`, 
        totalIntegrationsText: `Total Integration Requests: **${totalIntegrations}**`, 
        previousReleaseIntegrationSummary: prevIntegrationSummary, 
        requestsByMilestoneTable: { 
            title: "Integration Requests by Milestone Period:", 
            data: milestoneIntegrationData, 
            noDataMessage: "- *No data by milestone.*" 
        }, 
        preHLData: preHLData,
        totalCommits: totalCommits,
        totalIntegrations: totalIntegrations,
        totalCommitsNotInIntegrations: totalCommitsNotInIntegrations,
        requestsByProductTable: { 
            title: "Top Requests by Product (Top 5):", 
            data: _countBy(integrationsForVersion, FIELDS.INTEGRATION_AREA).map(item => ({ ...item, percent: _formatPercent(item.count, totalIntegrations) })), 
            noDataMessage: "- *No data by product.*" 
        }, 
        requestsByTypeTable: { 
            title: "Top Requests by Type (Top 5):", 
            data: _countBy(integrationsForVersion, FIELDS.INTEGRATION_PLATFORM).map(item => ({ ...item, percent: _formatPercent(item.count, totalIntegrations) })), 
            noDataMessage: "- *No data by type.*" 
        }, 
        jiraLink: integrationJiraLink 
    };

    // Correct Pre/Post-Live SH logic based on created date vs live date
    const preSH = shForVersion.filter(r => { 
        if (!specificBuildRecordForDates) return false;
        const liveDate = specificBuildRecordForDates.getCellValue(FIELDS.MS_LIVE);
        if (!liveDate) return false;
        const shCreated = r.getCellValue(FIELDS.SH_CREATED_FIELD);
        if (!shCreated) return false;
        return new Date(shCreated) < new Date(liveDate);
    }).length;
    const postSH = shForVersion.length - preSH; 
    let dayOneSH = 0; let liveDateForSH = null;
    if (currentTargetVersion.toLowerCase() !== 'all' && specificBuildRecordForDates) { const liveVal = specificBuildRecordForDates.getCellValue(FIELDS.MS_LIVE); if (liveVal) { liveDateForSH = _MMDDYYYY(liveVal); shForVersion.forEach(s => { const shCreated = s.getCellValue(FIELDS.SH_CREATED_FIELD); if (shCreated && _MMDDYYYY(shCreated) === liveDateForSH) dayOneSH++; }); } }
    let prevShSummary = ""; 
    if (prevFullVersionForN1 && previousReleaseCycleData.shCount !== null) { 
        const diff = previousReleaseCycleData.shCount === 0 ? (shForVersion.length > 0 ? Infinity : 0) : ((shForVersion.length - previousReleaseCycleData.shCount) / previousReleaseCycleData.shCount) * 100; 
        const diffText = isFinite(diff) ? `${diff.toFixed(0)}% ${diff >= 0 ? 'increase' : 'decrease'}` : (shForVersion.length > 0 ? 'increase from zero' : 'same (zero)'); 
        // Remove the pre/post comparison part
        prevShSummary = `_Previous Release (${formatVersion(prevFullVersionForN1)}) had ${previousReleaseCycleData.shCount} ShitHappens. This release shows a ${diffText}._`; 
    }
    const shJiraLink = currentTargetVersion.toLowerCase() === 'all' ? null : `${CONFIG.JIRA_BASE_URL}/issues/?filter=${CONFIG.JIRA_SH_FILTER_ID}&jql=project%20%3D%20SHI%20AND%20affectedVersion%20%3D%20${encodeURIComponent(currentTargetVersion)}%20ORDER%20BY%20created%20DESC`;
    const rootCauseData = _countBy(shForVersion, FIELDS.SHITHAPPENS_ROOT_CAUSE).map(item => ({ ...item, percent: _formatPercent(item.count, shForVersion.length) }));
    const severityGroupsData = CONFIG.SH_SEVERITIES_ORDER.map(sev => { const records = shForVersion.filter(r => _safeGet(r, FIELDS.SEVERITY_NORMALIZED) === sev); let totalTime=0, timeCt=0; const timesArr=[]; records.forEach(r=>{const cr=r.getCellValue(FIELDS.SH_CREATED_FIELD),rs=r.getCellValue(FIELDS.SH_RESOLVED_FIELD); if(cr&&rs){try{const d=new Date(rs).getTime()-new Date(cr).getTime(); if(d>=0){timesArr.push(d/864e5);totalTime+=(d/864e5);timeCt++;}}catch(e){}}}); const avgT=timeCt?(totalTime/timeCt).toFixed(1):"-"; let medT="-"; if(timeCt){const sA=[...timesArr].sort((a,b)=>a-b); medT=sA[Math.floor(sA.length/2)].toFixed(1);} return { severity: sev, count: records.length, avgResolutionDays: avgT, medianResolutionDays: medT, percent: _formatPercent(records.length, shForVersion.length) }; });
    reportDataObject.shSection = { title: `${CONFIG.EMOJIS.EXCLAMATION} ShitHappens`, totalShText: `Total ShitHappens: ${shForVersion.length}`, notes: [ { text: `**Pre-Live ShitHappens:** ${preSH}`, labelForBold: "Pre-Live ShitHappens" }, { text: `**Post-Live ShitHappens:** ${postSH}` + (liveDateForSH ? ` (Day One Count on ${liveDateForSH}: ${dayOneSH})` : ` (Day One Count: N/A)`), labelForBold: "Post-Live ShitHappens" } ].filter(Boolean), previousReleaseShSummary: prevShSummary, bySeverityTable: { title: "ShitHappens by Severity:", data: severityGroupsData.map(sg => ({ severity: sg.severity, count: sg.count, percent: sg.percent })), noDataMessage: "- *No data by severity.*" }, resolutionBySeverityTable: { data: severityGroupsData.map(sg => ({ severity: sg.severity, avgResolutionDays: sg.avgResolutionDays, medianResolutionDays: sg.medianResolutionDays })) }, byComponentTable: { title: "ShitHappens by Component (Top 5):", data: _countBy(shForVersion, FIELDS.COMPONENT_S).map(comp => { const compRecs = shForVersion.filter(r => (_safeGet(r, FIELDS.COMPONENT_S) || "").includes(comp.name)); return { component: comp.name, totalCount: comp.count, sev1: compRecs.filter(r => _safeGet(r,FIELDS.SEVERITY_NORMALIZED)===CONFIG.SH_SEVERITIES_ORDER[0]).length, sev2: compRecs.filter(r => _safeGet(r,FIELDS.SEVERITY_NORMALIZED)===CONFIG.SH_SEVERITIES_ORDER[1]).length, sev3: compRecs.filter(r => _safeGet(r,FIELDS.SEVERITY_NORMALIZED)===CONFIG.SH_SEVERITIES_ORDER[2]).length, sev4: compRecs.filter(r => _safeGet(r,FIELDS.SEVERITY_NORMALIZED)===CONFIG.SH_SEVERITIES_ORDER[3]).length, percent: _formatPercent(comp.count, shForVersion.length) }; }), noDataMessage: "- *No component data.*" }, byRootCauseTable: { title: "ShitHappens by Root Cause:", data: rootCauseData, noDataMessage: "- *No root cause data available.*" }, jiraLink: shJiraLink };

    // Open Issue Triaging Data
    let issueTriagingData = null;
    if (specificBuildRecordForDates) {
        issueTriagingData = {
            plannedWork: specificBuildRecordForDates.getCellValue(FIELDS.PLANNED_WORK) || 0,
            plannedWorkLink: specificBuildRecordForDates.getCellValue(FIELDS.PLANNED_WORK_LINK),
            completedWork: specificBuildRecordForDates.getCellValue(FIELDS.COMPLETED_WORK) || 0,
            completedWorkLink: specificBuildRecordForDates.getCellValue(FIELDS.COMPLETED_WORK_LINK),
            completedOnTime: specificBuildRecordForDates.getCellValue(FIELDS.COMPLETED_ON_TIME) || 0,
            completedOnTimeLink: specificBuildRecordForDates.getCellValue(FIELDS.COMPLETED_ON_TIME_LINK),
            completedLate: specificBuildRecordForDates.getCellValue(FIELDS.COMPLETED_LATE) || 0,
            completedLateLink: specificBuildRecordForDates.getCellValue(FIELDS.COMPLETED_LATE_LINK),
            openBeyondHL: specificBuildRecordForDates.getCellValue(FIELDS.OPEN_BEYOND_HL) || 0,
            openBeyondHLLink: specificBuildRecordForDates.getCellValue(FIELDS.OPEN_BEYOND_HL_LINK),
            openBeyondPD: specificBuildRecordForDates.getCellValue(FIELDS.OPEN_BEYOND_PD) || 0,
            openBeyondPDLink: specificBuildRecordForDates.getCellValue(FIELDS.OPEN_BEYOND_PD_LINK),
            puntedWork: specificBuildRecordForDates.getCellValue(FIELDS.ALL_PUNTED_WORK) || 0,
            puntedWorkLink: specificBuildRecordForDates.getCellValue(FIELDS.ALL_PUNTED_WORK_LINK)
        };
        
        // Calculate rates
        issueTriagingData.completionRate = issueTriagingData.plannedWork > 0 ? 
            Math.round((issueTriagingData.completedWork / issueTriagingData.plannedWork) * 100) : 0;
        issueTriagingData.onTimeRate = issueTriagingData.completedWork > 0 ? 
            Math.round((issueTriagingData.completedOnTime / issueTriagingData.completedWork) * 100) : 0;
        issueTriagingData.lateRate = issueTriagingData.completedWork > 0 ? 
            Math.round((issueTriagingData.completedLate / issueTriagingData.completedWork) * 100) : 0;
        issueTriagingData.puntedRate = issueTriagingData.plannedWork > 0 ?
            Math.round((issueTriagingData.puntedWork / issueTriagingData.plannedWork) * 100) : 0;
    }
    reportDataObject.issueTriagingSection = issueTriagingData;

    let orderedInsights = [];
    let avgIntegrationResolutionTime = null;
    if (integrationsForVersion.length > 0) { const integrationTimes = integrationsForVersion.map(r => { const created = r.getCellValue(FIELDS.INTEGRATION_CREATED_FIELD); const resolved = r.getCellValue(FIELDS.INTEGRATION_RESOLVED_FIELD); if (created && resolved) { try { const diff = new Date(resolved).getTime() - new Date(created).getTime(); return diff >= 0 ? diff / (1000 * 60 * 60) : null; } catch (e) { return null; } } return null; }).filter(x => x !== null && !isNaN(x)); if (integrationTimes.length > 0) { avgIntegrationResolutionTime = (integrationTimes.reduce((a, b) => a + b, 0) / integrationTimes.length).toFixed(1); } }
    const integrationsPostCertSub = milestoneIntegrationData.slice(2).reduce((sum, m) => { if (m.name === "Cert Sub → Live" || m.name === "Post-Live") return sum + m.count; return sum; }, 0);
    const percentAfterCertSub = _formatPercent(integrationsPostCertSub, totalIntegrations);
    const unplannedOrRebuildRQA = unplannedWhitegloves.length + rebuildWhitegloves.length;
    const extraWorkTotal = integrationsPostCertSub + unplannedOrRebuildRQA + shForVersion.filter(r => _safeGet(r, FIELDS.SEVERITY_NORMALIZED) === CONFIG.SH_SEVERITIES_ORDER[0] || _safeGet(r, FIELDS.SEVERITY_NORMALIZED) === CONFIG.SH_SEVERITIES_ORDER[1]).length;
    
    let criticalIssues = [];
    if (unplannedOrRebuildRQA >= CONFIG.SIGNIFICANT_RQA_COUNT_THRESHOLD) { criticalIssues.push(`${unplannedOrRebuildRQA} total unplanned (${unplannedWhitegloves.length}) or rebuild (${rebuildWhitegloves.length}) whitegloves indicate late-breaking changes or quality issues`); }
    if (percentAfterCertSub > 10) { criticalIssues.push(`${percentAfterCertSub}% of integration requests occurred after Cert Submission`); }
    const criticalIncidents = shForVersion.filter(r => _safeGet(r, FIELDS.SEVERITY_NORMALIZED) === CONFIG.SH_SEVERITIES_ORDER[0] || _safeGet(r, FIELDS.SEVERITY_NORMALIZED) === CONFIG.SH_SEVERITIES_ORDER[1]).length;
    if (criticalIncidents >= 3) { criticalIssues.push(`${criticalIncidents} high-severity ShitHappens (Sev 1-2) requiring immediate response`); }
    if (qaPercent_hotfix === 0 && hotfixesForVersion.length > 0) { criticalIssues.push(`Critical gap in hotfix QA verification process needs immediate attention`); }
    
    // Add Open Issue Triaging critical issues
    if (issueTriagingData) {
        if (issueTriagingData.openBeyondHL > 10) {
            criticalIssues.push(`${issueTriagingData.openBeyondHL} issues remained open after Hard Lock`);
        }
        if (issueTriagingData.puntedRate > 30) {
            criticalIssues.push(`${issueTriagingData.puntedRate}% of planned work was punted to future releases`);
        }
        if (issueTriagingData.completionRate < 60) {
            criticalIssues.push(`Only ${issueTriagingData.completionRate}% of planned work was completed`);
        }
    }
    
    let improvements = [];
    if (extraWorkTotal > 5) { improvements.push(`High volume of reactive work detected - ${integrationsPostCertSub} late integration requests, ${unplannedOrRebuildRQA} unplanned/rebuild Release QA whitegloves, and ${criticalIncidents} high-severity ShitHappens requiring immediate attention`); }
    if (avgIntegrationResolutionTime && parseFloat(avgIntegrationResolutionTime) > 72) { improvements.push(`Integration request resolution time averaging ${avgIntegrationResolutionTime} hours - consider automation improvements`); }
    if (rootCauseData && rootCauseData.length > 0) { const topRootCause = rootCauseData[0]; if (topRootCause.count >= 3) { improvements.push(`${topRootCause.name} accounts for ${topRootCause.percent}% of ShitHappens (${topRootCause.count} total) - focus area for prevention strategies`); } }
    if (qaPercent_hotfix < 70 && qaPercent_hotfix !== 0) { improvements.push(`Hotfix QA verification at ${qaPercent_hotfix}% - recommend embedded QA team testing before hotfix submission`); }
    if (typeof scores.Deploy === 'number' && scores.Deploy < CONFIG.BAR_THRESHOLDS.YELLOW) { improvements.push(`Deploy Score of ${scores.Deploy}% suggests higher than optimal deployment frequency`); }
    
    // Add Open Issue Triaging improvements
    if (issueTriagingData) {
        if (issueTriagingData.lateRate > 30) {
            improvements.push(`${issueTriagingData.lateRate}% of completed work was finished after Hard Lock - consider better scoping`);
        }
        if (issueTriagingData.openBeyondPD > 5) {
            improvements.push(`${issueTriagingData.openBeyondPD} issues still open at Pencils Down - review closure criteria`);
        }
    }
    
    // Add discrepancy analysis for commits after hard lock
    if (specificBuildRecordForDates && totalCommits > 0) {
        const postHLCommits = milestoneIntegrationData.reduce((sum, m) => sum + m.commits, 0) + 
            (specificBuildRecordForDates.getCellValue(FIELDS.COMMITS_LIVE_PLUS) || 0);
        const postHLIntegrations = milestoneIntegrationData.reduce((sum, m) => sum + m.count, 0);
        if (postHLCommits > 0 && postHLIntegrations > 0) {
            const discrepancy = postHLCommits - postHLIntegrations;
            if (discrepancy > 500) {
                improvements.push(`${discrepancy} commits after Hard Lock did not go through integration requests - evaluate integration request process effectiveness`);
            }
        }
    }
    
    const overallIntegrationRate = totalCommits > 0 ? Math.round((totalIntegrations / totalCommits) * 100) : 0;
    if (overallIntegrationRate < 50) {
        improvements.push(`Only ${overallIntegrationRate}% of commits went through integration requests - consider process enforcement`);
    }
    
    let positives = [];
    if (prevFullVersionForN1 && previousReleaseCycleData.hotfixCount !== null && hotfixesForVersion.length < previousReleaseCycleData.hotfixCount * (1 - CONFIG.SIGNIFICANT_IMPROVEMENT_THRESHOLD / 100)) { positives.push(`Significant reduction in hotfix volume compared to ${formatVersion(prevFullVersionForN1)}`); }
    if (typeof scores.Deploy === 'number' && scores.Deploy >= CONFIG.BAR_THRESHOLDS.GREEN) { positives.push(`Strong deployment stability (Deploy Score ${scores.Deploy}%) indicates minimal reactive deployment activity`); }
    if (criticalIncidents === 0) { positives.push(`Zero critical ShitHappens demonstrates strong release quality`); }
    if (avgIntegrationResolutionTime && parseFloat(avgIntegrationResolutionTime) <= 36) { positives.push(`Excellent integration request resolution time averaging ${avgIntegrationResolutionTime} hours`); }
    if (integrationsPostCertSub === 0) { positives.push(`Zero post-certification integration requests demonstrates excellent planning`); }
    if (unplannedOrRebuildRQA === 0) { positives.push(`Zero unplanned/rebuild testing events shows strong execution planning`); }
    const preLiveShCount = shForVersion.filter(r => { 
        if (!specificBuildRecordForDates) return false;
        const liveDate = specificBuildRecordForDates.getCellValue(FIELDS.MS_LIVE);
        if (!liveDate) return false;
        const shCreated = r.getCellValue(FIELDS.SH_CREATED_FIELD);
        if (!shCreated) return false;
        return new Date(shCreated) < new Date(liveDate);
    }).length;
    if (preLiveShCount === 0) { positives.push(`Zero pre-live ShitHappens indicates robust testing and quality processes`); }
    if (qaPercent_hotfix >= CONFIG.HOTFIX_QA_VERIFIED_TARGET_PERCENT) { positives.push(`Strong hotfix QA verification rate at ${qaPercent_hotfix}%`); }
    
    // Add Open Issue Triaging positives
    if (issueTriagingData) {
        if (issueTriagingData.onTimeRate > 85) {
            positives.push(`Strong on-time delivery: ${issueTriagingData.onTimeRate}% of completed work finished before Hard Lock`);
        }
        if (issueTriagingData.puntedRate < 10) {
            positives.push(`Excellent scope management: Only ${issueTriagingData.puntedRate}% of planned work was punted`);
        }
    }
    
    if (overallIntegrationRate > 90) {
        positives.push(`Excellent process compliance: ${overallIntegrationRate}% of commits used integration requests`);
    }
    
    // Reorder insights: Positive Trends, Critical Issues, Areas for Improvement
    if (positives.length > 0) { 
        orderedInsights.push(`🟢 **Positive Trends**`); 
        positives.forEach(positive => orderedInsights.push(`- ${positive}`)); 
        orderedInsights.push(''); 
    }
    if (criticalIssues.length > 0) { 
        orderedInsights.push(`🔴 **Critical Issues**`); 
        criticalIssues.forEach(issue => orderedInsights.push(`- ${issue}`)); 
        orderedInsights.push(''); 
    }
    if (improvements.length > 0) { 
        orderedInsights.push(`🟡 **Areas for Improvement**`); 
        improvements.forEach(improvement => orderedInsights.push(`- ${improvement}`)); 
        orderedInsights.push(''); 
    }
    
    if (orderedInsights.length === 0) { orderedInsights.push("- No critical issues or significant trends identified."); }
    reportDataObject.actionableInsightsSection = { title: `${CONFIG.EMOJIS.INFO} Insights`, points: orderedInsights };
    
    const generationDate = new Date();
    reportDataObject.generationTimestamp = `This report was generated on: ${generationDate.toLocaleString("en-US", CONFIG.DATETIME_FORMAT_OPTIONS)}`;

    console.log("Generating final report outputs...");
    const finalReportJSON = JSON.stringify(reportDataObject, null, 2);
    const finalReportMarkdown = generateMarkdownReport(reportDataObject);

    const reportsTable = SCRIPT_TABLES.generatedReports;
    if (!reportsTable) { console.error("'Generated Reports' table not found."); throw new Error("'Generated Reports' table not found.");
    }

    let saveReportName;
    const formattedDate = _MMDDYYYY(generationDate);

    if (currentTargetVersion.toLowerCase() === 'all') {
        saveReportName = `Fortnite Release Report - All Versions - ${generationDate.toISOString().slice(0, 10)}`;
    } else {
        saveReportName = `[${formatVersion(currentTargetVersion)}] Release Report (${formattedDate})`;
    }

    try {
        console.log(`Creating new report: "${saveReportName}"...`);
        const createdRecordId = await reportsTable.createRecordAsync({
            "Name": saveReportName,
            [FIELD_NAME_FOR_JSON_OUTPUT]: finalReportJSON,
            [FIELD_NAME_FOR_MARKDOWN_OUTPUT]: finalReportMarkdown,
            "Version Covered": currentTargetVersion,
            "Generated Date": generationDate,
            [FIELD_NAME_FOR_OVERALL_SCORE_NUMERIC]: overall
        });

        if (!createdRecordId) {
            throw new Error("Failed to create new report or retrieve its ID. Record ID is null or undefined.");
        }
        console.log(`Success: Report "${saveReportName}" created with ID: ${createdRecordId}.`);

        console.log("Skipping deletion of old reports as per user request.");

        if (typeof output !== 'undefined' && typeof output.markdown === 'function') output.markdown(finalReportMarkdown);
        else console.log("output.markdown not available.");
    } catch (e) {
        const errMsg = `Error during report saving: ${e.message}`;
        console.error(errMsg, e.stack);
        if (typeof output !== 'undefined' && typeof output.markdown === 'function') {
            output.markdown(`### ${CONFIG.EMOJIS.WARNING} Error During Report Saving\n${errMsg}\n\n---\n### Report Content (Process Halted):\n${finalReportMarkdown}`);
        } else {
            console.error("output.markdown not available for error display during save.");
        }
    }
    let scriptEndTime = Date.now();
    console.log(`Fortnite Release Report generation finished. Total time: ${(scriptEndTime - scriptStartTime) / 1000}s.`);
    console.log(`Summary: Version: ${currentTargetVersion}, Overall Score: ${overall ?? 'N/A'}`);
}

main().catch(err => {
    console.error("Unhandled error in main script execution:", err.message, err.stack || '(No stack)');
    if (typeof output !== 'undefined' && typeof output.markdown === 'function') {
        output.markdown(`### 🚨 Unhandled Error in Script Execution 🚨\nAn unexpected error occurred. Check logs.\n**Error:**\n\`\`\`\n${err.message}\n\`\`\``);
    }
});