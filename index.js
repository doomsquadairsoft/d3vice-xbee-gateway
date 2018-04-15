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

const xbee = require('./xbee');


const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');
const io = require('socket.io-client');
const validUrl = require('valid-url');


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
            data: 'DCXGA'
        })
        .subscribe(function xbeeTXSuccess () {
            console.log("Transmission successful~");
        }, function xbeeTXFail (e) {
            console.log("Transmission failed:\n", e);
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
xbee.helloStream
    .takeUntil(xbee.ctrlCStream)
    .subscribe(function (s) {
        console.log(` helloStream: ${s}`);
        evs.create({
            type: 'join', // ex: 'buttonPress'
            origin: 'idk' // @todo get origin address64 somehow
        });
    }, xbee.errorCb, xbee.exitCb);
