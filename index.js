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


require('dotenv').config();
const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');
const io = require('socket.io-client');
const validUrl = require('valid-url');
const rx = require("rx");
const xbeeRx = require("xbee-rx");
const R = require("ramda");
const xbee_api = require("xbee-api");
const chalk = require('chalk');
var Datastore = require('nedb')
var db = new Datastore({ filename: './data/devices.nedb', autoload: true });



const destinationId = '0013A20040B51A26';
const data = 'TIESTO';
const xbeeUsbDevice = process.env.XBEE_USB_DEVICE;


var xbee = xbeeRx({
    serialport: xbeeUsbDevice,
    serialportOptions: {
        baudrate: 57600
    },
    module: "ZigBee",
    api_mode: 2,
    debug: true
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
    .where(R.prop("data"))
    .where(function(frame) {
        return R.test(/DCXHI/, frame.data.toString());
    })
    .map(frame => [
        frame.remote64,
        frame.data.toString(),
    ])
    //.where(R.test(/DCXHI/))
    //.where(R.is(String), [0])

    // .pluck("data")
    // .map(function (buffer) {
    //     var s = buffer.toString();
    //     return (s === "\r") ? "\n" : s;
    // })
    // .where(R.is(String))
    // .where(R.test(/DCXHI/));




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
    console.log('  ✔️ The game server address looks valid.');
} else {
    throw new Error('  ❌ D3D3VICE_GAMESERVER_ADDRESS is not a valid URL. '+
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

app.on('error', function (err) {
  console.error('an error occured.');
  console.error(err);
})

evs.on('created', function (event) {
  //console.log(event); 0013a20040b51a26
  var type = event.type || '';
  var device = event.device || '';
  var order = event.order || '';

  console.log(`  >> event seen.\n     type=${type} device=${device} order=${order}`);
  //device = Buffer.from(device, 'hex');


  if (type === 'order') {
    xbee.remoteTransmit({
        destination64: device,
        broadcast: false,
        data: order
    })
    .subscribe(function xbeeTXSuccess () {
        console.log("Device order transmission successful~");
    }, function xbeeTXFail (e) {
        console.log("Device order transmission failed:\n", e);
    });
  }

});

// Receive real-time events through Socket.io
app.service('devices')
    .on('created', function (device) {
        console.log('New device created', device);
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
        console.log(chalk.bold.blue('D3VICES:'));
        console.log(devices);
    })
    .catch((e) => {
      console.error(chalk.red("WARNING: Gateway had a problem connecting to the game server!"));
      console.error(chalk.red(e));
    })

function forwardEventToGameserver(streamData) {
  var did = streamData[0];
  var msg = streamData[1];
  var type = (msg.substring(0, 5) === 'DCXHI') ? 'join' : 'idk';
  evs.create({
    type: type, // ex: 'buttonPress'
    device: did // @todo get origin address64 somehow
  })
}


// When an event is received from the xbee network, translate the data
// and forward to the gameserver.
helloStream
    .takeUntil(ctrlCStream)
    .subscribe(function (s) {
        console.log(` helloStream: ${s}`);
        forwardEventToGameserver(s);
    }, errorCb, exitCb);

//Rx.Observable.combineLatest(Promise.resolve())
