# final_repo

GitHub Secrets
ec2 엘라스틱 ip 설정 후에 GitHub Secrets EC2_HOST 등록해야됨




로그인관련 Django
CRUD FastAPI
프론트 React


CI/CD 전체 흐름도
Build: GitHub가 코드를 받아서 Docker 이미지를 굽는다. (Django, FastAPI, React 각각)

Push: 구운 이미지를 Docker Hub에 올린다.

Deploy: GitHub가 EC2에 SSH로 접속해서  명령(kubectl rollout restart)을 날린다.