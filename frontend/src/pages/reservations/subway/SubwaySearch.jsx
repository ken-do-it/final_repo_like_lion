import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import { TransportTabs, SearchCard, ReservationSidebar } from '../reservations-components';

/**
 * 지하철 경로 검색 페이지
 * 출발역과 도착역을 입력하여 최적 경로를 검색합니다
 *
 * 주의사항:
 * - 예약/결제 기능 없음 (정보 제공만)
 * - ODsay API를 통해 경로 정보 제공
 * - 카카오맵 연동으로 상세 경로 확인
 *
 * 사용 예시:
 * <Route path="/subway" element={<SubwaySearch />} />
 */
const SubwaySearch = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  /**
   * 폼 데이터 상태
   * fromStation - 출발역 이름
   * toStation - 도착역 이름
   * option - 검색 옵션 (FAST/FEW_TRANSFER/CHEAP)
   */
  const [formData, setFormData] = useState({
    fromStation: '',
    toStation: '',
    option: 'FAST',
  });

  /**
   * 검색 로딩 상태
   */
  const [searchLoading, setSearchLoading] = useState(false);

  /**
   * 검색 옵션 목록
   * FAST - 최단시간
   * FEW_TRANSFER - 최소환승
   * CHEAP - 최소비용
   */
  const searchOptions = [
    { value: 'FAST', label: t('option_fast'), icon: 'schedule' },
    { value: 'FEW_TRANSFER', label: t('option_few_transfer'), icon: 'sync_alt' },
    { value: 'CHEAP', label: t('option_cheap'), icon: 'savings' },
  ];

  /**
   * 주요 지하철역 목록 (자동완성용)
   * 서울 지하철 주요역 + 다국어 지원
   * 1~9호선 + 공항철도 + 경의중앙선 + 신분당선 등 수도권 주요역
   */
  const popularStations = [
    // === 1호선 ===
    { nameKo: '서울역', nameEn: 'Seoul Station', nameJa: 'ソウル駅', nameZh: '首尔站' },
    { nameKo: '시청', nameEn: 'City Hall', nameJa: '市庁', nameZh: '市厅' },
    { nameKo: '종각', nameEn: 'Jonggak', nameJa: '鐘閣', nameZh: '钟阁' },
    { nameKo: '종로3가', nameEn: 'Jongno 3-ga', nameJa: '鐘路3街', nameZh: '钟路3街' },
    { nameKo: '종로5가', nameEn: 'Jongno 5-ga', nameJa: '鐘路5街', nameZh: '钟路5街' },
    { nameKo: '동대문', nameEn: 'Dongdaemun', nameJa: '東大門', nameZh: '东大门' },
    { nameKo: '청량리', nameEn: 'Cheongnyangni', nameJa: '清凉里', nameZh: '清凉里' },
    { nameKo: '용산', nameEn: 'Yongsan', nameJa: '龍山', nameZh: '龙山' },
    { nameKo: '노량진', nameEn: 'Noryangjin', nameJa: '鷺梁津', nameZh: '鹭梁津' },
    { nameKo: '영등포', nameEn: 'Yeongdeungpo', nameJa: '永登浦', nameZh: '永登浦' },
    { nameKo: '구로', nameEn: 'Guro', nameJa: '九老', nameZh: '九老' },
    { nameKo: '수원', nameEn: 'Suwon', nameJa: '水原', nameZh: '水原' },
    { nameKo: '인천', nameEn: 'Incheon', nameJa: '仁川', nameZh: '仁川' },
    { nameKo: '부평', nameEn: 'Bupyeong', nameJa: '富平', nameZh: '富平' },
    { nameKo: '부천', nameEn: 'Bucheon', nameJa: '富川', nameZh: '富川' },
    { nameKo: '안양', nameEn: 'Anyang', nameJa: '安養', nameZh: '安养' },

    // === 2호선 ===
    { nameKo: '강남', nameEn: 'Gangnam', nameJa: '江南', nameZh: '江南' },
    { nameKo: '역삼', nameEn: 'Yeoksam', nameJa: '駅三', nameZh: '驿三' },
    { nameKo: '선릉', nameEn: 'Seolleung', nameJa: '宣陵', nameZh: '宣陵' },
    { nameKo: '삼성', nameEn: 'Samsung', nameJa: '三成', nameZh: '三成' },
    { nameKo: '종합운동장', nameEn: 'Sports Complex', nameJa: '総合運動場', nameZh: '综合运动场' },
    { nameKo: '잠실', nameEn: 'Jamsil', nameJa: '蚕室', nameZh: '蚕室' },
    { nameKo: '잠실새내', nameEn: 'Jamsil Saenae', nameJa: '蚕室セネ', nameZh: '蚕室新内' },
    { nameKo: '건대입구', nameEn: 'Konkuk Univ.', nameJa: '建大入口', nameZh: '建大入口' },
    { nameKo: '왕십리', nameEn: 'Wangsimni', nameJa: '往十里', nameZh: '往十里' },
    { nameKo: '을지로입구', nameEn: 'Euljiro 1-ga', nameJa: '乙支路入口', nameZh: '乙支路入口' },
    { nameKo: '을지로3가', nameEn: 'Euljiro 3-ga', nameJa: '乙支路3街', nameZh: '乙支路3街' },
    { nameKo: '을지로4가', nameEn: 'Euljiro 4-ga', nameJa: '乙支路4街', nameZh: '乙支路4街' },
    { nameKo: '동대문역사문화공원', nameEn: 'DDP', nameJa: '東大門歴史文化公園', nameZh: '东大门历史文化公园' },
    { nameKo: '신당', nameEn: 'Sindang', nameJa: '新堂', nameZh: '新堂' },
    { nameKo: '홍대입구', nameEn: 'Hongik Univ.', nameJa: '弘大入口', nameZh: '弘大入口' },
    { nameKo: '신촌', nameEn: 'Sinchon', nameJa: '新村', nameZh: '新村' },
    { nameKo: '이대', nameEn: 'Ewha Womans Univ.', nameJa: '梨大', nameZh: '梨大' },
    { nameKo: '아현', nameEn: 'Ahyeon', nameJa: '阿現', nameZh: '阿现' },
    { nameKo: '충정로', nameEn: 'Chungjeongno', nameJa: '忠正路', nameZh: '忠正路' },
    { nameKo: '합정', nameEn: 'Hapjeong', nameJa: '合井', nameZh: '合井' },
    { nameKo: '당산', nameEn: 'Dangsan', nameJa: '堂山', nameZh: '堂山' },
    { nameKo: '영등포구청', nameEn: 'Yeongdeungpo-gu Office', nameJa: '永登浦区庁', nameZh: '永登浦区厅' },
    { nameKo: '신도림', nameEn: 'Sindorim', nameJa: '新道林', nameZh: '新道林' },
    { nameKo: '구로디지털단지', nameEn: 'Guro Digital Complex', nameJa: '九老デジタル団地', nameZh: '九老数码园区' },
    { nameKo: '신림', nameEn: 'Sillim', nameJa: '新林', nameZh: '新林' },
    { nameKo: '서울대입구', nameEn: 'Seoul Nat\'l Univ.', nameJa: 'ソウル大入口', nameZh: '首尔大入口' },
    { nameKo: '낙성대', nameEn: 'Nakseongdae', nameJa: '落星垈', nameZh: '落星垈' },
    { nameKo: '사당', nameEn: 'Sadang', nameJa: '舎堂', nameZh: '舍堂' },
    { nameKo: '교대', nameEn: 'Gyodae', nameJa: '教大', nameZh: '教大' },
    { nameKo: '서초', nameEn: 'Seocho', nameJa: '瑞草', nameZh: '瑞草' },
    { nameKo: '방배', nameEn: 'Bangbae', nameJa: '方背', nameZh: '方背' },
    { nameKo: '강변', nameEn: 'Gangbyeon', nameJa: '江辺', nameZh: '江边' },
    { nameKo: '구의', nameEn: 'Guui', nameJa: '九宜', nameZh: '九宜' },
    { nameKo: '성수', nameEn: 'Seongsu', nameJa: '聖水', nameZh: '圣水' },
    { nameKo: '뚝섬', nameEn: 'Ttukseom', nameJa: 'トゥクソム', nameZh: '纛岛' },
    { nameKo: '한양대', nameEn: 'Hanyang Univ.', nameJa: '漢陽大', nameZh: '汉阳大' },

    // === 3호선 ===
    { nameKo: '안국', nameEn: 'Anguk', nameJa: '安国', nameZh: '安国' },
    { nameKo: '경복궁', nameEn: 'Gyeongbokgung', nameJa: '景福宮', nameZh: '景福宫' },
    { nameKo: '충무로', nameEn: 'Chungmuro', nameJa: '忠武路', nameZh: '忠武路' },
    { nameKo: '동대입구', nameEn: 'Dongguk Univ.', nameJa: '東大入口', nameZh: '东大入口' },
    { nameKo: '약수', nameEn: 'Yaksu', nameJa: '薬水', nameZh: '药水' },
    { nameKo: '금호', nameEn: 'Geumho', nameJa: '金湖', nameZh: '金湖' },
    { nameKo: '옥수', nameEn: 'Oksu', nameJa: '玉水', nameZh: '玉水' },
    { nameKo: '압구정', nameEn: 'Apgujeong', nameJa: '狎鷗亭', nameZh: '狎鸥亭' },
    { nameKo: '신사', nameEn: 'Sinsa', nameJa: '新沙', nameZh: '新沙' },
    { nameKo: '잠원', nameEn: 'Jamwon', nameJa: '蚕院', nameZh: '蚕院' },
    { nameKo: '고속터미널', nameEn: 'Express Bus Terminal', nameJa: '高速ターミナル', nameZh: '高速客运站' },
    { nameKo: '남부터미널', nameEn: 'Nambu Terminal', nameJa: '南部ターミナル', nameZh: '南部客运站' },
    { nameKo: '양재', nameEn: 'Yangjae', nameJa: '良才', nameZh: '良才' },
    { nameKo: '매봉', nameEn: 'Maebong', nameJa: '梅峰', nameZh: '梅峰' },
    { nameKo: '도곡', nameEn: 'Dogok', nameJa: '道谷', nameZh: '道谷' },
    { nameKo: '대치', nameEn: 'Daechi', nameJa: '大峙', nameZh: '大峙' },
    { nameKo: '학여울', nameEn: 'Hangnyeoul', nameJa: '鶴汝蔚', nameZh: '鹤汝蔚' },
    { nameKo: '대청', nameEn: 'Daecheong', nameJa: '大清', nameZh: '大清' },
    { nameKo: '일원', nameEn: 'Irwon', nameJa: '逸院', nameZh: '逸院' },
    { nameKo: '수서', nameEn: 'Suseo', nameJa: '水西', nameZh: '水西' },
    { nameKo: '가락시장', nameEn: 'Garak Market', nameJa: '可楽市場', nameZh: '可乐市场' },
    { nameKo: '오금', nameEn: 'Ogeum', nameJa: '梧琴', nameZh: '梧琴' },
    { nameKo: '독립문', nameEn: 'Dongnimmun', nameJa: '独立門', nameZh: '独立门' },
    { nameKo: '무악재', nameEn: 'Muakjae', nameJa: '毋岳峙', nameZh: '毋岳峙' },
    { nameKo: '홍제', nameEn: 'Hongje', nameJa: '弘濟', nameZh: '弘济' },
    { nameKo: '불광', nameEn: 'Bulgwang', nameJa: '仏光', nameZh: '佛光' },
    { nameKo: '연신내', nameEn: 'Yeonsinnae', nameJa: '延新内', nameZh: '延新内' },
    { nameKo: '구파발', nameEn: 'Gupabal', nameJa: '旧把撥', nameZh: '旧把拨' },

    // === 4호선 ===
    { nameKo: '명동', nameEn: 'Myeongdong', nameJa: '明洞', nameZh: '明洞' },
    { nameKo: '회현', nameEn: 'Hoehyeon', nameJa: '会賢', nameZh: '会贤' },
    { nameKo: '숙대입구', nameEn: 'Sookmyung Women\'s Univ.', nameJa: '淑大入口', nameZh: '淑大入口' },
    { nameKo: '삼각지', nameEn: 'Samgakji', nameJa: '三角地', nameZh: '三角地' },
    { nameKo: '신용산', nameEn: 'Sinyongsan', nameJa: '新龍山', nameZh: '新龙山' },
    { nameKo: '이촌', nameEn: 'Ichon', nameJa: '二村', nameZh: '二村' },
    { nameKo: '동작', nameEn: 'Dongjak', nameJa: '銅雀', nameZh: '铜雀' },
    { nameKo: '총신대입구', nameEn: 'Chongshin Univ.', nameJa: '総神大入口', nameZh: '总神大入口' },
    { nameKo: '혜화', nameEn: 'Hyehwa', nameJa: '恵化', nameZh: '惠化' },
    { nameKo: '한성대입구', nameEn: 'Hansung Univ.', nameJa: '漢城大入口', nameZh: '汉城大入口' },
    { nameKo: '성신여대입구', nameEn: 'Sungshin Women\'s Univ.', nameJa: '誠信女大入口', nameZh: '诚信女大入口' },
    { nameKo: '길음', nameEn: 'Gireum', nameJa: '吉音', nameZh: '吉音' },
    { nameKo: '미아사거리', nameEn: 'Mia Sageori', nameJa: '弥阿サゴリ', nameZh: '弥阿十字路口' },
    { nameKo: '수유', nameEn: 'Suyu', nameJa: '水踰', nameZh: '水踰' },
    { nameKo: '쌍문', nameEn: 'Ssangmun', nameJa: '双門', nameZh: '双门' },
    { nameKo: '창동', nameEn: 'Changdong', nameJa: '倉洞', nameZh: '仓洞' },
    { nameKo: '노원', nameEn: 'Nowon', nameJa: '蘆原', nameZh: '芦原' },
    { nameKo: '상계', nameEn: 'Sanggye', nameJa: '上渓', nameZh: '上溪' },
    { nameKo: '당고개', nameEn: 'Danggogae', nameJa: '堂古介', nameZh: '堂古介' },

    // === 5호선 ===
    { nameKo: '광화문', nameEn: 'Gwanghwamun', nameJa: '光化門', nameZh: '光化门' },
    { nameKo: '서대문', nameEn: 'Seodaemun', nameJa: '西大門', nameZh: '西大门' },
    { nameKo: '공덕', nameEn: 'Gongdeok', nameJa: '孔徳', nameZh: '孔德' },
    { nameKo: '마포', nameEn: 'Mapo', nameJa: '麻浦', nameZh: '麻浦' },
    { nameKo: '여의도', nameEn: 'Yeouido', nameJa: '汝矣島', nameZh: '汝矣岛' },
    { nameKo: '여의나루', nameEn: 'Yeouinaru', nameJa: '汝矣ナル', nameZh: '汝矣渡口' },
    { nameKo: '영등포시장', nameEn: 'Yeongdeungpo Market', nameJa: '永登浦市場', nameZh: '永登浦市场' },
    { nameKo: '신길', nameEn: 'Singil', nameJa: '新吉', nameZh: '新吉' },
    { nameKo: '까치산', nameEn: 'Kkachisan', nameJa: 'カチサン', nameZh: '喜鹊山' },
    { nameKo: '화곡', nameEn: 'Hwagok', nameJa: '禾谷', nameZh: '禾谷' },
    { nameKo: '발산', nameEn: 'Balsan', nameJa: '鉢山', nameZh: '钵山' },
    { nameKo: '우장산', nameEn: 'Ujangsan', nameJa: '牛装山', nameZh: '牛装山' },
    { nameKo: '김포공항', nameEn: 'Gimpo Int\'l Airport', nameJa: '金浦空港', nameZh: '金浦机场' },
    { nameKo: '송정', nameEn: 'Songjeong', nameJa: '松亭', nameZh: '松亭' },
    { nameKo: '방화', nameEn: 'Banghwa', nameJa: '傍花', nameZh: '傍花' },
    { nameKo: '종로3가', nameEn: 'Jongno 3-ga', nameJa: '鐘路3街', nameZh: '钟路3街' },
    { nameKo: '답십리', nameEn: 'Dapsimni', nameJa: '踏十里', nameZh: '踏十里' },
    { nameKo: '장한평', nameEn: 'Janghanpyeong', nameJa: '長漢坪', nameZh: '长汉坪' },
    { nameKo: '군자', nameEn: 'Gunja', nameJa: '君子', nameZh: '君子' },
    { nameKo: '아차산', nameEn: 'Achasan', nameJa: '峨嵯山', nameZh: '峨嵯山' },
    { nameKo: '광나루', nameEn: 'Gwangnaru', nameJa: '広渡', nameZh: '广津' },
    { nameKo: '천호', nameEn: 'Cheonho', nameJa: '千戸', nameZh: '千户' },
    { nameKo: '강동', nameEn: 'Gangdong', nameJa: '江東', nameZh: '江东' },
    { nameKo: '길동', nameEn: 'Gildong', nameJa: '吉洞', nameZh: '吉洞' },
    { nameKo: '굽은다리', nameEn: 'Gubeundari', nameJa: 'クブンダリ', nameZh: '弯桥' },
    { nameKo: '명일', nameEn: 'Myeongil', nameJa: '明逸', nameZh: '明逸' },
    { nameKo: '고덕', nameEn: 'Godeok', nameJa: '高徳', nameZh: '高德' },
    { nameKo: '상일동', nameEn: 'Sangil-dong', nameJa: '上一洞', nameZh: '上一洞' },
    { nameKo: '강일', nameEn: 'Gangil', nameJa: '江一', nameZh: '江一' },
    { nameKo: '미사', nameEn: 'Misa', nameJa: '渼沙', nameZh: '渼沙' },
    { nameKo: '하남풍산', nameEn: 'Hanam Pungsan', nameJa: 'ハナム風山', nameZh: '河南丰山' },
    { nameKo: '하남시청', nameEn: 'Hanam City Hall', nameJa: 'ハナム市庁', nameZh: '河南市厅' },
    { nameKo: '하남검단산', nameEn: 'Hanam Geomdansan', nameJa: 'ハナム黔丹山', nameZh: '河南黔丹山' },

    // === 6호선 ===
    { nameKo: '이태원', nameEn: 'Itaewon', nameJa: '梨泰院', nameZh: '梨泰院' },
    { nameKo: '한강진', nameEn: 'Hangangjin', nameJa: '漢江鎮', nameZh: '汉江镇' },
    { nameKo: '녹사평', nameEn: 'Noksapyeong', nameJa: '緑莎坪', nameZh: '绿莎坪' },
    { nameKo: '효창공원앞', nameEn: 'Hyochang Park', nameJa: '孝昌公園前', nameZh: '孝昌公园前' },
    { nameKo: '대흥', nameEn: 'Daeheung', nameJa: '大興', nameZh: '大兴' },
    { nameKo: '상수', nameEn: 'Sangsu', nameJa: '上水', nameZh: '上水' },
    { nameKo: '광흥창', nameEn: 'Gwangheungchang', nameJa: '光興倉', nameZh: '光兴仓' },
    { nameKo: '디지털미디어시티', nameEn: 'Digital Media City', nameJa: 'デジタルメディアシティ', nameZh: '数字媒体城' },
    { nameKo: '월드컵경기장', nameEn: 'World Cup Stadium', nameJa: 'ワールドカップ競技場', nameZh: '世界杯体育场' },
    { nameKo: '마포구청', nameEn: 'Mapo-gu Office', nameJa: '麻浦区庁', nameZh: '麻浦区厅' },
    { nameKo: '망원', nameEn: 'Mangwon', nameJa: '望遠', nameZh: '望远' },
    { nameKo: '증산', nameEn: 'Jeungsan', nameJa: '甑山', nameZh: '甑山' },
    { nameKo: '새절', nameEn: 'Saejeol', nameJa: 'セジョル', nameZh: '新寺' },
    { nameKo: '응암', nameEn: 'Eungam', nameJa: '鷹岩', nameZh: '鹰岩' },
    { nameKo: '역촌', nameEn: 'Yeokchon', nameJa: '駅村', nameZh: '驿村' },
    { nameKo: '구산', nameEn: 'Gusan', nameJa: '亀山', nameZh: '龟山' },
    { nameKo: '연신내', nameEn: 'Yeonsinnae', nameJa: '延新内', nameZh: '延新内' },
    { nameKo: '버티고개', nameEn: 'Beottigogae', nameJa: 'ポッティゴゲ', nameZh: '伯蒂峠' },
    { nameKo: '약수', nameEn: 'Yaksu', nameJa: '薬水', nameZh: '药水' },
    { nameKo: '청구', nameEn: 'Cheonggu', nameJa: '青丘', nameZh: '青丘' },
    { nameKo: '신금호', nameEn: 'Singeumho', nameJa: '新金湖', nameZh: '新金湖' },
    { nameKo: '안암', nameEn: 'Anam', nameJa: '安岩', nameZh: '安岩' },
    { nameKo: '고려대', nameEn: 'Korea Univ.', nameJa: '高麗大', nameZh: '高丽大' },
    { nameKo: '월곡', nameEn: 'Wolgok', nameJa: '月谷', nameZh: '月谷' },
    { nameKo: '상월곡', nameEn: 'Sangwolgok', nameJa: '上月谷', nameZh: '上月谷' },
    { nameKo: '돌곶이', nameEn: 'Dolgoji', nameJa: 'トルゴジ', nameZh: '石串' },
    { nameKo: '석계', nameEn: 'Seokgye', nameJa: '石渓', nameZh: '石溪' },
    { nameKo: '태릉입구', nameEn: 'Taereung', nameJa: '泰陵入口', nameZh: '泰陵入口' },
    { nameKo: '화랑대', nameEn: 'Hwarangdae', nameJa: '花郎台', nameZh: '花郎台' },
    { nameKo: '봉화산', nameEn: 'Bonghwasan', nameJa: '烽火山', nameZh: '烽火山' },

    // === 7호선 ===
    { nameKo: '논현', nameEn: 'Nonhyeon', nameJa: '論峴', nameZh: '论岘' },
    { nameKo: '학동', nameEn: 'Hakdong', nameJa: '鶴洞', nameZh: '鹤洞' },
    { nameKo: '강남구청', nameEn: 'Gangnam-gu Office', nameJa: '江南区庁', nameZh: '江南区厅' },
    { nameKo: '청담', nameEn: 'Cheongdam', nameJa: '清潭', nameZh: '清潭' },
    { nameKo: '뚝섬유원지', nameEn: 'Ttukseom Resort', nameJa: 'トゥクソム遊園地', nameZh: '纛岛游园地' },
    { nameKo: '어린이대공원', nameEn: 'Children\'s Grand Park', nameJa: '子供大公園', nameZh: '儿童大公园' },
    { nameKo: '상봉', nameEn: 'Sangbong', nameJa: '上鳳', nameZh: '上凤' },
    { nameKo: '면목', nameEn: 'Myeonmok', nameJa: '面牧', nameZh: '面牧' },
    { nameKo: '사가정', nameEn: 'Sagajeong', nameJa: '舎稼亭', nameZh: '舍稼亭' },
    { nameKo: '용마산', nameEn: 'Yongmasan', nameJa: '龍馬山', nameZh: '龙马山' },
    { nameKo: '중곡', nameEn: 'Junggok', nameJa: '中谷', nameZh: '中谷' },
    { nameKo: '보라매', nameEn: 'Boramae', nameJa: 'ポラメ', nameZh: '宝拉美' },
    { nameKo: '신대방삼거리', nameEn: 'Sindaebang Samgeori', nameJa: '新大方サムゴリ', nameZh: '新大方三街' },
    { nameKo: '장승배기', nameEn: 'Jangseungbaegi', nameJa: 'チャンスンベギ', nameZh: '将承白旗' },
    { nameKo: '남성', nameEn: 'Namseong', nameJa: '南城', nameZh: '南城' },
    { nameKo: '이수', nameEn: 'Isu', nameJa: '梨水', nameZh: '梨水' },
    { nameKo: '내방', nameEn: 'Naebang', nameJa: '内方', nameZh: '内方' },
    { nameKo: '반포', nameEn: 'Banpo', nameJa: '盤浦', nameZh: '盘浦' },
    { nameKo: '신논현', nameEn: 'Sinnonhyeon', nameJa: '新論峴', nameZh: '新论岘' },
    { nameKo: '가산디지털단지', nameEn: 'Gasan Digital Complex', nameJa: '加山デジタル団地', nameZh: '加山数码园区' },
    { nameKo: '대림', nameEn: 'Daerim', nameJa: '大林', nameZh: '大林' },
    { nameKo: '남구로', nameEn: 'Namguro', nameJa: '南九老', nameZh: '南九老' },
    { nameKo: '철산', nameEn: 'Cheolsan', nameJa: '鉄山', nameZh: '铁山' },
    { nameKo: '광명사거리', nameEn: 'Gwangmyeong Sageori', nameJa: '光明サゴリ', nameZh: '光明十字路口' },
    { nameKo: '천왕', nameEn: 'Cheonwang', nameJa: '天旺', nameZh: '天旺' },
    { nameKo: '온수', nameEn: 'Onsu', nameJa: '温水', nameZh: '温水' },
    { nameKo: '도봉산', nameEn: 'Dobongsan', nameJa: '道峰山', nameZh: '道峰山' },
    { nameKo: '수락산', nameEn: 'Suraksan', nameJa: '水落山', nameZh: '水落山' },
    { nameKo: '마들', nameEn: 'Madeul', nameJa: 'マドゥル', nameZh: '麻坪' },
    { nameKo: '노원', nameEn: 'Nowon', nameJa: '蘆原', nameZh: '芦原' },
    { nameKo: '중계', nameEn: 'Junggye', nameJa: '中渓', nameZh: '中溪' },
    { nameKo: '하계', nameEn: 'Hagye', nameJa: '下渓', nameZh: '下溪' },
    { nameKo: '공릉', nameEn: 'Gongneung', nameJa: '孔陵', nameZh: '孔陵' },
    { nameKo: '태릉입구', nameEn: 'Taereung', nameJa: '泰陵入口', nameZh: '泰陵入口' },
    { nameKo: '먹골', nameEn: 'Meokgol', nameJa: 'モッコル', nameZh: '墨谷' },

    // === 8호선 ===
    { nameKo: '암사', nameEn: 'Amsa', nameJa: '岩寺', nameZh: '岩寺' },
    { nameKo: '천호', nameEn: 'Cheonho', nameJa: '千戸', nameZh: '千户' },
    { nameKo: '강동구청', nameEn: 'Gangdong-gu Office', nameJa: '江東区庁', nameZh: '江东区厅' },
    { nameKo: '몽촌토성', nameEn: 'Mongchontoseong', nameJa: '夢村土城', nameZh: '梦村土城' },
    { nameKo: '잠실', nameEn: 'Jamsil', nameJa: '蚕室', nameZh: '蚕室' },
    { nameKo: '석촌', nameEn: 'Seokchon', nameJa: '石村', nameZh: '石村' },
    { nameKo: '송파', nameEn: 'Songpa', nameJa: '松坡', nameZh: '松坡' },
    { nameKo: '가락시장', nameEn: 'Garak Market', nameJa: '可楽市場', nameZh: '可乐市场' },
    { nameKo: '문정', nameEn: 'Munjeong', nameJa: '文井', nameZh: '文井' },
    { nameKo: '장지', nameEn: 'Jangji', nameJa: '長旨', nameZh: '长旨' },
    { nameKo: '복정', nameEn: 'Bokjeong', nameJa: '福井', nameZh: '福井' },
    { nameKo: '남위례', nameEn: 'Namwirye', nameJa: '南慰礼', nameZh: '南慰礼' },
    { nameKo: '산성', nameEn: 'Sanseong', nameJa: '山城', nameZh: '山城' },
    { nameKo: '남한산성입구', nameEn: 'Namhansanseong', nameJa: '南漢山城入口', nameZh: '南汉山城入口' },
    { nameKo: '단대오거리', nameEn: 'Dandae Ogeori', nameJa: '丹大オゴリ', nameZh: '丹大五街' },
    { nameKo: '신흥', nameEn: 'Sinheung', nameJa: '新興', nameZh: '新兴' },
    { nameKo: '수진', nameEn: 'Sujin', nameJa: '寿進', nameZh: '寿进' },
    { nameKo: '모란', nameEn: 'Moran', nameJa: '牡丹', nameZh: '牡丹' },

    // === 9호선 ===
    { nameKo: '개화', nameEn: 'Gaehwa', nameJa: '開花', nameZh: '开花' },
    { nameKo: '김포공항', nameEn: 'Gimpo Int\'l Airport', nameJa: '金浦空港', nameZh: '金浦机场' },
    { nameKo: '공항시장', nameEn: 'Airport Market', nameJa: '空港市場', nameZh: '机场市场' },
    { nameKo: '신방화', nameEn: 'Sinbanghwa', nameJa: '新傍花', nameZh: '新傍花' },
    { nameKo: '마곡나루', nameEn: 'Magongnaru', nameJa: '麻谷渡', nameZh: '麻谷渡' },
    { nameKo: '양천향교', nameEn: 'Yangcheon Hyanggyo', nameJa: '陽川郷校', nameZh: '阳川乡校' },
    { nameKo: '가양', nameEn: 'Gayang', nameJa: '加陽', nameZh: '加阳' },
    { nameKo: '증미', nameEn: 'Jeungmi', nameJa: '甑味', nameZh: '甑味' },
    { nameKo: '등촌', nameEn: 'Deungchon', nameJa: '登村', nameZh: '登村' },
    { nameKo: '염창', nameEn: 'Yeomchang', nameJa: '塩倉', nameZh: '盐仓' },
    { nameKo: '신목동', nameEn: 'Sinmokdong', nameJa: '新木洞', nameZh: '新木洞' },
    { nameKo: '선유도', nameEn: 'Seonyudo', nameJa: '仙遊島', nameZh: '仙游岛' },
    { nameKo: '당산', nameEn: 'Dangsan', nameJa: '堂山', nameZh: '堂山' },
    { nameKo: '국회의사당', nameEn: 'National Assembly', nameJa: '国会議事堂', nameZh: '国会议事堂' },
    { nameKo: '여의도', nameEn: 'Yeouido', nameJa: '汝矣島', nameZh: '汝矣岛' },
    { nameKo: '샛강', nameEn: 'Saetgang', nameJa: 'セッカン', nameZh: '新江' },
    { nameKo: '노량진', nameEn: 'Noryangjin', nameJa: '鷺梁津', nameZh: '鹭梁津' },
    { nameKo: '노들', nameEn: 'Nodeul', nameJa: 'ノドゥル', nameZh: '鹭得' },
    { nameKo: '흑석', nameEn: 'Heukseok', nameJa: '黒石', nameZh: '黑石' },
    { nameKo: '동작', nameEn: 'Dongjak', nameJa: '銅雀', nameZh: '铜雀' },
    { nameKo: '구반포', nameEn: 'Gubanpo', nameJa: '旧盤浦', nameZh: '旧盘浦' },
    { nameKo: '신반포', nameEn: 'Sinbanpo', nameJa: '新盤浦', nameZh: '新盘浦' },
    { nameKo: '고속터미널', nameEn: 'Express Bus Terminal', nameJa: '高速ターミナル', nameZh: '高速客运站' },
    { nameKo: '사평', nameEn: 'Sapyeong', nameJa: '沙坪', nameZh: '沙坪' },
    { nameKo: '신논현', nameEn: 'Sinnonhyeon', nameJa: '新論峴', nameZh: '新论岘' },
    { nameKo: '언주', nameEn: 'Eonju', nameJa: '彦州', nameZh: '彦州' },
    { nameKo: '선정릉', nameEn: 'Seonjeongneung', nameJa: '宣靖陵', nameZh: '宣靖陵' },
    { nameKo: '삼성중앙', nameEn: 'Samsung Jungang', nameJa: '三成中央', nameZh: '三成中央' },
    { nameKo: '봉은사', nameEn: 'Bongeunsa', nameJa: '奉恩寺', nameZh: '奉恩寺' },
    { nameKo: '종합운동장', nameEn: 'Sports Complex', nameJa: '総合運動場', nameZh: '综合运动场' },
    { nameKo: '삼전', nameEn: 'Samjeon', nameJa: '三田', nameZh: '三田' },
    { nameKo: '석촌고분', nameEn: 'Seokchon Gobun', nameJa: '石村古墳', nameZh: '石村古坟' },
    { nameKo: '석촌', nameEn: 'Seokchon', nameJa: '石村', nameZh: '石村' },
    { nameKo: '송파나루', nameEn: 'Songpanaru', nameJa: '松坡渡', nameZh: '松坡渡' },
    { nameKo: '한성백제', nameEn: 'Hanseong Baekje', nameJa: '漢城百済', nameZh: '汉城百济' },
    { nameKo: '올림픽공원', nameEn: 'Olympic Park', nameJa: 'オリンピック公園', nameZh: '奥林匹克公园' },
    { nameKo: '둔촌오륜', nameEn: 'Dunchon Oryun', nameJa: '屯村五輪', nameZh: '屯村五轮' },
    { nameKo: '중앙보훈병원', nameEn: 'VHS Medical Center', nameJa: '中央報勲病院', nameZh: '中央报勋医院' },

    // === 공항철도 ===
    { nameKo: '인천공항1터미널', nameEn: 'Incheon Airport T1', nameJa: '仁川空港第1ターミナル', nameZh: '仁川机场1号航站楼' },
    { nameKo: '인천공항2터미널', nameEn: 'Incheon Airport T2', nameJa: '仁川空港第2ターミナル', nameZh: '仁川机场2号航站楼' },
    { nameKo: '공항화물청사', nameEn: 'Airport Cargo Terminal', nameJa: '空港貨物庁舎', nameZh: '机场货运大楼' },
    { nameKo: '운서', nameEn: 'Unseo', nameJa: '雲西', nameZh: '云西' },
    { nameKo: '영종', nameEn: 'Yeongjong', nameJa: '永宗', nameZh: '永宗' },
    { nameKo: '청라국제도시', nameEn: 'Cheongna Int\'l City', nameJa: '青羅国際都市', nameZh: '青罗国际城市' },
    { nameKo: '검암', nameEn: 'Geomam', nameJa: '黔岩', nameZh: '黔岩' },
    { nameKo: '계양', nameEn: 'Gyeyang', nameJa: '桂陽', nameZh: '桂阳' },
    { nameKo: '김포공항', nameEn: 'Gimpo Int\'l Airport', nameJa: '金浦空港', nameZh: '金浦机场' },
    { nameKo: '디지털미디어시티', nameEn: 'Digital Media City', nameJa: 'デジタルメディアシティ', nameZh: '数字媒体城' },
    { nameKo: '홍대입구', nameEn: 'Hongik Univ.', nameJa: '弘大入口', nameZh: '弘大入口' },
    { nameKo: '공덕', nameEn: 'Gongdeok', nameJa: '孔徳', nameZh: '孔德' },
    { nameKo: '서울역', nameEn: 'Seoul Station', nameJa: 'ソウル駅', nameZh: '首尔站' },

    // === 신분당선 ===
    { nameKo: '신사', nameEn: 'Sinsa', nameJa: '新沙', nameZh: '新沙' },
    { nameKo: '논현', nameEn: 'Nonhyeon', nameJa: '論峴', nameZh: '论岘' },
    { nameKo: '신논현', nameEn: 'Sinnonhyeon', nameJa: '新論峴', nameZh: '新论岘' },
    { nameKo: '강남', nameEn: 'Gangnam', nameJa: '江南', nameZh: '江南' },
    { nameKo: '양재', nameEn: 'Yangjae', nameJa: '良才', nameZh: '良才' },
    { nameKo: '양재시민의숲', nameEn: 'Yangjae Citizen\'s Forest', nameJa: '良才市民の森', nameZh: '良才市民之林' },
    { nameKo: '청계산입구', nameEn: 'Cheonggyesan', nameJa: '清渓山入口', nameZh: '清溪山入口' },
    { nameKo: '판교', nameEn: 'Pangyo', nameJa: '板橋', nameZh: '板桥' },
    { nameKo: '정자', nameEn: 'Jeongja', nameJa: '亭子', nameZh: '亭子' },
    { nameKo: '미금', nameEn: 'Migeum', nameJa: '美金', nameZh: '美金' },
    { nameKo: '동천', nameEn: 'Dongcheon', nameJa: '東川', nameZh: '东川' },
    { nameKo: '수지구청', nameEn: 'Suji-gu Office', nameJa: '水枝区庁', nameZh: '水枝区厅' },
    { nameKo: '성복', nameEn: 'Seongbok', nameJa: '星福', nameZh: '星福' },
    { nameKo: '상현', nameEn: 'Sanghyeon', nameJa: '上峴', nameZh: '上岘' },
    { nameKo: '광교중앙', nameEn: 'Gwanggyo Jungang', nameJa: '光教中央', nameZh: '光教中央' },
    { nameKo: '광교', nameEn: 'Gwanggyo', nameJa: '光教', nameZh: '光教' },

    // === 경의중앙선 ===
    { nameKo: '용문', nameEn: 'Yongmun', nameJa: '龍門', nameZh: '龙门' },
    { nameKo: '양평', nameEn: 'Yangpyeong', nameJa: '楊平', nameZh: '杨平' },
    { nameKo: '덕소', nameEn: 'Deokso', nameJa: '徳沼', nameZh: '德沼' },
    { nameKo: '팔당', nameEn: 'Paldang', nameJa: '八堂', nameZh: '八堂' },
    { nameKo: '도농', nameEn: 'Donong', nameJa: '道農', nameZh: '道农' },
    { nameKo: '양정', nameEn: 'Yangjeong', nameJa: '養正', nameZh: '养正' },
    { nameKo: '구리', nameEn: 'Guri', nameJa: '九里', nameZh: '九里' },
    { nameKo: '왕십리', nameEn: 'Wangsimni', nameJa: '往十里', nameZh: '往十里' },
    { nameKo: '청량리', nameEn: 'Cheongnyangni', nameJa: '清凉里', nameZh: '清凉里' },
    { nameKo: '회기', nameEn: 'Hoegi', nameJa: '回基', nameZh: '回基' },
    { nameKo: '중랑', nameEn: 'Jungnang', nameJa: '中浪', nameZh: '中浪' },
    { nameKo: '상봉', nameEn: 'Sangbong', nameJa: '上鳳', nameZh: '上凤' },
    { nameKo: '망우', nameEn: 'Mangu', nameJa: '忘憂', nameZh: '忘忧' },
    { nameKo: '서울역', nameEn: 'Seoul Station', nameJa: 'ソウル駅', nameZh: '首尔站' },
    { nameKo: '신촌', nameEn: 'Sinchon', nameJa: '新村', nameZh: '新村' },
    { nameKo: '홍대입구', nameEn: 'Hongik Univ.', nameJa: '弘大入口', nameZh: '弘大入口' },
    { nameKo: '가좌', nameEn: 'Gajwa', nameJa: '加佐', nameZh: '加佐' },
    { nameKo: '디지털미디어시티', nameEn: 'Digital Media City', nameJa: 'デジタルメディアシティ', nameZh: '数字媒体城' },
    { nameKo: '수색', nameEn: 'Susaek', nameJa: '水色', nameZh: '水色' },
    { nameKo: '화전', nameEn: 'Hwajeon', nameJa: '花田', nameZh: '花田' },
    { nameKo: '행신', nameEn: 'Haengsin', nameJa: '幸信', nameZh: '幸信' },
    { nameKo: '능곡', nameEn: 'Neunggok', nameJa: '陵谷', nameZh: '陵谷' },
    { nameKo: '대곡', nameEn: 'Daegok', nameJa: '大谷', nameZh: '大谷' },
    { nameKo: '백마', nameEn: 'Baengma', nameJa: '白馬', nameZh: '白马' },
    { nameKo: '풍산', nameEn: 'Pungsan', nameJa: '楓山', nameZh: '枫山' },
    { nameKo: '일산', nameEn: 'Ilsan', nameJa: '一山', nameZh: '一山' },
    { nameKo: '탄현', nameEn: 'Tanhyeon', nameJa: '炭峴', nameZh: '炭岘' },
    { nameKo: '야당', nameEn: 'Yadang', nameJa: '野塘', nameZh: '野塘' },
    { nameKo: '운정', nameEn: 'Unjeong', nameJa: '雲井', nameZh: '云井' },
    { nameKo: '금릉', nameEn: 'Geumneung', nameJa: '金陵', nameZh: '金陵' },
    { nameKo: '금촌', nameEn: 'Geumchon', nameJa: '金村', nameZh: '金村' },
    { nameKo: '월롱', nameEn: 'Wollong', nameJa: '月籠', nameZh: '月笼' },
    { nameKo: '파주', nameEn: 'Paju', nameJa: '坡州', nameZh: '坡州' },
    { nameKo: '문산', nameEn: 'Munsan', nameJa: '汶山', nameZh: '汶山' },

    // === 분당선 / 수인분당선 ===
    { nameKo: '왕십리', nameEn: 'Wangsimni', nameJa: '往十里', nameZh: '往十里' },
    { nameKo: '서울숲', nameEn: 'Seoul Forest', nameJa: 'ソウルの森', nameZh: '首尔林' },
    { nameKo: '압구정로데오', nameEn: 'Apgujeong Rodeo', nameJa: '狎鷗亭ロデオ', nameZh: '狎鸥亭罗德奥' },
    { nameKo: '강남구청', nameEn: 'Gangnam-gu Office', nameJa: '江南区庁', nameZh: '江南区厅' },
    { nameKo: '선정릉', nameEn: 'Seonjeongneung', nameJa: '宣靖陵', nameZh: '宣靖陵' },
    { nameKo: '선릉', nameEn: 'Seolleung', nameJa: '宣陵', nameZh: '宣陵' },
    { nameKo: '한티', nameEn: 'Hanti', nameJa: 'ハンティ', nameZh: '汉峠' },
    { nameKo: '도곡', nameEn: 'Dogok', nameJa: '道谷', nameZh: '道谷' },
    { nameKo: '구룡', nameEn: 'Guryong', nameJa: '九龍', nameZh: '九龙' },
    { nameKo: '개포동', nameEn: 'Gaepo-dong', nameJa: '開浦洞', nameZh: '开浦洞' },
    { nameKo: '대모산입구', nameEn: 'Daemosan', nameJa: '大母山入口', nameZh: '大母山入口' },
    { nameKo: '수서', nameEn: 'Suseo', nameJa: '水西', nameZh: '水西' },
    { nameKo: '복정', nameEn: 'Bokjeong', nameJa: '福井', nameZh: '福井' },
    { nameKo: '가천대', nameEn: 'Gachon Univ.', nameJa: '嘉泉大', nameZh: '嘉泉大' },
    { nameKo: '태평', nameEn: 'Taepyeong', nameJa: '太平', nameZh: '太平' },
    { nameKo: '모란', nameEn: 'Moran', nameJa: '牡丹', nameZh: '牡丹' },
    { nameKo: '야탑', nameEn: 'Yatap', nameJa: '野塔', nameZh: '野塔' },
    { nameKo: '이매', nameEn: 'Imae', nameJa: '二梅', nameZh: '二梅' },
    { nameKo: '서현', nameEn: 'Seohyeon', nameJa: '書峴', nameZh: '书岘' },
    { nameKo: '수내', nameEn: 'Sunae', nameJa: '水内', nameZh: '水内' },
    { nameKo: '정자', nameEn: 'Jeongja', nameJa: '亭子', nameZh: '亭子' },
    { nameKo: '미금', nameEn: 'Migeum', nameJa: '美金', nameZh: '美金' },
    { nameKo: '오리', nameEn: 'Ori', nameJa: '梧里', nameZh: '梧里' },
    { nameKo: '죽전', nameEn: 'Jukjeon', nameJa: '竹田', nameZh: '竹田' },
    { nameKo: '보정', nameEn: 'Bojeong', nameJa: '宝井', nameZh: '宝井' },
    { nameKo: '구성', nameEn: 'Guseong', nameJa: '駒城', nameZh: '驹城' },
    { nameKo: '신갈', nameEn: 'Singal', nameJa: '新葛', nameZh: '新葛' },
    { nameKo: '기흥', nameEn: 'Giheung', nameJa: '器興', nameZh: '器兴' },
    { nameKo: '상갈', nameEn: 'Sanggal', nameJa: '上葛', nameZh: '上葛' },
    { nameKo: '청명', nameEn: 'Cheongmyeong', nameJa: '清明', nameZh: '清明' },
    { nameKo: '영통', nameEn: 'Yeongtong', nameJa: '霊通', nameZh: '灵通' },
    { nameKo: '망포', nameEn: 'Mangpo', nameJa: '網浦', nameZh: '网浦' },
    { nameKo: '매탄권선', nameEn: 'Maetan Gwonseon', nameJa: '梅灘勧善', nameZh: '梅滩劝善' },
    { nameKo: '수원시청', nameEn: 'Suwon City Hall', nameJa: '水原市庁', nameZh: '水原市厅' },
    { nameKo: '매교', nameEn: 'Maegyo', nameJa: '梅橋', nameZh: '梅桥' },
    { nameKo: '수원', nameEn: 'Suwon', nameJa: '水原', nameZh: '水原' },
    { nameKo: '고색', nameEn: 'Gosaek', nameJa: '古索', nameZh: '古索' },
    { nameKo: '오목천', nameEn: 'Omokcheon', nameJa: '梧木川', nameZh: '梧木川' },
    { nameKo: '어천', nameEn: 'Eocheon', nameJa: '漁川', nameZh: '渔川' },
    { nameKo: '야목', nameEn: 'Yamok', nameJa: '野牧', nameZh: '野牧' },
    { nameKo: '사리', nameEn: 'Sari', nameJa: '沙里', nameZh: '沙里' },
    { nameKo: '한대앞', nameEn: 'Hanyang Univ. at Ansan', nameJa: '漢大前', nameZh: '汉大前' },
    { nameKo: '중앙', nameEn: 'Jungang', nameJa: '中央', nameZh: '中央' },
    { nameKo: '고잔', nameEn: 'Gojan', nameJa: '古桟', nameZh: '古栈' },
    { nameKo: '초지', nameEn: 'Choji', nameJa: '草芝', nameZh: '草芝' },
    { nameKo: '안산', nameEn: 'Ansan', nameJa: '安山', nameZh: '安山' },
    { nameKo: '신길온천', nameEn: 'Singil Oncheon', nameJa: '新吉温泉', nameZh: '新吉温泉' },
    { nameKo: '정왕', nameEn: 'Jeongwang', nameJa: '正往', nameZh: '正往' },
    { nameKo: '오이도', nameEn: 'Oido', nameJa: '烏耳島', nameZh: '乌耳岛' },
    { nameKo: '달월', nameEn: 'Darwol', nameJa: '月月', nameZh: '达月' },
    { nameKo: '월곶', nameEn: 'Wolgot', nameJa: '月串', nameZh: '月串' },
    { nameKo: '소래포구', nameEn: 'Sorae Pogu', nameJa: '蘇萊浦口', nameZh: '苏莱浦口' },
    { nameKo: '인천논현', nameEn: 'Incheon Nonhyeon', nameJa: '仁川論峴', nameZh: '仁川论岘' },
    { nameKo: '호구포', nameEn: 'Hogupo', nameJa: '虎邱浦', nameZh: '虎邱浦' },
    { nameKo: '남동인더스파크', nameEn: 'Namdong Induspark', nameJa: '南洞インダスパーク', nameZh: '南洞产业园区' },
    { nameKo: '원인재', nameEn: 'Woninjae', nameJa: '遠仁斎', nameZh: '远仁斋' },
    { nameKo: '연수', nameEn: 'Yeonsu', nameJa: '延寿', nameZh: '延寿' },
    { nameKo: '송도', nameEn: 'Songdo', nameJa: '松島', nameZh: '松岛' },
    { nameKo: '인하대', nameEn: 'Inha Univ.', nameJa: '仁荷大', nameZh: '仁荷大' },
    { nameKo: '숭의', nameEn: 'Sungui', nameJa: '崇義', nameZh: '崇义' },
    { nameKo: '신포', nameEn: 'Sinpo', nameJa: '新浦', nameZh: '新浦' },
    { nameKo: '인천', nameEn: 'Incheon', nameJa: '仁川', nameZh: '仁川' },

    // === GTX-A ===
    { nameKo: '수서', nameEn: 'Suseo', nameJa: '水西', nameZh: '水西' },
    { nameKo: '삼성', nameEn: 'Samsung', nameJa: '三成', nameZh: '三成' },
    { nameKo: '서울역', nameEn: 'Seoul Station', nameJa: 'ソウル駅', nameZh: '首尔站' },
    { nameKo: '연신내', nameEn: 'Yeonsinnae', nameJa: '延新内', nameZh: '延新内' },
    { nameKo: '대곡', nameEn: 'Daegok', nameJa: '大谷', nameZh: '大谷' },
    { nameKo: '킨텍스', nameEn: 'KINTEX', nameJa: 'キンテックス', nameZh: 'KINTEX' },
    { nameKo: '운정', nameEn: 'Unjeong', nameJa: '雲井', nameZh: '云井' },
    { nameKo: '성남', nameEn: 'Seongnam', nameJa: '城南', nameZh: '城南' },
    { nameKo: '용인', nameEn: 'Yongin', nameJa: '龍仁', nameZh: '龙仁' },
    { nameKo: '동탄', nameEn: 'Dongtan', nameJa: '東灘', nameZh: '东滩' },
  ];

  /**
   * 언어에 따라 역 이름 선택
   */
  const getStationName = (station) => {
    switch (language) {
      case 'English':
        return station.nameEn || station.nameKo;
      case '日本語':
        return station.nameJa || station.nameKo;
      case '中文':
        return station.nameZh || station.nameKo;
      case '한국어':
        return station.nameKo;
      default:
        return station.nameKo;
    }
  };

  /**
   * 입력 필드 변경 핸들러
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /**
   * 출발역과 도착역 교환
   */
  const handleSwap = () => {
    setFormData(prev => ({
      ...prev,
      fromStation: prev.toStation,
      toStation: prev.fromStation,
    }));
  };

  /**
   * 검색 옵션 변경 핸들러
   */
  const handleOptionChange = (option) => {
    setFormData(prev => ({
      ...prev,
      option: option
    }));
  };

  /**
   * 검색 폼 제출 핸들러
   */
  const handleSearch = (e) => {
    e.preventDefault();

    /**
     * 필수 필드 검증
     */
    if (!formData.fromStation || !formData.toStation) {
      alert(t('alert_fill_all_subway_search'));
      return;
    }

    /**
     * 출발역과 도착역이 같은지 확인
     */
    if (formData.fromStation === formData.toStation) {
      alert(t('alert_same_station'));
      return;
    }

    /**
     * 검색 결과 페이지로 이동
     * location.state로 검색 조건 전달
     */
    navigate('/reservations/subway/route', {
      state: {
        searchParams: formData
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#f6f7f8] dark:bg-[#101a22]">
      <div className="max-w-screen-xl mx-auto px-4 py-8">
        {/* 페이지 제목 */}
        <h1 className="text-3xl font-bold mb-6 dark:text-white">
          {t('title_transport')}
        </h1>

        {/* 교통수단 탭 */}
        <TransportTabs />

        {/* 메인 그리드 레이아웃 (8:4) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
          {/* 왼쪽 영역: 검색 폼 */}
          <div className="lg:col-span-8">
            <SearchCard title={t('title_subway_search')}>
              <form onSubmit={handleSearch} className="space-y-6">
                {/* 출발역 / 도착역 */}
                <div className="grid grid-cols-12 gap-4 items-end">
                  {/* 출발역 */}
                  <div className="col-span-5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('label_dep_station')}
                    </label>
                    <input
                      type="text"
                      name="fromStation"
                      value={formData.fromStation}
                      onChange={handleChange}
                      placeholder={t('placeholder_input_dep_station')}
                      required
                      list="from-stations"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1e2b36] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <datalist id="from-stations">
                      {popularStations.map((station) => (
                        <option key={station.nameKo} value={getStationName(station)} />
                      ))}
                    </datalist>
                  </div>

                  {/* 교환 버튼 */}
                  <div className="col-span-2 flex justify-center items-center">
                    <button
                      type="button"
                      onClick={handleSwap}
                      className="w-10 h-10 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark hover:rotate-180 transition-all duration-300 flex items-center justify-center"
                      title="출발역과 도착역 교환"
                    >
                      <span className="material-symbols-outlined">swap_horiz</span>
                    </button>
                  </div>

                  {/* 도착역 */}
                  <div className="col-span-5">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('label_arr_station')}
                    </label>
                    <input
                      type="text"
                      name="toStation"
                      value={formData.toStation}
                      onChange={handleChange}
                      placeholder={t('placeholder_input_arr_station')}
                      required
                      list="to-stations"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-[#1e2b36] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                    <datalist id="to-stations">
                      {popularStations.map((station) => (
                        <option key={station.nameKo} value={getStationName(station)} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* 검색 옵션 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    {t('label_search_option')}
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {searchOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleOptionChange(option.value)}
                        className={`p-4 rounded-lg border-2 transition-all ${formData.option === option.value
                          ? 'border-primary bg-primary/5 dark:bg-primary/10'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                      >
                        <span className={`material-symbols-outlined block text-3xl mb-2 ${formData.option === option.value
                          ? 'text-primary'
                          : 'text-gray-400 dark:text-gray-500'
                          }`}>
                          {option.icon}
                        </span>
                        <span className={`text-sm font-medium ${formData.option === option.value
                          ? 'text-primary'
                          : 'text-gray-700 dark:text-gray-300'
                          }`}>
                          {option.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 검색 버튼 */}
                <button
                  type="submit"
                  disabled={searchLoading}
                  className="w-full bg-primary text-white py-4 rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {searchLoading ? t('btn_searching_train') : t('btn_search_route')}
                </button>
              </form>
            </SearchCard>

            {/* 안내 사항 */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-xl">info</span>
                {t('title_subway_guide')}
              </h3>
              <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 ml-8">
                <li>{t('info_subway_1')}</li>
                <li>{t('info_subway_2')}</li>
                <li>{t('info_subway_3')}</li>
                <li>{t('info_subway_4')}</li>
                <li>{t('info_subway_5')}</li>
              </ul>
            </div>
          </div>

          {/* 오른쪽 영역: 사이드바 */}
          <div className="lg:col-span-4">
            <ReservationSidebar />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubwaySearch;
