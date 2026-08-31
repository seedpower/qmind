# QMind

思维导图工作台：Next.js App Router + MongoDB + [xyflow](https://reactflow.dev/)。

## 运行

1. 本地 MongoDB 监听 `27017`（当前仓库默认连接 `mongodb://127.0.0.1:27017`）。
2. 复制环境变量：

```bash
cp .env.example .env.local
```

3. 安装并启动：

```bash
npm install
npm run dev
```

打开终端提示的地址（默认 [http://localhost:3000](http://localhost:3000)；若 3000 被占用会自动改用 3001）。

## 使用

- 首页创建脑图，点击卡片进入画布
- 从节点右侧手柄拖到空白处：生成子节点
- `Tab` 添加子节点，`Enter` 添加同级，`Delete` 删除子树
- 工具栏 **整理** 使用 [ELK.js](https://github.com/kieler/elkjs) 自动排版（向右层次 / 向下 / 辐射）
- `L` 向右整理，`Shift+L` 辐射排版
- 修改后约 1 秒自动写入 MongoDB `qmind.maps`

脑图以单文档存储（节点和边嵌在同一份 document 里），列表页只投影标题与节点数。
