import UIkit from 'uikit';
import Icons from 'uikit/dist/js/uikit-icons';
import { split, padStart, defaults, filter, array } from 'lodash';
import Timecode from 'timecode-boss';
import Heartbeats from 'heartbeats';
import MSToTimecode from 'ms-to-timecode';

UIkit.use(Icons);
/**
 * @type {WebSocket}
 */
let sock;
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
 * @type {string}
 */
const TIMELORD_IP_KEY = "TIMELORD_IP";
/**
 * @type {string}
 */
const TIMELORD_PORT_KEY = "TIMELORD_PORT";
/**
 * @type {string}
 */
const REFRESH_KEY = "REFRESH";
/**
 * @type {string}
 */
const SETTINGS_KEY = "SETTINGS";
/**
 * @type {string}
 */
const DEBUG_KEY = "DEBUG";
/**
 *
 * @type {{REFRESH: boolean, TIMELORD_PORT: number}}
 */
const DEFAULTS = {
    "TIMELORD_PORT": 800,
    "REFRESH"      : false,
    "TIMELORD_IP"  : "127.0.0.1",
    "DEBUG"        : false,
};
init();
window.sock = sock = new WebSocket('ws://' + localStorage.getItem(TIMELORD_IP_KEY) + ':' + localStorage.getItem(TIMELORD_PORT_KEY));
window.sock.onmessage = handleMessage;
window.sock.onerror = reload;

/**
 * Creates the heart.
 * Checks websocket is still open every OPEN_WEBSOCKET_CHECK, HEARTRATE.
 */
function init() {
    heart = Heartbeats.createHeart(CLOCK_HEARTRATE);
    setDefaults();
}

/**
 * Handles the message from the websocket.
 *
 * @param messageEvent {MessageEvent}
 */
function handleMessage( messageEvent ) {
    let messageObject = parseMessage(messageEvent.data);
    setData(messageObject);
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
    const messageObject = {
        state          : parseInt(messageArray[0]),
        cueNumber      : parseInt(messageArray[1]),
        currentMS      : parseInt(messageArray[2]),
        currentDuration: parseInt(messageArray[3]),
        currentOffset  : parseInt(messageArray[4]),
        currentFPS     : parseFloat(messageArray[5]),
        currentVolume  : parseInt(messageArray[6]),
        currentFade    : parseInt(messageArray[7]),
    };
    currentOffset = messageObject.currentOffset || 0;
    currentDuration = messageObject.currentDuration;
    currentMS = messageObject.currentMS;
    currentFPS = messageObject.currentFPS;
    if(localStorage.getItem(DEBUG_KEY)){
        debugMessage(messageObject);
    }
    return messageObject;

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

/**
 * Hooks Heart to do functions on specific intervals of the heartbeat.
 */
function startTimer() {
    heart.createEvent(1, {name: EVENT_NAME}, interval);
    heart.createEvent(10, {name: PROGRESS_EVENT_NAME}, progressInterval);
}

/**
 * Standard timer interval.
 */
function interval() {
    currentMS = currentMS + CLOCK_HEARTRATE;
    current.set(MSToTimecode(currentMS + currentOffset, currentFPS));
    setClock(current);
}

/**
 * Progress bar interval.
 */
function progressInterval() {
    setProgress(currentMS, currentDuration);
}

/**
 * Page reload
 */
function reload() {
    const REFRESH = localStorage.getItem(REFRESH_KEY);
    if ( REFRESH !== null && REFRESH === true ) {
        location.reload();
    }
}

/**
 * Sets the clock onto the HTML
 * @param timecode {Timecode}
 */
function setClock( timecode ) {
    document.getElementById('timer-hour').innerText = padStart(timecode.hours, 2, '0');
    document.getElementById('timer-minute').innerText = padStart(timecode.minutes, 2, '0');
    document.getElementById('timer-second').innerText = padStart(timecode.seconds, 2, '0');
    document.getElementById('timer-frame').innerText = padStart(timecode.frames, 2, '0');
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
}

/**
 * @param currentTimer {number}
 * @param trackDuration {number}
 */
function setProgress( currentTimer, trackDuration ) {
    let progressBar = document.getElementById('data-progress');
    progressBar.value = currentTimer;
    progressBar.max = trackDuration;
}

/**
 * Sets default values.
 */
function setDefaults() {
    let localSettings = defaults(filter({
        "TIMELORD_IP": window.location.hostname
    }), DEFAULTS);
    for ( const key in localSettings ) {
        if ( !hasSetting(key) ) {
            saveSetting(key, localSettings[key]);
        }
    }
    refreshSettingDisplay();
}

/**
 * Save setting into localStorage, update where user sees current setting.
 * @param key {string}
 * @param value {string|number|boolean}
 */
function saveSetting( key, value ) {
    // Local storage thing.
    localStorage.setItem(key, value);
    // HTML thing.
    let element = document.getElementById(key);
    if ( element ) {
        if ( typeof value === 'boolean' ) {
            value = value.toString();
        }
        element.innerText = value;
    }
}

/**
 * Check setting exists within localStorage.
 *
 * @param key {string}
 * @returns {boolean}
 */
function hasSetting( key ) {
    return localStorage.getItem(key) !== null;
}

/**
 * Refreshes each of the user-facing settings.
 */
function refreshSettingDisplay() {
    for ( let key in DEFAULTS ) {
        let value = localStorage.getItem(key);
        let element = document.getElementById(key);
        if ( element ) {
            if ( typeof value === 'boolean' ) {
                value = value.toString();
            }
            element.innerText = value;
        }
    }
}

/**
 * Shows the debugMessage.
 *
 * @param message {{currentOffset: number, currentFPS: number, currentDuration: number, currentVolume: number, currentFade: number, state: number, currentMS: number, cueNumber: number}}
 */
function debugMessage(message){
    let debugElement = document.getElementById('debug-content');
    debugElement.style.display = "block";
    debugElement.innerText = JSON.stringify(message);
}