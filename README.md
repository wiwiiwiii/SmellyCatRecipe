# 小狗咪的喂食器

English name: Puppy Cat Feeder

一个给女朋友点餐用的微信小程序项目。当前版本使用原生微信小程序结构，支持浏览菜单、选择菜品、填写口味备注、生成点菜单、发送给主人、查看状态、一键复点和自建后端接入。

## 本地验证

```bash
npm test
```

## 本地检查

```bash
npm run check
```

这个命令会执行 JS 语法检查、小程序配置检查和全部 Node 测试。

## 启动小程序

1. 打开微信开发者工具。
2. 选择“导入项目”，目录选择本仓库根目录。
3. 如果没有正式 AppID，使用测试号导入。
4. 编译后进入“小狗咪的喂食器”启动页，后端登录后会按微信 `openid` 自动进入小猫端或主人端。

## 启动后端

后端使用 Node.js 原生 HTTP 服务和 PostgreSQL。数据库结构通过 SQL migration 管理，启动前需要设置数据库、token 和微信小程序相关环境变量。

```bash
createdb smelly_cat_recipe
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/smelly_cat_recipe
export TOKEN_SECRET=local-development-secret-change-before-deploy
npm run backend:migrate
npm run backend:seed
npm run backend:dev
```

启动后访问：

```bash
curl http://localhost:3000/health
```

更多说明见 `docs/backend.md`。

也可以用 Docker 启动本地 Postgres 和 API：

```bash
docker compose up --build
```

## 测试主人端

1. 在 `.env.production` 或本地 `docker-compose.override.yml` 里配置 `WECHAT_CAT_OPENIDS` 和 `WECHAT_MASTER_OPENIDS`。
2. 小猫微信进入小程序，选择餐次、状态和菜品。
3. 点击“生成点菜单”，进入预览页后再点击“发送给主人”。
4. 主人微信进入小程序，会自动进入主人端并看到待处理订单。
5. 如需替换，在主人端从菜品下方的替换选项中点一个建议，回到小猫端确认或拒绝。
6. 如需取消，可在主人端点“取消这单”，或在小猫端点“咪不吃了”。
7. 咪确认替换后，主人端点击“主人收到啦”，再依次点击“开始做饭”、“做好了，叫咪来吃”。
8. 小猫端首页点击“看小愿望状态”，确认状态已经同步更新。
9. 小猫端点击“吃过的”，确认完成订单进入历史，并可点击“再来一份”生成新的点菜单草稿；取消订单不会作为吃过的菜单展示。
10. 主人端点击“菜单维护”，新增、编辑或隐藏菜品，确认小猫端只看到未隐藏的菜。

## 当前功能

- 暖黑风格的小猫端点餐首页。
- 午饭 / 晚饭 / 夜宵餐次选择。
- 食欲 + 情绪状态选择。
- 菜品多选、搜索和愿望菜入口。
- 点菜单草稿预览和单独“发送给主人”流程。
- 点餐结果页展示订单明细、当前中文状态和备用复制文案。
- 小猫端可回看最近点餐状态，主人端更新后会刷新显示。
- 小猫端历史订单和一键复点。
- 开发态主人端可查看当前订单，并完成接单、开始做饭、做好饭流程。
- 开发态主人端可从菜单中选择替换建议，小猫端确认后主人才能继续接单。
- 主人端和小猫端都可取消未完成订单。
- 开发态主人端可新增、编辑、隐藏和恢复菜品。
- 自建后端：Postgres 连接、可迁移 schema、微信登录、菜单维护、订单状态、替换确认、取消、已读标记和微信订阅消息发送。
- 后端按微信 `openid` 区分小猫端和主人端。
- 生产部署说明见 `docs/deployment.md`。

## 后续方向

- 配置正式微信订阅消息模板 ID。
- 部署 HTTPS API，设置 `services/api-config.js` 的 `API_BASE_URL`，并在微信后台加入 request 合法域名。
