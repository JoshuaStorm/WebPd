/*
 * Copyright (c) 2011-2014 Chris McCormick, Sébastien Piquemal <sebpiq@gmail.com>
 *
 *  This file is part of WebPd. See https://github.com/sebpiq/WebPd for documentation
 *
 *  WebPd is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  WebPd is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with WebPd.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

var _ = require('underscore')
  , pdfu = require('pd-fileutils')
  , Patch = require('./lib/core/Patch')
  , utils = require('./lib/core/utils')
  , waa = require('./lib/waa')
  , pdGlob = require('./lib/global')
  , patchIds = _.extend({}, utils.UniqueIdsMixin)
require('./lib/objects').declareObjects(pdGlob.library)


var Pd = module.exports = {

  // Returns the current sample rate
  getSampleRate: function() { return pdGlob.settings.sampleRate },

  // Returns the default patch
  getDefaultPatch: function() { return pdGlob.defaultPatch },

  // Start dsp
  start: function(audio) {
    if (!pdGlob.isStarted) {
      pdGlob.defaultPatch = pdGlob.defaultPatch || new Patch()
      pdGlob.namedObjects = pdGlob.namedObjects || new utils.NamedObjectStore()

      if (typeof AudioContext !== 'undefined') {
        pdGlob.audio = audio || new waa.Audio(pdGlob.settings.channelCount)
        pdGlob.clock = new waa.Clock({ audioContext: pdGlob.audio.context })

      // TODO : handle other environments better than like this
      } else {
        var interfaces = require('./lib/core/interfaces')
        pdGlob.audio = audio || interfaces.Audio
        pdGlob.clock = interfaces.Clock
      }

      pdGlob.audio.start()
      for (var patchId in pdGlob.patches) pdGlob.patches[patchId].start()
      pdGlob.isStarted = true
    }
  },

  // Stop dsp
  stop: function() {
    if (pdGlob.isStarted) {
      pdGlob.isStarted = false
      for (var patchId in pdGlob.patches) pdGlob.patches[patchId].stop()
      pdGlob.audio.stop()
    }
  },

  // Returns true if the dsp is started, false otherwise
  isStarted: function() { return pdGlob.isStarted },

  // Send a message to a named receiver inside the graph
  send: function(name) {
    pdGlob.emitter.emit.apply(pdGlob.emitter, ['msg:' + name].concat(_.toArray(arguments).slice(1)))
  },

  // Receive a message from a named sender inside the graph
  receive: function(name, callback) {
    pdGlob.emitter.on('msg:' + name, callback)
  },

  // Create a new patch
  createPatch: function() {
    var patch = new Patch()
    patch.patchId = patchIds._generateId()
    pdGlob.patches[patch.patchId] = patch
    if (pdGlob.isStarted) patch.start()
    return patch
  },

  // Loads a patch from a string (Pd file), or from an object (pd.json) 
  loadPatch: function(patchData) {
    var patch = new Patch(patchData.args || [])
    if (_.isString(patchData)) patchData = pdfu.parse(patchData)
    this._preparePatch(patch, patchData)
    return patch
  },

  // Registers the abstraction defined in `patchData` as `name`.
  // `patchData` can be a string (Pd file), or an object (pd.json)
  registerAbstraction: function(name, patchData) {
    var CustomObject = function(args) {
      var patch = new Patch(args)
      Pd._preparePatch(patch, patchData)
      return patch
    }
    CustomObject.prototype = Patch.prototype
    pdGlob.library[name] = CustomObject
  },

  _preparePatch: function(patch, patchData) {
    var createdObjs = {}

    // Creating nodes
    patchData.nodes.forEach(function(nodeData) {
      var proto = nodeData.proto
        , obj = patch.createObject(proto, nodeData.args || [])
      if (proto === 'pd') Pd._preparePatch(obj, nodeData.subpatch)
      createdObjs[nodeData.id] = obj
    })

    // Creating connections
    patchData.connections.forEach(function(conn) {
      var sourceObj = createdObjs[conn.source.id]
        , sinkObj = createdObjs[conn.sink.id]
      if (!sourceObj || !sinkObj) throw new Error('invalid connection')
      sourceObj.o(conn.source.port).connect(sinkObj.i(conn.sink.port))
    })
  },

  // Exposing this mostly for testing
  _glob: pdGlob

}

if (typeof window !== 'undefined') window.Pd = Pd
