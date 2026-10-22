import React from 'react';
import { Composition } from 'remotion';
import { COURTE, FPS, LONGUE } from './config/timeline';
import { Film, type FilmProps } from './Film';

const HD = { width: 1920, height: 1080 };
const VERTICAL = { width: 1080, height: 1920 };

const VARIANTES: { id: string; size: typeof HD; props: FilmProps }[] = [
  { id: 'Pub-16x9', size: HD, props: { cut: 'longue', voiceOver: true, subtitles: false, music: true } },
  { id: 'Pub-9x16', size: VERTICAL, props: { cut: 'longue', voiceOver: true, subtitles: false, music: true } },
  { id: 'Pub-15s-16x9', size: HD, props: { cut: 'courte', voiceOver: false, subtitles: false, music: true } },
  { id: 'Pub-15s-9x16', size: VERTICAL, props: { cut: 'courte', voiceOver: false, subtitles: false, music: true } },
  { id: 'Pub-16x9-SousTitres', size: HD, props: { cut: 'longue', voiceOver: false, subtitles: true, music: true } },
];

export const Root: React.FC = () => (
  <>
    {VARIANTES.map(({ id, size, props }) => (
      <Composition
        key={id}
        id={id}
        component={Film}
        fps={FPS}
        durationInFrames={(props.cut === 'longue' ? LONGUE : COURTE).duration * FPS}
        defaultProps={props}
        {...size}
      />
    ))}
  </>
);
