var ctx = new AudioContext();
var osc = ctx.createOscillator();
var instrument = ctx.createOscillator();
// This is just preliminary, we'll actually do a quick scan
// (as suggested in the paper) to optimize this. (Yes,
// we're lying in the text, the frequency isn't fixed at 20 kHz
// for all computers. It can't (shouldn't) be since the
// output of a 20 kHz tone varies way too much depending
// on speaker quality and enviorment.)
var freq = 20000;
var baseInstrumentFreq = 440;
// See paper for this particular choice of frequencies
var relevantFreqWindow = 33;

// We'll make these global to speed up things
// up slightly, to avoid querying the DOM at every frame.
var ballCanvas = document.getElementById('ball');
var spectrumCanvas = document.getElementById('spectrum');
var zoomedSpectrumCanvas = document.getElementById('spectrum-zoom');

// These are for the demos
var thereminDemoIsActive = false;
var scrollDemoIsActive   = true;

var getBandwidth = function(analyser, freqs) {
  var primaryTone = freqToIndex(analyser, window.freq);
  var primaryVolume = freqs[primaryTone];
  // This ratio is totally empirical (aka trial-and-error).
  var maxVolumeRatio = 0.0001;

  var leftBandwidth = 0;
  do {
    leftBandwidth++;
    var volume = freqs[primaryTone-leftBandwidth];
    var normalizedVolume = volume / primaryVolume;
  } while (normalizedVolume > maxVolumeRatio && leftBandwidth < window.relevantFreqWindow);

  var rightBandwidth = 0;
  do {
    rightBandwidth++;
    var volume = freqs[primaryTone+rightBandwidth];
    var normalizedVolume = volume / primaryVolume;
  } while (normalizedVolume > maxVolumeRatio && rightBandwidth < window.relevantFreqWindow);

  return [ leftBandwidth, rightBandwidth ];
};

var clamp = function(val, min, max) {
  return Math.min(max, Math.max(min, val));
};

var freqToIndex = function(analyser, freq) {
  var nyquist = ctx.sampleRate / 2;
  return Math.round( freq/nyquist * analyser.fftSize/2 );
};

var indexToFreq = function(analyser, index) {
  var nyquist = ctx.sampleRate / 2;
  return nyquist/(analyser.fftSize/2) * index;
};

var debug = function(msg) {
  document.getElementById('debug').innerHTML =msg;
};

direction = 1;

var readMic = function(analyser) {
  window.requestAnimationFrame(readMic.bind(null, analyser));

  var audioData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(audioData);

  var primaryTone = freqToIndex(analyser, window.freq);
  var ctx = spectrumCanvas.getContext('2d');
  drawFrequencies(ctx, analyser, audioData, primaryTone, 0, freqToIndex(analyser, 22000));

  var ctx = zoomedSpectrumCanvas.getContext('2d');
  var from = primaryTone - window.relevantFreqWindow;
  var to   = primaryTone + window.relevantFreqWindow;
  drawFrequencies(ctx, analyser, audioData, primaryTone, from, to);

  var band = getBandwidth(analyser, audioData);
  debug(band)

  // switch directions on loud sound across the spectrum
  if (band[0] > 20 && band[1] > 20) {
    direction *= -1;
    band[0] = 0; // avoid jumps when you snap your fingers to change direction
    band[1] = 1;
  }

  if (window.scrollDemoIsActive && (band[0] > 4 || band[1] > 4)) {
    // I've reversed the order of the difference compared to the ball demo
    // because I think it feels better to *push* to go down, and *pull* to go up.
    var bandwidthDifference = clamp(band[1] - band[0], -10, 10);
    var currentScroll = $(window).scrollTop()
    var scale = 10;

    // down
    if (direction > 0)
      $(window).scrollTop(currentScroll + Math.abs(scale*bandwidthDifference));
    // up
    else
      $(window).scrollTop(currentScroll + Math.abs(scale*bandwidthDifference)*-1);
  }
};

var optimizeFrequency = function(osc, analyser, freqSweepStart, freqSweepEnd) {
  var oldFreq = osc.frequency.value;

  var audioData = new Uint8Array(analyser.frequencyBinCount);
  var maxAmp = 0;
  var maxAmpIndex = 0;

  var from = freqToIndex(analyser, freqSweepStart);
  var to   = freqToIndex(analyser, freqSweepEnd);
  for (var i = from; i < to; i++) {
    osc.frequency.value = indexToFreq(analyser, i);
    analyser.getByteFrequencyData(audioData);

    if (audioData[i] > maxAmp) {
      maxAmp = audioData[i];
      maxAmpIndex = i;
    }
  }
  // Sometimes the above procedure seems to fail,
  // not sure why. If that happends, just use the old value
  if (maxAmpIndex == 0) {
    return oldFreq;
  }
  else {
    return indexToFreq(analyser, maxAmpIndex);
  }
};

var handleMic = function(stream, callback) {
  // Mic
  var mic = ctx.createMediaStreamSource(stream);
  var analyser = ctx.createAnalyser();

  analyser.smoothingTimeConstant = 0.5;
  analyser.fftSize = 2048;

  mic.connect(analyser);

  // Doppler tone
  var dopplerGain = ctx.createGain();
  dopplerGain.gain.value = 1;
  dopplerGain.connect(ctx.destination);

  osc.frequency.value = window.freq;
  osc.type = osc.SINE;
  osc.start(0);
  osc.connect(dopplerGain);

  // Instrument
  var instrumentGain = ctx.createGain();
  instrumentGain.gain.value = 0.1;
  instrumentGain.connect(ctx.destination);

  instrument.frequency.value = 0;
  instrument.type = instrument.SQUARE;
  instrument.start(0);
  instrument.connect(instrumentGain);

  // There seems to be some initial "warm-up" period
  // where all frequencies are significantly louder.
  // A quick timeout will hopefully decrease that bias effect.
  setTimeout(function() {
    // Optimize doppler tone
    window.freq = optimizeFrequency(osc, analyser, 19000, 22000);
    osc.frequency.value = window.freq;

    callback(analyser);
  });
};

window.addEventListener('load', function(e) {
    var self = this;

    navigator.getUserMedia_ = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
    navigator.getUserMedia_({ audio: { optional: [{ echoCancellation: false }] } }, function(stream) {
      handleMic(stream, readMic);
      showAxes();

      // Self-destruct!
      // self.parentNode.removeChild(self);
    }, function() { console.log('Error!') });
  });