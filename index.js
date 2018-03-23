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
var rx = require("rx");
var xbeeRx = require("xbee-rx");
var validUrl = require('valid-url');




const gameServerAddress = process.env.D3VICE_GAMESERVER_ADDRESS
console.log(gameServerAddress)

if (typeof gameServerAddress === 'undefined')
    throw new Error('D3VICE_GAMESERVER_ADDRESS is undefined in environment!');


if (validUrl.isUri(gameServerAddress)){
    console.log('Looks like an URI');
} else {
    throw new Error('D3D3VICE_GAMESERVER_ADDRESS is not a valid URL. '+
    'Example: http://game.doomsquadairsoft.com or http://192.168.1.112')
}


const socket = io(gameServerAddress); // @TODO dynamically set this
const app = feathers();

// Set up Socket.io client with the socket
app.configure(socketio(socket));

// Receive real-time events through Socket.io
app.service('devices')
    .on('created', device => console.log('New device created', device));

// Call the `messages` service
app.service('device').create({
    did: 'franchez-kka',
    controllingTeam: 1
});




var xbee = xbeeRx({
    serialport: "/dev/ttyUSB0",
    serialportOptions: {
        baudrate: 57600
    },
    module: "ZigBee",
    // turn on debugging to see what the library is doing
    debug: true
});

console.log("Monitoring incoming packets (press CTRL-C to stop)");

// monitor CTRL-C to close serial connection
var stdin = process.stdin;
stdin.setRawMode(true);
var ctrlCStream = rx.Observable.fromEvent(stdin, "data")
    .where(function monitorCtrlCOnData(data) {
        return data.length === 1 && data[0] === 0x03; // Ctrl+C
    })
    .take(1);

var transmissionsStream = xbee
    .monitorTransmissions()
    .pluck("data")
    .map(function (buffer) {
        var s = buffer.toString();
        return s === "\r" ? "\n" : s;
    });

transmissionsStream
    .takeUntil(ctrlCStream)
    .subscribe(function (s) {
        process.stdout.write(s);
    }, function (error) {
        console.log("Error during monitoring:\n", error);
        xbee.close();
        process.exit();
    }, function () {
        console.log("\nGot CTRL-C; exiting.");
        xbee.close();
        process.exit();
    });
