'use strict';

/**
 * Utility function to validate String Objects
 * @param val The value to be evaluated.
 * @returns {boolean}
 */
var isString = function (val) {
	return typeof val === 'string' || ((!!val && typeof val === 'object') && Object.prototype.toString.call(val) === '[object String]');
};

/**
 * Utility function to validate Error Objects
 * @param val The value to be evaluated.
 * @returns {boolean}
 */
var isError = function (val) {
	return (!!val && typeof val === 'object') && typeof val.message === 'string' && Object.prototype.toString.call(val) === '[object Error]';
};

/**
 * Main object used to communicate with the platform.
 * @returns {Platform}
 * @constructor
 */
function Platform() {
	if (!(this instanceof Platform)) return new Platform();

	require('events').EventEmitter.call(this);
	Platform.init.call(this);
}

require('util').inherits(Platform, require('events').EventEmitter);

/**
 * Init function for Platform.
 */
Platform.init = function () {
	['SIGHUP', 'SIGINT', 'SIGTERM'].forEach((signal) => {
		process.on(signal, () => {
			console.log(`Executing ${signal} listener...`);
			this.emit('close');

			setTimeout(() => {
				this.removeAllListeners();
				process.exit();
			}, 2000);
		});
	});

	['unhandledRejection', 'uncaughtException'].forEach((exceptionEvent) => {
		process.on(exceptionEvent, (error) => {
			console.error(exceptionEvent, error);
			this.handleException(error);
			this.emit('close');

			setTimeout(() => {
				this.removeAllListeners();
				process.exit(1);
			}, 2000);
		});
	});

	/**
	 *   Available events triggered by the main instance ['ready', 'close', 'adddevice', 'updatedevice', 'removedevice']
	 */
	process.on('message', (m) => {
		let type = m.type;

		switch (type) {
			case 'ready':
				this.emit(type, m.data.options);
				break;
			case 'close':
				this.emit(type);
				break;
			case 'sync':
				this.emit(type, m.data.last_sync_dt);
				break;
			default:
				this.emit(type, m.data);
		}
	});
};

/**
 * Add or update 3rd party service devices to Reekoh devices.
 * @param {string} device Device information.
 * @param {function} [callback] Optional callback to be called once the signal has been sent.
 */
Platform.prototype.syncDevice = function (device, callback) {
	callback = callback || function () {
		};

	setImmediate(() => {
		if (!device || !isString(device)) return callback(new Error('Device data must be represented as a serialized JSON String.'));

		process.send({
			type: 'upsertdevice',
			data: device
		}, callback);
	});
};

/**
 * Remove device from Reekoh devices collection.
 * @param {string} deviceId Device indentifier.
 * @param {function} [callback] Optional callback to be called once the signal has been sent.
 */
Platform.prototype.removeDevice = function (deviceId, callback) {
	callback = callback || function () {
		};

	setImmediate(() => {
		if (!deviceId || !isString(deviceId)) return callback(new Error('A valid client/device identifier is required.'));

		process.send({
			type: 'removedevice',
			data: {
				_id: deviceId
			}
		}, callback);
	});
};

/**
 * Needs to be called once in order to notify the platform that the plugin has already finished the init process.
 * @param {function} [callback] Optional callback to be called once the ready signal has been sent.
 */
Platform.prototype.notifyReady = function (callback) {
	callback = callback || function () {
		};

	setImmediate(() => {
		process.send({
			type: 'ready'
		}, callback);
	});
};

/**
 * Notifies the platform that resources have been released and this plugin can shutdown gracefully.
 * @param {function} [callback] Optional callback to be called once the close signal has been sent.
 */
Platform.prototype.notifyClose = function (callback) {
	callback = callback || function () {
		};

	setImmediate(() => {
		process.send({
			type: 'close'
		}, callback);
	});
};

/**
 * Logs any data to the attached loggers in the topology.
 * @param {string} data The data that needs to be logged.
 * @param {function} callback Optional callback to be called once the data has been sent.
 */
Platform.prototype.log = function (data, callback) {
	callback = callback || function () {
		};

	if (!data || !isString(data)) return callback(new Error('A valid log data is required.'));

	process.send({
		type: 'log',
		data: data
	}, callback);
};

/**
 * Logs errors to all the attached exception handlers in the topology.
 * @param {error} error The error to be handled/logged
 * @param {function} callback Optional callback to be called once the error has been sent.
 */
Platform.prototype.handleException = function (error, callback) {
	callback = callback || function () {
		};

	setImmediate(() => {
		if (!isError(error)) return callback(new Error('A valid error object is required.'));

		process.send({
			type: 'error',
			data: {
				name: error.name,
				message: error.message,
				stack: error.stack
			}
		}, callback);
	});
};

module.exports = new Platform();