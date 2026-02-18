#!/usr/bin/env python3
"""
FiredUp MCP Server -- exposes financial tools to Claude Code via stdio.
Imports from ai_chat_service (single source of truth).
"""
import asyncio
import os
import sys

# Add backend dir to path so app package is importable
sys.path.insert(0, os.path.dirname(__file__))

# Load .env before importing app modules
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, Resource, TextContent

from app.services.ai_chat_service import TOOLS, execute_tool_call, build_user_context
from app.database import SessionLocal

FIREDUP_USER_ID = os.environ.get("FIREDUP_USER_ID", "elcukrodev@gmail.com")

app_server = Server("firedUp")


@app_server.list_tools()
async def list_tools() -> list[Tool]:
    """Expose the same 11 tools as in-app chat."""
    return [
        Tool(
            name=t["name"],
            description=t["description"],
            inputSchema=t["input_schema"]
        )
        for t in TOOLS
    ]


@app_server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    db = SessionLocal()
    try:
        result = await execute_tool_call(name, arguments, FIREDUP_USER_ID, db)
        import json
        return [TextContent(type="text", text=json.dumps(result, ensure_ascii=False, indent=2))]
    finally:
        db.close()


@app_server.list_resources()
async def list_resources() -> list[Resource]:
    return [
        Resource(
            uri="firedUp://user/summary",
            name="Financial Summary",
            mimeType="application/json",
            description="Current month financial snapshot"
        ),
    ]


@app_server.read_resource()
async def read_resource(uri: str) -> str:
    db = SessionLocal()
    try:
        ctx = await build_user_context(FIREDUP_USER_ID, db)
        import json
        return json.dumps(ctx, ensure_ascii=False, indent=2)
    finally:
        db.close()


async def main():
    async with stdio_server() as streams:
        await app_server.run(
            streams[0], streams[1],
            app_server.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())
