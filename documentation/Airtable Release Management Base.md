# **Airtable Release Management Base**

This document outlines the table structure, automation systems, and interface design for the new 7-table Airtable Release Management base.

## **Table Schemas**

### **1\. Releases (Sync Table)**

This table consolidates data from three sources in the Release Ops base: Deploys, Build Milestones, and Build Phases.

**Sync Sources:**

* Deploys table  
* Build Milestones table  
* Build Phases table

**Custom Fields:**

* **Build Version (Unified)** (Formula): Consolidates version information from the source tables.  
* **Release Type** (Single Select): Options: Major Release, Hotfix, 1P Publish, MCP, Server, DAD Hotfix, Integration, Encryption Key Delivery  
* **Release Status** (Single Select): Options: To Do, In Progress, Complete, Sunset

**Synced Fields:**

| Field Name | Field Type | Source Table | Notes |
| :---- | :---- | :---- | :---- |
| Release Name | Single Line Text | Deploys | Primary identifier for the release. |
| Product | Single Line Text | Deploys | e.g., "Fortnite" \- enables Product filtering |
| Season | Single Line Text | Deploys | e.g., "28.00", "29.00" |
| Launch Date | Date | Deploys | Launch date from the Launch (lookup) field. |
| Start Date | Date | Deploys |  |
| Status | Single Select | Deploys |  |
| Notes | Long Text | Deploys |  |
| Milestone Name | Single Line Text | Build Milestones |  |
| Milestone Type | Single Select | Build Milestones |  |
| Milestone Due Date | Date | Build Milestones |  |
| Phase Name | Single Line Text | Build Phases |  |
| Phase Status | Single Select | Build Phases |  |
| Phase Start Date | Date | Build Phases |  |
| Phase End Date | Date | Build Phases |  |

---

### **2\. Jira (Sync Table)**

This table consolidates Jira tickets from REAL and ERM projects only (deploys, integrations, hotfixes, whitegloves, etc.). SHI tickets are handled separately in the ShitHappens table.

**Sync Sources:** JIRA JQL Filters

* **REAL Sync**: project \= REAL ORDER BY created DESC (\< 10K records)  
* **ERM Sync**: project \= ERM ORDER BY created DESC (\< 10K records)

**Custom Fields:**

* **Calculated Status** (Formula): Maps JIRA status to simplified values  
* **Days Since Created** (Formula): DATETIME\_DIFF(NOW(), Created, 'days')  
* **Release Quarter** (Formula): Extracts quarter from Fix Version

**Synced Fields:**

| Field Name | Field Type | JIRA Field | Notes |
| :---- | :---- | :---- | :---- |
| Key | Single Line Text | key | e.g., "REAL-5336", "ERM-25754" |
| Summary | Single Line Text | summary | Ticket title/summary |
| Description | Long Text | description | Full ticket description |
| Status | Single Select | status.name | Options: "New", "In Progress", "Done", "Resolved" |
| Issue Type | Single Select | issuetype.name | Options: "Release Request", "Bug", "Story", "Task" |
| Reporter | Single Line Text | reporter.displayName | Person who created the ticket |
| Assignee | Single Line Text | assignee.displayName | Current assignee (can be empty) |
| Creator | Single Line Text | creator.displayName | Original ticket creator |
| Created | Date/Time | created | Ticket creation timestamp |
| Updated | Date/Time | updated | Last update timestamp |
| Resolved Date | Date/Time | resolutiondate | When ticket was resolved |
| Resolution | Single Select | resolution.name | Options: "Done", "Won't Do", "Duplicate" |
| Fix Version | Single Line Text | fixVersions\[0\].name | Target release version (e.g., "36.00", "35.20") |
| Priority | Single Select | priority.name | Options: "1 \- Critical", "2 \- High", "3 \- Medium", "4 \- Low" |
| Labels | Multiple Select | labels | Ticket labels/tags |
| Project Key | Single Line Text | project.key | "REAL" or "ERM" |
| Project Name | Single Line Text | project.name | "Release Management" or "Epic Release Management" |
| Due Date | Date | duedate | Optional due date |
| **Deploy Date** | Date/Time | customfield\_15700 | "Due Date w/ Time" \- scheduled deploy time |
| **Deploy Type** | Multiple Select | customfield\_21120 | Options: "1P Publish", "MCP", "Server", "Major Release" |
| **Build Info** | Long Text | customfield\_15002 | "Build Info / Patch Sizes" \- version and patch details |
| **Definition of Done** | Long Text | customfield\_15800 | Checklist items as JSON array |
| **SH Incident Link** | URL | customfield\_19301 | Link to Shit Happens incident tool |
| **Notifications** | Long Text | customfield\_11936 | Who needs to be alerted during changes |
| **Testing Performed** | Long Text | customfield\_26574 | QA testing details |
| **Community Impact** | Single Select | customfield\_15903 | Impact assessment for community |
| **Live Issue** | Single Select | customfield\_15113 | Whether this affects live production |
| **Issue Links** | Long Text | issuelinks | JSON of linked tickets (clones, mentions, etc.) |

---

### **3\. ShitHappens (Sync Table)**

This table syncs specifically with SHI project JIRA tickets for incident management. Kept separate to enable future integration with the internal ShitHappens tool API.

**Sync Source:** JIRA JQL Filter

* **SHI Sync**: project \= SHI ORDER BY created DESC (\< 10K records)

**Synced Fields:**

| Field Name | Field Type | JIRA Field | Notes |
| :---- | :---- | :---- | :---- |
| Key | Single Line Text | key | e.g., "SHI-4598" |
| Summary | Single Line Text | summary |  |
| Description | Long Text | description |  |
| Status | Single Select | status.name |  |
| Reporter | Single Line Text | reporter.displayName |  |
| Assignee | Single Line Text | assignee.displayName |  |
| Created | Date | created |  |
| Updated | Date | updated |  |
| Resolution | Single Select | resolution.name |  |
| Priority | Single Select | priority.name |  |
| SH Incident Link | URL | customfield\_19301 |  |
| Captain | Single Line Text | customfield\_22700.displayName |  |

---

### **4\. Reports (Non-Sync Table)**

This table consolidates report generation and management. Currently exists as "Generated Reports" but can be expanded for multiuse.

**Current Schema (Generated Reports):**

| Field Name | Field Type | Notes |
| :---- | :---- | :---- |
| Name | Single Line Text | Primary identifier for the report. |
| Report Content | Long Text | Generated report content. |
| Version Covered | Single Line Text | Release version scope (e.g., "35.10"). |
| Generated Date | Date/Time | When the report was created. |
| Report Data JSON | Long Text | Structured data used for report generation. |
| Overall Score Numeric | Number | Calculated score/rating for the report. |
| Script | Single Line Text | Reference to the generating script. |

**Proposed Enhanced Schema (Multiuse):**

| Field Name | Field Type | Notes |
| :---- | :---- | :---- |
| Name | Single Line Text | Primary identifier for the report. |
| Report Type | Single Select | "Version Report", "Slack Canvas", "Weekly Summary", "Custom" |
| Content | Long Text | Report content (Markdown/text). |
| Content JSON | Long Text | Structured data payload. |
| Version Covered | Single Line Text | Release version scope (optional). |
| Source | URL | Link to source data (optional). |
| Generated Date | Date/Time | Creation timestamp. |
| Score/Rating | Number | Calculated metrics (optional). |
| Automation Status | Single Select | "Generated", "Manual", "Error" |
| Script Reference | Single Line Text | Generating script/automation. |
| Owner | User | Report creator/owner. |

---

### **5\. Slack (Non-Sync Table)**

This table consolidates Slack-related data and automation. Currently exists as "Slack Canvases" but should be expanded for multiuse.

**Current Schema (Slack Canvases):**

| Field Name | Field Type | Notes |
| :---- | :---- | :---- |
| Canvas ID | Single Line Text | Unique Slack canvas identifier. |
| Canvas Title | Single Line Text | Canvas title/name. |
| Associated Channel/DM | Single Line Text | Source channel (e.g., "\#release-submissions"). |
| Canvas Link | URL | Direct link to the canvas. |
| Canvas Content (Raw) | Long Text | Raw HTML/text content. |
| Canvas Content (Rendered) | Long Text | Processed Markdown content. |
| Status | Single Select | Processing status. |

**Proposed Enhanced Schema (Multiuse):**

| Field Name | Field Type | Notes |
| :---- | :---- | :---- |
| Name | Single Line Text | Primary identifier. |
| Slack Type | Single Select | "Canvas", "Message", "Thread", "Scheduled Post" |
| Slack ID | Single Line Text | Unique Slack identifier (canvas ID, message ID, etc.). |
| Channel/DM | Single Line Text | Target or source channel. |
| Link | URL | Direct link to Slack content. |
| Content (Raw) | Long Text | Raw content from Slack. |
| Content (Rendered) | Long Text | Processed/formatted content. |
| Scheduled Time | Date/Time | For scheduled messages (optional). |
| Status | Single Select | "Draft", "Scheduled", "Sent", "Fetched", "Error" |
| Automation Type | Single Select | "Canvas Sync", "Message Scheduling", "Thread Tracking" |
| Owner | User | Content owner/creator. |
| Last Updated | Date/Time | Last sync/update timestamp. |

---

### **6\. Tasks (Non-Sync Table)**

This table manages tasks and projects, replacing Google Sheets checklists. Also handles vendor certification tracking via filtering.

| Field Name | Field Type | Notes |
| :---- | :---- | :---- |
| Task Name | Single Line Text | Primary identifier for the task. |
| Project | Single Line Text |  |
| Sub-Team | Single Select | e.g., "Release Ops", "Dev", "QA", "Release Submissions" |
| Status | Single Select | "To Do", "In Progress", "Done" |
| Due Date | Date |  |
| Owner | User |  |
| Intake Source | Single Select | "Airtable Form", "Slack Workflow" |
| Task Type | Single Select | "General", "Certification", "Checklist Item" |
| Notes | Long Text |  |

---

### **7\. Data (Non-Sync Table)**

This table consolidates external data integration. Currently exists as "Grafana Data" but should be expanded for multiuse.

**Current Schema (Grafana Data):**

| Field Name | Field Type | Notes |
| :---- | :---- | :---- |
| Name | Single Line Text | Data point identifier. |
| Data Type | Single Select | Type of metric (e.g., "Changelist Commits"). |
| Platform/Server | Single Select | Source platform identifier. |
| Metric Name | Single Line Text | Specific metric being tracked. |
| Caption Point | Single Line Text | Milestone/period identifier. |
| Stream | Single Line Text | Code stream path (e.g., "//Fortnite/Release-35.10"). |
| Value | Number | Metric value. |
| Baseline | Number | Baseline comparison value. |
| Timestamp | Date/Time | Data collection timestamp. |
| Delta | Number | Calculated change from baseline. |
| Raw JSON | Long Text | Full data payload from source. |

**Proposed Enhanced Schema (Multiuse):**

| Field Name | Field Type | Notes |
| :---- | :---- | :---- |
| Name | Single Line Text | Data point identifier. |
| Data Source | Single Select | "Grafana", "New Relic", "JIRA", "Slack", "Custom API" |
| Data Type | Single Select | "Metrics", "Logs", "Events", "Analytics" |
| Metric Name | Single Line Text | Specific metric being tracked. |
| Category | Single Line Text | Grouping field (version, milestone, stream, etc.). |
| Value | Number | Primary metric value. |
| Secondary Value | Number | Comparison/baseline value (optional). |
| Timestamp | Date/Time | Data collection timestamp. |
| Metadata | Long Text | Additional context (stream, platform, etc.). |
| Raw Data | Long Text | Full JSON payload from source. |
| Processing Status | Single Select | "Raw", "Processed", "Analyzed", "Error" |
| Notes | Long Text | Manual annotations. |

---

## **Automation Systems**

The base includes 14+ automation scripts that handle data processing, external integrations, and workflow automation:

### **Slack Integration Scripts**

* **release-base-slack-canvas-to-airtable.js**: Fetches and converts Slack canvas content to Markdown, syncing from channels like \#release-submissions, \#fortnite-daily, and \#release-ops  
* **release-base-slack-scheduling.js**: Automated Slack message scheduling supporting milestone-based, recurring, and one-time message types with 90-day lookahead

### **JIRA Data Processing Scripts**

* **release-base-builds-linked-deploys.js**: Links build records to deploy information  
* **release-base-builds-linked-integrations.js**: Connects builds with integration requests  
* **release-base-builds-linked-milestones.js**: Associates builds with milestone data  
* **release-base-hotfixes-populate-linked-builds.js**: Populates hotfix relationships  
* **release-base-integrations-table-populate-linked-builds.js**: Links integration table records to builds  
* **release-base-shithappens-populate-linked-builds.js**: Connects incident records to builds

### **External Data Integration**

* **release-base-grafana-commits.js**: Processes Grafana commit data via Workato webhook for changelist metrics by milestone period  
* **release-base-version-report.js**: Generates comprehensive version status reports  
* **release-base-task-report.js**: Creates task summaries and status reports

### **Data Management & Processing**

* **release-base-builds-next-version.js**: Calculates next version logic for builds  
* **release-base-version-chapter-filters.js**: Applies version-based filtering logic  
* **release-base-version-report-cleanup.js**: Maintains data hygiene for reports

### **Migration Path**

As Slack automation matures, manual communication tasks in release checklists will be systematically replaced with automated workflows managed through the Slack table.

---

## **Interface Layout & Design**

The Airtable interface is organized into specialized sections serving different teams and workflows:

### **Section: General**

#### **Page: Overview (Dashboard)**

* **Type**: Dashboard  
* **Purpose**: Landing page with high-level release status  
* **Features**:  
  * Sync with Fortnite Daily Status canvas  
  * Key metrics and alerts  
  * Quick navigation to other sections

#### **Page: Release Calendar (Timeline)**

* **Type**: Timeline/Calendar View  
* **Purpose**: Visual timeline of all upcoming releases  
* **Data Sources**: Releases table (milestone dates, launch dates)  
* **Features**:  
  * Multi-product view  
  * Milestone tracking  
  * Dependency visualization

#### **Page: Team Capacity (Dashboard)**

* **Type**: Dashboard  
* **Purpose**: Resource allocation and availability tracking  
* **Integration**: Google Sheets "Release Team Support" for time-off tracking  
* **Features**:  
  * Team availability calendar  
  * Workload distribution  
  * Resource planning

---

### **Section: Release Production**

#### **Page: Release Dashboard (Dashboard)**

* **Type**: Dashboard  
* **Purpose**: Central hub for production teams  
* **Key Filters**:  
  * **Build Version**: Filter by specific release versions  
  * **Product**: Filter by Fortnite, other products  
* **Features**:  
  * Issue triage visuals  
  * Integration approval statuses  
  * Allowlist requests overview  
  * Quick resource links (Jira, Slack, Google Sheets)  
  * Multi-version workflow support

#### **Page: Tasks (Kanban/Grid)**

* **Type**: Kanban Board / Grid View  
* **Data Source**: Tasks table  
* **Features**:  
  * Task, Status, Assignee, Dependencies  
  * Milestone-specific filtering  
  * Release checklist subteam tasks  
  * Automated task creation from templates

#### **Page: Integrations (List/Grid)**

* **Type**: List/Grid View  
* **Data Source**: Jira table (filtered for integrations)  
* **Features**:  
  * Approval tracking and status updates  
  * Automated notifications  
  * Integration request processing

#### **Page: Allowlist Management (Dashboard/Record Review)**

* **Type**: Hybrid Dashboard/Record Review  
* **Features**:  
  * Temporary allowlist tracking  
  * Permanent allowlist approvals  
  * Automated notifications workflow

---

### **Section: Release Submissions**

#### **Page: Certification Tracker (Dashboard)**

* **Type**: Dashboard  
* **Data Source**: Tasks table (filtered by Task Type \= "Certification")  
* **Features**:  
  * Vendor certification status cards  
  * Automated updates via Slack integration  
  * Integration with pinned threads in release channels (\#fn-release-36-00-ext)

#### **Page: Tasks (Kanban/Grid)**

* **Type**: Kanban Board / Grid View  
* **Data Source**: Tasks table (filtered by Sub-Team \= "Release Submissions")  
* **Features**:  
  * Vendor-specific checklist tasks  
  * Assignee and deadline tracking  
  * Release checklist subteam tasks

---

### **Section: Release Operations**

#### **Page: Live Dashboard (Dashboard)**

* **Type**: Dashboard  
* **Data Sources**: Multiple (Releases, Data, Jira, ShitHappens)  
* **Features**:  
  * Enhanced deploy tracker  
  * **Grafana metrics integration**:  
    * Changelist commits by milestone period  
    * Server stability metrics (automates Deploy Tracker stability tab)  
  * Incident and change request logs  
  * Real-time status updates

#### **Page: Build Health (Dashboard)**

* **Type**: Dashboard  
* **Data Source**: Data table (Grafana metrics)  
* **Features**:  
  * Predictive analytics and metrics  
  * Health scores for deploy stability  
  * Automated stability tracking  
  * Performance trending

#### **Page: Efficiency & Automation (Dashboard)**

* **Type**: Dashboard  
* **Features**:  
  * Automation impact summaries  
  * Efficiency metrics  
  * Process optimization tracking

#### **Page: Tasks (Kanban/Grid)**

* **Type**: Kanban Board / Grid View  
* **Data Source**: Tasks table (filtered by Sub-Team \= "Release Ops")  
* **Features**:  
  * Operational task management  
  * Real-time updates and tracking  
  * Run of Show tasks  
  * Release checklist subteam tasks

---

### **Section: Dashboards & Reporting**

#### **Page: Report Creator (Form & Script Integration)**

* **Type**: Form with Script Backend  
* **Features**:  
  * Interactive form-based report generation  
  * Airtable scripting integration  
  * Custom parameter input  
  * Automated report scheduling

#### **Page: Report Viewer (Report Viewer)**

* **Type**: Report Display Interface  
* **Data Source**: Reports table  
* **Features**:  
  * Visualization of Markdown/JSON reports  
  * Filtering and export capabilities  
  * Historical report access

#### **Additional Dashboard Pages**

* **Releases Dashboard**: Release-specific metrics and status  
* **Integrations Dashboard**: Integration approval workflows  
* **ShitHappens Dashboard**: Incident management and resolution tracking  
* **Products Dashboard**: Multi-product release coordination  
* **Components Dashboard**: Component-level status and dependencies

---

### **Key Interface Features**

#### **Cross-Section Functionality**

* **Universal Filtering**: Build version and product filters available across all relevant pages  
* **Role-Based Views**: Customized layouts for different team roles  
* **Mobile Optimization**: Key views optimized for mobile access  
* **Real-Time Updates**: Live data refresh across all dashboards

#### **Automation Integration**

* **Notification Triggers**: Status change alerts and escalations  
* **Workflow Automation**: Task creation, assignment, and completion tracking  
* **External Tool Integration**: Seamless connection to Slack, JIRA, Grafana, Google Sheets

#### **Data Flow Architecture**

* **Sync Tables**: Real-time data from JIRA and Release Ops base  
* **Processing Scripts**: Automated data enrichment and relationship building  
* **Reporting Engine**: Automated report generation and distribution  
* **Analytics Layer**: Metrics calculation and trend analysis

This interface design provides a comprehensive, role-based workflow management system that scales across multiple products and release cycles while maintaining data integrity and automation efficiency.

