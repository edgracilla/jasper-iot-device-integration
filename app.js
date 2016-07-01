'use strict';

var platform    = require('./platform'),
    async       = require('async'),
    version     = '2.43',
    jasperClient,
    licenseKey;

/**
 * Emitted when the platform issues a sync request. Means that the device integration should fetch updates from the
 * 3rd party service.
 */
platform.on('sync', function (lastSyncDate) {
    jasperClient.GetModifiedTerminals({
        messageId: '?',
        version: version,
        licenseKey: licenseKey,
        since: lastSyncDate.toISOString()
    }, (error, response) => {
        if (error) {
            platform.handleException({
                name: 'Device sync',
                message: error
            });
        } else {
            let iccids = response.iccids.iccid;
            let limit = 50;
            let totalLoop = Math.ceil(iccids.length / limit);
            let count = 0;

            async.whilst(() => {
                    return count < totalLoop;
                }, (callback) => {
                    let selectedIccids = iccids.slice(count * limit, (count + 1) * limit );
                    count++;

                    jasperClient.GetTerminalDetails({
                        messageId: '?',
                        version: version,
                        licenseKey: licenseKey,
                        iccids: {
                            iccid: selectedIccids
                        }
                    },(error, response) => {
                        let terminals = response.terminals.terminal;

                        async.eachSeries(terminals, (terminal, done) => {
                            let id      = terminal.iccid,
                                name    = terminal.imsi;

                            delete terminal.iccid;
                            delete terminal.imsi;
                            
                            let device = {
                                _id: id,
                                name: name,
                                metadata: terminal
                            };

                            platform.syncDevice(device, done);

                        },(error) => {
                            if (error) {
                                platform.handleException({
                                    name: 'Device sync',
                                    message: error
                                });
                            }
                            callback();
                        });
                    });
                },
                (err) => {
                    if (err) {
                        platform.handleException({
                            name: 'Device sync',
                            message: error
                        });
                    } else {
                        platform.log(`Syncing ${iccids.length} devices completed`);
                    }
                }
            );
        }
    });
});

/**
 * Emitted when the platform shuts down the plugin. The Device Integration should perform cleanup of the resources on this event.
 */
platform.once('close', function () {
    let d = require('domain').create();

    d.once('error', function (error) {
        console.error(error);
        platform.handleException(error);
        platform.notifyClose();
        d.exit();
    });

    d.run(function () {
        // TODO: Release all resources and close connections etc.
        platform.notifyClose(); // Notify the platform that resources have been released.
        d.exit();
    });
});

/**
 * Emitted when the platform bootstraps the plugin. The plugin should listen once and execute its init process.
 * Afterwards, platform.notifyReady() should be called to notify the platform that the init process is done.
 * @param {object} options The parameters or options. Specified through config.json.
 */
platform.once('ready', function (options) {
    let soap = require('soap');
    let url = 'config/Terminal.wsdl';

    licenseKey = options.licenseKey;

    soap.createClient(url, function (error, _jasperClient) {
        let wsSecurity = new soap.WSSecurity(options.username, options.password);
        _jasperClient.setSecurity(wsSecurity);
        jasperClient = _jasperClient;

        platform.notifyReady();
        platform.log('Device integration has been initialized.');
    });
});