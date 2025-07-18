//======================================================================================================================
// Milestone Adherence Report Script
// Purpose: Analyzes teams consistently missing milestones and identifies patterns in schedule adherence
// Addresses: Teams consistently missing deadlines - provides actionable insights for improvement
//======================================================================================================================

const { FIELDS, CONFIG } = require('./current/versionreport.js');

/**
 * Milestone Adherence Report Generator
 * Analyzes milestone completion patterns, identifies teams with adherence issues, and provides improvement recommendations
 */
class MilestoneAdherenceReportGenerator {
    constructor() {
        this.milestoneTypes = {
            'Feature Complete Date': { 
                weight: 0.15, 
                criticality: 'medium',
                dependencies: [],
                typical_duration_days: 14
            },
            'Branch Create': { 
                weight: 0.15, 
                criticality: 'medium',
                dependencies: ['Feature Complete Date'],
                typical_duration_days: 3
            },
            'Branch Open': { 
                weight: 0.15, 
                criticality: 'medium',
                dependencies: ['Branch Create'],
                typical_duration_days: 1
            },
            'HL Date': { 
                weight: 0.20, 
                criticality: 'high',
                dependencies: ['Branch Open'],
                typical_duration_days: 14
            },
            'PD Date': { 
                weight: 0.20, 
                criticality: 'high',
                dependencies: ['HL Date'],
                typical_duration_days: 10
            },
            'Cert Sub Date': { 
                weight: 0.10, 
                criticality: 'high',
                dependencies: ['PD Date'],
                typical_duration_days: 5
            },
            'Live Date': { 
                weight: 0.05, 
                criticality: 'critical',
                dependencies: ['Cert Sub Date'],
                typical_duration_days: 14
            }
        };
        
        this.adherenceThresholds = {
            excellent: 90,    // >90% on-time
            good: 75,         // 75-90% on-time
            fair: 60,         // 60-75% on-time
            poor: 60          // <60% on-time
        };
        
        this.delayCategories = {
            minor: { days: 3, impact: 'low' },
            moderate: { days: 7, impact: 'medium' },
            major: { days: 14, impact: 'high' },
            critical: { days: 21, impact: 'critical' }
        };
    }

    /**
     * Generate comprehensive milestone adherence analysis
     */
    async generateMilestoneAdherenceReport(options = {}) {
        try {
            console.log('Generating Milestone Adherence Report...');
            
            const {
                versionFilter = null,
                dateRange = null,
                includeTeamAnalysis = true,
                includePatternAnalysis = true,
                includePredictiveAnalysis = true,
                analyzeRootCauses = true
            } = options;

            // Collect milestone data
            const milestoneData = await this.collectMilestoneData(versionFilter, dateRange);
            
            // Analyze adherence patterns
            const adherenceAnalysis = this.analyzeMilestoneAdherence(milestoneData);
            
            // Identify chronically delayed projects/teams
            const delayPatterns = this.analyzeDelayPatterns(milestoneData);
            
            // Team-specific analysis
            const teamAnalysis = includeTeamAnalysis ? 
                await this.analyzeTeamAdherence(milestoneData) : null;
            
            // Pattern analysis across milestones
            const patternAnalysis = includePatternAnalysis ?
                this.analyzeSystemicPatterns(milestoneData, adherenceAnalysis) : null;
            
            // Predictive analysis for upcoming milestones
            const predictiveAnalysis = includePredictiveAnalysis ?
                await this.generatePredictiveInsights(milestoneData) : null;
            
            // Root cause analysis
            const rootCauseAnalysis = analyzeRootCauses ?
                await this.analyzeRootCauses(milestoneData, delayPatterns) : null;
            
            // Generate insights and recommendations
            const insights = this.generateAdherenceInsights(adherenceAnalysis, delayPatterns);
            const recommendations = this.generateAdherenceRecommendations(adherenceAnalysis, teamAnalysis, rootCauseAnalysis);
            
            // Generate report
            const report = this.generateAdherenceMarkdown({
                versionFilter,
                dateRange,
                data: milestoneData,
                adherence: adherenceAnalysis,
                delays: delayPatterns,
                teams: teamAnalysis,
                patterns: patternAnalysis,
                predictions: predictiveAnalysis,
                rootCauses: rootCauseAnalysis,
                insights: insights,
                recommendations: recommendations
            });
            
            return {
                success: true,
                version: versionFilter,
                overallAdherence: adherenceAnalysis.overall.adherenceRate,
                teamsAtRisk: teamAnalysis?.teamsAtRisk.length || 0,
                criticalDelays: delayPatterns.critical.length,
                data: milestoneData,
                analysis: {
                    adherence: adherenceAnalysis,
                    delays: delayPatterns,
                    teams: teamAnalysis
                },
                insights: insights,
                recommendations: recommendations,
                markdown: report,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error generating Milestone Adherence Report:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Collect milestone data from Builds table
     */
    async collectMilestoneData(versionFilter, dateRange) {
        const buildsTable = base.getTable('Builds');
        const query = await buildsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                'Season (Unified)',
                'Feature Complete Date',
                'Branch Create',
                'Branch Open', 
                'HL Date',
                'PD Date',
                'Cert Sub Date',
                'Live Date',
                'Next Version Live Date',
                'Start date',
                'Status',
                'Deploy Classification',
                'Release Health Score',
                'Total Hotfixes',
                'Total Integrations'
            ]
        });

        return query.records
            .filter(record => {
                // Apply version filter
                if (versionFilter) {
                    const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                    if (version !== versionFilter) return false;
                }
                
                // Apply date range filter based on start date
                if (dateRange) {
                    const startDate = record.getCellValue('Start date');
                    if (!startDate) return false;
                    
                    const start = new Date(startDate);
                    if (start < dateRange.start || start > dateRange.end) {
                        return false;
                    }
                }
                
                return true;
            })
            .map(record => {
                const milestones = {};
                Object.keys(this.milestoneTypes).forEach(milestone => {
                    milestones[milestone] = record.getCellValue(milestone);
                });
                
                return {
                    version: record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED),
                    season: record.getCellValueAsString('Season (Unified)'),
                    milestones: milestones,
                    startDate: record.getCellValue('Start date'),
                    status: record.getCellValue('Status') || [],
                    classification: record.getCellValueAsString('Deploy Classification'),
                    healthScore: record.getCellValue('Release Health Score') || 0,
                    totalHotfixes: record.getCellValue('Total Hotfixes') || 0,
                    totalIntegrations: record.getCellValue('Total Integrations') || 0,
                    
                    // Calculated fields
                    milestoneAdherence: this.calculateMilestoneAdherence(milestones),
                    delayAnalysis: this.calculateDelayAnalysis(milestones),
                    criticalPath: this.identifyCriticalPath(milestones)
                };
            });
    }

    /**
     * Calculate milestone adherence for a single release
     */
    calculateMilestoneAdherence(milestones) {
        const adherence = {
            onTime: 0,
            delayed: 0,
            total: 0,
            adherenceRate: 0,
            delays: {}
        };

        let previousMilestone = null;
        Object.entries(this.milestoneTypes).forEach(([milestone, config]) => {
            const milestoneDate = milestones[milestone];
            
            if (milestoneDate) {
                adherence.total++;
                
                // Check if this milestone was delayed relative to dependencies
                if (previousMilestone && milestones[previousMilestone]) {
                    const expectedGap = config.typical_duration_days;
                    const actualGap = this.calculateDaysBetween(milestones[previousMilestone], milestoneDate);
                    const delay = actualGap - expectedGap;
                    
                    if (delay <= 0) {
                        adherence.onTime++;
                    } else {
                        adherence.delayed++;
                        adherence.delays[milestone] = {
                            delayDays: delay,
                            category: this.categorizeDelay(delay),
                            impact: this.calculateDelayImpact(delay, config.weight)
                        };
                    }
                } else if (!previousMilestone) {
                    // First milestone - assume on time if it exists
                    adherence.onTime++;
                }
            }
            
            if (milestoneDate) {
                previousMilestone = milestone;
            }
        });

        adherence.adherenceRate = adherence.total > 0 ? 
            Math.round((adherence.onTime / adherence.total) * 100) : 0;

        return adherence;
    }

    /**
     * Analyze overall milestone adherence across all releases
     */
    analyzeMilestoneAdherence(milestoneData) {
        const analysis = {
            overall: {
                totalReleases: milestoneData.length,
                onTimeReleases: 0,
                delayedReleases: 0,
                adherenceRate: 0,
                averageDelay: 0
            },
            byMilestone: {},
            bySeason: {},
            delayDistribution: this.initializeDelayDistribution()
        };

        // Analyze overall adherence
        let totalDelayDays = 0;
        milestoneData.forEach(release => {
            if (release.milestoneAdherence.adherenceRate >= this.adherenceThresholds.good) {
                analysis.overall.onTimeReleases++;
            } else {
                analysis.overall.delayedReleases++;
            }
            
            // Calculate average delay
            const releaseDelayDays = Object.values(release.milestoneAdherence.delays)
                .reduce((sum, delay) => sum + delay.delayDays, 0);
            totalDelayDays += releaseDelayDays;
        });

        analysis.overall.adherenceRate = milestoneData.length > 0 ?
            Math.round((analysis.overall.onTimeReleases / milestoneData.length) * 100) : 0;
        
        analysis.overall.averageDelay = milestoneData.length > 0 ?
            Math.round(totalDelayDays / milestoneData.length * 10) / 10 : 0;

        // Analyze by milestone type
        Object.keys(this.milestoneTypes).forEach(milestone => {
            const milestonesWithData = milestoneData.filter(r => r.milestones[milestone]);
            const onTimeMilestones = milestoneData.filter(r => 
                r.milestones[milestone] && !r.milestoneAdherence.delays[milestone]
            );
            
            analysis.byMilestone[milestone] = {
                total: milestonesWithData.length,
                onTime: onTimeMilestones.length,
                delayed: milestonesWithData.length - onTimeMilestones.length,
                adherenceRate: milestonesWithData.length > 0 ?
                    Math.round((onTimeMilestones.length / milestonesWithData.length) * 100) : 0,
                averageDelay: this.calculateAverageDelayForMilestone(milestoneData, milestone)
            };
        });

        // Analyze by season
        const seasonGroups = this.groupBy(milestoneData, 'season');
        Object.entries(seasonGroups).forEach(([season, releases]) => {
            if (season && season !== 'undefined') {
                const seasonOnTime = releases.filter(r => 
                    r.milestoneAdherence.adherenceRate >= this.adherenceThresholds.good
                ).length;
                
                analysis.bySeason[season] = {
                    total: releases.length,
                    onTime: seasonOnTime,
                    adherenceRate: Math.round((seasonOnTime / releases.length) * 100),
                    averageHealthScore: releases.reduce((sum, r) => sum + r.healthScore, 0) / releases.length
                };
            }
        });

        return analysis;
    }

    /**
     * Analyze delay patterns to identify systemic issues
     */
    analyzeDelayPatterns(milestoneData) {
        const patterns = {
            chronic: [],        // Releases with multiple major delays
            critical: [],       // Releases with critical delays (>21 days)
            systemic: [],       // Milestone types with consistent delays
            seasonal: {},       // Patterns by season
            cascading: []       // Delays that cascade to later milestones
        };

        milestoneData.forEach(release => {
            const delays = release.milestoneAdherence.delays;
            const delayCount = Object.keys(delays).length;
            const maxDelay = Math.max(...Object.values(delays).map(d => d.delayDays), 0);
            
            // Identify chronic delay patterns
            if (delayCount >= 3) {
                patterns.chronic.push({
                    version: release.version,
                    delayCount: delayCount,
                    totalDelayDays: Object.values(delays).reduce((sum, d) => sum + d.delayDays, 0),
                    adherenceRate: release.milestoneAdherence.adherenceRate
                });
            }
            
            // Identify critical delays
            if (maxDelay >= this.delayCategories.critical.days) {
                patterns.critical.push({
                    version: release.version,
                    maxDelay: maxDelay,
                    delayedMilestones: Object.keys(delays),
                    impact: 'critical'
                });
            }
            
            // Analyze cascading delays
            const cascadingDelays = this.identifyCascadingDelays(delays);
            if (cascadingDelays.length > 0) {
                patterns.cascading.push({
                    version: release.version,
                    cascade: cascadingDelays
                });
            }
        });

        // Identify systemic milestone issues
        Object.keys(this.milestoneTypes).forEach(milestone => {
            const milestoneDelays = milestoneData
                .filter(r => r.milestoneAdherence.delays[milestone])
                .map(r => r.milestoneAdherence.delays[milestone]);
            
            if (milestoneDelays.length >= milestoneData.length * 0.4) { // 40% or more delayed
                patterns.systemic.push({
                    milestone: milestone,
                    delayFrequency: Math.round((milestoneDelays.length / milestoneData.length) * 100),
                    averageDelay: milestoneDelays.reduce((sum, d) => sum + d.delayDays, 0) / milestoneDelays.length,
                    impact: this.milestoneTypes[milestone].criticality
                });
            }
        });

        return patterns;
    }

    /**
     * Analyze team adherence patterns (using integration requestors and other team indicators)
     */
    async analyzeTeamAdherence(milestoneData) {
        // Get integration data to identify team patterns
        const integrationsTable = base.getTable('Integrations');
        const integrationsQuery = await integrationsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                FIELDS.INTEGRATION_REQUESTOR,
                FIELDS.INTEGRATION_AREA,
                FIELDS.INTEGRATION_CREATED_FIELD
            ]
        });

        const integrationsByVersion = this.groupBy(integrationsQuery.records, 
            record => record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED)
        );

        const teamAdherence = {};
        
        milestoneData.forEach(release => {
            const versionIntegrations = integrationsByVersion[release.version] || [];
            const teams = [...new Set(versionIntegrations
                .map(i => i.getCellValueAsString(FIELDS.INTEGRATION_REQUESTOR))
                .filter(requestor => requestor && requestor.includes('@'))
            )];
            
            teams.forEach(team => {
                if (!teamAdherence[team]) {
                    teamAdherence[team] = {
                        releases: [],
                        totalReleases: 0,
                        onTimeReleases: 0,
                        delayedReleases: 0,
                        averageAdherence: 0,
                        totalIntegrations: 0
                    };
                }
                
                teamAdherence[team].releases.push({
                    version: release.version,
                    adherenceRate: release.milestoneAdherence.adherenceRate,
                    healthScore: release.healthScore
                });
                
                teamAdherence[team].totalReleases++;
                teamAdherence[team].totalIntegrations += versionIntegrations
                    .filter(i => i.getCellValueAsString(FIELDS.INTEGRATION_REQUESTOR) === team)
                    .length;
                
                if (release.milestoneAdherence.adherenceRate >= this.adherenceThresholds.good) {
                    teamAdherence[team].onTimeReleases++;
                } else {
                    teamAdherence[team].delayedReleases++;
                }
            });
        });

        // Calculate team metrics
        Object.keys(teamAdherence).forEach(team => {
            const data = teamAdherence[team];
            data.averageAdherence = data.totalReleases > 0 ?
                Math.round((data.onTimeReleases / data.totalReleases) * 100) : 0;
        });

        // Identify teams at risk
        const teamsAtRisk = Object.entries(teamAdherence)
            .filter(([team, data]) => data.averageAdherence < this.adherenceThresholds.fair && data.totalReleases >= 3)
            .map(([team, data]) => ({
                team: team,
                adherenceRate: data.averageAdherence,
                totalReleases: data.totalReleases,
                riskLevel: this.calculateTeamRiskLevel(data.averageAdherence)
            }))
            .sort((a, b) => a.adherenceRate - b.adherenceRate);

        // Top performing teams
        const topPerformers = Object.entries(teamAdherence)
            .filter(([team, data]) => data.totalReleases >= 3)
            .sort((a, b) => b[1].averageAdherence - a[1].averageAdherence)
            .slice(0, 5)
            .map(([team, data]) => ({
                team: team,
                adherenceRate: data.averageAdherence,
                totalReleases: data.totalReleases
            }));

        return {
            teamMetrics: teamAdherence,
            teamsAtRisk: teamsAtRisk,
            topPerformers: topPerformers,
            summary: {
                totalTeams: Object.keys(teamAdherence).length,
                atRiskTeams: teamsAtRisk.length,
                averageTeamAdherence: Object.values(teamAdherence)
                    .reduce((sum, team) => sum + team.averageAdherence, 0) / Object.keys(teamAdherence).length
            }
        };
    }

    /**
     * Generate predictive insights for upcoming milestones
     */
    async generatePredictiveInsights(milestoneData) {
        const currentDate = new Date();
        const upcomingMilestones = [];
        
        milestoneData.forEach(release => {
            Object.entries(release.milestones).forEach(([milestone, date]) => {
                if (date) {
                    const milestoneDate = new Date(date);
                    const daysUntil = Math.ceil((milestoneDate - currentDate) / (1000 * 60 * 60 * 24));
                    
                    if (daysUntil > 0 && daysUntil <= 90) { // Next 90 days
                        upcomingMilestones.push({
                            version: release.version,
                            milestone: milestone,
                            date: date,
                            daysUntil: daysUntil,
                            riskScore: this.calculateMilestoneRiskScore(release, milestone),
                            historicalAdherence: release.milestoneAdherence.adherenceRate
                        });
                    }
                }
            });
        });

        // Sort by risk score and proximity
        upcomingMilestones.sort((a, b) => (b.riskScore * (90 - b.daysUntil)) - (a.riskScore * (90 - a.daysUntil)));

        return {
            upcomingMilestones: upcomingMilestones.slice(0, 10), // Top 10 at-risk milestones
            predictions: {
                likelyDelays: upcomingMilestones.filter(m => m.riskScore > 70).length,
                criticalRisk: upcomingMilestones.filter(m => m.riskScore > 85 && m.daysUntil <= 14).length
            }
        };
    }

    /**
     * Generate markdown report
     */
    generateAdherenceMarkdown(reportData) {
        const { adherence, delays, teams, predictions } = reportData;
        
        const adherenceEmoji = {
            excellent: '🟢',
            good: '🟡',
            fair: '🟠',
            poor: '🔴'
        };
        
        const getAdherenceEmoji = (rate) => {
            if (rate >= this.adherenceThresholds.excellent) return adherenceEmoji.excellent;
            if (rate >= this.adherenceThresholds.good) return adherenceEmoji.good;
            if (rate >= this.adherenceThresholds.fair) return adherenceEmoji.fair;
            return adherenceEmoji.poor;
        };

        return `# 📅 Milestone Adherence Analysis Report

## 🎯 Executive Summary

**Overall Adherence Rate**: ${adherence.overall.adherenceRate}% ${getAdherenceEmoji(adherence.overall.adherenceRate)}
**Releases On Time**: ${adherence.overall.onTimeReleases}/${adherence.overall.totalReleases}
**Average Delay**: ${adherence.overall.averageDelay} days
**Teams at Risk**: ${teams?.teamsAtRisk.length || 0} teams with poor adherence

---

## 📊 Milestone Performance Analysis

### Overall Adherence by Milestone Type
| Milestone | Total | On Time | Delayed | Adherence Rate | Avg Delay |
|-----------|-------|---------|---------|----------------|-----------|
${Object.entries(adherence.byMilestone).map(([milestone, data]) => 
    `| ${milestone} | ${data.total} | ${data.onTime} | ${data.delayed} | ${data.adherenceRate}% ${getAdherenceEmoji(data.adherenceRate)} | ${data.averageDelay} days |`
).join('\n')}

### Season Performance Comparison
| Season | Releases | On Time Rate | Avg Health Score |
|--------|----------|--------------|------------------|
${Object.entries(adherence.bySeason).map(([season, data]) => 
    `| ${season} | ${data.total} | ${data.adherenceRate}% ${getAdherenceEmoji(data.adherenceRate)} | ${Math.round(data.averageHealthScore)}/100 |`
).join('\n')}

---

## 🚨 Delay Pattern Analysis

### Critical Issues Identified
- **Chronic Delays**: ${delays.chronic.length} releases with multiple major delays
- **Critical Delays**: ${delays.critical.length} releases with >21 day delays
- **Systemic Issues**: ${delays.systemic.length} milestone types consistently delayed
- **Cascading Delays**: ${delays.cascading.length} releases with cascading delay effects

${delays.chronic.length > 0 ? `
### Chronically Delayed Releases
${delays.chronic.map(delay => 
    `- **${delay.version}**: ${delay.delayCount} delayed milestones, ${delay.totalDelayDays} total delay days (${delay.adherenceRate}% adherence)`
).join('\n')}
` : '### ✅ No Chronically Delayed Releases'}

${delays.systemic.length > 0 ? `
### Systemic Milestone Issues
${delays.systemic.map(issue => 
    `- **${issue.milestone}**: ${issue.delayFrequency}% delay rate, ${Math.round(issue.averageDelay)} days average delay (${issue.impact} impact)`
).join('\n')}
` : '### ✅ No Systemic Milestone Issues'}

---

## 👥 Team Adherence Analysis

${teams ? `
### Teams at Risk (Poor Adherence <60%)
${teams.teamsAtRisk.length > 0 ? 
    teams.teamsAtRisk.map(team => 
        `- **${team.team}**: ${team.adherenceRate}% adherence across ${team.totalReleases} releases (${team.riskLevel} risk)`
    ).join('\n')
    : '✅ No teams identified as high risk'
}

### Top Performing Teams
${teams.topPerformers.map((team, index) => 
    `${index + 1}. **${team.team}**: ${team.adherenceRate}% adherence (${team.totalReleases} releases)`
).join('\n')}

### Team Performance Distribution
- **Teams >75% adherence**: ${Object.values(teams.teamMetrics).filter(t => t.averageAdherence >= 75).length}
- **Teams 60-75% adherence**: ${Object.values(teams.teamMetrics).filter(t => t.averageAdherence >= 60 && t.averageAdherence < 75).length}
- **Teams <60% adherence**: ${Object.values(teams.teamMetrics).filter(t => t.averageAdherence < 60).length}
` : 'Team analysis not included in this report.'}

---

## 🔮 Predictive Analysis

${predictions ? `
### Upcoming High-Risk Milestones (Next 90 Days)
${predictions.upcomingMilestones.slice(0, 5).map(milestone => 
    `- **${milestone.version} - ${milestone.milestone}**: ${milestone.daysUntil} days away, ${milestone.riskScore}% risk score`
).join('\n')}

### Risk Predictions
- **Likely Delays**: ${predictions.predictions.likelyDelays} milestones at high risk
- **Critical Risk**: ${predictions.predictions.criticalRisk} milestones in critical danger zone
- **Immediate Attention Needed**: ${predictions.upcomingMilestones.filter(m => m.riskScore > 85 && m.daysUntil <= 7).length} milestones
` : 'Predictive analysis not included in this report.'}

---

## 💡 Key Insights

${reportData.insights.map(insight => 
    `### ${insight.type === 'positive' ? '🟢' : insight.type === 'warning' ? '🟡' : '🔴'} ${insight.category}\n` +
    `${insight.message}\n` +
    `*Evidence: ${insight.evidence}*`
).join('\n\n')}

---

## 🎯 Recommendations

${reportData.recommendations.map((rec, index) => 
    `### ${index + 1}. ${rec.category} (${rec.priority.toUpperCase()} Priority)\n` +
    `**Recommendation**: ${rec.recommendation}\n` +
    `**Expected Impact**: ${rec.expectedImpact}\n` +
    `**Implementation**: ${rec.implementation}\n`
).join('\n')}

---

## 📈 Adherence Trend Visualization

### Milestone Delay Distribution
\`\`\`
HL Date      [████████████████████] ${adherence.byMilestone['HL Date']?.adherenceRate || 0}% on-time
PD Date      [████████████████████] ${adherence.byMilestone['PD Date']?.adherenceRate || 0}% on-time
Cert Sub     [████████████████████] ${adherence.byMilestone['Cert Sub Date']?.adherenceRate || 0}% on-time
Live Date    [████████████████████] ${adherence.byMilestone['Live Date']?.adherenceRate || 0}% on-time
\`\`\`

### Delay Impact Analysis
- **Minor Delays** (1-3 days): ${this.countDelaysByCategory(reportData.data, 'minor')} occurrences
- **Moderate Delays** (4-7 days): ${this.countDelaysByCategory(reportData.data, 'moderate')} occurrences  
- **Major Delays** (8-14 days): ${this.countDelaysByCategory(reportData.data, 'major')} occurrences
- **Critical Delays** (15+ days): ${this.countDelaysByCategory(reportData.data, 'critical')} occurrences

---

*Milestone Adherence Analysis completed on ${new Date().toLocaleString()}*
*Analysis covers ${reportData.data.length} releases${reportData.versionFilter ? ` for version ${reportData.versionFilter}` : ' across all versions'}*
*Focus: Identifying and addressing systematic milestone adherence issues*`;
    }

    // Helper methods
    calculateDaysBetween(date1, date2) {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
    }

    categorizeDelay(delayDays) {
        if (delayDays <= this.delayCategories.minor.days) return 'minor';
        if (delayDays <= this.delayCategories.moderate.days) return 'moderate';
        if (delayDays <= this.delayCategories.major.days) return 'major';
        return 'critical';
    }

    calculateDelayImpact(delayDays, weight) {
        return Math.round(delayDays * weight * 10) / 10;
    }

    calculateDelayAnalysis(milestones) {
        // Placeholder for detailed delay analysis
        return {
            totalDelays: 0,
            averageDelay: 0,
            criticalPath: []
        };
    }

    identifyCriticalPath(milestones) {
        // Identify the critical path through milestones
        return Object.keys(this.milestoneTypes).filter(m => milestones[m]);
    }

    initializeDelayDistribution() {
        return {
            minor: 0,
            moderate: 0,
            major: 0,
            critical: 0
        };
    }

    calculateAverageDelayForMilestone(milestoneData, milestone) {
        const delays = milestoneData
            .filter(r => r.milestoneAdherence.delays[milestone])
            .map(r => r.milestoneAdherence.delays[milestone].delayDays);
        
        return delays.length > 0 ? 
            Math.round(delays.reduce((sum, d) => sum + d, 0) / delays.length * 10) / 10 : 0;
    }

    identifyCascadingDelays(delays) {
        // Logic to identify when one delay causes subsequent delays
        const milestoneOrder = Object.keys(this.milestoneTypes);
        const cascades = [];
        
        for (let i = 0; i < milestoneOrder.length - 1; i++) {
            const current = milestoneOrder[i];
            const next = milestoneOrder[i + 1];
            
            if (delays[current] && delays[next]) {
                cascades.push({ from: current, to: next, impact: delays[next].delayDays });
            }
        }
        
        return cascades;
    }

    calculateTeamRiskLevel(adherenceRate) {
        if (adherenceRate < 40) return 'critical';
        if (adherenceRate < 60) return 'high';
        if (adherenceRate < 75) return 'moderate';
        return 'low';
    }

    calculateMilestoneRiskScore(release, milestone) {
        // Calculate risk based on historical adherence, complexity, and other factors
        let risk = 50; // Base risk
        
        // Factor in historical adherence
        risk += (100 - release.milestoneAdherence.adherenceRate) * 0.3;
        
        // Factor in complexity indicators
        if (release.totalHotfixes > 10) risk += 15;
        if (release.totalIntegrations > 50) risk += 10;
        if (release.healthScore < 70) risk += 20;
        
        return Math.min(Math.round(risk), 100);
    }

    countDelaysByCategory(milestoneData, category) {
        return milestoneData.reduce((count, release) => {
            return count + Object.values(release.milestoneAdherence.delays)
                .filter(delay => delay.category === category).length;
        }, 0);
    }

    groupBy(array, key) {
        if (typeof key === 'function') {
            return array.reduce((groups, item) => {
                const group = key(item);
                groups[group] = groups[group] || [];
                groups[group].push(item);
                return groups;
            }, {});
        }
        
        return array.reduce((groups, item) => {
            const group = item[key] || 'Unknown';
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    }

    generateAdherenceInsights(adherenceAnalysis, delayPatterns) {
        const insights = [];
        
        // Overall adherence insight
        if (adherenceAnalysis.overall.adherenceRate < this.adherenceThresholds.fair) {
            insights.push({
                type: 'warning',
                category: 'Overall Adherence',
                message: `Poor overall milestone adherence at ${adherenceAnalysis.overall.adherenceRate}%`,
                evidence: `${adherenceAnalysis.overall.delayedReleases} of ${adherenceAnalysis.overall.totalReleases} releases delayed`
            });
        }
        
        // Systemic issues insight
        if (delayPatterns.systemic.length > 0) {
            insights.push({
                type: 'critical',
                category: 'Systemic Issues',
                message: `${delayPatterns.systemic.length} milestone types showing systemic delays`,
                evidence: delayPatterns.systemic.map(s => s.milestone).join(', ')
            });
        }
        
        return insights;
    }

    generateAdherenceRecommendations(adherenceAnalysis, teamAnalysis, rootCauseAnalysis) {
        const recommendations = [];
        
        // Low adherence recommendations
        if (adherenceAnalysis.overall.adherenceRate < this.adherenceThresholds.fair) {
            recommendations.push({
                priority: 'high',
                category: 'Process Improvement',
                recommendation: 'Implement milestone tracking and early warning system',
                expectedImpact: `Improve adherence from ${adherenceAnalysis.overall.adherenceRate}% to 75%+`,
                implementation: 'Add milestone checkpoints with automated alerts for at-risk deadlines'
            });
        }
        
        // Team-specific recommendations
        if (teamAnalysis && teamAnalysis.teamsAtRisk.length > 0) {
            recommendations.push({
                priority: 'high',
                category: 'Team Support',
                recommendation: `Provide targeted support to ${teamAnalysis.teamsAtRisk.length} underperforming teams`,
                expectedImpact: 'Reduce team-specific delays by 40-50%',
                implementation: 'Dedicated project management support and capacity planning'
            });
        }
        
        return recommendations;
    }

    // Placeholder methods for additional analysis
    analyzeSystemicPatterns(milestoneData, adherenceAnalysis) { return null; }
    analyzeRootCauses(milestoneData, delayPatterns) { return null; }
}

module.exports = MilestoneAdherenceReportGenerator;

// Usage example
if (require.main === module) {
    const generator = new MilestoneAdherenceReportGenerator();
    
    // Generate milestone adherence analysis
    generator.generateMilestoneAdherenceReport({
        includeTeamAnalysis: true,
        includePatternAnalysis: true,
        includePredictiveAnalysis: true,
        analyzeRootCauses: true
    })
    .then(result => {
        if (result.success) {
            console.log(`Overall Adherence: ${result.overallAdherence}% (${result.teamsAtRisk} teams at risk)`);
            console.log(`Critical Delays: ${result.criticalDelays}`);
            console.log(result.markdown);
        } else {
            console.error('Milestone adherence analysis failed:', result.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}