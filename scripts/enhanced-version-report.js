//======================================================================================================================
// Enhanced Fortnite Release Report Script
// Version: v25.0.0 (Enhanced with additional metrics and optimizations)
// Purpose: Generates comprehensive release reports with enhanced analytics, trend analysis, and dashboard integration
//======================================================================================================================

// Core configuration and field mappings
const ENHANCED_CONFIG = {
    // Enhanced scoring thresholds
    SCORING: {
        EXCELLENT_THRESHOLD: 85,
        GOOD_THRESHOLD: 70,
        FAIR_THRESHOLD: 50,
        POOR_THRESHOLD: 30
    },
    
    // New analytics features
    ANALYTICS: {
        TREND_ANALYSIS_PERIODS: 3,    // Compare last 3 releases for trends
        HOTFIX_URGENCY_WEIGHTS: {
            'ASAP': 10,
            'Today': 8,
            'Scheduled': 5,
            'Not Critical': 2
        },
        INTEGRATION_PHASE_WEIGHTS: {
            'Live+': 15,          // Highest impact
            'PD to Cert': 10,     // High impact
            'HL to PD': 5,        // Medium impact
            'Cert to Live': 8     // High impact
        }
    },
    
    // Dashboard metrics
    DASHBOARD: {
        KEY_METRICS: [
            'Overall Health Score',
            'Deploy Reliability',
            'Integration Efficiency', 
            'Incident Rate',
            'QA Verification Rate',
            'Timeline Adherence'
        ]
    }
};

//======================================================================================================================
// ENHANCED ANALYTICS FUNCTIONS
//======================================================================================================================

/**
 * Enhanced health scoring with weighted factors
 */
function calculateEnhancedHealthScore(versionData) {
    const weights = {
        deployStability: 0.25,
        integrationEfficiency: 0.20,
        incidentSeverity: 0.20,
        qaVerification: 0.15,
        timelineAdherence: 0.10,
        hotfixUrgency: 0.10
    };
    
    const scores = {
        deployStability: calculateDeployStabilityScore(versionData.builds),
        integrationEfficiency: calculateIntegrationEfficiencyScore(versionData.integrations),
        incidentSeverity: calculateIncidentSeverityScore(versionData.incidents),
        qaVerification: calculateQAVerificationScore(versionData.hotfixes),
        timelineAdherence: calculateTimelineAdherenceScore(versionData.builds),
        hotfixUrgency: calculateHotfixUrgencyScore(versionData.hotfixes)
    };
    
    let weightedScore = 0;
    for (const [metric, weight] of Object.entries(weights)) {
        weightedScore += scores[metric] * weight;
    }
    
    return {
        overall: Math.round(weightedScore),
        breakdown: scores,
        weights: weights
    };
}

/**
 * Deploy stability scoring based on classification patterns
 */
function calculateDeployStabilityScore(builds) {
    if (!builds || builds.length === 0) return 100;
    
    const unplannedCount = builds.filter(build => 
        build['Deploy Classification'] === 'Unplanned').length;
    const totalDeploys = builds.length;
    
    const unplannedRatio = unplannedCount / totalDeploys;
    
    // Score: 100% planned = 100, 50% unplanned = 50, 100% unplanned = 0
    return Math.max(0, Math.round(100 - (unplannedRatio * 100)));
}

/**
 * Integration efficiency based on phase completion rates
 */
function calculateIntegrationEfficiencyScore(integrations) {
    if (!integrations || integrations.length === 0) return 100;
    
    let totalWeightedScore = 0;
    let totalWeight = 0;
    
    const phaseFields = [
        { field: 'HL to PD Flag', weight: ENHANCED_CONFIG.ANALYTICS.INTEGRATION_PHASE_WEIGHTS['HL to PD'] },
        { field: 'PD to Cert Sub Flag', weight: ENHANCED_CONFIG.ANALYTICS.INTEGRATION_PHASE_WEIGHTS['PD to Cert'] },
        { field: 'Live+ Flag', weight: ENHANCED_CONFIG.ANALYTICS.INTEGRATION_PHASE_WEIGHTS['Live+'] }
    ];
    
    phaseFields.forEach(phase => {
        const completedCount = integrations.filter(integration => 
            integration[phase.field] === 1).length;
        const phaseScore = (completedCount / integrations.length) * 100;
        
        totalWeightedScore += phaseScore * phase.weight;
        totalWeight += phase.weight;
    });
    
    return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 100;
}

/**
 * QA verification rate scoring
 */
function calculateQAVerificationScore(hotfixes) {
    if (!hotfixes || hotfixes.length === 0) return 100;
    
    const verifiedCount = hotfixes.filter(hotfix => 
        hotfix['QA State'] && hotfix['QA State'].includes('verified')).length;
    
    return Math.round((verifiedCount / hotfixes.length) * 100);
}

/**
 * Hotfix urgency impact scoring
 */
function calculateHotfixUrgencyScore(hotfixes) {
    if (!hotfixes || hotfixes.length === 0) return 100;
    
    let totalUrgencyWeight = 0;
    let maxPossibleWeight = 0;
    
    hotfixes.forEach(hotfix => {
        const urgency = hotfix['Urgency'] || 'Not Critical';
        const weight = ENHANCED_CONFIG.ANALYTICS.HOTFIX_URGENCY_WEIGHTS[urgency] || 1;
        
        totalUrgencyWeight += weight;
        maxPossibleWeight += ENHANCED_CONFIG.ANALYTICS.HOTFIX_URGENCY_WEIGHTS['Not Critical'];
    });
    
    // Lower urgency weight = higher score
    const urgencyRatio = totalUrgencyWeight / maxPossibleWeight;
    return Math.max(0, Math.round(100 - (urgencyRatio * 50)));
}

/**
 * Timeline adherence scoring based on milestone completion
 */
function calculateTimelineAdherenceScore(builds) {
    if (!builds || builds.length === 0) return 100;
    
    // This would need milestone date comparison logic
    // For now, return a baseline score
    return 75; // Placeholder - would implement actual milestone tracking
}

/**
 * Incident severity scoring
 */
function calculateIncidentSeverityScore(incidents) {
    if (!incidents || incidents.length === 0) return 100;
    
    const severityWeights = {
        'Sev 1': 20,
        'Sev 2': 15,
        'Sev 3': 10,
        'Sev 4': 5
    };
    
    let totalImpact = 0;
    let maxPossibleImpact = incidents.length * severityWeights['Sev 4']; // Best case all Sev 4
    
    incidents.forEach(incident => {
        const severity = incident['Severity (Normalized)'] || 'Sev 4';
        totalImpact += severityWeights[severity] || 5;
    });
    
    const impactRatio = totalImpact / maxPossibleImpact;
    return Math.max(0, Math.round(100 - (impactRatio * 80)));
}

//======================================================================================================================
// TREND ANALYSIS FUNCTIONS
//======================================================================================================================

/**
 * Analyze trends across multiple releases
 */
function analyzeTrends(currentData, historicalData) {
    const trends = {
        healthScore: calculateTrend(currentData.healthScore, historicalData.map(h => h.healthScore)),
        deployStability: calculateTrend(currentData.deployStability, historicalData.map(h => h.deployStability)),
        incidentRate: calculateTrend(currentData.incidentRate, historicalData.map(h => h.incidentRate)),
        integrationEfficiency: calculateTrend(currentData.integrationEfficiency, historicalData.map(h => h.integrationEfficiency))
    };
    
    return {
        summary: generateTrendSummary(trends),
        details: trends
    };
}

function calculateTrend(current, historical) {
    if (!historical || historical.length === 0) {
        return { direction: 'stable', magnitude: 0, confidence: 'low' };
    }
    
    const average = historical.reduce((sum, val) => sum + val, 0) / historical.length;
    const change = current - average;
    const changePercent = Math.abs(change / average) * 100;
    
    return {
        direction: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
        magnitude: Math.round(changePercent),
        confidence: historical.length >= 3 ? 'high' : 'medium',
        current: current,
        historical: average
    };
}

function generateTrendSummary(trends) {
    const improving = Object.values(trends).filter(t => t.direction === 'improving').length;
    const declining = Object.values(trends).filter(t => t.direction === 'declining').length;
    
    if (improving > declining) return 'Overall trends are positive';
    if (declining > improving) return 'Some areas need attention';
    return 'Performance is stable';
}

//======================================================================================================================
// ENHANCED REPORTING FUNCTIONS
//======================================================================================================================

/**
 * Generate dashboard-ready metrics
 */
function generateDashboardMetrics(versionData, historicalData = []) {
    const healthScore = calculateEnhancedHealthScore(versionData);
    const trends = historicalData.length > 0 ? analyzeTrends(healthScore, historicalData) : null;
    
    return {
        version: versionData.version,
        timestamp: new Date().toISOString(),
        
        // Key Performance Indicators
        kpis: {
            overallHealth: {
                score: healthScore.overall,
                status: getHealthStatus(healthScore.overall),
                trend: trends?.details.healthScore?.direction || 'stable'
            },
            deployReliability: {
                score: healthScore.breakdown.deployStability,
                status: getHealthStatus(healthScore.breakdown.deployStability),
                trend: trends?.details.deployStability?.direction || 'stable'
            },
            integrationEfficiency: {
                score: healthScore.breakdown.integrationEfficiency,
                status: getHealthStatus(healthScore.breakdown.integrationEfficiency),
                trend: trends?.details.integrationEfficiency?.direction || 'stable'
            },
            incidentRate: {
                score: healthScore.breakdown.incidentSeverity,
                status: getHealthStatus(healthScore.breakdown.incidentSeverity),
                trend: trends?.details.incidentRate?.direction || 'stable'
            },
            qaVerification: {
                score: healthScore.breakdown.qaVerification,
                status: getHealthStatus(healthScore.breakdown.qaVerification),
                trend: 'stable'
            },
            timelineAdherence: {
                score: healthScore.breakdown.timelineAdherence,
                status: getHealthStatus(healthScore.breakdown.timelineAdherence),
                trend: 'stable'
            }
        },
        
        // Detailed breakdown
        breakdown: healthScore.breakdown,
        weights: healthScore.weights,
        
        // Summary statistics
        summary: {
            totalBuilds: versionData.builds?.length || 0,
            totalHotfixes: versionData.hotfixes?.length || 0,
            totalIntegrations: versionData.integrations?.length || 0,
            totalIncidents: versionData.incidents?.length || 0,
            rqaItems: versionData.rqa?.length || 0
        },
        
        // Trend analysis
        trends: trends,
        
        // Alerts and recommendations
        alerts: generateAlerts(healthScore),
        recommendations: generateRecommendations(healthScore, versionData)
    };
}

/**
 * Get health status label
 */
function getHealthStatus(score) {
    if (score >= ENHANCED_CONFIG.SCORING.EXCELLENT_THRESHOLD) return 'excellent';
    if (score >= ENHANCED_CONFIG.SCORING.GOOD_THRESHOLD) return 'good';
    if (score >= ENHANCED_CONFIG.SCORING.FAIR_THRESHOLD) return 'fair';
    return 'poor';
}

/**
 * Generate automated alerts
 */
function generateAlerts(healthScore) {
    const alerts = [];
    
    // Critical health score alert
    if (healthScore.overall < ENHANCED_CONFIG.SCORING.POOR_THRESHOLD) {
        alerts.push({
            level: 'critical',
            message: `Overall health score (${healthScore.overall}) is critically low`,
            action: 'Immediate review required'
        });
    }
    
    // Deploy stability alert
    if (healthScore.breakdown.deployStability < ENHANCED_CONFIG.SCORING.FAIR_THRESHOLD) {
        alerts.push({
            level: 'warning',
            message: 'High number of unplanned deployments detected',
            action: 'Review deployment planning process'
        });
    }
    
    // QA verification alert
    if (healthScore.breakdown.qaVerification < ENHANCED_CONFIG.SCORING.GOOD_THRESHOLD) {
        alerts.push({
            level: 'warning',
            message: 'QA verification rate below target',
            action: 'Increase QA coverage for hotfixes'
        });
    }
    
    return alerts;
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(healthScore, versionData) {
    const recommendations = [];
    
    // Deploy stability recommendations
    if (healthScore.breakdown.deployStability < ENHANCED_CONFIG.SCORING.GOOD_THRESHOLD) {
        recommendations.push({
            category: 'Deploy Planning',
            priority: 'high',
            recommendation: 'Implement pre-release checklist to reduce unplanned deployments',
            expectedImpact: 'Improve deploy stability score by 15-20 points'
        });
    }
    
    // Integration efficiency recommendations
    if (healthScore.breakdown.integrationEfficiency < ENHANCED_CONFIG.SCORING.GOOD_THRESHOLD) {
        recommendations.push({
            category: 'Integration Process',
            priority: 'medium',
            recommendation: 'Review integration timeline adherence and bottlenecks',
            expectedImpact: 'Improve integration efficiency by 10-15 points'
        });
    }
    
    // QA process recommendations
    if (healthScore.breakdown.qaVerification < ENHANCED_CONFIG.SCORING.EXCELLENT_THRESHOLD) {
        recommendations.push({
            category: 'Quality Assurance',
            priority: 'medium',
            recommendation: 'Establish mandatory QA verification for all hotfixes',
            expectedImpact: 'Achieve 95%+ QA verification rate'
        });
    }
    
    return recommendations;
}

//======================================================================================================================
// EXPORT FUNCTIONS
//======================================================================================================================

/**
 * Main function to generate enhanced release report
 */
async function generateEnhancedReleaseReport(targetVersion, includeHistorical = true) {
    try {
        // Fetch current version data (this would integrate with existing Airtable queries)
        const currentData = await fetchVersionData(targetVersion);
        
        // Fetch historical data for trend analysis
        const historicalData = includeHistorical ? await fetchHistoricalData(targetVersion, 3) : [];
        
        // Generate dashboard metrics
        const dashboardMetrics = generateDashboardMetrics(currentData, historicalData);
        
        // Generate enhanced markdown report
        const markdownReport = generateEnhancedMarkdownReport(dashboardMetrics);
        
        // Generate JSON for API/dashboard consumption
        const jsonReport = {
            ...dashboardMetrics,
            generated: new Date().toISOString(),
            version: "v25.0.0"
        };
        
        return {
            markdown: markdownReport,
            json: jsonReport,
            success: true
        };
        
    } catch (error) {
        console.error('Error generating enhanced release report:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Generate enhanced markdown report
 */
function generateEnhancedMarkdownReport(metrics) {
    const statusEmoji = {
        excellent: '🟢',
        good: '🟡', 
        fair: '🟠',
        poor: '🔴'
    };
    
    const trendEmoji = {
        improving: '⬆️',
        declining: '⬇️',
        stable: '➡️'
    };
    
    return `# 🚀 Enhanced Release Report – Version ${metrics.version}

## 📊 Release Health Dashboard
**Overall Score: ${metrics.kpis.overallHealth.score}/100** ${statusEmoji[metrics.kpis.overallHealth.status]} ${trendEmoji[metrics.kpis.overallHealth.trend]}

### Key Performance Indicators

| Metric | Score | Status | Trend |
|--------|-------|--------|-------|
| Deploy Reliability | ${metrics.kpis.deployReliability.score}/100 | ${statusEmoji[metrics.kpis.deployReliability.status]} | ${trendEmoji[metrics.kpis.deployReliability.trend]} |
| Integration Efficiency | ${metrics.kpis.integrationEfficiency.score}/100 | ${statusEmoji[metrics.kpis.integrationEfficiency.status]} | ${trendEmoji[metrics.kpis.integrationEfficiency.trend]} |
| Incident Management | ${metrics.kpis.incidentRate.score}/100 | ${statusEmoji[metrics.kpis.incidentRate.status]} | ${trendEmoji[metrics.kpis.incidentRate.trend]} |
| QA Verification | ${metrics.kpis.qaVerification.score}/100 | ${statusEmoji[metrics.kpis.qaVerification.status]} | ${trendEmoji[metrics.kpis.qaVerification.trend]} |
| Timeline Adherence | ${metrics.kpis.timelineAdherence.score}/100 | ${statusEmoji[metrics.kpis.timelineAdherence.status]} | ${trendEmoji[metrics.kpis.timelineAdherence.trend]} |

---

## 📈 Release Statistics

- **Total Builds**: ${metrics.summary.totalBuilds}
- **Total Hotfixes**: ${metrics.summary.totalHotfixes}  
- **Total Integrations**: ${metrics.summary.totalIntegrations}
- **Total Incidents**: ${metrics.summary.totalIncidents}
- **RQA Items**: ${metrics.summary.rqaItems}

---

## 🚨 Alerts & Recommendations

${generateAlertsSection(metrics.alerts)}

${generateRecommendationsSection(metrics.recommendations)}

${metrics.trends ? generateTrendsSection(metrics.trends) : ''}

---

## 🔍 Detailed Breakdown

### Health Score Components
${Object.entries(metrics.breakdown).map(([key, value]) => 
    `- **${key.replace(/([A-Z])/g, ' $1').trim()}**: ${value}/100`
).join('\n')}

### Scoring Weights
${Object.entries(metrics.weights).map(([key, weight]) => 
    `- **${key.replace(/([A-Z])/g, ' $1').trim()}**: ${Math.round(weight * 100)}%`
).join('\n')}

---

*Report generated on ${new Date(metrics.timestamp).toLocaleString()} by Enhanced Release Analytics v25.0.0*
`;
}

function generateAlertsSection(alerts) {
    if (!alerts || alerts.length === 0) {
        return '### ✅ No Critical Alerts\nAll systems are operating within normal parameters.';
    }
    
    const alertsByLevel = alerts.reduce((acc, alert) => {
        acc[alert.level] = acc[alert.level] || [];
        acc[alert.level].push(alert);
        return acc;
    }, {});
    
    let section = '### 🚨 Alerts\n';
    
    if (alertsByLevel.critical) {
        section += '\n🔴 **Critical Issues**\n';
        alertsByLevel.critical.forEach(alert => {
            section += `- ${alert.message}\n  *Action: ${alert.action}*\n`;
        });
    }
    
    if (alertsByLevel.warning) {
        section += '\n🟡 **Warnings**\n';
        alertsByLevel.warning.forEach(alert => {
            section += `- ${alert.message}\n  *Action: ${alert.action}*\n`;
        });
    }
    
    return section;
}

function generateRecommendationsSection(recommendations) {
    if (!recommendations || recommendations.length === 0) {
        return '### 💡 No New Recommendations\nCurrent processes are meeting targets.';
    }
    
    let section = '### 💡 Recommendations\n';
    
    const priorityOrder = ['high', 'medium', 'low'];
    priorityOrder.forEach(priority => {
        const priorityRecs = recommendations.filter(rec => rec.priority === priority);
        if (priorityRecs.length > 0) {
            section += `\n**${priority.toUpperCase()} Priority**\n`;
            priorityRecs.forEach(rec => {
                section += `- **${rec.category}**: ${rec.recommendation}\n`;
                section += `  *Expected Impact: ${rec.expectedImpact}*\n`;
            });
        }
    });
    
    return section;
}

function generateTrendsSection(trends) {
    return `
---

## 📈 Trend Analysis

**Summary**: ${trends.summary}

### Key Trends
${Object.entries(trends.details).map(([metric, trend]) => 
    `- **${metric.replace(/([A-Z])/g, ' $1').trim()}**: ${trend.direction} (${trend.magnitude}% change, ${trend.confidence} confidence)`
).join('\n')}
`;
}

// Placeholder functions for data fetching (would integrate with existing Airtable code)
async function fetchVersionData(version) {
    // This would use the existing Airtable integration
    return {
        version: version,
        builds: [],
        hotfixes: [],
        integrations: [],
        incidents: [],
        rqa: []
    };
}

async function fetchHistoricalData(currentVersion, periods) {
    // This would fetch historical release data for trend analysis
    return [];
}

module.exports = {
    generateEnhancedReleaseReport,
    generateDashboardMetrics,
    calculateEnhancedHealthScore,
    ENHANCED_CONFIG
};