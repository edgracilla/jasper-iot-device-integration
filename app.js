'use strict';

const VERSION = '2.43';

var platform = require('./platform'),
	async    = require('async'),
	jasperClient,
	licenseKey;

/**
 * Emitted when the platform issues a sync request. Means that the device integration should fetch updates from the
 * 3rd party service.
 */
platform.on('sync', function (lastSyncDate) {
	jasperClient.GetModifiedTerminals({
		messageId: '?',
		version: VERSION,
		licenseKey: licenseKey,
		since: lastSyncDate
	}, (error, response) => {
		if (error) return platform.handleException(error);

		let iccids = response.iccids.iccid;
		let limit = 50;
		let totalLoop = Math.ceil(iccids.length / limit);
		let count = 0;

		async.whilst(() => {
			return count < totalLoop;
		}, (callback) => {
			let selectedIccids = iccids.slice(count * limit, (count + 1) * limit);
			count++;

			jasperClient.GetTerminalDetails({
				messageId: '?',
				version: VERSION,
				licenseKey: licenseKey,
				iccids: {
					iccid: selectedIccids
				}
			}, (error, response) => {
				async.each(response.terminals.terminal, (terminal, done) => {
					platform.syncDevice(JSON.stringify(Object.assign(terminal, {
						_id: terminal.terminalId || terminal.iccid,
						name: (terminal.terminalId) ? terminal.iccid : terminal.imsi
					})), done);

				}, (error) => {
					if (error) platform.handleException(error);

					callback();
				});
			});
		}, (err) => {
			if (err)
				platform.handleException(err);
			else
				platform.log(`Syncing ${iccids.length} devices completed`);
		});
	});
});

/**
 * Emitted when the platform shuts down the plugin. The Device Integration should perform cleanup of the resources on this event.
 */
platform.once('close', function () {
	platform.notifyClose();
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
		platform.log('Jasper IoT Device Integration has been initialized.');
	});
});