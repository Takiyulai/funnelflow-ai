import {Easing, interpolate, spring} from 'remotion';

export const FPS = 30;
export const DURATION = 45 * FPS;

export const COLORS = {
  ink: '#080E1A',
  navy: '#0D1628',
  navy2: '#152439',
  gold: '#C7A436',
  goldLight: '#F5DE82',
  green: '#31845C',
  blue: '#08498D',
  white: '#F8FAFC',
  muted: '#94A3B8',
  line: 'rgba(255,255,255,0.10)',
  panel: 'rgba(21,36,57,0.88)',
};

export const fadeWindow = (
  frame: number,
  duration: number,
  fadeIn = 16,
  fadeOut = 18,
) =>
  interpolate(frame, [0, fadeIn, duration - fadeOut, duration], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

export const reveal = (frame: number, delay = 0, duration = 22) =>
  interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

export const pop = (frame: number, delay = 0, damping = 16) =>
  spring({frame: frame - delay, fps: FPS, config: {damping, mass: 0.65, stiffness: 125}});

export const smooth = (value: number) => Easing.bezier(0.22, 1, 0.36, 1)(value);

export const mix = (frame: number, input: [number, number], output: [number, number]) =>
  interpolate(frame, input, output, {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
