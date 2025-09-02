console.log("✅ script.js loaded and running");
// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const trackingTime = document.getElementById('trackingTime');
const attentivenessBar = document.getElementById('attentivenessBar');
const attentivenessText = document.getElementById('attentivenessText');
const progressCircle = document.getElementById('progressCircle');
const currentStatus = document.getElementById('currentStatus');
const trackingStatus = document.getElementById('trackingStatus');
const videoContainer = document.querySelector('.video-container');
const attentiveTime = document.getElementById('attentiveTime');
const distractedTime = document.getElementById('distractedTime');
const focusCycles = document.getElementById('focusCycles');
const videoStream = document.getElementById('videoStream'); // <video> element in HTML

// State variables
let isTracking = false;
let totalAttentiveTime = 0;
let totalDistractionTime = 0;
let cycleCount = 0;
let lastStatus = 'Not Tracking';
let sessionStartTime = 0;
let webcamStream = null;
let faceMesh = null;

// Mediapipe setup
faceMesh = new FaceMesh({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`;
    }
});

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
    console.log('Attention Tracker application loaded');

    // Style the existing <video>
    videoStream.autoplay = true;
    videoStream.playsInline = true;
    videoStream.style.objectFit = 'contain';
    videoStream.style.width = '100%';
    videoStream.style.height = '100%';
    videoStream.style.position = 'absolute';
    videoStream.style.top = '0';
    videoStream.style.left = '0';

    // Initialize MediaPipe FaceMesh
    faceMesh = new mpFaceMesh.FaceMesh({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`;
        }
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    faceMesh.onResults(onResults);

    startBtn.addEventListener('click', startTracking);
    stopBtn.addEventListener('click', stopTracking);

    // Initialize summary values
    attentiveTime.textContent = formatTime(0);
    distractedTime.textContent = formatTime(0);
    focusCycles.textContent = '0';

    updateButtonStates();
    addAnimations();
});

function onResults(results) {
    if (!isTracking) return;

    let status = "Not Attentive";
    let isAttentive = false;

    const getEAR = (landmarks, eyeIndices) => {
        const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
        const p1 = landmarks[eyeIndices[0]];
        const p2 = landmarks[eyeIndices[1]];
        const p3 = landmarks[eyeIndices[2]];
        const p4 = landmarks[eyeIndices[3]];
        const p5 = landmarks[eyeIndices[4]];
        const p6 = landmarks[eyeIndices[5]];
        return (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4));
    };

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const noseTip = landmarks[1];
        const isCentered = noseTip.x > 0.35 && noseTip.x < 0.65;

        const leftEyeEAR = getEAR(landmarks, [33, 159, 158, 133, 153, 144]);
        const rightEyeEAR = getEAR(landmarks, [362, 386, 385, 263, 373, 380]);
        const isEyesOpen = (leftEyeEAR + rightEyeEAR) / 2 > 0.2;

        isAttentive = isCentered && isEyesOpen;
        status = isAttentive ? "Attentive" : "Not Attentive";
    }

    currentStatus.textContent = status;
    currentStatus.className = `stat-value status-${isAttentive ? 'attentive' : 'not-attentive'}`;

    if (lastStatus !== status) {
        if (status === 'Attentive' && lastStatus === 'Not Attentive') {
            cycleCount++;
            focusCycles.textContent = cycleCount;
        }
        lastStatus = status;
    }

    const elapsedTime = Math.floor((Date.now() - sessionStartTime) / 1000);
    trackingTime.textContent = formatTime(elapsedTime);

    if (isAttentive) {
        totalAttentiveTime++;
    } else {
        totalDistractionTime++;
    }

    attentiveTime.textContent = formatTime(totalAttentiveTime);
    distractedTime.textContent = formatTime(totalDistractionTime);

    const totalTime = totalAttentiveTime + totalDistractionTime;
    const attentivenessPercentage = totalTime > 0 ? (totalAttentiveTime / totalTime) * 100 : 0;

    updateAttentivenessUI(attentivenessPercentage);

    if (elapsedTime % 5 === 0) {
        syncStatsWithBackend(elapsedTime, attentivenessPercentage, status);
    }
}

async function startTracking() {
    console.log("▶️ Start Tracking button clicked");
    if (isTracking) return;
    console.log('Starting tracking...');

    try {
        console.log("📷 Requesting webcam access…");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        webcamStream = stream;
        videoStream.srcObject = stream;

        await fetch('/start_tracking', { method: 'POST' });

        isTracking = true;
        sessionStartTime = Date.now();
        totalAttentiveTime = 0;
        totalDistractionTime = 0;
        cycleCount = 0;
        lastStatus = 'Not Tracking';

        const onFrame = async () => {
            if (!isTracking) return;
            await faceMesh.send({ image: videoStream });
            requestAnimationFrame(onFrame);
        };
        onFrame();

        videoContainer.classList.add('tracking');
        trackingStatus.innerHTML = '<span class="dot"></span> Tracking';
        updateButtonStates();

        console.log('Tracking started successfully');
    } catch (error) {
        console.error("❌ Webcam error:", error);
        console.error('Error starting tracking:', error);
        alert('Could not access the webcam. Please ensure you have a camera connected and grant permission.');
        stopTracking();
    }
}

async function stopTracking() {
    if (!isTracking) return;
    console.log('Stopping tracking...');

    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        videoStream.srcObject = null;
        webcamStream = null;
    }

    await fetch('/stop_tracking', { method: 'POST' });

    isTracking = false;
    updateButtonStates();

    videoContainer.classList.remove('tracking');
    trackingStatus.innerHTML = '<span class="dot"></span> Not Tracking';
    currentStatus.textContent = 'Not Tracking';
    currentStatus.className = 'stat-value status-not-tracking';

    console.log('Tracking stopped successfully');
}

function updateButtonStates() {
    startBtn.disabled = isTracking;
    stopBtn.disabled = !isTracking;
}

function updateAttentivenessUI(percentage) {
    const p = Math.round(percentage);
    attentivenessBar.style.width = `${p}%`;
    attentivenessBar.textContent = `${p}%`;
    progressCircle.style.setProperty('--progress', `${p}%`);
    attentivenessText.textContent = `${p}%`;

    if (p >= 70) {
        attentivenessBar.style.background = 'linear-gradient(90deg, #2ecc71, #27ae60)';
    } else if (p >= 40) {
        attentivenessBar.style.background = 'linear-gradient(90deg, #f39c12, #e67e22)';
    } else {
        attentivenessBar.style.background = 'linear-gradient(90deg, #e74c3c, #c0392b)';
    }
}

async function syncStatsWithBackend(elapsedTime, attentiveness, status) {
    const data = {
        elapsed_time: formatTime(elapsedTime),
        attentiveness: Math.round(attentiveness),
        current_status: status,
        is_tracking: isTracking,
        attentive_time: formatTime(totalAttentiveTime),
        distracted_time: formatTime(totalDistractionTime),
        focus_cycles: cycleCount
    };

    try {
        await fetch('/sync_stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (error) {
        console.error('Failed to sync stats with backend:', error);
    }
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${secs}`;
}

function addAnimations() {
    document.querySelectorAll('.stat-card').forEach((card, index) => {
        card.style.animationDelay = `${0.1 * (index + 1)}s`;
    });
}
