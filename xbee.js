const rx = require("rx");
const xbeeRx = require("xbee-rx");
const R = require("ramda");
const xbee_api = require("xbee-api");


module.exports = function() {

    var xbee = xbeeRx({
        serialport: "/dev/ttyUSB0",
        serialportOptions: {
            baudrate: 57600
        },
        module: "ZigBee",
        // turn on debugging to see what the library is doing
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
     * configure the transmission stream behaviour.
     */
    var transmissionsStream = xbee
        .monitorTransmissions()
        .pluck("data")
        .map(function (buffer) {
            var s = buffer.toString();
            return s === "\r" ? "\n" : s;
        });

    /**
     * configure a stream for handling HELLOs from controlpoints
     * the HELLO packet type is within type 144 (0x90) ZIGBEE_RECEIVE_PACKET
     */
    var helloStream = xbee
        .monitorTransmissions()
        //.where(R.propEq("type", xbee_api.constants.ZIGBEE_RECEIVE_PACKET))
        .where(R.propEq("type", 144))
        .pluck("data")
        .map(function (buffer) {
            var s = buffer.toString();
            console.log(s);
	    return (s === "\r") ? "\n" : s;
	});
           


    /**
     * take data off of the stream, processing it until something happens.
     *   - when data is seen, print it to stdout
     *   - when an error is observed, exit.
     *   - when Ctrl+C is observed, exit.
     */	


    //transmissionsStream
    helloStream
        .takeUntil(ctrlCStream)
        .subscribe(function (s) {
	    console.log('sub!');
	    console.log(typeof s);
            process.stdout.write(s);
        }, function (error) {
            console.log("Error during monitoring:\n", error);
            xbee.close();
            process.exit();
        }, function () {
            console.log("\nGot CTRL-C; exiting.");
            xbee.close();
            process.exit();
        });
}()
