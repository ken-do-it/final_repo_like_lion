import json
import logging
from openai import OpenAI
from django.conf import settings
from .models import TravelPlan, PlanDetail
from .services import get_or_create_place_from_search

logger = logging.getLogger(__name__)


def call_mistral_ai(prompt: str, max_retries=1) -> str:
    """
    OpenRouter API를 통해 Mistral AI 호출

    Args:
        prompt: AI에게 전달할 프롬프트
        max_retries: 재시도 횟수

    Returns:
        AI 응답 텍스트

    Raises:
        Exception: API 호출 실패 시
    """
    client = OpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )

    for attempt in range(max_retries + 1):
        try:
            logger.info(f"AI 호출 시도 {attempt + 1}/{max_retries + 1}")

            completion = client.chat.completions.create(
                model="mistralai/devstral-2512:free",
                messages=[
                    {
                        "role": "system",
                        "content": "당신은 한국 여행 전문가입니다. 사용자의 요청에 따라 상세한 여행 일정을 JSON 형식으로 제공합니다."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=2000,
            )

            response = completion.choices[0].message.content
            logger.info(f"AI 응답 성공 (토큰: {completion.usage.total_tokens})")

            return response

        except Exception as e:
            logger.error(f"AI 호출 실패 (시도 {attempt + 1}): {str(e)}")
            if attempt == max_retries:
                raise Exception(f"AI 호출 실패: {str(e)}")


def parse_ai_response(response_text: str) -> dict:
    """
    AI 응답에서 JSON 추출 및 검증

    Args:
        response_text: AI 응답 텍스트

    Returns:
        파싱된 추천 데이터

    Raises:
        ValueError: JSON 파싱 실패 또는 필수 필드 누락
    """
    try:
        # 마크다운 코드 블록 제거
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0]

        data = json.loads(response_text.strip())

        # 필수 필드 검증
        if 'title' not in data:
            raise ValueError("title 필드가 없습니다")
        if 'daily_itineraries' not in data:
            raise ValueError("daily_itineraries 필드가 없습니다")

        logger.info(f"JSON 파싱 성공: {len(data.get('daily_itineraries', []))}일 일정")
        return data

    except json.JSONDecodeError as e:
        logger.error(f"JSON 파싱 실패: {str(e)}")
        logger.debug(f"응답 텍스트: {response_text[:200]}")
        raise ValueError(f"AI 응답을 JSON으로 파싱할 수 없습니다: {str(e)}")


def build_ai_prompt(ai_request) -> str:
    """
    AITravelRequest로부터 AI 프롬프트 생성

    Args:
        ai_request: AITravelRequest 인스턴스

    Returns:
        완성된 프롬프트 문자열
    """
    duration = ai_request.duration_days
    destination_display = ai_request.get_destination_display()
    style_display = ai_request.get_travel_style_display()

    prompt = f"""한국 {destination_display} 지역의 {duration}일 여행 일정을 추천해주세요.

여행 정보:
- 여행지: {destination_display}
- 기간: {ai_request.start_date} ~ {ai_request.end_date} ({duration}일)
- 여행 스타일: {style_display}
- 동행 인원: {ai_request.companions}명
"""

    if ai_request.additional_request:
        prompt += f"- 추가 요청: {ai_request.additional_request}\n"

    prompt += """
다음 JSON 형식으로 응답해주세요:

{
  "title": "여행 제목 (예: 제주 힐링 3일 여행)",
  "description": "여행 개요 설명 (2-3문장)",
  "daily_itineraries": [
    {
      "date": "YYYY-MM-DD",
      "day_number": 1,
      "theme": "그날의 테마 (예: 자연 탐방)",
      "places": [
        {
          "place_name": "실제 장소명 (예: 경복궁, 남산타워)",
          "description": "방문 이유 및 활동 (100자 이내)",
          "estimated_time": "예상 소요 시간 (예: 2시간)",
          "order": 1
        }
      ]
    }
  ]
}

주의사항:
1. place_name은 반드시 실제로 존재하는 구체적인 장소명을 사용하세요
2. 각 날짜는 {ai_request.start_date}부터 시작하여 순차적으로 작성하세요
3. 하루에 3-5개 장소를 추천하세요
4. JSON 형식을 정확히 지켜주세요
"""

    return prompt


def create_plan_from_ai(user, recommendation: dict, ai_request) -> TravelPlan:
    """
    AI 추천 데이터로부터 TravelPlan 및 PlanDetail 생성

    Args:
        user: 사용자 객체
        recommendation: 파싱된 AI 추천 데이터
        ai_request: AITravelRequest 인스턴스

    Returns:
        생성된 TravelPlan 객체
    """
    # TravelPlan 생성
    plan = TravelPlan.objects.create(
        user=user,
        title=recommendation.get('title', f"{ai_request.get_destination_display()} 여행"),
        description=recommendation.get('description', ''),
        plan_type='ai_recommended',
        ai_prompt=build_ai_prompt(ai_request),
        start_date=ai_request.start_date,
        end_date=ai_request.end_date,
        is_public=False
    )

    logger.info(f"TravelPlan 생성: {plan.id}")

    # 각 일자별 장소 추가
    place_count = 0
    failed_places = []

    for daily in recommendation.get('daily_itineraries', []):
        date = daily.get('date')

        for place_data in daily.get('places', []):
            place_name = place_data.get('place_name')
            if not place_name:
                logger.warning("place_name이 없는 장소 발견, 건너뜀")
                continue

            try:
                # FastAPI를 통해 장소 정보 가져오기
                place, created = get_or_create_place_from_search(place_name)

                # PlanDetail 생성
                PlanDetail.objects.create(
                    plan=plan,
                    place=place,
                    date=date,
                    description=place_data.get('description', ''),
                    order_index=place_data.get('order', 0)
                )

                place_count += 1
                logger.info(f"장소 추가: {place_name} ({'신규' if created else '기존'})")

            except Exception as e:
                logger.warning(f"장소 '{place_name}' 추가 실패: {str(e)}")
                failed_places.append(place_name)
                continue

    logger.info(f"Plan 생성 완료: 총 {place_count}개 장소 추가, {len(failed_places)}개 실패")

    if failed_places:
        logger.warning(f"추가 실패한 장소: {', '.join(failed_places)}")

    return plan


def generate_travel_recommendation(ai_request):
    """
    AI 여행 추천 전체 프로세스 실행

    Args:
        ai_request: AITravelRequest 인스턴스

    Returns:
        생성된 TravelPlan 객체

    Raises:
        Exception: 프로세스 중 오류 발생 시
    """
    logger.info(f"AI 추천 시작: {ai_request}")

    # 1. 프롬프트 생성
    prompt = build_ai_prompt(ai_request)

    # 2. AI 호출
    response_text = call_mistral_ai(prompt)

    # 3. 응답 파싱
    recommendation = parse_ai_response(response_text)

    # 4. ai_response 저장
    ai_request.ai_response = recommendation
    ai_request.save()

    # 5. TravelPlan 생성
    plan = create_plan_from_ai(ai_request.user, recommendation, ai_request)

    # 6. AITravelRequest 업데이트
    ai_request.created_plan = plan
    ai_request.status = 'success'
    ai_request.save()

    logger.info(f"AI 추천 완료: Plan {plan.id}")

    return plan
