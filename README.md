# Mini ERP System - From Demand to Delivery

## 📖 Overview

**Mini ERP (Enterprise Resource Planning)** is a centralized business management platform designed to replace disconnected spreadsheets, manual inventory tracking, paper-based manufacturing records, and delayed procurement decisions with a single integrated system.

The application provides end-to-end management of business operations, starting from customer demand and ending with product delivery, while maintaining complete inventory and audit traceability.

> **Core Principle:** Every business operation results in an inventory movement.

---

## 🎯 Business Problem

Many small and medium manufacturing businesses still rely on:

* Microsoft Excel spreadsheets
* WhatsApp communication
* Manual stock registers
* Paper-based manufacturing notes

As the business grows, these practices create operational challenges:

### Sales Challenges

* Orders are created without checking stock availability.
* Deliveries are delayed due to inventory shortages.
* Sales teams have no visibility into available inventory.

### Purchase Challenges

* Raw material shortages are identified too late.
* Vendors receive urgent last-minute purchase requests.
* Procurement planning becomes inefficient.

### Manufacturing Challenges

* Operators do not know what to manufacture next.
* Bill of Materials (BoM) is maintained manually.
* Production work orders are not tracked.

### Inventory Challenges

* No accurate stock balance.
* Raw materials are consumed manually.
* Finished goods inventory is not updated properly.

### Management Challenges

Business owners cannot easily monitor:

* Pending customer orders
* Production delays
* Material shortages
* Manufacturing efficiency
* Overall inventory status

---

## 🚀 Project Objective

The objective of this project is to build a modular ERP platform capable of:

* Product and Inventory Management
* Sales Order Management
* Purchase Order Management
* Manufacturing Management
* Bill of Materials (BoM) Management
* Procurement Automation
* Make To Stock (MTS) Support
* Make To Order (MTO) Support
* Inventory Movement Tracking
* Stock Ledger Management
* Audit Logging
* Dashboard and Analytics
* Role-Based Access Control (RBAC)

---

## 🏗️ System Modules

### 1. Authentication & User Management

* JWT Authentication
* Login / Logout
* Role-Based Authorization (RBAC)
* Module-level access control

#### Supported Roles

| Role               | Responsibility                   |
| ------------------ | -------------------------------- |
| Admin              | Full system access               |
| Sales User         | Manage Sales Orders              |
| Purchase User      | Manage Purchase Orders           |
| Manufacturing User | Manage Manufacturing Orders      |
| Inventory Manager  | Monitor inventory movement       |
| Business Owner     | Product management and dashboard |

---

### 2. Product Management

#### Features

* Create Product
* Update Product
* Product Listing
* Sales Price & Cost Price Management
* Procurement Strategy Configuration
* Vendor Assignment
* Bill of Materials Assignment
* Stock Visibility

#### Product Information

* Product Code (SKU)
* Product Name
* Description
* Product Type (Raw Material / Finished Good)
* Sales Price
* Cost Price
* Procurement Strategy (MTS / MTO)
* Procurement Type (Purchase / Manufacturing)
* Vendor
* Linked BoM

---

### 3. Inventory Management

Inventory is the core module of the ERP system.

#### Inventory Concepts

| Concept              | Description                                      |
| -------------------- | ------------------------------------------------ |
| On Hand Quantity     | Actual physical stock available                  |
| Reserved Quantity    | Stock committed to Sales or Manufacturing Orders |
| Free To Use Quantity | Available stock after reservations               |

**Formula:**

```text
Free To Use Quantity = On Hand Quantity - Reserved Quantity
```

#### Inventory Movements

| Module                    | Inventory Impact   |
| ------------------------- | ------------------ |
| Purchase Receipt          | Increase Stock     |
| Sales Delivery            | Decrease Stock     |
| Manufacturing Consumption | Consume Components |
| Manufacturing Completion  | Add Finished Goods |
| Inventory Adjustment      | Manual Correction  |

---

### 4. Sales Management

#### Features

* Customer Management
* Sales Order Creation
* Multiple Product Selection
* Stock Availability Check
* Inventory Reservation
* Procurement Triggering
* Delivery Management

#### Sales Workflow

```text
Draft
   ↓
Confirmed
   ↓
Partially Delivered
   ↓
Fully Delivered
```

or

```text
Draft
   ↓
Cancelled
```

#### Business Rules

* Confirming a Sales Order reserves inventory.
* If stock is insufficient, procurement is triggered automatically.
* Delivering an order reduces reserved and on-hand quantities.
* Every delivery generates a stock ledger entry.

---

### 5. Purchase Management

#### Features

* Vendor Management
* Purchase Order Creation
* Partial Receipts
* Complete Receipts
* Automatic Stock Update

#### Purchase Workflow

```text
Draft
   ↓
Confirmed
   ↓
Partially Received
   ↓
Fully Received
```

#### Business Rules

* Receiving purchased items increases on-hand inventory.
* Purchase receipts automatically generate stock ledger entries.
* Purchase order status is updated based on received quantity.

---

### 6. Bill of Materials (BoM)

A Bill of Materials defines:

* Components required
* Quantity of each component
* Manufacturing operations required

### Example BoM

#### Finished Product

**Wooden Table**

| Component   | Quantity |
| ----------- | -------- |
| Wooden Legs | 4        |
| Wooden Top  | 1        |
| Screws      | 12       |

#### Operations

| Operation | Duration |
| --------- | -------- |
| Assembly  | 60 mins  |
| Painting  | 30 mins  |
| Packing   | 20 mins  |

---

### 7. Manufacturing Management

#### Manufacturing Order (MO)

A Manufacturing Order contains:

* Finished Product
* Quantity to Produce
* BoM Reference
* Required Components
* Work Orders
* Assigned User
* Status

#### Work Orders

Each manufacturing operation becomes an individual work order.

Examples:

* Assembly
* Painting
* Packing

#### Work Centers

Physical locations where work orders are executed.

Examples:

* Assembly Line
* Paint Floor
* Packaging Unit

#### Manufacturing Workflow

```text
Create Manufacturing Order
          ↓
Read Bill of Materials
          ↓
Reserve Components
          ↓
Generate Work Orders
          ↓
Execute Operations
          ↓
Consume Raw Materials
          ↓
Produce Finished Goods
          ↓
Update Stock Ledger
```

---

### 8. Procurement Automation

#### Procurement Strategies

### Make To Stock (MTS)

* Products are manufactured or purchased before demand.
* Customer orders are fulfilled directly from inventory.

### Make To Order (MTO)

* Procurement begins only after customer demand exists.
* Shortages automatically generate Manufacturing Orders or Purchase Orders.

#### Procurement Configuration

* Procure on Demand
* Procurement Type
* Default Vendor
* Linked BoM

#### Procurement Logic

```text
IF Available Stock < Ordered Quantity

    Shortage = Ordered Quantity - Available Stock

    IF Procurement Type = MANUFACTURING
        → Auto Create Manufacturing Order

    IF Procurement Type = PURCHASE
        → Auto Create Purchase Order
```

---

### 9. Stock Ledger

Every inventory movement must create a ledger entry.

#### Ledger Events

* Purchase Receipt
* Sales Delivery
* Manufacturing Consumption
* Manufacturing Completion
* Inventory Adjustment

#### Stock Ledger Information

* Product
* Transaction Type
* Reference Module
* Reference ID
* Quantity Before
* Quantity Change
* Quantity After
* Movement Type (IN / OUT)
* User
* Timestamp

---

### 10. Audit Logging

Every important business activity is recorded for traceability.

#### Audit Events

* Product Creation
* Product Updates
* Price Changes
* Status Changes
* Sales Confirmation
* Purchase Confirmation
* Deliveries
* Manufacturing Completion
* Inventory Adjustments

#### Audit Information

* Module Name
* Entity Name
* Entity ID
* Action Type
* Previous Value
* New Value
* User
* Timestamp

---

### 11. Dashboard & Analytics

The dashboard provides a real-time business overview.

#### Dashboard Widgets

* Total Sales Orders
* Pending Deliveries
* Total Purchase Orders
* Partial Purchase Receipts
* Active Manufacturing Orders
* Delayed Manufacturing Orders
* Inventory Alerts
* Material Shortages
* Low Stock Products

---

## 🗄️ Database Architecture

The MySQL schema is defined in:

```text
database/mini_erp_mysql_schema.sql
```

The actual database uses the following table names.

### Authentication, Roles, and Permissions

| Table | Purpose |
| ----- | ------- |
| `roles` | Stores system roles such as admin, sales user, purchase user, manufacturing user, inventory manager, and business owner. |
| `users` | Stores login credentials, profile details, active status, and user ownership references. |
| `user_roles` | Maps users to roles. |
| `modules` | Stores ERP modules such as Sales, Purchase, Manufacturing, Product, Inventory, Dashboard, and User Management. |
| `actions` | Stores permission actions such as view, create, edit, delete, confirm, deliver, receive, and manage users. |
| `module_permissions` | Controls role access at module/action level. |
| `fields` | Stores module fields used for field-level permissions. |
| `field_permissions` | Controls field-level create, view, edit, and delete permissions by role. |

### System Reference

| Table | Purpose |
| ----- | ------- |
| `reference_sequences` | Generates references like `SO-000001`, `PO-000001`, `MO-000001`, `BOM-000001`, and `PROD-000001`. |

### Master Data

| Table | Purpose |
| ----- | ------- |
| `customers` | Stores customer details. |
| `vendors` | Stores vendor details. |
| `products` | Stores product reference, name, price, stock, procurement settings, vendor, and linked BoM. |
| `work_centers` | Stores manufacturing work centers. |

### Bill of Materials

| Table | Purpose |
| ----- | ------- |
| `boms` | Stores BoM header details for finished products. |
| `bom_components` | Stores component products and quantities required by a BoM. |
| `bom_operations` | Stores operations, work centers, expected duration, and sequence for a BoM. |

### Sales

| Table | Purpose |
| ----- | ------- |
| `sales_orders` | Stores sales order header, customer, sales person, status, dates, and lifecycle timestamps. |
| `sales_order_items` | Stores sales order products, ordered quantity, delivered quantity, unit price, and line total. |

### Purchase

| Table | Purpose |
| ----- | ------- |
| `purchase_orders` | Stores purchase order header, vendor, responsible user, status, dates, and optional source sales order. |
| `purchase_order_items` | Stores purchase order products, ordered quantity, received quantity, cost price, and line total. |

### Manufacturing

| Table | Purpose |
| ----- | ------- |
| `manufacturing_orders` | Stores manufacturing order header, finished product, quantity, BoM, assignee, status, and source sales order. |
| `manufacturing_order_components` | Stores required and consumed component quantities for manufacturing orders. |
| `manufacturing_order_work_orders` | Stores manufacturing work orders, work centers, expected duration, real duration, and sequence. |

### Inventory and Traceability

| Table | Purpose |
| ----- | ------- |
| `stock_ledger` | Stores every inventory movement with quantity before, quantity change, quantity after, direction, reference, user, and timestamp. |
| `audit_logs` | Stores create, update, delete, confirm, receive, deliver, produce, cancel, and status-change events. |

### Database View

| View | Purpose |
| ---- | ------- |
| `product_inventory_summary` | Calculates reserved quantity and free-to-use quantity from product stock, sales reservations, and manufacturing component reservations. |

---

## 🔗 Core Business Flow

```text
Customer Order
       ↓
Sales Order
       ↓
Check Inventory
       ↓
+-------------------------------+
| Stock Available ?             |
+-------------------------------+
      ↓ Yes               ↓ No
 Deliver from Stock     Trigger Procurement
      ↓                      ↓
 Update Inventory     Purchase / Manufacture
      ↓                      ↓
 Create Ledger      Receive / Produce Stock
      ↓                      ↓
     Delivery  ←─────────────┘
      ↓
  Audit Log Entry
```

---

## 🛠️ Technology Stack

### Frontend

* React.js
* Tailwind CSS
* Vite
* JavaScript
* Fetch API
* lucide-react icons

### Backend

* Node.js
* Express.js
* MySQL2
* Zod validation
* JWT authentication

### Database

* MySQL

### Authentication

* JWT Token Authentication
* Role-Based Authorization (RBAC)

### Version Control

* Git
* GitHub

---

## 📋 Development Roadmap

### Phase 1

* Database Design
* ER Diagram
* SQL Schema
* Constraints & Indexes

### Phase 2

* Authentication & RBAC

### Phase 3

* Product Module

### Phase 4

* Inventory Module

### Phase 5

* Sales Module

### Phase 6

* Purchase Module

### Phase 7

* Bill of Materials (BoM)

### Phase 8

* Manufacturing Module

### Phase 9

* Procurement Automation

### Phase 10

* Audit Logging

### Phase 11

* Dashboard & Analytics

---

## 🔮 Future Enhancements

* Barcode Scanning
* Multi-Warehouse Support
* Product Categories
* Supplier Rating
* Notifications
* Email Alerts
* Inventory Forecasting
* Reports & Analytics
* Excel / PDF Export

---

## 📌 Important Design Principle

> **Inventory is the heart of the ERP system.**

Every Sales Order, Purchase Receipt, Manufacturing Order, Procurement Action, Manufacturing Completion, and Delivery must generate:

1. An **Inventory Movement**.
2. A **Stock Ledger Entry**.
3. An **Audit Log Entry**.

This ensures complete business traceability from **customer demand to final delivery**.
