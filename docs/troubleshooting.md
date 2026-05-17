# Troubleshooting Senix MCP

This guide covers the most common problems when connecting Senix to an IDE
over MCP, and how to confirm the connection is working.

## Verify your connection

Type this prompt into your IDE chat:

```
List the tools from the Senix MCP server only.
```

The IDE should list exactly one tool, `review_changes`. If the IDE lists
more tools or different tools, you are connected to a different MCP
server. Check the server name in your config and make sure it is `senix`.

## Test a real review

Type this prompt into your IDE chat:

```
Use Senix to review my current uncommitted changes.
```

The IDE should call Senix and return a shipping brief within about 30
seconds. If nothing happens, the IDE did not route the request to Senix.
Check the common setup mistakes below.

## Common setup mistakes

1. Token pasted without "Bearer " in front of it.
2. Wrong server name. The server must be called "senix" in the config.
3. IDE was not fully quit and reopened. Some IDEs need a full restart.
4. Another MCP server is registered with a similar tool name and is being called instead.
5. Token was revoked or copied wrong. Generate a new one.

## Still stuck?

If none of the steps above fix the problem, email our support team at
support@senix.example and we will help you get connected.
