import json
import os
import urllib.request
import urllib.error


GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"


def call_gemini(api_key, prompt):
    """Gemini API를 urllib로 직접 호출"""
    url = f"{GEMINI_API_URL}?key={api_key}"
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}]
    }).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    with urllib.request.urlopen(req, timeout=60) as resp:
        result = json.loads(resp.read().decode("utf-8"))

    return result["candidates"][0]["content"]["parts"][0]["text"].strip()


def lambda_handler(event, context):
    print("Lambda 수신 데이터:", event.get("body", ""))

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"statusCode": 500, "body": json.dumps({"error": "GEMINI_API_KEY 환경변수가 설정되지 않았습니다"})}

    try:
        input_data = json.loads(event["body"])
    except (json.JSONDecodeError, KeyError, TypeError) as e:
        print("JSON 파싱 오류:", e)
        return {"statusCode": 400, "body": json.dumps({"error": "Invalid JSON format"})}

    request_type = input_data.get("requestType")
    profile = input_data.get("profile")

    if not request_type or not profile:
        return {"statusCode": 400, "body": json.dumps({"error": "필수 필드(requestType, profile)가 누락되었습니다"})}

    if request_type not in ("routine", "meal", "feedback", "chat"):
        return {"statusCode": 400, "body": json.dumps({"error": f"유효하지 않은 requestType: {request_type}"})}

    try:
        if request_type == "routine":
            return handle_routine(api_key, profile)
        elif request_type == "meal":
            return handle_meal(api_key, profile)
        elif request_type == "feedback":
            workout_logs = input_data.get("workoutLogs", [])
            return handle_feedback(api_key, profile, workout_logs)
        elif request_type == "chat":
            message = input_data.get("message", "")
            return handle_chat(api_key, profile, message)
    except Exception as e:
        print(f"처리 중 오류 발생: {e}")
        return {"statusCode": 500, "body": json.dumps({"error": f"AI 처리 실패: {str(e)}"})}


def parse_ai_json(ai_text):
    """AI 응답에서 JSON 파싱 (코드 블록 제거 포함)"""
    text = ai_text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
    return json.loads(text)


def handle_routine(api_key, profile):
    goal_type = profile.get("goalType", profile.get("goal_type", "maintain"))
    experience_level = profile.get("experienceLevel", profile.get("experience_level", "beginner"))
    weekly_workouts = profile.get("weeklyWorkouts", profile.get("weekly_workouts", 3))

    goal_map = {"diet": "다이어트", "bulk": "벌크업(근비대)", "maintain": "체력 유지"}
    level_map = {"beginner": "초보자", "intermediate": "중급자", "advanced": "고급자"}
    goal_kr = goal_map.get(goal_type, goal_type)
    level_kr = level_map.get(experience_level, experience_level)
    rest_days = 7 - int(weekly_workouts)

    prompt = f"""당신은 전문 피트니스 트레이너입니다.
다음 조건에 맞는 주간 운동 루틴을 JSON 형식으로 생성해주세요.

조건:
- 운동 목표: {goal_kr}
- 운동 경험: {level_kr}
- 주간 운동 횟수: {weekly_workouts}일 (휴식일: {rest_days}일)

반드시 다음 규칙을 지켜주세요:
1. 월요일부터 일요일까지 7일 전체를 포함해야 합니다.
2. isRestDay가 false인 운동일은 정확히 {weekly_workouts}일이어야 합니다.
3. isRestDay가 true인 휴식일은 정확히 {rest_days}일이어야 합니다.
4. 각 운동일에는 해당 부위에 맞는 운동 종목 3~5개를 포함해주세요.

반드시 아래 JSON 형식만 출력하고, 다른 텍스트는 포함하지 마세요:
{{"weeklyPlan": [{{"day": "월요일", "isRestDay": false, "bodyPart": "가슴/삼두", "exercises": [{{"name": "벤치프레스", "sets": 4, "reps": 12}}]}}, {{"day": "화요일", "isRestDay": true, "bodyPart": null, "exercises": []}}]}}"""

    ai_text = call_gemini(api_key, prompt)
    routine_data = parse_ai_json(ai_text)
    return {"statusCode": 200, "body": json.dumps(routine_data, ensure_ascii=False)}


def handle_meal(api_key, profile):
    height = profile.get("height", 170)
    weight = profile.get("weight", 70)
    goal_type = profile.get("goalType", profile.get("goal_type", "maintain"))

    goal_map = {"diet": "다이어트 (체중 감량)", "bulk": "벌크업 (근육 증가)", "maintain": "체중 유지"}
    goal_kr = goal_map.get(goal_type, goal_type)

    prompt = f"""당신은 전문 영양사입니다.
다음 신체 정보와 목표에 맞는 하루 식단을 JSON 형식으로 추천해주세요.

신체 정보:
- 키: {height}cm
- 몸무게: {weight}kg
- 목표: {goal_kr}

반드시 아래 JSON 형식만 출력하고, 다른 텍스트는 포함하지 마세요:
{{"targetCalories": 2200, "meals": [{{"type": "아침", "menu": "오트밀 + 바나나 + 삶은 달걀 2개", "calories": 450}}, {{"type": "점심", "menu": "닭가슴살 샐러드 + 현미밥", "calories": 650}}, {{"type": "저녁", "menu": "연어 스테이크 + 고구마 + 브로콜리", "calories": 600}}]}}"""

    ai_text = call_gemini(api_key, prompt)
    meal_data = parse_ai_json(ai_text)
    return {"statusCode": 200, "body": json.dumps(meal_data, ensure_ascii=False)}


def handle_feedback(api_key, profile, workout_logs):
    height = profile.get("height", 170)
    weight = profile.get("weight", 70)
    goal_type = profile.get("goalType", profile.get("goal_type", "maintain"))
    experience_level = profile.get("experienceLevel", profile.get("experience_level", "beginner"))
    weekly_workouts = profile.get("weeklyWorkouts", profile.get("weekly_workouts", 3))

    goal_map = {"diet": "다이어트", "bulk": "벌크업", "maintain": "체력 유지"}
    level_map = {"beginner": "초보자", "intermediate": "중급자", "advanced": "고급자"}
    goal_kr = goal_map.get(goal_type, goal_type)
    level_kr = level_map.get(experience_level, experience_level)

    logs_summary = "운동 기록 없음"
    if workout_logs:
        total = len(workout_logs)
        completed = sum(1 for log in workout_logs if log.get("completed"))
        logs_summary = f"총 {total}일 중 {completed}일 완료"

    prompt = f"""당신은 전문 피트니스 코치입니다.
다음 사용자의 프로필과 운동 기록을 분석하여 한국어로 피드백을 작성해주세요.

사용자 프로필:
- 키: {height}cm, 몸무게: {weight}kg
- 운동 목표: {goal_kr}
- 운동 경험: {level_kr}
- 주간 운동 목표: {weekly_workouts}일

운동 기록: {logs_summary}

다음 항목을 포함하여 피드백을 작성해주세요:
1. 운동 완료율 분석
2. 목표 대비 진행 상황 평가
3. 구체적인 개선 제안
4. 동기부여 메시지

JSON이 아닌 일반 텍스트로 작성해주세요."""

    feedback_text = call_gemini(api_key, prompt)
    return {"statusCode": 200, "body": json.dumps({"feedback": feedback_text}, ensure_ascii=False)}


def handle_chat(api_key, profile, message):
    height = profile.get("height", 170)
    weight = profile.get("weight", 70)
    goal_type = profile.get("goalType", profile.get("goal_type", "maintain"))
    experience_level = profile.get("experienceLevel", profile.get("experience_level", "beginner"))

    goal_map = {"diet": "다이어트", "bulk": "벌크업", "maintain": "체력 유지"}
    level_map = {"beginner": "초보자", "intermediate": "중급자", "advanced": "고급자"}
    goal_kr = goal_map.get(goal_type, goal_type)
    level_kr = level_map.get(experience_level, experience_level)

    prompt = f"""당신은 전문 피트니스 & 영양 코치입니다. 친근하고 전문적인 톤으로 한국어로 답변해주세요.

사용자 프로필:
- 키: {height}cm, 몸무게: {weight}kg
- 운동 목표: {goal_kr}
- 운동 경험: {level_kr}

사용자 질문: {message}

위 프로필을 참고하여 맞춤형으로 답변해주세요. JSON이 아닌 일반 텍스트로 답변해주세요."""

    reply = call_gemini(api_key, prompt)
    return {"statusCode": 200, "body": json.dumps({"reply": reply}, ensure_ascii=False)}
