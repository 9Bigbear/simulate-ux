# Simulate-UX (模拟用户体验) 🚀

> **模拟真实人类的“眼睛看”与“动手点”，对 Web 应用进行多视角全链路 UX 走查与极限混沌测试。**  
> 专门解决 AI 助手（Antigravity、Codex、Claude Code、Cursor 等）在被要求“体验一下产品”时**浮于表面、只读代码、缺乏真实交互与破坏性测试**的通病。

---

## 💡 为什么需要这个 Skill？

大部分 AI 评测产品体验时的致命缺陷：
1. **纸上谈兵**：读两眼代码或者扫一下静态 HTML 就说“界面设计美观、体验良好”。
2. **缺乏真实交互**：没有真实鼠标滑过、没有输入延迟、没有等待异步请求与骨架屏。
3. **缺乏破坏性视角**：真实用户会手抖、连点、反悔按 ESC、网络卡顿时狂按提交。

**`Simulate-UX`** 的核心理念：
$$\text{最强体验组合} = \underbrace{\text{Playwright}}_{\text{真实物理手脚}} + \underbrace{\text{Chaos Monkey (Gremlins机制)}}_{\text{暴躁手残狂点}} + \underbrace{\text{多模态 Vision 大模型}}_{\text{挑剔审美的眼睛}}$$

---

## 🎭 四重拟人人格走查标准 (Personas)

每次启动体验，模拟器驱动 Agent 代入四种不同的真实角色：

| 人格角色 | 核心关注点 | 重点检测问题 |
| :--- | :--- | :--- |
| **A. 零背景小白用户** | 3 秒直觉法则、引导清晰度、认知负荷 | 主入口隐蔽、图标缺乏说明、加载态无反馈 |
| **B. 像素级挑刺设计师** | 视觉层级、对齐、留白、字体截断 | 深色模式对比度过低 (WCAG违规)、长文字撑爆容器、边缘毛刺 |
| **C. 暴躁与手残党 (混沌)** | 极端高频连击、反悔、网络弱网、非法输入 | 按钮未做防抖、重复请求、DOM 卡死、未捕获 JS 异常导致的白屏 |
| **D. 业务重度创作者** | 端到端主闭环、状态持久化、Undo/Redo | 撤销重做坐标跳变、页面刷新后草稿丢失、数据未持久化 |

---

## 🛠️ 快速上手

### 1. 安装依赖
```bash
npm install playwright
# 或
pnpm add playwright
```

### 2. 命令行独立运行
```bash
# 全功能深度体验（首屏视口截图 + 真实平滑交互 + 8秒混沌狂点）
node scripts/ux-engine.js --url="http://localhost:3000" --mode=full --duration=8

# 仅视觉与正常浏览巡检
node scripts/ux-engine.js --url="https://example.com" --mode=inspect

# 移动端视口测试 (如 iPhone 14 尺寸)
node scripts/ux-engine.js --url="http://localhost:3000" --viewport=390x844
```

### 3. 作为 Agent Skill 接入

- **Antigravity**: 放置于 `~/.gemini/config/skills/simulate-ux/` 或当前项目的 `.agents/skills/simulate-ux/`。
- **Claude / Codex / 自定义 Agent**: 将 `SKILL.md` 加入 Agent 系统提示词或技能库，并通过 CLI 调用 `scripts/ux-engine.js` 获取视觉快照与异常数据。

---

## 📊 产出物与报告标准

运行后自动在 `.ux-reports/` 目录下生成：
1. `01_initial_impression.png`：首屏视觉快照。
2. `02_after_navigation.png`：平滑滚动与拟人交互后截图。
3. `03_after_chaos_test.png`：经历高频混沌暴力点击后的最终页面状态。
4. `ux-report-data.json`：包含捕获的所有控制台报错、未捕获异常、失败网络请求及点击频次统计。
5. 最终生成包含 **P0（阻断）~ P3（建议）** 级别的结构化 UX 诊断报告（模版见 `resources/ux-report-template.md`）。

---

## 📄 License
MIT License.
