Project: TwinChain
Digital Twin Control Tower for End-to-End Supply Chain Management

System Overview
The system is a web-based Digital Twin Control Tower that represents real-world supply chain operations including orders, inventory, warehouses, shipments, carriers, SLAs, exceptions, and returns. It provides real-time visibility, prediction, and operational control through a centralized dashboard.

Core Objectives
- Centralized control tower dashboard
- Real-time tracking of orders, inventory, shipments, and returns
- ETA prediction and SLA breach detection
- Exception handling for delays, damage, and loss
- End-to-end lifecycle support including reverse logistics
- Role-based access for different stakeholders

Functional Scope
- Order lifecycle management
- Multi-warehouse inventory tracking and allocation
- Shipment creation, routing, and live tracking
- SLA definition, monitoring, and penalty calculation
- ETA prediction and delay risk analysis
- Exception and incident management
- Returns and reverse logistics
- Analytics and reporting

System Modules

User & Access Management (RBAC)
- Secure authentication using token-based auth
- Role-based access for Admin, Operations, Warehouse, Carrier, Finance
- User activity logging for audit

Master Data Management (MDM)
- Warehouse master data
- Carrier master data
- Product and SKU data
- Routes and lanes
- SLA policies
- Cost and rate cards

Order Management System (OMS)
- Order creation and validation
- Order prioritization (standard, express, bulk)
- Order splitting across warehouses
- Order status tracking

Inventory & Warehouse Management (IWMS)
- Real-time multi-warehouse inventory tracking
- Stock reservation and release
- Inventory allocation based on SLA, cost, or proximity
- Pick, pack, ship workflows

Shipment & Carrier Integration
- Shipment creation and labeling
- Carrier assignment
- Real-time shipment events
- Interactive shipment timeline and tracking

SLA Management Engine
- SLA rules by region, carrier, or service type
- Automated SLA start/stop triggers
- SLA breach detection
- Penalty and performance calculation

ETA Prediction & Delay Risk Engine
- ETA calculation using historical and real-time data
- Delay risk levels: Low, Medium, High
- Early warning alerts for potential SLA violations

Exception & Incident Management
- Detection of delay, damage, or loss
- Automatic exception ticket creation
- Resolution workflows (rerouting, escalation)
- Root cause tagging

Returns & Reverse Logistics
- Return request initiation
- Pickup scheduling
- Warehouse inspection
- Refund or replacement processing

Analytics & Control Tower Dashboard
- Live shipment tracking map
- SLA breach dashboards and heatmaps
- Warehouse utilization metrics
- Carrier performance analytics
- Predictive delay and operational risk insights

Alerting & Notification
- Rule-based alerts on SLA and operational thresholds
- In-app, email, and SMS notifications
- Role-based alert routing

Data Integration & Event Ingestion
- Integration with ERP, WMS, TMS, carrier systems
- API, event-driven, and file-based ingestion
- Data normalization and validation
- Near real-time sync between physical and digital systems

Technology Stack
Frontend: React.js, TypeScript
Backend: Node.js, Express.js
Database: PostgreSQL
Cache & Job Queue: Redis with BullMQ
Maps & Routing: MapLibre, OSRM (Self-hosted)
Containerization: Docker
Version Control: Git
Development Tools: VS Code
Operating System: Windows / Linux / macOS
