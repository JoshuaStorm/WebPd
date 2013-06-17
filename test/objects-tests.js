var assert = require('assert')
  , _ = require('underscore')
  , Pd = require('../index')
  , PdObject = require('../lib/PdObject')
  , Patch = require('../lib/Patch')
  , portlets = require('../lib/portlets')

// Dummy Web Audio API context
Pd.context = {
  createGain: function() { return {gain: 1} }
}

var TestingMailBox = PdObject.extend({
  type: 'TestingMailBox',
  init: function() { this.received = [] },
  inletDefs: [
    portlets['inlet'].extend({
      message: function() {
        var outlet = this.obj.outlets[0]
        this.obj.received.push(_.toArray(arguments))
        outlet.message.apply(outlet, arguments)
      }
    })
  ],
  outletDefs: [ portlets['outlet'] ]
})

describe('[send] / [receive]', function() {
  var send1, send2
    , receive1, receive1bis, receive2
    , mailbox1, mailbox1bis, mailbox2

  beforeEach(function() {
    send1 = new Pd.lib['send']('no1')
    send2 = new Pd.lib['send']('no2')

    receive1 = new Pd.lib['receive']('no1')
    receive1bis = new Pd.lib['receive']('no1')
    receive2 = new Pd.lib['receive']('no2')

    mailbox1 = new TestingMailBox()
    mailbox1bis = new TestingMailBox()
    mailbox2 = new TestingMailBox()

    receive1.o(0).connect(mailbox1.i(0))
    receive1bis.o(0).connect(mailbox1bis.i(0))
    receive2.o(0).connect(mailbox2.i(0))
  })

  it('should send messages through inlet to all receivers', function() {
    send1.i(0).message('bla', 'bli', 'blu')
    assert.deepEqual(mailbox1.received, [['bla', 'bli', 'blu']])
    assert.deepEqual(mailbox1bis.received, [['bla', 'bli', 'blu']])
    assert.deepEqual(mailbox2.received, [])
  })

  it('should send messages to Pd.receive as well', function() {
    var received = []
    Pd.receive('no2', function() { received.push(_.toArray(arguments)) })
    Pd.send('no2', 'bla', 888)
    assert.deepEqual(mailbox1.received, [])
    assert.deepEqual(mailbox1bis.received, [])
    assert.deepEqual(mailbox2.received, [['bla', 888]])
    assert.deepEqual(received, [['bla', 888]])
  })

  it('should send messages to Pd.receive as well', function() {
    // First change only receiver name
    receive1.setName('num1')
    send1.i(0).message('blop', 'blep', 'blup')
    assert.deepEqual(mailbox1.received, [])

    // Then change also sender name
    send1.setName('num1')
    send1.i(0).message(1, 11, 111)
    assert.deepEqual(mailbox1.received, [[1, 11, 111]])
  })
})

describe('[outlet], [inlet], [outlet~], [inlet~]', function() {

  it('should update the patch\'s portlets', function() {
    var patch = new Patch
    assert.deepEqual(patch.inlets, [])

    var outletObj = new Pd.lib['outlet'](patch)
      , inletDspObj = new Pd.lib['inlet~'](patch)
    assert.deepEqual(patch.inlets, [inletDspObj.inlets[0]])
    assert.deepEqual(patch.outlets, [outletObj.outlets[0]])
  })

  it('should transmit messages from outside / inside of the patch', function() {
    var patch = new Patch
      , subpatch = new Patch(patch)
      , mailbox1 = new TestingMailBox(patch)
      , mailbox2 = new TestingMailBox(subpatch)
      , mailbox3 = new TestingMailBox(patch)
      , inlet = new Pd.lib['inlet'](subpatch)
      , outlet = new Pd.lib['outlet'](subpatch)

    mailbox1.o(0).connect(subpatch.i(0))
    mailbox2.i(0).connect(inlet.o(0))
    mailbox2.o(0).connect(outlet.i(0))
    mailbox3.i(0).connect(subpatch.o(0))
    
    mailbox1.i(0).message('bla', 111)
    assert.deepEqual(mailbox1.received, [['bla', 111]])
    assert.deepEqual(mailbox2.received, [['bla', 111]])
    assert.deepEqual(mailbox3.received, [['bla', 111]])

    mailbox2.i(0).message('blo', 222)
    assert.deepEqual(mailbox2.received, [['bla', 111], ['blo', 222]])
    assert.deepEqual(mailbox3.received, [['bla', 111], ['blo', 222]])
  }) 

})
