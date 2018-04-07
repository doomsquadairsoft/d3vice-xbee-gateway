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
console.log(gameServerAddress)

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


/**
 * Receive real-time events through Socket.io.
 *
 * When a D3VICE state changes, broadcast to the XBee network
 */
app.service('devices')
    .on('created', function (device) {
        console.log('New device created', device);
    })
    .on('updated', function (device) {
	console.log(`device ${device.did} has changed`)
        console.log(device)
    })
    .on('patched', function(device) {
        console.log(`device ${device.did} has patched`)
        console.log(device)
    })


/**
 * Get the list of devices that exist on the gameserver
 */
app.service('devices').find().then(function(devices) {
    console.log(devices);
});
