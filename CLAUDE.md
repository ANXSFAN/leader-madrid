Este es el proyecto de produccion de Leader Madrid (fork de my-led-erp).

Marca: Leader Madrid
Color primario: #0088cc (azul / hsl 200 100% 40%) — igual que WordPress Porto theme
Color acento: #A7144C (magenta / hsl 337 79% 37%) — igual que WordPress WooCommerce accent

修复语法错误的时候请不要修改业务逻辑，尤其是不要在项目未完成的时候死磕npm run build的报错。

⚠️ 数据库操作安全规则：
- 绝对不要运行 `prisma migrate dev`（会提示 reset 导致数据丢失）
- Schema 变更只用 `prisma db push`（安全，不会丢数据）
- 需要生成 migration 文件时用 `prisma migrate diff` 生成 SQL，手动审核后执行
- 绝对不要在生产数据库上执行任何 DROP 或 TRUNCATE 操作
