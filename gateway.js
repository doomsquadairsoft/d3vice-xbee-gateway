"use strict";


require('dotenv').config();
const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');
const io = require('socket.io-client');
const validUrl = require('valid-url');
const buffer = require('buffer');
const {
  rxjs,
  of,
  interval,
  Observable,
  concat
} = require("rxjs");
const {
  observeOn,
  repeatWhen,
  repeat,
  delay,
  catchError,
  tap,
  pluck,
  map,
  take,
  takeWhile
} = require('rxjs/operators');
const moment = require('moment');
const xbeeRx = require("xbee-rx");
const R = require("ramda");
const xbee_api = require("xbee-api");
const chalk = require('chalk');
const fs = require('fs');
const Promise = require('bluebird');
const Datastore = require('nedb')
const db = new Datastore({
  filename: './data/devices.nedb',
  autoload: true
});
const version = require('./package.json').version;
//const xbeeDeviceRegex = /^8-/;
//const xbeeDeviceFilter = R.propSatisfies(R.test(xbeeDeviceRegex), 'did');
//const isXBeeDevice = R.compose(R.test(xbeeDeviceRegex), R.prop('did'));
const isXBeeDevice = R.compose(R.not(), R.isNil(), R.prop('address64'))

const destinationId = '0013A20040B51A26';
const data = 'TIESTO';
// const xbeeUsbDevice = process.env.XBEE_USB_DEVICE;



const computeVoltage = (number) => {
  const r1 = 100000;
  const r2 = 10000;
  const timePeriod = 1024.0;
  const baseVoltage = 3.3;
  const vOut = ((number * baseVoltage) / timePeriod);
  const vIn = (vOut / (r2/(r1+r2)));
  return Number(vIn).toFixed(2);
}

/**
 * getUsbDevice
 *
 * Finds the USB device on the filesystem that is an XBee radio. Example: /dev/ttyUSB0.
 * If there are more than one XBee, the first one is chosen.
 */
const getUsbDevice = function() {
  return new Promise(function(resolve, reject) {
    const devDir = '/dev/';
    const ttyUsbRegex = /^ttyUSB\d+$/;
    fs.readdir(devDir, (err, files) => {
      if (err) reject(err);
      const matchingFilenames = files
        .filter(filename => ttyUsbRegex.test(filename))
        .map(filename => devDir + filename);
      if (matchingFilenames.length === 0) throw new Error('There are no ttyUSB devices listed on the filesystem in /dev. Exiting.');
      return Promise.filter(matchingFilenames, isUsbDeviceAnXbee)
        .then((filenames) => {
          const chosenUsbFilename = filenames[0];
          if (filenames.length > 1)
            console.log(`There were multiple connected XBee radios. Defaulting to the first found XBee radio ${chosenUsbFilename}. If you want to override this behavior, use the environment variable XBEE_USB_DEVICE.`);
          resolve(chosenUsbFilename);
        });
    });
  });
}

const isUsbDeviceAnXbee = (filename) => {
  return new Promise(function(resolve, reject) {
    const maybeAnXbee = xbeeRx({
      serialport: filename,
      serialportOptions: {
        baudRate: 57600
      },
      module: "ZigBee",
      api_mode: 2,
      debug: false
    });

    maybeAnXbee.localCommand({
      command: "MY",
      defaultTimeout: 500
    }).subscribe((res) => {
      console.log(`  👀 Detected XBee at ${filename}`);
      maybeAnXbee.close();
      resolve(true);
    }, (e) => {
      console.log(`  😕 Detected ${filename} but it doesn't look like an XBee.`);
      //console.error(e);
      maybeAnXbee.close();
      resolve(false);
    })
  });
}

const forwardEventToGameserver = (streamData) => {
  const did = streamData[0];
  const msg = streamData[1];
  const type = (msg.substring(0, 5) === 'DCXHI') ? 'join' : 'idk';
  evs.create({
    type: type, // ex: 'buttonPress'
    device: did // @todo get origin address64 somehow
  });
}

const sendDataToDevice = (device) => {
  const did = device.did;

  // @TODO send the data over the radio
}



const doShowIntro = () => {
  console.log(`  ${chalk.red.bold('DooM D3VICES')} ${chalk.white.bold('XBee to Wi-Fi Gateway')} version ${version}`);
}

// find the /dev/ttyUSBn device that is an XBee.
doShowIntro();

getUsbDevice().then((filename) => {
  if (typeof filename === 'undefined') throw new Error('No valid USB XBee radios found.')
  console.log(`  🎯 ${chalk.bold.green(filename)} is our XBee.`);
  doRunGateway(filename);
}).catch(function(e) {
  console.log(e);
});

const timeoutBetweenRssi = moment.duration(30, 'seconds').valueOf();

const reportRssiToGameserver = (results) => {
  // {"type":151,"id":3,"remote64":"0013a20040ba4058","remote16":"6771","command":"DB","commandStatus":0,"commandData":{"type":"Buffer","data":[36]}}
  if (!results) return;
  const rssi = `-${parseInt(results.commandData.toString('hex'), 16)}`
  const remote64 = results.remote64;

  console.log(`reporting rssi:${rssi}dB, remote64:${remote64}`);

  // lookup the device ID given the address64
  devices.find({
    query: {
      address64: remote64
    },
  }).then((d) => {
    console.log(`found ${JSON.stringify(d)}`);
    if (R.isEmpty(d)) {
      console.log(chalk.red(`  👻 ERROR: There is no D3VICE in DooM HQ with address64 ${remote64}!!`));
    } else {
      devices.patch(d[0]._id, {
        rssi: parseInt(rssi),
        xbeeUpdatedAt: moment().valueOf()
      });
    }
  });
}

const reportBattToGameserver = (results) => {
  if (!results) return;
  const batt = results.batt;
  const remote64 = results.remote64;

  console.log(`reporting batt:${batt}, remote64:${remote64}`);

  // lookup the device ID given the address64
  devices.find({
    query: {
      address64: remote64
    },
  }).then((d) => {
    console.log(`  🔍 found ${JSON.stringify(d)}`);
    if (R.isEmpty(d)) {
      console.log(chalk.red(`  😨 UH-OH: There is no D3VICE in DooM HQ with address64 ${remote64}!!`));
    } else {
      devices.patch(d[0]._id, {
        batt: batt,
        xbeeUpdatedAt: moment().valueOf()
      });
    }
  });
}



const gameServerAddress = process.env.D3VICE_GAMESERVER_ADDRESS
console.log(`  🔗 gameServerAddress is ${gameServerAddress}`)

/**
 * Ensure game server address is defined
 */
if (typeof gameServerAddress === 'undefined')
  throw new Error('D3VICE_GAMESERVER_ADDRESS is undefined in environment!');


/**
 * Ensure game server address is a valid URI
 */
if (validUrl.isUri(gameServerAddress)) {
  console.log(`  ✅ The game server address looks valid.`);
} else {
  throw new Error('  ❌ D3D3VICE_GAMESERVER_ADDRESS is not a valid URL. ' +
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
const devices = app.service('devices');
const timeline = app.service('timeline');



const doRunGateway = (xbeeFilename) => {

  var xbee = xbeeRx({
    serialport: xbeeFilename,
    serialportOptions: {
      baudRate: 57600
    },
    module: "ZigBee",
    api_mode: 2,
    debug: true
  })


  // Get the RSSI from remote XBees by sending the DB command.
  // we get the response right away and we can forward it to DooM HQ (gameserver)
  const rssiRequester = xbee.remoteCommand({
    destinationId: undefined,
    broadcast: true,
    command: 'DB'
  })
  .pipe(
    tap(ev => {
      console.log(`  🍶📻 tap RSSI: ${JSON.stringify(ev)}`);
      reportRssiToGameserver(ev);
    })
  )

  // request battery voltage
  // the response for this is handled below
  const battRequester = xbee.remoteTransmit({
    destinationId: undefined,
    broadcast: true,
    data: 'DCXDC'
  })
  //
  // const errorCatcher = (val) => {
  //   try {
  //     return rssiRequester;
  //   }
  //   catch (err) {
  //     return Rx.Observable.empty();
  //   }
  // };

  const delayer = of(null).pipe(delay(timeoutBetweenRssi));

  const transmissionLoop = concat(
      delayer, rssiRequester, delayer, battRequester
    )
    .pipe(
      repeat(),
      catchError((err, caught) => {
        console.error(`${chalk.red(`  😈 Oh noes, there was an error!`)} ${chalk.red.bold(`${err}.`)} ${chalk.yellow(`Let's not stop there... Never give up, never surrender! 💪`)}`);
        return caught;
      })
    )
    .subscribe(
      (x) => {
        console.log(`  🌀 nexted. ${JSON.stringify(x)}`)
      },
      (err) => {
        console.log(`  😠 err'd: ${err}`)
      },
      () => {
        console.log(`  ⌛ completo.`)
      }
    )


  // var source = rxjs.Observable.timer(0, 5000)
  //   .timeInterval()
  //   xbee.remoteCommand({
  //     destinationId: '8-switzerland-robust',
  //     command: 'DB',
  //   }).subscribe((frame) => {
  //     console.log(`DB response: ${frame.commandData}`);
  //   }, (e) => {
  //     console.log(`command failed: ${e}`);
  //   })
  //   .repeat();
  //
  // var subscription = source.subscribe(
  //   function(x) {
  //     console.log('Next: ' + x);
  //   },
  //   function(err) {
  //     console.log('Error: ' + err);
  //   },
  //   function() {
  //     console.log('Completed');
  //   });


  // get RSSI every so often

  // .pipe(
  //   operators.interval(5000),
  //   operators.timeInterval(),
  //   operators.take(3)
  // );

  //rssiStream


  /**
   * define the sequence of data that is a Ctrl+C
   * we use this later to determine when to stop listening
   * to the serial port
   */
  // var ctrlCStream = rxjs.Observable.fromEvent(stdin, "data")
  //   .where(function monitorCtrlCOnData(data) {
  //     return data.length === 1 && data[0] === 0x03; // Ctrl+C
  //   })
  //   .take(1);

  /**
   * configure a stream for handling HELLOs from controlpoints
   * the HELLO packet type is within type 144 (0x90) ZIGBEE_RECEIVE_PACKET
   */
  const incomingTransmissionStream = xbee
    .monitorTransmissions()
    .pipe(
      takeWhile((data) => data.type === 144), // ZIGBEE_RECEIVE_PACKET
      takeWhile((data) => R.test(/^DCXDC/, data.data.toString())),
      tap((data) => { console.log(`  🤠 ${JSON.stringify(data)}`)}),
      map((data) => {
        const numberBuffer = data.data.slice(5, 6);
        const number = parseInt(numberBuffer.toString('hex'), 16);
        return {
          batt: computeVoltage(number),
          remote64: data.remote64
        };
      }),
      tap((data) => {
        console.log(`  🔌 *bzzzt* ${JSON.stringify(data)}`);
        reportBattToGameserver(data);
      }),
      repeat(),
      catchError((err, caught) => {
        console.error(`${chalk.red(`  🧧 there was an error while receiving battery voltage info!`)} ${chalk.red.bold(`${err}.`)} ${chalk.yellow(`Head for the hills~ JK,　DO YOUR BEST!「頑張って！」`)}`);
        return caught;
      })
    )
    .subscribe((next) => {
      console.log(`  🌙 to the moon! ${JSON.stringify(next)}`)
    }, (err) => {
      console.log(`  ${chalk.bold('👺 間違いだ')} ${err}`);
    }, () => {
      console.log(`  🙆‍ completod! `)
    })
    // .where(R.propEq("type", 144)) // ZIGBEE_RECEIVE_PACKET
    // .where(R.prop("data"))
    // .where(function(frame) {
    //   return R.test(/DCXHI/, frame.data.toString());
    // })
    // .map(frame => [
    //   frame.remote64,
    //   frame.data.toString(),
    // ])





  //.where(R.test(/DCXHI/))
  //.where(R.is(String), [0])

  // .pluck("data")
  // .map(function (buffer) {
  //     var s = buffer.toString();
  //     return (s === "\r") ? "\n" : s;
  // })
  // .where(R.is(String))
  // .where(R.test(/DCXHI/));




  const errorCb = function(error) {
    console.log("Error during monitoring:\n", error);
    xbee.close();
    process.exit();
  }


  const exitCb = function() {
    console.log("\nGot CTRL-C; exiting.");
    xbee.close();
    process.exit();
  }








  app.on('error', function(err) {
    console.error('an error occured.');
    console.error(err);
  });


  evs.on('created', function(event) {
    //console.log(event); 0013a20040b51a26
    const type = event.type || '';
    const device = event.device || '';
    const order = event.order || '';

    console.log(`  >> event seen.\n     type=${type} device=${device} order=${order}`);
    //device = Buffer.from(device, 'hex');


    if (type === 'order') {
      xbee.remoteTransmit({
          destination64: device,
          broadcast: false,
          data: order
        })
        .subscribe(function xbeeTXSuccess() {
          console.log("Device order transmission successful~");
        }, function xbeeTXFail(e) {
          console.log("Device order transmission failed:\n", e);
        });
    }

  });

  // Receive real-time events through Socket.io
  app.service('devices')
    .on('created', function(device) {
      if (isXBeeDevice(device))
        console.log('  👀 New XBee device created', device);
    })
    .on('updated', function(device) {
      if (isXBeeDevice(device)) {
        console.log(`  👀 device ${device.did} has changed`)
        console.log(`  👀 device: ${JSON.stringify(device)}`)
      }
    })
    .on('patched', function(device) {
      if (isXBeeDevice(device)) {
        console.log(`  👀 device ${device.did} has patched`)
        console.log(`  👀 device: ${JSON.stringify(device)}`)
        // send out an update to the remote xbee device

      }
    })
    .on('removed', function(device) {
      if (isXBeeDevice(device)) {
        console.log(`  👀 device ${device.did} was removed.`)
        console.log(`  👀 device: ${JSON.stringify(device)}`)
      }
    })



  // Get the list of devices that exist on the gameserver.
  // DIDs starting with 8 are xbee devices.
  // All other DID prefixes will be ignored.
  app.service('devices')
    .find()
    .then(function(devices) {
      const xbeeDevices = R.filter(isXBeeDevice, devices);
      console.log(`  💼 ${chalk.bold.blue(`${xbeeDevices.length} XBEE D3VICE${xbeeDevices.length > 1 ? 'S' : ''}:`)}`);
      console.log(`    ${R.map((d) => `👜 ${d.did}(${d.description ? d.description : d._id })`, xbeeDevices)}`);
    })
    .catch((e) => {
      console.error(`  ⚠️ ${chalk.red("WARNING: Gateway had a problem connecting to the game server!")}`);
      console.error(`  🚨 ${chalk.red(e)}`);
    })



  // When an event is received from the xbee network, translate the data
  // // and forward to the gameserver.
  // helloStream
  //   // .takeUntil(ctrlCStream)
  //   .subscribe(function(s) {
  //     console.log(`  🚿 helloStream: ${s}`);
  //     // forwardEventToGameserver(s);
  //   }, errorCb, exitCb);

  //rxjs.Observable.combineLatest(Promise.resolve())
}
