//======================================================================================================================
// Release Readiness Report Script
// Purpose: Pre-release go/no-go assessment based on milestone completion, blockers, and risk factors
//======================================================================================================================

// Import existing configuration from version report
const { FIELDS, CONFIG } = require('./current/versionreport.js');

/**
 * Release Readiness Report Generator
 * Analyzes release readiness across multiple dimensions to provide go/no-go recommendation
 */
class ReleaseReadinessReportGenerator {
    constructor() {
        this.readinessWeights = {
            milestoneCompletion: 0.30,    // 30% - critical path items
            blockerResolution: 0.25,      // 25% - blocking issues
            qualityMetrics: 0.20,         // 20% - quality gates
            riskAssessment: 0.15,         // 15% - identified risks
            teamReadiness: 0.10           // 10% - team capacity and readiness
        };
        
        this.readinessThresholds = {
            GREEN: 85,     // Ready to ship
            YELLOW: 70,    // Caution - review needed
            RED: 60        // Not ready - significant concerns
        };
    }

    /**
     * Generate comprehensive release readiness assessment
     */
    async generateReadinessReport(targetVersion, options = {}) {
        try {
            console.log(`Generating Release Readiness report for version: ${targetVersion}`);
            
            const {
                assessmentDate = new Date(),
                plannedReleaseDate = null,
                includeRecommendations = true
            } = options;

            // Collect readiness data
            const readinessData = await this.collectReadinessData(targetVersion, assessmentDate);
            
            // Perform readiness analysis
            const analysis = this.analyzeReadiness(readinessData, targetVersion);
            
            // Generate go/no-go recommendation
            const recommendation = this.generateRecommendation(analysis, plannedReleaseDate);
            
            // Generate detailed report
            const report = this.generateReadinessMarkdown({
                targetVersion,
                assessmentDate,
                plannedReleaseDate,
                data: readinessData,
                analysis: analysis,
                recommendation: recommendation,
                includeRecommendations
            });
            
            return {
                success: true,
                version: targetVersion,
                readinessScore: analysis.overall.readinessScore,
                recommendation: recommendation.decision,
                confidence: recommendation.confidence,
                data: readinessData,
                analysis: analysis,
                markdown: report,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error(`Error generating Release Readiness report for ${targetVersion}:`, error);
            return {
                success: false,
                error: error.message,
                version: targetVersion,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Collect all data needed for readiness assessment
     */
    async collectReadinessData(targetVersion, assessmentDate) {
        const data = {
            version: targetVersion,
            assessmentDate: assessmentDate,
            
            // Core data from existing tables
            builds: [],
            openIssues: [],
            integrations: [],
            hotfixes: [],
            incidents: [],
            rqa: [],
            
            // Milestone tracking
            milestones: {},
            
            // Risk factors
            risks: [],
            
            // Team readiness
            teamStatus: {}
        };

        // Get builds data for the target version
        data.builds = await this.getVersionBuilds(targetVersion);
        
        // Get open issues that could block release
        data.openIssues = await this.getOpenIssues(targetVersion);
        
        // Get integration status
        data.integrations = await this.getIntegrationStatus(targetVersion);
        
        // Get recent hotfixes (quality indicator)
        data.hotfixes = await this.getRecentHotfixes(targetVersion);
        
        // Get recent incidents (stability indicator)
        data.incidents = await this.getRecentIncidents(targetVersion);
        
        // Get RQA status
        data.rqa = await this.getRQAStatus(targetVersion);
        
        // Extract milestone information
        data.milestones = this.extractMilestones(data.builds);
        
        // Identify risk factors
        data.risks = this.identifyRisks(data);
        
        // Assess team readiness (if data available)
        data.teamStatus = await this.assessTeamReadiness(targetVersion);
        
        return data;
    }

    /**
     * Get builds data for target version
     */
    async getVersionBuilds(targetVersion) {
        const buildsTable = base.getTable('Builds');
        const query = await buildsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                FIELDS.DEPLOY_CLASSIFICATION,
                'Status',
                'Live Date',
                'HL Date',
                'PD Date', 
                'Cert Sub Date',
                FIELDS.MS_HARD_LOCK,
                FIELDS.MS_PENCILS_DOWN,
                FIELDS.MS_CERT,
                FIELDS.MS_LIVE,
                'Build Phase',
                'Total Hotfixes',
                'Total Integrations',
                'SH - Total',
                'Release Health Score'
            ]
        });

        return query.records
            .filter(record => {
                const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                return version === targetVersion;
            })
            .map(record => this.formatBuildRecord(record));
    }

    /**
     * Get open issues that could impact release
     */
    async getOpenIssues(targetVersion) {
        const openIssuesTable = base.getTable('Open Issues');
        const query = await openIssuesTable.selectRecordsAsync();

        // Filter for issues related to the target version
        return query.records
            .filter(record => {
                const deploy = record.getCellValueAsString('Deploy');
                return deploy === targetVersion;
            })
            .map(record => ({
                deploy: record.getCellValueAsString('Deploy'),
                plannedWork: record.getCellValue('Planned Work') || 0,
                completedWork: record.getCellValue('Completed Work') || 0,
                completedOnTime: record.getCellValue('Completed On Time') || 0,
                completedLate: record.getCellValue('Completed Late (Total)') || 0,
                openBeyondHL: record.getCellValue('Open Beyond Hard Lock') || 0,
                openBeyondPD: record.getCellValue('Open Beyond Pencils Down') || 0,
                puntedWork: record.getCellValue('All Punted Work') || 0,
                totalIntegrations: record.getCellValue('Total Integration Requests') || 0
            }));
    }

    /**
     * Get integration status for target version
     */
    async getIntegrationStatus(targetVersion) {
        const integrationsTable = base.getTable('Integrations');
        const query = await integrationsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                'Status',
                'Priority',
                FIELDS.HL_TO_PD_FLAG,
                FIELDS.PD_TO_CERT_SUB_FLAG,
                FIELDS.LIVE_PLUS_FLAG,
                FIELDS.INTEGRATION_AREA,
                FIELDS.INTEGRATION_CREATED_FIELD,
                FIELDS.INTEGRATION_RESOLVED_FIELD
            ]
        });

        return query.records
            .filter(record => {
                const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                return version === targetVersion;
            })
            .map(record => ({
                issueKey: record.getCellValueAsString('Issue Key'),
                status: record.getCellValueAsString('Status'),
                priority: record.getCellValueAsString('Priority'),
                hlToPd: record.getCellValue(FIELDS.HL_TO_PD_FLAG) || 0,
                pdToCert: record.getCellValue(FIELDS.PD_TO_CERT_SUB_FLAG) || 0,
                livePlus: record.getCellValue(FIELDS.LIVE_PLUS_FLAG) || 0,
                area: record.getCellValue(FIELDS.INTEGRATION_AREA),
                created: record.getCellValue(FIELDS.INTEGRATION_CREATED_FIELD),
                resolved: record.getCellValue(FIELDS.INTEGRATION_RESOLVED_FIELD),
                buildVersion: version
            }));
    }

    /**
     * Get recent hotfixes as quality indicator
     */
    async getRecentHotfixes(targetVersion) {
        const hotfixesTable = base.getTable('Hotfixes');
        const query = await hotfixesTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                'Status',
                FIELDS.PRIORITY,
                FIELDS.URGENCY_CUSTOM_FIELD,
                FIELDS.QA_STATE,
                FIELDS.HOTFIX_CREATED_FIELD,
                FIELDS.HOTFIX_RESOLVED_FIELD
            ]
        });

        // Get hotfixes for current version and recent ones (quality trend)
        const relevantHotfixes = query.records.filter(record => {
            const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
            const created = record.getCellValue(FIELDS.HOTFIX_CREATED_FIELD);
            
            // Include current version hotfixes and recent ones for trend analysis
            return version === targetVersion || 
                   (created && this.isRecentDate(created, 30)); // Last 30 days
        });

        return relevantHotfixes.map(record => this.formatHotfixRecord(record));
    }

    /**
     * Get recent incidents as stability indicator
     */
    async getRecentIncidents(targetVersion) {
        const incidentsTable = base.getTable('ShitHappens');
        const query = await incidentsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                'Status',
                FIELDS.SEVERITY_NORMALIZED,
                FIELDS.SH_CREATED_FIELD,
                FIELDS.SH_RESOLVED_FIELD,
                FIELDS.PRE_SH_FLAG
            ]
        });

        return query.records
            .filter(record => {
                const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                const created = record.getCellValue(FIELDS.SH_CREATED_FIELD);
                
                return version === targetVersion || 
                       (created && this.isRecentDate(created, 30));
            })
            .map(record => this.formatIncidentRecord(record));
    }

    /**
     * Get RQA status for quality gates
     */
    async getRQAStatus(targetVersion) {
        const rqaTable = base.getTable('RQA');
        const query = await rqaTable.selectRecordsAsync({
            fields: [
                FIELDS.RQA_FIX_VERSION,
                'Status',
                FIELDS.PRIORITY,
                FIELDS.RQA_LABELS,
                FIELDS.RQA_CREATED,
                FIELDS.RQA_RESOLVED
            ]
        });

        return query.records
            .filter(record => {
                const fixVersions = record.getCellValue(FIELDS.RQA_FIX_VERSION) || [];
                return fixVersions.some(version => version === targetVersion);
            })
            .map(record => ({
                issueKey: record.getCellValueAsString('Issue Key'),
                status: record.getCellValueAsString('Status'),
                priority: record.getCellValueAsString(FIELDS.PRIORITY),
                labels: record.getCellValue(FIELDS.RQA_LABELS) || [],
                created: record.getCellValue(FIELDS.RQA_CREATED),
                resolved: record.getCellValue(FIELDS.RQA_RESOLVED),
                fixVersions: record.getCellValue(FIELDS.RQA_FIX_VERSION) || []
            }));
    }

    /**
     * Analyze overall readiness across all dimensions
     */
    analyzeReadiness(data, targetVersion) {
        const analysis = {
            version: targetVersion,
            
            // Individual dimension scores
            milestones: this.analyzeMilestoneReadiness(data),
            blockers: this.analyzeBlockers(data),
            quality: this.analyzeQualityReadiness(data),
            risks: this.analyzeRisks(data),
            team: this.analyzeTeamReadiness(data),
            
            // Overall assessment
            overall: {}
        };

        // Calculate weighted overall readiness score
        analysis.overall = this.calculateOverallReadiness(analysis);
        
        return analysis;
    }

    /**
     * Analyze milestone completion readiness
     */
    analyzeMilestoneReadiness(data) {
        const milestones = data.milestones;
        const currentDate = data.assessmentDate;
        
        const milestoneAnalysis = {
            hardLock: this.assessMilestone(milestones.hardLock, currentDate, 'Hard Lock'),
            pencilsDown: this.assessMilestone(milestones.pencilsDown, currentDate, 'Pencils Down'),
            certSub: this.assessMilestone(milestones.certSub, currentDate, 'Cert Sub'),
            live: this.assessMilestone(milestones.live, currentDate, 'Live'),
            overallScore: 0,
            completedCount: 0,
            totalCount: 4,
            criticalIssues: []
        };

        // Count completed milestones
        const milestoneValues = [
            milestoneAnalysis.hardLock,
            milestoneAnalysis.pencilsDown, 
            milestoneAnalysis.certSub,
            milestoneAnalysis.live
        ];
        
        milestoneAnalysis.completedCount = milestoneValues.filter(m => m.status === 'completed').length;
        
        // Calculate score based on completion and timing
        let score = (milestoneAnalysis.completedCount / milestoneAnalysis.totalCount) * 100;
        
        // Adjust for timing (penalties for late milestones)
        milestoneValues.forEach(milestone => {
            if (milestone.status === 'late') {
                score -= 15; // 15 point penalty for late milestones
                milestoneAnalysis.criticalIssues.push(`${milestone.name} milestone completed late`);
            } else if (milestone.status === 'at_risk') {
                score -= 10; // 10 point penalty for at-risk milestones
                milestoneAnalysis.criticalIssues.push(`${milestone.name} milestone at risk`);
            }
        });
        
        milestoneAnalysis.overallScore = Math.max(0, Math.round(score));
        
        return milestoneAnalysis;
    }

    /**
     * Analyze blocking issues
     */
    analyzeBlockers(data) {
        const openIssues = data.openIssues[0] || {}; // Assuming single record for version
        const integrations = data.integrations;
        const incidents = data.incidents.filter(i => i.status !== 'Done' && i.status !== 'Closed');
        
        const blockerAnalysis = {
            openWork: {
                planned: openIssues.plannedWork || 0,
                completed: openIssues.completedWork || 0,
                remaining: (openIssues.plannedWork || 0) - (openIssues.completedWork || 0),
                completionRate: 0
            },
            lateWork: {
                openBeyondHL: openIssues.openBeyondHL || 0,
                openBeyondPD: openIssues.openBeyondPD || 0,
                puntedWork: openIssues.puntedWork || 0
            },
            integrations: {
                total: integrations.length,
                pending: integrations.filter(i => i.status !== 'Closed' && i.status !== 'Done').length,
                critical: integrations.filter(i => i.priority === '0 - Blocker' || i.priority === '1 - Critical').length
            },
            incidents: {
                total: incidents.length,
                critical: incidents.filter(i => i.severity === 'Sev 1' || i.severity === 'Sev 2').length
            },
            overallScore: 0,
            blockerCount: 0,
            criticalIssues: []
        };

        // Calculate completion rate
        if (blockerAnalysis.openWork.planned > 0) {
            blockerAnalysis.openWork.completionRate = 
                Math.round((blockerAnalysis.openWork.completed / blockerAnalysis.openWork.planned) * 100);
        }

        // Count total blockers
        blockerAnalysis.blockerCount = 
            blockerAnalysis.lateWork.openBeyondPD +
            blockerAnalysis.integrations.critical +
            blockerAnalysis.incidents.critical;

        // Calculate blocker score
        let score = 100;
        
        // Penalties for various blocker types
        score -= blockerAnalysis.blockerCount * 15; // 15 points per blocker
        score -= blockerAnalysis.lateWork.openBeyondHL * 5; // 5 points per late HL item
        score -= Math.max(0, (100 - blockerAnalysis.openWork.completionRate)) * 0.5; // Work completion penalty

        // Identify critical issues
        if (blockerAnalysis.integrations.critical > 0) {
            blockerAnalysis.criticalIssues.push(`${blockerAnalysis.integrations.critical} critical integration(s) pending`);
        }
        if (blockerAnalysis.incidents.critical > 0) {
            blockerAnalysis.criticalIssues.push(`${blockerAnalysis.incidents.critical} critical incident(s) unresolved`);
        }
        if (blockerAnalysis.openWork.completionRate < 80) {
            blockerAnalysis.criticalIssues.push(`Work completion rate only ${blockerAnalysis.openWork.completionRate}%`);
        }

        blockerAnalysis.overallScore = Math.max(0, Math.round(score));
        
        return blockerAnalysis;
    }

    /**
     * Analyze quality readiness
     */
    analyzeQualityReadiness(data) {
        const hotfixes = data.hotfixes;
        const rqa = data.rqa;
        const currentVersionHotfixes = hotfixes.filter(h => h.buildVersion === data.version);
        
        const qualityAnalysis = {
            hotfixes: {
                total: currentVersionHotfixes.length,
                critical: currentVersionHotfixes.filter(h => h.priority === '0 - Blocker' || h.priority === '1 - Critical').length,
                urgent: currentVersionHotfixes.filter(h => h.urgency === 'ASAP' || h.urgency === 'Today').length,
                qaVerified: currentVersionHotfixes.filter(h => h.qaState && h.qaState.includes('verified')).length,
                qaVerificationRate: 0
            },
            rqa: {
                total: rqa.length,
                completed: rqa.filter(r => r.status === 'Closed' || r.status === 'Done').length,
                critical: rqa.filter(r => r.priority === '0 - Blocker' || r.priority === '1 - Critical').length,
                completionRate: 0
            },
            trends: {
                hotfixTrend: this.calculateHotfixTrend(hotfixes),
                qualityTrend: 'stable' // Would be calculated from historical data
            },
            overallScore: 0,
            criticalIssues: []
        };

        // Calculate rates
        if (qualityAnalysis.hotfixes.total > 0) {
            qualityAnalysis.hotfixes.qaVerificationRate = 
                Math.round((qualityAnalysis.hotfixes.qaVerified / qualityAnalysis.hotfixes.total) * 100);
        }
        
        if (qualityAnalysis.rqa.total > 0) {
            qualityAnalysis.rqa.completionRate = 
                Math.round((qualityAnalysis.rqa.completed / qualityAnalysis.rqa.total) * 100);
        }

        // Calculate quality score
        let score = 100;
        
        // Penalties for quality issues
        score -= qualityAnalysis.hotfixes.critical * 10; // 10 points per critical hotfix
        score -= qualityAnalysis.hotfixes.urgent * 5; // 5 points per urgent hotfix
        score -= Math.max(0, (80 - qualityAnalysis.hotfixes.qaVerificationRate)) * 0.5; // QA verification penalty
        score -= Math.max(0, (90 - qualityAnalysis.rqa.completionRate)) * 0.3; // RQA completion penalty

        // Identify critical issues
        if (qualityAnalysis.hotfixes.critical > 3) {
            qualityAnalysis.criticalIssues.push(`High number of critical hotfixes (${qualityAnalysis.hotfixes.critical})`);
        }
        if (qualityAnalysis.hotfixes.qaVerificationRate < 70) {
            qualityAnalysis.criticalIssues.push(`Low QA verification rate (${qualityAnalysis.hotfixes.qaVerificationRate}%)`);
        }
        if (qualityAnalysis.rqa.critical > 0) {
            qualityAnalysis.criticalIssues.push(`${qualityAnalysis.rqa.critical} critical RQA item(s) pending`);
        }

        qualityAnalysis.overallScore = Math.max(0, Math.round(score));
        
        return qualityAnalysis;
    }

    /**
     * Generate go/no-go recommendation
     */
    generateRecommendation(analysis, plannedReleaseDate) {
        const overallScore = analysis.overall.readinessScore;
        const confidence = analysis.overall.confidence;
        
        let decision, reasoning, conditions, timeline;
        
        if (overallScore >= this.readinessThresholds.GREEN) {
            decision = 'GO';
            reasoning = 'Release meets all readiness criteria with high confidence';
            conditions = [];
            timeline = 'Ready for immediate release';
        } else if (overallScore >= this.readinessThresholds.YELLOW) {
            decision = 'GO_WITH_CONDITIONS';
            reasoning = 'Release can proceed with identified conditions addressed';
            conditions = this.generateConditions(analysis);
            timeline = 'Release after conditions are met';
        } else {
            decision = 'NO_GO';
            reasoning = 'Significant readiness gaps identified that must be addressed';
            conditions = this.generateBlockingIssues(analysis);
            timeline = 'Delay release until critical issues resolved';
        }
        
        return {
            decision,
            reasoning,
            conditions,
            timeline,
            confidence,
            overallScore,
            lastAssessed: new Date().toISOString(),
            plannedDate: plannedReleaseDate,
            recommendedActions: this.generateRecommendedActions(analysis, decision)
        };
    }

    /**
     * Generate markdown report
     */
    generateReadinessMarkdown(reportData) {
        const { targetVersion, analysis, recommendation } = reportData;
        
        const statusEmoji = {
            'GO': '🟢',
            'GO_WITH_CONDITIONS': '🟡', 
            'NO_GO': '🔴'
        };
        
        return `# 🚀 Release Readiness Assessment: Version ${targetVersion}

## 📊 Overall Readiness: ${analysis.overall.readinessScore}/100

### ${statusEmoji[recommendation.decision]} **${recommendation.decision.replace('_', ' ')}**
**Reasoning**: ${recommendation.reasoning}
**Confidence**: ${recommendation.confidence}
**Timeline**: ${recommendation.timeline}

---

## 📈 Readiness Breakdown

### 🎯 Milestone Completion: ${analysis.milestones.overallScore}/100
- **Completed**: ${analysis.milestones.completedCount}/${analysis.milestones.totalCount} milestones
- **Hard Lock**: ${this.formatMilestoneStatus(analysis.milestones.hardLock)}
- **Pencils Down**: ${this.formatMilestoneStatus(analysis.milestones.pencilsDown)}
- **Cert Sub**: ${this.formatMilestoneStatus(analysis.milestones.certSub)}
- **Live**: ${this.formatMilestoneStatus(analysis.milestones.live)}

### 🚧 Blocker Analysis: ${analysis.blockers.overallScore}/100
- **Total Blockers**: ${analysis.blockers.blockerCount}
- **Work Completion**: ${analysis.blockers.openWork.completionRate}% (${analysis.blockers.openWork.completed}/${analysis.blockers.openWork.planned})
- **Late Work Items**: ${analysis.blockers.lateWork.openBeyondPD} beyond Pencils Down
- **Critical Integrations**: ${analysis.blockers.integrations.critical} pending
- **Critical Incidents**: ${analysis.blockers.incidents.critical} unresolved

### ✅ Quality Gates: ${analysis.quality.overallScore}/100
- **Current Hotfixes**: ${analysis.quality.hotfixes.total} (${analysis.quality.hotfixes.critical} critical)
- **QA Verification**: ${analysis.quality.hotfixes.qaVerificationRate}%
- **RQA Completion**: ${analysis.quality.rqa.completionRate}% (${analysis.quality.rqa.completed}/${analysis.quality.rqa.total})
- **Quality Trend**: ${analysis.quality.trends.qualityTrend} ${this.getTrendEmoji(analysis.quality.trends.qualityTrend)}

### ⚠️ Risk Assessment: ${analysis.risks.overallScore}/100
- **Total Risks**: ${analysis.risks.totalRisks}
- **High Risk Items**: ${analysis.risks.highRiskCount}
- **Risk Trend**: ${analysis.risks.trend}

### 👥 Team Readiness: ${analysis.team.overallScore}/100
- **Team Availability**: ${analysis.team.availability}%
- **Capacity Utilization**: ${analysis.team.utilization}%

---

## 🎯 Recommendation Details

${recommendation.conditions.length > 0 ? `
### Conditions for Release
${recommendation.conditions.map((condition, index) => `${index + 1}. ${condition}`).join('\n')}
` : ''}

### Recommended Actions
${recommendation.recommendedActions.map((action, index) => `${index + 1}. **${action.category}**: ${action.action} (${action.priority})`).join('\n')}

---

## 🚨 Critical Issues

### Milestone Issues
${analysis.milestones.criticalIssues.map(issue => `- ${issue}`).join('\n') || '- None identified'}

### Blocker Issues  
${analysis.blockers.criticalIssues.map(issue => `- ${issue}`).join('\n') || '- None identified'}

### Quality Issues
${analysis.quality.criticalIssues.map(issue => `- ${issue}`).join('\n') || '- None identified'}

---

## 📊 Detailed Metrics

### Integration Status
| Status | Count | Percentage |
|--------|-------|------------|
| Completed | ${analysis.blockers.integrations.total - analysis.blockers.integrations.pending} | ${Math.round(((analysis.blockers.integrations.total - analysis.blockers.integrations.pending) / Math.max(1, analysis.blockers.integrations.total)) * 100)}% |
| Pending | ${analysis.blockers.integrations.pending} | ${Math.round((analysis.blockers.integrations.pending / Math.max(1, analysis.blockers.integrations.total)) * 100)}% |
| Critical | ${analysis.blockers.integrations.critical} | ${Math.round((analysis.blockers.integrations.critical / Math.max(1, analysis.blockers.integrations.total)) * 100)}% |

### Quality Metrics
- **Hotfix Volume**: ${analysis.quality.hotfixes.total} (trending ${analysis.quality.trends.hotfixTrend})
- **Critical Hotfixes**: ${analysis.quality.hotfixes.critical}
- **Urgent Hotfixes**: ${analysis.quality.hotfixes.urgent}
- **QA Verified**: ${analysis.quality.hotfixes.qaVerified}/${analysis.quality.hotfixes.total}

---

## ⏰ Next Assessment
**Recommended**: Review readiness status daily until release
**Next Review**: ${this.getNextReviewDate(recommendation.decision)}
**Key Monitoring**: ${this.getKeyMonitoringItems(analysis)}

---

*Release Readiness Assessment generated on ${new Date().toLocaleString()}*
*Assessment based on ${Object.keys(reportData.data).length} data sources and ${this.readinessWeights.length} readiness dimensions*`;
    }

    // Helper methods
    extractMilestones(builds) {
        if (!builds || builds.length === 0) return {};
        
        const build = builds[0]; // Primary build record
        return {
            hardLock: build.msHardLock,
            pencilsDown: build.msPencilsDown,
            certSub: build.msCert,
            live: build.msLive
        };
    }

    assessMilestone(milestoneDate, currentDate, milestoneName) {
        const milestone = {
            name: milestoneName,
            plannedDate: milestoneDate,
            status: 'pending',
            daysFromNow: null
        };
        
        if (!milestoneDate) {
            milestone.status = 'not_scheduled';
            return milestone;
        }
        
        const planned = new Date(milestoneDate);
        const now = new Date(currentDate);
        const diffDays = Math.ceil((planned - now) / (1000 * 60 * 60 * 24));
        
        milestone.daysFromNow = diffDays;
        
        if (diffDays < -1) {
            milestone.status = 'late';
        } else if (diffDays <= 0) {
            milestone.status = 'completed';
        } else if (diffDays <= 2) {
            milestone.status = 'at_risk';
        } else {
            milestone.status = 'on_track';
        }
        
        return milestone;
    }

    calculateOverallReadiness(analysis) {
        const weights = this.readinessWeights;
        
        const weightedScore = 
            analysis.milestones.overallScore * weights.milestoneCompletion +
            analysis.blockers.overallScore * weights.blockerResolution +
            analysis.quality.overallScore * weights.qualityMetrics +
            analysis.risks.overallScore * weights.riskAssessment +
            analysis.team.overallScore * weights.teamReadiness;
        
        const readinessScore = Math.round(weightedScore);
        
        // Calculate confidence based on data completeness and score consistency
        const scores = [
            analysis.milestones.overallScore,
            analysis.blockers.overallScore,
            analysis.quality.overallScore,
            analysis.risks.overallScore,
            analysis.team.overallScore
        ];
        
        const scoreVariance = this.calculateVariance(scores);
        const confidence = scoreVariance < 200 ? 'high' : scoreVariance < 400 ? 'medium' : 'low';
        
        return {
            readinessScore,
            confidence,
            breakdown: {
                milestones: analysis.milestones.overallScore,
                blockers: analysis.blockers.overallScore,
                quality: analysis.quality.overallScore,
                risks: analysis.risks.overallScore,
                team: analysis.team.overallScore
            },
            weights: weights
        };
    }

    // Additional helper methods...
    formatBuildRecord(record) { /* ... */ }
    formatHotfixRecord(record) { /* ... */ }
    formatIncidentRecord(record) { /* ... */ }
    isRecentDate(date, days) { /* ... */ }
    identifyRisks(data) { /* ... */ }
    assessTeamReadiness(version) { /* ... */ }
    analyzeRisks(data) { /* ... */ }
    analyzeTeamReadiness(data) { /* ... */ }
    calculateHotfixTrend(hotfixes) { /* ... */ }
    generateConditions(analysis) { /* ... */ }
    generateBlockingIssues(analysis) { /* ... */ }
    generateRecommendedActions(analysis, decision) { /* ... */ }
    formatMilestoneStatus(milestone) { /* ... */ }
    getTrendEmoji(trend) { /* ... */ }
    getNextReviewDate(decision) { /* ... */ }
    getKeyMonitoringItems(analysis) { /* ... */ }
    calculateVariance(scores) { /* ... */ }
}

module.exports = ReleaseReadinessReportGenerator;

// Usage example
if (require.main === module) {
    const generator = new ReleaseReadinessReportGenerator();
    
    // Generate readiness assessment for version 36.30
    generator.generateReadinessReport('36.30', {
        plannedReleaseDate: '2025-07-25',
        includeRecommendations: true
    })
    .then(result => {
        if (result.success) {
            console.log(`Release Readiness: ${result.recommendation} (${result.readinessScore}/100)`);
            console.log(result.markdown);
        } else {
            console.error('Assessment failed:', result.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}