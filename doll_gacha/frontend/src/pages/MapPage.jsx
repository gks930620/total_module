import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { callPublicApi } from '../lib/http.js'

// map.html 의 카카오맵 SDK 와 동일한 키/URL 을 그대로 사용한다.
const KAKAO_MAP_KEY = '719ae502dd3351fab0a5fa57689ef5cd'
const KAKAO_SDK_SRC =
  'https://dapi.kakao.com/v2/maps/sdk.js?appkey=' +
  KAKAO_MAP_KEY +
  '&libraries=services,clusterer&autoload=false'

// 시도 목록 (map.html sidoSelect 와 동일 순서)
const SIDO_LIST = [
  '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시',
  '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도',
  '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도',
  '경상남도', '제주특별자치도',
]

// 지역별 지도 중심 좌표 (map.html regionCenters)
const REGION_CENTERS = {
  '서울특별시': { lat: 37.5665, lng: 126.9780, level: 8 },
  '부산광역시': { lat: 35.1796, lng: 129.0756, level: 8 },
  '대구광역시': { lat: 35.8714, lng: 128.6014, level: 8 },
  '인천광역시': { lat: 37.4563, lng: 126.7052, level: 9 },
  '광주광역시': { lat: 35.1595, lng: 126.8526, level: 8 },
  '대전광역시': { lat: 36.3504, lng: 127.3845, level: 8 },
  '울산광역시': { lat: 35.5384, lng: 129.3114, level: 8 },
  '세종특별자치시': { lat: 36.4800, lng: 127.2890, level: 9 },
  '경기도': { lat: 37.4138, lng: 127.5183, level: 10 },
  '강원특별자치도': { lat: 37.8228, lng: 128.1555, level: 11 },
  '충청북도': { lat: 36.6424, lng: 127.4890, level: 10 },
  '충청남도': { lat: 36.5184, lng: 126.8000, level: 10 },
  '전북특별자치도': { lat: 35.7175, lng: 127.1530, level: 10 },
  '전라남도': { lat: 34.8679, lng: 126.9910, level: 10 },
  '경상북도': { lat: 36.4919, lng: 128.8889, level: 11 },
  '경상남도': { lat: 35.4606, lng: 128.2132, level: 10 },
  '제주특별자치도': { lat: 33.4890, lng: 126.4983, level: 10 },
}

// 시도별 시군구 데이터 (map.html sigunguData)
const SIGUNGU_DATA = {
  '서울특별시': ['강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'],
  '부산광역시': ['강서구', '금정구', '기장군', '남구', '동구', '동래구', '부산진구', '북구', '사상구', '사하구', '서구', '수영구', '연제구', '영도구', '중구', '해운대구'],
  '대구광역시': ['남구', '달서구', '달성군', '동구', '북구', '서구', '수성구', '중구'],
  '인천광역시': ['강화군', '계양구', '남동구', '동구', '미추홀구', '부평구', '서구', '연수구', '옹진군', '중구'],
  '광주광역시': ['광산구', '남구', '동구', '북구', '서구'],
  '대전광역시': ['대덕구', '동구', '서구', '유성구', '중구'],
  '울산광역시': ['남구', '동구', '북구', '울주군', '중구'],
  '세종특별자치시': ['세종시'],
  '경기도': ['가평군', '고양시', '과천시', '광명시', '광주시', '구리시', '군포시', '김포시', '남양주시', '동두천시', '부천시', '성남시', '수원시', '시흥시', '안산시', '안성시', '안양시', '양주시', '양평군', '여주시', '연천군', '오산시', '용인시', '의왕시', '의정부시', '이천시', '파주시', '평택시', '포천시', '하남시', '화성시'],
  '강원특별자치도': ['강릉시', '고성군', '동해시', '삼척시', '속초시', '양구군', '양양군', '영월군', '원주시', '인제군', '정선군', '철원군', '춘천시', '태백시', '평창군', '홍천군', '화천군', '횡성군'],
  '충청북도': ['괴산군', '단양군', '보은군', '영동군', '옥천군', '음성군', '제천시', '증평군', '진천군', '청주시', '충주시'],
  '충청남도': ['계룡시', '공주시', '금산군', '논산시', '당진시', '보령시', '부여군', '서산시', '서천군', '아산시', '예산군', '천안시', '청양군', '태안군', '홍성군'],
  '전북특별자치도': ['고창군', '군산시', '김제시', '남원시', '무주군', '부안군', '순창군', '완주군', '익산시', '임실군', '장수군', '전주시', '정읍시', '진안군'],
  '전라남도': ['강진군', '고흥군', '곡성군', '광양시', '구례군', '나주시', '담양군', '목포시', '무안군', '보성군', '순천시', '신안군', '여수시', '영광군', '영암군', '완도군', '장성군', '장흥군', '진도군', '함평군', '해남군', '화순군'],
  '경상북도': ['경산시', '경주시', '고령군', '구미시', '군위군', '김천시', '문경시', '봉화군', '상주시', '성주군', '안동시', '영덕군', '영양군', '영주시', '영천시', '예천군', '울릉군', '울진군', '의성군', '청도군', '청송군', '칠곡군', '포항시'],
  '경상남도': ['거제시', '거창군', '고성군', '김해시', '남해군', '밀양시', '사천시', '산청군', '양산시', '의령군', '진주시', '창녕군', '창원시', '통영시', '하동군', '함안군', '함양군', '합천군'],
  '제주특별자치도': ['서귀포시', '제주시'],
}

// 시군구별 중심 좌표 (map.html sigunguCenters)
const SIGUNGU_CENTERS = {
  '대전광역시-대덕구': { lat: 36.3693, lng: 127.4147, level: 7 },
  '대전광역시-동구': { lat: 36.3393, lng: 127.4458, level: 7 },
  '대전광역시-서구': { lat: 36.3504, lng: 127.3845, level: 7 },
  '대전광역시-유성구': { lat: 36.3566, lng: 127.3423, level: 7 },
  '대전광역시-중구': { lat: 36.3273, lng: 127.4295, level: 7 },
  '서울특별시-강남구': { lat: 37.5172, lng: 127.0473, level: 7 },
  '서울특별시-강서구': { lat: 37.5509, lng: 126.8495, level: 7 },
  '서울특별시-송파구': { lat: 37.5145, lng: 127.1059, level: 7 },
  '서울특별시-마포구': { lat: 37.5663, lng: 126.9019, level: 7 },
  '부산광역시-해운대구': { lat: 35.1587, lng: 129.1603, level: 7 },
  '부산광역시-부산진구': { lat: 35.1577, lng: 129.0595, level: 7 },
  '부산광역시-남구': { lat: 35.1363, lng: 129.0847, level: 7 },
  '부산광역시-동래구': { lat: 35.2048, lng: 129.0785, level: 7 },
}

const CLUSTERER_STYLES = [
  {
    width: '50px', height: '50px', background: '#6200ea', borderRadius: '25px',
    color: '#fff', textAlign: 'center', lineHeight: '50px', fontSize: '14px',
    fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  {
    width: '60px', height: '60px', background: '#3700b3', borderRadius: '30px',
    color: '#fff', textAlign: 'center', lineHeight: '60px', fontSize: '16px',
    fontWeight: 'bold', boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
  {
    width: '70px', height: '70px', background: '#1a0052', borderRadius: '35px',
    color: '#fff', textAlign: 'center', lineHeight: '70px', fontSize: '18px',
    fontWeight: 'bold', boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
  },
]

// 카카오맵 SDK 동적 로드 (중복 주입 방지). autoload=false 이므로 명시적 load 호출.
function loadKakaoSdk() {
  return new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps) {
      window.kakao.maps.load(() => resolve())
      return
    }
    const existing = document.querySelector(`script[src="${KAKAO_SDK_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => window.kakao.maps.load(() => resolve()))
      existing.addEventListener('error', reject)
      return
    }
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.src = KAKAO_SDK_SRC
    script.onload = () => window.kakao.maps.load(() => resolve())
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export default function MapPage() {
  const navigate = useNavigate()

  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const clustererRef = useRef(null)
  const infowindowRef = useRef(null)
  const markersRef = useRef([])
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const [sido, setSido] = useState('서울특별시')
  const [sigungu, setSigungu] = useState('')
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')

  // 인포윈도우 콘텐츠를 DOM 노드로 생성 (React 스코프에서 이벤트 직접 바인딩)
  const buildInfowindowContent = useCallback((place) => {
    const wrap = document.createElement('div')
    wrap.className = 'custom-infowindow'
    wrap.innerHTML = `
      <div class="infowindow-header">
        <div>
          <div class="infowindow-title"></div>
          <div class="infowindow-rating" style="color:#757575;font-size:13px;"></div>
        </div>
        <button class="infowindow-close" type="button" aria-label="닫기">
          <span class="material-icons">close</span>
        </button>
      </div>
      <div class="infowindow-body">
        <p><span class="material-icons">location_on</span><span class="iw-addr"></span></p>
      </div>
      <div class="infowindow-footer">
        <button class="infowindow-btn infowindow-btn-primary iw-detail" type="button">
          <span class="material-icons">info</span> 상세보기
        </button>
        <button class="infowindow-btn infowindow-btn-secondary iw-directions" type="button">
          <span class="material-icons">directions</span> 길찾기
        </button>
      </div>
    `
    wrap.querySelector('.infowindow-title').textContent = place.place_name
    if (place.totalGameMachines) {
      wrap.querySelector('.infowindow-rating').textContent =
        '총 기계 수: ' + place.totalGameMachines + '대'
    }
    wrap.querySelector('.iw-addr').textContent =
      place.address_name || place.road_address_name || ''

    if (place.phone) {
      const p = document.createElement('p')
      const icon = document.createElement('span')
      icon.className = 'material-icons'
      icon.textContent = 'phone'
      const txt = document.createElement('span')
      txt.textContent = place.phone
      p.appendChild(icon)
      p.appendChild(txt)
      wrap.querySelector('.infowindow-body').appendChild(p)
    }

    wrap.querySelector('.infowindow-close').addEventListener('click', () => {
      infowindowRef.current?.close()
    })
    wrap.querySelector('.iw-detail').addEventListener('click', () => {
      navigateRef.current(`/doll-shop/detail?id=${place.id}`)
    })
    wrap.querySelector('.iw-directions').addEventListener('click', () => {
      window.open(`https://map.kakao.com/link/to/목적지,${place.y},${place.x}`, '_blank')
    })
    return wrap
  }, [])

  // 지역별 가게 검색 (DB) → 마커 표시 (map.html searchDollCatcherShops)
  const searchShops = useCallback(async (region, gu) => {
    const kakao = window.kakao
    if (!kakao || !mapRef.current || !clustererRef.current) return

    // 기존 마커 제거
    clustererRef.current.clear()
    markersRef.current = []
    infowindowRef.current?.close()

    // 지도 중심 이동
    let center
    if (gu) {
      center = SIGUNGU_CENTERS[`${region}-${gu}`] || REGION_CENTERS[region]
    } else {
      center = REGION_CENTERS[region]
    }
    if (center) {
      mapRef.current.setCenter(new kakao.maps.LatLng(center.lat, center.lng))
      mapRef.current.setLevel(center.level)
    }

    // 서버 데이터 조회 (엔드포인트/파라미터 동일)
    let apiUrl = `/api/doll-shops/map?gubun1=${encodeURIComponent(region)}`
    if (gu) apiUrl += `&gubun2=${encodeURIComponent(gu)}`

    try {
      setError('')
      const result = await callPublicApi(apiUrl)
      const shops = result.data
      if (!Array.isArray(shops)) {
        console.error('응답 데이터가 배열이 아닙니다:', shops)
        return
      }

      const markers = shops.map((shop) => {
        const place = {
          id: shop.id,
          place_name: shop.businessName,
          address_name: shop.address,
          road_address_name: shop.address,
          phone: shop.phone || '',
          x: shop.longitude,
          y: shop.latitude,
          totalGameMachines: shop.totalGameMachines,
          approvalDate: shop.approvalDate,
          isOperating: shop.isOperating,
        }
        const marker = new kakao.maps.Marker({
          position: new kakao.maps.LatLng(place.y, place.x),
          title: place.place_name,
        })
        kakao.maps.event.addListener(marker, 'click', () => {
          infowindowRef.current.setContent(buildInfowindowContent(place))
          infowindowRef.current.open(mapRef.current, marker)
        })
        return marker
      })

      markersRef.current = markers
      clustererRef.current.addMarkers(markers)
    } catch (err) {
      console.error('데이터 로드 실패:', err)
      setError(err.message || '데이터를 불러오지 못했습니다.')
    }
  }, [buildInfowindowContent])

  // SDK 로드 + 지도 초기화 (마운트 시 1회)
  useEffect(() => {
    let cancelled = false

    loadKakaoSdk()
      .then(() => {
        if (cancelled || !containerRef.current) return
        const kakao = window.kakao

        mapRef.current = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(37.5665, 126.9780),
          level: 8,
        })
        infowindowRef.current = new kakao.maps.InfoWindow({ zIndex: 1 })
        clustererRef.current = new kakao.maps.MarkerClusterer({
          map: mapRef.current,
          averageCenter: true,
          minLevel: 5,
          calculator: [10, 30, 50],
          styles: CLUSTERER_STYLES,
        })

        setReady(true)
        // 기본 지역(서울) 로드
        searchShops('서울특별시', null)
      })
      .catch((err) => {
        console.error('카카오맵 스크립트 로드 실패', err)
        setError('지도를 불러오지 못했습니다.')
      })

    return () => {
      cancelled = true
    }
  }, [searchShops])

  const onSidoChange = (e) => {
    const value = e.target.value
    setSido(value)
    setSigungu('')
    if (ready) searchShops(value, null)
  }

  const onSigunguChange = (e) => {
    const value = e.target.value
    setSigungu(value)
    if (ready) searchShops(sido, value || null)
  }

  const sigunguOptions = SIGUNGU_DATA[sido] || []

  return (
    <div>
      <style>{`
        .region-filter-section { background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.1); border-radius:8px; margin-bottom:24px; }
        .filter-container { display:flex; align-items:center; gap:16px; flex-wrap:wrap; padding:16px 24px; }
        .filter-group { display:flex; align-items:center; gap:8px; }
        .filter-group label { font-size:14px; font-weight:500; color:#424242; display:flex; align-items:center; gap:4px; }
        .filter-select { border:1px solid #e0e0e0; border-radius:4px; padding:8px 12px; font-size:14px; outline:none; cursor:pointer; background:#fff; min-width:150px; transition:border-color 0.2s; }
        .filter-select:hover { border-color:#6200ea; }
        .filter-select:focus { border-color:#6200ea; box-shadow:0 0 0 2px rgba(98,0,234,0.1); }

        .map-container { width:100%; height:540px; position:relative; border-radius:8px; overflow:hidden; box-shadow:0 2px 4px rgba(0,0,0,0.1); }
        .map-container > div { width:100%; height:100%; background-color:#f0f0f0; }

        .custom-infowindow { background:#fff; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15); padding:16px; min-width:250px; }
        .infowindow-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; }
        .infowindow-title { font-size:16px; font-weight:500; color:#212121; margin-bottom:4px; }
        .infowindow-rating { color:#f57c00; font-size:14px; display:flex; align-items:center; gap:4px; }
        .infowindow-body { font-size:14px; color:#757575; line-height:1.6; }
        .infowindow-body p { margin:4px 0; display:flex; align-items:center; gap:8px; }
        .infowindow-body .material-icons { font-size:18px; color:#9e9e9e; }
        .infowindow-close { background:none; border:none; cursor:pointer; padding:0; color:#757575; display:flex; align-items:center; }
        .infowindow-close:hover { color:#212121; }
        .infowindow-close .material-icons { font-size:20px; }
        .infowindow-footer { margin-top:12px; padding-top:12px; border-top:1px solid #e0e0e0; display:flex; gap:8px; }
        .infowindow-btn { flex:1; padding:8px 12px; border:none; border-radius:4px; font-size:13px; font-weight:500; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:4px; transition:all 0.2s; }
        .infowindow-btn-primary { background-color:#6200ea; color:#fff; }
        .infowindow-btn-primary:hover { background-color:#3700b3; }
        .infowindow-btn-secondary { background-color:#f5f5f5; color:#424242; }
        .infowindow-btn-secondary:hover { background-color:#eeeeee; }
        .infowindow-btn .material-icons { font-size:16px; }

        @media (max-width: 768px) {
          .filter-container { padding:12px 16px; }
          .filter-group { flex:1 1 auto; }
          .filter-select { min-width:auto; flex:1; }
          .map-container { height:450px; border-radius:4px; }
        }
      `}</style>

      <div className="region-filter-section">
        <div className="filter-container">
          <div className="filter-group">
            <label htmlFor="sidoSelect">
              <span className="material-icons" style={{ fontSize: 18 }}>location_city</span>
              시/도
            </label>
            <select id="sidoSelect" className="filter-select" value={sido} onChange={onSidoChange}>
              {SIDO_LIST.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="sigunguSelect">
              <span className="material-icons" style={{ fontSize: 18 }}>place</span>
              시/군/구
            </label>
            <select id="sigunguSelect" className="filter-select" value={sigungu} onChange={onSigunguChange}>
              <option value="">전체</option>
              {sigunguOptions.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <div className="state-msg">{error}</div>}

      <div className="map-container">
        <div ref={containerRef} />
      </div>
    </div>
  )
}
