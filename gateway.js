"use strict";


require('dotenv').config();
const feathers = require('@feathersjs/feathers');
const socketio = require('@feathersjs/socketio-client');
const io = require('socket.io-client');
const validUrl = require('valid-url');
const buffer = require('buffer');
const {
  rxjs,
  of ,
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
  takeWhile,
  filter,
  share
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
const isXBeeDevice = R.propSatisfies(x => R.length(x) > 0, 'address64');


Promise.config({
  longStackTraces: true,
  warnings: true,
  cancellation: true,
  monitoring: true,
})


const computeVoltage = (number) => {
  const r1 = 100000;
  const r2 = 10000;
  const timePeriod = 1024.0;
  const baseVoltage = 3.3;
  const vOut = ((number * baseVoltage) / timePeriod);
  const vIn = (vOut / (r2 / (r1 + r2)));
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
      resolve(true);
    }, (e) => {
      console.log(`  😕 Detected ${filename} but it doesn't look like an XBee.`);
      resolve(false);
    }, () => {
      console.log('  🚪 closing test connection to XBee');
      maybeAnXbee.close();
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

getUsbDevice().delay(500).then((filename) => {
  if (typeof filename === 'undefined') throw new Error('No valid USB XBee radios found.')
  console.log(`  🎯 ${chalk.bold.green(filename)} is our XBee.`);
  return doRunGateway(filename);
}).catch(function(e) {
  console.log(e);
});

const timeoutBetweenRssi = moment.duration(30, 'seconds').valueOf();

const reportButtonToGameserver = (results) => {
  if (!results) return;
  const buttonState = results.buttonState;
  const team = results.team;
  const remote64 = results.remote64;

  devices.find({
      query: {
        address64: remote64
      },
    })
    .then((d) => {
      console.log(`  🖱️ Reporting Button To Gameserver found ${JSON.stringify(d)}`);
      const gameId = R.last(d[0].associatedGames);
      const target = d[0].did;
      const targetId = d[0]._id;
      const evt = {
        gameId: gameId,
        action: `${buttonState}_${team}`,
        source: 'player',
        type: 'timeline',
        target: target,
        targetId: targetId
      };
      if (R.isEmpty(d)) {
        console.log(chalk.red(`  👻 ERROR: There is no D3VICE in DooM HQ with address64 ${remote64}!!`));
      } else {
        timeline.create(evt);
      }
    })
    .catch((e) => {
      console.log(`  🖱️❌ there was a problem finding the device in question with address64 ${remote64}`)
      console.log(e);
    })
}

const reportRssiToGameserver = (results) => {
  // {"type":151,"id":3,"remote64":"0013a20040ba4058","remote16":"6771","command":"DB","commandStatus":0,"commandData":{"type":"Buffer","data":[36]}}
  if (!results) return;
  const rssi = `-${parseInt(results.commandData.toString('hex'), 16)}`
  const remote64 = results.remote64;

  console.log(`  📋 reporting rssi:${rssi}dB, remote64:${remote64}`);

  // lookup the device ID given the address64
  devices.find({
      query: {
        address64: remote64
      },
    })
    .then((d) => {
      console.log(`found ${JSON.stringify(d)}`);
      if (R.isEmpty(d)) {
        console.log(chalk.red(`  👻 ERROR: There is no D3VICE in DooM HQ with address64 ${remote64}!!`));
      } else {
        devices.patch(d[0]._id, {
          rssi: parseInt(rssi),
          xbeeUpdatedAt: moment().valueOf()
        });
      }
    })
    .catch((e) => {
      console.log(`  💩 there was a problem finding the device in question with address64 ${remote64}`)
      console.log(e);
    })
}

const sendGoToPhaseCommand = (xbeeInstance, address64, phaseNumber) => {
  if (typeof xbeeInstance === 'undefined') throw new Error('first param sent to sendGoToPhaseCommand must be an xbee-rx instance. got undefined.');
  if (typeof address64 === 'undefined') throw new Error('second param sent to sendGoToPhaseCommand must be an address64. got undefined.');
  if (typeof phaseNumber === 'undefined') throw new Error('third param sent to sendGoToPhaseCommand must be a phase number. got undefined.');

  xbeeInstance.remoteTransmit({
      destination64: address64,
      broadcast: false,
      data: `DCXP${phaseNumber}`
    })
    .subscribe(function xbeeTXSuccess() {
      console.log(`  😺 GoToPhaseCommand transmission successful~`);
    }, function xbeeTXFail(e) {
      console.log(`  😭 GoToPhaseCommand transmission failed:${e}`);
    });
};

const reportBattToGameserver = (results) => {
  if (!results) return;
  const batt = results.batt;
  const remote64 = results.remote64;

  console.log(`  🔋 reporting batt:${batt}, remote64:${remote64}`);

  // lookup the device ID given the address64
  devices.find({
    query: {
      address64: remote64
    },
  }).then((d) => {
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

const buildLEDCommand = (device) => {
  console.log(device);
  const teamNumber = (device.bluProgress > 0) ? 1 : 0;
  const percentage = (device.bluProgress > 0) ? device.bluProgress : device.redProgress;
  const percentageHex = percentage.toString(16);
  return `DCXLED${teamNumber}${percentageHex}`;
};



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
  });


  const delayer = of (null).pipe(delay(timeoutBetweenRssi));

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


  /**
   * configure a stream for handling HELLOs from controlpoints
   * the HELLO packet type is within type 144 (0x90) ZIGBEE_RECEIVE_PACKET
   */
  const dcStream = xbee
    .monitorTransmissions()
    .pipe(
      filter((data) => R.test(/^DCXDC/, data.data.toString())),
      map((data) => {
        const numberBuffer = data.data.slice(5, 6);
        const number = parseInt(numberBuffer.toString('hex'), 16);
        return {
          batt: computeVoltage(number),
          remote64: data.remote64
        };
      }),
      catchError((err, caught) => {
        console.error(`${chalk.red(`  🧧 there was an error while receiving incoming transmission!`)} ${chalk.red.bold(`${err}.`)} ${chalk.yellow(`Head for the hills~ JK,　DO YOUR BEST!「頑張って！」`)}`);
        return caught;
      })
    );

  const hiStream = xbee
    .monitorTransmissions()
    .pipe(
      filter((data) => R.test(/^DCXHI/, data.data.toString())),
      catchError((err, caught) => {
        console.error(`${chalk.red(`  🧧 there was an error while receiving incoming transmission!`)} ${chalk.red.bold(`${err}.`)} ${chalk.yellow(`Head for the hills~ JK,　DO YOUR BEST!「頑張って！」`)}`);
        return caught;
      })
    );


  const buttonStream = xbee
    .monitorTransmissions()
    .pipe(
      filter((data) => R.test(/^DCXB(P|R)/, data.data.toString())),
      map((data) => {
        const stateBuffer = data.data.slice(4, 5);
        const teamBuffer = data.data.slice(5, 6);
        const state = stateBuffer.toString() === 'P' ? 'press' : 'release';
        const teamNumber = parseInt(teamBuffer.toString('hex'), 16);
        const team = teamNumber === 0 ? 'red' : 'blu';
        return {
          buttonState: state,
          team: team,
          remote64: data.remote64
        };
      }),
      catchError((err, caught) => {
        console.error(`${chalk.red(`  🧧 there was an error while receiving incoming transmission!`)} ${chalk.red.bold(`${err}.`)} ${chalk.yellow(`Head for the hills~ JK,　DO YOUR BEST!「頑張って！」`)}`);
        return caught;
      })
    );

  buttonStream.subscribe((next) => {
    reportButtonToGameserver(next);
  })

  hiStream.subscribe((next) => {
    console.log(`  👋 HELLO received from remote D3VICE ${JSON.stringify(next)} (${next.data.toString()})`);
    // Send D3VICE 2B into Phase 25
    // @TODO this behavior should be configurable in DooM HQ
    sendGoToPhaseCommand(xbee, next.remote64, 25);
  })


  dcStream.subscribe((next) => {
    console.log(`  💡 DC received from remote D3VICE ${JSON.stringify(next)}`);
    reportBattToGameserver(next);
  })

  // .pipe(
  //
  //   takeWhile((data) => R.test(/^DCXDC/, data.data.toString())),
  //   tap((data) => { console.log(`  🤠 ${JSON.stringify(data)}`)}),
  //   map((data) => {
  //     const numberBuffer = data.data.slice(5, 6);
  //     const number = parseInt(numberBuffer.toString('hex'), 16);
  //     return {
  //       batt: computeVoltage(number),
  //       remote64: data.remote64
  //     };
  //   }),
  //   tap((data) => {
  //     console.log(`  🔌 *bzzzt* ${JSON.stringify(data)}`);
  //     reportBattToGameserver(data);
  //   }),
  //   repeat(),
  //   catchError((err, caught) => {
  //     console.error(`${chalk.red(`  🧧 there was an error while receiving battery voltage info!`)} ${chalk.red.bold(`${err}.`)} ${chalk.yellow(`Head for the hills~ JK,　DO YOUR BEST!「頑張って！」`)}`);
  //     return caught;
  //   })
  // )
  // .subscribe((next) => {
  //   console.log(`  🌙 to the moon! ${JSON.stringify(next)}`)
  // }, (err) => {
  //   console.log(`  ${chalk.bold('👺 間違いだ')} ${err}`);
  // }, () => {
  //   console.log(`  🙆‍ completod! `)
  // })



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
        xbee.remoteTransmit({
            destination64: device.address64,
            broadcast: false,
            data: buildLEDCommand(device)
          })
          .subscribe(function xbeeTXSuccess() {
            console.log("Device order transmission successful~");
          }, function xbeeTXFail(e) {
            console.log("Device order transmission failed:\n", e);
          });
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
      console.log(`  💼 ${chalk.bold.blue(`${xbeeDevices.length} Remote XBEE D3VICE${xbeeDevices.length > 1 ? 'S': ''} listed on DooM HQ:`)}`);
      console.log(`    ${R.map((d) => `👜 ${d.did}(${d.description ? d.description : d._id })`, xbeeDevices)}`);
    })
    .catch((e) => {
      console.error(`  ⚠️ ${chalk.red("WARNING: Gateway had a problem connecting to the game server!")}`);
      console.error(`  🚨 ${chalk.red(e)}`);
    })


}
