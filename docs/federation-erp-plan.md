# 多租户ERP联邦网络（Multi-Tenant ERP Federation）实施方案

## 一、项目概述

### 1.1 目标
允许多个企业各自部署本ERP系统实例，通过标准化API互联互通，形成供应链协同网络：
- **上游（供应商/大仓库）** 发布产品目录，处理采购订单，发货
- **下游（经销商/中小客户）** 订阅产品，自定义价格后上架到自己前台，自动向上游采购

### 1.2 核心场景
```
上游 ERP 实例 A                        下游 ERP 实例 B
┌──────────────────┐    商品同步      ┌──────────────────┐
│  产品目录         │ ──────────→    │  前台网站          │ ← 终端客户
│  库存管理         │                │  自动上架 + 加价    │
│  订单处理         │   价格策略      │                   │
│  发货/物流        │ ──────────→    │  采购审批          │
│                  │                │                   │
│  收到采购单       │  ← 采购单 ───── │  自动生成PO        │
│  发货 + 状态同步   │ ──────────→    │  收货确认          │
└──────────────────┘    双向同步      └──────────────────┘
```

### 1.3 商业价值
- 经销商无需自建系统，直接使用本ERP下单和管理
- 上游聚合多个下游，统一管理供货和结算
- 下游可对接多个上游，一个订单拆单到不同供应商
- SaaS订阅费 + 交易平台价值

---

## 二、现状分析

### 2.1 当前架构
- Next.js 14 App Router + TypeScript + Prisma + PostgreSQL (Supabase)
- 单租户架构，约40+个Prisma模型，无tenantId
- 认证：NextAuth.js v4（JWT），角色：ADMIN / SALES_REP / WAREHOUSE_MANAGER / CUSTOMER
- 已有Webhook模式：`src/app/api/webhooks/logistics/route.ts`（HMAC-SHA256签名）

### 2.2 可复用的现有模块

| 模块 | 现有实现 | 联邦化复用方式 |
|------|---------|-------------|
| Webhook签名 | logistics webhook HMAC-SHA256 | 联邦API认证直接复用 |
| 角色守卫 | `src/lib/auth-guard.ts` requireRole() | 扩展支持API Key认证 |
| 审计日志 | AuditLog模型 | 联邦操作追踪 |
| 审批流程 | ApprovalRequest模型 | 跨实例PO审批 |
| 多币种 | ExchangeRate + 汇率转换 | 联邦间结算 |
| 价格表 | PriceList + PriceListRule | 客户专属供货价 |
| JSON本地化 | Product.content JSONB | 产品同步无需格式转换 |

### 2.3 需要变更的现有模块

| 文件 | 改动类型 | 具体改动 |
|------|---------|---------|
| `prisma/schema.prisma` | 扩展 | 新增~12个模型，Product新增3个字段 |
| `src/lib/actions/product.ts` | Hook注入 | updateProduct()末尾添加联邦同步通知 |
| `src/lib/actions/sales-order.ts` | Hook注入 | 状态变更后通知联邦对方 |
| `src/lib/actions/purchase-order.ts` | 扩展 | 新增source:'FEDERATION'支持 |
| `src/lib/actions/delivery-order.ts` | Hook注入 | 发货后通知联邦对方 |
| `src/lib/actions/invoice.ts` | Hook注入 | 发票开具后通知联邦对方 |
| `src/lib/pricing.ts` | 扩展 | 联邦产品价格计算（加价/覆盖） |
| `src/lib/services/order-service.ts` | 扩展 | 订单创建后调用路由引擎 |

### 2.4 完全不受影响的模块
- 认证系统 (`src/lib/auth.ts`, `src/middleware.ts`)
- 购物车 (`src/lib/actions/cart.ts`)
- 库存核心逻辑 (`src/lib/inventory.ts`)
- 所有storefront组件
- 国际化配置

---

## 三、架构设计

### 3.1 架构策略：独立实例 + 联邦API

**不采用多租户共享数据库**（改动太大），而是：
- 每个企业运行独立的ERP实例
- 通过标准化REST API + Webhook互联互通
- 引入`FederationNode`模型管理连接关系

### 3.2 认证体系

```
三层认证:
1. 内部用户 → NextAuth JWT（现有，不变）
2. 联邦API  → API Key + HMAC-SHA256 签名（新增）
3. CRON任务 → CRON_SECRET（现有模式）
```

### 3.3 数据安全原则

- 联邦API **绝不** 暴露：用户数据、成本价、利润率、内部备注
- 产品同步只传递：content、specs、images、SKU、建议价格
- 库存只暴露可用量，不暴露物理库存详情
- 订单只传递必要的行项目和金额

---

## 四、数据模型设计

### 4.1 联邦基础模型

```prisma
// ===== 联邦节点 =====
model FederationNode {
  id          String   @id @default(uuid())
  name        String                        // "Acme LED Distributor"
  code        String   @unique              // "ACME-001"
  type        FederationNodeType            // UPSTREAM / DOWNSTREAM

  // 连接信息
  baseUrl     String                        // "https://acme-erp.example.com"
  apiKey      String                        // 出站API Key
  apiSecret   String                        // HMAC签名密钥
  inboundKey  String   @unique              // 对方调我时使用的Key

  // 状态
  status      FederationStatus @default(PENDING)
  lastSyncAt  DateTime?
  lastError   String?

  // 商务条款
  defaultCurrency    String   @default("EUR")
  paymentTermsDays   Int      @default(30)
  creditLimit        Decimal? @db.Decimal(12,2)

  // 关联
  supplierRef   Supplier? @relation(fields: [supplierId], references: [id])
  supplierId    String?   @unique

  channels      SupplyChannel[]
  orders        FederationOrder[]
  syncLogs      FederationSyncLog[]
  settlements   FederationSettlement[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("federation_nodes")
}

enum FederationNodeType {
  UPSTREAM    // 我的供应商
  DOWNSTREAM  // 我的经销商
}

enum FederationStatus {
  PENDING     // 等待确认
  ACTIVE      // 活跃
  SUSPENDED   // 暂停
  REVOKED     // 已撤销
}

// ===== 同步日志 =====
model FederationSyncLog {
  id          String   @id @default(uuid())
  nodeId      String
  node        FederationNode @relation(fields: [nodeId], references: [id])

  direction   String   // "INBOUND" | "OUTBOUND"
  entityType  String   // "PRODUCT" | "ORDER" | "STATUS" | "INVENTORY"
  entityId    String?
  action      String   // "SYNC" | "CREATE" | "UPDATE" | "ACK"
  status      String   // "SUCCESS" | "FAILED" | "RETRY"
  payload     Json?
  errorMsg    String?

  createdAt   DateTime @default(now())

  @@index([nodeId])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("federation_sync_logs")
}
```

### 4.2 供应渠道模型

```prisma
// ===== 供应渠道 =====
model SupplyChannel {
  id          String   @id @default(uuid())
  name        String                        // "LED Panel Range 2026"
  nodeId      String
  node        FederationNode @relation(fields: [nodeId], references: [id])

  isPublished Boolean @default(false)       // 上游是否启用
  isSubscribed Boolean @default(false)      // 下游是否订阅
  autoSync    Boolean @default(true)        // 自动同步新产品
  syncPricing Boolean @default(false)       // 是否同步建议零售价

  products    ChannelProduct[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([nodeId, name])
  @@map("supply_channels")
}

model ChannelProduct {
  id          String   @id @default(uuid())
  channelId   String
  channel     SupplyChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)

  // 上游产品引用
  upstreamProductId  String
  upstreamSku        String

  // 本地产品引用（同步后创建）
  localProductId     String?
  localProduct       Product? @relation(fields: [localProductId], references: [id])

  // 同步元数据
  lastSyncedAt       DateTime?
  syncHash           String?         // 内容hash，增量同步用
  syncStatus         SyncStatus @default(PENDING)

  // 价格覆盖
  priceMarkupPercent Decimal?  @db.Decimal(5,2)
  priceOverride      Decimal?  @db.Decimal(10,2)

  // 内容覆盖
  contentOverride    Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([channelId, upstreamProductId])
  @@index([localProductId])
  @@map("channel_products")
}

enum SyncStatus {
  PENDING     // 待同步
  SYNCED      // 已同步
  MODIFIED    // 下游已修改
  CONFLICT    // 冲突
  DISABLED    // 禁用
}
```

### 4.3 联邦订单模型

```prisma
// ===== 联邦订单 =====
model FederationOrder {
  id              String   @id @default(uuid())

  localOrderId    String?          // 本地SalesOrder.id
  localPOId       String?          // 本地PurchaseOrder.id
  remoteOrderId   String?          // 对方订单ID
  remoteOrderNumber String?        // 对方订单号

  nodeId          String
  node            FederationNode @relation(fields: [nodeId], references: [id])

  direction       String           // "OUTBOUND_PO" | "INBOUND_SO"
  status          FederationOrderStatus @default(PENDING)

  totalAmount     Decimal  @db.Decimal(12,2)
  currency        String   @default("EUR")

  items           FederationOrderItem[]
  statusHistory   FederationOrderStatusHistory[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([nodeId])
  @@index([localOrderId])
  @@index([localPOId])
  @@index([remoteOrderId])
  @@map("federation_orders")
}

model FederationOrderItem {
  id                String   @id @default(uuid())
  federationOrderId String
  federationOrder   FederationOrder @relation(fields: [federationOrderId], references: [id], onDelete: Cascade)

  upstreamVariantId String
  localVariantId    String?
  quantity          Int
  unitPrice         Decimal @db.Decimal(10,2)
  total             Decimal @db.Decimal(10,2)
  sku               String?
  name              String?

  @@map("federation_order_items")
}

model FederationOrderStatusHistory {
  id                String   @id @default(uuid())
  federationOrderId String
  federationOrder   FederationOrder @relation(fields: [federationOrderId], references: [id], onDelete: Cascade)

  fromStatus  String?
  toStatus    String
  source      String   // "LOCAL" | "REMOTE"
  note        String?

  createdAt   DateTime @default(now())

  @@map("federation_order_status_history")
}

enum FederationOrderStatus {
  PENDING
  SENT
  ACKNOWLEDGED
  PROCESSING
  PARTIALLY_SHIPPED
  SHIPPED
  DELIVERED
  CANCELLED
  DISPUTED
}
```

### 4.4 结算模型

```prisma
// ===== 结算 =====
model FederationSettlement {
  id              String   @id @default(uuid())
  settlementNumber String  @unique
  nodeId          String
  node            FederationNode @relation(fields: [nodeId], references: [id])

  periodStart     DateTime
  periodEnd       DateTime
  status          SettlementStatus @default(DRAFT)

  totalOrders     Int
  totalAmount     Decimal @db.Decimal(12,2)
  currency        String  @default("EUR")

  lineItems       FederationSettlementLine[]

  localConfirmedAt  DateTime?
  remoteConfirmedAt DateTime?
  localConfirmedBy  String?
  note              String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([nodeId])
  @@index([status])
  @@map("federation_settlements")
}

model FederationSettlementLine {
  id              String   @id @default(uuid())
  settlementId    String
  settlement      FederationSettlement @relation(fields: [settlementId], references: [id], onDelete: Cascade)

  federationOrderId String?
  orderNumber       String
  orderDate         DateTime
  amount            Decimal @db.Decimal(12,2)
  status            String  // "AGREED" | "DISPUTED"
  note              String?

  @@map("federation_settlement_lines")
}

enum SettlementStatus {
  DRAFT
  SENT
  UNDER_REVIEW
  AGREED
  DISPUTED
  SETTLED
}
```

### 4.5 Product模型扩展

```prisma
// 在现有Product模型中新增字段:
  federationSource   String?   // 来源节点ID（null = 本地创建）
  upstreamProductId  String?   // 上游的Product.id
  channelProducts    ChannelProduct[]
```

---

## 五、API接口设计

### 5.1 联邦API路由结构

```
src/app/api/federation/
├── handshake/route.ts              // POST: 建立连接（交换密钥）
├── products/route.ts               // GET:  暴露产品目录
├── products/sync/route.ts          // POST: 接收产品同步通知（Webhook）
├── orders/route.ts                 // POST: 接收采购订单
├── orders/[id]/route.ts            // GET:  查询订单详情
├── orders/[id]/status/route.ts     // PATCH: 状态更新
├── inventory/route.ts              // GET:  暴露可用库存
├── settlements/route.ts            // POST: 接收结算单
├── settlements/[id]/confirm/route.ts // PATCH: 确认结算
└── webhooks/route.ts               // POST: 通用事件Webhook接收
```

所有路由使用 `validateFederationRequest()` 进行API Key + HMAC签名认证。

### 5.2 Webhook事件类型

```
PRODUCT_UPDATED         // 产品内容变更
PRODUCT_PRICE_CHANGED   // 价格变更
ORDER_CONFIRMED         // 订单确认
ORDER_SHIPPED           // 发货（含tracking number）
ORDER_DELIVERED         // 签收
ORDER_CANCELLED         // 取消
INVOICE_ISSUED          // 发票开具
INVOICE_PAID            // 付款确认
INVENTORY_UPDATED       // 库存变动
SETTLEMENT_CREATED      // 结算单生成
```

### 5.3 Webhook Payload格式

```json
{
  "event": "order.shipped",
  "timestamp": "2026-03-08T10:00:00Z",
  "nodeCode": "MAIN-WAREHOUSE-001",
  "data": {
    "orderId": "SO-2026-0042",
    "trackingNumber": "1Z999AA...",
    "carrier": "DHL",
    "items": [
      { "sku": "LED-PANEL-600", "quantity": 10, "shippedQty": 10 }
    ]
  },
  "signature": "hmac-sha256-of-payload"
}
```

---

## 六、新增文件清单

### 6.1 核心服务层

```
src/lib/
├── federation-auth.ts                    // API Key + HMAC验证
├── federation-client.ts                  // 出站HTTP客户端（重试+日志）
├── services/
│   ├── product-sync-service.ts           // 产品同步引擎
│   ├── order-routing-service.ts          // 订单路由/拆单引擎
│   └── federation-event-service.ts       // Webhook事件发布
├── actions/
│   ├── federation.ts                     // 联邦节点管理
│   ├── supply-channel.ts                // 渠道管理
│   ├── federation-order.ts              // 联邦订单管理
│   └── federation-settlement.ts         // 结算管理
```

### 6.2 API路由

```
src/app/api/federation/
├── handshake/route.ts
├── products/route.ts
├── products/sync/route.ts
├── orders/route.ts
├── orders/[id]/route.ts
├── orders/[id]/status/route.ts
├── inventory/route.ts
├── settlements/route.ts
├── settlements/[id]/confirm/route.ts
└── webhooks/route.ts
```

### 6.3 Admin页面

```
src/app/[locale]/(admin)/admin/federation/
├── page.tsx                              // 联邦节点列表
├── new/page.tsx                          // 新增连接
├── [id]/page.tsx                         // 节点详情/配置
├── [id]/logs/page.tsx                    // 同步日志
├── channels/page.tsx                     // 渠道列表
├── channels/[id]/page.tsx               // 渠道详情
├── channels/[id]/products/page.tsx      // 渠道产品管理
├── orders/page.tsx                       // 联邦订单列表
├── orders/[id]/page.tsx                 // 联邦订单详情
├── settlements/page.tsx                  // 结算列表
└── settlements/[id]/page.tsx            // 结算详情
```

### 6.4 组件

```
src/components/admin/federation/
├── federation-node-form.tsx              // 节点表单
├── federation-node-table.tsx             // 节点列表表格
├── supply-channel-form.tsx              // 渠道表单
├── channel-product-table.tsx            // 渠道产品表格
├── federation-order-table.tsx           // 联邦订单表格
├── federation-order-detail.tsx          // 联邦订单详情
├── settlement-table.tsx                 // 结算表格
├── settlement-detail.tsx                // 结算详情
├── sync-status-badge.tsx                // 同步状态徽章
└── federation-dashboard.tsx             // 联邦概览仪表盘
```

---

## 七、核心业务流程

### 7.1 连接建立流程

```
实例A（上游）                               实例B（下游）
    │                                         │
    │  1. B的管理员在Admin填写A的baseUrl        │
    │  ←──── POST /api/federation/handshake ───│
    │        (携带B的inboundKey + baseUrl)      │
    │                                         │
    │  2. A的管理员审批                         │
    │                                         │
    │  3. A返回自己的inboundKey                 │
    │  ────→ 201 { inboundKey, nodeCode }     │
    │                                         │
    │  4. 双方状态变为ACTIVE                    │
    │  ←──→ 可以互相调用API                    │
```

### 7.2 产品同步流程

```
上游                                        下游
  │                                          │
  │  1. 上游创建SupplyChannel，添加产品        │
  │  2. 上游发布渠道(isPublished=true)         │
  │                                          │
  │  ──→ Webhook: PRODUCT_UPDATED            │
  │                                          │
  │  3. 下游订阅渠道(isSubscribed=true)        │
  │  4. 下游拉取产品目录                       │
  │  ←── GET /api/federation/products         │
  │                                          │
  │  5. 创建本地Product(federationSource=nodeId)│
  │  6. 下游设置加价/自定义描述                 │
  │  7. 下游上架到自己前台                      │
  │                                          │
  │  --- 后续更新 ---                          │
  │  8. 上游修改产品                           │
  │  ──→ Webhook: PRODUCT_UPDATED             │
  │  9. 下游检测syncHash变化，更新本地副本       │
  │     (保留下游的价格/内容覆盖)               │
```

### 7.3 订单路由流程

```
终端客户在下游前台下单
  │
  ▼
下游ERP创建SalesOrder
  │
  ▼
订单路由引擎分析:
  ├── 商品A: 本地有库存 → 本地发货
  ├── 商品B: 来自上游X → 生成PO给X
  └── 商品C: 来自上游Y → 生成PO给Y
  │
  ▼
自动生成PurchaseOrder (source='FEDERATION', status=DRAFT)
  │
  ▼
下游管理员审批PO
  │
  ▼
POST /api/federation/orders → 推送到上游
  │
  ▼
上游收到 → 创建SalesOrder → 处理发货
  │
  ▼
Webhook: ORDER_SHIPPED → 下游更新PO状态 → 更新客户订单状态
```

### 7.4 结算流程

```
月末/周末定时触发
  │
  ▼
汇总期间内所有FederationOrder（状态=DELIVERED）
  │
  ▼
生成FederationSettlement（DRAFT）
  │
  ▼
本地管理员审核 → 发送给对方
  │
  ▼
POST /api/federation/settlements → 对方审核
  │
  ▼
对方逐行确认/标记争议
  │
  ▼
双方确认 → SETTLED → 生成Invoice
```

---

## 八、状态映射

### 上游SalesOrder ↔ 下游PurchaseOrder

| 上游SalesOrder状态 | 下游PurchaseOrder状态 | FederationOrder状态 |
|---|---|---|
| CONFIRMED | CONFIRMED | ACKNOWLEDGED |
| IN_PRODUCTION | CONFIRMED | PROCESSING |
| SHIPPED | PARTIAL_RECEIVED | SHIPPED |
| DELIVERED | RECEIVED | DELIVERED |
| CANCELLED | CANCELLED | CANCELLED |

---

## 九、安全设计

### 9.1 API Key管理
- 每个节点一对密钥（出站key + 入站key）
- 数据库中AES-256加密存储
- 支持密钥轮换（不中断服务）
- 可配置IP白名单（可选）

### 9.2 请求签名
```
signature = HMAC-SHA256(apiSecret, timestamp + method + path + body)
Headers: X-Federation-Key, X-Federation-Timestamp, X-Federation-Signature
```

### 9.3 数据脱敏
- 产品同步：不传成本价、供应商信息、内部备注
- 库存查询：只返回可用量，不返回物理库存/已分配量详情
- 订单同步：不传客户个人信息、内部利润数据

---

## 十、分阶段实施计划

### Phase 1：联邦基础设施（约2周）

**目标**：建立实例间通信的基础

| 任务 | 详情 |
|------|------|
| P1.1 Prisma模型 | FederationNode, FederationSyncLog + 枚举 |
| P1.2 认证层 | federation-auth.ts (API Key + HMAC验证) |
| P1.3 HTTP客户端 | federation-client.ts (出站调用 + 重试 + 日志) |
| P1.4 握手API | /api/federation/handshake |
| P1.5 Admin页面 | 节点列表、新增、详情、日志 |
| P1.6 Server Actions | federation.ts (CRUD + 握手) |
| P1.7 i18n | 9种语言的federation相关翻译 |

**交付物**：两个ERP实例可以建立连接，互相认证。

---

### Phase 2：产品同步（约3周）

**目标**：上游发布产品，下游订阅并同步到本地

| 任务 | 详情 |
|------|------|
| P2.1 Prisma模型 | SupplyChannel, ChannelProduct, Product扩展字段 |
| P2.2 产品同步服务 | product-sync-service.ts |
| P2.3 联邦产品API | GET /api/federation/products |
| P2.4 同步Webhook | POST /api/federation/products/sync |
| P2.5 渠道管理页面 | 渠道列表、详情、产品管理 |
| P2.6 产品Hook | product.ts中updateProduct()添加同步通知 |
| P2.7 定价扩展 | pricing.ts支持加价/覆盖 |

**交付物**：上游产品可同步到下游，下游可自定义价格后上架。

---

### Phase 3：自动采购与订单路由（约3周）

**目标**：下游收到客户订单后，自动向上游生成采购订单

| 任务 | 详情 |
|------|------|
| P3.1 Prisma模型 | FederationOrder, FederationOrderItem, StatusHistory |
| P3.2 订单路由引擎 | order-routing-service.ts (拆单逻辑) |
| P3.3 自动PO生成 | 根据产品来源自动创建PurchaseOrder |
| P3.4 订单API | POST/GET /api/federation/orders |
| P3.5 状态同步 | PATCH /api/federation/orders/[id]/status |
| P3.6 联邦订单页面 | 订单列表、详情、拆单预览 |
| P3.7 order-service集成 | createWebOrder()后调用路由引擎 |
| P3.8 PO扩展 | purchase-order.ts支持FEDERATION来源 |

**交付物**：端到端订单流转——客户下单→拆单→自动PO→上游发货→状态同步。

**Phase 1-3 完成后即形成最小可用闭环。**

---

### Phase 4：双向状态同步（约2周）

**目标**：运输、发货、发票状态实时同步

| 任务 | 详情 |
|------|------|
| P4.1 事件服务 | federation-event-service.ts |
| P4.2 发货Hook | delivery-order.ts → ORDER_SHIPPED事件 |
| P4.3 发票Hook | invoice.ts → INVOICE_ISSUED/PAID事件 |
| P4.4 物流级联 | logistics webhook收到后通知联邦对方 |
| P4.5 Webhook接收 | POST /api/federation/webhooks |

**交付物**：上下游状态变化自动同步，减少人工沟通。

---

### Phase 5：结算对账（约2周）

**目标**：定期财务对账

| 任务 | 详情 |
|------|------|
| P5.1 Prisma模型 | FederationSettlement, SettlementLine |
| P5.2 结算生成 | 自动/手动生成结算单 |
| P5.3 结算API | 发送/接收/确认结算 |
| P5.4 结算页面 | 列表、详情、逐行确认 |
| P5.5 CRON | 定时生成结算单 |
| P5.6 发票集成 | 结算完成生成Invoice |

**交付物**：上下游财务对账闭环。

---

### Phase 6：库存可见性（约1周）

**目标**：下游可查看上游库存，辅助采购决策

| 任务 | 详情 |
|------|------|
| P6.1 库存API | GET /api/federation/inventory |
| P6.2 库存缓存 | 5-15分钟TTL，避免频繁调用 |
| P6.3 UI展示 | 下游产品页显示"上游可用库存" |
| P6.4 reorder集成 | reorder-suggestions.ts参考上游库存 |

**交付物**：下游可实时参考上游库存做采购决策。

---

## 十一、风险与缓解

| 风险 | 严重度 | 缓解措施 |
|------|--------|---------|
| 网络延迟导致同步延迟 | 中 | 异步Webhook + 定时拉取兜底 + 本地缓存 |
| 数据不一致 | 高 | syncHash增量同步 + 冲突检测 + 手动解决UI |
| 上游宕机影响下单 | 中 | 本地缓存上游库存 + 订单队列 + 离线下单后补同步 |
| API密钥泄露 | 高 | AES加密存储 + 密钥轮换 + IP白名单 + 审计日志 |

---

## 十二、总结

| 阶段 | 工作量 | 依赖 | 独立可交付 |
|------|--------|------|-----------|
| P1: 联邦基础设施 | 2周 | 无 | 是 |
| P2: 产品同步 | 3周 | P1 | 是 |
| P3: 自动采购 | 3周 | P1+P2 | 是 |
| P4: 状态同步 | 2周 | P3 | 是 |
| P5: 结算对账 | 2周 | P3 | 是 |
| P6: 库存可见性 | 1周 | P1 | 是 |

**总计约13周**。建议先完成 P1→P2→P3（约8周）形成最小可用闭环，再根据实际使用反馈调整后续阶段优先级。
