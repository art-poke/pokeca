---
name: art-poke-github-fork
description: art-poke/pokeca 레포 출처와 작업용 gh 계정 매핑
metadata: 
  node_type: memory
  type: project
  originSessionId: b225d66b-ab47-439f-af42-79fe0b3d095f
---

`art-poke/pokeca`는 2026-10-30 `ddol9/pokeca`를 **art-poke 조직으로 포크**한 레포(upstream = ddol9/pokeca). 로컬 클론: `/Users/leeyunjae/orca/projects/art-poke/pokeca`.

**gh 계정:** art-poke 조직 작업은 **`clyde-yoonjae`** 계정으로 한다(해당 계정이 art-poke org admin). 다른 계정 `leeyunjae7`은 art-poke 권한 없음. SSH는 `~/.ssh/config`에서 `github.com`=leeyunjae7 키, `github.com-clyde`=clyde 키로 분리됨. 커밋 author는 git global(이윤재/lyj@green-ribbon.co.kr)이라 gh 로그인과 별개.

**푸시(고정, 2026-10-31):** 이 레포는 **무조건 HTTPS로 push**한다. origin을 `https://github.com/art-poke/pokeca.git`로 set-url 해둠(기본 SSH 키가 leeyunjae7라 SSH push는 거부됨). `gh auth setup-git` + clyde-yoonjae가 active gh 계정이라 `git push origin main`이 clyde 자격으로 동작. clyde-yoonjae가 active인지 `gh auth status`로 확인(아니면 `gh auth switch -u clyde-yoonjae`).

관련: [[art-poke-design-system]]
