# My-LED-ERP 项目地图

> B2B LED 照明电商 ERP 系统技术文档

---

## 1. 目录结构

```
src/
├── actions/                      # Server Actions (认证相关)
│   └── auth-actions.ts           # 登录、注册、B2B 申请
│
├── app/                         # Next.js 14 App Router
│   ├── [locale]/                # 国际化路由 (en, es, de, fr, it, pt, nl, pl, zh)
│   │   ├── (admin)/            # Admin 路由组
│   │   │   ├── admin/          # 管理后台页面
│   │   │   │   ├── attributes/     # 属性管理
│   │   │   │   ├── categories/     # 分类管理
│   │   │   │   ├── cms/            # CMS 内容管理
│   │   │   │   │   ├── banners/
│   │   │   │   │   ├── sections/
│   │   │   │   │   ├── settings/
│   │   │   │   │   └── site-info/
│   │   │   │   ├── customers/      # 客户管理
│   │   │   │   ├── inventory/      # 库存管理
│   │   │   │   │   └── history/
│   │   │   │   ├── invoices/       # 发票管理
│   │   │   │   ├── orders/         # 商城订单
│   │   │   │   ├── price-lists/    # 价格列表
│   │   │   │   ├── products/       # 产品管理
│   │   │   │   ├── purchase-orders/ # 采购订单
│   │   │   │   ├── reports/        # 报表中心 (含订单报表)
│   │   │   │   ├── returns/        # 退货管理
│   │   │   │   ├── rfq/            # 询价单管理
│   │   │   │   ├── sales-orders/   # 销售订单
│   │   │   │   ├── search-sync/    # 搜索同步
│   │   │   │   ├── settings/       # 系统设置
│   │   │   │   ├── shipping/       # 配送方式
│   │   │   │   ├── suppliers/      # 供应商管理
│   │   │   │   └── vat/            # VAT 配置
│   │   │   ├── dashboard/          # 管理仪表盘
│   │   │   ├── layout.tsx          # Admin 布局
│   │   │   └── page.tsx            # Admin 首页
│   │   │
│   │   ├── (storefront)/           # 商城前台路由组
│   │   │   ├── apply-b2b/          # B2B 申请
│   │   │   ├── cart/               # 购物车
│   │   │   ├── category/           # 分类页
│   │   │   │   ├── all/
│   │   │   │   └── [slug]/
│   │   │   ├── checkout/           # 结账
│   │   │   │   └── success/
│   │   │   ├── compare/            # 产品对比
│   │   │   ├── forgot-password/    # 忘记密码 [NEW]
│   │   │   ├── login/              # 登录
│   │   │   ├── offers/             # B2B 促销
│   │   │   ├── product/[slug]/     # 产品详情
│   │   │   ├── profile/            # 用户中心
│   │   │   │   ├── orders/
│   │   │   │   │   └── [id]/return/
│   │   │   │   └── returns/
│   │   │   ├── register/           # 注册
│   │   │   ├── reset-password/     # 重置密码 [NEW]
│   │   │   ├── rfq/                # 询价
│   │   │   ├── search/             # 搜索
│   │   │   ├── verify-email/       # 邮件验证 [NEW]
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   └── page.tsx            # 首页
│   │   │
│   │   └── layout.tsx              # 根布局 (NextIntl Provider)
│   │
│   ├── api/                        # API 路由
│   │   ├── ai/translate/           # AI 翻译
│   │   ├── auth/[...nextauth]/     # NextAuth.js
│   │   ├── invoices/[orderId]/     # 发票 PDF 下载
│   │   ├── logistics/
│   │   │   ├── service-points/     # 物流服务点
│   │   │   └── shipping-methods/
│   │   ├── payments/webhook/       # 支付回调
│   │   ├── shipping-methods/[id]/  # 配送方式详情
│   │   └── test-inventory/         # 库存测试
│   │
│   ├── globals.css
│   ├── robots.ts
│   └── sitemap.ts
│
├── components/
│   ├── admin/                       # Admin 组件 (50+)
│   │   ├── product-form.tsx         # 产品表单 (1103 行)
│   │   ├── product-form-schema.ts   # 产品表单 Zod Schema [NEW]
│   │   ├── ProductVariantsTable.tsx # 变体表格 (拆分自 product-form) [NEW]
│   │   ├── sales-order-form.tsx
│   │   ├── purchase-order-form.tsx
│   │   ├── specs-configurator.tsx
│   │   ├── category-tree-selector.tsx
│   │   ├── price-list-form.tsx
│   │   ├── invoice-actions.tsx
│   │   ├── order-details.tsx
│   │   ├── sales-order-details.tsx
│   │   ├── purchase-order-details.tsx
│   │   ├── inventory-history-table.tsx
│   │   ├── inventory-history-filter.tsx
│   │   ├── stock-adjustment-dialog.tsx
│   │   ├── global-stock-adjustment-dialog.tsx
│   │   ├── supplier-form-dialog.tsx
│   │   ├── price-list-rules-table.tsx
│   │   ├── record-payment-dialog.tsx
│   │   ├── import-products-dialog.tsx
│   │   ├── export-products-button.tsx
│   │   ├── user-form.tsx
│   │   ├── cms/
│   │   │   ├── banner-form.tsx
│   │   │   ├── banner-list.tsx
│   │   │   └── create-banner-button.tsx
│   │   └── ...
│   │
│   ├── storefront/                  # Storefront 组件 (40+)
│   │   ├── product-view.tsx
│   │   ├── product-filter.tsx
│   │   ├── checkout-form.tsx
│   │   ├── CheckoutOrderSummary.tsx # 结账摘要 (拆分自 checkout-form) [NEW]
│   │   ├── ProductDetailTabs.tsx   # 产品详情 Tabs (拆分) [NEW]
│   │   ├── navbar.tsx
│   │   ├── cart-sheet.tsx
│   │   ├── product-card.tsx
│   │   ├── product-list-view.tsx
│   │   ├── hero-carousel.tsx
│   │   ├── hero-section.tsx
│   │   ├── search-bar.tsx
│   │   ├── variant-selector.tsx
│   │   ├── restock-notify.tsx
│   │   ├── rfq-button.tsx
│   │   ├── return-button.tsx
│   │   ├── compare-bar.tsx
│   │   ├── profile/
│   │   │   ├── address-form-dialog.tsx
│   │   │   ├── address-list.tsx
│   │   │   └── invoice-list.tsx
│   │   └── ...
│   │
│   ├── ui/                         # Shadcn UI 组件库 (30+)
│   │   ├── button.tsx, dialog.tsx, dropdown-menu.tsx...
│   │   └── ...
│   │
│   ├── documents/
│   │   ├── invoice-pdf.tsx
│   │   └── web-order-invoice-pdf.tsx
│   │
│   ├── providers/
│   │   ├── intl-provider.tsx
│   │   └── session-provider.tsx
│   │
│   └── cart-sync.tsx
│
├── emails/                         # 邮件模板 (React Email)
│   ├── order-confirmation.tsx      # 订单确认
│   ├── b2b-application.tsx         # B2B 申请
│   └── b2b-status.tsx              # B2B 状态通知
│
├── hooks/
│   ├── use-debounce.ts
│   ├── use-location.ts
│   └── use-product-price.ts
│
├── i18n/
│   ├── locales.ts
│   ├── navigation.ts
│   └── request.ts
│
└── lib/                            # 核心业务逻辑
    ├── actions/                    # Server Actions (26 文件)
    │   ├── address.ts              # 地址管理
    │   ├── attribute.ts / attributes.ts
    │   ├── cart.ts                 # 购物车
    │   ├── category.ts             # 分类
    │   ├── cms.ts                  # CMS 内容
    │   ├── config.ts               # 全局配置
    │   ├── import-export.ts        # 产品导入导出
    │   ├── inventory.ts            # 库存操作
    │   ├── invoice.ts              # 发票
    │   ├── logistics.ts            # 物流
    │   ├── order.ts                # 商城订单
    │   ├── price-list.ts           # 价格列表
    │   ├── product.ts              # 产品
    │   ├── purchase-order.ts       # 采购订单
    │   ├── returns.ts              # 退货
    │   ├── rfq.ts                  # 询价
    │   ├── sales-order.ts          # 销售订单
    │   ├── search.ts / search-suggestions.ts
    │   ├── shipping.ts             # 配送方式
    │   ├── supplier.ts / suppliers.ts / supplier-helper.ts
    │   ├── user.ts                 # 用户管理
    │   └── vat.ts                  # VAT 配置
    │
    ├── logistics/
    │   ├── providers/
    │   │   ├── base.ts
    │   │   ├── mock.ts
    │   │   └── sendcloud.ts
    │   ├── errors.ts
    │   ├── index.ts
    │   └── types.ts
    │
    ├── services/
    │   ├── order-service.ts        # 订单核心逻辑
    │   └── payment-service.ts      # 支付回调处理
    │
    ├── store/
    │   ├── cart.ts
    │   └── compare.ts
    │
    ├── search/
    │   ├── typesense-client.ts
    │   ├── sync.ts
    │   ├── actions.ts
    │   └── utils.ts
    │
    ├── types/
    │   └── search.ts
    │
    ├── utils/
    │   └── order-number.ts
    │
    ├── auth.ts                     # NextAuth 配置
    ├── auth-guard.ts               # 权限检查 requireRole() [NEW]
    ├── config.ts                   # 全局配置
    ├── content.ts                  # 内容转换
    ├── db.ts                       # Prisma 客户端 (default + named export)
    ├── email.ts                    # 邮件发送 (Resend)
    ├── formatters.ts               # 价格/日期格式化
    ├── i18n-labels.ts              # i18n 标签
    ├── inventory.ts                # 库存处理 (Bundle/Stock)
    ├── metadata.ts                 # SEO 元数据
    ├── pdf-generator.ts            # PDF 生成
    ├── pricing.ts                  # 价格计算
    ├── rate-limit.ts               # 限流控制 [NEW]
    ├── specs.ts                    # 规格处理
    ├── tax.ts                      # 税务计算
    ├── utils.ts                    # 通用工具
    └── vat.ts                      # VAT 计算
```

---

## 2. 核心实体与表

### 2.1 用户与认证

| 表名                          | 说明           | 关键字段                                                                                            |
| ----------------------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| `users`                       | 用户账户       | `id`, `email`, `password`, `role`, `b2bStatus`, `customerLevel`, `companyName`, `taxId`, `isActive` |
| `addresses`                   | 用户地址       | `userId`, `type`, `firstName`, `lastName`, `street`, `city`, `country`, `zipCode`                   |
| `password_reset_tokens`       | 密码重置令牌   | `token`, `email`, `expires` [NEW]                                                                   |
| `email_verification_tokens`   | 邮件验证令牌   | `token`, `email`, `expires` [NEW]                                                                   |
| `accounts`                    | OAuth 关联账户 | `userId`, `provider`, `providerAccountId`                                                           |
| `sessions`                    | 会话           | `userId`, `expires`, `sessionToken`                                                                 |
| `verification_tokens`         | NextAuth 验证  | `identifier`, `token`, `expires`                                                                    |

**角色枚举 (Role)**

```prisma
CUSTOMER          // 普通客户
ADMIN             // 管理员
SALES_REP         // 销售代表
WAREHOUSE_MANAGER // 仓库管理
```

**B2B 状态 (B2BStatus)**

```prisma
NOT_APPLIED // 未申请
PENDING     // 待审核
APPROVED    // 已批准
REJECTED    // 已拒绝
```

---

### 2.2 产品管理 (PIM)

| 表名                    | 说明       | 关键字段                                               |
| ----------------------- | ---------- | ------------------------------------------------------ |
| `products`              | 产品主数据 | `slug`, `sku`, `type`, `content` (JSON)                |
| `product_variants`      | 产品变体   | `sku`, `ean`, `price`, `physicalStock`, `specs` (JSON) |
| `bundle_items`          | Bundle 组件 | `bundleId`, `variantId`, `quantity`                   |
| `categories`            | 分类       | `slug`, `content`, `parentId` (树形)                   |
| `attribute_definitions` | 属性定义   | `name`, `key`, `type`, `unit`                          |
| `attribute_options`     | 属性选项   | `value`, `color` (色卡)                                |

**产品类型 (ProductType)**

```prisma
SIMPLE  // 普通产品
BUNDLE  // 捆绑产品
```

---

### 2.3 库存与供应链

| 表名                     | 说明            | 关键字段                                      |
| ------------------------ | --------------- | --------------------------------------------- |
| `suppliers`              | 供应商          | `name`, `code`, `contact`                     |
| `product_suppliers`      | 产品-供应商关联 | `productId`, `supplierId`, `costPrice`, `moq` |
| `purchase_orders`        | 采购订单        | `poNumber`, `status`, `totalAmount`           |
| `purchase_order_items`   | 采购订单项      | `variantId`, `quantity`, `costPrice`          |
| `inventory_transactions` | 库存流水        | `variantId`, `quantity`, `type`, `reference`  |
| `shipping_methods`       | 配送方式        | `name`, `price`, `estimatedDays`              |

**库存类型 (InventoryType)**

```prisma
PURCHASE_ORDER // 采购入库
SALE_ORDER     // 销售出库
ADJUSTMENT     // 人工调整
RETURN         // 客户退货
DAMAGED        // 损坏
```

**采购订单状态 (POStatus)**

```prisma
DRAFT, SENT, RECEIVED, CANCELLED
```

---

### 2.4 销售与订单

| 表名                | 说明                 | 关键字段                                          |
| ------------------- | -------------------- | ------------------------------------------------- |
| `orders`            | 商城订单 (Web Order) | `orderNumber`, `status`, `paymentStatus`, `total` |
| `order_items`       | 订单项               | `variantId`, `quantity`, `price`, `costPrice`     |
| `sales_orders`      | 销售订单 (ERP)       | `orderNumber`, `status`, `totalAmount`            |
| `sales_order_items` | 销售订单项           | 同上                                              |
| `carts`             | 购物车               | `userId`                                          |
| `cart_items`        | 购物车项             | `variantId`, `quantity`                           |

**订单状态 (OrderStatus)**

```prisma
DRAFT, PENDING, CONFIRMED, PROCESSING, SHIPPED, DELIVERED, CANCELLED, RETURNED
```

**支付状态 (PaymentStatus)**

```prisma
PENDING, PAID, FAILED, REFUNDED
```

**销售订单状态 (SOStatus)**

```prisma
DRAFT, CONFIRMED, SHIPPED, DELIVERED, CANCELLED
```

**配送状态 (ShippingStatus)**

```prisma
PENDING, PROCESSING, SHIPPED, IN_TRANSIT, DELIVERED, RETURNED, FAILED
```

---

### 2.5 发票、支付与定价

| 表名                     | 说明     | 关键字段                                            |
| ------------------------ | -------- | --------------------------------------------------- |
| `invoices`               | 发票     | `invoiceNumber`, `status`, `totalAmount`, `dueDate` |
| `payments`               | 付款记录 | `invoiceId`, `amount`, `method`, `date`             |
| `payment_transactions`   | 支付交易 | `orderId`, `provider`, `status`, `amount`           |
| `payment_webhook_events` | 支付回调 | `provider`, `eventId`, `payload`                    |
| `price_lists`            | 价格列表 | `name`, `currency`, `levelCode`, `discountPercent`  |
| `price_list_rules`       | 价格规则 | `variantId`, `price`, `minQuantity`                 |

**发票状态 (InvoiceStatus)**

```prisma
DRAFT, SENT, PAID, PARTIALLY_PAID, OVERDUE, CANCELLED
```

---

### 2.6 退货与询价

| 表名              | 说明     | 关键字段                                           |
| ----------------- | -------- | -------------------------------------------------- |
| `return_requests` | 退货申请 | `returnNumber`, `status`, `reason`, `refundAmount` |
| `return_items`    | 退货项   | `variantId`, `quantity`, `restockQty`              |
| `rfq_requests`    | 询价单   | `status`, `quotedTotal`, `adminNote`               |
| `rfq_items`       | 询价项   | `productName`, `quantity`, `targetPrice`           |

**退货状态 (ReturnStatus)**

```prisma
REQUESTED, APPROVED, REJECTED, RECEIVED, REFUNDED, CLOSED
```

**退货原因 (ReturnReason)**

```prisma
DEFECTIVE, WRONG_ITEM, NOT_AS_DESCRIBED, DAMAGED_IN_TRANSIT, CHANGED_MIND, OTHER
```

**询价状态 (RFQStatus)**

```prisma
PENDING, REVIEWING, QUOTED, ACCEPTED, REJECTED, EXPIRED
```

---

### 2.7 CMS 与配置

| 表名                  | 说明          | 关键字段                                     |
| --------------------- | ------------- | -------------------------------------------- |
| `banners`             | 横幅          | `title`, `imageUrl`, `content` (JSON)        |
| `global_configs`      | 全局配置      | `key`, `value` (JSON)                        |
| `country_vat_configs` | 国家 VAT 配置 | `countryCode`, `standardRate`, `reducedRate` |

---

## 3. 权限模型

### 3.1 角色权限矩阵

| 资源                              | CUSTOMER | SALES_REP | WAREHOUSE_MANAGER | ADMIN |
| --------------------------------- | :------: | :-------: | :---------------: | :---: |
| 商城购物/购物车                   | ✅       |           |                   | ✅    |
| 查看自己订单/地址/发票            | ✅       |           |                   | ✅    |
| 申请 B2B / 提交询价               | ✅       |           |                   | ✅    |
| 产品管理 (CRUD)                   |          | ✅        |                   | ✅    |
| 价格列表 (CRUD)                   |          | ✅        |                   | ✅    |
| 价格列表 (删除)                   |          |           |                   | ✅    |
| 客户管理 / 销售订单               |          | ✅        |                   | ✅    |
| 销售订单状态更新                  |          | ✅        | ✅                | ✅    |
| 采购订单 / 库存 / 供应商          |          |           | ✅                | ✅    |
| 分类 / 属性 / CMS / VAT / 配置   |          |           |                   | ✅    |
| 用户管理 / 系统设置               |          |           |                   | ✅    |

> 执行层: `src/lib/auth-guard.ts` 中的 `requireRole()` 在所有 Server Actions 中强制检查 (43 个检查点)

### 3.2 B2B 客户层级

- 通过 `customerLevel` 字段关联 `priceLists`
- 支持客户级别定价 (`PriceListRule.minQuantity`)
- B2B 客户需经管理员审批 (`b2bStatus`)

### 3.3 数据隔离

- 用户只能查看自己的订单、地址、发票
- 管理员可查看所有数据
- `salesOrder` 关联 `customerId`，实现客户数据隔离

---

## 4. 关键业务流程

### 4.1 商城下单流程 (Web Order)

```
用户 ─→ 浏览/搜索 ─→ 加入购物车 ─→ 结算 ─→ 创建订单
                                              ↓
                                    创建支付交易 (PaymentTransaction)
                                              ↓
                                    扣减库存 (processStockMovement)
                                              ↓
                                    发送订单确认邮件
                                              ↓
用户 ─→ 支付 ─→ 支付回调更新订单状态 ─→ 申请退货/查看发票
```

**核心逻辑 (`lib/services/order-service.ts`)**

1. 验证库存 (含 Bundle 产品计算)
2. 计算 VAT (根据用户国家)
3. 计算运费 (满 €150 免费)
4. 创建订单 + 订单项 (快照产品信息)
5. 扣减库存 (库存流水)

---

### 4.2 销售订单流程 (Admin Created)

```
Admin ─→ 创建销售订单 (SalesOrder) ─→ 确认 (CONFIRMED)
                                              ↓
                              创建发票 (createInvoiceFromSO)
                                              ↓
                              出库 (SHIPPED) ─→ 扣减库存
                                              ↓
                              送达 (DELIVERED)
                                              ↓
                              记录付款 ─→ 发票状态: PAID
```

**核心逻辑 (`lib/actions/sales-order.ts`)**

1. 创建销售订单 (DRAFT)
2. 确认时创建发票
3. 发货时扣减库存
4. 取消时回滚库存

---

### 4.3 库存管理

**库存类型**

- `physicalStock`: 实际库存
- `allocatedStock`: 已分配 (待发货)

**可用库存 = physicalStock - allocatedStock**

**Bundle 产品逻辑 (`lib/inventory.ts`)**

```
Bundle 库存 = MIN(子产品可用库存 / 所需数量)
```

---

### 4.4 退货流程

```
用户 ─→ 申请退货 (ReturnRequest) ─→ 管理员审核
                                              ↓
                              批准 (APPROVED) ─→ 拒绝 (REJECTED)
                                   ↓
                        用户寄回 ─→ 收到货物 (RECEIVED)
                                   ↓
                        退款 ─→ 退款到原支付方式
                                   ↓
                        退货入库 ─→ 库存恢复 (RESTOCK)
                                   ↓
                        关闭 (CLOSED)
```

---

### 4.5 B2B 询价流程

```
用户 ─→ 提交询价 (RFQRequest) ─→ 管理员报价 (QUOTED)
                                              ↓
                              用户接受 (ACCEPTED) ─→ 拒绝 (REJECTED)
                                   ↓
                        转为商城订单 (Order)
```

---

### 4.6 密码重置与邮件验证流程 [NEW]

```
忘记密码:
用户 ─→ /forgot-password ─→ 发送重置邮件 (PasswordResetToken, 1h 有效)
                                   ↓
用户 ─→ /reset-password?token=xxx ─→ 更新密码 ─→ 令牌失效

邮件验证:
注册后 ─→ 发送验证邮件 (EmailVerificationToken, 24h 有效)
             ↓
用户 ─→ /verify-email?token=xxx ─→ 账户激活
             ↓
登录时检查 CUSTOMER 角色邮件是否已验证 (未验证则阻止登录)
```

---

## 5. 技术约束与架构

### 5.1 核心技术栈

| 类别     | 技术                                |
| -------- | ----------------------------------- |
| 框架     | Next.js 14.1.0 (App Router)         |
| 语言     | TypeScript                          |
| 数据库   | PostgreSQL (Supabase)               |
| ORM      | Prisma 5.22.0                       |
| 认证     | NextAuth.js 4.24.13                 |
| UI 组件  | Tailwind CSS + Shadcn UI (Radix UI) |
| 状态管理 | Zustand + Nuqs                      |
| 表单     | React Hook Form + Zod               |
| 国际化   | next-intl 4.8.3                     |
| 主题     | next-themes                         |
| 图表     | Recharts                            |
| 搜索     | Typesense                           |
| 邮件     | React Email + Resend                |
| PDF      | @react-pdf/renderer + jsPDF         |
| 动画     | framer-motion                       |

---

### 5.2 数据获取与缓存策略

| 模式              | 用途               | 缓存策略                    |
| ----------------- | ------------------ | --------------------------- |
| Server Components | Admin 页面、报表   | `unstable_noStore` (实时)   |
| Server Actions    | 数据修改           | `revalidatePath` (按需刷新) |
| React `cache()`   | 产品详情、分类     | 请求级缓存                  |
| `unstable_cache`  | 全局配置、属性定义 | 定时/按需刷新               |

---

### 5.3 API 设计模式

| 类型           | 说明                                 |
| -------------- | ------------------------------------ |
| Server Actions | 全部 CRUD 操作 (`lib/actions/*.ts`)  |
| Route Handlers | 第三方集成 (`app/api/`)              |
| Middleware     | 国际化路由保护 (`src/middleware.ts`) |

---

### 5.4 i18n 国际化

- **支持语言**: en, es, de, fr, it, pt, nl, pl, zh
- **配置**: `next.config.mjs` + `next-intl` 插件
- **路由**: `/[locale]/` 前缀
- **内容存储**: JSON 格式 (`content` 字段)
- **导航封装**: `src/i18n/navigation.ts`

---

### 5.5 搜索系统

- **引擎**: Typesense
- **同步**: `lib/search/sync.ts` + Admin 同步页面
- **前端**: `ProductFilter` + URL 状态管理 (nuqs)
- **特性**: Facet 聚合、动态筛选、排序

---

### 5.6 支付与物流

- **支付**: `lib/services/payment-service.ts` 记录支付回调与状态同步
- **回调校验**: `PAYMENT_WEBHOOK_SECRET` + HMAC SHA256
- **物流**: `lib/logistics` 提供 mock/sendcloud 适配器

---

## 6. 安全功能 [NEW]

### 6.1 权限守卫 (Auth Guard)

```typescript
// src/lib/auth-guard.ts
export async function requireRole(...roles: Role[]): Promise<Session>
```

- 所有写操作的 Server Action 必须调用此函数
- 未认证: 抛出 `AuthError("Unauthorized")`
- 权限不足: 抛出 `AuthError("Forbidden")`
- 已覆盖: 43 个检查点 across 12 个 action 文件

### 6.2 限流控制 (Rate Limiting)

```typescript
// src/lib/rate-limit.ts
```

| 端点          | 限制                  |
| ------------- | --------------------- |
| 登录          | 5 次/15 分钟/IP       |
| 注册          | 3 次/小时/IP          |
| 忘记密码      | 3 次/小时/邮箱        |
| 重发验证邮件  | 3 次/小时/邮箱        |

### 6.3 邮件验证

- CUSTOMER 角色登录时强制检查邮件是否已验证
- 未验证用户登录被阻止，并提示重发验证邮件
- 令牌有效期: 密码重置 1h，邮件验证 24h

### 6.4 数据库索引优化

已为以下 8 个模型添加索引:
- `products`: slug, sku, status
- `product_variants`: sku, productId
- `orders`: orderNumber, userId, status
- `sales_orders`: orderNumber, customerId
- `inventory_transactions`: variantId, createdAt
- `purchase_orders`: poNumber, status
- `invoices`: invoiceNumber, orderId
- `return_requests`: returnNumber, userId

---

## 7. 项目统计

| 指标                  | 数量           |
| --------------------- | -------------- |
| 源代码文件 (.ts/.tsx) | 271+ 个        |
| 代码行数              | ~37,000 行     |
| Admin 页面            | 41 个          |
| Storefront 页面       | 21 个 (+3 NEW) |
| 数据库表              | 35 个 (+2 NEW) |
| Server Actions 文件   | 26 个          |
| 支持语言              | 9 种           |
| 权限检查点            | 43 个          |

---

## 8. 部署注意事项

1. **环境变量**: 需要配置以下变量:
   ```
   DATABASE_URL, DIRECT_URL
   NEXTAUTH_SECRET, NEXTAUTH_URL
   TYPESENSE_HOST, TYPESENSE_PORT, TYPESENSE_PROTOCOL, TYPESENSE_API_KEY
   PAYMENT_PROVIDER, PAYMENT_WEBHOOK_SECRET
   LOGISTICS_ADAPTER, SENDCLOUD_PUBLIC_KEY, SENDCLOUD_SECRET_KEY
   RESEND_API_KEY
   MOCK_PAYMENT_AUTO_SUCCESS (可选, 测试用)
   ```
2. **Prisma**: 运行 `npx prisma generate` 和 `npx prisma db push`
3. **搜索**: 需要启动 Typesense 服务并执行一次同步
4. **邮件**: 需要配置 Resend API Key (用于密码重置/邮件验证/订单通知)
5. **支付测试**: 如使用 MOCK，可设置 `MOCK_PAYMENT_AUTO_SUCCESS=true`

---

## 9. 已知技术债务

| 问题                              | 严重度 | 说明                                          |
| --------------------------------- | ------ | --------------------------------------------- |
| 69 个 TypeScript 错误             | 中     | 非本轮改动引入，分布在多个组件                |
| 100+ 个 `any` 类型               | 低     | 影响类型安全，可逐步替换                      |
| `suppliers.ts` 导入路径错误       | 低     | 导入 `prisma` 应改为 `db`                     |
| `product-form.tsx` 1103 行过大    | 低     | 部分已拆分，可继续细化                        |

---

_Last Updated: 2026-02-27_
