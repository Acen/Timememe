import UIkit from 'uikit';
import Icons from 'uikit/dist/js/uikit-icons';
import {split} from 'lodash';
import Timecode from 'timecode-boss';
import Heartbeats from 'heartbeats';
UIkit.use(Icons);

try {
    let sock = new WebSocket('ws://192.168.1.21:800');
    sock.onmessage = handleMessage;
}catch (error){
    location.reload();
}

/**
 * @type {boolean}
 */
let initialized = false;
/**
 * @type {Timecode}
 */
let current;

/**
 * @type {Heart}
 */
let heart = Heartbeats.createHeart('5');
/**
 * Handles the message from the websocket.
 *
 * @param messageEvent {MessageEvent}
 */
function handleMessage(messageEvent){
    const messageObject = parseMessage(messageEvent.data);
    if(!initialized){
        current = new Timecode(messageObject.currentMS, messageObject.currentFPS);
    }
    current = Timecode(messageObject.currentMS, messageObject.currentFPS);
    try {
        handleState(messageObject.state)
    } catch(error){
        console.error(error);
        haltClock();
    }
}

/**
 * Parse the messageEvent's data into an object.
 *
 * @param messageData {string}
 * @returns {{currentOffset: number, currentFPS: number, currentDuration: number, currentVolume: number, currentFade: number, state: number, currentMS: number, cueNumber: number}}
 */
function parseMessage(messageData){
    const messageArray = split(messageData, ',');
    return {
        state: parseInt(messageArray[0]),
        cueNumber: parseInt(messageArray[1]),
        currentMS: parseInt(messageArray[2]),
        currentDuration: parseInt(messageArray[3]),
        currentOffset: parseInt(messageArray[4]),
        currentFPS: parseFloat(messageArray[5]),
        currentVolume: parseInt(messageArray[6]),
        currentFade: parseInt(messageArray[7]),
    };
}

/**
 * Executes the required task depending on the state.
 *
 * @param state {number}
 */
function handleState(state){
    switch(state){
        case 0:
            // Error.
            throw new Error('Invalid state returned from websocket.');
        case 1:
        case 4:
            // Stopped.
            // Queued.
            haltClock();
            break;
        case 2:
            // Playing.
            syncClock();
            break;
        case 3:
            // Paused.
            pauseClock();
            break;
        case 255:
            // Page Reload Necessary.
            location.reload();
            break;
        default:
            // Apparently shouldn't be hit.
            haltClock();
            break;
    }
}

function haltClock(){
    // Kill Clock.
    setClock(current);

}

function syncClock(){
    // Set Clock
    startTimer();
    setClock(current)
}

function pauseClock(){

}

function startTimer(){
heart.ev

}

/**
 * Sets the clock onto the HTML
 * @param timecode {Timecode}
 */
function setClock(timecode){
    document.getElementById('timer-hour').innerText = timecode.hours;
    document.getElementById('timer-minute').innerText = timecode.minutes;
    document.getElementById('timer-second').innerText = timecode.seconds;
    document.getElementById('timer-frame').innerText = timecode.frames;
    if(timecode.isDropFrame()){
        document.getElementById('timer-dropframe').innerText = ';';
    }else{
        document.getElementById('timer-dropframe').innerText = ':';
    }
}
