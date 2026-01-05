import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },  // 10초 동안 50명까지 1차 투입
    { duration: '20s', target: 100 }, // 20초 동안 100명까지 증원 (Full Load)
    { duration: '30s', target: 100 }, // 30초 동안 100명 유지 (지옥의 시간)
    { duration: '10s', target: 0 },   // 10초 동안 철수
  ],
  // 에러가 너무 많이 나면 테스트 자동 중단 (안전장치)
  thresholds: {
    http_req_failed: ['rate<0.01'], // 에러율 1% 미만이어야 함
    http_req_duration: ['p(95)<500'], // 95%의 요청이 0.5초 안에는 끝나야 함
  },
};

export default function () {
  // ★ 수정: 'localhost' (X) -> 'host.docker.internal' (O)
  // ★ 포트: 외부 포트인 8001번 사용
  const url = 'http://host.docker.internal:8001/search'; 
  
  const payload = JSON.stringify({
    query: '서울',
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(url, payload, params);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'duration < 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(1);
}