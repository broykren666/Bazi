### 项目结构

```text
myproject/
├── server.js          # 主服务器文件
├── public/            # 静态文件目录
│   ├── index.html     # HTML结构
│   ├── style.css      # 样式文件
│   └── main.js        # 前端JavaScript
├── package.json       # 依赖配置
└── node_modules/      # 依赖包
```

### 安装和运行

```bash
# 1. 进入项目目录
cd D:\myproject\vps\Lunes\chrome-yoyo\www

# 2. 初始化package.json（如果还没有）
npm init -y

# 3. 安装依赖
npm install lunar-calendar

# 4. 安装nodemon（可选）
npm install --save-dev nodemon  // （用于开发调试）
npm install -g nodemon  // 全局安装
nodemon server.js  // 启动服务

# 7. 启动服务器
npm run dev
# 或者
node server.js

# 8. 访问浏览器
# http://localhost:8100
```
