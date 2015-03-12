# Motion sensing using the doppler effect
[This is an implementation](http://danielrapp.github.io/doppler/) of the [SoundWave paper](http://research.microsoft.com/en-us/um/redmond/groups/cue/publications/guptasoundwavechi2012.pdf)
on the web. It enables you to detect motion using only the microphone and speakers!

## How to use it
Just run it like this
```javascript
doppler.init(function(bandwidth) {
  console.log(bandwidth.left - bandwidth.right);
});
```
See more in [example.html](example.html). Read more about the theory of how this works [on the github-pages site](http://danielrapp.github.io/doppler/).

## Firefox?
Unfortunately this doesn't work on Firefox since it doesn't seem to support the `echoCancellation: false` parameter to navigator.getUserMedia. This means there's no way to turn off it filtering out the sounds which are coming from the computer itself (which is precisely what we want to measure).

## Contribute?
What to contribute?
Here's what is most needed:
* Add support for using multiple sinusoids, and combining the data (could be as simple as taking the average), to improve robustness.
* In the [SoundWave paper](http://research.microsoft.com/en-us/um/redmond/groups/cue/publications/guptasoundwavechi2012.pdf) they talk about a phenomenon that occurs when you move your hand too quickly. (See Figure 2d.) A new bulge is formed. I didn't implement the method they described for reducing this, but it should be pretty easy. What I'm doing at the moment to calculate the bandwidth (see `getBandwidth`), is just iteratively step to the right and left until I've hit a frequency with amplitude `0.001` (see `maxVolumeRatio`) of the doppler tone (see the global variable `freq`). What should be done instead (as suggested by the paper) is
```
  perform a second scan, looking beyond the stopping point
  of the first scan. If a second peak with at least 30% of the
  primary tone’s energy is found, the first scan is repeated to
  find amplitude drops calculated from the second peak. 
```