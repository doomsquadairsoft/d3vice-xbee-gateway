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

//const xbee = require('./xbee');
//const feathers = require('./feathers-client')


const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');
const io = require('socket.io-client');
const validUrl = require('valid-url');



const gameServerAddress = process.env.D3VICE_GAMESERVER_ADDRESS
console.log(gameServerAddress)

if (typeof gameServerAddress === 'undefined')
    throw new Error('D3VICE_GAMESERVER_ADDRESS is undefined in environment!');


if (validUrl.isUri(gameServerAddress)){
    console.log('Looks like a URI');
} else {
    throw new Error('D3D3VICE_GAMESERVER_ADDRESS is not a valid URL. '+
    'Example: http://game.doomsquadairsoft.com or http://192.168.1.112')
}


const socket = io(gameServerAddress); // @TODO dynamically set this
const app = feathers();

// Set up Socket.io client with the socket
app.configure(socketio(socket));

// get a handle on the event service
const evs = app.service('events');

// Receive real-time events through Socket.io
app.service('devices')
    .on('created', function (device) {
        console.log('New device created', device);
    })



// Get the list of devices that exist on the gameserver
app.service('devices')
    .find()
    .then(function(devices) {
        console.log(devices);
    });

// When an event is received from the xbee network, translate the data
// and forward to the gameserver.
// @todo (this is pseudo-code)
xbee.on('dcx') // d3vice-controlpoint-xbee
    .then(function(data) {
        evs.create({
            type: data.type // ex: 'buttonPress'
        })
    })


// when a device is added, u

//export default feathersClient


//
//
// import feathers from '@feathersjs/feathers'
// import socketio from 'feathers-socketio'
// import auth from '@feathersjs/authentication-client'
// import io from 'socket.io-client'
// import feathersVuex from 'feathers-vuex'
// import store from '../store/'
//
// const socket = io('http://localhost:3030', {transports: ['websocket']})
//
// const feathersClient = feathers()
//   .configure(socketio(socket))
//   //.configure(auth({ storage: window.localStorage }))
//   //.configure(rx({idField: '_id'}))
//   // .configure(feathersVuex(store, {
//   //   idField: '_id',
//   //   auth: {
//   //     userService: '/users'
//   //   }}))
//
//
// feathersClient.service('/users')
// feathersClient.service('/messages')
// feathersClient.service('/devices')
// // feathersClient.service('/todos').vuex({idField: '_id'})
// // feathersClient.service('/deeply/nested/names')
// // feathersClient.service('/some/explicit/namespace').vuex({name: '/explicit/namespace'})
//
// export default feathersClient
