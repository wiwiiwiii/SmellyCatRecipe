# 咪的喂食器 API Contract

## 目标

本文定义小程序前端与自建后端之间的第一版接口契约。接口围绕两类用户展开：

- 小猫端：咪，负责点餐、确认替换、查看历史和一键复点。
- 主人端：主人，负责维护菜单、接单、提出替换、开始做饭和完成订单。

机器可读规范见 `docs/api/openapi.yaml`。

## 基础约定

- Base URL：`https://api.example.com/v1`，实际域名上线前替换。
- 认证方式：除登录接口外，所有接口使用 `Authorization: Bearer <token>`。
- 时间格式：ISO 8601 UTC 字符串，例如 `2026-08-02T10:20:30.000Z`。
- ID 格式：服务端生成字符串 ID，例如 `ord_01H...`。
- Content-Type：请求和响应均为 `application/json`。
- 分页：列表接口使用 `cursor` 和 `limit`，响应返回 `nextCursor`。

## 角色

| 值 | 含义 |
| --- | --- |
| `cat` | 小猫端，咪 |
| `owner` | 主人端，主人 |

服务端通过微信登录得到的 `openid` 映射角色。前端不能自行声明正式身份；开发环境可以由后端开启测试身份切换。

## 餐次与状态

### 餐次

| 值 | 文案 |
| --- | --- |
| `lunch` | 午饭 |
| `dinner` | 晚饭 |
| `late_night` | 夜宵 |

### 咪的状态

| 值 | 文案 |
| --- | --- |
| `hungry` | 饿了，要顶饱 |
| `hot` | 想吃热乎的 |
| `meat` | 今天想吃肉 |
| `sweet` | 想来点甜的 |
| `tired` | 有点累，想省心 |
| `owner_pick` | 没主意，主人安排 |

## 订单状态机

| 状态 | 含义 | 允许触发人 |
| --- | --- | --- |
| `submitted` | 咪已提交订单，等待主人处理 | 小猫端 |
| `replacement_requested` | 主人提出替换，等待咪确认 | 主人端 |
| `accepted` | 主人已接单 | 主人端 |
| `cooking` | 主人开始做饭 | 主人端 |
| `completed` | 主人做好饭 | 主人端 |
| `cancelled` | 订单取消 | 小猫端或主人端 |

关键流转：

- `submitted -> replacement_requested`：主人提出替换。
- `replacement_requested -> accepted`：咪确认替换后，主人接单。
- `replacement_requested -> cancelled`：咪拒绝替换并取消。
- `submitted -> accepted`：主人直接接单。
- `accepted -> cooking`：主人开始做饭。
- `cooking -> completed`：主人做好饭。
- `submitted|replacement_requested|accepted|cooking -> cancelled`：咪或主人取消未完成订单。

## 错误格式

所有非 2xx 响应返回统一结构：

```json
{
  "error": {
    "code": "ORDER_INVALID_STATUS",
    "message": "当前订单状态不能执行该操作",
    "details": {
      "currentStatus": "completed"
    }
  }
}
```

常用错误码：

| code | 场景 |
| --- | --- |
| `AUTH_INVALID_CODE` | 微信登录 code 无效 |
| `AUTH_REQUIRED` | 缺少或无效登录态 |
| `FORBIDDEN_ROLE` | 当前角色不能执行操作 |
| `MENU_ITEM_NOT_FOUND` | 菜品不存在或不可见 |
| `ORDER_NOT_FOUND` | 订单不存在 |
| `ORDER_INVALID_STATUS` | 状态流转不合法 |
| `REPLACEMENT_CONFIRMATION_REQUIRED` | 替换未经咪确认 |
| `SUBSCRIPTION_NOT_AUTHORIZED` | 用户未授权对应订阅消息 |
| `WECHAT_API_FAILED` | 微信接口调用失败 |
| `WECHAT_OPENID_NOT_ALLOWED` | 当前微信未绑定小猫端或主人端 |

## 接口清单

### 登录与身份

#### `POST /auth/wechat-login`

小程序端调用 `wx.login()` 得到 `code` 后，把 `code` 发送给服务端。服务端调用微信 `code2Session` 换取 `openid`，再返回自定义登录态。

请求：

```json
{
  "code": "wx-login-code",
  "devRoleOverride": "cat"
}
```

`devRoleOverride` 只允许开发环境使用，正式环境忽略。正式环境只允许配置在 `WECHAT_CAT_OPENIDS` 或 `WECHAT_OWNER_OPENIDS` 中的微信用户登录。

响应：

```json
{
  "token": "jwt-or-session-token",
  "user": {
    "id": "usr_cat",
    "role": "cat",
    "displayName": "咪",
    "openidBound": true
  }
}
```

#### `GET /auth/me`

返回当前登录用户和角色。

### 菜单

#### `GET /menu-items`

查询菜单。小猫端默认只能看到 `hidden=false` 的菜；主人端可以通过 `includeHidden=true` 查看隐藏菜。

查询参数：

- `mealTime`：`lunch`、`dinner`、`late_night`
- `mood`：咪的状态
- `q`：搜索关键词
- `includeHidden`：主人端可用
- `cursor`、`limit`

#### `POST /menu-items`

主人端新增菜品。

请求：

```json
{
  "name": "番茄炒蛋盖饭",
  "description": "酸甜番茄汁拌米饭。",
  "catReason": "咪觉得这个拌饭会很安心。",
  "category": "main",
  "tags": ["不辣", "快手", "下饭"],
  "recommendedMealTimes": ["lunch", "dinner"],
  "recommendedMoods": ["hungry", "hot"],
  "estimatedMinutes": 15,
  "hidden": false
}
```

#### `PATCH /menu-items/{menuItemId}`

主人端编辑菜品，包含隐藏或重新显示。

### 订单

#### `POST /orders`

咪提交点餐。允许多道菜单菜和多个愿望菜。

小程序端可以先在本地生成点菜单草稿；草稿不会调用该接口，也不会出现在主人端。咪点击“发送给主人”后才调用该接口创建正式订单。

请求：

```json
{
  "mealTime": "dinner",
  "mood": "tired",
  "items": [
    {
      "menuItemId": "dish_tomato_egg_rice",
      "quantity": 1,
      "note": "米饭少一点"
    }
  ],
  "wishItems": [
    {
      "name": "咖喱猪排饭",
      "note": "如果主人方便的话"
    }
  ],
  "note": "今天想吃热一点"
}
```

响应返回订单详情，初始状态为 `submitted`。
订单创建后服务端将 `unreadByRoles.owner` 标记为 `true`，用于主人端显示新点餐提醒。

#### `GET /orders`

查询当前订单或历史订单。

查询参数：

- `scope=current`：当前未完成订单。
- `scope=history`：历史订单。
- `roleView=cat|owner`：前端当前展示视角，服务端仍以登录角色校验权限。
- `cursor`、`limit`

订单摘要包含当前登录角色视角下的 `hasUnreadUpdate`，用于列表页显示提醒标记。

#### `GET /orders/{orderId}`

查询订单详情，包含菜品、愿望菜、内部事件记录、替换请求、通知日志摘要和 `unreadByRoles`。

#### `POST /orders/{orderId}/read`

当前登录角色把该订单标记为已读。主人打开新点餐详情后清除主人侧提醒；咪打开主人更新后的订单详情后清除小猫侧提醒。

响应：

```json
{
  "order": {
    "id": "ord_01H...",
    "unreadByRoles": {
      "cat": false,
      "owner": false
    }
  }
}
```

#### `POST /orders/{orderId}/repeat-draft`

小猫端从已完成历史订单生成复点草稿。接口只返回草稿，不直接创建新订单；取消订单不作为“吃过的”菜单展示。

响应：

```json
{
  "mealTime": "dinner",
  "mood": "tired",
  "items": [
    {
      "menuItemId": "dish_tomato_egg_rice",
      "quantity": 1,
      "note": "米饭少一点"
    }
  ],
  "wishItems": [],
  "note": "今天想吃热一点"
}
```

### 替换确认

#### `POST /orders/{orderId}/replacement-requests`

主人端提出替换。订单进入 `replacement_requested`。

请求：

```json
{
  "replacements": [
    {
      "originalItemId": "ord_item_1",
      "replacementMenuItemId": "dish_beef_udon",
      "reason": "今天没有鸡翅，给主人换成热乎的乌冬可以吗？"
    }
  ]
}
```

#### `POST /orders/{orderId}/replacement-requests/{replacementRequestId}/confirm`

咪确认替换。确认后订单仍可保持 `replacement_requested`，直到主人接单；如果请求带 `autoAccept=true` 且调用者是主人后续动作，则服务端再进入 `accepted`。

请求：

```json
{
  "note": "可以，咪想吃热乎的"
}
```

#### `POST /orders/{orderId}/replacement-requests/{replacementRequestId}/reject`

咪拒绝替换。

请求：

```json
{
  "nextAction": "revise",
  "note": "咪还是想重新选一下"
}
```

`nextAction` 可为 `revise` 或 `cancel`。

### 主人端订单动作

#### `POST /orders/{orderId}/accept`

主人接单，订单进入 `accepted`。如果存在未确认替换请求，返回 `REPLACEMENT_CONFIRMATION_REQUIRED`。

#### `POST /orders/{orderId}/start-cooking`

主人开始做饭，订单进入 `cooking`。

#### `POST /orders/{orderId}/complete`

主人做好饭，订单进入 `completed`。

#### `POST /orders/{orderId}/cancel`

取消订单。咪和主人都可以调用，但服务端按状态校验是否允许。

请求：

```json
{
  "note": "咪不吃了"
}
```

取消后订单进入 `cancelled`，服务端把对方角色的未读标记置为 `true`。

### 通知

#### `GET /notification-templates`

返回前端需要请求授权的模板用途。模板 ID 可由服务端按环境返回，避免写死在小程序包里。

#### `POST /notification-subscriptions`

小程序调用 `wx.requestSubscribeMessage()` 后，把授权结果同步给服务端。

请求：

```json
{
  "sourceAction": "cat_submit_order",
  "results": [
    {
      "templateKey": "owner_new_order",
      "status": "accept"
    },
    {
      "templateKey": "cat_order_accepted",
      "status": "reject"
    }
  ]
}
```

#### `GET /notification-logs`

按订单查询通知发送记录，用于页面显示“提醒可能没发出去”。

查询参数：

- `orderId`
- `cursor`
- `limit`

## 前端 Mock 约定

前端在真实后端完成前可以实现同名 mock client。mock 必须保持：

- 路径和请求字段与本文一致。
- 订单状态流转规则与本文一致。
- 错误码与本文一致。
- 不在页面里硬编码正式身份，身份来自 mock 登录响应。
