//======================================================================================================================
// Hotfix Velocity Report Script
// Purpose: Analyzes hotfix response times, urgency patterns, and QA turnaround to optimize emergency fix processes
// Data Viability: 100% - Excellent (Priority, Urgency, QA State, Created/Resolved all present)
//======================================================================================================================

const { FIELDS, CONFIG } = require('./current/versionreport.js');

/**
 * Hotfix Velocity Report Generator
 * Analyzes hotfix creation patterns, resolution times, and team responsiveness
 */
class HotfixVelocityReportGenerator {
    constructor() {
        this.urgencyLevels = {
            'ASAP': { priority: 1, targetHours: 4, color: 'red' },
            'Today': { priority: 2, targetHours: 8, color: 'orange' },
            'Scheduled': { priority: 3, targetHours: 24, color: 'yellow' },
            'Not Critical': { priority: 4, targetHours: 72, color: 'green' }
        };
        
        this.priorityWeights = {
            '0 - Blocker': 10,
            '1 - Critical': 8,
            '2 - Major': 5,
            '3 - Normal': 3,
            '4 - Minor': 1
        };
        
        this.velocityThresholds = {
            excellent: { asap: 4, today: 8, scheduled: 24 },
            good: { asap: 6, today: 12, scheduled: 48 },
            fair: { asap: 8, today: 24, scheduled: 72 },
            poor: { asap: 12, today: 48, scheduled: 96 }
        };
    }

    /**
     * Generate comprehensive hotfix velocity analysis
     */
    async generateHotfixVelocityReport(options = {}) {
        try {
            console.log('Generating Hotfix Velocity Report...');
            
            const {
                versionFilter = null,
                dateRange = null,
                includeComponentAnalysis = true,
                includeReporterAnalysis = true,
                includeTrendAnalysis = true,
                compareVersions = []
            } = options;

            // Collect hotfix data
            const hotfixData = await this.collectHotfixData(versionFilter, dateRange);
            
            // Analyze velocity metrics
            const velocityAnalysis = this.analyzeVelocity(hotfixData);
            
            // Analyze response patterns
            const responsePatterns = this.analyzeResponsePatterns(hotfixData);
            
            // Analyze QA turnaround
            const qaAnalysis = this.analyzeQATurnaround(hotfixData);
            
            // Component analysis if requested
            const componentAnalysis = includeComponentAnalysis ? 
                this.analyzeByComponent(hotfixData) : null;
            
            // Reporter analysis if requested
            const reporterAnalysis = includeReporterAnalysis ?
                this.analyzeByReporter(hotfixData) : null;
            
            // Trend analysis if requested
            const trendAnalysis = includeTrendAnalysis ?
                await this.analyzeTrends(hotfixData, compareVersions) : null;
            
            // Generate insights and recommendations
            const insights = this.generateVelocityInsights(velocityAnalysis, responsePatterns);
            const recommendations = this.generateVelocityRecommendations(velocityAnalysis, qaAnalysis);
            
            // Generate report
            const report = this.generateVelocityMarkdown({
                versionFilter,
                dateRange,
                data: hotfixData,
                velocity: velocityAnalysis,
                patterns: responsePatterns,
                qa: qaAnalysis,
                components: componentAnalysis,
                reporters: reporterAnalysis,
                trends: trendAnalysis,
                insights: insights,
                recommendations: recommendations
            });
            
            return {
                success: true,
                version: versionFilter,
                totalHotfixes: hotfixData.length,
                avgResponseTime: velocityAnalysis.overall.averageResponseTime,
                velocityScore: velocityAnalysis.overall.velocityScore,
                qaVerificationRate: qaAnalysis.verificationRate,
                data: hotfixData,
                analysis: {
                    velocity: velocityAnalysis,
                    patterns: responsePatterns,
                    qa: qaAnalysis
                },
                insights: insights,
                recommendations: recommendations,
                markdown: report,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Error generating Hotfix Velocity Report:', error);
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Collect hotfix data from Airtable
     */
    async collectHotfixData(versionFilter, dateRange) {
        const hotfixesTable = base.getTable('Hotfixes');
        const query = await hotfixesTable.selectRecordsAsync({
            fields: [
                'Issue Key',
                'Summary',
                'Status',
                FIELDS.PRIORITY,
                FIELDS.URGENCY_CUSTOM_FIELD,
                FIELDS.QA_STATE,
                FIELDS.HOTFIX_CREATED_FIELD,
                FIELDS.HOTFIX_RESOLVED_FIELD,
                FIELDS.BUILD_VERSION_UNIFIED,
                'Component/s',
                'Reporter',
                'Description',
                'Action Type',
                'Community Messaging',
                'INI Files Updated'
            ]
        });

        return query.records
            .filter(record => {
                // Apply version filter
                if (versionFilter) {
                    const version = record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED);
                    if (version !== versionFilter) return false;
                }
                
                // Apply date range filter
                if (dateRange) {
                    const created = record.getCellValue(FIELDS.HOTFIX_CREATED_FIELD);
                    if (!created) return false;
                    
                    const createdDate = new Date(created);
                    if (createdDate < dateRange.start || createdDate > dateRange.end) {
                        return false;
                    }
                }
                
                return true;
            })
            .map(record => {
                const created = record.getCellValue(FIELDS.HOTFIX_CREATED_FIELD);
                const resolved = record.getCellValue(FIELDS.HOTFIX_RESOLVED_FIELD);
                
                return {
                    issueKey: record.getCellValueAsString('Issue Key'),
                    summary: record.getCellValueAsString('Summary'),
                    status: record.getCellValueAsString('Status'),
                    priority: record.getCellValueAsString(FIELDS.PRIORITY),
                    urgency: record.getCellValueAsString(FIELDS.URGENCY_CUSTOM_FIELD) || 'Not Critical',
                    qaState: record.getCellValueAsString(FIELDS.QA_STATE),
                    created: created,
                    resolved: resolved,
                    buildVersion: record.getCellValueAsString(FIELDS.BUILD_VERSION_UNIFIED),
                    components: record.getCellValue('Component/s') || [],
                    reporter: record.getCellValueAsString('Reporter'),
                    actionType: record.getCellValueAsString('Action Type'),
                    
                    // Calculated fields
                    responseTime: this.calculateResponseTime(created, resolved),
                    isVerified: this.isQAVerified(record.getCellValueAsString(FIELDS.QA_STATE)),
                    timeToQA: this.calculateTimeToQA(created, resolved, record.getCellValueAsString(FIELDS.QA_STATE)),
                    urgencyMet: this.checkUrgencyMet(created, resolved, record.getCellValueAsString(FIELDS.URGENCY_CUSTOM_FIELD))
                };
            });
    }

    /**
     * Calculate response time in hours
     */
    calculateResponseTime(created, resolved) {
        if (!created || !resolved) return null;
        
        const createdTime = new Date(created);
        const resolvedTime = new Date(resolved);
        const hours = (resolvedTime - createdTime) / (1000 * 60 * 60);
        
        return Math.round(hours * 10) / 10; // One decimal place
    }

    /**
     * Check if QA verified
     */
    isQAVerified(qaState) {
        if (!qaState) return false;
        const lowerQAState = qaState.toLowerCase();
        return lowerQAState.includes('verified') || 
               lowerQAState.includes('general qa has verified');
    }

    /**
     * Check if urgency target was met
     */
    checkUrgencyMet(created, resolved, urgency) {
        if (!created || !resolved || !urgency) return null;
        
        const responseTime = this.calculateResponseTime(created, resolved);
        const target = this.urgencyLevels[urgency]?.targetHours || 72;
        
        return responseTime !== null && responseTime <= target;
    }

    /**
     * Analyze overall velocity metrics
     */
    analyzeVelocity(hotfixData) {
        const urgencyGroups = this.groupByUrgency(hotfixData);
        const priorityGroups = this.groupByPriority(hotfixData);
        
        const velocityByUrgency = {};
        Object.entries(urgencyGroups).forEach(([urgency, hotfixes]) => {
            velocityByUrgency[urgency] = this.calculateUrgencyVelocity(hotfixes, urgency);
        });
        
        const velocityByPriority = {};
        Object.entries(priorityGroups).forEach(([priority, hotfixes]) => {
            velocityByPriority[priority] = this.calculatePriorityVelocity(hotfixes, priority);
        });
        
        // Calculate overall metrics
        const overall = this.calculateOverallVelocity(hotfixData, velocityByUrgency);
        
        return {
            overall: overall,
            byUrgency: velocityByUrgency,
            byPriority: velocityByPriority,
            distribution: {
                urgency: this.calculateDistribution(urgencyGroups),
                priority: this.calculateDistribution(priorityGroups)
            }
        };
    }

    /**
     * Calculate velocity metrics for an urgency level
     */
    calculateUrgencyVelocity(hotfixes, urgency) {
        const responseTimes = hotfixes
            .map(h => h.responseTime)
            .filter(t => t !== null);
        
        if (responseTimes.length === 0) {
            return {
                count: hotfixes.length,
                resolved: 0,
                avgResponseTime: null,
                minResponseTime: null,
                maxResponseTime: null,
                targetMet: 0,
                targetMetRate: 0
            };
        }
        
        const target = this.urgencyLevels[urgency]?.targetHours || 72;
        const targetMet = responseTimes.filter(t => t <= target).length;
        
        return {
            count: hotfixes.length,
            resolved: responseTimes.length,
            avgResponseTime: Math.round(responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length * 10) / 10,
            minResponseTime: Math.min(...responseTimes),
            maxResponseTime: Math.max(...responseTimes),
            targetMet: targetMet,
            targetMetRate: Math.round((targetMet / responseTimes.length) * 100),
            target: target
        };
    }

    /**
     * Analyze response patterns
     */
    analyzeResponsePatterns(hotfixData) {
        // Time of day analysis
        const hourlyDistribution = this.analyzeHourlyDistribution(hotfixData);
        
        // Day of week analysis
        const dailyDistribution = this.analyzeDailyDistribution(hotfixData);
        
        // Response time patterns by urgency
        const urgencyPatterns = this.analyzeUrgencyPatterns(hotfixData);
        
        // Component response patterns
        const componentPatterns = this.analyzeComponentPatterns(hotfixData);
        
        return {
            hourly: hourlyDistribution,
            daily: dailyDistribution,
            urgency: urgencyPatterns,
            components: componentPatterns,
            peakTimes: this.identifyPeakTimes(hourlyDistribution, dailyDistribution)
        };
    }

    /**
     * Analyze QA turnaround times
     */
    analyzeQATurnaround(hotfixData) {
        const verifiedHotfixes = hotfixData.filter(h => h.isVerified);
        const unverifiedHotfixes = hotfixData.filter(h => !h.isVerified && h.status === 'Done');
        
        const qaMetrics = {
            totalHotfixes: hotfixData.length,
            verified: verifiedHotfixes.length,
            unverified: unverifiedHotfixes.length,
            verificationRate: Math.round((verifiedHotfixes.length / hotfixData.length) * 100),
            
            byUrgency: {},
            byPriority: {},
            avgTimeToQA: null,
            qaBottlenecks: []
        };
        
        // QA rates by urgency
        Object.keys(this.urgencyLevels).forEach(urgency => {
            const urgencyHotfixes = hotfixData.filter(h => h.urgency === urgency);
            const urgencyVerified = urgencyHotfixes.filter(h => h.isVerified);
            
            qaMetrics.byUrgency[urgency] = {
                total: urgencyHotfixes.length,
                verified: urgencyVerified.length,
                rate: urgencyHotfixes.length > 0 ? 
                    Math.round((urgencyVerified.length / urgencyHotfixes.length) * 100) : 0
            };
        });
        
        // Identify QA bottlenecks
        if (qaMetrics.verificationRate < CONFIG.HOTFIX_QA_VERIFIED_TARGET_PERCENT) {
            qaMetrics.qaBottlenecks.push({
                issue: 'Low overall QA verification rate',
                impact: 'high',
                currentRate: qaMetrics.verificationRate,
                target: CONFIG.HOTFIX_QA_VERIFIED_TARGET_PERCENT
            });
        }
        
        return qaMetrics;
    }

    /**
     * Generate markdown report
     */
    generateVelocityMarkdown(reportData) {
        const { velocity, patterns, qa, insights, recommendations } = reportData;
        
        const urgencyEmoji = {
            'ASAP': '🔴',
            'Today': '🟠',
            'Scheduled': '🟡',
            'Not Critical': '🟢'
        };
        
        const scoreEmoji = velocity.overall.velocityScore >= 85 ? '🟢' :
                          velocity.overall.velocityScore >= 70 ? '🟡' :
                          velocity.overall.velocityScore >= 50 ? '🟠' : '🔴';
        
        return `# 🚀 Hotfix Velocity Analysis Report

## 📊 Velocity Overview

**Total Hotfixes**: ${reportData.data.length}
**Average Response Time**: ${velocity.overall.averageResponseTime} hours
**Velocity Score**: ${velocity.overall.velocityScore}/100 ${scoreEmoji}
**On-Time Delivery**: ${velocity.overall.onTimeRate}%

---

## ⏱️ Response Time Analysis

### By Urgency Level
| Urgency | Count | Avg Response | Target | Met Target | Success Rate |
|---------|-------|--------------|--------|------------|--------------|
${Object.entries(velocity.byUrgency).map(([urgency, metrics]) => 
    `| ${urgencyEmoji[urgency]} ${urgency} | ${metrics.count} | ${metrics.avgResponseTime || 'N/A'} hrs | ${metrics.target} hrs | ${metrics.targetMet} | ${metrics.targetMetRate}% |`
).join('\n')}

### By Priority
| Priority | Count | Avg Response | Min | Max |
|----------|-------|--------------|-----|-----|
${Object.entries(velocity.byPriority).map(([priority, metrics]) => 
    `| ${priority} | ${metrics.count} | ${metrics.avgResponseTime || 'N/A'} hrs | ${metrics.minResponseTime || 'N/A'} hrs | ${metrics.maxResponseTime || 'N/A'} hrs |`
).join('\n')}

---

## 📈 Response Patterns

### Peak Hotfix Times
${patterns.peakTimes.map(peak => 
    `- **${peak.period}**: ${peak.volume} hotfixes (${peak.percentage}% of total)`
).join('\n')}

### Urgency Distribution
${Object.entries(velocity.distribution.urgency).map(([urgency, data]) => 
    `- **${urgencyEmoji[urgency]} ${urgency}**: ${data.count} (${data.percentage}%)`
).join('\n')}

---

## ✅ QA Verification Analysis

**Overall QA Verification Rate**: ${qa.verificationRate}% ${qa.verificationRate >= 80 ? '🟢' : qa.verificationRate >= 60 ? '🟡' : '🔴'}

### QA Rates by Urgency
| Urgency | Total | Verified | Rate | Status |
|---------|-------|----------|------|--------|
${Object.entries(qa.byUrgency).map(([urgency, metrics]) => 
    `| ${urgencyEmoji[urgency]} ${urgency} | ${metrics.total} | ${metrics.verified} | ${metrics.rate}% | ${metrics.rate >= 80 ? '✅' : '⚠️'} |`
).join('\n')}

${qa.qaBottlenecks.length > 0 ? `
### 🚧 QA Bottlenecks
${qa.qaBottlenecks.map(bottleneck => 
    `- **${bottleneck.issue}**: Current ${bottleneck.currentRate}% vs Target ${bottleneck.target}%`
).join('\n')}
` : '### ✅ No QA Bottlenecks Identified'}

---

## 🏗️ Component Performance

${reportData.components ? `
### Top Performing Components (Fastest Response)
${reportData.components.topPerformers.map((comp, index) => 
    `${index + 1}. **${comp.name}**: ${comp.avgResponseTime} hrs average (${comp.count} hotfixes)`
).join('\n')}

### Components Needing Improvement
${reportData.components.needsImprovement.map(comp => 
    `- **${comp.name}**: ${comp.avgResponseTime} hrs average (${comp.issues} issues)`
).join('\n')}
` : 'Component analysis not included in this report.'}

---

## 💡 Key Insights

${insights.map(insight => 
    `### ${insight.type === 'positive' ? '🟢' : insight.type === 'warning' ? '🟡' : '🔴'} ${insight.category}\n` +
    `${insight.message}\n` +
    `*Evidence: ${insight.evidence}*`
).join('\n\n')}

---

## 🎯 Recommendations

${recommendations.map((rec, index) => 
    `### ${index + 1}. ${rec.category} (${rec.priority.toUpperCase()} Priority)\n` +
    `**Recommendation**: ${rec.recommendation}\n` +
    `**Expected Impact**: ${rec.expectedImpact}\n` +
    `**Implementation**: ${rec.implementation}\n`
).join('\n')}

---

## 📊 Response Time Distribution

### ASAP Hotfixes (${velocity.byUrgency.ASAP?.count || 0})
\`\`\`
0-2h:   ${'█'.repeat(Math.round((velocity.byUrgency.ASAP?.under2h || 0) / 5))} ${velocity.byUrgency.ASAP?.under2h || 0}
2-4h:   ${'█'.repeat(Math.round((velocity.byUrgency.ASAP?.under4h || 0) / 5))} ${velocity.byUrgency.ASAP?.under4h || 0}
4-8h:   ${'█'.repeat(Math.round((velocity.byUrgency.ASAP?.under8h || 0) / 5))} ${velocity.byUrgency.ASAP?.under8h || 0}
8h+:    ${'█'.repeat(Math.round((velocity.byUrgency.ASAP?.over8h || 0) / 5))} ${velocity.byUrgency.ASAP?.over8h || 0}
\`\`\`

---

*Hotfix Velocity Analysis completed on ${new Date().toLocaleString()}*
*Analysis covers ${reportData.data.length} hotfixes${reportData.versionFilter ? ` for version ${reportData.versionFilter}` : ' across all versions'}*`;
    }

    // Helper methods
    groupByUrgency(hotfixes) {
        return hotfixes.reduce((groups, hotfix) => {
            const urgency = hotfix.urgency || 'Not Critical';
            groups[urgency] = groups[urgency] || [];
            groups[urgency].push(hotfix);
            return groups;
        }, {});
    }

    groupByPriority(hotfixes) {
        return hotfixes.reduce((groups, hotfix) => {
            const priority = hotfix.priority || '3 - Normal';
            groups[priority] = groups[priority] || [];
            groups[priority].push(hotfix);
            return groups;
        }, {});
    }

    calculateDistribution(groups) {
        const total = Object.values(groups).reduce((sum, group) => sum + group.length, 0);
        const distribution = {};
        
        Object.entries(groups).forEach(([key, group]) => {
            distribution[key] = {
                count: group.length,
                percentage: total > 0 ? Math.round((group.length / total) * 100) : 0
            };
        });
        
        return distribution;
    }

    calculateOverallVelocity(hotfixData, velocityByUrgency) {
        const resolvedHotfixes = hotfixData.filter(h => h.responseTime !== null);
        const avgResponseTime = resolvedHotfixes.length > 0 ?
            Math.round(resolvedHotfixes.reduce((sum, h) => sum + h.responseTime, 0) / resolvedHotfixes.length * 10) / 10 : 0;
        
        // Calculate on-time rate
        const onTimeCount = hotfixData.filter(h => h.urgencyMet === true).length;
        const onTimeRate = hotfixData.length > 0 ?
            Math.round((onTimeCount / hotfixData.length) * 100) : 0;
        
        // Calculate velocity score
        let velocityScore = 100;
        
        // Deduct points for missing urgency targets
        Object.entries(velocityByUrgency).forEach(([urgency, metrics]) => {
            const weight = this.urgencyLevels[urgency]?.priority || 4;
            const penalty = (100 - metrics.targetMetRate) * (5 - weight) / 10;
            velocityScore -= penalty;
        });
        
        return {
            totalHotfixes: hotfixData.length,
            resolvedHotfixes: resolvedHotfixes.length,
            averageResponseTime: avgResponseTime,
            onTimeCount: onTimeCount,
            onTimeRate: onTimeRate,
            velocityScore: Math.max(0, Math.round(velocityScore))
        };
    }

    generateVelocityInsights(velocityAnalysis, responsePatterns) {
        const insights = [];
        
        // Overall velocity insights
        if (velocityAnalysis.overall.velocityScore >= 85) {
            insights.push({
                type: 'positive',
                category: 'Velocity Performance',
                message: `Excellent hotfix velocity with ${velocityAnalysis.overall.velocityScore}/100 score`,
                evidence: `${velocityAnalysis.overall.onTimeRate}% on-time delivery rate`
            });
        } else if (velocityAnalysis.overall.velocityScore < 60) {
            insights.push({
                type: 'warning',
                category: 'Velocity Performance',
                message: `Hotfix velocity below target (${velocityAnalysis.overall.velocityScore}/100)`,
                evidence: `Only ${velocityAnalysis.overall.onTimeRate}% meeting urgency targets`
            });
        }
        
        // ASAP response insights
        const asapMetrics = velocityAnalysis.byUrgency['ASAP'];
        if (asapMetrics && asapMetrics.targetMetRate < 70) {
            insights.push({
                type: 'warning',
                category: 'Critical Response',
                message: `ASAP hotfixes struggling to meet ${asapMetrics.target} hour target`,
                evidence: `Only ${asapMetrics.targetMetRate}% delivered on time`
            });
        }
        
        return insights;
    }

    generateVelocityRecommendations(velocityAnalysis, qaAnalysis) {
        const recommendations = [];
        
        // QA verification recommendations
        if (qaAnalysis.verificationRate < CONFIG.HOTFIX_QA_VERIFIED_TARGET_PERCENT) {
            recommendations.push({
                priority: 'high',
                category: 'QA Process',
                recommendation: 'Implement mandatory QA verification for all hotfixes',
                expectedImpact: `Increase QA rate from ${qaAnalysis.verificationRate}% to ${CONFIG.HOTFIX_QA_VERIFIED_TARGET_PERCENT}%+`,
                implementation: 'Add QA checkpoint to hotfix workflow with automated reminders'
            });
        }
        
        // Response time recommendations
        const asapMetrics = velocityAnalysis.byUrgency['ASAP'];
        if (asapMetrics && asapMetrics.avgResponseTime > 6) {
            recommendations.push({
                priority: 'high',
                category: 'Response Time',
                recommendation: 'Establish dedicated ASAP response team',
                expectedImpact: 'Reduce ASAP response time to under 4 hours',
                implementation: 'Create on-call rotation for critical hotfix response'
            });
        }
        
        return recommendations;
    }

    // Additional helper methods...
    calculatePriorityVelocity(hotfixes, priority) { /* ... */ }
    analyzeHourlyDistribution(hotfixData) { /* ... */ }
    analyzeDailyDistribution(hotfixData) { /* ... */ }
    analyzeUrgencyPatterns(hotfixData) { /* ... */ }
    analyzeComponentPatterns(hotfixData) { /* ... */ }
    identifyPeakTimes(hourly, daily) { /* ... */ }
    analyzeByComponent(hotfixData) { /* ... */ }
    analyzeByReporter(hotfixData) { /* ... */ }
    analyzeTrends(hotfixData, compareVersions) { /* ... */ }
    calculateTimeToQA(created, resolved, qaState) { /* ... */ }
}

module.exports = HotfixVelocityReportGenerator;

// Usage example
if (require.main === module) {
    const generator = new HotfixVelocityReportGenerator();
    
    // Generate hotfix velocity analysis for version 36.30
    generator.generateHotfixVelocityReport({
        versionFilter: '36.30',
        includeComponentAnalysis: true,
        includeReporterAnalysis: true,
        includeTrendAnalysis: true
    })
    .then(result => {
        if (result.success) {
            console.log(`Hotfix Velocity: ${result.avgResponseTime} hrs average (${result.velocityScore}/100 score)`);
            console.log(result.markdown);
        } else {
            console.error('Velocity analysis failed:', result.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}