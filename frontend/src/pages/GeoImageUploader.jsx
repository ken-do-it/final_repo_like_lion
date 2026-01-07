import React, { useState } from 'react';
import exifr from 'exifr'; // ★ 최신 라이브러리 import
import { useNavigate } from 'react-router-dom';

const GeoImageUploader = () => {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const navigate = useNavigate();

  const handleImageUpload = async (e) => { // ★ async 필수
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setImageSrc(URL.createObjectURL(file));

    try {
      console.log("🔍 GPS 정보 추출 중...");

      // ★ exifr의 마법: 한 줄이면 끝납니다.
      // 폰 사진은 회전되어 있을 수 있는데 그것까지 감안해서 좌표를 뽑아줍니다.
      const gpsData = await exifr.gps(file);

      if (gpsData && gpsData.latitude && gpsData.longitude) {
        console.log("✅ 위치 찾음:", gpsData.latitude, gpsData.longitude);

        // 1초 뒤 게임 시작
        setTimeout(() => {
          navigate('/game', { state: { lat: gpsData.latitude, lng: gpsData.longitude } });
          setLoading(false);
        }, 1000);
      } else {
        console.warn("❌ GPS 없음");
        setErrorMessage("⚠️ 이 사진에는 GPS 위치 정보가 없습니다! (다른 사진을 시도해보세요)");
        setLoading(false);
      }
    } catch (error) {
      console.error("⚠️ 에러 발생:", error);
      setErrorMessage("⚠️ 사진 분석 중 오류가 발생했습니다.");
      setLoading(false);
    }
  };



  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>📸 나만의 지오게서 (GeoGuessr)</h2>
      <p>여행 사진을 올리면 <b>로드뷰 퀴즈</b>를 만들어 드립니다!</p>

      <div style={{
        margin: '30px auto',
        padding: '40px',
        border: '3px dashed #aaa',
        borderRadius: '20px',
        maxWidth: '500px',
        backgroundColor: '#f9f9f9',
        cursor: 'pointer'
      }}>
        <label htmlFor="file-upload" style={{ cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold' }}>
          📂 사진 선택하기 (클릭)
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          onChange={(e) => {
            setErrorMessage(null);
            handleImageUpload(e);
          }}
          style={{ display: 'none' }}
        />
      </div>

      {/* 테스트용 버튼 추가 */}
      <button
        onClick={() => navigate('/game', { state: { lat: 37.5665, lng: 126.9780 } })} // 서울 시청 좌표
        style={{
          marginTop: '10px',
          padding: '10px 20px',
          backgroundColor: '#555',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        🛠 테스트 모드 (서울 시청으로 시작)
      </button>

      {/* 에러 메시지 표시 */}
      {errorMessage && (
        <p style={{ color: 'red', fontWeight: 'bold', marginTop: '20px' }}>
          {errorMessage}
        </p>
      )}

      {loading && <p style={{ color: '#007bff', fontWeight: 'bold' }}>📍 사진 속 위치를 찾고 있습니다...</p>}

      {imageSrc && !loading && (
        <div style={{ marginTop: '20px' }}>
          <p>👇 선택한 사진</p>
          <img src={imageSrc} alt="Preview" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '15px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }} />
        </div>
      )}
    </div>
  );
};

export default GeoImageUploader;