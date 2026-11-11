---
name: simulate-ux
description: >-
  Simulate real-world human eyes and hands to perform deep, end-to-end, multi-persona UX/UI audits and chaos testing on web applications, prototypes, or competitor sites. Use whenever the user asks to "experience the page", "audit UX", "test user flow", "check if it crashes under rage clicks", "simulate user experience", or mentions "用体验+rea+视觉角度去逆向画布", "逆向画布体验", or "视觉与交互体验走查". Enforces visual inspection, physical click/drag journeys via Playwright, and chaos monkey stress testing.
---

# 模拟用户体验（UX）深度走查与混沌测试规范 (Simulate UX Skill)

> **核心宗旨**：真正的用户不用眼睛看代码，也不按程序员预想的完美逻辑点击。  
> 体验 Web 应用时，**严禁仅阅读源代码或扫两行 DOM 给出浮于表面的口头称赞**。必须通过自动化物理引擎、真实视口截图和极端混沌测试，像真实人类一样“看”和“点”。

---

## 一、 体验铁律（Three Inviolable Principles）

1. **绝对禁止“纸上谈兵”**：
   收到体验请求后，必须真实启动物理浏览器（Playwright / Chrome DevTools），打开目标页面并捕捉高清视口截图。
2. **多视角四重人格（Personas）切换**：
   不可只扮演“熟门熟路的开发者”，必须代入小白、挑剔设计师、手残党、重度业务用户等不同心理状态。
3. **闭环与极端压力测试**：
   体验不仅要走通“快乐路径（Happy Path）”，必须包含反悔（Cancel/ESC/Back）、高频狂点（Rage Click）、窗口缩放与弱网等破坏性测试。

---

## 二、 四重拟人人格走查标准

### 1. 零背景小白（Persona A: Zero-Context Novice）
- **心理状态**：毫无预备知识，注意力极其稀缺（3 秒法则）。
- **走查重点**：
  - 核心入口和主要行动点（CTA）是否突出？还是被淹没在深灰背景中？
  - 图标是否有直观含义或 Tooltip 解释？
  - 页面加载或执行操作时是否有清晰的反馈（Spinners、Skeleton、Progress）？

### 2. 像素级挑刺设计师（Persona B: Pixel-Perfect Designer）
- **心理状态**：对排版对齐、留白、字体和对比度有强迫症。
- **走查重点**：
  - 视觉层级与对比度（WCAG 2.1 AA 标准）：深色模式下的文字是否因为对比度过低而看不清？
  - 文本溢出与截断：长标题、特殊符号在固定卡片内是否撑破布局？
  - 间距一致性：内边距、外边距、图标与文字的垂直居中是否严丝合缝。

### 3. 暴躁与手残党（Persona C: Chaotic Gremlin / Monkey Testing）
- **心理状态**：网络卡顿、手抖连点、乱滚滚轮、在未保存时狂按刷新。
- **走查重点**：
  - **防抖与并发**：连续快速点击“生成/保存/新建”按钮 10~20 次，是否触发重复请求或导致状态错乱？
  - **反悔与遮罩**：弹窗展开时乱点背景、连续按 ESC、拖拽中途松开鼠标，是否能干净退出？
  - **异常输入**：输入框黏贴 500 个字符、特殊 emoji、全角空格，是否导致崩溃？

### 4. 业务重度创作者（Persona D: Power User Flow）
- **心理状态**：追求效率，依赖多步骤工作流与状态恢复。
- **走查重点**：
  - 端到端完成一个真实创作闭环（如：从新建项目到完成导出）。
  - Undo / Redo（撤销重做）是否能完美恢复每一个步骤？
  - 刷新页面后，未保存的草稿或重要配置是否丢失？

---

## 三、 执行工具箱与操作指南

根据目标类型选择对应的执行命令：

### 1. 通用 Web / 竞品页面体验：`ux-engine.js`
支持测试任意本地或远程 URL，内置视觉截屏、真实平滑移动和本地离线混沌狂点测试。

```bash
# 完整测试（截图 + 正常滑动 + 8秒混沌狂点）
node "C:\Users\Administrator\.gemini\config\skills\simulate-ux\scripts\ux-engine.js" --url="http://localhost:3000" --mode=full --duration=8

# 仅视觉与正常浏览巡检
node "C:\Users\Administrator\.gemini\config\skills\simulate-ux\scripts\ux-engine.js" --url="https://example.com" --mode=inspect

# 针对移动端视口 (iPhone 14)
node "C:\Users\Administrator\.gemini\config\skills\simulate-ux\scripts\ux-engine.js" --url="http://localhost:3000" --viewport=390x844
```

### 2. Copylovart 3 项目专用体验：`run-copylovart-ux.mjs`
针对当前工程内置了 Supabase Magiclink 自动鉴权，可无缝免登进入画布或项目大厅。

```bash
# 测试项目大厅及 6 秒混沌测试
node scripts/run-copylovart-ux.mjs --path=/projects --chaos=true --duration=6

# 测试指定画布
node scripts/run-copylovart-ux.mjs --path="/canvas?projectId=012c5f4b-eef3-4b84-89cb-35a60e51b8d8&masterPreview=4" --chaos=true
```

---

## 四、 报告产出标准 (UX Audit Deliverable)

执行完自动化测试后，Agent 必须读取生成的截图（使用视觉感知能力观察）和 `report.json` / 控制台日志，并严格按照 `resources/ux-report-template.md` 输出结构化走查报告：

1. **打分看板**：给 4 种人格打出 1~10 的心流体验分。
2. **视觉审查点**：指出截图中的具体排版问题（附截图路径）。
3. **混沌测试指标**：汇报触发了多少次点击、是否有未捕获异常、是否有控制台红色报错。
4. **问题清单（P0~P3）**：
   - **P0（阻断）**：白屏、状态卡死、未捕获 Fatal Error。
   - **P1（严重）**：缺少防抖导致的连击失控、数据未持久化、层级穿透。
   - **P2（中度）**：文字溢出、对比度不足、无 Tooltip。
   - **P3（建议）**：微动效与空白态优化。
5. **代码级改进方案**：给出精准到前端组件或状态管理（如 `useClickAway`, `debounce`, `stopPropagation`）的修改建议。
