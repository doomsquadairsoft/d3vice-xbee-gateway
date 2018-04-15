/*jslint node:true */

/*
 * examples/simple-monitor.js
 * https://github.com/101100/xbee-rx
 *
 * Simple example showing how to monitor incoming transmissions and how
 * to clean up on CTRL-C.
 *
 * Copyright (c) 2015-2016 Jason Heard
 * Licensed under the MIT license.
 */

"use strict";



const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');
const io = require('socket.io-client');
const validUrl = require('valid-url');
const rx = require("rx");
const xbeeRx = require("xbee-rx");
const R = require("ramda");
const xbee_api = require("xbee-api");


const destinationId = '0013A20040B51A26';
const data = 'TIESTO';


var xbee = xbeeRx({
    serialport: "/dev/ttyUSB4",
    serialportOptions: {
        baudrate: 57600
    },
    module: "ZigBee",
    api_mode: 2,
    debug: false
});

console.log("Monitoring incoming packets (press CTRL-C to stop)");

var stdin = process.stdin;
stdin.setRawMode(true);

/**
 * define the sequence of data that is a Ctrl+C
 * we use this later to determine when to stop listening
 * to the serial port
 */
var ctrlCStream = rx.Observable.fromEvent(stdin, "data")
    .where(function monitorCtrlCOnData(data) {
        return data.length === 1 && data[0] === 0x03; // Ctrl+C
    })
    .take(1);

/**
 * configure a stream for handling HELLOs from controlpoints
 * the HELLO packet type is within type 144 (0x90) ZIGBEE_RECEIVE_PACKET
 */
var helloStream = xbee
    .monitorTransmissions()
    .where(R.propEq("type", 144)) // ZIGBEE_RECEIVE_PACKET
    .pluck("data")
    .map(function (buffer) {
        var s = buffer.toString();
        return (s === "\r") ? "\n" : s;
    })
    .where(R.is(String))
    .where(R.equals('DCXHI'));



const errorCb = function (error) {
    console.log("Error during monitoring:\n", error);
    xbee.close();
    process.exit();
}


const exitCb = function () {
    console.log("\nGot CTRL-C; exiting.");
    xbee.close();
    process.exit();
}






const gameServerAddress = process.env.D3VICE_GAMESERVER_ADDRESS
console.log(`gameServerAddress ${gameServerAddress}`)

/**
 * Ensure game server address is defined
 */
if (typeof gameServerAddress === 'undefined')
    throw new Error('D3VICE_GAMESERVER_ADDRESS is undefined in environment!');


/**
 * Ensure game server address is a valid URI
 */
if (validUrl.isUri(gameServerAddress)){
    console.log('Looks like a URI');
} else {
    throw new Error('D3D3VICE_GAMESERVER_ADDRESS is not a valid URL. '+
    'Example: http://game.doomsquadairsoft.com or http://192.168.1.112')
}



const socket = io(gameServerAddress); // @TODO dynamically set this using Bonjour or something
const app = feathers();

/**
 * Set up Socket.io client with the socket to gameServerAddress
 */
app.configure(socketio(socket));

// get a handle on the event service
const evs = app.service('events');

evs.on('created', function (device) {
    // idk
});

// Receive real-time events through Socket.io
app.service('devices')
    .on('created', function (device) {
        console.log('New device created', device);
        xbee.remoteTransmit({
            destinationId: device.did,
            broadcast: false,
            data: 'DCXGA0' // Tell DCX to act GAME 0
        })
        .subscribe(function xbeeTXSuccess () {
            console.log("Device creation transmission successful~");
        }, function xbeeTXFail (e) {
            console.log("Device creation transmission failed:\n", e);
        });
    })
    .on('updated', function (device) {
	console.log(`device ${device.did} has changed`)
        console.log(`device: ${device}`)
    })
    .on('patched', function(device) {
        console.log(`device ${device.did} has patched`)
        console.log(`device: ${device}`)
    });



// Get the list of devices that exist on the gameserver
app.service('devices')
    .find()
    .then(function(devices) {
        console.log(`devices: ${devices}`);
    });

// When an event is received from the xbee network, translate the data
// and forward to the gameserver.
helloStream
    .takeUntil(ctrlCStream)
    .subscribe(function (s) {
        console.log(` helloStream: ${s}`);
        evs.create({
            type: 'join', // ex: 'buttonPress'
            origin: 'idk' // @todo get origin address64 somehow
        });
    }, errorCb, exitCb);
