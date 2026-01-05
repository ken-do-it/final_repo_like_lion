import React, { useEffect, useRef } from 'react';

const RoadviewGame = ({ lat, lng }) => {
  const roadviewRef = useRef(null);

  useEffect(() => {
    if (!window.kakao) return;

    const roadviewContainer = roadviewRef.current;
    const roadview = new window.kakao.maps.Roadview(roadviewContainer);
    const roadviewClient = new window.kakao.maps.RoadviewClient();

    const position = new window.kakao.maps.LatLng(lat, lng);

    // 좌표 근처(반경 50m)에 가장 가까운 로드뷰 파노라마 ID를 찾음
    roadviewClient.getNearestPanoId(position, 50, (panoId) => {
      if (panoId) {
        roadview.setPanoId(panoId, position); // 로드뷰 실행
      } else {
        alert("이 위치 근처에는 로드뷰가 없습니다 ㅠㅠ (산속이나 바다 위일 수도?)");
      }
    });
  }, [lat, lng]);

  return (
    <div className="game-container">
      <h3>🌍 여기가 어디일까요?</h3>
      {/* 1. 로드뷰 화면 (힌트) */}
      <div 
        ref={roadviewRef} 
        style={{ width: '100%', height: '400px', borderRadius: '10px' }} 
      />
      
      {/* 2. 정답 맞히기 지도 (여기에 카카오맵 띄워서 클릭 이벤트 받으면 됨) */}
      <div className="guess-map-area">
        <p>👇 아래 지도에서 위치를 찍어보세요!</p>
        {/* <GuessMapComponent /> */}
      </div>
    </div>
  );
};

export default RoadviewGame;