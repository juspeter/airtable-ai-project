//======================================================================================================================
// Real-Time Release Monitor Script
// Purpose: Live dashboard during active releases - replaces Deploy Tracker Google Sheet functionality
// Shows: Current deploy status, active hotfixes, open issues, milestone progress in real-time
//======================================================================================================================

const { FIELDS, CONFIG } = require('./current/versionreport.js');

/**
 * Real-Time Release Monitor
 * Provides live status updates during active releases, replacing Deploy Tracker functionality
 */
class RealTimeReleaseMonitor {
    constructor() {
        this.refreshInterval = 60000; // 1 minute default refresh
        this.activeMonitors = new Map();
        
        this.deployStates = {
            'Planning': { order: 1, color: 'gray', emoji: '📋' },
            'In Progress': { order: 2, color: 'blue', emoji: '🔄' },
            'Testing': { order: 3, color: 'yellow', emoji: '🧪' },
            'Ready': { order: 4, color: 'green', emoji: '✅' },
            'Live': { order: 5, color: 'purple', emoji: '🚀' },
            'Rollback': { order: 6, color: 'red', emoji: '⚠️' }
        };
        
        this.severityColors = {
            'Sev 1': '🔴',
            'Sev 2': '🟠',
            'Sev 3': '🟡',
            'Sev 4': '🟢'
        };
    }

    /**
     * Start monitoring a specific release version
     */
    async startMonitoring(targetVersion, options = {}) {
        try {
            console.log(`Starting real-time monitoring for version: ${targetVersion}`);
            
            const {
                refreshInterval = this.refreshInterval,
                includeHistorical = false,
                alertThresholds = this.getDefaultAlertThresholds(),
                outputFormat = 'dashboard' // 'dashboard', 'slack', 'json'
            } = options;

            // Initial data collection
            const monitorData = await this.collectRealTimeData(targetVersion);
            
            // Generate initial dashboard
            const dashboard = this.generateDashboard(monitorData, targetVersion);
            
            // Set up monitoring
            const monitorId = `monitor_${targetVersion}_${Date.now()}`;
            const monitor = {
                version: targetVersion,
                startTime: new Date(),
                refreshInterval: refreshInterval,
                lastUpdate: new Date(),
                data: monitorData,
                alerts: [],
                status: 'active'
            };
            
            this.activeMonitors.set(monitorId, monitor);
            
            // Return initial state
            return {
                success: true,
                monitorId: monitorId,
                version: targetVersion,
                status: monitor.status,
                dashboard: dashboard,
                data: monitorData,
                alerts: this.checkAlerts(monitorData, alertThresholds),
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Error starting monitor for ${targetVersion}:`, error);
            return {
                success: false,
                error: error.message,
                version: targetVersion,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Collect all real-time data for monitoring
     */
    async collectRealTimeData(targetVersion) {
        const data = {
            version: targetVersion,
            timestamp: new Date(),
            
            // Core release data
            releaseInfo: await this.getReleaseInfo(targetVersion),
            
            // Deploy tracking (replaces Google Sheet functionality)
            deploys: await this.getActiveDeployments(targetVersion),
            
            // Current milestone status
            milestones: await this.getMilestoneStatus(targetVersion),
            
            // Active issues and blockers
            activeIssues: await this.getActiveIssues(targetVersion),
            
            // Live hotfixes
            activeHotfixes: await this.getActiveHotfixes(targetVersion),
            
            // Current incidents
            activeIncidents: await this.getActiveIncidents(targetVersion),
            
            // Integration pipeline status
            integrationStatus: await this.getIntegrationPipelineStatus(targetVersion),
            
            // RQA/Whiteglove status
            rqaStatus: await this.getRQAStatus(targetVersion),
            
            // Work volume metrics
            workVolume: await this.getWorkVolumeMetrics(targetVersion),
            
            // Team readiness
            teamStatus: await this.getTeamReadiness(targetVersion)
        };
        
        // Calculate summary metrics
        data.summary = this.calculateSummaryMetrics(data);
        
        return data;
    }

    /**
     * Get basic release information
     */
    async getReleaseInfo(targetVersion) {
        const buildsTable = base.getTable('Builds');
        const query = await buildsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                'Build Phase',
                'Status',
                FIELDS.DEPLOY_CLASSIFICATION,
                'Live Date',
                'Start date',
                FIELDS.MS_HARD_LOCK,
                FIELDS.MS_PENCILS_DOWN,
                FIELDS.MS_CERT,
                FIELDS.MS_LIVE,
                'Release Health Score',
                'Total Deploys',
                'Total Hotfixes',
                'Total Integrations',
                'SH - Total'
            ]
        });

        const releaseRecord = query.records.find(record => {
            const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
            return version === targetVersion;
        });

        if (!releaseRecord) {
            throw new Error(`Release ${targetVersion} not found`);
        }

        return {
            version: targetVersion,
            phase: releaseRecord.getCellValueAsString('Build Phase'),
            status: releaseRecord.getCellValue('Status') || [],
            classification: releaseRecord.getCellValueAsString(FIELDS.DEPLOY_CLASSIFICATION),
            liveDate: releaseRecord.getCellValue('Live Date') || releaseRecord.getCellValue('Start date'),
            milestones: {
                hardLock: releaseRecord.getCellValue(FIELDS.MS_HARD_LOCK),
                pencilsDown: releaseRecord.getCellValue(FIELDS.MS_PENCILS_DOWN),
                cert: releaseRecord.getCellValue(FIELDS.MS_CERT),
                live: releaseRecord.getCellValue(FIELDS.MS_LIVE)
            },
            healthScore: releaseRecord.getCellValue('Release Health Score') || 0,
            metrics: {
                totalDeploys: releaseRecord.getCellValue('Total Deploys') || 0,
                totalHotfixes: releaseRecord.getCellValue('Total Hotfixes') || 0,
                totalIntegrations: releaseRecord.getCellValue('Total Integrations') || 0,
                totalIncidents: releaseRecord.getCellValue('SH - Total') || 0
            }
        };
    }

    /**
     * Get active deployments (Deploy Tracker replacement)
     */
    async getActiveDeployments(targetVersion) {
        const buildsTable = base.getTable('Builds');
        const query = await buildsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                'Summary',
                'Deploy Type (Deploys)',
                FIELDS.DEPLOY_CLASSIFICATION,
                'Build Phase',
                'Status',
                'Live Date',
                'Start date',
                'Client Deploys',
                'Server Deploys',
                'MCP Deploys'
            ]
        });

        // Get all deploys related to this version
        const deploys = query.records
            .filter(record => {
                const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                return version === targetVersion || version.startsWith(targetVersion);
            })
            .map(record => ({
                version: record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED),
                summary: record.getCellValueAsString('Summary'),
                deployType: record.getCellValue('Deploy Type (Deploys)') || [],
                classification: record.getCellValueAsString(FIELDS.DEPLOY_CLASSIFICATION),
                phase: record.getCellValueAsString('Build Phase'),
                status: record.getCellValue('Status') || [],
                scheduledDate: record.getCellValue('Live Date') || record.getCellValue('Start date'),
                deployStats: {
                    client: record.getCellValue('Client Deploys') || 0,
                    server: record.getCellValue('Server Deploys') || 0,
                    mcp: record.getCellValue('MCP Deploys') || 0
                },
                currentState: this.determineDeployState(record)
            }));

        // Sort by scheduled date
        return deploys.sort((a, b) => {
            if (!a.scheduledDate) return 1;
            if (!b.scheduledDate) return -1;
            return new Date(a.scheduledDate) - new Date(b.scheduledDate);
        });
    }

    /**
     * Get current milestone status
     */
    async getMilestoneStatus(targetVersion) {
        const releaseInfo = await this.getReleaseInfo(targetVersion);
        const currentDate = new Date();
        
        const milestones = [
            { 
                name: 'Hard Lock', 
                date: releaseInfo.milestones.hardLock,
                field: 'hardLock',
                order: 1
            },
            { 
                name: 'Pencils Down', 
                date: releaseInfo.milestones.pencilsDown,
                field: 'pencilsDown',
                order: 2
            },
            { 
                name: 'Cert Sub', 
                date: releaseInfo.milestones.cert,
                field: 'cert',
                order: 3
            },
            { 
                name: 'Live', 
                date: releaseInfo.milestones.live,
                field: 'live',
                order: 4
            }
        ];

        return milestones.map(milestone => {
            const status = this.getMilestoneStatus(milestone.date, currentDate);
            return {
                ...milestone,
                status: status,
                daysUntil: milestone.date ? 
                    Math.ceil((new Date(milestone.date) - currentDate) / (1000 * 60 * 60 * 24)) : null,
                isComplete: status === 'completed',
                isOverdue: status === 'overdue'
            };
        });
    }

    /**
     * Get active issues that could impact release
     */
    async getActiveIssues(targetVersion) {
        const openIssuesTable = base.getTable('Open Issues');
        const query = await openIssuesTable.selectRecordsAsync();

        const issueRecord = query.records.find(record => {
            const deploy = record.getCellValueAsString('Deploy');
            return deploy === targetVersion;
        });

        if (!issueRecord) {
            return {
                plannedWork: 0,
                completedWork: 0,
                openBeyondHL: 0,
                openBeyondPD: 0,
                completionRate: 100,
                blockers: []
            };
        }

        const planned = issueRecord.getCellValue('Planned Work') || 0;
        const completed = issueRecord.getCellValue('Completed Work') || 0;
        
        return {
            plannedWork: planned,
            completedWork: completed,
            openBeyondHL: issueRecord.getCellValue('Open Beyond Hard Lock') || 0,
            openBeyondPD: issueRecord.getCellValue('Open Beyond Pencils Down') || 0,
            completionRate: planned > 0 ? Math.round((completed / planned) * 100) : 100,
            blockers: [], // Would need additional data to identify specific blockers
            
            // Links for drill-down
            links: {
                plannedWork: issueRecord.getCellValueAsString('Planned Work (Link)'),
                completedWork: issueRecord.getCellValueAsString('Completed Work (Link)'),
                openBeyondHL: issueRecord.getCellValueAsString('Open Beyond Hard Lock (Link)'),
                openBeyondPD: issueRecord.getCellValueAsString('Open Beyond Pencils Down (Link)')
            }
        };
    }

    /**
     * Get currently active hotfixes
     */
    async getActiveHotfixes(targetVersion) {
        const hotfixesTable = base.getTable('Hotfixes');
        const query = await hotfixesTable.selectRecordsAsync({
            fields: [
                'Issue Key',
                'Summary',
                'Status',
                FIELDS.PRIORITY,
                FIELDS.URGENCY_CUSTOM_FIELD,
                FIELDS.QA_STATE,
                FIELDS.BUILD_VERSION_UNIFIED,
                FIELDS.HOTFIX_CREATED_FIELD,
                'Reporter'
            ]
        });

        const activeHotfixes = query.records
            .filter(record => {
                const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                const status = record.getCellValueAsString('Status');
                return (version === targetVersion || version.startsWith(targetVersion)) &&
                       status !== 'Done' && status !== 'Closed';
            })
            .map(record => ({
                issueKey: record.getCellValueAsString('Issue Key'),
                summary: record.getCellValueAsString('Summary'),
                status: record.getCellValueAsString('Status'),
                priority: record.getCellValueAsString(FIELDS.PRIORITY),
                urgency: record.getCellValueAsString(FIELDS.URGENCY_CUSTOM_FIELD),
                qaState: record.getCellValueAsString(FIELDS.QA_STATE),
                created: record.getCellValue(FIELDS.HOTFIX_CREATED_FIELD),
                reporter: record.getCellValueAsString('Reporter'),
                age: this.calculateAge(record.getCellValue(FIELDS.HOTFIX_CREATED_FIELD))
            }))
            .sort((a, b) => {
                // Sort by urgency then priority
                const urgencyOrder = { 'ASAP': 1, 'Today': 2, 'Scheduled': 3, 'Not Critical': 4 };
                const aUrgency = urgencyOrder[a.urgency] || 5;
                const bUrgency = urgencyOrder[b.urgency] || 5;
                if (aUrgency !== bUrgency) return aUrgency - bUrgency;
                
                const priorityOrder = { '0 - Blocker': 1, '1 - Critical': 2, '2 - Major': 3, '3 - Normal': 4, '4 - Minor': 5 };
                const aPriority = priorityOrder[a.priority] || 6;
                const bPriority = priorityOrder[b.priority] || 6;
                return aPriority - bPriority;
            });

        return {
            active: activeHotfixes,
            summary: {
                total: activeHotfixes.length,
                asap: activeHotfixes.filter(h => h.urgency === 'ASAP').length,
                today: activeHotfixes.filter(h => h.urgency === 'Today').length,
                critical: activeHotfixes.filter(h => h.priority === '0 - Blocker' || h.priority === '1 - Critical').length
            }
        };
    }

    /**
     * Get work volume metrics
     */
    async getWorkVolumeMetrics(targetVersion) {
        const releaseInfo = await this.getReleaseInfo(targetVersion);
        
        // Get commit data from Builds table
        const buildsTable = base.getTable('Builds');
        const query = await buildsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                FIELDS.COMMITS_PRE_HL,
                FIELDS.COMMITS_HL_TO_PD,
                FIELDS.COMMITS_PD_TO_CERT,
                FIELDS.COMMITS_CERT_TO_LIVE,
                FIELDS.COMMITS_LIVE_PLUS
            ]
        });

        const buildRecord = query.records.find(record => {
            const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
            return version === targetVersion;
        });

        const commitData = buildRecord ? {
            preHL: buildRecord.getCellValue(FIELDS.COMMITS_PRE_HL) || 0,
            hlToPD: buildRecord.getCellValue(FIELDS.COMMITS_HL_TO_PD) || 0,
            pdToCert: buildRecord.getCellValue(FIELDS.COMMITS_PD_TO_CERT) || 0,
            certToLive: buildRecord.getCellValue(FIELDS.COMMITS_CERT_TO_LIVE) || 0,
            livePlus: buildRecord.getCellValue(FIELDS.COMMITS_LIVE_PLUS) || 0
        } : {};

        // Get RQA whiteglove count
        const rqaTable = base.getTable('RQA');
        const rqaQuery = await rqaTable.selectRecordsAsync({
            fields: [
                FIELDS.RQA_FIX_VERSION,
                FIELDS.RQA_LABELS
            ]
        });

        const whitegloveCount = rqaQuery.records.filter(record => {
            const fixVersions = record.getCellValue(FIELDS.RQA_FIX_VERSION) || [];
            const labels = record.getCellValue(FIELDS.RQA_LABELS) || [];
            return fixVersions.includes(targetVersion) && labels.includes('RQA-WG');
        }).length;

        return {
            deploys: releaseInfo.metrics.totalDeploys,
            commits: {
                total: Object.values(commitData).reduce((sum, val) => sum + val, 0),
                byPhase: commitData
            },
            rqaWhitegloves: whitegloveCount,
            integrations: releaseInfo.metrics.totalIntegrations,
            hotfixes: releaseInfo.metrics.totalHotfixes,
            incidents: releaseInfo.metrics.totalIncidents,
            
            // Work intensity score (0-100)
            intensity: this.calculateWorkIntensity({
                deploys: releaseInfo.metrics.totalDeploys,
                commits: Object.values(commitData).reduce((sum, val) => sum + val, 0),
                integrations: releaseInfo.metrics.totalIntegrations,
                hotfixes: releaseInfo.metrics.totalHotfixes
            })
        };
    }

    /**
     * Generate dashboard output
     */
    generateDashboard(monitorData, targetVersion) {
        const { releaseInfo, deploys, milestones, activeIssues, activeHotfixes, workVolume } = monitorData;
        
        const statusEmoji = {
            completed: '✅',
            upcoming: '🔄',
            overdue: '🔴',
            today: '🟡'
        };
        
        const phaseEmoji = {
            'Planning': '📋',
            'In Progress': '🔄',
            'Testing': '🧪',
            'Ready': '✅',
            'Live': '🚀',
            'Unknown': '❓'
        };
        
        return `# 🚀 Real-Time Release Monitor: ${targetVersion}

## 📊 Release Status Overview
**Current Phase**: ${releaseInfo.phase} ${phaseEmoji[releaseInfo.phase] || '❓'}
**Health Score**: ${releaseInfo.healthScore}/100 ${this.getHealthEmoji(releaseInfo.healthScore)}
**Last Updated**: ${new Date(monitorData.timestamp).toLocaleString()}

---

## 🎯 Milestone Progress
${milestones.map(milestone => 
    `- **${milestone.name}**: ${milestone.date ? new Date(milestone.date).toLocaleDateString() : 'Not scheduled'} ${statusEmoji[milestone.status]} ${milestone.isOverdue ? '⚠️ OVERDUE' : milestone.daysUntil !== null ? `(${milestone.daysUntil} days)` : ''}`
).join('\n')}

---

## 🚢 Deploy Tracker
${deploys.length > 0 ? `
| Version | Type | Status | Scheduled | State |
|---------|------|--------|-----------|-------|
${deploys.map(deploy => 
    `| ${deploy.version} | ${deploy.deployType.join(', ')} | ${deploy.status.join(', ')} | ${deploy.scheduledDate ? new Date(deploy.scheduledDate).toLocaleDateString() : 'TBD'} | ${this.deployStates[deploy.currentState]?.emoji || '❓'} ${deploy.currentState} |`
).join('\n')}

**Deploy Stats**: ${deploys[0]?.deployStats.client || 0} Client | ${deploys[0]?.deployStats.server || 0} Server | ${deploys[0]?.deployStats.mcp || 0} MCP
` : '### No active deployments'}

---

## 📋 Work Progress
**Completion**: ${activeIssues.completionRate}% (${activeIssues.completedWork}/${activeIssues.plannedWork})
${activeIssues.openBeyondHL > 0 ? `\n⚠️ **${activeIssues.openBeyondHL} items open beyond Hard Lock**` : ''}
${activeIssues.openBeyondPD > 0 ? `\n🚨 **${activeIssues.openBeyondPD} items open beyond Pencils Down**` : ''}

### Work Volume Metrics
- **Total Deploys**: ${workVolume.deploys}
- **Total Commits**: ${workVolume.commits.total}
  - Pre-HL: ${workVolume.commits.byPhase.preHL}
  - HL→PD: ${workVolume.commits.byPhase.hlToPD}
  - PD→Cert: ${workVolume.commits.byPhase.pdToCert}
  - Cert→Live: ${workVolume.commits.byPhase.certToLive}
- **RQA Whitegloves**: ${workVolume.rqaWhitegloves}
- **Work Intensity**: ${workVolume.intensity}/100 ${this.getIntensityEmoji(workVolume.intensity)}

---

## 🔥 Active Hotfixes (${activeHotfixes.summary.total})
${activeHotfixes.summary.asap > 0 ? `🔴 **ASAP**: ${activeHotfixes.summary.asap}` : ''}
${activeHotfixes.summary.today > 0 ? `🟠 **Today**: ${activeHotfixes.summary.today}` : ''}
${activeHotfixes.summary.critical > 0 ? `⚠️ **Critical**: ${activeHotfixes.summary.critical}` : ''}

${activeHotfixes.active.length > 0 ? `
### Top Priority Items
${activeHotfixes.active.slice(0, 5).map(hotfix => 
    `- **${hotfix.issueKey}**: ${hotfix.summary.substring(0, 50)}...
  ${this.getUrgencyEmoji(hotfix.urgency)} ${hotfix.urgency} | ${hotfix.priority} | Age: ${hotfix.age}`
).join('\n')}
` : '✅ No active hotfixes'}

---

## 🚨 Active Incidents
${monitorData.activeIncidents?.active.length > 0 ? 
monitorData.activeIncidents.active.map(incident => 
    `- ${this.severityColors[incident.severity]} **${incident.issueKey}**: ${incident.summary.substring(0, 60)}...`
).join('\n') : '✅ No active incidents'}

---

## 🔄 Integration Pipeline
${monitorData.integrationStatus ? `
- **In HL→PD**: ${monitorData.integrationStatus.hlToPd}
- **In PD→Cert**: ${monitorData.integrationStatus.pdToCert}
- **In Cert→Live**: ${monitorData.integrationStatus.certToLive}
- **Blocked**: ${monitorData.integrationStatus.blocked}
` : 'Loading integration data...'}

---

## 📈 Summary Metrics
- **Active Issues**: ${monitorData.summary?.activeIssues || 0}
- **Active Hotfixes**: ${monitorData.summary?.activeHotfixes || 0}
- **Active Incidents**: ${monitorData.summary?.activeIncidents || 0}
- **Pipeline Items**: ${monitorData.summary?.pipelineItems || 0}
- **Overall Risk**: ${monitorData.summary?.riskLevel || 'Unknown'} ${this.getRiskEmoji(monitorData.summary?.riskLevel)}

---

*Auto-refreshes every ${this.refreshInterval / 1000} seconds*
*Use this monitor to track live release progress and identify blockers in real-time*`;
    }

    // Helper methods
    determineDeployState(record) {
        const phase = record.getCellValueAsString('Build Phase');
        const status = record.getCellValue('Status') || [];
        
        if (status.includes('Live')) return 'Live';
        if (status.includes('Ready')) return 'Ready';
        if (phase === 'Testing' || status.includes('Testing')) return 'Testing';
        if (phase === 'In Progress') return 'In Progress';
        if (phase === 'Planning') return 'Planning';
        return 'Unknown';
    }

    getMilestoneStatus(milestoneDate, currentDate) {
        if (!milestoneDate) return 'not_scheduled';
        
        const milestone = new Date(milestoneDate);
        const diffDays = Math.ceil((milestone - currentDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays < 0) return 'completed';
        if (diffDays === 0) return 'today';
        if (diffDays < 0 && Math.abs(diffDays) > 1) return 'overdue';
        return 'upcoming';
    }

    calculateAge(createdDate) {
        if (!createdDate) return 'Unknown';
        
        const created = new Date(createdDate);
        const now = new Date();
        const hours = Math.round((now - created) / (1000 * 60 * 60));
        
        if (hours < 1) return 'Just now';
        if (hours === 1) return '1 hour';
        if (hours < 24) return `${hours} hours`;
        
        const days = Math.round(hours / 24);
        if (days === 1) return '1 day';
        return `${days} days`;
    }

    calculateWorkIntensity(metrics) {
        // Simple scoring based on volume
        const scores = {
            deploys: Math.min(metrics.deploys * 2, 30),
            commits: Math.min(metrics.commits / 100, 30),
            integrations: Math.min(metrics.integrations / 10, 20),
            hotfixes: Math.min(metrics.hotfixes / 5, 20)
        };
        
        return Math.round(Object.values(scores).reduce((sum, score) => sum + score, 0));
    }

    calculateSummaryMetrics(data) {
        return {
            activeIssues: data.activeIssues?.plannedWork - data.activeIssues?.completedWork || 0,
            activeHotfixes: data.activeHotfixes?.summary.total || 0,
            activeIncidents: data.activeIncidents?.active.length || 0,
            pipelineItems: data.integrationStatus?.total || 0,
            riskLevel: this.calculateRiskLevel(data)
        };
    }

    calculateRiskLevel(data) {
        let riskScore = 0;
        
        // Factor in various risk indicators
        if (data.activeIssues?.openBeyondPD > 0) riskScore += 30;
        if (data.activeIssues?.openBeyondHL > 5) riskScore += 20;
        if (data.activeHotfixes?.summary.asap > 2) riskScore += 25;
        if (data.activeHotfixes?.summary.critical > 3) riskScore += 15;
        if (data.activeIncidents?.critical > 0) riskScore += 30;
        if (data.workVolume?.intensity > 80) riskScore += 10;
        
        if (riskScore >= 60) return 'High';
        if (riskScore >= 30) return 'Medium';
        if (riskScore >= 15) return 'Low';
        return 'Minimal';
    }

    getHealthEmoji(score) {
        if (score >= 85) return '🟢';
        if (score >= 70) return '🟡';
        if (score >= 50) return '🟠';
        return '🔴';
    }

    getIntensityEmoji(intensity) {
        if (intensity >= 80) return '🔥';
        if (intensity >= 60) return '⚡';
        if (intensity >= 40) return '💪';
        return '👌';
    }

    getUrgencyEmoji(urgency) {
        const emojis = {
            'ASAP': '🔴',
            'Today': '🟠',
            'Scheduled': '🟡',
            'Not Critical': '🟢'
        };
        return emojis[urgency] || '⚪';
    }

    getRiskEmoji(riskLevel) {
        const emojis = {
            'High': '🔴',
            'Medium': '🟡',
            'Low': '🟢',
            'Minimal': '✅'
        };
        return emojis[riskLevel] || '❓';
    }

    // Additional methods for real-time updates
    async getActiveIncidents(targetVersion) { /* ... */ }
    async getIntegrationPipelineStatus(targetVersion) { /* ... */ }
    async getRQAStatus(targetVersion) { /* ... */ }
    async getTeamReadiness(targetVersion) { /* ... */ }
    checkAlerts(monitorData, thresholds) { /* ... */ }
    getDefaultAlertThresholds() { /* ... */ }
}

module.exports = RealTimeReleaseMonitor;

// Usage example
if (require.main === module) {
    const monitor = new RealTimeReleaseMonitor();
    
    // Start monitoring version 36.30
    monitor.startMonitoring('36.30', {
        refreshInterval: 60000, // 1 minute
        alertThresholds: {
            openBeyondPD: 5,
            criticalHotfixes: 3,
            asapHotfixes: 2
        }
    })
    .then(result => {
        if (result.success) {
            console.log(result.dashboard);
            console.log(`\nMonitor ID: ${result.monitorId}`);
            console.log(`Alerts: ${result.alerts.length}`);
        } else {
            console.error('Monitor failed to start:', result.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}