# IZANA · 私人自习室

适配手机的黑白漫画伴学网页。原生 HTML/CSS/JavaScript，无构建依赖。

## 功能

- 全屏角色开场、逐字对话、学习时 Q 版陪伴和定时短句。
- 课文：阅读标注 → 关键词填空 → 提示词复述 → 原文自查。
- 单词：点击翻面、熟悉度选择、不熟悉词本轮重排。
- 科学：阅读 → 书写复述笔记 → 原文对照。
- 材料管理、台词编辑、学习历史、完整 JSON 导入导出。
- Supabase 邮箱密码登录、独立账号资料库、跨设备同步。
- 云同步按条目修改时间合并；服务端乐观锁防止跨设备覆盖。相同材料同时编辑时最后修改版本胜出。

## GitHub Pages

将源码上传至 `tong0617c/izana-study`，默认分支 `main`。
仓库 Settings → Pages → Source 选择 **GitHub Actions**。
推送后 `.github/workflows/pages.yml` 部署静态网页。
预期地址：`https://tong0617c.github.io/izana-study/`（部署成功后才可访问）。
静态网页源码公开不代表学习数据公开：学习内容不写入仓库。

## 启用登录和同步

1. 创建 Supabase 项目，在 SQL Editor 执行 `supabase.sql`。
2. Authentication → Providers 启用 Email；保留邮箱确认。
3. Authentication → URL Configuration 将 Site URL 设置为部署后的页面地址。
4. 项目 Settings → API 获取 Project URL 和 publishable/anon 公共密钥。
5. 网页「内容管理」填写地址和公开密钥，保存后注册、邮件确认、登录。
6. 另一台设备填写相同配置并登录同一账号即可同步。

不要将 service_role / secret key 写入网页或仓库。资料表开启行级安全，读写均限定 auth.uid()。
访客与各账号本机数据隔离；迁移访客数据时，先导出、登录、再导入。
未建立云服务前仅本机模式可用。建议定期备份，浏览器清理会移除本地数据。
账号 token 保存在当前浏览器，不要在共享设备保持登录。

## 本地运行

`node server.cjs` 后访问 `http://localhost:4173`。
手机可在相同网络通过电脑局域网 IP 访问（需操作系统允许该端口），正式使用建议 HTTPS 部署地址。

## 素材与台词

四张图片由用户提供，属于《东京复仇者》角色同人学习项目，保留原图。仅用 CSS 灰度呈现。
角色台词为本项目原创同人情境，不是官方引文；可自行修改。
本项目无官方关联。字体从 Google Fonts 加载，网络不可用时使用系统字体。
