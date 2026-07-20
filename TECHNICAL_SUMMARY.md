# 丰享汇 汽车线索平台 — 全栈技术总结文档

> 生成日期：2025-06-25 | 版本：v2.0（完整三项目分析）

---

## 一、项目总览

本项目是一个**汽车行业销售线索管理平台**，包含三个子项目：

```
┌─────────────────────────────────────────────────────────────┐
│                     系统架构全景图                            │
├───────────────┬──────────────────┬──────────────────────────┤
│  小程序端 (C端) │  管理后台 (B端)    │       后端服务            │
│  alipay-miniapp│  leads-platform  │       Ghidorah          │
│                │                  │                          │
│  用户报名/预约  │  活动/线索/权益   │  API + 定时任务 + 第三方对接  │
│  权益领取      │  报表/项目管理    │  FTMS/易车/优酷/奔驰/Hyper  │
└───────────────┴──────────────────┴──────────────────────────┘
```

| 项目 | 目录 | 技术栈 | 端口 |
|------|------|--------|------|
| **小程序** | `alipay-miniapp/` | TypeScript + Less + AXML | — |
| **管理后台** | `leads-platform/` | React 16 + Ant Design 5 + TypeScript | 3000 (dev) |
| **后端服务** | `Ghidorah/` | Node.js + Express + TypeScript + NeDB | 3001 |

### 业务定位

整合**支付宝、易车、优酷、车巴巴**等多渠道销售线索，分发至**一汽丰田(FTMS)、五菱、奔驰、昊铂(Hyper)** 等主机厂。

---

## 二、后端服务 Ghidorah

### 2.1 技术架构

```
Ghidorah/
├── 基础框架: Express 4.x + TypeScript 3.6
├── 数据库:   NeDB (嵌入式文件数据库，分 devDb/ 和 proDb/)
├── 认证:     JWT (HS256) + bcryptjs
├── 支付宝:   alipay-sdk 3.6.1 (3个SDK实例)
├── 定时任务: node-cron
├── 日志:     Winston + log4js
├── DI容器: typedi
├── 短信:   tencentcloud-sdk-nodejs-sms
└── 部署:   PM2 (cluster模式, 4G内存)
```

### 2.2 启动流程 (src/loaders/index.ts)

```
启动 Express App
  ├── Winston 日志初始化
  ├── 实例化 3 个 AlipaySdk
  │    ├── 主应用 (营销投放)
  │    ├── 小程序 (授权登录)
  │    └── 联合会员 (FTMS会员回传)
  ├── DB 初始化 (NeDB)
  ├── 腾讯云短信客户端
  ├── DI 注入 (typedi)
  ├── 定时任务启动
  ├── 种子数据加载
  └── Express 路由挂载
```

### 2.3 路由总览 (25+ 路由模块)

#### 🔐 认证路由

| 路由文件 | 前缀 | 关键端点 |
|----------|------|----------|
| `user.ts` | `/api/user` | `POST /register`、`POST /login`、`POST /validate` |
| `appAuth.ts` | `/api/app/auth` | `POST /code-login`（静默授权）、`POST /phone-login`（手机号登录） |

**小程序登录流程:**
```
客户端                    后端                          支付宝
  │  my.getAuthCode ──────→│  POST /app/auth/code-login ──→alipay.system.oauth.token
  │                        │←──── { userId } ──────────────
  │  my.getPhoneNumber ───→│  POST /app/auth/phone-login ─→alipay 解密手机号
  │                        │←──── { token, userInfo } ────
  │  setToken(token) ──────→│  后续请求携带 Bearer token
```

#### 📱 小程序端 API (路径 /api/app/)

| 路由文件 | 路径前缀 | 端点 | 鉴权 |
|----------|----------|------|------|
| `activityApp.ts` | `/app/activity` | `GET /` 活动列表、`GET /detail?code=` 活动详情（含字典） | 否 |
| `activityFormSubmitApp.ts` | `/app/activity-form` | `POST /submit` 提交报名表单（判重+异步回传一丰） | 否 |
| `clueApp.ts` | `/app/clue` | `GET /` 预约列表、`GET /:id` 详情、`PUT /:id/agreement` 上传协议、`POST /:id/claim-benefit` 领取权益 | **是** |
| `banner.ts` | `/app/banner` | `GET /list` Banner轮播图 | 否 |
| `bottomMenu.ts` | `/app/bottomMenu` | `GET /list` 底部菜单 | 否 |
| `benefitApp.ts` | `/app/benefit` | `GET /list` 权益列表 | 否 |
| `dictionaryApp.ts` | `/app/dictionary` | `GET /list` 字典数据 | 否 |

#### 🖥️ 管理后台 API (路径 /api/platform/)

| 路由文件 | 路径前缀 | 关键端点 | 鉴权 |
|----------|----------|----------|------|
| `activityPlatform.ts` | `/platform/activity` | CRUD、`/uploadImage`、`/toggleStatus` | **是** |
| `platform.ts` | `/platform` | `/lead/list`、`/lead/download`、`/lead/uploadLeads`、`/project/*`（项目管理CRUD+日历）、`/leadReturn/*`（回传数据） | **是** |
| `dictionary.ts` | `/platform/dictionary` | CRUD + 字典项CRUD + `/importXlsx` | **是** |
| `benefit.ts` | `/platform/benefit` | CRUD | **是** |
| `banner.ts` | `/platform/banner` | CRUD | **是** |
| `bottomMenu.ts` | `/platform/bottomMenu` | CRUD | **是** |

#### 🔗 第三方对接路由

| 路由文件 | 前缀 | 用途 |
|----------|------|------|
| `activity.ts` | `/api/activity` | 优酷线索：省份/城市/经销商/车系查询+保存 |
| `alipay.ts` | `/api/v2/alipay` | 支付宝优惠券/权益发放/SPI留资 |
| `ftms.ts` | `/api/v2/ftms` | FTMS（一丰）经销商/城市/省份/车系查询 |
| `hyper.ts` | `/api/v2/hyper` | 昊铂(Hyper)线索推送 |
| `member.ts` | `/api/v2/member` | 一丰会员：查用户/发验证码/注册/联合会员回传 |
| `tencent.ts` | `/api/v2/cloud` | 腾讯云短信发送 |
| `monitor.ts` | `/api/monitor` | 点击监测记录 |
| `attribution.ts` | `/api/v2/attri` | 广告归因 |
| `report.ts` | `/api/report` | 报表 |
| `jobs.ts` | `/api/jobs` | 定时任务手动触发 |
| `activityV2.ts` | `/api/v2/activity` | V2活动：线索保存/上传/下载/协议/审核 |

### 2.4 第三方集成配置 (.env + config/index.ts)

| 平台 | 配置项 | 用途 |
|------|--------|------|
| **支付宝** | appId: 2021004107699617 | 营销投放 + 小程序授权 + 联合会员 |
| **易车** | pre-clue.yiche.com / dsp.yiche.com | 线索推送到易车DSP |
| **一丰FTMS** | s.ftms.com.cn | 一汽丰田线索回传 |
| **一丰联合会员** | hapi.ftms.com.cn | 会员注册/绑定 |
| **五菱** | ipaas-dev-scloud.gacmotor.com | 广汽五菱线索推送 |
| **奔驰** | api.oneweb.mercedes-benz.com.cn | 奔驰线索回传 |
| **昊铂Hyper** | dmstest.gacne.com.cn | 昊铂线索加密推送 |
| **优酷** | 29823001 | 优酷广告线索 |
| **车巴巴** | cbbofpdLUutVebsHZJZdkLpcVzTPsQRTfgR | 车巴巴线索 |
| **腾讯云短信** | SmsSdkAppId: 1400927714 | 短信通知(北京朗箴科技) |

### 2.5 数据模型

使用 NeDB 文件数据库，模型位于 `src/db/models/`，约 20 个模型：

- **核心业务**: Activity、Clue (JobsLead)、ActivityFormSubmit、Benefit、Banner、BottomMenu、Dictionary
- **平台管理**: Project (含项目周期/推送配置)、User、Lead、LeadReturn
- **第三方**: CouponList、AlipayLead、HyperLead、BenzLead

### 2.6 定时任务 (src/jobs/)

| 任务 | 功能 |
|------|------|
| `alipay/` | 拉取支付宝投放落地页线索 |
| `alipay_wuling/` | 拉取五菱落地页线索 → 推送到五菱 |
| `yiche/` | 线索推送到易车DSP |
| `youku/` | 优酷/车巴巴线索推送 |

### 2.7 关键注意事项

- **NeDB 数据库**：非生产级数据库，文件形式存储，`devDb/` 和 `proDb/` 分离
- **JWT 密钥**：`.env` 中 `JWT_SECRET = 'p4sta.w1th-b0logn3s3-s@uce'`，有效期 86400s
- **部署**：PM2 cluster 模式，端口 3001，需要先 `tsc` 编译到 `build/`
- **RSA 密钥**：.env 外还有 `rsa/`、`private_RSA2048.txt`、`alipayPublicKey_RSA2.txt` 等多套密钥文件

---

## 三、管理后台 leads-platform

### 3.1 技术架构

```
leads-platform/
├── 框架: React 16.13 + Create React App (CRACO 构建)
├── UI库: Ant Design 5.29 + @ant-design/pro-components 2.6
├── 路由: react-router-dom 6.15 (BrowserRouter)
├── HTTP: friday-async 封装的 axios
├── 认证: js-cookie (token_jwt) + 401拦截跳转
├── 样式: Less (craco-less)
├── Excel: exceljs 4.4
└── 语言: TypeScript 4.4
```

### 3.2 路由表

```
/login — 登录页
/     — 主布局 (Layout)
  ├── /activity                    — 活动管理 (列表)
  │   └── /activity/leads/:code   — 活动线索详情
  ├── /benefit                     — 权益管理
  ├── /dictionary                  — 字典管理
  ├── /banner                      — 轮播图管理
  ├── /bottomMenu                  — 底部菜单管理
  ├── /project                     — 项目管理 (列表)
  │   ├── /project/:id             — 项目详情
  │   │   ├── 项目推送日历 (calendar)
  │   │   ├── 线索明细 (lead)
  │   │   ├── 易车回传线索 (leadreturn)
  │   │   └── 易车项目信息 (sendInfo)
  │   └── /project/:id/:type      — 项目详情(Tab)
  └── /media/report               — 线索推送报表 (Analysis)
/good/lead                         — 权益商品录入 (独立页)
```

### 3.3 页面功能详解

#### 🏠 Layout 布局
- 顶部 Header: Logo + "小程序"选项卡(活动/权益/字典/Banner/底栏) + "线索报表"选项卡
- 左侧 Sider: 仅在"小程序"模块显示，含 5 个子菜单

#### 📋 Activity 活动管理
- 列表: 活动名称、标识、展示图、权益、表单字段数、状态、创建时间
- 新建/编辑 Drawer (700px): 四个折叠面板
  - 基本信息: 名称/标题/标识/描述/展示图/头图/底图
  - 权益配置: 关联已有权益
  - 协议配置: 协议上传开关
  - 表单字段: 动态字段管理，支持预设快速添加(姓名/手机/车型/省份/城市/经销商)、自定义字段、排序拖拽、select类型引用字典或自定义选项
- 操作: 上线/下线、删除、跳转线索页

#### 📊 Analysis 线索报表
- 最复杂页面，支持:
  - 筛选: 时间/推送状态/会员类型/活动类型(15+种)/线索来源/手机号
  - 表格: ID/手机号/活动类型/车系/会员类型/来源/权益状态/创建时间/一丰回传/短信/合同/审核
  - 批量短信发送(需卡密验证)
  - Excel 报表下载
  - 合同审核 Modal (通过/拒绝)
  - 单条删除

#### 🖼️ Banner / BottomMenu 管理
- 结构相同: 表格展示 + CRUD Drawer
- Banner: 图片上传、跳转链接、是否跳转 Switch
- BottomMenu: 图标上传、跳转链接、排序权重

#### 💰 Benefit 权益管理
- 表格: 名称/描述/图片/创建时间
- CRUD Drawer: 名称/描述/图片(上传或手动URL)

#### 📖 Dictionary 字典管理
- 主表格: 标识/名称/数据项数
- 字典项管理 Drawer (800px): 标签/值/父级值/排序
- xlsx 导入: 支持替换/追加模式

#### 🔄 Project 项目管理
- 列表: 项目名称/类型/周期/易车项目/推送时间/状态
- 新建 Drawer: 名称/类型(固定/灵活)/关联易车项目/周期/推送时间/状态
- 详情 Tab:
  - **推送日历**: antd Calendar，展示每日限额/已推送/进度
  - **线索明细**: 筛选+导出+上传线索
  - **易车回传**: 筛选(7天内)+导出
  - **易车项目信息**: 需求额度/品牌/车系

### 3.4 API 层架构

```
apiProvider.tsx (注入 axiosInstance)
  └── apiRegister.ts (集中注册)
      ├── project: ProjectApis
      ├── activity: ActivityApis
      ├── user: LoginApis
      ├── analysis: AnalysisApis
      ├── dictionary: DictionaryApis
      ├── benefit: BenefitApis
      ├── banner: BannerApis
      └── bottomMenu: BottomMenuApis

axiosInstance 配置:
  - baseURL: config.host + '/api/platform'  (开发: http://localhost:3001/api/platform)
  - 请求拦截: 自动附加 "Bearer {token_jwt}" (从 js-cookie 读取)
  - 响应成功: 返回 response.data
  - 401: 跳转 /login
```

### 3.5 环境配置

| 环境 | host | imgHost |
|------|------|---------|
| 开发 (NODE_ENV≠production) | `http://localhost:3001` | `http://localhost:3001/` |
| 生产 (NODE_ENV=production) | `''` (空，同域名) | `location.origin + '/'` |

---

## 四、小程序 alipay-miniapp

### 4.1 技术架构（详见 v1.0 文档）

```
alipay-miniapp/
├── 框架: 支付宝小程序原生框架
├── 语言: TypeScript + Less + AXML
├── 类型: @mini-types/alipay
└── 懒加载: lazyCodeLoading: "renderedComponents"
```

### 4.2 页面路由 (6 个)

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `pages/index/index` | Banner + 活动列表 + 自定义 TabBar |
| 活动详情 | `pages/activity/detail/detail` | 4步流程：表单→上传→协议→完成 |
| 预约列表 | `pages/clue/list/list` | 预约记录 + 审核/权益标签 |
| 预约详情 | `pages/clue/detail/detail` | 详情 + 重传协议 + 权益领取 |
| 用户中心 | `pages/user/index/index` | 个人信息 + 退出登录 |
| 登录 | `pages/login/login` | 静默授权 + 手机号授权 |

### 4.3 API 请求配置

```
BASE_URL: 'http://192.168.100.44:3001/api/app'
IMG_HOST: 'http://192.168.100.44:3001/'
```

### 4.4 页面导航关系

```
首页 (Banner+活动列表)
  └─→ 活动详情 (动态表单4步流程)
       └─→ 提交成功 → 返回首页

用户中心 → 登录页 (支付宝授权)
  ├─→ 我的预约 (列表)
  │    └─→ 预约详情 (协议/权益)
  └─→ 退出登录
```

---

## 五、完整数据流

```
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   管理后台 (B端)   │    │    后端服务        │    │   小程序 (C端)     │
│                   │    │                   │    │                   │
│  登录 → JWT token │───→│ /api/platform/*   │    │                   │
│  创建活动/权益     │───→│ NeDB 存储         │    │                   │
│  配置 Banner/菜单  │───→│                   │←───│ /api/app/*        │
│  字典管理          │───→│                   │←───│ 获取活动/权益      │
│                   │    │                   │←───│ 提交报名表单       │
│                   │    │                   │←───│ 上传协议/领权益    │
│                   │    │                   │    │                   │
│  线索报表 ←─── 数据 │    │ 表单提交 → 判重   │    │                   │
│  合同审核 ───→     │    │        → 异步回传  │    │                   │
│  短信发送 ───→     │    │          ├─ FTMS  │    │                   │
│                   │    │          ├─ 易车   │    │                   │
│                   │    │          ├─ 奔驰   │    │                   │
│  项目管理 (易车)    │───→│          └─ Hyper │    │                   │
│                   │    │                   │    │                   │
│                   │    │  定时任务:          │    │                   │
│                   │    │   拉取支付宝/五菱线索 │    │                   │
│  监测告警 ←───     │    │   推送易车/优酷线索  │    │                   │
└──────────────────┘    └──────────────────┘    └──────────────────┘
```

---

## 六、部署架构

```
PM2 cluster (Ghidorah)
  ├── 实例1 → port 3001
  ├── 实例2 → port 3001
  └── ...

Nginx (推测)
  ├── /api/*       → proxy_pass http://localhost:3001
  ├── /imgUploads/  → static files
  ├── /uploads/     → static files
  └── /*           → leads-platform build/ (SPA)
```

---

## 七、通用技术规范

### 7.1 样式约定

| 属性 | 小程序 | 管理后台 |
|------|--------|----------|
| 主色 | #1677FF | Ant Design 默认 |
| 渐变色 | #1677FF → #4096FF | — |
| 成功 | #52C41A | Ant Design Success |
| 警告 | #FAAD14 | Ant Design Warning |
| 错误 | #FF4D4F | Ant Design Error |

### 7.2 状态枚举映射

| 字段 | 值 | 含义 | 颜色 |
|------|-----|------|------|
| reviewStatus | pending | 待审核 | 橙色 #FAAD14 |
| reviewStatus | approved | 已通过 | 绿色 #52C41A |
| reviewStatus | rejected | 已驳回 | 红色 #FF4D4F |
| benefitClaimStatus | unclaimed | 未领取 | 灰色 |
| benefitClaimStatus | claimed | 已领取 | 蓝色 #1677FF |
| status (活动) | active | 启用 | 绿色 |
| status (活动) | inactive | 已下线 | 红色 |
| projectStatus | effective | 生效中 | 绿色 |
| projectStatus | unEffective | 已过期 | 红色 |

---

## 八、已知问题与改进建议

### 🔴 高优先级

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| 1 | **API 地址硬编码** | 小程序 `request.ts` | 创建 `config.ts` 区分开发/生产环境 |
| 2 | **`getUserProfile` 缺失** | 小程序 `user/index.ts` | 后端需添加 `/app/user/profile` 接口 |
| 3 | **NeDB 非生产级** | 后端 `/db/` | 规划迁移到 MongoDB（.env 中已有 MONGODB_URI 但未启用） |
| 4 | **JWT Secret 弱密钥** | 后端 `.env` | 生产环境更换强随机密钥 |
| 5 | **敏感信息泄露** | 后端 `.env` / `config/index.ts` | 腾讯云密钥、各平台 token 不应提交到代码仓库 |
| 6 | **TypeScript 版本陈旧** | 后端 TS 3.6 | 升级到 4.x+ |
| 7 | **React 版本陈旧** | 管理后台 React 16.13 | 升级到 18.x |
| 8 | **`getUserProfile` 接口缺失** | 小程序 api.ts | 补充接口定义 |

### 🟡 中优先级

| # | 问题 | 位置 | 建议 |
|---|------|------|------|
| 9 | 小程序 `px`/`rpx` 混用 | 首页 less | 统一为 `rpx` |
| 10 | 大量 `any` 类型 | 所有项目 | 补充 interface 定义 |
| 11 | 图片占位符用外部 URL | 小程序 axml | 替换为本地/CDN 占位图 |
| 12 | 代码重复 | 小程序 `reviewStatusText` 函数双写 | 抽取到 utils |
| 13 | 管理后台路由 `index: true` 重复 | `routes.tsx` 多处冗余 | 清理 |

### 🟢 低优先级

| # | 问题 | 建议 |
|---|------|------|
| 14 | 定时任务日志监控不足 | 增加任务执行状态告警 |
| 15 | 文件上传无大小限制 | multer 添加 limits 配置 |
| 16 | `navigateBack` 风险 | 登录成功后的返回可能无历史栈 |

---

## 九、开发/调试指南

### 9.1 本地启动

```bash
# 1. 后端
cd Ghidorah
yarn start          # nodemon 开发模式，端口 3001

# 2. 管理后台
cd leads-platform
yarn start          # craco start，端口 3000

# 3. 小程序
# 用支付宝 IDE 打开 alipay-miniapp/
# 修改 request.ts 中 BASE_URL 指向本地后端
```

### 9.2 后端生产部署

```bash
cd Ghidorah
yarn build          # tsc 编译到 build/
pm2 start ecosystem.config.js
```

### 9.3 管理后台生产构建

```bash
cd leads-platform
yarn build          # 输出到 build/
```

### 9.4 数据库

- 开发环境：`Ghidorah/devDb/` 下的 `.db` 文件
- 生产环境：`Ghidorah/proDb/` 下的 `.db` 文件
- 备份：直接复制 `.db` 文件即可

---

## 十、扩展开发指引

### 新增小程序功能

1. 在 `alipay-miniapp/pages/` 下创建新页面目录（.ts + .axml + .less + .json）
2. 在 `app.json` → `pages` 中注册
3. 后端新建路由文件 `src/api/routes/xxxApp.ts` + 控制器
4. 在 `src/api/index.ts` 中注册路由
5. 小程序 `api.ts` 中添加接口方法

### 新增管理后台功能

1. 在 `leads-platform/src/pages/` 下创建页面目录
2. 创建 `apis.ts` 定义接口
3. 在 `apiRegister.ts` 中注册
4. 在 `routes.tsx` 中添加路由配置
5. 如需要侧边栏菜单，在 `Layout/index.tsx` 中添加

### 新增第三方平台对接

1. 在后端 `src/config/index.ts` 添加平台配置
2. 建立 `src/api/routes/` 路由 + `src/api/controller/` 控制器
3. 实现线索接收/推送逻辑
4. 如需定时拉取，在 `src/jobs/` 添加定时任务

---

*本文档基于完整源码分析（3个项目，150+个文件），供团队开发和交接参考。*
