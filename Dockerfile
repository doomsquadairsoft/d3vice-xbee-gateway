FROM node:8-alpine as builder

WORKDIR /d3vice-xbee-gateway

## Install build toolchain, install node deps and compile native add-ons
RUN apk add --no-cache --virtual .gyp python make gcc g++ linux-headers udev

COPY package.json /d3vice-xbee-gateway/

RUN ls -la
# RUN npm install serialport --build-from-source # greetz https://github.com/node-serialport/node-serialport/blob/50a0c0381cc4c0731e2aac924c9c0d831528a5bb/packages/website/translated_docs/es-ES/guide-installation.md#alpine
RUN npm install










FROM node:8-alpine as app

WORKDIR /d3vice-xbee-gateway

## Copy built node modules and binaries without including the toolchain
COPY --from=builder /d3vice-xbee-gateway/package.json /d3vice-xbee-gateway/
COPY --from=builder /d3vice-xbee-gateway/node_modules /d3vice-xbee-gateway/node_modules
COPY gateway.js /d3vice-xbee-gateway/

CMD ["npm", "start"]
