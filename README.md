# d3vice-xbee-gateway

Use XBee based wireless DooM D3vices with https://github.com/doomsquadairsoft/controlpointer


## Hardware Setup

This project requires a linux computer with WiFi and XBee radios. Use a USB XBee dongle such as https://www.adafruit.com/product/247. Currently only ZigBee XBee radios in API mode are suported, however other series may be included in the future.

## Installation

The gateway uses nodejs to to communicate over USB with the radio, and communicate with the server using feathersjs realtime framework. Installing project dependencies is simple--

    npm install

## Running

    npm run start
