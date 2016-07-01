'use strict';

var cp     = require('child_process'),
    assert = require('assert'),
    deviceIntegration;

describe('Device-integration', function () {
    this.slow(5000);

    after('terminate child process', function () {
        deviceIntegration.kill('SIGKILL');
    });

    describe('#spawn', function () {
        it('should spawn a child process', function () {
            assert.ok(deviceIntegration = cp.fork(process.cwd()), 'Child process not spawned.');
        });
    });

    describe('#handShake', function () {
        it('should notify the parent process when ready within 5 seconds', function (done) {
            this.timeout(5000);

            deviceIntegration.on('message', function (message) {
                if (message.type === 'ready')
                    done();
            });

            deviceIntegration.send({
                type: 'ready',
                data: {
                    options: {
                        username: 'xxxxx',
                        password: 'xxxxx',
                        licenseKey: 'xxxxx-xxxx-xxxx'
                    }
                }
            }, function (error) {
                assert.ifError(error);
            });
        });
    });

    describe('#sync', function() {
        it('should sync 3rd party devices to Reekoh devices', function(done) {
            this.timeout(5000);
            deviceIntegration.send({
                type: 'sync',
                data: {
                    last_sync_dt: new Date('12-12-1970')
                }
            }, done);
        });
    });
});