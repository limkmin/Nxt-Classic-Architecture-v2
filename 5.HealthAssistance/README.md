# 🏋️ FitCoach AI - AI 맞춤 운동 & 다이어트 코치

사용자의 신체 정보와 목표를 기반으로 AI가 개인 맞춤 운동 루틴, 식단 추천, 피드백을 제공하는 웹 서비스입니다.

## 🌐 배포 URL

- 클라이언트: http://kmucloud-20-s3.s3-website-us-east-1.amazonaws.com

## 🔧 사용한 AWS 리소스

| 리소스 | 용도 |
|--------|------|
| **EC2** (Amazon Linux 2023) | Express.js 백엔드 서버 실행 (포트 80) |
| **RDS** (MySQL) | 사용자 프로필, 운동 루틴, 식단, 운동 기록 저장 |
| **Lambda** (Python 3.12) | Google Gemini AI API를 호출하여 운동 루틴/식단/피드백/챗봇 응답 생성 |
| **S3** | React 클라이언트 정적 웹사이트 호스팅 |

## 📁 프로젝트 구조

```
5.HealthAssistance/
├── client/          # React 프론트엔드
│   ├── src/
│   │   ├── App.js   # 메인 앱 컴포넌트
│   │   └── App.css  # 스타일
│   ├── public/
│   └── package.json
├── server/          # Express.js 백엔드
│   ├── server.js    # API 서버
│   ├── validators.js # 입력 유효성 검증
│   └── package.json
├── lambda/          # AWS Lambda 함수
│   └── lambda_function.py
└── README.md
```

## 🚀 실행 방법

### 1. 서버 (EC2)

```bash
cd server
cp .env.example .env
# .env 파일에 DB 정보와 Lambda URL 설정
npm install
sudo node server.js
```

`.env` 설정 항목:
```
DB_HOST=<RDS 엔드포인트>
DB_USER=<DB 사용자명>
DB_PASSWORD=<DB 비밀번호>
DB_NAME=<DB 이름>
GEMINI_LAMBDA_URL=<Lambda 함수 URL>
```

### 2. 클라이언트 (S3)

```bash
cd client
cp .env.example .env
# .env 파일에 서버 URL 설정
npm install
npm run build
# build 폴더를 S3에 업로드
aws s3 cp build/ s3://<버킷이름>/ --recursive
```

`.env` 설정 항목:
```
REACT_APP_SERVER_URL=http://<EC2 퍼블릭 IP>
```

### 3. Lambda 함수

- AWS Lambda 콘솔에서 함수 생성 (Python 3.12)
- `lambda/lambda_function.py` 코드 붙여넣기
- 환경변수 `GEMINI_API_KEY` 설정
- 함수 URL 생성 (인증 유형: NONE)

## 📋 주요 기능

1. **프로필 등록** - 키, 몸무게, 운동 목표, 경험, 주간 운동 횟수 입력
2. **AI 운동 루틴 생성** - 프로필 기반 주간 운동 루틴 자동 생성
3. **AI 식단 추천** - 목표에 맞는 하루 식단 추천
4. **운동 기록** - 일별 운동 완료 여부 기록 및 조회
5. **AI 피드백** - 운동 기록 기반 진행 상황 분석 및 개선 제안
6. **AI 챗봇** - 운동/식단 관련 자유 질문 및 맞춤 답변

## 🧪 테스트 방법

1. 배포 URL 접속
2. 프로필 탭에서 정보 입력 후 저장 (예: 키 170, 몸무게 70, 다이어트, 초보, 주 3일)
3. 운동 루틴 탭에서 "루틴 생성" 클릭
4. 식단 탭에서 "식단 추천" 클릭
5. 운동 기록 탭에서 날짜 선택 후 기록 저장
6. AI 피드백 탭에서 "피드백 요청" 클릭
7. AI 챗봇 탭에서 운동/식단 관련 질문 입력

## ⚠️ 보안 참고

- `.env` 파일은 `.gitignore`에 포함되어 GitHub에 업로드되지 않습니다
- API 키, DB 비밀번호 등 민감한 정보는 환경변수로 관리합니다
