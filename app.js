'use strict';

var get      = require('lodash.get'),
	async    = require('async'),
	isEmpty  = require('lodash.isempty'),
	platform = require('./platform'),
	jasperClient, version, licenseKey;

/**
 * Emitted when the platform issues a sync request. Means that the device integration should fetch updates from the
 * 3rd party service.
 */
platform.on('sync', function (lastSyncDate) {
	jasperClient.GetModifiedTerminals({
		messageId: '?',
		version: version,
		licenseKey: licenseKey,
		since: lastSyncDate
	}, (getModifiedTerminalsError, response) => {
		if (getModifiedTerminalsError) {
			if (!isEmpty(get(getModifiedTerminalsError, 'Fault.faultstring')))
				return platform.handleException(new Error(get(getModifiedTerminalsError, 'Fault.faultstring')));
			else
				return platform.handleException(getModifiedTerminalsError);
		}

		if (isEmpty(response) || isEmpty(response.iccids) || isEmpty(get(response, 'iccids.iccid')))
			return platform.log(`Jasper IoT Device Integration - No modified terminals since ${lastSyncDate}`);

		let iccids = get(response, 'iccids.iccid');
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
				version: version,
				licenseKey: licenseKey,
				iccids: {
					iccid: selectedIccids
				}
			}, (getTerminalDetailsError, response) => {
				if (getTerminalDetailsError) {
					if (!isEmpty(get(getTerminalDetailsError, 'Fault.faultstring')))
						platform.handleException(new Error(get(getTerminalDetailsError, 'Fault.faultstring')));
					else
						platform.handleException(getTerminalDetailsError);

					callback();
				}

				async.each(response.terminals.terminal, (terminal, done) => {
					platform.log({
						title: 'Jasper Device Integration - Synced Device',
						device: Object.assign(terminal, {
							_id: terminal.terminalId || terminal.iccid,
							name: (terminal.terminalId) ? terminal.iccid : terminal.imsi
						})
					});

					platform.syncDevice(JSON.stringify(Object.assign(terminal, {
						_id: terminal.terminalId || terminal.iccid,
						name: (isEmpty(terminal.terminalId)) ? terminal.iccid : terminal.imsi
					})), done);
				}, (eachError) => {
					if (eachError) platform.handleException(eachError);

					callback();
				});
			});
		}, (whilstError) => {
			if (whilstError)
				platform.handleException(whilstError);
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
	let soap   = require('soap'),
		config = require('./config.json');

	licenseKey = options.licenseKey;

	if (options.version)
		version = options.version;
	else
		version = config.version.default;

	soap.createClient('config/Terminal.wsdl', function (error, _jasperClient) {
		if (options.endpoint)
			_jasperClient.setEndpoint(options.endpoint);

		let wsSecurity = new soap.WSSecurity(options.username, options.password);
		_jasperClient.setSecurity(wsSecurity);
		jasperClient = _jasperClient;

		platform.notifyReady();
		platform.log('Jasper IoT Device Integration has been initialized.');
	});
});