
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

// Receive real-time events through Socket.io
app.service('devices')
    .on('created', device => console.log('New device created', device));

// Call the `messages` service
app.service('device').create({
    did: 'franchez-kka',
    controllingTeam: 1
});

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
