# 更新日志

此项目的所有重要更改都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)。

## [未发布]

### 新增

- **ZIP 批量上传** - 支持通过 ZIP 压缩包批量上传图片
  - 使用 JSZip 在浏览器端解压
  - 分批处理（每批 50 张）防止内存溢出
  - 实时显示解压和上传进度
  - 支持为所有图片设置统一标签
  - 自动跳过非图片文件和超过 70MB 的文件

### 变更

- 当 WebP/AVIF 文件未生成/缺失时（例如超过 10MB 的上传），改用 Cloudflare Transform Images URL（`/cdn-cgi/image/...`）作为兜底输出方式。
- `/api/random` 改为 302 重定向到实际图片 URL（不再由 Worker 代理回源返回图片字节，Transform-URL 场景更稳定）。

### 修复

- 修复删除图片后上传页/管理页未及时刷新（TanStack Query 缓存 + recent uploads 列表导致需强刷）。
- 修复管理页「随机图 API 生成器」未能正确解析真实 API Base URL（改为从 `/api/config` 获取），仍输出占位链接 `https://your-worker.workers.dev` 的问题。
