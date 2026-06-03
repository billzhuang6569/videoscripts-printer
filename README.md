# 庄Sir的脚本打印器

把拍摄脚本表变成一张真正适合打印的 A4 表格。

它适合用来打印分镜表、拍摄脚本表、B-roll 清单、采访拍摄清单、客户证言拍摄表，以及从飞书表格/多维表格里整理出来的拍摄资料。你可以在网页里看到最终打印效果，调整字段、列宽、行高、分组和排序，然后直接打印或保存成 PDF。

![庄Sir的脚本打印器预览](https://pictshare.whatonearth.work/xx7wc7.jpg)

## 它解决什么问题

很多拍摄脚本表在飞书、表格或多维表格里很好编辑，但一到打印就容易变成：

- 字太小，列太挤；
- 图片和备注撑坏版面；
- 行高不合适，内容被截断；
- 拍摄区域、类型、待办事项混在一起，不方便现场使用；
- 临时想换字段顺序、改表头、隐藏某列，又要回源表里折腾。

这个工具做的事情很简单：**把脚本内容导入成本地打印 session，然后专心做打印排版。**

你可以把它理解成一个“脚本表打印前的整理台”。

## 主要功能

- A4 横向 / 纵向打印预览
- 直接打印，或通过浏览器保存为 PDF
- 调整字段顺序、字段显示名、字段类型、字段显隐
- 拖动或滑块调整列宽，图片会跟随列宽变化
- 固定行高 / 自动行高
- 按字段分组，比如按“拍摄区域”分组
- 按字段排序，比如按“镜头号”排序
- 支持文本、标签、TODO、图片附件
- 文本和 TODO 支持 Markdown 渲染
- 标签像飞书多维表格一样选择已有选项或创建新选项
- 每次打印 session 会保存自己的内容和排版，方便之后回溯

![标签编辑示例](https://pictshare.whatonearth.work/fmn0o3.jpg)

## 一个重要原则

这个工具不会修改你的飞书、表格或原始文档。

导入后，网页里编辑的是本地打印副本：

```text
原始内容源 -> 本地打印 session -> 网页调整 -> 打印 / PDF
```

所以你可以放心做最后一公里的排版和局部修正。源文件不会被回写。

## 快速开始

先确认电脑里有 Node.js。然后在项目文件夹里运行：

```sh
npm start
```

打开：

```text
http://localhost:4173
```

默认会看到示例脚本表。你可以先试试：

- 左侧拖动字段顺序；
- 调整列宽和行高；
- 点击标签单元格选择标签；
- 点击文字单元格直接编辑本地内容；
- 点击“打印 / 导出 PDF”。

## 和 Agent / Skill 配合使用

这个仓库里还带了一个配套 Skill：

```text
skills/zhuangsir-script-printer
```

它的作用不是替代网页，而是帮 Agent 做前面的准备工作：

```text
用户给脚本内容、JSON、飞书表格或其他 Skill 输出
-> Skill 检查并启动 HTML 打印器
-> Skill 把内容转换成打印 session
-> 打开网页
-> 用户在网页里调整、打印、保存 PDF
```

第一次使用时，Skill 会先尝试找到本地的 HTML 打印器。如果没有，它会引导安装本体，并保证后续写入 session 的脚本能正常运行。

这对不想研究 JSON、命令行和项目结构的人比较友好：你只需要告诉 Agent“把这个脚本打印出来”，剩下的导入和打开网页可以交给 Skill。

## 导入数据长什么样

打印器吃的是一个结构化 JSON。最常见字段类似这样：

```json
{
  "title": "项目拍摄脚本表",
  "fields": [
    { "id": "shot_no", "name": "镜头号", "type": "text" },
    { "id": "voiceover", "name": "旁白", "type": "text" },
    { "id": "visual", "name": "画面内容", "type": "text" },
    { "id": "reference", "name": "画面参考/分镜", "type": "image" },
    { "id": "todo", "name": "待办", "type": "todo" },
    { "id": "tags", "name": "标签", "type": "multiSelect" }
  ],
  "rows": [
    {
      "id": "row_001",
      "cells": {
        "shot_no": "01",
        "voiceover": "这里放旁白原文",
        "visual": "这里放画面内容",
        "reference": [{ "path": "assets/ref-001.jpg", "caption": "参考图说明" }],
        "todo": ["[ ] 确认场地", "[x] 准备设备"],
        "tags": ["外景", "重点"]
      }
    }
  ]
}
```

实际使用时，不需要普通用户手写这些。更推荐让 Agent 或其他导入脚本生成。

## 文件会保存在哪里

每次导入会生成一个 session 文件夹：

```text
imports/<session-id>/
├── data.json      # 本地内容副本
├── layout.json    # 本次排版设置，网页调整后自动保存
└── assets/        # 图片附件
```

模板放在：

```text
templates/shot-script/
```

Skill 放在：

```text
skills/zhuangsir-script-printer/
```

## 适合谁

- 拍摄制片、导演、编导、摄影和后期
- 需要把飞书表格打印成现场拍摄表的人
- 用 Agent 整理脚本、但最后还想人工检查排版的人
- 经常要把脚本表导出成 PDF 给团队的人

## 项目状态

这是一个本地工具，优先服务真实拍摄工作流。它不是在线 SaaS，也不会把你的数据上传到云端。

当前更推荐的使用方式是：

```text
Agent / Skill 负责导入
网页负责预览和调整
浏览器负责打印或导出 PDF
```

## 开发者补充

运行测试：

```sh
npm test
```

启动服务：

```sh
npm start
```

配套 Skill 的初始化脚本：

```sh
node skills/zhuangsir-script-printer/scripts/ensure-printer.mjs --start
```

写入一个 session：

```sh
node skills/zhuangsir-script-printer/scripts/write-session.mjs --root <videoscripts-printer-project-root> --input <session-json-file>
```

更多细节可以看：

- [docs/usage.md](docs/usage.md)
- [skills/zhuangsir-script-printer/SKILL.md](skills/zhuangsir-script-printer/SKILL.md)
