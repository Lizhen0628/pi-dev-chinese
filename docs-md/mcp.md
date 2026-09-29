# MCP 服务器

Pi 通过 stdio 或可流式 HTTP 连接到 [模型上下文协议](https://modelcontextprotocol.io) 服务器，并将其工具提供给模型使用。

## 配置服务器

在项目的 `.mcp.json` 文件中配置服务器，格式与全局配置相同。其他 MCP 客户端的 `mcpServers` 条目可以直接复制过来：

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "docs": {
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer ${DOCS_TOKEN}" },
      "exposure": "direct"
    }
  }
}
```

- stdio 服务器使用 `command`、`args`、`env` 和 `cwd`。相对 `cwd` 相对于会话目录解析。`command`、参数或 `cwd` 中以 `~/` 开头的内容指向用户主目录。
- HTTP 服务器使用 `url`、`headers` 和 `oauth`（参见 [使用 OAuth 登录](#sign-in-with-oauth)）。不支持旧的 SSE 传输。
- `env` 和 `headers` 的值可以引用环境变量（`${NAME}`）或命令（`!command`），类似于提供商 API 密钥。
- `timeout` 设置每次请求的超时时间（秒），默认 60。服务器发送的进度通知会重置该超时。
- `enabled: false` 保留条目但不连接。

项目条目会覆盖同名全局条目。项目 `mcp.json` 仅在项目受信任后才会被读取，因为 stdio 服务器会执行命令。

`pi mcp add` 和 `pi mcp remove` 可从 shell 编辑该文件（参见 [MCP 命令](cli.md#mcp-commands)）：

```bash
pi mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem .
pi mcp add docs --url https://example.com/mcp --bearer-token-env-var DOCS_TOKEN --exposure direct
pi mcp add -l tools --env API_KEY='${TOOLS_KEY}' -- uvx tools-mcp
pi mcp remove docs
```

容易出错的规则要点：

- 服务器名称只能包含字母、数字、`_` 和 `-`。工具名为 `mcp__<server>__<tool>`。
- `type` 可选：有 `command` 则为 stdio 服务器，有 `url` 则为可流式 HTTP 服务器。若指定，取值必须是 `stdio`、`http` 或 `streamable-http`。`sse` 会被拒绝；大多数文档中使用 SSE 端点的服务器也支持可流式 HTTP，通常位于 `/mcp` 而非 `/sse`。
- `command` 是单个可执行文件，`args` 是其参数，而不是 shell 字符串。
- 勿将机密信息写入文件：使用 `${NAME}` 引用环境变量，例如 `"Authorization": "Bearer ${GITHUB_TOKEN}"`，或使用 `!command` 执行命令。命令必须构成完整值，因此需要自行输出标头值：`"Authorization": "!echo Bearer $(gh auth token)"`。
- 无效条目会被跳过并报告，其余服务器仍正常连接。

## 设置服务器

当被要求添加 MCP 服务器时，代理应：

1. 使用 `pi mcp add` 添加简单服务器（添加 `-l` 以写入项目文件），或直接编辑 `mcp.json` 以配置命令未涵盖的设置。将个人服务器和包含凭据的服务器放在 `~/.pi/agent/mcp.json` 中。仅将项目 `.pi/mcp.json` 用于项目本身需要的服务器，且仅在受信任的项目中使用。
2. 转换针对其他客户端编写的条目：
   - Claude Desktop、Claude Code 和 Cursor 使用相同的 `mcpServers` 结构；直接复制条目。
   - VS Code 使用顶层 `servers` 对象和 `inputs` 提示；将条目移至 `mcpServers` 下，并将 `${input:...}` 替换为 `${NAME}` 环境变量。
   - Codex 使用 TOML（`[mcp_servers.<name>]`，包含 `command`、`args`、`env` 或 `url`）；将相同字段写成 JSON。
   - opencode 使用 `"type": "local"`，`command` 为数组（拆分为 `command` 和 `args`），URL 使用 `"type": "remote"`，`env` 使用 `environment`，`${NAME}` 使用 `{env:NAME}`。
3. 运行 `pi mcp list` 检查条目。它会连接到每个已启用的服务器，并打印状态、工具以及错误（如启动失败的 stdio 服务器的 stderr）。存在任何问题时，退出码为 1。
4. 对于需要登录的服务器，运行 `pi mcp login <server>`。它会在用户浏览器中打开授权页面，并等待用户批准访问；告知用户批准。正在运行的会话将在下一轮使用新凭据。
5. 告知用户运行 `/reload`（或启动新会话），以便正在运行的会话连接到已添加或更改的服务器。

Pi 在会话启动时进行连接。第一个提示词最多等待 10 秒以完成启动连接；耗时更长的服务器的工具在连接完成后即可使用。因网络错误或瞬时状态（408、429、5xx）而失败的 HTTP 连接会重试两次。断开连接的服务器会显示为已断开，并在下次调用时重新连接。当服务器宣布其工具列表已更改时，新工具会被添加，已撤销的工具将不可用，直到服务器再次提供它们。

配置错误、连接失败的服务器以及需要登录的服务器会在启动后报告一次。

服务器通过 MCP 日志通知发送的日志消息会追加到 `~/.pi/agent/mcp.log`，格式为 `<时间> [<服务器>] <级别> <记录器>: <消息>`。当文件超过 5 MB 时，会轮转为 `mcp.log.1`。

## 管理服务器

`/mcp` 打开服务器管理器。它列出每个已配置的服务器及其状态、工具数量、暴露范围，以及它来自全局还是项目的 `mcp.json`；需要关注的服务器会排在前面。选择一台服务器以：

- 登录，适用于需要 OAuth 的服务器（参见 [使用 OAuth 登录](#sign-in-with-oauth)）
- 查看其工具、命令或 URL，以及完整的连接错误，包括 stdio 服务器 stderr 的尾部
- 重新连接
- 退出登录，这会删除存储的 OAuth 凭据
- 更改其暴露范围（参见 [暴露范围](#exposure)）
- 禁用或启用它

暴露范围的更改以及启用或禁用操作会保存到定义该服务器的 `mcp.json` 中；文件的其他内容保持不变。被禁用的服务器仍会列出，以便可以重新启用。

在交互式 TUI 之外，`/mcp` 会打印服务器状态。`/mcp login <server>`、`/mcp logout <server>` 和 `/mcp reconnect <server>` 直接执行这些操作。

从 shell 中，`pi mcp add`、`pi mcp remove`、`pi mcp list`、`pi mcp login <server>` 和 `pi mcp logout <server>` 可在无会话情况下管理服务器（参见 [MCP 命令](cli.md#mcp-commands)）。

停止 stdio 服务器会关闭其 stdin，然后向其整个进程组发送 SIGTERM，最后发送 SIGKILL，因此通过 `npx` 或 `uvx` 等包装器启动的服务器不会残留。

## 使用 OAuth 登录

使用 OAuth 的远程服务器（如 Sentry）在 `mcp.json` 中无需凭据：

```json
{
  "mcpServers": {
    "sentry": { "url": "https://mcp.sentry.dev/mcp" }
  }
}
```

当此类服务器拒绝连接时，`/mcp` 会将其显示为需要登录。选择它并点击“登录”（或运行 `/mcp login sentry`，或在 shell 中执行 `pi mcp login sentry`）以在浏览器中打开授权页面。批准访问后，浏览器会重定向到 `127.0.0.1` 上的临时服务器，pi 随即连接。如果浏览器运行在另一台机器上（例如通过 SSH），请将重定向到的 URL 粘贴到登录界面中。

Pi 会向授权服务器注册自身（动态客户端注册），将令牌存储在 `~/.pi/agent/mcp-auth.json` 中，并在令牌过期或服务器拒绝时自动刷新访问令牌。如果服务器后续请求超出已授予范围的权限，它会再次显示为需要登录，登录时会请求新的范围。`/mcp` 中的“退出登录”（或 `/mcp logout sentry`）会删除存储的凭据。

OAuth 适用于没有 `Authorization` 头的 HTTP 服务器。对于不支持动态客户端注册的授权服务器，可配置预注册客户端：

```json
{
  "mcpServers": {
    "example": {
      "url": "https://mcp.example.com/mcp",
      "oauth": { "clientId": "my-client", "clientSecret": "${EXAMPLE_SECRET}", "callbackPort": 8765 }
    }
  }
}
```

重定向 URI 必须与客户端注册时的一致。`callbackPort` 将其固定为 `http://127.0.0.1:<port>/callback`。如需其他重定向 URI，可设置 `callbackUrl`，例如 `"callbackUrl": "http://localhost:8080/oauth/callback"`。它必须是 `localhost`、`127.0.0.1` 或 `[::1]` 上的 `http` URI，并按原样发送。若 `callbackUrl` 中未指定端口，pi 会监听 `callbackPort` 或空闲端口，并将其添加到 URI 中；授权服务器接受回环重定向的任何端口（RFC 8252）。`clientSecret` 为可选字段，可引用环境变量或命令。

`scope` 设置请求的范围，以空格分隔，适用于未声明所需范围的服务器。若未设置，pi 会请求服务器声明的范围。当服务器后续请求更多范围时，pi 会在 `scope` 基础上追加请求这些范围。

## 暴露

每个服务器的工具都注册为 `mcp__<server>__<tool>`。`exposure` 设置控制模型如何访问它们：

- `codemode`（默认）：工具可从 [`codemode`](cli.md#tools) 脚本调用，并列入 `codemode` 工具的描述中，但不会声明给模型。大型 MCP 工具列表不会进入模型的工具声明，脚本可以并行调用多个 MCP 工具（如果需要），同时只返回模型所需的结果部分。当此类服务器连接时，Pi 会激活 `codemode` 工具。大型服务器不会填满描述：声明共享令牌预算，脚本通过 `searchTools()` 查找其余工具（参见 [`codemode`](cli.md#tools)）。
- `codemode-deferred`：与 `codemode` 类似，但工具也不会列入 `codemode` 工具的描述中；它仅列出服务器名称及其工具数量。脚本按名称调用它们，并通过 `searchTools()` 或 `ALL_TOOLS` 查找。适用于 codemode 脚本很少使用的大型服务器。
- `deferred`：在 [`tool_search`](cli.md#tools) 工具加载它们之前，工具不会声明给模型。模型进行搜索，匹配项从下一次调用起声明并直接调用，无需 codemode。当此类服务器连接时，Pi 会激活 `tool_search` 工具。适用于没有 codemode 的大型服务器。
- `direct`：工具像内置工具一样声明给模型，也可从 codemode 调用。
- `hidden`：工具已注册但无法调用。

`toolExposure` 设置单个工具的暴露方式，并覆盖这些工具的 `exposure`。键为服务器提供的工具名称，或 `*` 匹配任意字符的模式。精确名称优先于模式；在模式中，对象中第一个匹配项优先。当服务器的暴露方式为 `hidden` 时，仅列出的工具可访问：

```json
{
  "mcpServers": {
    "github": {
      "url": "https://api.githubcopilot.com/mcp/",
      "exposure": "deferred",
      "toolExposure": {
        "search_code": "direct",
        "get_*": "codemode",
        "delete_*": "hidden"
      }
    }
  }
}
```

`pi mcp list` 标记暴露方式与服务器不同的工具，`/mcp` 中的工具视图也会显示这一点。

未声明的工具（`codemode`、`codemode-deferred` 和 `deferred` 暴露方式）可通过任一工具访问：codemode 脚本可以调用所有工具，`tool_search` 可以加载其中任何一个。例如，当 `codemode` 激活时，脚本可以调用 `deferred` 服务器的工具；当 `tool_search` 激活时，模型可以加载 `codemode` 服务器的工具。

从 codemode 脚本调用的工具不依赖于当前工具集，因此在 `/tree`、恢复和分叉后仍可调用。由 `tool_search` 加载的工具会像其他工具更改一样记录在转录中，并在该分支上保持声明。要在没有 MCP 服务器的情况下也保持 `codemode` 激活，请在 [settings](settings.md#tools) 中添加 `"defaultTools": ["+codemode"]`。要阻止 Pi 激活 `codemode` 工具，请在 `mcp.json` 的顶层（与 `mcpServers` 同级）设置 `"autoEnableCodemode": false`。项目级 `mcp.json` 值会覆盖全局值。当 `codemode` 和 `tool_search` 均未激活时，Pi 会警告一次，因为此时工具无法调用。

超过 20KB 的文本结果在到达模型时会截去中间部分，格式与 Codex 使用的一致：文本的开头和结尾围绕 `…N chars truncated…` 标记。完整文本保存到临时文件中，结果中会指明该文件路径。Codemode 脚本始终接收完整结果，因此脚本可以将大型结果过滤为模型所需的内容。

Codemode 脚本接收 MCP 工具的完整 `CallToolResult`（服务器发送的 `content` 块、`structuredContent` 和 `isError`），`codemode` 描述将其声明为 `CallToolResult<T>`。带有 `isError` 的结果在脚本中解析，并作为错误报告给模型（用于直接调用）。`image(result.content[0])` 将图像块转发给模型。服务器的 `instructions` 在 `codemode` 描述中描述其工具。

## 资源

当已连接的服务器提供[资源](https://modelcontextprotocol.io/specification/2025-11-25/server/resources)时，pi 会添加 Codex 和 opencode 使用的资源工具：

- `list_mcp_resources` 以 JSON 格式列出资源：`{ server?, resources: [{ server, uri, name, ... }], nextCursor? }`。指定 `server` 时，列出该服务器的一页资源，`cursor` 继续获取下一页；未指定时，列出所有服务器的全部资源。
- `list_mcp_resource_templates` 以相同方式列出服务器未直接列出的资源的 URI 模板。
- `read_mcp_resource` 根据给定的 `server` 和 `uri` 读取资源。文本资源以文本形式、图像以图像形式传递给模型；其他二进制资源保存到临时文件，模型看到文件路径。脚本接收 `{ server, uri, contents }`。

这些工具可访问所有已启用且资源暴露级别非 `hidden` 的服务器，并采用其中最大的暴露级别：若任一服务器为 `direct`，则为 `direct`；否则为 `codemode`；再否则为 `codemode-deferred`；最后为 `deferred`。工具结果中的资源链接会标明 `read_mcp_resource` 及对应服务器。

MCP 应用资源（`ui://` URI 或 `text/html;profile=mcp-app`）不在列表中列出，因为 pi 不渲染它们，资源图标同样被排除。

读取和列出资源在遇到瞬时 HTTP 错误（408、429、5xx）时会重试一次。工具调用不重试，因为服务器可能已执行了这些调用。

## 权限

每个 MCP 调用都经过 pi 的工具管道，因此 `tool_call` 和 `tool_result` 扩展处理器（包括权限关卡）适用于 MCP 工具。从 codemode 脚本发出的调用携带 `codemode` 调用的 id 作为 `parentToolCallId`。`pi.getAllTools()` 返回服务器声明的工具注解（`readOnlyHint`、`destructiveHint`、`idempotentHint`、`openWorldHint`），因此权限扩展可以只确认那些更改某些内容的调用（参见[扩展](extensions.md#tool-exposure)）。资源工具被标记为只读。

## 扩展中的服务器

扩展可通过 `pi.registerMcpServer(name, config)` 为当前会话添加服务器，其配置格式与 `mcp.json` 相同（参见 [扩展](extensions.md#mcp-servers)）。它们像配置的服务器一样连接，并在 `/mcp` 中显示，来源标记为扩展。对其的启用、禁用及暴露更改仅适用于当前会话。`mcp.json` 中同名服务器优先；`/mcp` 会列出被覆盖的注册项。`pi mcp` 外壳命令不加载扩展，仅能看到 `mcp.json` 中的服务器。

## 其他 MCP 扩展

已安装的扩展若注册了 `/mcp` 命令（如 `pi-mcp-adapter`），将替换内置的 MCP 支持：此时 pi 既不会在会话中读取 `mcp.json`，也不会连接服务器，且 `/mcp` 归属于该扩展。移除该扩展即可使用内置支持。若要在不安装其他扩展的情况下关闭内置支持，可在 `pi config` 中禁用 Built-in 下的 `mcp`，或在 [settings](settings.md#resources) 中设置 `"extensions": ["-builtin:mcp"]`；`pi mcp` shell 命令仍可正常工作。同样，注册名为 `codemode` 或 `tool_search` 工具的扩展将替换同名内置工具。`pi mcp` shell 命令始终使用内置支持。

## SDK

SDK 会话不加载内置扩展。请将 MCP 扩展、用于 `codemode` 和 `codemode-deferred` 服务器的 codemode 扩展，以及用于 `deferred` 服务器的工具搜索扩展添加到资源加载器中。参见 [SDK](sdk.md#codemode-mcp)。
