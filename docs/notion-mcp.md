# Notion MCP — 개인 계정 연결

회사 계정(`charlie.lee@languageforest.in`)은 claude.ai 커넥터로 이미 붙어 있다.
개인 계정(`cjonthetop97@gmail.com`)을 **별도 서버**로 추가하기 위한 설정.

## 로컬 Claude Code

리포 루트의 `.mcp.json`에 `notion-personal` 서버가 등록돼 있다.
로컬에서 이 리포를 열면 프로젝트 스코프 MCP 서버로 잡힌다.

```bash
claude          # 리포 루트에서 실행 → .mcp.json 승인 프롬프트에 Yes
/mcp            # notion-personal 선택 → Authenticate
```

인증 시 브라우저가 열린다. **회사 계정이 로그인돼 있으면 그대로 승인되므로**,
미리 시크릿 창에서 개인 계정으로 로그인해두거나 승인 화면에서 계정을 전환할 것.

연결 확인:

```
notion-personal 의 notion-get-users 로 self 조회 → 이메일이 개인 계정인지 확인
```

## Claude Code on the web

웹 세션에서는 이 설정이 동작하지 않는다. 컨테이너의 이그레스 정책이
`mcp.notion.com`, `api.notion.com`, `www.notion.so` 를 403으로 차단한다.

웹에서 쓰려면 claude.ai 커넥터로 등록해야 한다
(커넥터 트래픽은 컨테이너가 아니라 Anthropic 서버에서 나가므로 차단되지 않는다):

Settings → Connectors → Add custom connector
- Name: `Notion Personal`
- URL: `https://mcp.notion.com/mcp`

## 주의

- 두 서버의 도구 이름이 분리되므로, 작업 지시할 때 회사/개인 중 어느 쪽인지 명시할 것.
- 토큰·시크릿은 이 파일에 넣지 않는다. 인증은 전부 OAuth로 처리된다.
