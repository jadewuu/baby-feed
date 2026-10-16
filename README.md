# Baby Feed

Baby Feed 是一个给家庭自用的婴儿喂养与照护记录应用。在线版本部署在 [https://jadewu.online/baby-feed/](https://jadewu.online/baby-feed/)，可以直接用 iPhone Safari 打开并添加到主屏幕。

## 数据与隐私

这个版本不需要注册或登录，也没有应用服务器。宝宝资料、喂养、睡眠、健康和备忘记录只保存在当前浏览器的 IndexedDB 中，不会上传到 GitHub Pages 或个人网站服务器。

浏览器数据不会自动同步到其他设备。清除 Safari 网站数据、移除浏览器存储，或更换手机，都可能使本机记录永久丢失。请定期在「设置 → 本地数据」导出 JSON 备份，并把备份文件保存到 iCloud Drive 等安全位置；需要恢复时，可在同一页面导入备份并替换当前数据。

## 本地开发

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

开发地址为 [http://localhost:3000/baby-feed/](http://localhost:3000/baby-feed/)。

运行测试和静态导出：

```bash
npm test
npx tsc --noEmit
npm run build
```

构建结果位于 `out/`，可直接作为静态网站发布。应用固定使用 `/baby-feed/` 路径，因此部署地址应保持为 `https://jadewu.online/baby-feed/`。

## iPhone 安装

1. 用 Safari 打开在线地址。
2. 点底部分享按钮。
3. 选择「添加到主屏幕」。
4. 从主屏幕打开 Baby Feed；首次加载完成后可离线使用。

## 功能

- 记录亲喂、瓶喂、配方奶和辅食
- 记录睡眠、大小便、营养补充、身高体重、体温、疫苗、用药和长牙
- 按天查看时间轴、汇总与趋势图
- 管理多个宝宝和自定义快捷记录
- 导出、导入和清空全部本地数据
