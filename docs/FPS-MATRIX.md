# Named-device FPS matrix (§12.1)

Fill cells with measured values only. Do not invent numbers.

| Device | Browser | Quality | Boot → playable (s) | Steady FPS (foot) | Steady FPS (drive) | Notes |
|--------|---------|---------|---------------------|-------------------|--------------------|-------|
| iPhone (A-class) | Safari | Low | _pending_ | _pending_ | _pending_ | |
| iPhone (A-class) | Safari | Medium | _pending_ | _pending_ | _pending_ | |
| Desktop reference | Chrome | High | _pending_ | _pending_ | _pending_ | |

## Soak companion (§ RELEASE Quality)

| Run | Duration | Peak resident (streamer debug) | Evict count | Result |
|-----|----------|--------------------------------|-------------|--------|
| Stream memory soak | 30 min drive loop | _pending_ | _pending_ | Use `?debug` streamer line |

Protocol: New Game → drive a loop across the NB tile ring for 30 minutes;
sample `?debug` streamer resident MB + evict count every 5 minutes; abort on OOM
or sustained &lt; 20 FPS.
