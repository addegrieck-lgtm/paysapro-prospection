import React from 'react';
import { AbsoluteFill, Audio, Sequence, getStaticFiles, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Finish } from './components/Atmosphere';
import { loadFonts } from './components/fonts';
import { SubtitleSpace, prog } from './components/motion';
import { COLORS, FONTS } from './config/brand';
import { COURTE, LONGUE, VOIX_OFF, sec, type SceneId } from './config/timeline';
import { Identite } from './scenes/Identite';
import { Manifeste } from './scenes/Manifeste';
import { Referencement } from './scenes/Referencement';
import { Signature } from './scenes/Signature';
import { Transformation } from './scenes/Transformation';
import type { SceneProps } from './scenes/types';

loadFonts();

const SCENES: Record<SceneId, React.FC<SceneProps>> = {
  manifeste: Manifeste,
  transformation: Transformation,
  referencement: Referencement,
  identite: Identite,
  signature: Signature,
};

export type FilmProps = {
  cut: 'longue' | 'courte';
  /** Ajoute la voix off si public/audio/voix-off.(wav|mp3) existe. */
  voiceOver: boolean;
  /** Incruste les sous-titres de la narration (version longue). */
  subtitles: boolean;
  music: boolean;
};

/** Trait de lumière bref entre deux scènes. */
const Flash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;
  const o = prog(t, 0, 0.12) * (1 - prog(t, 0.12, 0.5));
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', opacity: o }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: width * 0.004,
          background: 'linear-gradient(90deg, rgba(111,195,211,0), #EAF8FB 50%, rgba(111,195,211,0))',
          boxShadow: '0 0 60px 20px rgba(111,195,211,0.35)',
        }}
      />
    </AbsoluteFill>
  );
};

const Subtitles: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const t = frame / fps;
  const cue = VOIX_OFF.find((c) => t >= c.start && t <= c.end + 0.3);
  if (!cue) return null;
  const o = Math.min(prog(t, cue.start, cue.start + 0.2), 1 - prog(t, cue.end + 0.1, cue.end + 0.3));
  const portrait = height > width;
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: portrait ? height * 0.2 : height * 0.035 }}>
      <div
        style={{
          maxWidth: portrait ? '86%' : '70%',
          textAlign: 'center',
          fontFamily: FONTS.text,
          fontWeight: 500,
          fontSize: portrait ? width * 0.042 : width * 0.0175,
          lineHeight: 1.35,
          color: COLORS.white,
          background: 'rgba(2,10,13,0.62)',
          padding: '0.35em 0.8em',
          borderRadius: 10,
          opacity: o,
        }}
      >
        {cue.text}
      </div>
    </AbsoluteFill>
  );
};

export const Film: React.FC<FilmProps> = ({ cut, voiceOver, subtitles, music }) => {
  const c = cut === 'longue' ? LONGUE : COURTE;
  const files = getStaticFiles().map((f) => f.name);
  const voice = voiceOver ? files.find((f) => /^audio\/voix-off\.(wav|mp3|m4a)$/.test(f)) : undefined;
  const track = `audio/musique-${c.duration}s.wav`;
  return (
    <AbsoluteFill style={{ background: COLORS.night }}>
      <SubtitleSpace.Provider value={subtitles && cut === 'longue' ? 0.1 : 0}>
        {c.scenes.map((s) => {
          const Scene = SCENES[s.id];
          return (
            <Sequence key={s.id} from={sec(s.start)} durationInFrames={sec(s.duration)} name={s.id}>
              <Scene duration={s.duration} titles={s.titles} />
            </Sequence>
          );
        })}
      </SubtitleSpace.Provider>
      {c.scenes.slice(1).map((s) => (
        <Sequence key={`flash-${s.id}`} from={sec(s.start) - 3} durationInFrames={sec(0.6)}>
          <Flash />
        </Sequence>
      ))}
      {subtitles && cut === 'longue' && <Subtitles />}
      <Finish />
      {music && files.includes(track) && <Audio src={staticFile(track)} volume={voice ? 0.45 : 1} />}
      {voice && <Audio src={staticFile(voice)} />}
    </AbsoluteFill>
  );
};
