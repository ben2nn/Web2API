# 匿名访问功能

## 功能说明

匿名访问功能允许用户在没有 API Key 的情况下访问 Qwen API 服务。该功能通过浏览器自动化获取 Qwen 的匿名 token，实现无需登录即可使用服务。

## 工作原理

1. **匿名 token 获取**：通过 HTTP 请求访问 Qwen 网站，获取匿名身份
2. **账号池集成**：当没有可用账号时，自动使用匿名 token
3. **前端支持**：提供匿名访问开关，用户可以选择启用或禁用

## 使用方法

### 后端配置

匿名访问功能默认启用，无需额外配置。如果需要禁用，可以修改相关代码。

### 前端使用

1. 打开系统设置页面
2. 找到"匿名访问"部分
3. 点击"启用"按钮
4. 刷新页面后生效

### API 调用

启用匿名访问后，前端会自动使用匿名 token 进行 API 调用，无需手动配置。

## 技术实现

### 后端实现

1. **auth_resolver.py**：添加了 `get_anonymous_token()` 函数
   - 通过 HTTP 请求访问 Qwen 网站
   - 从响应中提取匿名 token
   - 支持 cookies 作为备用方案

2. **account_pool/__init__.py**：添加了匿名 token 缓存
   - 5 分钟缓存有效期
   - 线程安全的并发获取
   - 自动刷新机制

3. **pool_acquire.py**：修改了账号获取逻辑
   - 当没有可用账号时自动获取匿名账号
   - 匿名账号不需要释放

4. **admin.py**：添加了匿名 token 获取端点
   - `POST /api/admin/anonymous/token`

### 前端实现

1. **auth.ts**：添加了匿名访问相关函数
   - `isAnonymousEnabled()`：检查匿名访问是否启用
   - `clearAnonymousToken()`：清除匿名 token 缓存
   - `getAnonymousToken()`：获取匿名 token
   - `setAnonymousToken()`：设置匿名 token

2. **SettingsPage.tsx**：添加了匿名访问开关
   - 用户界面开关
   - 本地存储配置

3. **TestPage.tsx**：支持匿名访问
   - 自动使用匿名 token

## 测试

运行以下测试脚本验证功能：

```bash
# 基础测试
python test_anonymous.py

# 完整测试
python test_anonymous_full.py

# 集成测试
python test_anonymous_integration.py
```

## 注意事项

1. **匿名 token 有效期**：匿名 token 有 5 分钟的缓存有效期
2. **并发限制**：匿名访问受系统并发限制
3. **功能限制**：匿名访问可能有一些功能限制（如配额限制）
4. **刷新浏览器**：刷新浏览器会清除匿名 token 缓存，获取新的匿名身份

## 故障排除

### 匿名 token 获取失败

1. 检查网络连接
2. 检查 Qwen 网站是否可访问
3. 查看后端日志获取详细错误信息

### 匿名访问不生效

1. 确认前端已启用匿名访问
2. 刷新页面使配置生效
3. 检查浏览器控制台是否有错误

## 更新日志

- **v1.0.0**：初始实现匿名访问功能
  - 后端匿名 token 获取
  - 前端匿名访问开关
  - 集成测试验证