'use strict'

const reekoh = require('demo-reekoh-node')
const _plugin = new reekoh.plugins.DeviceSync()

const soap = require('soap')
const async = require('async')
const get = require('lodash.get')
const isEmpty = require('lodash.isempty')

let _version = null
let _jasperClient = {}

let _options ={
  licenseKey: process.env.JASPER_IOT_KEY,
  version: process.env.JASPER_IOT_VERSION,
  username: process.env.JASPER_IOT_USERNAME,
  password: process.env.JASPER_IOT_PASSWORD,
  endpoint: process.env.JASPER_IOT_ENDPOINT
}

_plugin.once('ready', function () {

  _version = _options.version
    ? _options.version
    : _plugin.config.version.default

  soap.createClient('config/Terminal.wsdl', function (err, client) {
    if (err) return _plugin.logException(err)

    if (_options.endpoint) client.setEndpoint(_options.endpoint)

    client.setSecurity(new soap.WSSecurity(_options.username, _options.password))
    _jasperClient = client

    _plugin.log('Jasper IoT Device Integration has been initialized.')
    setImmediate(() => { process.send({ type: 'ready' }) }) // for mocha
  })
})
_plugin.on('sync', function () {

  // console.log(_jasperClient.GetModifiedTerminals)

  _jasperClient.GetModifiedTerminals({
    messageId: '?',
    version: _version,
    licenseKey: _options.licenseKey
  }, (err, response) => {
    if (err) {
      if (!isEmpty(get(err, 'Fault.faultstring'))) {
        return _plugin.logException(new Error(get(err, 'Fault.faultstring')))
      } else				{
        return _plugin.logException(err)
      }
    }

    if (isEmpty(response) || isEmpty(response.iccids) || isEmpty(get(response, 'iccids.iccid'))) {
      return _plugin.log(`Jasper IoT Device Integration - No modified terminals`)
    }

    let count = 0
    let limit = 50
    let iccids = get(response, 'iccids.iccid')
    let totalLoop = Math.ceil(iccids.length / limit)

    async.whilst(() => {
      return count < totalLoop
    }, (callback) => {
      let selectedIccids = iccids.slice(count * limit, (count + 1) * limit)
      count++

      _jasperClient.GetTerminalDetails({
        messageId: '?',
        version: _version,
        licenseKey: _options.licenseKey,
        iccids: {
          iccid: selectedIccids
        }
      }, (error, response) => {
        if (error) {
          if (!isEmpty(get(error, 'Fault.faultstring'))) {
            _plugin.logException(new Error(get(error, 'Fault.faultstring')))
          } else						{
            _plugin.logException(error)
          }

          callback()
        }

        async.each(response.terminals.terminal, (terminal, done) => {

          let device = Object.assign(terminal, {
            _id: terminal.iccid,
            name: isEmpty(terminal.terminalId) ? terminal.imsi : terminal.terminalId
          })

          _plugin.log({
            title: 'Jasper Device Integration - Synced Device',
            device: device
          })

          _plugin.syncDevice(device)
            .then(done)
            .catch(done)

        }, (eachError) => {
          if (eachError) _plugin.logException(eachError)
          callback()
        })
      })
    }, (whilstError) => {
      if (whilstError) {
        _plugin.logException(whilstError)
      } else {
        _plugin.log(`Syncing ${iccids.length} devices completed`)
        process.send({ type: 'syncDone' }) // for mocha
      }
    })
  })
})

_plugin.on('adddevice', function (device) {

})

_plugin.on('updatedevice', function (device) {

})

_plugin.on('removedevice', function (device) {

})
