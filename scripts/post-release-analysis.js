//======================================================================================================================
// Post-Release Analysis Report Script
// Purpose: Retrospective analysis after release goes live, focusing on first 24-72 hours and lessons learned
//======================================================================================================================

const { FIELDS, CONFIG } = require('./current/versionreport.js');

/**
 * Post-Release Analysis Report Generator
 * Analyzes release performance after going live, including incidents, hotfixes, and lessons learned
 */
class PostReleaseAnalysisGenerator {
    constructor() {
        this.analysisWindows = {
            immediate: { hours: 4, name: 'First 4 Hours' },
            short: { hours: 24, name: 'First 24 Hours' },
            medium: { hours: 72, name: 'First 72 Hours' },
            extended: { days: 7, name: 'First Week' }
        };
        
        this.releaseSuccessMetrics = {
            stability: 0.30,        // 30% - incident-free operation
            performance: 0.25,      // 25% - performance metrics
            rollback: 0.20,         // 20% - no rollbacks required  
            hotfixVolume: 0.15,     // 15% - minimal emergency fixes
            userImpact: 0.10        // 10% - user-facing issues
        };
    }

    /**
     * Generate comprehensive post-release analysis
     */
    async generatePostReleaseAnalysis(targetVersion, options = {}) {
        try {
            console.log(`Generating Post-Release Analysis for version: ${targetVersion}`);
            
            const {
                analysisDate = new Date(),
                liveDate = null,
                analysisWindow = 'medium', // immediate, short, medium, extended
                includeComparisons = true,
                includeLessonsLearned = true
            } = options;

            // Determine live date if not provided
            const releaseInfo = await this.getReleaseInfo(targetVersion);
            const actualLiveDate = liveDate || releaseInfo.liveDate;
            
            if (!actualLiveDate) {
                throw new Error(`Cannot determine live date for version ${targetVersion}`);
            }

            // Collect post-release data
            const postReleaseData = await this.collectPostReleaseData(
                targetVersion, 
                actualLiveDate, 
                analysisDate,
                this.analysisWindows[analysisWindow]
            );
            
            // Perform analysis
            const analysis = this.analyzePostReleasePerformance(postReleaseData, targetVersion);
            
            // Generate insights and lessons learned
            const insights = this.generatePostReleaseInsights(analysis);
            const lessonsLearned = includeLessonsLearned ? 
                this.generateLessonsLearned(analysis, postReleaseData) : [];
            
            // Compare with previous releases if requested
            const comparisons = includeComparisons ? 
                await this.compareWithPreviousReleases(analysis, targetVersion) : null;
            
            // Generate recommendations
            const recommendations = this.generatePostReleaseRecommendations(analysis, insights);
            
            // Generate report
            const report = this.generatePostReleaseMarkdown({
                targetVersion,
                liveDate: actualLiveDate,
                analysisDate,
                analysisWindow: this.analysisWindows[analysisWindow],
                data: postReleaseData,
                analysis: analysis,
                insights: insights,
                lessonsLearned: lessonsLearned,
                comparisons: comparisons,
                recommendations: recommendations
            });
            
            return {
                success: true,
                version: targetVersion,
                liveDate: actualLiveDate,
                analysisWindow: analysisWindow,
                releaseScore: analysis.overall.releaseScore,
                stabilityRating: analysis.stability.rating,
                data: postReleaseData,
                analysis: analysis,
                insights: insights,
                lessonsLearned: lessonsLearned,
                recommendations: recommendations,
                markdown: report,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Error generating Post-Release Analysis for ${targetVersion}:`, error);
            return {
                success: false,
                error: error.message,
                version: targetVersion,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get basic release information
     */
    async getReleaseInfo(targetVersion) {
        const buildsTable = base.getTable('Builds');
        const query = await buildsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                'Live Date',
                'Start date',
                FIELDS.MS_LIVE,
                'Build Phase',
                FIELDS.DEPLOY_CLASSIFICATION
            ]
        });

        const releaseRecord = query.records.find(record => {
            const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
            return version === targetVersion;
        });

        if (!releaseRecord) {
            throw new Error(`Release record not found for version ${targetVersion}`);
        }

        return {
            version: targetVersion,
            liveDate: releaseRecord.getCellValue('Live Date') || releaseRecord.getCellValue('Start date'),
            buildPhase: releaseRecord.getCellValueAsString('Build Phase'),
            deployType: releaseRecord.getCellValueAsString(FIELDS.DEPLOY_CLASSIFICATION),
            recordId: releaseRecord.id
        };
    }

    /**
     * Collect all post-release data within the analysis window
     */
    async collectPostReleaseData(targetVersion, liveDate, analysisDate, analysisWindow) {
        const windowStart = new Date(liveDate);
        const windowEnd = this.calculateWindowEnd(windowStart, analysisWindow);
        const actualEnd = new Date(Math.min(windowEnd.getTime(), analysisDate.getTime()));

        const data = {
            version: targetVersion,
            liveDate: liveDate,
            analysisWindow: analysisWindow,
            windowStart: windowStart,
            windowEnd: actualEnd,
            
            // Core post-release data
            incidents: [],
            hotfixes: [],
            rollbacks: [],
            performance: {},
            userFeedback: [],
            
            // Operational data
            deployments: [],
            monitoring: {},
            teamResponse: {}
        };

        // Get incidents that occurred after release
        data.incidents = await this.getPostReleaseIncidents(targetVersion, windowStart, actualEnd);
        
        // Get hotfixes created after release
        data.hotfixes = await this.getPostReleaseHotfixes(targetVersion, windowStart, actualEnd);
        
        // Check for any rollbacks or emergency responses
        data.rollbacks = await this.getPostReleaseRollbacks(targetVersion, windowStart, actualEnd);
        
        // Get additional deployments (hotfixes, patches)
        data.deployments = await this.getPostReleaseDeployments(targetVersion, windowStart, actualEnd);
        
        // Get performance data if available
        data.performance = await this.getPerformanceData(targetVersion, windowStart, actualEnd);
        
        // Analyze team response patterns
        data.teamResponse = this.analyzeTeamResponse(data);
        
        return data;
    }

    /**
     * Get incidents that occurred after release
     */
    async getPostReleaseIncidents(targetVersion, windowStart, windowEnd) {
        const incidentsTable = base.getTable('ShitHappens');
        const query = await incidentsTable.selectRecordsAsync({
            fields: [
                'Issue Key',
                'Summary',
                FIELDS.SEVERITY_NORMALIZED,
                FIELDS.SH_CREATED_FIELD,
                FIELDS.SH_RESOLVED_FIELD,
                FIELDS.BUILD_VERSION_UNIFIED,
                'Status',
                FIELDS.SHITHAPPENS_ROOT_CAUSE,
                'Captain',
                'Component/s'
            ]
        });

        return query.records
            .filter(record => {
                const created = record.getCellValue(FIELDS.SH_CREATED_FIELD);
                const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                
                if (!created) return false;
                
                const createdDate = new Date(created);
                const isInWindow = createdDate >= windowStart && createdDate <= windowEnd;
                const isRelatedToVersion = version === targetVersion || 
                    this.isRelatedVersion(version, targetVersion);
                
                return isInWindow && isRelatedToVersion;
            })
            .map(record => ({
                issueKey: record.getCellValueAsString('Issue Key'),
                summary: record.getCellValueAsString('Summary'),
                severity: record.getCellValueAsString(FIELDS.SEVERITY_NORMALIZED),
                created: record.getCellValue(FIELDS.SH_CREATED_FIELD),
                resolved: record.getCellValue(FIELDS.SH_RESOLVED_FIELD),
                status: record.getCellValueAsString('Status'),
                rootCause: record.getCellValue(FIELDS.SHITHAPPENS_ROOT_CAUSE) || [],
                captain: record.getCellValueAsString('Captain'),
                components: record.getCellValue('Component/s') || [],
                buildVersion: record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED),
                timeToDetection: this.calculateTimeToDetection(windowStart, record.getCellValue(FIELDS.SH_CREATED_FIELD)),
                timeToResolution: this.calculateTimeToResolution(
                    record.getCellValue(FIELDS.SH_CREATED_FIELD),
                    record.getCellValue(FIELDS.SH_RESOLVED_FIELD)
                )
            }));
    }

    /**
     * Get hotfixes created after release
     */
    async getPostReleaseHotfixes(targetVersion, windowStart, windowEnd) {
        const hotfixesTable = base.getTable('Hotfixes');
        const query = await hotfixesTable.selectRecordsAsync({
            fields: [
                'Issue Key',
                'Summary',
                FIELDS.PRIORITY,
                FIELDS.URGENCY_CUSTOM_FIELD,
                FIELDS.QA_STATE,
                FIELDS.HOTFIX_CREATED_FIELD,
                FIELDS.HOTFIX_RESOLVED_FIELD,
                FIELDS.BUILD_VERSION_UNIFIED,
                'Status',
                'Component/s',
                'Reporter'
            ]
        });

        return query.records
            .filter(record => {
                const created = record.getCellValue(FIELDS.HOTFIX_CREATED_FIELD);
                const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                
                if (!created) return false;
                
                const createdDate = new Date(created);
                const isInWindow = createdDate >= windowStart && createdDate <= windowEnd;
                const isRelatedToVersion = version === targetVersion || 
                    this.isRelatedVersion(version, targetVersion);
                
                return isInWindow && isRelatedToVersion;
            })
            .map(record => ({
                issueKey: record.getCellValueAsString('Issue Key'),
                summary: record.getCellValueAsString('Summary'),
                priority: record.getCellValueAsString(FIELDS.PRIORITY),
                urgency: record.getCellValueAsString(FIELDS.URGENCY_CUSTOM_FIELD),
                qaState: record.getCellValueAsString(FIELDS.QA_STATE),
                created: record.getCellValue(FIELDS.HOTFIX_CREATED_FIELD),
                resolved: record.getCellValue(FIELDS.HOTFIX_RESOLVED_FIELD),
                status: record.getCellValueAsString('Status'),
                components: record.getCellValue('Component/s') || [],
                reporter: record.getCellValueAsString('Reporter'),
                buildVersion: record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED),
                timeToCreate: this.calculateTimeToDetection(windowStart, record.getCellValue(FIELDS.HOTFIX_CREATED_FIELD)),
                timeToResolve: this.calculateTimeToResolution(
                    record.getCellValue(FIELDS.HOTFIX_CREATED_FIELD),
                    record.getCellValue(FIELDS.HOTFIX_RESOLVED_FIELD)
                )
            }));
    }

    /**
     * Check for rollbacks or emergency deployments
     */
    async getPostReleaseRollbacks(targetVersion, windowStart, windowEnd) {
        // This would check for any emergency deployments or rollbacks
        // For now, check for unplanned deployments shortly after release
        
        const buildsTable = base.getTable('Builds');
        const query = await buildsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                FIELDS.DEPLOY_CLASSIFICATION,
                'Live Date',
                'Start date',
                'Summary'
            ]
        });

        return query.records
            .filter(record => {
                const liveDate = record.getCellValue('Live Date') || record.getCellValue('Start date');
                const deployType = record.getCellValueAsString(FIELDS.DEPLOY_CLASSIFICATION);
                
                if (!liveDate) return false;
                
                const deployDate = new Date(liveDate);
                const isInWindow = deployDate >= windowStart && deployDate <= windowEnd;
                const isUnplanned = deployType === 'Unplanned';
                
                return isInWindow && isUnplanned;
            })
            .map(record => ({
                version: record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED),
                deployType: record.getCellValueAsString(FIELDS.DEPLOY_CLASSIFICATION),
                deployDate: record.getCellValue('Live Date') || record.getCellValue('Start date'),
                summary: record.getCellValueAsString('Summary'),
                timeAfterRelease: this.calculateTimeToDetection(
                    windowStart, 
                    record.getCellValue('Live Date') || record.getCellValue('Start date')
                )
            }));
    }

    /**
     * Get post-release deployments (patches, hotfixes)
     */
    async getPostReleaseDeployments(targetVersion, windowStart, windowEnd) {
        const buildsTable = base.getTable('Builds');
        const query = await buildsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                FIELDS.DEPLOY_CLASSIFICATION,
                'Deploy Type (Deploys)',
                'Live Date',
                'Start date'
            ]
        });

        // Look for related deployments (hotfix versions, patches)
        return query.records
            .filter(record => {
                const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                const liveDate = record.getCellValue('Live Date') || record.getCellValue('Start date');
                
                if (!liveDate) return false;
                
                const deployDate = new Date(liveDate);
                const isInWindow = deployDate >= windowStart && deployDate <= windowEnd;
                const isRelated = this.isRelatedVersion(version, targetVersion) || 
                    this.isHotfixVersion(version, targetVersion);
                
                return isInWindow && isRelated;
            })
            .map(record => ({
                version: record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED),
                deployType: record.getCellValueAsString(FIELDS.DEPLOY_CLASSIFICATION),
                deployCategory: record.getCellValue('Deploy Type (Deploys)') || [],
                deployDate: record.getCellValue('Live Date') || record.getCellValue('Start date'),
                timeAfterRelease: this.calculateTimeToDetection(
                    windowStart, 
                    record.getCellValue('Live Date') || record.getCellValue('Start date')
                )
            }));
    }

    /**
     * Analyze post-release performance
     */
    analyzePostReleasePerformance(data, targetVersion) {
        return {
            version: targetVersion,
            window: data.analysisWindow,
            
            // Core performance metrics
            stability: this.analyzeStability(data),
            response: this.analyzeResponseTimes(data),
            impact: this.analyzeUserImpact(data),
            recovery: this.analyzeRecoveryMetrics(data),
            
            // Operational metrics
            team: this.analyzeTeamPerformance(data),
            process: this.analyzeProcessEffectiveness(data),
            
            // Overall assessment
            overall: {}
        };
    }

    /**
     * Analyze release stability
     */
    analyzeStability(data) {
        const incidents = data.incidents;
        const hotfixes = data.hotfixes;
        const rollbacks = data.rollbacks;
        
        const stability = {
            incidentCount: incidents.length,
            criticalIncidents: incidents.filter(i => i.severity === 'Sev 1' || i.severity === 'Sev 2').length,
            hotfixCount: hotfixes.length,
            urgentHotfixes: hotfixes.filter(h => h.urgency === 'ASAP' || h.urgency === 'Today').length,
            rollbackCount: rollbacks.length,
            
            // Stability metrics
            incidentRate: 0,
            stabilityScore: 0,
            rating: 'unknown',
            
            // Time-based analysis
            incidentsByTimeframe: this.analyzeIncidentsByTimeframe(incidents, data.windowStart),
            hotfixesByTimeframe: this.analyzeHotfixesByTimeframe(hotfixes, data.windowStart)
        };
        
        // Calculate incident rate (incidents per hour)
        const windowHours = (data.windowEnd - data.windowStart) / (1000 * 60 * 60);
        stability.incidentRate = windowHours > 0 ? 
            Math.round((stability.incidentCount / windowHours) * 100) / 100 : 0;
        
        // Calculate stability score
        let score = 100;
        score -= stability.criticalIncidents * 25;  // 25 points per critical incident
        score -= stability.incidentCount * 10;     // 10 points per incident
        score -= stability.urgentHotfixes * 15;    // 15 points per urgent hotfix
        score -= stability.hotfixCount * 5;        // 5 points per hotfix
        score -= stability.rollbackCount * 40;     // 40 points per rollback
        
        stability.stabilityScore = Math.max(0, Math.round(score));
        
        // Determine stability rating
        if (stability.stabilityScore >= 90) {
            stability.rating = 'excellent';
        } else if (stability.stabilityScore >= 75) {
            stability.rating = 'good';
        } else if (stability.stabilityScore >= 60) {
            stability.rating = 'fair';
        } else {
            stability.rating = 'poor';
        }
        
        return stability;
    }

    /**
     * Analyze response times and team effectiveness
     */
    analyzeResponseTimes(data) {
        const incidents = data.incidents;
        const hotfixes = data.hotfixes;
        
        const response = {
            avgTimeToDetection: 0,
            avgTimeToResolution: 0,
            avgHotfixResponse: 0,
            fastestResponse: null,
            slowestResponse: null,
            
            // Response time buckets
            detectionTimes: {
                immediate: 0,  // < 1 hour
                fast: 0,       // 1-4 hours
                moderate: 0,   // 4-12 hours
                slow: 0        // > 12 hours
            },
            
            resolutionTimes: {
                immediate: 0,  // < 2 hours
                fast: 0,       // 2-8 hours
                moderate: 0,   // 8-24 hours
                slow: 0        // > 24 hours
            }
        };
        
        // Calculate detection times
        const detectionTimes = incidents
            .map(i => i.timeToDetection)
            .filter(t => t !== null);
        
        if (detectionTimes.length > 0) {
            response.avgTimeToDetection = Math.round(
                detectionTimes.reduce((sum, time) => sum + time, 0) / detectionTimes.length
            );
        }
        
        // Calculate resolution times
        const resolutionTimes = incidents
            .map(i => i.timeToResolution)
            .filter(t => t !== null);
        
        if (resolutionTimes.length > 0) {
            response.avgTimeToResolution = Math.round(
                resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length
            );
        }
        
        // Categorize response times
        detectionTimes.forEach(time => {
            if (time < 1) response.detectionTimes.immediate++;
            else if (time < 4) response.detectionTimes.fast++;
            else if (time < 12) response.detectionTimes.moderate++;
            else response.detectionTimes.slow++;
        });
        
        resolutionTimes.forEach(time => {
            if (time < 2) response.resolutionTimes.immediate++;
            else if (time < 8) response.resolutionTimes.fast++;
            else if (time < 24) response.resolutionTimes.moderate++;
            else response.resolutionTimes.slow++;
        });
        
        return response;
    }

    /**
     * Generate post-release insights
     */
    generatePostReleaseInsights(analysis) {
        const insights = [];
        const stability = analysis.stability;
        const response = analysis.response;
        
        // Stability insights
        if (stability.rating === 'excellent') {
            insights.push({
                type: 'positive',
                category: 'Stability',
                message: `Release achieved excellent stability with ${stability.stabilityScore}/100 score`,
                evidence: `${stability.incidentCount} incidents, ${stability.hotfixCount} hotfixes in ${analysis.window.name}`,
                impact: 'high'
            });
        } else if (stability.rating === 'poor') {
            insights.push({
                type: 'warning',
                category: 'Stability',
                message: `Release stability concerns identified (${stability.stabilityScore}/100)`,
                evidence: `${stability.criticalIncidents} critical incidents, ${stability.urgentHotfixes} urgent hotfixes`,
                impact: 'high'
            });
        }
        
        // Response time insights
        if (response.avgTimeToDetection > 0 && response.avgTimeToDetection <= 2) {
            insights.push({
                type: 'positive',
                category: 'Response',
                message: `Excellent incident detection time (${response.avgTimeToDetection} hours average)`,
                evidence: 'Fast detection enables quick resolution',
                impact: 'medium'
            });
        } else if (response.avgTimeToDetection > 8) {
            insights.push({
                type: 'warning',
                category: 'Response',
                message: `Slow incident detection time (${response.avgTimeToDetection} hours average)`,
                evidence: 'Delayed detection increases user impact',
                impact: 'medium'
            });
        }
        
        // Pattern insights
        const firstHourIncidents = stability.incidentsByTimeframe.firstHour || 0;
        if (firstHourIncidents > 2) {
            insights.push({
                type: 'warning',
                category: 'Pattern',
                message: `High incident volume in first hour (${firstHourIncidents} incidents)`,
                evidence: 'May indicate insufficient pre-release testing',
                impact: 'high'
            });
        }
        
        return insights;
    }

    /**
     * Generate lessons learned
     */
    generateLessonsLearned(analysis, data) {
        const lessons = [];
        
        // Analyze patterns in incidents and hotfixes
        const incidents = data.incidents;
        const hotfixes = data.hotfixes;
        
        // Component analysis
        const componentIssues = this.analyzeComponentPatterns(incidents, hotfixes);
        Object.entries(componentIssues).forEach(([component, issues]) => {
            if (issues.count > 2) {
                lessons.push({
                    category: 'Component Quality',
                    lesson: `${component} component had ${issues.count} issues post-release`,
                    recommendation: `Increase testing coverage for ${component} component`,
                    evidence: issues.details,
                    priority: 'high'
                });
            }
        });
        
        // Timing analysis
        if (analysis.stability.incidentsByTimeframe.firstHour > 1) {
            lessons.push({
                category: 'Testing Process',
                lesson: 'Multiple incidents occurred within first hour of release',
                recommendation: 'Enhance pre-release testing and canary deployment process',
                evidence: `${analysis.stability.incidentsByTimeframe.firstHour} incidents in first hour`,
                priority: 'high'
            });
        }
        
        // Response time analysis
        if (analysis.response.avgTimeToResolution > 24) {
            lessons.push({
                category: 'Incident Response',
                lesson: 'Average resolution time exceeded 24 hours',
                recommendation: 'Review incident response procedures and team availability',
                evidence: `${analysis.response.avgTimeToResolution} hours average resolution time`,
                priority: 'medium'
            });
        }
        
        return lessons;
    }

    /**
     * Generate markdown report
     */
    generatePostReleaseMarkdown(reportData) {
        const { targetVersion, analysis, insights, lessonsLearned } = reportData;
        const stability = analysis.stability;
        const response = analysis.response;
        
        const ratingEmoji = {
            excellent: '🟢',
            good: '🟡',
            fair: '🟠',
            poor: '🔴'
        };
        
        return `# 📊 Post-Release Analysis: Version ${targetVersion}

## 🎯 Release Performance Summary

**Analysis Window**: ${reportData.analysisWindow.name}
**Live Date**: ${new Date(reportData.liveDate).toLocaleString()}
**Analysis Date**: ${new Date(reportData.analysisDate).toLocaleString()}

### Overall Stability: ${stability.stabilityScore}/100 ${ratingEmoji[stability.rating]}

---

## 📈 Key Metrics

### Stability Metrics
- **Total Incidents**: ${stability.incidentCount}
- **Critical Incidents**: ${stability.criticalIncidents}
- **Total Hotfixes**: ${stability.hotfixCount}
- **Urgent Hotfixes**: ${stability.urgentHotfixes}
- **Rollbacks**: ${stability.rollbackCount}
- **Incident Rate**: ${stability.incidentRate} per hour

### Response Metrics
- **Avg Detection Time**: ${response.avgTimeToDetection} hours
- **Avg Resolution Time**: ${response.avgTimeToResolution} hours
- **Fast Responses**: ${response.detectionTimes.immediate + response.detectionTimes.fast} of ${Object.values(response.detectionTimes).reduce((a, b) => a + b, 0)}

---

## ⏱️ Timeline Analysis

### Incidents by Timeframe
- **First Hour**: ${stability.incidentsByTimeframe.firstHour || 0} incidents
- **First 4 Hours**: ${stability.incidentsByTimeframe.first4Hours || 0} incidents  
- **First 24 Hours**: ${stability.incidentsByTimeframe.first24Hours || 0} incidents
- **Beyond 24 Hours**: ${stability.incidentsByTimeframe.beyond24Hours || 0} incidents

### Hotfixes by Timeframe
- **First Hour**: ${stability.hotfixesByTimeframe.firstHour || 0} hotfixes
- **First 4 Hours**: ${stability.hotfixesByTimeframe.first4Hours || 0} hotfixes
- **First 24 Hours**: ${stability.hotfixesByTimeframe.first24Hours || 0} hotfixes
- **Beyond 24 Hours**: ${stability.hotfixesByTimeframe.beyond24Hours || 0} hotfixes

---

## 🚨 Incident Details

${reportData.data.incidents.length > 0 ? `
### Critical Incidents
${reportData.data.incidents
    .filter(i => i.severity === 'Sev 1' || i.severity === 'Sev 2')
    .map(incident => `
- **${incident.issueKey}**: ${incident.summary}
  - Severity: ${incident.severity}
  - Detection: ${incident.timeToDetection} hours after release
  - Resolution: ${incident.timeToResolution ? incident.timeToResolution + ' hours' : 'Pending'}
  - Components: ${incident.components.join(', ') || 'Not specified'}
`).join('')}

### All Incidents Summary
| Issue | Severity | Detection Time | Resolution Time | Status |
|-------|----------|----------------|-----------------|--------|
${reportData.data.incidents.map(incident => 
    `| ${incident.issueKey} | ${incident.severity} | ${incident.timeToDetection}h | ${incident.timeToResolution || 'Pending'} | ${incident.status} |`
).join('\n')}
` : '### ✅ No Incidents Reported'}

---

## 🔧 Hotfix Analysis

${reportData.data.hotfixes.length > 0 ? `
### Urgent Hotfixes
${reportData.data.hotfixes
    .filter(h => h.urgency === 'ASAP' || h.urgency === 'Today')
    .map(hotfix => `
- **${hotfix.issueKey}**: ${hotfix.summary}
  - Priority: ${hotfix.priority}
  - Urgency: ${hotfix.urgency}
  - Created: ${hotfix.timeToCreate} hours after release
  - Status: ${hotfix.status}
  - Components: ${hotfix.components.join(', ') || 'Not specified'}
`).join('')}

### Hotfix Summary
| Issue | Priority | Urgency | Time to Create | Resolution Time | Status |
|-------|----------|---------|----------------|-----------------|--------|
${reportData.data.hotfixes.map(hotfix => 
    `| ${hotfix.issueKey} | ${hotfix.priority} | ${hotfix.urgency} | ${hotfix.timeToCreate}h | ${hotfix.timeToResolve || 'Pending'} | ${hotfix.status} |`
).join('\n')}
` : '### ✅ No Hotfixes Required'}

---

## 💡 Key Insights

${insights.map(insight => 
    `### ${insight.type === 'positive' ? '🟢' : '🟡'} ${insight.category}\n` +
    `${insight.message}\n` +
    `*Evidence: ${insight.evidence}*\n` +
    `*Impact: ${insight.impact}*`
).join('\n\n')}

---

## 📚 Lessons Learned

${lessonsLearned.length > 0 ? lessonsLearned.map((lesson, index) => 
    `### ${index + 1}. ${lesson.category} (${lesson.priority.toUpperCase()} Priority)\n` +
    `**Lesson**: ${lesson.lesson}\n` +
    `**Recommendation**: ${lesson.recommendation}\n` +
    `**Evidence**: ${lesson.evidence}\n`
).join('\n') : 'No specific lessons identified - release performed within expected parameters.'}

---

## 🎯 Recommendations for Future Releases

${reportData.recommendations.map((rec, index) => 
    `### ${index + 1}. ${rec.category} (${rec.priority.toUpperCase()} Priority)\n` +
    `**Recommendation**: ${rec.recommendation}\n` +
    `**Expected Impact**: ${rec.expectedImpact}\n` +
    `**Implementation**: ${rec.implementation}\n`
).join('\n')}

---

## 📊 Comparative Analysis

${reportData.comparisons ? `
### Release Performance vs Previous Releases
- **Stability Score**: ${reportData.comparisons.stabilityTrend}
- **Incident Volume**: ${reportData.comparisons.incidentTrend}
- **Response Times**: ${reportData.comparisons.responseTrend}
- **Overall Ranking**: ${reportData.comparisons.ranking} out of last ${reportData.comparisons.totalReleases} releases
` : 'Comparative analysis not included in this report.'}

---

*Post-Release Analysis completed on ${new Date().toLocaleString()}*
*Analysis covers ${reportData.analysisWindow.name} following release on ${new Date(reportData.liveDate).toLocaleString()}*`;
    }

    // Helper methods
    calculateWindowEnd(startDate, window) {
        const endDate = new Date(startDate);
        if (window.hours) {
            endDate.setHours(endDate.getHours() + window.hours);
        } else if (window.days) {
            endDate.setDate(endDate.getDate() + window.days);
        }
        return endDate;
    }

    calculateTimeToDetection(releaseTime, eventTime) {
        if (!eventTime) return null;
        const release = new Date(releaseTime);
        const event = new Date(eventTime);
        return Math.round((event - release) / (1000 * 60 * 60) * 10) / 10; // Hours with 1 decimal
    }

    calculateTimeToResolution(createdTime, resolvedTime) {
        if (!createdTime || !resolvedTime) return null;
        const created = new Date(createdTime);
        const resolved = new Date(resolvedTime);
        return Math.round((resolved - created) / (1000 * 60 * 60) * 10) / 10; // Hours with 1 decimal
    }

    isRelatedVersion(version, targetVersion) {
        // Check if version is related (e.g., 36.30 relates to 36.30 HF)
        return version && version.startsWith(targetVersion);
    }

    isHotfixVersion(version, targetVersion) {
        // Check if version is a hotfix of target (e.g., 36.30.1, 36.30 HF)
        return version && (
            version.startsWith(targetVersion + '.') ||
            version.includes(targetVersion + ' HF') ||
            version.includes('HF')
        );
    }

    // Additional helper methods...
    analyzeIncidentsByTimeframe(incidents, windowStart) { /* ... */ }
    analyzeHotfixesByTimeframe(hotfixes, windowStart) { /* ... */ }
    analyzeUserImpact(data) { /* ... */ }
    analyzeRecoveryMetrics(data) { /* ... */ }
    analyzeTeamPerformance(data) { /* ... */ }
    analyzeProcessEffectiveness(data) { /* ... */ }
    analyzeTeamResponse(data) { /* ... */ }
    getPerformanceData(version, start, end) { /* ... */ }
    analyzeComponentPatterns(incidents, hotfixes) { /* ... */ }
    compareWithPreviousReleases(analysis, version) { /* ... */ }
    generatePostReleaseRecommendations(analysis, insights) { /* ... */ }
}

module.exports = PostReleaseAnalysisGenerator;

// Usage example
if (require.main === module) {
    const generator = new PostReleaseAnalysisGenerator();
    
    // Generate post-release analysis for version 36.30
    generator.generatePostReleaseAnalysis('36.30', {
        analysisWindow: 'medium', // First 72 hours
        includeComparisons: true,
        includeLessonsLearned: true
    })
    .then(result => {
        if (result.success) {
            console.log(`Post-Release Analysis: ${result.stabilityRating} stability (${result.releaseScore}/100)`);
            console.log(result.markdown);
        } else {
            console.error('Analysis failed:', result.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}