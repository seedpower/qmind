# QMind

[English](README.md) | [中文](README.zh-CN.md)

基于 Next.js、MongoDB 与 [xyflow](https://reactflow.dev/) 的脑图工作区 — 可在浏览器编辑，也可通过 [MCP](https://modelcontextprotocol.io/) 供 AI Agent 调用。

## 功能

- 首页创建与管理脑图，打开卡片进入画布编辑
- 从节点右侧手柄拖到空白处创建子节点
- 快捷键：`Tab` 添加子节点，`Enter` 添加同级，`Delete` 删除子树
- 工具栏 **Arrange** 使用 [ELK.js](https://github.com/kieler/elkjs) 自动布局（右向 / 向下 / 径向）；`L` / `Shift+L` 快捷键
- 节点支持颜色、进度（0–100）与 Markdown 笔记
- 工具栏保存或 `Ctrl+S` 写入 MongoDB `qmind.maps`
- 远程 MCP 服务位于 `/api/mcp`，可在设置中生成 API Key

## 启动

需要本机 MongoDB（端口 `27017`）和 Node.js。

```bash
cp .env.example .env.local
npm install
npm run dev
```

打开终端打印的地址（默认 [http://localhost:3000](http://localhost:3000)；若 3000 被占用会回退到 3001）。

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `MONGODB_URI` | 默认 `mongodb://127.0.0.1:27017` |
| `MONGODB_DB` | 默认 `qmind` |
| `MCP_API_KEY` | 可选的额外 MCP Bearer Key（更推荐在设置中生成） |

每张脑图存为单个文档（节点与边嵌套在一起）。列表页只投影标题与节点数。

## MCP

QMind 通过远程 MCP 暴露与界面相同的编辑能力，地址为：

```
https://<your-host>/api/mcp
```

本地一般为 `http://localhost:3000/api/mcp`（或 `next dev` 打印的端口）。

在首页打开 **Settings** 生成 API Key，并从对话框复制 Cursor / Agent 配置片段。密钥只显示一次；QMind 仅存储哈希。

在尚未生成密钥且未设置 `MCP_API_KEY` 时，接口保持开放。生成密钥后，客户端需发送 `Authorization: Bearer <key>`。

仅支持 stdio 的客户端可用 [`mcp-remote`](https://www.npmjs.com/package/mcp-remote) 代理：

```json
{
  "mcpServers": {
    "qmind": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/api/mcp"]
    }
  }
}
```

工具：`list_maps`、`create_map`、`get_map`、`rename_map`、`delete_map`、`get_node`、`add_node`、`update_node`、`delete_node`、`move_node`、`layout_map`、`search_nodes`。

## 许可证

[MIT](LICENSE)
