# d3vice-xbee-gateway

Use XBee based wireless DooM D3vices with https://github.com/doomsquadairsoft/controlpointer


## Hardware Setup

This project requires a [linux computer](http://amzn.to/2HXWCA8) with WiFi and XBee radios. Use a [USB XBee dongle](https://www.amazon.com/Adafruit-USB-XBee-Adapter-ADA247/dp/B01BMREBAO/ref=sr_1_2?s=electronics&ie=UTF8&qid=1521779953&sr=1-2&keywords=adafruit+xbee+adapter&dpID=51dk7kZ12XL&preST=_SX300_QL70_&dpSrc=srch). Currently only ZigBee XBee radios in API mode are suported, however other series may be included in the future.

## Installation

The gateway uses nodejs to to communicate over USB with the radio, and communicate with the server using feathersjs realtime framework. Installing project dependencies is simple--

    npm install

## Running

    npm run start
