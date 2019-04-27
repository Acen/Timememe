import UIkit from 'uikit';
import Icons from 'uikit/dist/js/uikit-icons';
import { split, padStart } from 'lodash';
import Timecode from 'timecode-boss';
import Heartbeats from 'heartbeats';
import MSToTimecode from 'ms-to-timecode';

UIkit.use(Icons);
/**
 * @type {WebSocket}
 */
window.sock = new WebSocket('ws://' + window.location.hostname +':800');
init();
window.sock.onmessage = handleMessage;
window.sock.onerror = reload;

/**
 * @type {boolean}
 */
let initialized = false;
/**
 * @type {Timecode}
 */
let current;
/**
 * @type {number}
 */
let currentMS;
/**
 * @type {number}
 */
let currentFPS;
/**
 * @type {number}
 */
let currentOffset;
/**
 * @type {number}
 */
let currentDuration;
/**
 * @type {Heart}
 */
let heart;
/**
 * @type {string}
 */
const EVENT_NAME = 'timer';
/**
 * @type {string}
 */
const PROGRESS_EVENT_NAME = 'progress_timer';
/**
 * @type {number}
 */
const CLOCK_HEARTRATE = 10;

/**
 * Creates the heart.
 * Checks websocket is still open every OPEN_WEBSOCKET_CHECK, HEARTRATE.
 */
function init(){
    heart = Heartbeats.createHeart(CLOCK_HEARTRATE);
}


/**
 * Handles the message from the websocket.
 *
 * @param messageEvent {MessageEvent}
 */
function handleMessage( messageEvent ) {
    let messageObject = parseMessage(messageEvent.data);
    setData(messageObject);
    currentOffset = messageObject.currentOffset || 0;
    currentDuration = messageObject.currentDuration;
    currentMS = messageObject.currentMS;
    currentFPS = messageObject.currentFPS;
    if ( !initialized ) {
        current = new Timecode(MSToTimecode(currentMS + currentOffset, currentFPS), currentFPS);
        initialized = true;
    } else {
        current = current.set(MSToTimecode(currentMS + currentOffset, currentFPS));
    }
    setClock(current);
    try {
        handleState(messageObject.state);
    } catch ( error ) {
        reload();
    }
}

/**
 * Parse the messageEvent's data into an object.
 *
 * @param messageData {string}
 * @returns {{currentOffset: number, currentFPS: number, currentDuration: number, currentVolume: number, currentFade: number, state: number, currentMS: number, cueNumber: number}}
 */
function parseMessage( messageData ) {
    const messageArray = split(messageData, ',');
    return {
        state          : parseInt(messageArray[0]),
        cueNumber      : parseInt(messageArray[1]),
        currentMS      : parseInt(messageArray[2]),
        currentDuration: parseInt(messageArray[3]),
        currentOffset  : parseInt(messageArray[4]),
        currentFPS     : parseFloat(messageArray[5]),
        currentVolume  : parseInt(messageArray[6]),
        currentFade    : parseInt(messageArray[7]),
    };
}

/**
 * Executes the required task depending on the state.
 *
 * @param state {number}
 */
function handleState( state ) {
    switch ( state ) {
        case 0:
            // Error.
            throw new Error('Invalid state returned from websocket.');
        case 1:
        case 3:
        case 4:
            // Stopped.
            // Paused.
            // Queued.
            heart.destroy();
            init();
            break;
        case 2:
            // Playing.
            syncClock();
            break;
        case 255:
        default:
            // Page Reload Necessary.
            reload();
            break;
    }
}

function syncClock() {
    // Set Clock
    startTimer();
    setClock(current);
}

function startTimer() {
    heart.createEvent(1, {name: EVENT_NAME}, interval);
    heart.createEvent(10, {name: PROGRESS_EVENT_NAME}, progressInterval);
}

function interval(){
    currentMS = currentMS + CLOCK_HEARTRATE;
    current.set(MSToTimecode(currentMS + currentOffset, currentFPS));
    setClock(current);
}
function progressInterval(){
    setProgress(currentMS, currentDuration);

}

function reload(){
    location.reload();
}


/**
 * Sets the clock onto the HTML
 * @param timecode {Timecode}
 */
function setClock( timecode ) {
    document.getElementById('timer-hour').innerText = padStart(timecode.hours, 2,'0');
    document.getElementById('timer-minute').innerText = padStart(timecode.minutes, 2,'0');
    document.getElementById('timer-second').innerText = padStart(timecode.seconds, 2,'0');
    document.getElementById('timer-frame').innerText = padStart(timecode.frames, 2,'0');
    if ( timecode.isDropFrame() ) {
        document.getElementById('timer-dropframe').innerText = ';';
    } else {
        document.getElementById('timer-dropframe').innerText = ':';
    }
}

/**
 *
 * @param data {object}
 */
function setData( data ) {
    document.getElementById('data-fps').innerText = data.currentFPS;
    document.getElementById('data-offset').innerText = MSToTimecode(data.currentOffset, data.currentFPS);
    document.getElementById('data-duration').innerText = MSToTimecode(data.currentDuration, data.currentFPS);
    document.getElementById('data-progress')
}

function setProgress(currentTimer, trackDuration){
    let progressBar = document.getElementById('data-progress');
    progressBar.value = currentTimer;
    progressBar.max = trackDuration;
}
