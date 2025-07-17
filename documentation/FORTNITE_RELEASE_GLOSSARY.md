# Fortnite Release Management - Data Dictionary

## Overview
This document defines the tables, fields, and terminology used in the Fortnite Release Management Airtable base for Epic Games' Fortnite.

## Core Concepts

### Release vs Build
- **Build/Release**: Same thing - refers to a Fortnite game release
- **Release Version**: Format is ##.## (e.g., 30.00, 29.40)
- **HF Versions**: (e.g., 30.00 HF1) are hotfix bundles, NOT tracked as builds/releases

### Deploy Types
- **Major Release**: Scheduled major release that aligns with Live Date
- **Client Emergency Patch (CEP)**: Emergency client-side fixes
- **Server Deploy**: Server-only deployment
- **MCP Deploy**: MCP (Matchmaking/Content Platform) deployment

## Release Milestones
- **HL Date**: Hard Lock - code freeze for major features
- **PD Date**: Pencils Down - final code freeze
- **Cert Sub Date**: Certification Submission - when build is sent to platform publishers (Sony, Microsoft, etc.) for approval
- **Live Date**: When the release goes live to players

## Tables

### 1. Builds (Primary release tracking)
**Purpose**: Core table tracking Fortnite releases from development to live
**Key Fields**:
- Release Version: Fortnite version number (##.##)
- Build Status (Unified): Current status of the release
- HL Date: Hard Lock milestone
- PD Date: Pencils Down milestone  
- Cert Sub Date: Certification Submission milestone
- Live Date: Release live date
- SH Score: ShitHappens Score (incident severity)
- Release Health Score: Overall health metric
- Deploy Type: Major Release, CEP, Server, MCP

### 2. Release Schedule
**Purpose**: Calendar integration for release events and milestones

### 3. Integrations
**Purpose**: Code integration requests and their lifecycle tracking
**Key Fields**:
- Integration FN Domain: Fortnite domain area
- P4 Streams: Perforce source control streams
- Integration Area: What area of the game
- Integration Platform: Target platform
- HL to PD Flag: Integration happened between Hard Lock and Pencils Down
- PD to Cert Sub Flag: Integration between Pencils Down and Cert Submission
- Live+ Flag: Integration after Live (hotfix)

### 4. Hotfixes
**Purpose**: Emergency fixes and patches tracking
**Key Fields**:
- QA State: Testing status
- Urgency: How urgent the fix is
- Component/s: What game components are affected

### 5. ShitHappens (SH)
**Purpose**: Incident tracking and post-mortem analysis for Fortnite
**Notes**: Internal incident management system
**Key Fields**:
- Severity (Normalized): Incident severity level
- Shithappens Root Cause: What caused the incident
- Pre-SH Flag: If incident occurred before live
- SH Score: Numerical incident impact score

### 6. RQA (Release Quality Assurance)
**Purpose**: Quality assurance and testing tracking

### 7. Release Team
**Purpose**: Team member information and organizational structure

### 8. Open Issues
**Purpose**: Issue tracking and work management
**Key Fields**:
- Planned Work: Work planned for release
- Completed On Time: Work completed on schedule
- Completed Late: Work completed behind schedule
- Open Beyond Hard Lock: Issues still open past HL
- Open Beyond Pencils Down: Issues still open past PD
- All Punted Work: Work moved to future releases

## Common Terms
- **BR**: Battle Royale (core Fortnite game mode)
- **FNE**: Fortnite Entertainment
- **MCP**: Matchmaking/Content Platform
- **Deploy Fallout Score**: Metric measuring deployment issues
- **Integration Score**: Metric measuring integration health
- **P4**: Perforce (source control system)
- **CEP**: Client Emergency Patch

## Release Health Scoring
The system tracks multiple health metrics:
- Release Health Score: Overall release quality
- Deploy Fallout Score: Deployment issues
- Integration Score: Integration quality  
- SH Score: Incident impact score