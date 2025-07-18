//======================================================================================================================
// Work Volume Report Script
// Purpose: Analyzes work intensity by combining deploys, RQA whitegloves, commit data, and open issues
// Addresses: Teams consistently missing milestones due to work overload
//======================================================================================================================

const { FIELDS, CONFIG } = require('./current/versionreport.js');

/**
 * Work Volume Report Generator
 * Combines multiple data sources to calculate work intensity and identify teams at risk of missing milestones
 */
class WorkVolumeReportGenerator {
    constructor() {
        this.volumeWeights = {
            deploys: 0.25,      // Weight for deploy volume
            commits: 0.30,      // Weight for commit volume
            rqaWhitegloves: 0.20,  // Weight for RQA whiteglove volume
            openIssues: 0.15,   // Weight for open issues
            integrations: 0.10  // Weight for integration volume
        };
        
        this.intensityThresholds = {
            low: 25,       // 0-25: Low intensity
            moderate: 50,  // 26-50: Moderate intensity
            high: 75,      // 51-75: High intensity
            extreme: 100   // 76-100: Extreme intensity
        };
        
        this.riskFactors = {
            deployFrequency: { weight: 0.20, thresholds: { high: 15, moderate: 10, low: 5 } },
            commitVolume: { weight: 0.25, thresholds: { high: 1000, moderate: 500, low: 200 } },
            issueBacklog: { weight: 0.20, thresholds: { high: 100, moderate: 50, low: 20 } },
            rqaLoad: { weight: 0.15, thresholds: { high: 20, moderate: 10, low: 5 } },
            integrationLoad: { weight: 0.20, thresholds: { high: 50, moderate: 25, low: 10 } }
        };
    }

    /**
     * Generate comprehensive work volume analysis
     */
    async generateWorkVolumeReport(options = {}) {
        try {
            console.log('Generating Work Volume Report...');
            
            const {
                versionFilter = null,
                dateRange = null,
                includeTeamBreakdown = true,
                includeComponentAnalysis = true,
                includeTrendAnalysis = true,
                includeRiskAssessment = true
            } = options;

            // Collect work volume data from all sources
            const workData = await this.collectWorkVolumeData(versionFilter, dateRange);
            
            // Calculate volume metrics
            const volumeMetrics = this.calculateVolumeMetrics(workData);
            
            // Analyze work intensity
            const intensityAnalysis = this.analyzeWorkIntensity(volumeMetrics);
            
            // Team breakdown if requested
            const teamBreakdown = includeTeamBreakdown ? 
                await this.analyzeTeamWorkload(workData) : null;
            
            // Component analysis if requested
            const componentAnalysis = includeComponentAnalysis ?
                this.analyzeComponentWorkload(workData) : null;
            
            // Risk assessment for milestone adherence
            const riskAssessment = includeRiskAssessment ?
                this.assessMilestoneRisk(volumeMetrics, teamBreakdown) : null;
            
            // Trend analysis if requested
            const trendAnalysis = includeTrendAnalysis ?
                await this.analyzeTrends(workData) : null;
            
            // Generate insights and recommendations
            const insights = this.generateVolumeInsights(intensityAnalysis, riskAssessment);
            const recommendations = this.generateVolumeRecommendations(intensityAnalysis, riskAssessment);
            
            // Generate report
            const report = this.generateVolumeMarkdown({
                versionFilter,
                dateRange,
                data: workData,
                metrics: volumeMetrics,
                intensity: intensityAnalysis,
                teams: teamBreakdown,
                components: componentAnalysis,
                risk: riskAssessment,
                trends: trendAnalysis,
                insights: insights,
                recommendations: recommendations
            });
            
            return {
                success: true,
                version: versionFilter,
                workIntensity: intensityAnalysis.overall.intensity,
                riskLevel: riskAssessment?.overall.riskLevel || 'Unknown',
                teamsAtRisk: riskAssessment?.teamsAtRisk.length || 0,
                data: workData,
                analysis: {
                    metrics: volumeMetrics,
                    intensity: intensityAnalysis,
                    risk: riskAssessment
                },
                insights: insights,
                recommendations: recommendations,
                markdown: report,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error generating Work Volume Report:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Collect work volume data from all relevant tables
     */
    async collectWorkVolumeData(versionFilter, dateRange) {
        const data = {
            builds: await this.getBuildData(versionFilter, dateRange),
            deploys: await this.getDeployData(versionFilter, dateRange),
            commits: await this.getCommitData(versionFilter, dateRange),
            rqaWhitegloves: await this.getRQAData(versionFilter, dateRange),
            openIssues: await this.getOpenIssuesData(versionFilter, dateRange),
            integrations: await this.getIntegrationData(versionFilter, dateRange),
            hotfixes: await this.getHotfixData(versionFilter, dateRange)
        };
        
        return data;
    }

    /**
     * Get build data with deploy counts
     */
    async getBuildData(versionFilter, dateRange) {
        const buildsTable = base.getTable('Builds');
        const query = await buildsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                'Total Deploys',
                'Total Hotfixes',
                'Total Integrations',
                'Live Date',
                'Start date',
                FIELDS.COMMITS_PRE_HL,
                FIELDS.COMMITS_HL_TO_PD,
                FIELDS.COMMITS_PD_TO_CERT,
                FIELDS.COMMITS_CERT_TO_LIVE,
                FIELDS.COMMITS_LIVE_PLUS,
                'Release Health Score'
            ]
        });

        return query.records
            .filter(record => {
                if (versionFilter) {
                    const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                    if (version !== versionFilter) return false;
                }
                return true;
            })
            .map(record => ({
                version: record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED),
                totalDeploys: record.getCellValue('Total Deploys') || 0,
                totalHotfixes: record.getCellValue('Total Hotfixes') || 0,
                totalIntegrations: record.getCellValue('Total Integrations') || 0,
                liveDate: record.getCellValue('Live Date'),
                startDate: record.getCellValue('Start date'),
                commits: {
                    preHL: record.getCellValue(FIELDS.COMMITS_PRE_HL) || 0,
                    hlToPD: record.getCellValue(FIELDS.COMMITS_HL_TO_PD) || 0,
                    pdToCert: record.getCellValue(FIELDS.COMMITS_PD_TO_CERT) || 0,
                    certToLive: record.getCellValue(FIELDS.COMMITS_CERT_TO_LIVE) || 0,
                    livePlus: record.getCellValue(FIELDS.COMMITS_LIVE_PLUS) || 0
                },
                healthScore: record.getCellValue('Release Health Score') || 0
            }));
    }

    /**
     * Get RQA whiteglove data
     */
    async getRQAData(versionFilter, dateRange) {
        const rqaTable = base.getTable('RQA');
        const query = await rqaTable.selectRecordsAsync({
            fields: [
                FIELDS.RQA_FIX_VERSION,
                FIELDS.RQA_LABELS,
                FIELDS.RQA_ASSIGNEE,
                FIELDS.RQA_COMPONENTS,
                FIELDS.RQA_CREATED_FIELD,
                'Status'
            ]
        });

        return query.records
            .filter(record => {
                const fixVersions = record.getCellValue(FIELDS.RQA_FIX_VERSION) || [];
                const labels = record.getCellValue(FIELDS.RQA_LABELS) || [];
                
                // Check if this is a whiteglove RQA
                const isWhiteglove = labels.includes('RQA-WG');
                if (!isWhiteglove) return false;
                
                if (versionFilter) {
                    return fixVersions.includes(versionFilter);
                }
                return true;
            })
            .map(record => ({
                fixVersions: record.getCellValue(FIELDS.RQA_FIX_VERSION) || [],
                assignee: record.getCellValueAsString(FIELDS.RQA_ASSIGNEE),
                components: record.getCellValue(FIELDS.RQA_COMPONENTS) || [],
                created: record.getCellValue(FIELDS.RQA_CREATED_FIELD),
                status: record.getCellValueAsString('Status')
            }));
    }

    /**
     * Get open issues data
     */
    async getOpenIssuesData(versionFilter, dateRange) {
        const openIssuesTable = base.getTable('Open Issues');
        const query = await openIssuesTable.selectRecordsAsync();

        return query.records
            .filter(record => {
                if (versionFilter) {
                    const deploy = record.getCellValueAsString('Deploy');
                    return deploy === versionFilter;
                }
                return true;
            })
            .map(record => ({
                deploy: record.getCellValueAsString('Deploy'),
                plannedWork: record.getCellValue('Planned Work') || 0,
                completedWork: record.getCellValue('Completed Work') || 0,
                openBeyondHL: record.getCellValue('Open Beyond Hard Lock') || 0,
                openBeyondPD: record.getCellValue('Open Beyond Pencils Down') || 0
            }));
    }

    /**
     * Get integration data
     */
    async getIntegrationData(versionFilter, dateRange) {
        const integrationsTable = base.getTable('Integrations');
        const query = await integrationsTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                FIELDS.INTEGRATION_AREA,
                FIELDS.INTEGRATION_REQUESTOR,
                FIELDS.INTEGRATION_CREATED_FIELD,
                'Status'
            ]
        });

        return query.records
            .filter(record => {
                if (versionFilter) {
                    const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                    return version === versionFilter;
                }
                return true;
            })
            .map(record => ({
                version: record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED),
                area: record.getCellValue(FIELDS.INTEGRATION_AREA) || [],
                requestor: record.getCellValueAsString(FIELDS.INTEGRATION_REQUESTOR),
                created: record.getCellValue(FIELDS.INTEGRATION_CREATED_FIELD),
                status: record.getCellValueAsString('Status')
            }));
    }

    /**
     * Get hotfix data
     */
    async getHotfixData(versionFilter, dateRange) {
        const hotfixesTable = base.getTable('Hotfixes');
        const query = await hotfixesTable.selectRecordsAsync({
            fields: [
                FIELDS.BUILD_VERSION_UNIFIED,
                'Component/s',
                'Reporter',
                FIELDS.URGENCY_CUSTOM_FIELD,
                FIELDS.HOTFIX_CREATED_FIELD,
                'Status'
            ]
        });

        return query.records
            .filter(record => {
                if (versionFilter) {
                    const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                    return version === versionFilter;
                }
                return true;
            })
            .map(record => ({
                version: record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED),
                components: record.getCellValue('Component/s') || [],
                reporter: record.getCellValueAsString('Reporter'),
                urgency: record.getCellValueAsString(FIELDS.URGENCY_CUSTOM_FIELD),
                created: record.getCellValue(FIELDS.HOTFIX_CREATED_FIELD),
                status: record.getCellValueAsString('Status')
            }));
    }

    /**
     * Calculate volume metrics from all data sources
     */
    calculateVolumeMetrics(workData) {
        const metrics = {
            deploys: {
                total: workData.builds.reduce((sum, build) => sum + build.totalDeploys, 0),
                average: 0,
                peak: 0
            },
            commits: {
                total: this.calculateTotalCommits(workData.builds),
                byPhase: this.calculateCommitsByPhase(workData.builds),
                average: 0
            },
            rqaWhitegloves: {
                total: workData.rqaWhitegloves.length,
                byAssignee: this.groupBy(workData.rqaWhitegloves, 'assignee'),
                byComponent: this.groupByArray(workData.rqaWhitegloves, 'components')
            },
            openIssues: {
                total: workData.openIssues.reduce((sum, issue) => sum + issue.plannedWork, 0),
                completed: workData.openIssues.reduce((sum, issue) => sum + issue.completedWork, 0),
                openBeyondHL: workData.openIssues.reduce((sum, issue) => sum + issue.openBeyondHL, 0),
                openBeyondPD: workData.openIssues.reduce((sum, issue) => sum + issue.openBeyondPD, 0)
            },
            integrations: {
                total: workData.integrations.length,
                byArea: this.groupByArray(workData.integrations, 'area'),
                byRequestor: this.groupBy(workData.integrations, 'requestor')
            },
            hotfixes: {
                total: workData.hotfixes.length,
                byUrgency: this.groupBy(workData.hotfixes, 'urgency'),
                byComponent: this.groupByArray(workData.hotfixes, 'components')
            }
        };

        // Calculate averages and peaks
        if (workData.builds.length > 0) {
            metrics.deploys.average = Math.round(metrics.deploys.total / workData.builds.length);
            metrics.deploys.peak = Math.max(...workData.builds.map(b => b.totalDeploys));
            
            metrics.commits.average = Math.round(metrics.commits.total / workData.builds.length);
        }

        return metrics;
    }

    /**
     * Analyze work intensity levels
     */
    analyzeWorkIntensity(volumeMetrics) {
        // Calculate weighted intensity score
        const scores = {
            deploys: this.normalizeScore(volumeMetrics.deploys.total, 50) * this.volumeWeights.deploys,
            commits: this.normalizeScore(volumeMetrics.commits.total, 2000) * this.volumeWeights.commits,
            rqaWhitegloves: this.normalizeScore(volumeMetrics.rqaWhitegloves.total, 30) * this.volumeWeights.rqaWhitegloves,
            openIssues: this.normalizeScore(volumeMetrics.openIssues.total, 200) * this.volumeWeights.openIssues,
            integrations: this.normalizeScore(volumeMetrics.integrations.total, 100) * this.volumeWeights.integrations
        };

        const overallIntensity = Math.round(Object.values(scores).reduce((sum, score) => sum + score, 0));
        
        return {
            overall: {
                intensity: Math.min(overallIntensity, 100),
                level: this.getIntensityLevel(overallIntensity),
                rating: this.getIntensityRating(overallIntensity)
            },
            breakdown: scores,
            thresholds: this.intensityThresholds,
            recommendations: this.getIntensityRecommendations(overallIntensity)
        };
    }

    /**
     * Analyze team workload distribution
     */
    async analyzeTeamWorkload(workData) {
        const teams = {};
        
        // Aggregate workload by team/requestor
        workData.integrations.forEach(integration => {
            if (integration.requestor && integration.requestor.includes('@')) {
                const team = integration.requestor;
                if (!teams[team]) {
                    teams[team] = {
                        integrations: 0,
                        rqaAssignments: 0,
                        hotfixReports: 0,
                        workload: 0
                    };
                }
                teams[team].integrations++;
            }
        });

        workData.rqaWhitegloves.forEach(rqa => {
            if (rqa.assignee) {
                const team = rqa.assignee;
                if (!teams[team]) {
                    teams[team] = {
                        integrations: 0,
                        rqaAssignments: 0,
                        hotfixReports: 0,
                        workload: 0
                    };
                }
                teams[team].rqaAssignments++;
            }
        });

        workData.hotfixes.forEach(hotfix => {
            if (hotfix.reporter) {
                const team = hotfix.reporter;
                if (!teams[team]) {
                    teams[team] = {
                        integrations: 0,
                        rqaAssignments: 0,
                        hotfixReports: 0,
                        workload: 0
                    };
                }
                teams[team].hotfixReports++;
            }
        });

        // Calculate workload scores
        Object.keys(teams).forEach(team => {
            const data = teams[team];
            data.workload = (data.integrations * 3) + (data.rqaAssignments * 2) + (data.hotfixReports * 1);
        });

        // Sort teams by workload
        const sortedTeams = Object.entries(teams)
            .sort((a, b) => b[1].workload - a[1].workload)
            .slice(0, 20); // Top 20 teams

        return {
            teams: teams,
            rankings: {
                highest: sortedTeams.slice(0, 5),
                lowest: sortedTeams.slice(-5).reverse()
            },
            distribution: this.calculateWorkloadDistribution(teams)
        };
    }

    /**
     * Assess milestone risk based on work volume
     */
    assessMilestoneRisk(volumeMetrics, teamBreakdown) {
        let riskScore = 0;
        const riskFactors = [];

        // Assess each risk factor
        Object.entries(this.riskFactors).forEach(([factor, config]) => {
            let value;
            switch(factor) {
                case 'deployFrequency':
                    value = volumeMetrics.deploys.total;
                    break;
                case 'commitVolume':
                    value = volumeMetrics.commits.total;
                    break;
                case 'issueBacklog':
                    value = volumeMetrics.openIssues.openBeyondPD;
                    break;
                case 'rqaLoad':
                    value = volumeMetrics.rqaWhitegloves.total;
                    break;
                case 'integrationLoad':
                    value = volumeMetrics.integrations.total;
                    break;
            }

            const risk = this.assessFactorRisk(value, config.thresholds);
            const weightedRisk = risk.score * config.weight;
            riskScore += weightedRisk;

            riskFactors.push({
                factor: factor,
                value: value,
                risk: risk,
                weight: config.weight,
                contribution: weightedRisk
            });
        });

        // Identify teams at risk
        const teamsAtRisk = teamBreakdown ? 
            teamBreakdown.rankings.highest
                .filter(([team, data]) => data.workload > 15)
                .map(([team, data]) => ({ team, workload: data.workload }))
            : [];

        return {
            overall: {
                riskScore: Math.round(riskScore * 100),
                riskLevel: this.getRiskLevel(riskScore),
                likelihood: this.getMilestoneRiskLikelihood(riskScore)
            },
            factors: riskFactors,
            teamsAtRisk: teamsAtRisk,
            mitigationStrategies: this.generateMitigationStrategies(riskScore, riskFactors)
        };
    }

    /**
     * Generate markdown report
     */
    generateVolumeMarkdown(reportData) {
        const { metrics, intensity, teams, risk } = reportData;
        
        const intensityEmoji = {
            low: '👌',
            moderate: '⚡',
            high: '🔥',
            extreme: '💥'
        };
        
        const riskEmoji = {
            low: '🟢',
            moderate: '🟡',
            high: '🟠',
            critical: '🔴'
        };

        return `# 📊 Work Volume Analysis Report

## 🎯 Executive Summary

**Work Intensity**: ${intensity.overall.intensity}/100 ${intensityEmoji[intensity.overall.level]} ${intensity.overall.level.toUpperCase()}
**Milestone Risk**: ${risk?.overall.riskLevel || 'Unknown'} ${riskEmoji[risk?.overall.riskLevel] || '❓'}
**Teams at Risk**: ${risk?.teamsAtRisk.length || 0} teams with excessive workload

---

## 📈 Volume Metrics Overview

### Deploy Activity
- **Total Deploys**: ${metrics.deploys.total}
- **Average per Version**: ${metrics.deploys.average}
- **Peak Deploy Count**: ${metrics.deploys.peak}

### Commit Volume
- **Total Commits**: ${metrics.commits.total.toLocaleString()}
- **Pre-HL**: ${metrics.commits.byPhase.preHL.toLocaleString()}
- **HL→PD**: ${metrics.commits.byPhase.hlToPD.toLocaleString()}
- **PD→Cert**: ${metrics.commits.byPhase.pdToCert.toLocaleString()}
- **Cert→Live**: ${metrics.commits.byPhase.certToLive.toLocaleString()}
- **Live+**: ${metrics.commits.byPhase.livePlus.toLocaleString()}

### RQA Whitegloves
- **Total Whitegloves**: ${metrics.rqaWhitegloves.total}
- **Top Assignees**: ${Object.entries(metrics.rqaWhitegloves.byAssignee)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([assignee, rqas]) => `${assignee} (${rqas.length})`)
    .join(', ')}

### Open Issues Status
- **Total Planned Work**: ${metrics.openIssues.total}
- **Completed Work**: ${metrics.openIssues.completed} (${metrics.openIssues.total > 0 ? Math.round((metrics.openIssues.completed / metrics.openIssues.total) * 100) : 0}%)
- **Open Beyond Hard Lock**: ${metrics.openIssues.openBeyondHL} ${metrics.openIssues.openBeyondHL > 0 ? '⚠️' : '✅'}
- **Open Beyond Pencils Down**: ${metrics.openIssues.openBeyondPD} ${metrics.openIssues.openBeyondPD > 0 ? '🚨' : '✅'}

### Integration & Hotfix Load
- **Active Integrations**: ${metrics.integrations.total}
- **Active Hotfixes**: ${metrics.hotfixes.total}
- **ASAP Hotfixes**: ${metrics.hotfixes.byUrgency['ASAP']?.length || 0} 🔴

---

## 🔥 Work Intensity Analysis

### Overall Intensity Breakdown
| Component | Score | Weight | Contribution |
|-----------|-------|--------|--------------|
| Deploys | ${Math.round(reportData.intensity.breakdown.deploys * 100)} | ${this.volumeWeights.deploys * 100}% | ${Math.round(reportData.intensity.breakdown.deploys * 100)} |
| Commits | ${Math.round(reportData.intensity.breakdown.commits * 100)} | ${this.volumeWeights.commits * 100}% | ${Math.round(reportData.intensity.breakdown.commits * 100)} |
| RQA | ${Math.round(reportData.intensity.breakdown.rqaWhitegloves * 100)} | ${this.volumeWeights.rqaWhitegloves * 100}% | ${Math.round(reportData.intensity.breakdown.rqaWhitegloves * 100)} |
| Issues | ${Math.round(reportData.intensity.breakdown.openIssues * 100)} | ${this.volumeWeights.openIssues * 100}% | ${Math.round(reportData.intensity.breakdown.openIssues * 100)} |
| Integrations | ${Math.round(reportData.intensity.breakdown.integrations * 100)} | ${this.volumeWeights.integrations * 100}% | ${Math.round(reportData.intensity.breakdown.integrations * 100)} |

**Overall Rating**: ${intensity.overall.rating}

---

## 👥 Team Workload Analysis

${teams ? `
### Highest Workload Teams
${teams.rankings.highest.map(([team, data], index) => 
    `${index + 1}. **${team}**: ${data.workload} points (${data.integrations} integrations, ${data.rqaAssignments} RQA, ${data.hotfixReports} hotfixes)`
).join('\n')}

### Workload Distribution
- **Heavy Load** (>20 points): ${Object.values(teams.teams).filter(t => t.workload > 20).length} teams
- **Moderate Load** (10-20 points): ${Object.values(teams.teams).filter(t => t.workload >= 10 && t.workload <= 20).length} teams
- **Light Load** (<10 points): ${Object.values(teams.teams).filter(t => t.workload < 10).length} teams

### Teams at Risk of Missing Milestones
${risk?.teamsAtRisk.length > 0 ? 
    risk.teamsAtRisk.map(team => 
        `- **${team.team}**: Workload ${team.workload} points - High risk of milestone delays`
    ).join('\n')
    : '✅ No teams identified as high risk'
}
` : 'Team analysis not included in this report.'}

---

## ⚠️ Milestone Risk Assessment

${risk ? `
### Risk Factor Analysis
| Factor | Value | Risk Level | Weight | Impact |
|--------|-------|------------|--------|--------|
${risk.factors.map(factor => 
    `| ${factor.factor} | ${factor.value} | ${factor.risk.level} ${riskEmoji[factor.risk.level]} | ${Math.round(factor.weight * 100)}% | ${Math.round(factor.contribution)} |`
).join('\n')}

### Overall Risk Profile
- **Risk Score**: ${risk.overall.riskScore}/100
- **Risk Level**: ${risk.overall.riskLevel.toUpperCase()} ${riskEmoji[risk.overall.riskLevel]}
- **Milestone Delay Likelihood**: ${risk.overall.likelihood}

### Mitigation Strategies
${risk.mitigationStrategies.map((strategy, index) => 
    `${index + 1}. **${strategy.category}**: ${strategy.action}\n   *Expected Impact*: ${strategy.impact}`
).join('\n\n')}
` : 'Risk assessment not included in this report.'}

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

## 📊 Work Volume Visualization

### Intensity Distribution
\`\`\`
Low     [${intensity.overall.intensity <= 25 ? '████████████████████' : '                    '}] ${intensity.overall.intensity <= 25 ? intensity.overall.intensity : 0}/25
Moderate[${intensity.overall.intensity > 25 && intensity.overall.intensity <= 50 ? '████████████████████' : '                    '}] ${intensity.overall.intensity > 25 && intensity.overall.intensity <= 50 ? intensity.overall.intensity - 25 : 0}/25
High    [${intensity.overall.intensity > 50 && intensity.overall.intensity <= 75 ? '████████████████████' : '                    '}] ${intensity.overall.intensity > 50 && intensity.overall.intensity <= 75 ? intensity.overall.intensity - 50 : 0}/25
Extreme [${intensity.overall.intensity > 75 ? '████████████████████' : '                    '}] ${intensity.overall.intensity > 75 ? intensity.overall.intensity - 75 : 0}/25
\`\`\`

### Component Breakdown (% of Total Intensity)
\`\`\`
Commits      ████████████ ${Math.round(reportData.intensity.breakdown.commits * 100)}%
Deploys      ████████ ${Math.round(reportData.intensity.breakdown.deploys * 100)}%
RQA          ██████ ${Math.round(reportData.intensity.breakdown.rqaWhitegloves * 100)}%
Issues       ████ ${Math.round(reportData.intensity.breakdown.openIssues * 100)}%
Integrations ███ ${Math.round(reportData.intensity.breakdown.integrations * 100)}%
\`\`\`

---

*Work Volume Analysis completed on ${new Date().toLocaleString()}*
*Analysis covers ${reportData.versionFilter ? `version ${reportData.versionFilter}` : 'all active versions'} work activity*
*Teams missing milestones: Focus on workload redistribution and capacity planning*`;
    }

    // Helper methods
    calculateTotalCommits(builds) {
        return builds.reduce((total, build) => {
            return total + Object.values(build.commits).reduce((sum, count) => sum + count, 0);
        }, 0);
    }

    calculateCommitsByPhase(builds) {
        const phases = { preHL: 0, hlToPD: 0, pdToCert: 0, certToLive: 0, livePlus: 0 };
        
        builds.forEach(build => {
            Object.keys(phases).forEach(phase => {
                phases[phase] += build.commits[phase] || 0;
            });
        });
        
        return phases;
    }

    normalizeScore(value, max) {
        return Math.min((value / max) * 100, 100);
    }

    getIntensityLevel(score) {
        if (score <= this.intensityThresholds.low) return 'low';
        if (score <= this.intensityThresholds.moderate) return 'moderate';
        if (score <= this.intensityThresholds.high) return 'high';
        return 'extreme';
    }

    getIntensityRating(score) {
        if (score <= 25) return 'Manageable workload with standard capacity';
        if (score <= 50) return 'Elevated workload requiring attention';
        if (score <= 75) return 'High workload with milestone risk';
        return 'Extreme workload - immediate intervention required';
    }

    getRiskLevel(score) {
        if (score < 0.3) return 'low';
        if (score < 0.6) return 'moderate';
        if (score < 0.8) return 'high';
        return 'critical';
    }

    getMilestoneRiskLikelihood(score) {
        if (score < 0.3) return 'Low (15%) - Milestones likely to be met';
        if (score < 0.6) return 'Moderate (35%) - Some milestone risk';
        if (score < 0.8) return 'High (65%) - Likely milestone delays';
        return 'Critical (85%) - Almost certain milestone misses';
    }

    assessFactorRisk(value, thresholds) {
        if (value >= thresholds.high) {
            return { level: 'high', score: 0.8 };
        } else if (value >= thresholds.moderate) {
            return { level: 'moderate', score: 0.5 };
        } else if (value >= thresholds.low) {
            return { level: 'low', score: 0.2 };
        }
        return { level: 'minimal', score: 0.1 };
    }

    generateMitigationStrategies(riskScore, riskFactors) {
        const strategies = [];
        
        // High commit volume mitigation
        const commitFactor = riskFactors.find(f => f.factor === 'commitVolume');
        if (commitFactor && commitFactor.risk.level === 'high') {
            strategies.push({
                category: 'Commit Volume Management',
                action: 'Implement commit review gates and encourage smaller, more frequent commits',
                impact: 'Reduce integration complexity and testing overhead'
            });
        }
        
        // High deploy frequency mitigation
        const deployFactor = riskFactors.find(f => f.factor === 'deployFrequency');
        if (deployFactor && deployFactor.risk.level === 'high') {
            strategies.push({
                category: 'Deploy Optimization',
                action: 'Batch related deploys and improve automated testing coverage',
                impact: 'Reduce deployment overhead and minimize disruption'
            });
        }
        
        // Issue backlog mitigation
        const issueFactor = riskFactors.find(f => f.factor === 'issueBacklog');
        if (issueFactor && issueFactor.risk.level === 'high') {
            strategies.push({
                category: 'Issue Management',
                action: 'Prioritize issue resolution and add capacity for milestone cleanup',
                impact: 'Reduce technical debt and improve release stability'
            });
        }
        
        return strategies;
    }

    generateVolumeInsights(intensityAnalysis, riskAssessment) {
        const insights = [];
        
        // Intensity insights
        if (intensityAnalysis.overall.intensity >= 75) {
            insights.push({
                type: 'warning',
                category: 'Work Intensity',
                message: `Extreme work intensity detected (${intensityAnalysis.overall.intensity}/100)`,
                evidence: 'Teams likely to miss milestones without intervention'
            });
        } else if (intensityAnalysis.overall.intensity >= 50) {
            insights.push({
                type: 'warning',
                category: 'Work Intensity',
                message: `High work intensity requiring careful monitoring (${intensityAnalysis.overall.intensity}/100)`,
                evidence: 'Multiple teams showing signs of overload'
            });
        }
        
        // Risk insights
        if (riskAssessment && riskAssessment.overall.riskLevel === 'critical') {
            insights.push({
                type: 'critical',
                category: 'Milestone Risk',
                message: 'Critical risk of milestone delays across multiple factors',
                evidence: `${riskAssessment.teamsAtRisk.length} teams at high risk`
            });
        }
        
        return insights;
    }

    generateVolumeRecommendations(intensityAnalysis, riskAssessment) {
        const recommendations = [];
        
        // High intensity recommendations
        if (intensityAnalysis.overall.intensity >= 75) {
            recommendations.push({
                priority: 'high',
                category: 'Workload Management',
                recommendation: 'Immediately redistribute workload and add capacity',
                expectedImpact: 'Reduce milestone delay risk by 40-50%',
                implementation: 'Reassign non-critical work and add temporary resources'
            });
        }
        
        // Risk-based recommendations
        if (riskAssessment && riskAssessment.teamsAtRisk.length > 0) {
            recommendations.push({
                priority: 'high',
                category: 'Team Support',
                recommendation: 'Provide immediate support to overloaded teams',
                expectedImpact: `Help ${riskAssessment.teamsAtRisk.length} teams meet milestones`,
                implementation: 'Add dedicated resources and prioritize critical path work'
            });
        }
        
        return recommendations;
    }

    groupBy(array, key) {
        return array.reduce((groups, item) => {
            const group = item[key] || 'Unknown';
            groups[group] = groups[group] || [];
            groups[group].push(item);
            return groups;
        }, {});
    }

    groupByArray(array, key) {
        return array.reduce((groups, item) => {
            const values = Array.isArray(item[key]) ? item[key] : [item[key]];
            values.forEach(value => {
                if (value) {
                    groups[value] = groups[value] || [];
                    groups[value].push(item);
                }
            });
            return groups;
        }, {});
    }

    calculateWorkloadDistribution(teams) {
        const workloads = Object.values(teams).map(team => team.workload);
        return {
            average: workloads.reduce((sum, w) => sum + w, 0) / workloads.length,
            median: this.median(workloads),
            max: Math.max(...workloads),
            min: Math.min(...workloads)
        };
    }

    median(values) {
        const sorted = values.sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    // Placeholder methods for missing data sources
    async getDeployData(versionFilter, dateRange) { return []; }
    async getCommitData(versionFilter, dateRange) { return []; }
    async analyzeTrends(workData) { return null; }
    analyzeComponentWorkload(workData) { return null; }
    getIntensityRecommendations(intensity) { return []; }
}

module.exports = WorkVolumeReportGenerator;

// Usage example
if (require.main === module) {
    const generator = new WorkVolumeReportGenerator();
    
    // Generate work volume analysis for version 36.30
    generator.generateWorkVolumeReport({
        versionFilter: '36.30',
        includeTeamBreakdown: true,
        includeComponentAnalysis: true,
        includeRiskAssessment: true,
        includeTrendAnalysis: true
    })
    .then(result => {
        if (result.success) {
            console.log(`Work Intensity: ${result.workIntensity}/100 (${result.riskLevel} milestone risk)`);
            console.log(`Teams at Risk: ${result.teamsAtRisk}`);
            console.log(result.markdown);
        } else {
            console.error('Work volume analysis failed:', result.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}