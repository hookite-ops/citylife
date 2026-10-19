# 도시생활 · CITY LIFE — Google Cloud Run 배포

이 폴더 그대로 Cloud Run에 올리면 됩니다 (Dockerfile 포함, 포트 8080).

## Cloud Shell에서 배포 (명령 3줄)

1. console.cloud.google.com 오른쪽 위 **Cloud Shell** 열기
2. 점 3개 메뉴 → **업로드** → `citylife.zip` 선택
3. 아래 붙여넣기:

```
unzip -o citylife.zip -d citylife && cd citylife
gcloud run deploy citylife --source . --region asia-northeast3 --allow-unauthenticated
```

끝나면 나오는 `https://citylife-....run.app` 주소가 게임 링크예요.
업데이트할 때도 새 zip을 올리고 같은 명령을 다시 실행하면 같은 주소가 갱신돼요.

## 조작
- 왼쪽 화면 드래그: 이동 / 오른쪽 화면 드래그: 시점 / 두 손가락: 확대·축소
- 차: 왼쪽으로 핸들, 오른쪽 엑셀·브레이크
- PC: WASD 이동, 마우스 드래그 시점, Shift 달리기, E 상호작용, F 차 타기/내리기, H 경적
