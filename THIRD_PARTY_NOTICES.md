# 第三方组件和资料

## DeepSeek API

- 服务方：DeepSeek；本次验证请求模型为 `deepseek-flash`，每次响应的实际模型标识写入 manifest。
- 官方接口与文档：https://api.deepseek.com / https://api-docs.deepseek.com/
- 用途：任务组织、白名单工具调用、基于引用与工具结果的研究表达。
- 调用模块：`server/provider.cjs`；系统指令：`server/prompts.cjs`。
- 模型权重不随源码分发，模型服务按服务方条款提供，不受本仓库 MIT 许可再授权。
- 用户主动允许后，任务、事实字段及使用到的资料片段发往该服务；API密钥仅驻留本机服务内存。

## Node.js

源码需要 Node.js 22 或以上版本。桌面技术交付包附带 Windows x64 Node.js 运行时及原版 LICENSE，便于解压运行；GitHub 仓库不包含运行时二进制。项目：https://nodejs.org/ 。

## PDF.js 5.6.205

- 项目：https://github.com/mozilla/pdf.js
- 分发包：https://www.npmjs.com/package/pdfjs-dist/v/5.6.205
- 主许可：Apache-2.0，见 `dist/vendor/LICENSE`。
- 字符映射：`dist/vendor/cmaps/LICENSE`。
- 字体：`dist/vendor/standard_fonts/LICENSE_FOXIT`、`LICENSE_LIBERATION`。
- WASM 相关组件：`dist/vendor/wasm/LICENSE_JBIG2`、`LICENSE_OPENJPEG`、`LICENSE_PDFJS_JBIG2`、`LICENSE_PDFJS_OPENJPEG`、`LICENSE_PDFJS_QCMS`、`LICENSE_QCMS`。

相应目录内的版权与许可文本保持原样。顶层 MIT 许可证不替代这些第三方许可证。

## 案例资料与研究参考

`dist/data.js` 和 `dist/finance-engine.js` 包含公开财报与政策的少量事实、摘编和原始链接，供功能演示与复核。原文件及其版权仍归相应权利人所有；本仓库不再分发原始完整 PDF，不对其另行授予许可。

研究参考以 DOI 链接提供，不包含论文全文或原图。移动端为外部链接，其代码、素材和服务不在本仓库许可范围内。

代码绘制的图标、图表和页面装饰随自有代码一起按 MIT 许可发布。项目名称及关联机构名称的使用不意味着机构背书。
