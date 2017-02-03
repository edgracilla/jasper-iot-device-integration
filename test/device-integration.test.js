/* global describe, it, after, before */
'use strict'

const cp = require('child_process')
const should = require('should')
const amqp = require('amqplib')

let deviceSync = null
let _channel = {}
let _conn = null

describe('Device-integration', function () {
  this.slow(8000)

  before('init', () => {
    process.env.PLUGIN_ID = 'demo.dev-sync'
    process.env.BROKER = 'amqp://guest:guest@127.0.0.1/'
    process.env.CONFIG = '{"username":{"label":"Username","type":"String","required":true,"help":"Username to be used for authentication."},"password":{"label":"Password","type":"Password","required":true,"help":"Password to be used for authentication."},"licenseKey":{"label":"License key","type":"Password","required":true,"help":"The license key used for request metering, or possible authorization purpose (limit API client itself, not the Control Center user)."},"endpoint":{"label":"Endpoint","type":"String","help":"(Optional) Jasper API Endpoint to be used. Default: https://api.jasperwireless.com/ws/service/terminal"},"version":{"label":"Version","type":"String","default":"3.25","help":"(Optional) Jasper API Version. Default: 3.25"}}'

    process.env.JASPER_IOT_VERSION = '3.25'
    process.env.JASPER_IOT_USERNAME = 'xxx'
    process.env.JASPER_IOT_PASSWORD = 'xxx'
    process.env.JASPER_IOT_KEY = 'xxx-xxx-xxx-xxx-xxx'

    process.env.JASPER_IOT_ENDPOINT = ''

    amqp.connect(process.env.BROKER)
      .then((conn) => {
        _conn = conn
        return conn.createChannel()
      }).then((channel) => {
        _channel = channel
      }).catch((err) => {
        console.log(err)
      })
  })

  after('terminate child process', () => {
    setTimeout(() => {
      _conn.close()
      deviceSync.kill('SIGKILL')
      done()
    }, 4000)
  })

  describe('#spawn', function () {
    it('should spawn a child process', function () {
      should.ok(deviceSync = cp.fork(process.cwd()), 'Child process not spawned.')
    })
  })

  describe('#handShake', function () {
    it('should notify the parent process when ready within 5 seconds', function (done) {
      this.timeout(5000)

      deviceSync.on('message', function (message) {
        if (message.type === 'ready') {
          done()
        }
      })
    })
  })

  describe('#sync', function () {
    it('should sync 3rd party devices to Reekoh devices', function (done) {
      this.timeout(8000)

      _channel.sendToQueue(process.env.PLUGIN_ID, new Buffer(JSON.stringify({ operation: 'sync' })))

      deviceSync.on('message', function (message) {
        if (message.type === 'syncDone') {
          done()
        }
      })
    })
  })
})
