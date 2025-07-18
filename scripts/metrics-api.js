//======================================================================================================================
// Release Metrics API Server
// Purpose: Provides REST API endpoints for dashboard and external integrations
//======================================================================================================================

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

class ReleaseMetricsAPI {
    constructor(airtableConfig) {
        this.app = express();
        this.airtableConfig = airtableConfig;
        this.setupMiddleware();
        this.setupRoutes();
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    setupMiddleware() {
        // CORS
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
            credentials: true
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
            message: 'Too many requests from this IP'
        });
        this.app.use(limiter);

        // JSON parsing
        this.app.use(express.json());

        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });

        // Get all available versions
        this.app.get('/api/versions', this.handleGetVersions.bind(this));

        // Get metrics for specific version
        this.app.get('/api/metrics/:version', this.handleGetMetrics.bind(this));

        // Get dashboard data for specific version
        this.app.get('/api/dashboard/:version', this.handleGetDashboard.bind(this));

        // Get historical trends
        this.app.get('/api/trends/:version', this.handleGetTrends.bind(this));

        // Get real-time alerts
        this.app.get('/api/alerts/:version', this.handleGetAlerts.bind(this));

        // Get summary statistics
        this.app.get('/api/summary/:version', this.handleGetSummary.bind(this));

        // Webhook endpoint for Airtable updates
        this.app.post('/api/webhook/airtable', this.handleAirtableWebhook.bind(this));

        // Error handling
        this.app.use(this.errorHandler.bind(this));
    }

    async handleGetVersions(req, res) {
        try {
            const cacheKey = 'versions';
            const cached = this.getFromCache(cacheKey);
            if (cached) return res.json(cached);

            // Fetch available versions from Builds table
            const versions = await this.fetchAvailableVersions();
            this.setCache(cacheKey, versions);
            
            res.json(versions);
        } catch (error) {
            this.handleError(res, error, 'Failed to fetch versions');
        }
    }

    async handleGetMetrics(req, res) {
        try {
            const { version } = req.params;
            const cacheKey = `metrics_${version}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return res.json(cached);

            const metrics = await this.calculateVersionMetrics(version);
            this.setCache(cacheKey, metrics);
            
            res.json(metrics);
        } catch (error) {
            this.handleError(res, error, 'Failed to fetch metrics');
        }
    }

    async handleGetDashboard(req, res) {
        try {
            const { version } = req.params;
            const includeHistorical = req.query.historical !== 'false';
            
            const cacheKey = `dashboard_${version}_${includeHistorical}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return res.json(cached);

            const dashboardData = await this.generateDashboardData(version, includeHistorical);
            this.setCache(cacheKey, dashboardData);
            
            res.json(dashboardData);
        } catch (error) {
            this.handleError(res, error, 'Failed to fetch dashboard data');
        }
    }

    async handleGetTrends(req, res) {
        try {
            const { version } = req.params;
            const periods = parseInt(req.query.periods) || 5;
            
            const cacheKey = `trends_${version}_${periods}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return res.json(cached);

            const trends = await this.calculateTrends(version, periods);
            this.setCache(cacheKey, trends);
            
            res.json(trends);
        } catch (error) {
            this.handleError(res, error, 'Failed to fetch trends');
        }
    }

    async handleGetAlerts(req, res) {
        try {
            const { version } = req.params;
            const severity = req.query.severity || 'all';
            
            const cacheKey = `alerts_${version}_${severity}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return res.json(cached);

            const alerts = await this.generateAlerts(version, severity);
            this.setCache(cacheKey, alerts);
            
            res.json(alerts);
        } catch (error) {
            this.handleError(res, error, 'Failed to fetch alerts');
        }
    }

    async handleGetSummary(req, res) {
        try {
            const { version } = req.params;
            const cacheKey = `summary_${version}`;
            const cached = this.getFromCache(cacheKey);
            if (cached) return res.json(cached);

            const summary = await this.generateSummary(version);
            this.setCache(cacheKey, summary);
            
            res.json(summary);
        } catch (error) {
            this.handleError(res, error, 'Failed to fetch summary');
        }
    }

    async handleAirtableWebhook(req, res) {
        try {
            const { table, recordId, action } = req.body;
            
            // Invalidate relevant cache entries
            this.invalidateCache(table);
            
            // Process webhook (could trigger real-time updates)
            console.log(`Airtable webhook: ${action} on ${table} record ${recordId}`);
            
            res.json({ status: 'processed', timestamp: new Date().toISOString() });
        } catch (error) {
            this.handleError(res, error, 'Failed to process webhook');
        }
    }

    // Core data fetching methods (would integrate with existing Airtable code)
    async fetchAvailableVersions() {
        // This would use your existing Airtable integration
        return {
            versions: [
                { version: '36.30', status: 'Live', releaseDate: '2025-07-18' },
                { version: '36.20', status: 'Sunset', releaseDate: '2025-07-04' },
                { version: '36.10', status: 'Sunset', releaseDate: '2025-06-20' },
                { version: '36.00', status: 'Sunset', releaseDate: '2025-06-06' },
                { version: '35.30', status: 'Sunset', releaseDate: '2025-05-23' }
            ],
            current: '36.30',
            next: '36.40'
        };
    }

    async calculateVersionMetrics(version) {
        // This would integrate with your enhanced version report script
        return {
            version: version,
            healthScore: {
                overall: 85,
                breakdown: {
                    deployStability: 78,
                    integrationEfficiency: 82,
                    incidentSeverity: 91,
                    qaVerification: 88,
                    timelineAdherence: 75,
                    hotfixUrgency: 85
                }
            },
            lastUpdated: new Date().toISOString()
        };
    }

    async generateDashboardData(version, includeHistorical) {
        const metrics = await this.calculateVersionMetrics(version);
        const summary = await this.generateSummary(version);
        const alerts = await this.generateAlerts(version);
        
        let trends = null;
        if (includeHistorical) {
            trends = await this.calculateTrends(version, 5);
        }

        return {
            version: version,
            metrics: metrics,
            summary: summary,
            alerts: alerts,
            trends: trends,
            timestamp: new Date().toISOString()
        };
    }

    async calculateTrends(version, periods) {
        // This would calculate historical trends
        return {
            healthScores: [78, 82, 85, 88, 85],
            deployStability: [70, 75, 78, 80, 78],
            integrationEfficiency: [75, 78, 82, 85, 82],
            labels: ['35.30', '36.00', '36.10', '36.20', '36.30'],
            period: periods
        };
    }

    async generateAlerts(version, severity = 'all') {
        const alerts = [
            {
                id: 'alert_001',
                level: 'warning',
                category: 'Timeline',
                message: 'Timeline adherence below target for current release',
                action: 'Review milestone planning and resource allocation',
                timestamp: new Date().toISOString(),
                version: version
            },
            {
                id: 'alert_002',
                level: 'info',
                category: 'Integration',
                message: 'Integration efficiency showing positive trend',
                action: 'Continue current integration practices',
                timestamp: new Date().toISOString(),
                version: version
            }
        ];

        if (severity !== 'all') {
            return alerts.filter(alert => alert.level === severity);
        }

        return alerts;
    }

    async generateSummary(version) {
        return {
            version: version,
            totalBuilds: 34,
            totalHotfixes: 87,
            totalIntegrations: 156,
            totalIncidents: 12,
            rqaItems: 28,
            lastUpdated: new Date().toISOString()
        };
    }

    // Cache management
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        return null;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    invalidateCache(pattern) {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    // Error handling
    handleError(res, error, message) {
        console.error(`API Error: ${message}`, error);
        res.status(500).json({
            error: message,
            timestamp: new Date().toISOString()
        });
    }

    errorHandler(error, req, res, next) {
        console.error('Unhandled error:', error);
        res.status(500).json({
            error: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    }

    // Start server
    start(port = 3001) {
        this.app.listen(port, () => {
            console.log(`Release Metrics API server running on port ${port}`);
            console.log(`Health check: http://localhost:${port}/health`);
            console.log(`API endpoints: http://localhost:${port}/api/`);
        });
    }
}

// Usage example
if (require.main === module) {
    const airtableConfig = {
        // Your Airtable configuration
        baseId: process.env.AIRTABLE_BASE_ID,
        apiKey: process.env.AIRTABLE_API_KEY
    };

    const api = new ReleaseMetricsAPI(airtableConfig);
    api.start(process.env.PORT || 3001);
}

module.exports = ReleaseMetricsAPI;