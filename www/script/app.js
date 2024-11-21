const CARAVAN_LENGTH = 7484;
const CARAVAN_WIDTH = 2299;
const MAX_ANGLE = 10;

let mainBubble, verticalBubble, horizontalBubble, sensorStatus;

// DOM 요소 초기화 함수
function initializeElements() {
    mainBubble = document.getElementById('mainBubble');
    verticalBubble = document.getElementById('verticalBubble');
    horizontalBubble = document.getElementById('horizontalBubble');
    sensorStatus = document.getElementById('sensorStatus');
    
    if (!mainBubble || !verticalBubble || !horizontalBubble) {
        console.error('필요한 DOM 요소를 찾을 수 없습니다.');
        updateStatus('DOM 요소 초기화 실패');
    } else {
        updateStatus('DOM 요소 초기화 완료');
    }
}

function updateStatus(message) {
    console.log('Status:', message);
    if (sensorStatus) {
        sensorStatus.textContent = message;
    }
}

async function checkAndRequestPermissions() {
    try {
        updateStatus('센서 권한 확인 중...');
        
        // Capacitor 사용 가능 여부 확인
        if (typeof Capacitor === 'undefined') {
            throw new Error('Capacitor를 찾을 수 없습니다.');
        }

        updateStatus('Capacitor 초기화됨');
        
        const { Motion } = Capacitor.Plugins;
        if (!Motion) {
            throw new Error('Motion 플러그인을 찾을 수 없습니다.');
        }
        
        updateStatus('Motion 플러그인 로드됨');
        
        const permissionStatus = await Motion.checkPermissions();
        console.log('권한 상태:', permissionStatus);
        updateStatus('권한 상태 확인됨');
        
        if (permissionStatus.motion !== 'granted') {
            updateStatus('센서 권한 요청 중...');
            const requestResult = await Motion.requestPermissions();
            console.log('권한 요청 결과:', requestResult);
            
            if (requestResult.motion !== 'granted') {
                throw new Error('센서 권한이 거부되었습니다.');
            }
        }
        
        updateStatus('센서 권한 획득됨');
        await initializeSensors();
        
    } catch (error) {
        console.error('권한 요청 실패:', error);
        updateStatus('오류: ' + error.message);
        alert('센서 사용 권한이 필요합니다: ' + error.message);
    }
}

async function initializeSensors() {
    try {
        updateStatus('센서 초기화 중...');
        const { Motion } = Capacitor.Plugins;

        // 이전 리스너 제거
        await Motion.removeAllListeners();
        updateStatus('이전 리스너 제거됨');
        
        // 새로운 리스너 등록
        await Motion.addListener('orientation', (event) => {
            console.log('센서 데이터:', event);
            const { beta, gamma } = event;
            
            // null 체크
            if (beta !== null && gamma !== null) {
                updateStatus(`센서 작동 중 (β:${beta.toFixed(1)}°, γ:${gamma.toFixed(1)}°)`);
                updateBubbles(beta, gamma);
                updateOutriggerValues(calculateHeights(beta, gamma));
            }
        });

        updateStatus('센서 리스너 등록됨');
        
    } catch (error) {
        console.error('센서 초기화 실패:', error);
        updateStatus('센서 오류: ' + error.message);
        alert('센서 초기화 실패: ' + error.message);
    }
}

function calculateHeights(beta, gamma) {
    const fbRadians = beta * (Math.PI / 180);
    const lrRadians = gamma * (Math.PI / 180);
    
    const fbHeightDiff = Math.sin(fbRadians) * (CARAVAN_LENGTH / 2) / 10;
    const lrHeightDiff = Math.sin(lrRadians) * (CARAVAN_WIDTH / 2) / 10;

    const leftHeight = gamma > 0 ? Math.abs(lrHeightDiff) : 0;
    const rightHeight = gamma < 0 ? Math.abs(lrHeightDiff) : 0;

    return {
        frontLeft: beta < 0 ? (Math.abs(fbHeightDiff) + leftHeight) : leftHeight,
        frontRight: beta < 0 ? (Math.abs(fbHeightDiff) + rightHeight) : rightHeight,
        rearLeft: beta > 0 ? (Math.abs(fbHeightDiff) + leftHeight) : leftHeight,
        rearRight: beta > 0 ? (Math.abs(fbHeightDiff) + rightHeight) : rightHeight
    };
}

function limitAngle(angle) {
    return Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, angle));
}

function updateBubbles(beta, gamma) {
    if (!mainBubble || !verticalBubble || !horizontalBubble) {
        console.error('버블 요소를 찾을 수 없습니다.');
        return;
    }

    const limitedBeta = limitAngle(beta);
    const limitedGamma = limitAngle(gamma);

    const circularMaxMove = 60;
    const barMaxMove = 50;

    const x = (-limitedGamma / MAX_ANGLE) * circularMaxMove;
    const y = (-limitedBeta / MAX_ANGLE) * circularMaxMove;
    mainBubble.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    const verticalMove = (-limitedBeta / MAX_ANGLE) * barMaxMove;
    verticalBubble.style.transform = `translate(-50%, calc(-50% + ${verticalMove}px))`;

    const horizontalMove = (-limitedGamma / MAX_ANGLE) * barMaxMove;
    horizontalBubble.style.transform = `translate(calc(-50% + ${horizontalMove}px), -50%)`;
}

function updateOutriggerValues(heights) {
    Object.entries(heights).forEach(([position, height]) => {
        const element = document.getElementById(position);
        if (!element) return;

        const absHeight = Math.abs(height).toFixed(1);
        let className = 'outrigger-value ';
        
        if (absHeight < 1) {
            className += 'level-green';
        } else if (absHeight < 3) {
            className += 'level-yellow';
        } else {
            className += 'level-red';
        }
        
        element.textContent = `${absHeight}cm`;
        element.className = className;
    });
}

// 앱 시작 시 실행
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 로드됨');
    updateStatus('앱 초기화 중...');
    
    // Capacitor가 초기화될 때까지 잠시 대기
    setTimeout(async () => {
        initializeElements();
        await checkAndRequestPermissions();
    }, 1000);
});

// 화면 방향 변경 처리
window.addEventListener('orientationchange', () => {
    console.log('화면 방향 변경됨');
    updateStatus('화면 방향 변경...');
    setTimeout(() => {
        initializeElements();
        checkAndRequestPermissions();
    }, 100);
});

// 전역 에러 핸들러
window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Error:', msg, '\nURL:', url, '\nLine:', lineNo, '\nColumn:', columnNo, '\nError object:', error);
    updateStatus('오류 발생: ' + msg);
    return false;
};