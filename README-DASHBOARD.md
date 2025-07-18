# Fortnite Release Dashboard & Reporting System

A comprehensive dashboard and automated reporting system for Fortnite release management, built on top of your existing Airtable data.

## 🚀 Features

### 📊 Release Dashboard
- **Real-time metrics** - Health scores, deploy reliability, integration efficiency
- **Interactive charts** - Trend analysis and component breakdowns  
- **Responsive design** - Works on desktop, tablet, and mobile
- **Version selector** - Compare metrics across different releases
- **Automated alerts** - Real-time notifications for critical issues

### 📈 Enhanced Version Reports
- **Advanced analytics** - Weighted scoring with configurable thresholds
- **Trend analysis** - Multi-release comparison and patterns
- **Actionable insights** - Automated recommendations and alerts
- **Multiple formats** - JSON for APIs, Markdown for humans

### 🔄 Automated Reporting
- **Scheduled reports** - Daily, weekly, pre/post-release cycles
- **Email distribution** - Automated delivery to stakeholders
- **Slack integration** - Real-time notifications
- **Custom templates** - Configurable report formats

### 🌐 REST API
- **Real-time data** - Live metrics and dashboard data
- **Historical trends** - Multi-period analysis
- **Webhook support** - Airtable integration for live updates
- **Rate limiting** - Production-ready API with caching

## 📁 Project Structure

```
dashboard/
├── release-dashboard.html      # Main dashboard interface
├── package.json               # Dependencies and scripts
└── server.js                  # Dashboard server (optional)

scripts/
├── enhanced-version-report.js  # Enhanced analytics engine
├── metrics-api.js             # REST API server
├── automated-reporter.js      # Scheduled reporting system
└── current/
    └── versionreport.js       # Existing version report (working)
```

## 🛠️ Setup & Installation

### Prerequisites
- Node.js 16+ 
- Your existing Airtable configuration
- Email credentials (for automated reports)

### Quick Start

1. **Install dependencies**
   ```bash
   cd dashboard
   npm run setup
   ```

2. **Configure environment variables**
   ```bash
   # Create .env file
   AIRTABLE_BASE_ID=appB6mYCLrK1VkGLg
   AIRTABLE_API_KEY=your_api_key
   
   # Email configuration (optional)
   EMAIL_USER=your_email@epicgames.com
   EMAIL_PASSWORD=your_app_password
   
   # API configuration
   PORT=3001
   ALLOWED_ORIGINS=http://localhost:8000,https://yourdomain.com
   ```

3. **Start the dashboard**
   ```bash
   # Option 1: Simple HTML dashboard
   npm run dashboard
   # Opens at http://localhost:8000
   
   # Option 2: Full API + Dashboard
   npm run api
   # API runs at http://localhost:3001
   ```

## 🎯 Usage

### Dashboard Access
- **URL**: `http://localhost:8000/release-dashboard.html`
- **Features**: 
  - Select version from dropdown
  - View real-time health metrics
  - Interactive trend charts
  - Automated alerts and recommendations

### API Endpoints
```bash
# Get dashboard data
GET /api/dashboard/36.30

# Get specific metrics
GET /api/metrics/36.30

# Get trend analysis
GET /api/trends/36.30?periods=5

# Get real-time alerts
GET /api/alerts/36.30
```

### Automated Reports
```bash
# Start automated reporting
npm run reports

# Generate manual report
node scripts/automated-reporter.js generate weekly 36.30
```

### Enhanced Version Reports
```bash
# Generate enhanced report
npm run enhanced-report 36.30

# Use existing version report
npm run version-report 36.30
```

## 📊 Dashboard Metrics

### Key Performance Indicators
- **Overall Health Score** (0-100)
- **Deploy Reliability** - Planned vs unplanned deployment ratio
- **Integration Efficiency** - Milestone completion rates
- **Incident Rate** - Severity-weighted incident scoring
- **QA Verification** - Hotfix verification coverage
- **Timeline Adherence** - Milestone schedule compliance

### Health Status Levels
- 🟢 **Excellent** (85-100) - Exceeding targets
- 🟡 **Good** (70-84) - Meeting targets  
- 🟠 **Fair** (50-69) - Below targets
- 🔴 **Poor** (0-49) - Critical issues

### Trend Indicators
- ⬆️ **Improving** - Positive trend over time
- ➡️ **Stable** - Consistent performance
- ⬇️ **Declining** - Needs attention

## 🔧 Configuration

### Report Templates
Located in `scripts/automated-reporter.js`, customize:
- **Recipients** - Email distribution lists
- **Schedules** - Cron expressions for timing
- **Sections** - Report content sections
- **Formats** - HTML, PDF, Slack formats

### Scoring Weights
In `scripts/enhanced-version-report.js`:
```javascript
const weights = {
    deployStability: 0.25,      // 25%
    integrationEfficiency: 0.20, // 20%
    incidentSeverity: 0.20,     // 20%
    qaVerification: 0.15,       // 15%
    timelineAdherence: 0.10,    // 10%
    hotfixUrgency: 0.10         // 10%
};
```

### Alert Thresholds
```javascript
SCORING: {
    EXCELLENT_THRESHOLD: 85,
    GOOD_THRESHOLD: 70,
    FAIR_THRESHOLD: 50,
    POOR_THRESHOLD: 30
}
```

## 🔗 Integration with Existing System

### Airtable Data Sources
The dashboard integrates with your existing 6 tables:
- **Builds** - Primary release data (98 fields)
- **Hotfixes** - Issue tracking and QA verification
- **Integrations** - Milestone and phase tracking
- **ShitHappens** - Incident severity analysis
- **RQA** - Quality assurance metrics
- **Generated Reports** - Report storage

### Existing Script Compatibility
- ✅ **Preserves** your working `versionreport.js` (v24.1.0)
- ✅ **Enhances** with additional analytics
- ✅ **Maintains** all existing field mappings
- ✅ **Adds** new capabilities without breaking changes

## 📈 Report Schedules

### Default Schedule
- **Daily Status** - 9 AM weekdays
- **Weekly Report** - 10 AM Mondays  
- **Pre-Release** - 4 PM Thursdays
- **Post-Release** - 11 AM Tuesdays

### Custom Schedules
Modify in `automated-reporter.js`:
```javascript
schedules: {
    daily: '0 9 * * 1-5',      // 9 AM weekdays
    weekly: '0 10 * * 1',       // 10 AM Mondays
    custom: '0 14 * * 3'        // 2 PM Wednesdays
}
```

## 🚨 Monitoring & Alerts

### Automated Alerts
- **Critical health scores** (< 30) - Immediate notification
- **High unplanned deploys** (> 50%) - Process review needed
- **Low QA coverage** (< 70%) - Quality concerns
- **Timeline delays** - Schedule impact warnings

### Alert Channels
- **Email** - Stakeholder notifications
- **Slack** - Real-time team alerts
- **Dashboard** - Visual indicators
- **API** - Integration with other tools

## 🔐 Security & Performance

### API Security
- **Rate limiting** - 100 requests per 15 minutes
- **CORS protection** - Configurable allowed origins
- **Input validation** - Sanitized parameters
- **Error handling** - Graceful failure modes

### Performance Optimization
- **Response caching** - 5-minute cache for API responses
- **Data aggregation** - Pre-computed metrics
- **Lazy loading** - Progressive dashboard loading
- **Mobile optimization** - Responsive design

## 🆘 Troubleshooting

### Common Issues

**Dashboard not loading data**
```bash
# Check API server
curl http://localhost:3001/health

# Verify Airtable connection
node -e "console.log(process.env.AIRTABLE_BASE_ID)"
```

**Email reports not sending**
```bash
# Test email configuration
node scripts/automated-reporter.js test-email

# Check SMTP settings in .env
```

**Charts not displaying**
- Check browser console for JavaScript errors
- Ensure Chart.js CDN is accessible
- Verify data format in API responses

### Debug Mode
```bash
# Enable verbose logging
DEBUG=* npm run api

# Generate test report
node scripts/automated-reporter.js generate daily 36.30 test@epicgames.com
```

## 🚀 Next Steps

### Immediate Actions
1. **Configure** environment variables
2. **Test** dashboard with current data
3. **Customize** report recipients and schedules
4. **Set up** automated reporting

### Enhancement Opportunities
1. **Real-time updates** - WebSocket integration
2. **Advanced analytics** - Machine learning predictions
3. **Mobile app** - Native iOS/Android companion
4. **Slack bot** - Interactive release commands

## 📞 Support

For questions or issues:
- **Documentation**: This README and inline code comments
- **Validation**: All systems tested with existing Airtable data
- **Compatibility**: Maintains existing workflow while adding new capabilities

---

*Built for Epic Games Release Management Team*
*Compatible with existing Fortnite release management processes*