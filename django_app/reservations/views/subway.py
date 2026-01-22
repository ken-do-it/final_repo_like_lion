"""
지하철 API 뷰
지하철 경로 검색 및 노선도 정보를 제공합니다.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema, OpenApiParameter

from ..services.subway import MSSubwayAPIService
from ..services.subway.api_service import SubwayError
from ..serializers.subway import (
    MSSubwayRouteRequestSerializer,
    MSSubwayRouteResponseSerializer,
    MSSubwayMapMetaRequestSerializer,
    MSSubwayMapMetaResponseSerializer,
)


# =============================================================================
# 지하철역 다국어 매핑 (영어, 일본어, 중국어 → 한국어)
# =============================================================================
STATION_NAME_MAPPING = {
    # =========================================================================
    # 서울 1호선
    # =========================================================================
    'seoul station': '서울역', 'seoul': '서울역', 'ソウル駅': '서울역', 'ソウル': '서울역', '首尔站': '서울역', '首尔': '서울역',
    'city hall': '시청', 'シチョン': '시청', '市厅': '시청', '市廳': '시청',
    'jongno 3-ga': '종로3가', 'jongno 3ga': '종로3가', 'jongno': '종로3가', 'チョンノサムガ': '종로3가', '钟路3街': '종로3가',
    'jongno 5-ga': '종로5가', 'jongno 5ga': '종로5가', 'チョンノオガ': '종로5가', '钟路5街': '종로5가',
    'dongdaemun': '동대문', 'トンデムン': '동대문', '东大门': '동대문', '東大門': '동대문',
    'sinseol-dong': '신설동', 'sinseol dong': '신설동', 'sinseol': '신설동', 'シンソルドン': '신설동', '新设洞': '신설동',
    'dongmyo': '동묘앞', 'dongmyo-ap': '동묘앞', 'トンミョアプ': '동묘앞', '东庙': '동묘앞',
    'cheongnyangni': '청량리', 'cheongnyangri': '청량리', 'チョンニャンニ': '청량리', '清凉里': '청량리',
    'yongsan': '용산', 'ヨンサン': '용산', '龙山': '용산', '龍山': '용산',
    'noryangjin': '노량진', 'ノリャンジン': '노량진', '鹭梁津': '노량진',
    'yeongdeungpo': '영등포', 'ヨンドゥンポ': '영등포', '永登浦': '영등포',
    'guro': '구로', 'クロ': '구로', '九老': '구로',
    'incheon': '인천', 'インチョン': '인천', '仁川': '인천',
    'suwon': '수원', 'スウォン': '수원', '水原': '수원',
    'anyang': '안양', 'アニャン': '안양', '安养': '안양',
    'uijeongbu': '의정부', 'ウィジョンブ': '의정부', '议政府': '의정부',

    # =========================================================================
    # 서울 2호선
    # =========================================================================
    'gangnam': '강남', 'カンナム': '강남', '江南': '강남',
    'samsung': '삼성', 'サムスン': '삼성', '三成': '삼성', '三星': '삼성',
    'jamsil': '잠실', 'チャムシル': '잠실', '蚕室': '잠실',
    'hongdae': '홍대입구', 'hongik university': '홍대입구', 'hongik univ': '홍대입구', 'hongdae entrance': '홍대입구',
    'ホンデイック': '홍대입구', 'ホンデ': '홍대입구', '弘大入口': '홍대입구', '弘大': '홍대입구',
    'sinchon': '신촌', 'シンチョン': '신촌', '新村': '신촌',
    'ewha womans university': '이대', 'ewha': '이대', 'イデ': '이대', '梨大': '이대', '梨花女大': '이대',
    'hapjeong': '합정', 'ハプチョン': '합정', '合井': '합정',
    'dangsan': '당산', 'タンサン': '당산', '堂山': '당산',
    'yeouido': '여의도', 'ヨイド': '여의도', '汝矣岛': '여의도', '汝矣島': '여의도',
    'sindorim': '신도림', 'シンドリム': '신도림', '新道林': '신도림',
    'gasan digital complex': '가산디지털단지', 'gasan': '가산디지털단지', 'カサン': '가산디지털단지', '加山数码团地': '가산디지털단지',
    'sadang': '사당', 'サダン': '사당', '舍堂': '사당',
    'gangbyeon': '강변', 'カンビョン': '강변', '江边': '강변',
    'konkuk university': '건대입구', 'konkuk': '건대입구', 'コンデイック': '건대입구', '建大入口': '건대입구',
    'seolleung': '선릉', 'ソルルン': '선릉', '宣陵': '선릉',
    'yeoksam': '역삼', 'ヨクサム': '역삼', '驿三': '역삼', '驛三': '역삼',
    'education university': '교대', 'kyodae': '교대', 'キョデ': '교대', '教大': '교대',
    'express bus terminal': '고속터미널', 'express terminal': '고속터미널', 'コソクトミノル': '고속터미널', '高速巴士客运站': '고속터미널',
    'bangbae': '방배', 'バンベ': '방배', '方背': '방배',
    'nakseongdae': '낙성대', 'ナクソンデ': '낙성대', '落星垈': '낙성대',
    'seoul national university': '서울대입구', 'snu': '서울대입구', 'ソウルデイック': '서울대입구', '首尔大入口': '서울대입구',
    'sindaebang': '신대방', 'シンデバン': '신대방', '新大方': '신대방',
    'mullae': '문래', 'ムルレ': '문래', '文来': '문래',
    'ttukseom': '뚝섬', 'トゥクソム': '뚝섬', '纛岛': '뚝섬',
    'seongsu': '성수', 'ソンス': '성수', '圣水': '성수',
    'wangsimni': '왕십리', 'ワンシムニ': '왕십리', '往十里': '왕십리',
    'euljiro 3-ga': '을지로3가', 'euljiro 3ga': '을지로3가', 'euljiro': '을지로3가', 'ウルチロサムガ': '을지로3가', '乙支路3街': '을지로3가',
    'euljiro 4-ga': '을지로4가', 'euljiro 4ga': '을지로4가', 'ウルチロサガ': '을지로4가', '乙支路4街': '을지로4가',
    'dongdaemun history': '동대문역사문화공원', 'ddp': '동대문역사문화공원', 'トンデムンヨクサムンファコンウォン': '동대문역사문화공원',

    # =========================================================================
    # 서울 3호선
    # =========================================================================
    'gyeongbokgung': '경복궁', 'キョンボックン': '경복궁', '景福宫': '경복궁',
    'anguk': '안국', 'アングク': '안국', '安国': '안국',
    'jongno 3-ga': '종로3가', 'チョンノサムガ': '종로3가', '钟路3街': '종로3가',
    'chungmuro': '충무로', 'チュンムロ': '충무로', '忠武路': '충무로',
    'dongguk university': '동국대', 'dongguk': '동국대', 'トングクデ': '동국대', '东国大': '동국대',
    'yaksu': '약수', 'ヤクス': '약수', '药水': '약수',
    'geumho': '금호', 'クムホ': '금호', '金湖': '금호',
    'oksu': '옥수', 'オクス': '옥수', '玉水': '옥수',
    'apgujeong': '압구정', 'アプクジョン': '압구정', '狎鸥亭': '압구정',
    'sinsa': '신사', 'シンサ': '신사', '新沙': '신사',
    'yangjae': '양재', 'ヤンジェ': '양재', '良才': '양재',
    'nambu bus terminal': '남부터미널', 'nambu terminal': '남부터미널', 'ナンブトミノル': '남부터미널', '南部客运站': '남부터미널',
    'daehwa': '대화', 'テファ': '대화', '大化': '대화',
    'suseo': '수서', 'スソ': '수서', '水西': '수서',
    'ogeum': '오금', 'オグム': '오금', '梧琴': '오금',

    # =========================================================================
    # 서울 4호선
    # =========================================================================
    'myeongdong': '명동', 'ミョンドン': '명동', '明洞': '명동',
    'hoehyeon': '회현', 'フェヒョン': '회현', '会贤': '회현',
    'seoul station': '서울역', 'ソウルヨク': '서울역', '首尔站': '서울역',
    'sookmyung womens university': '숙대입구', 'sookmyung': '숙대입구', 'スクデイック': '숙대입구', '淑大入口': '숙대입구',
    'samgakji': '삼각지', 'サムガクチ': '삼각지', '三角地': '삼각지',
    'sinyongsan': '신용산', 'シニョンサン': '신용산', '新龙山': '신용산',
    'ichon': '이촌', 'イチョン': '이촌', '二村': '이촌',
    'dongjak': '동작', 'トンジャク': '동작', '铜雀': '동작',
    'chongshin university': '총신대입구', 'chongshin': '총신대입구', 'チョンシンデイック': '총신대입구',
    'namtaeryeong': '남태령', 'ナムテリョン': '남태령', '南泰岭': '남태령',
    'sanggye': '상계', 'サンゲ': '상계', '上溪': '상계',
    'nowon': '노원', 'ノウォン': '노원', '芦原': '노원',
    'changdong': '창동', 'チャンドン': '창동', '仓洞': '창동',
    'ssangmun': '쌍문', 'サンムン': '쌍문', '双门': '쌍문',
    'suyu': '수유', 'スユ': '수유', '水逾': '수유',
    'mia': '미아', 'ミア': '미아', '弥阿': '미아',
    'gireum': '길음', 'キルム': '길음', '吉音': '길음',
    'hansung university': '한성대입구', 'hansung': '한성대입구', 'ハンソンデイック': '한성대입구', '汉城大入口': '한성대입구',
    'hyehwa': '혜화', 'ヘファ': '혜화', '惠化': '혜화',
    'dongdaemun': '동대문', 'トンデムン': '동대문', '东大门': '동대문',

    # =========================================================================
    # 서울 5호선
    # =========================================================================
    'gwanghwamun': '광화문', 'カンファムン': '광화문', '光化门': '광화문',
    'jonggak': '종각', 'チョンガク': '종각', '钟阁': '종각',
    'gwangneung forest': '광나루', 'gwangnaru': '광나루', 'カンナル': '광나루', '广津': '광나루',
    'chungjeongno': '충정로', 'チュンジョンノ': '충정로', '忠正路': '충정로',
    'mapo': '마포', 'マポ': '마포', '麻浦': '마포',
    'yeongdeungpo market': '영등포시장', 'yeongdeungpo sijang': '영등포시장', 'ヨンドゥンポシジャン': '영등포시장', '永登浦市场': '영등포시장',
    'yeouinaru': '여의나루', 'ヨイナル': '여의나루', '汝矣渡口': '여의나루',
    'olympic park': '올림픽공원', 'olympic': '올림픽공원', 'オリンピックコンウォン': '올림픽공원', '奥林匹克公园': '올림픽공원',
    'banghwa': '방화', 'バンファ': '방화', '傍花': '방화',
    'gimpo airport': '김포공항', 'gimpo': '김포공항', 'キンポコンハン': '김포공항', '金浦机场': '김포공항',

    # =========================================================================
    # 서울 6호선
    # =========================================================================
    'itaewon': '이태원', 'イテウォン': '이태원', '梨泰院': '이태원',
    'noksapyeong': '녹사평', 'ノクサピョン': '녹사평', '绿莎坪': '녹사평',
    'hangangjin': '한강진', 'ハンガンジン': '한강진', '汉江镇': '한강진',
    'sangsu': '상수', 'サンス': '상수', '上水': '상수',
    'daeheung': '대흥', 'テフン': '대흥', '大兴': '대흥',
    'digital media city': '디지털미디어시티', 'dmc': '디지털미디어시티', 'デジタルミディオシティ': '디지털미디어시티', '数码媒体城': '디지털미디어시티',
    'world cup stadium': '월드컵경기장', 'world cup': '월드컵경기장', 'ワールドカップキョンギジャン': '월드컵경기장', '世界杯体育场': '월드컵경기장',

    # =========================================================================
    # 서울 7호선
    # =========================================================================
    'cheongdam': '청담', 'チョンダム': '청담', '清潭': '청담',
    'gangnam-gu office': '강남구청', 'gangnam gu office': '강남구청', 'カンナムグチョン': '강남구청', '江南区厅': '강남구청',
    'hak-dong': '학동', 'hakdong': '학동', 'ハクトン': '학동', '鹤洞': '학동',
    'nonhyeon': '논현', 'ノンヒョン': '논현', '论岘': '논현',
    'banpo': '반포', 'バンポ': '반포', '盘浦': '반포',
    'express bus terminal': '고속터미널', 'コソクトミノル': '고속터미널', '高速巴士客运站': '고속터미널',
    'naebang': '내방', 'ネバン': '내방', '内方': '내방',
    'total station': '장암', 'jangam': '장암', 'チャンアム': '장암', '长岩': '장암',
    'dobongsan': '도봉산', 'トボンサン': '도봉산', '道峰山': '도봉산',
    'suraksan': '수락산', 'スラクサン': '수락산', '水落山': '수락산',
    'taereung': '태릉입구', 'taereung entrance': '태릉입구', 'テルンイック': '태릉입구', '泰陵入口': '태릉입구',
    'children grand park': '어린이대공원', 'children park': '어린이대공원', 'オリニデコンウォン': '어린이대공원', '儿童大公园': '어린이대공원',

    # =========================================================================
    # 서울 8호선
    # =========================================================================
    'jamsil': '잠실', 'チャムシル': '잠실', '蚕室': '잠실',
    'seokchon': '석촌', 'ソクチョン': '석촌', '石村': '석촌',
    'songpa': '송파', 'ソンパ': '송파', '松坡': '송파',
    'garak market': '가락시장', 'garak': '가락시장', 'カラクシジャン': '가락시장', '可乐市场': '가락시장',
    'moran': '모란', 'モラン': '모란', '牡丹': '모란',

    # =========================================================================
    # 서울 9호선
    # =========================================================================
    'gaehwa': '개화', 'ケファ': '개화', '开花': '개화',
    'airport market': '공항시장', 'コンハンシジャン': '공항시장', '机场市场': '공항시장',
    'sinnonhyeon': '신논현', 'シンノンヒョン': '신논현', '新论岘': '신논현',
    'eonju': '언주', 'オンジュ': '언주', '彦州': '언주',
    'seonjeongneung': '선정릉', 'ソンジョンヌン': '선정릉', '宣靖陵': '선정릉',
    'samseong central': '삼성중앙', 'samseong': '삼성중앙', 'サムソンジュンアン': '삼성중앙', '三成中央': '삼성중앙',
    'bongeunsa': '봉은사', 'ポンウンサ': '봉은사', '奉恩寺': '봉은사',
    'sports complex': '종합운동장', 'sports': '종합운동장', 'チョンハプウンドンジャン': '종합운동장', '综合运动场': '종합운동장',
    'central city': '센트럴시티', 'セントラルシティ': '센트럴시티',

    # =========================================================================
    # 공항철도 (AREX)
    # =========================================================================
    'incheon airport': '인천공항', 'incheon international airport': '인천공항', 'インチョンコンハン': '인천공항', '仁川机场': '인천공항',
    'incheon airport terminal 1': '인천공항1터미널', 'terminal 1': '인천공항1터미널', 'インチョンコンハン1トミノル': '인천공항1터미널', '仁川机场1号航站楼': '인천공항1터미널',
    'incheon airport terminal 2': '인천공항2터미널', 'terminal 2': '인천공항2터미널', 'インチョンコンハン2トミノル': '인천공항2터미널', '仁川机场2号航站楼': '인천공항2터미널',
    'hongik university': '홍대입구', 'ホンイクデ': '홍대입구', '弘益大学': '홍대입구',

    # =========================================================================
    # 신분당선
    # =========================================================================
    'pangyo': '판교', 'パンギョ': '판교', '板桥': '판교',
    'jeongja': '정자', 'チョンジャ': '정자', '亭子': '정자',
    'migeum': '미금', 'ミグム': '미금', '美金': '미금',
    'dongcheon': '동천', 'トンチョン': '동천', '东川': '동천',
    'suji-gu office': '수지구청', 'suji': '수지구청', 'スジグチョン': '수지구청', '水枝区厅': '수지구청',
    'seongbok': '성복', 'ソンボク': '성복', '星福': '성복',
    'sangnyeon': '상현', 'サンヒョン': '상현', '上岘': '상현',
    'gwanggyo': '광교', 'クァンギョ': '광교', '光教': '광교',
    'gwanggyo joongang': '광교중앙', 'クァンギョジュンアン': '광교중앙', '光教中央': '광교중앙',

    # =========================================================================
    # 경의중앙선
    # =========================================================================
    'yongmun': '용문', 'ヨンムン': '용문', '龙门': '용문',
    'paldang': '팔당', 'パルダン': '팔당', '八堂': '팔당',
    'guri': '구리', 'クリ': '구리', '九里': '구리',
    'deokso': '덕소', 'トクソ': '덕소', '德沼': '덕소',
    'paju': '파주', 'パジュ': '파주', '坡州': '파주',
    'munsan': '문산', 'ムンサン': '문산', '汶山': '문산',
    'ilsan': '일산', 'イルサン': '일산', '一山': '일산',

    # =========================================================================
    # 분당선
    # =========================================================================
    'bundang': '분당', 'ブンダン': '분당', '盆唐': '분당',
    'yatap': '야탑', 'ヤタプ': '야탑', '野塔': '야탑',
    'imae': '이매', 'イメ': '이매', '二梅': '이매',
    'seohyeon': '서현', 'ソヒョン': '서현', '书岘': '서현',
    'sunae': '수내', 'スネ': '수내', '水内': '수내',
    'ori': '오리', 'オリ': '오리', '梧里': '오리',
    'jukjeon': '죽전', 'チュクチョン': '죽전', '竹田': '죽전',
    'bojeong': '보정', 'ポジョン': '보정', '宝亭': '보정',
    'giheung': '기흥', 'キフン': '기흥', '器兴': '기흥',
    'mangpo': '망포', 'マンポ': '망포', '望浦': '망포',
    'yeongtong': '영통', 'ヨントン': '영통', '灵通': '영통',
    'cheongmyeong': '청명', 'チョンミョン': '청명', '青明': '청명',

    # =========================================================================
    # 수인선
    # =========================================================================
    'songdo': '송도', 'ソンド': '송도', '松岛': '송도',
    'oido': '오이도', 'オイド': '오이도', '乌耳岛': '오이도',
    'choji': '초지', 'チョジ': '초지', '草芝': '초지',
    'ansan': '안산', 'アンサン': '안산', '安山': '안산',
    'jungang': '중앙', 'チュンアン': '중앙', '中央': '중앙',
    'hanyang university at ansan': '한양대에리카', 'hanyang ansan': '한양대에리카', 'ハニャンデエリカ': '한양대에리카',
}


def translate_station_name(station_name: str) -> str:
    """
    외국어 역 이름을 한국어로 변환합니다.

    Args:
        station_name: 역 이름 (영어, 일본어, 중국어 또는 한국어)

    Returns:
        한국어 역 이름 (매핑이 없으면 원본 반환)
    """
    if not station_name:
        return station_name

    # 소문자로 변환하여 매핑 검색 (영어 대소문자 구분 없이)
    lower_name = station_name.lower().strip()

    # 매핑에서 찾기
    if lower_name in STATION_NAME_MAPPING:
        return STATION_NAME_MAPPING[lower_name]

    # 원본에서도 찾기 (일본어, 중국어는 대소문자 변환 불필요)
    if station_name.strip() in STATION_NAME_MAPPING:
        return STATION_NAME_MAPPING[station_name.strip()]

    # "역" 접미사 제거 후 재시도
    for suffix in ['역', '駅', '站', ' station', ' station']:
        if lower_name.endswith(suffix):
            base_name = lower_name[:-len(suffix)].strip()
            if base_name in STATION_NAME_MAPPING:
                return STATION_NAME_MAPPING[base_name]

    # 매핑이 없으면 원본 반환
    return station_name


class MSSubwayRouteView(APIView):
    """
    지하철 경로 검색 API

    출발역과 도착역을 입력하면 최적의 경로를 제공합니다.
    """
    authentication_classes = []  # 인증 불필요
    permission_classes = [AllowAny]  # 비회원도 접근 가능

    @extend_schema(
        summary="지하철 경로 검색",
        description="""
        출발역과 도착역을 기반으로 지하철 경로를 검색합니다.
        최대 3개의 경로를 반환하며, 옵션에 따라 정렬됩니다.

        - FAST: 최단 시간 경로
        - FEW_TRANSFER: 최소 환승 경로
        - CHEAP: 최저 요금 경로

        주의: powered by www.ODsay.com
        """,
        parameters=[
            OpenApiParameter(
                name="fromStation",
                type=str,
                location=OpenApiParameter.QUERY,
                description="출발역 이름 (예: 강남, 강남역)",
                required=True,
            ),
            OpenApiParameter(
                name="toStation",
                type=str,
                location=OpenApiParameter.QUERY,
                description="도착역 이름 (예: 홍대입구, 홍대입구역)",
                required=True,
            ),
            OpenApiParameter(
                name="option",
                type=str,
                location=OpenApiParameter.QUERY,
                description="경로 옵션: FAST(최단시간), FEW_TRANSFER(최소환승), CHEAP(최소비용)",
                required=False,
                enum=["FAST", "FEW_TRANSFER", "CHEAP"],
            ),
        ],
        responses={
            200: MSSubwayRouteResponseSerializer,
            400: {"description": "잘못된 요청 파라미터"},
            404: {"description": "역을 찾을 수 없거나 경로가 없음"},
            502: {"description": "외부 API 오류"},
        },
    )
    def get(self, request):
        """
        지하철 경로 검색

        Query Parameters:
            fromStation: 출발역 이름
            toStation: 도착역 이름
            option: 경로 옵션 (FAST, FEW_TRANSFER, CHEAP)

        Returns:
            200: 경로 목록 (최대 3개)
            400: 잘못된 요청
            404: 역을 찾을 수 없음
            502: 외부 API 오류
        """
        # 요청 파라미터 검증
        serializer = MSSubwayRouteRequestSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": "요청 파라미터가 올바르지 않습니다.",
                        "details": serializer.errors
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # 파라미터 추출 및 다국어 변환
        from_station_raw = serializer.validated_data["fromStation"]
        to_station_raw = serializer.validated_data["toStation"]
        from_station = translate_station_name(from_station_raw)
        to_station = translate_station_name(to_station_raw)
        option = serializer.validated_data.get("option", "FAST")

        # 호출 수 줄이기 위한 선택 파라미터들
        from_lat = serializer.validated_data.get("fromLat")
        from_lng = serializer.validated_data.get("fromLng")
        to_lat = serializer.validated_data.get("toLat")
        to_lng = serializer.validated_data.get("toLng")

        include_raw = serializer.validated_data.get("include", "") or ""
        include_tokens = {t.strip().lower() for t in include_raw.split(',') if t.strip()}
        include_stops = 'stops' in include_tokens

        try:
            # 지하철 경로 검색
            service = MSSubwayAPIService()
            result = service.ms_search_subway_route(
                from_station=from_station,
                to_station=to_station,
                option=option,
                from_lat=from_lat,
                from_lng=from_lng,
                to_lat=to_lat,
                to_lng=to_lng,
                include_stops=include_stops,
            )

            # 응답 반환
            response_serializer = MSSubwayRouteResponseSerializer(result)
            return Response(response_serializer.data, status=status.HTTP_200_OK)

        except SubwayError as e:
            # 지하철 관련 에러
            if e.code == "SUBWAY_001":  # 역을 찾을 수 없음
                status_code = status.HTTP_404_NOT_FOUND
            elif e.code == "SUBWAY_002":  # 경로 없음
                status_code = status.HTTP_404_NOT_FOUND
            else:  # 외부 API 오류
                status_code = status.HTTP_502_BAD_GATEWAY

            return Response(
                {
                    "success": False,
                    "error": {
                        "code": e.code,
                        "message": e.message
                    }
                },
                status=status_code
            )

        except Exception as e:
            # 예상치 못한 에러
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "INTERNAL_ERROR",
                        "message": "서버 내부 오류가 발생했습니다."
                    }
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class MSSubwayMapMetaView(APIView):
    """
    지하철 노선도 메타 정보 API

    도시별 노선도 이미지 URL과 버전 정보를 제공합니다.
    """
    authentication_classes = []  # 인증 불필요
    permission_classes = [AllowAny]  # 비회원도 접근 가능

    # 도시별 노선도 정보 (정적 데이터)
    SUBWAY_MAP_DATA = {
        "SEOUL": {
            "mapUrl": "https://www.seoulmetro.co.kr/kr/page.do?menuIdx=548",
            "version": "2024.01"
        },
        "BUSAN": {
            "mapUrl": "http://www.humetro.busan.kr/default.htm",
            "version": "2024.01"
        },
        "DAEGU": {
            "mapUrl": "http://www.dtro.or.kr/",
            "version": "2024.01"
        },
        "GWANGJU": {
            "mapUrl": "https://www.gwangju-metro1.co.kr/",
            "version": "2024.01"
        },
        "DAEJEON": {
            "mapUrl": "https://www.djet.co.kr/",
            "version": "2024.01"
        }
    }

    @extend_schema(
        summary="지하철 노선도 메타 정보",
        description="""
        도시별 지하철 노선도 URL과 버전 정보를 제공합니다.
        실제 노선도 이미지는 각 도시 지하철 공사 웹사이트에서 확인할 수 있습니다.
        """,
        parameters=[
            OpenApiParameter(
                name="city",
                type=str,
                location=OpenApiParameter.QUERY,
                description="도시 선택",
                required=True,
                enum=["SEOUL", "BUSAN", "DAEGU", "GWANGJU", "DAEJEON"],
            ),
        ],
        responses={
            200: MSSubwayMapMetaResponseSerializer,
            400: {"description": "잘못된 요청 파라미터"},
            404: {"description": "해당 도시의 노선도 정보 없음"},
        },
    )
    def get(self, request):
        """
        노선도 메타 정보 조회

        Query Parameters:
            city: 도시 코드 (SEOUL, BUSAN, DAEGU, GWANGJU, DAEJEON)

        Returns:
            200: 노선도 URL 및 버전 정보
            400: 잘못된 요청
            404: 해당 도시 정보 없음
        """
        # 요청 파라미터 검증
        serializer = MSSubwayMapMetaRequestSerializer(data=request.query_params)
        if not serializer.is_valid():
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "INVALID_REQUEST",
                        "message": "요청 파라미터가 올바르지 않습니다.",
                        "details": serializer.errors
                    }
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        city = serializer.validated_data["city"]

        # 노선도 정보 조회
        map_data = self.SUBWAY_MAP_DATA.get(city)
        if not map_data:
            return Response(
                {
                    "success": False,
                    "error": {
                        "code": "MAP_NOT_FOUND",
                        "message": "해당 도시의 노선도 정보를 찾을 수 없습니다."
                    }
                },
                status=status.HTTP_404_NOT_FOUND
            )

        # 응답 반환
        response_serializer = MSSubwayMapMetaResponseSerializer(map_data)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
