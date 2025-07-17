require('dotenv').config();
const Airtable = require('airtable');
const fs = require('fs').promises;
const path = require('path');

const apiKey = process.env.AIRTABLE_API_KEY;
const baseId = process.env.AIRTABLE_BASE_ID;
Airtable.configure({ apiKey });
const base = Airtable.base(baseId);

class ReleaseHealthPredictor {
    constructor() {
        this.historicalData = [];
        this.predictions = {};
    }

    // Fetch historical release data for training
    async fetchHistoricalData() {
        console.log('📊 Fetching historical release data...');
        
        const builds = await base('Builds').select({
            maxRecords: 200,
            fields: [
                'Release Version', 'Build Status (Unified)', 'Release Health Score',
                'Total Hotfixes', 'Total Integrations', 'SH Score', 
                'Release Cycle Duration', 'HL to PD Duration', 'PD to Live Duration',
                'Deploy Fallout Score', 'Integration Score', 'Live Date'
            ],
            filterByFormula: 'AND({Live Date} != "", {Release Health Score} != "")'
        }).all();

        this.historicalData = builds.map(record => ({
            version: record.fields['Release Version'],
            healthScore: record.fields['Release Health Score'] || 0,
            metrics: {
                hotfixes: record.fields['Total Hotfixes'] || 0,
                integrations: record.fields['Total Integrations'] || 0,
                incidents: record.fields['SH Score'] || 0,
                cycleDuration: record.fields['Release Cycle Duration'] || 0,
                deployFallout: record.fields['Deploy Fallout Score'] || 0,
                integrationScore: record.fields['Integration Score'] || 0
            },
            date: record.fields['Live Date']
        }));

        console.log(`✅ Loaded ${this.historicalData.length} historical releases`);
        return this.historicalData;
    }

    // Calculate risk factors based on current metrics
    calculateRiskFactors(metrics) {
        const riskFactors = {
            hotfixRisk: 0,
            integrationRisk: 0,
            incidentRisk: 0,
            cycleRisk: 0,
            overallRisk: 0
        };

        // Calculate individual risk scores (0-100)
        riskFactors.hotfixRisk = Math.min(100, (metrics.hotfixes / 10) * 100);
        riskFactors.integrationRisk = Math.min(100, (metrics.integrations / 50) * 100);
        riskFactors.incidentRisk = Math.min(100, (metrics.incidents / 20) * 100);
        riskFactors.cycleRisk = metrics.cycleDuration > 30 ? 80 : metrics.cycleDuration > 20 ? 50 : 20;

        // Calculate weighted overall risk
        riskFactors.overallRisk = (
            riskFactors.hotfixRisk * 0.3 +
            riskFactors.integrationRisk * 0.2 +
            riskFactors.incidentRisk * 0.4 +
            riskFactors.cycleRisk * 0.1
        );

        return riskFactors;
    }

    // Predict health score based on patterns
    predictHealthScore(currentMetrics) {
        // Find similar historical releases
        const similarReleases = this.historicalData.filter(release => {
            const metricSimilarity = 
                Math.abs(release.metrics.hotfixes - currentMetrics.hotfixes) < 3 &&
                Math.abs(release.metrics.integrations - currentMetrics.integrations) < 10;
            return metricSimilarity;
        });

        if (similarReleases.length === 0) {
            // Fallback: use average
            const avgHealth = this.historicalData.reduce((sum, r) => sum + r.healthScore, 0) / this.historicalData.length;
            return avgHealth;
        }

        // Calculate weighted average based on similarity
        const predictedScore = similarReleases.reduce((sum, r) => sum + r.healthScore, 0) / similarReleases.length;
        return predictedScore;
    }

    // Analyze trends and patterns
    analyzeTrends() {
        const trends = {
            healthScoreTrend: [],
            riskTrend: [],
            insights: []
        };

        // Sort by date
        const sortedData = [...this.historicalData].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );

        // Calculate moving averages
        const windowSize = 5;
        for (let i = windowSize; i < sortedData.length; i++) {
            const window = sortedData.slice(i - windowSize, i);
            const avgHealth = window.reduce((sum, r) => sum + r.healthScore, 0) / windowSize;
            const avgHotfixes = window.reduce((sum, r) => sum + r.metrics.hotfixes, 0) / windowSize;
            
            trends.healthScoreTrend.push({
                date: sortedData[i].date,
                averageHealth: avgHealth.toFixed(2),
                averageHotfixes: avgHotfixes.toFixed(1)
            });
        }

        // Identify patterns
        if (trends.healthScoreTrend.length > 2) {
            const recent = trends.healthScoreTrend.slice(-3);
            const healthChange = recent[2].averageHealth - recent[0].averageHealth;
            
            if (healthChange < -5) {
                trends.insights.push('⚠️ Declining release health trend detected');
            } else if (healthChange > 5) {
                trends.insights.push('✅ Improving release health trend');
            }
        }

        return trends;
    }

    // Generate predictions for upcoming releases
    async generatePredictions() {
        console.log('\n🔮 Generating Release Health Predictions...');
        
        // Fetch current in-progress releases
        const upcomingReleases = await base('Builds').select({
            maxRecords: 10,
            fields: [
                'Release Version', 'Build Status (Unified)', 
                'Total Integrations', 'Total Hotfixes', 'SH Score',
                'Release Cycle Duration'
            ],
            filterByFormula: 'OR({Build Status (Unified)} = "In Development", {Build Status (Unified)} = "In Testing")'
        }).all();

        const predictions = [];

        for (const release of upcomingReleases) {
            const version = release.fields['Release Version'];
            const currentMetrics = {
                hotfixes: release.fields['Total Hotfixes'] || 0,
                integrations: release.fields['Total Integrations'] || 0,
                incidents: release.fields['SH Score'] || 0,
                cycleDuration: release.fields['Release Cycle Duration'] || 0
            };

            const riskFactors = this.calculateRiskFactors(currentMetrics);
            const predictedHealth = this.predictHealthScore(currentMetrics);

            predictions.push({
                version,
                status: release.fields['Build Status (Unified)'],
                predictedHealthScore: predictedHealth.toFixed(2),
                riskLevel: riskFactors.overallRisk > 70 ? 'HIGH' : riskFactors.overallRisk > 40 ? 'MEDIUM' : 'LOW',
                riskFactors,
                recommendations: this.generateRecommendations(riskFactors, currentMetrics)
            });
        }

        this.predictions = {
            generatedAt: new Date().toISOString(),
            historicalDataPoints: this.historicalData.length,
            upcomingReleases: predictions,
            trends: this.analyzeTrends()
        };

        return this.predictions;
    }

    // Generate specific recommendations
    generateRecommendations(riskFactors, metrics) {
        const recommendations = [];

        if (riskFactors.hotfixRisk > 60) {
            recommendations.push({
                type: 'critical',
                area: 'Quality Assurance',
                action: `High hotfix risk (${metrics.hotfixes} hotfixes). Recommend extended QA cycle and regression testing.`
            });
        }

        if (riskFactors.integrationRisk > 70) {
            recommendations.push({
                type: 'warning',
                area: 'Integration Management',
                action: 'High integration count. Consider feature freeze or phased integration approach.'
            });
        }

        if (riskFactors.incidentRisk > 50) {
            recommendations.push({
                type: 'critical',
                area: 'Incident Prevention',
                action: 'Historical pattern shows incident risk. Increase monitoring and have rollback plan ready.'
            });
        }

        return recommendations;
    }

    // Save predictions to file
    async savePredictions() {
        const outputPath = path.join(__dirname, '..', 'analysis', `health-predictions-${Date.now()}.json`);
        await fs.writeFile(outputPath, JSON.stringify(this.predictions, null, 2));
        console.log(`\n✅ Predictions saved to: ${outputPath}`);
        return outputPath;
    }

    // Generate visual report
    generateReport() {
        console.log('\n📈 Release Health Prediction Report');
        console.log('=' .repeat(50));
        
        this.predictions.upcomingReleases.forEach(release => {
            console.log(`\n🚀 Release: ${release.version}`);
            console.log(`   Status: ${release.status}`);
            console.log(`   Predicted Health Score: ${release.predictedHealthScore}/100`);
            console.log(`   Risk Level: ${release.riskLevel}`);
            
            if (release.recommendations.length > 0) {
                console.log('   📋 Recommendations:');
                release.recommendations.forEach(rec => {
                    console.log(`      - [${rec.type.toUpperCase()}] ${rec.action}`);
                });
            }
        });

        if (this.predictions.trends.insights.length > 0) {
            console.log('\n📊 Trend Insights:');
            this.predictions.trends.insights.forEach(insight => {
                console.log(`   ${insight}`);
            });
        }
    }
}

// Main execution
async function main() {
    const predictor = new ReleaseHealthPredictor();
    
    await predictor.fetchHistoricalData();
    await predictor.generatePredictions();
    await predictor.savePredictions();
    predictor.generateReport();
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = { ReleaseHealthPredictor };