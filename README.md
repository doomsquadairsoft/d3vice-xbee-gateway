# d3vice-xbee-gateway

Use XBee based wireless DooM D3vices with https://github.com/doomsquadairsoft/controlpointer

## How it works

  * d3vice-controlpoint-xbee sends a "[ZigBee Transmit Request (0x10)](https://www.safaribooksonline.com/library/view/building-wireless-sensor/780596807757/zigbee_transmit_request.html)" packet to the xbee broadcast address when it starts up.
  * d3vice-xbee-gateway receives the above as a "[ZigBee Receive Packet (AO=0) (0x90)](https://www.safaribooksonline.com/library/view/building-wireless-sensor/780596807757/zigbee_receive_packet.html)" packet.

## Hardware Setup

This project requires a [linux computer](http://amzn.to/2HXWCA8) with WiFi and XBee radios. Use a [USB XBee dongle](https://www.amazon.com/Adafruit-USB-XBee-Adapter-ADA247/dp/B01BMREBAO/ref=sr_1_2?s=electronics&ie=UTF8&qid=1521779953&sr=1-2&keywords=adafruit+xbee+adapter&dpID=51dk7kZ12XL&preST=_SX300_QL70_&dpSrc=srch). Currently only ZigBee XBee radios in API mode are suported, however other series may be included in the future.

## Installation

The user account which runs the gateway needs linux permissions to access tty and dialout groups (May or may not be required for your OS)

  `sudo usermod -aG tty,dialout <YOUR_USERNAME_HERE>`

Reboot your computer (or do fancy permmission refresh stuff) after performing the above, so permissions are applied.

The gateway uses nodejs to to communicate over USB with the radio, and communicate with the server using feathersjs realtime framework. Installing project dependencies is simple--

    npm install

## Setup

The gateway computer will need on environment variable set. This can be done using environment variables in your shell, or configured in an `.env` file. `D3VICE_GAMESERVER_ADDRESS` is the URL to the DooM HQ server. Here is an example .env file--

```
D3VICE_GAMESERVER_ADDRESS=http://hq.doomsquadairsoft.com:5000
```

## Running

    npm run start

## Documentation

### Parts list

  * [XBP24BZ7UIT-004](https://www.digi.com/support/productdetail?pid=4549&osvid=0&s=507&tp=1)
  * [XBee to USB adapter](https://amzn.to/2Omzm2G)

### Wireless communication protocol

#### Actions sent from d3vice-controlpoint-xbee

* Button press
* Button hold
* Button release
* Button double tap

#### Actions sent from gateway

* change light color
* change light parameter

### Setting up a new XBee for use with d3vice-controlpoint-xbee

All writes are done using XCTU-NG. Feel free to use OTAP!
Default serial settings are 9600/8/N/1/N

  * Update firmware to latest version. XBP24-ZB fw is needed.
    * Depending on how you installed, XCTU's permissions may cause problems updating fw. You may need to run as root to update firmware.
      * Run XCTU from CLI to see error messages.
    * Install legacy firmware package in X-CTU. Or manually download the firmware. [try here](https://www.digi.com/support/productdetail?pid=4549&osvid=0&s=507&tp=1) or [here](ftp://ftp1.digi.com/support/firmware) or [here](https://www.digi.com/support/productdetail?pid=3430&type=firmware)
    * firmware choice must be ZB Coordinator or ZB Endpoint
  * Write Node Identifier (NI)
    * `node generateNI.js` will give you some NI ideas
  * Write BD=6 (Baudrate 57600)
  * Write AP=2 (API mode with escaping)
  * Write ID=73706F6B616E6561 (ZB PAN "SPOKANEA")

If you have trouble joining the PAN, check AI for error codes.

| AI Code       | Description   |
| ------------- |:-------------:|
| 0x21          | No PANs found |
| 0x22          | PAN(s) found with invalid PAN ID |
| 0x23          | Joining not allowed |
| 0x27          | Join failure |
| 0x2B          | Discovering coordinator |
| 0xAD          | Security key not received |
| 0xAF          | Pre-configured link key error |
| 0xFF          | Attempting a new join scan |

See ./datasheets/Debugging Joining in a ZigBee Network for more deets
