'use strict';

console.log('adapter.browserDetails.browser', adapter.browserDetails.browser);
const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
callButton.disabled = true;
hangupButton.disabled = true;
startButton.addEventListener('click', start);
callButton.addEventListener('click', call);
hangupButton.addEventListener('click', hangup);

let startTime;
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

localVideo.addEventListener('loadedmetadata', function() {
	console.log(`Local video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('loadedmetadata', function() {
	console.log(`Remote video videoWidth: ${this.videoWidth}px,  videoHeight: ${this.videoHeight}px`);
});

remoteVideo.addEventListener('resize', () => {
	console.log(`Remote video size changed to ${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`);
	// We'll use the first onsize callback as an indication that video has started
	// playing out.
	if (startTime) {
		const elapsedTime = window.performance.now() - startTime;
		console.log('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
		startTime = null;
	}
});

let localStream;
let pc1;
let pc2;
const offerOptions = {
	offerToReceiveAudio: 1,
	offerToReceiveVideo: 1
};

// const signaling = new SignalingChannel();
// var socket = new WebSocket('ws://localhost:8080/socket');
// socket.onopen = function() {
// 	console.log('Connected to the signaling server');
// };

function getName(pc) {
	return pc === pc1 ? 'pc1' : 'pc2';
}

function getOtherPc(pc) {
	return pc === pc1 ? pc2 : pc1;
}

async function start() {
	console.log('Requesting local stream');
	startButton.disabled = true;
	try {
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
		console.log('Received local stream');
		localVideo.srcObject = stream;
		localStream = stream;
		callButton.disabled = false;
	} catch (e) {
		alert(`getUserMedia() error: ${e.name}`);
	}
}

function getSelectedSdpSemantics() {
	// const sdpSemanticsSelect = document.querySelector('#sdpSemantics');
	// const option = sdpSemanticsSelect.options[sdpSemanticsSelect.selectedIndex];
	// return option.value === '' ? {} : { sdpSemantics: option.value };
	return {
		iceServers: [
			{
				urls: [ 'turn:13.59.119.67:3478?transport=udp', 'turn:13.59.119.67:3478?transport=tcp' ],
				username: 'akashuser',
				credential: 'root'
			}
		]
	};
}

async function call() {
	callButton.disabled = true;
	hangupButton.disabled = false;
	console.log('Starting call');
	startTime = window.performance.now();
	const videoTracks = localStream.getVideoTracks();
	const audioTracks = localStream.getAudioTracks();
	if (videoTracks.length > 0) {
		console.log(`Using video device: ${videoTracks[0].label}`);
	}
	if (audioTracks.length > 0) {
		console.log(`Using audio device: ${audioTracks[0].label}`);
	}
	const configuration = getSelectedSdpSemantics();
	console.log('RTCPeerConnection configuration:', configuration);

	pc1 = new RTCPeerConnection(configuration);
	console.log('Created local peer connection object pc1');

	pc1.addEventListener('icecandidate', (e) => onIceCandidate(pc1, e));

	pc2 = new RTCPeerConnection(configuration);
	console.log('Created remote peer connection object pc2');
	pc2.addEventListener('icecandidate', (e) => onIceCandidate(pc2, e));

	pc1.addEventListener('iceconnectionstatechange', (e) => onIceStateChange(pc1, e));
	pc2.addEventListener('iceconnectionstatechange', (e) => onIceStateChange(pc2, e));
	pc2.addEventListener('track', gotRemoteStream);

	localStream.getTracks().forEach((track) => pc1.addTrack(track, localStream));
	console.log('Added local stream to pc1');

	try {
		console.log('pc1 createOffer start');
		const offer = await pc1.createOffer(offerOptions);
		await onCreateOfferSuccess(offer);
	} catch (e) {
		onCreateSessionDescriptionError(e);
	}
}

function onCreateSessionDescriptionError(error) {
	console.log(`Failed to create session description: ${error.toString()}`);
}

async function onCreateOfferSuccess(desc) {
	console.log(`Offer from pc1\n${desc.sdp}`);
	console.log('pc1 setLocalDescription start');
	try {
		await pc1.setLocalDescription(desc);
		onSetLocalSuccess(pc1);
	} catch (e) {
		onSetSessionDescriptionError();
	}

	console.log('pc2 setRemoteDescription start');
	try {
		await pc2.setRemoteDescription(desc);
		onSetRemoteSuccess(pc2);
	} catch (e) {
		onSetSessionDescriptionError();
	}

	console.log('pc2 createAnswer start');
	// Since the 'remote' side has no media stream we need
	// to pass in the right constraints in order for it to
	// accept the incoming offer of audio and video.
	try {
		const answer = await pc2.createAnswer();
		await onCreateAnswerSuccess(answer);
	} catch (e) {
		onCreateSessionDescriptionError(e);
	}
}

function onSetLocalSuccess(pc) {
	console.log(`${getName(pc)} setLocalDescription complete`);
}

function onSetRemoteSuccess(pc) {
	console.log(`${getName(pc)} setRemoteDescription complete`);
}

function onSetSessionDescriptionError(error) {
	console.log(`Failed to set session description: ${error.toString()}`);
}

function gotRemoteStream(e) {
	if (remoteVideo.srcObject !== e.streams[0]) {
		remoteVideo.srcObject = e.streams[0];
		console.log('pc2 received remote stream');
	}
}

async function onCreateAnswerSuccess(desc) {
	console.log(`Answer from pc2:\n${desc.sdp}`);
	console.log('pc2 setLocalDescription start');
	try {
		await pc2.setLocalDescription(desc);
		onSetLocalSuccess(pc2);
	} catch (e) {
		onSetSessionDescriptionError(e);
	}
	console.log('pc1 setRemoteDescription start');
	try {
		await pc1.setRemoteDescription(desc);
		onSetRemoteSuccess(pc1);
	} catch (e) {
		onSetSessionDescriptionError(e);
	}
}

async function onIceCandidate(pc, event) {
	try {
		await getOtherPc(pc).addIceCandidate(event.candidate);
		onAddIceCandidateSuccess(pc);
	} catch (e) {
		onAddIceCandidateError(pc, e);
	}
	console.log(`${getName(pc)} ICE candidate:\n${event.candidate ? event.candidate.candidate : '(null)'}`);
}

function onAddIceCandidateSuccess(pc) {
	console.log(`${getName(pc)} addIceCandidate success`);
}

function onAddIceCandidateError(pc, error) {
	console.log(`${getName(pc)} failed to add ICE Candidate: ${error.toString()}`);
}

function onIceStateChange(pc, event) {
	if (pc) {
		console.log(`${getName(pc)} ICE state: ${pc.iceConnectionState}`);
		console.log('ICE state change event: ', event);
	}
}

function hangup() {
	console.log('Ending call');
	pc1.close();
	pc2.close();
	pc1 = null;
	pc2 = null;
	hangupButton.disabled = true;
	callButton.disabled = false;
}

function openSignalingChannel() {
	socket.onopen = function() {};
	socket.onmessage = function() {};
}

// cookbook

// detecting webrtc fucntion supported by browser

var webrtcDetectedVersion = null;
var webrtcDetectedBrowser = null;
window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;

function initWebRTCAdapter() {
	if (navigator.mozGetUserMedia) {
		webrtcDetectedBrowser = 'firefox';
		webrtcDetectedVersion = parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);

		RTCPeerConnection = mozRTCPeerConnection;
		RTCSessionDescription = mozRTCSessionDescription;
		RTCIceCandidate = mozRTCIceCandidate;
		getUserMedia = navigator.mozGetUserMedia.bind(navigator);
		attachMediaStream = function(element, stream) {
			element.mozSrcObject = stream;
			element.play();
		};

		reattachMediaStream = function(to, from) {
			to.mozSrcObject = from.mozSrcObject;
			to.play();
		};

		MediaStream.prototype.getVideoTracks = function() {
			return [];
		};

		MediaStream.prototype.getAudioTracks = function() {
			return [];
		};
		return true;
	} else if (navigator.webkitGetUserMedia) {
		webrtcDetectedBrowser = 'chrome';
		webrtcDetectedVersion = parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);

		RTCPeerConnection = webkitRTCPeerConnection;
		getUserMedia = navigator.webkitGetUserMedia.bind(navigator);
		attachMediaStream = function(element, stream) {
			element.src = webkitURL.createObjectURL(stream);
		};

		reattachMediaStream = function(to, from) {
			to.src = from.src;
		};

		if (!webkitMediaStream.prototype.getVideoTracks) {
			webkitMediaStream.prototype.getVideoTracks = function() {
				return this.videoTracks;
			};
			webkitMediaStream.prototype.getAudioTracks = function() {
				return this.audioTracks;
			};
		}

		if (!webkitRTCPeerConnection.prototype.getLocalStreams) {
			webkitRTCPeerConnection.prototype.getLocalStreams = function() {
				return this.localStreams;
			};
			webkitRTCPeerConnection.prototype.getRemoteStreams = function() {
				return this.remoteStreams;
			};
		}
		return true;
	} else return false;
}

function doGetUserMedia() {
	var constraints = { audio: true, video: { mandatory: {}, optional: [] } };
	try {
		getUserMedia(constraints, onUserMediaSuccess, function(e) {
			console.log('getUserMedia error ' + e.toString());
		});
	} catch (e) {
		console.log(e.toString());
	}
}

function onUserMediaSuccess(stream) {
	attachMediaStream(localVideo, stream);
	localStream = stream;
	createPeerConnection();
	pc.addStream(localStream);
	if (initiator) doCall();
}

// making a call

function createPeerConnection() {
	var pc_constraints = { optional: [ { DtlsSrtpKeyAgreement: true } ] };
	try {
		pc = new RTCPeerConnection(pc_config, pc_constraints);
		pc.onicecandidate = onIceCandidate;
	} catch (e) {
		console.log(e.toString());
		pc = null;
		return;
	}
	pc.onaddstream = onRemoteStreamAdded;
}

function onIceCandidate(event) {
	if (event.candidate)
		sendMessage({
			type: 'candidate',
			label: event.candidate.sdpMLineIndex,
			id: event.candidate.sdpMid,
			candidate: event.candidate.candidate
		});
}

function onRemoteStreamAdded(event) {
	attachMediaStream(remoteVideo, event.stream);
	remoteStream = event.stream;
}

function doCall() {
	var constraints = { optional: [], mandatory: { MozDontOfferDataChannel: true } };
	if (webrtcDetectedBrowser === 'chrome')
		for (var prop in constraints.mandatory) if (prop.indexOf('Moz') != -1) delete constraints.mandatory[prop];

	constraints = mergeConstraints(constraints, sdpConstraints);
	pc.createOffer(setLocalAndSendMessage, errorCallBack, constraints);
}

// answering a call

function processSignalingMessage(message) {
	var msg = JSON.parse(message);
	if (msg.type === 'CHATMSG') {
		onChatMsgReceived(msg.value);
	} else if (msg.type === 'offer') {
		pc.setRemoteDescription(new RTCSessionDescription(msg));
		doAnswer();
	} else if (msg.type === 'answer') {
		pc.setRemoteDescription(new RTCSessionDescription(msg));
	} else if (msg.type === 'candidate') {
		var candidate = new RTCIceCandidate({ sdpMLineIndex: msg.label, candidate: msg.candidate });
		pc.addIceCandidate(candidate);
	} else if (msg.type === 'GETROOM') {
		room = msg.value;
		onRoomReceived(room);
	} else if (msg.type === 'WRONGROOM') {
		window.location.href = '/';
	}
}

function doAnswer() {
	pc.createAnswer(setLocalAndSendMessage, errorCallBack, sdpConstraints);
}

var sdpConstraints = { mandatory: { OfferToReceiveAudio: true, OfferToReceiveVideo: true } };

function setLocalAndSendMessage(sessionDescription) {
	pc.setLocalDescription(sessionDescription);
	sendMessage(sessionDescription);
}

function onChatMsgReceived(txt) {
	var chatArea = document.getElementById('chat_div');
	chatArea.innerHTML = chatArea.innerHTML + txt;
	chatArea.scrollTop = chatArea.scrollHeight;
}

function chatSendMessage(msg) {
	if (!channelReady) return;
	sendMessage({ type: 'CHATMSG', value: msg });
}
