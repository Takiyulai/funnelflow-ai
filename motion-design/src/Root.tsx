import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import React from 'react';
import {Composition} from 'remotion';
import {AutoFunnelFilm} from './compositions/AutoFunnelFilm';
import {DURATION, FPS} from './animations/timing';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="AutoFunnelAI-Premier-Tunnel"
    component={AutoFunnelFilm}
    durationInFrames={DURATION}
    fps={FPS}
    width={1920}
    height={1080}
    defaultProps={{}}
  />
);
