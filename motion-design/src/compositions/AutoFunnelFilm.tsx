import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import {CtaScene} from '../scenes/CtaScene';
import {EditorScene} from '../scenes/EditorScene';
import {LeadCrmScene} from '../scenes/LeadCrmScene';
import {ProblemScene} from '../scenes/ProblemScene';
import {PromptScene} from '../scenes/PromptScene';
import {WorkflowScene} from '../scenes/WorkflowScene';

export const AutoFunnelFilm: React.FC = () => (
  <AbsoluteFill style={{background: '#080E1A'}}>
    <Audio src={staticFile('audio/autofunnel-score.wav')} volume={0.9} />
    <Sequence from={0} durationInFrames={330} name="Problème → système connecté">
      <ProblemScene />
    </Sequence>
    <Sequence from={330} durationInFrames={210} name="Brief → parcours">
      <PromptScene />
    </Sequence>
    <Sequence from={540} durationInFrames={240} name="Édition → publication">
      <EditorScene />
    </Sequence>
    <Sequence from={780} durationInFrames={210} name="Capture → CRM">
      <LeadCrmScene />
    </Sequence>
    <Sequence from={990} durationInFrames={210} name="Workflow automatisé">
      <WorkflowScene />
    </Sequence>
    <Sequence from={1200} durationInFrames={150} name="CTA">
      <CtaScene />
    </Sequence>
  </AbsoluteFill>
);
