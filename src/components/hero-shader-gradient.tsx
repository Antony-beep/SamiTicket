'use client';

import { useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';
import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react';
import { useActiveMotion } from '@/components/ui/use-active-motion';

const shaderChunks = THREE.ShaderChunk as Record<string, string>;
shaderChunks.cube_uv_reflection_fragment ??= '';
shaderChunks.uv2_pars_fragment ??= '';
shaderChunks.uv2_pars_vertex ??= '';
shaderChunks.uv2_vertex ??= '';
shaderChunks.encodings_fragment ??= shaderChunks.colorspace_fragment ?? '';
shaderChunks.transmissionmap_pars_fragment ??= '';
shaderChunks.transmissionmap_fragment ??= '';

const subscribe = () => () => {};

export function HeroShaderGradient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const active = useActiveMotion(containerRef);
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <div ref={containerRef} className="hero-shader-stage" aria-hidden="true">
      {mounted && (
        <ShaderGradientCanvas
          className="hero-shader-canvas"
          pointerEvents="none"
          pixelDensity={1.2}
          fov={45}
          lazyLoad
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        >
          <ShaderGradient
            control="props"
            animate={active ? 'on' : 'off'}
            type="waterPlane"
            shader="defaults"
            uTime={0.4}
            uSpeed={0.28}
            uStrength={2.3}
            uDensity={1.4}
            uFrequency={5.5}
            color1="#ff895f"
            color2="#ff455f"
            color3="#e8c691"
            cDistance={3.1}
            cPolarAngle={115}
            cAzimuthAngle={180}
            cameraZoom={1}
            rotationX={0}
            rotationY={12}
            rotationZ={48}
            lightType="3d"
            brightness={1.15}
            reflection={0.12}
            grain="on"
          />
        </ShaderGradientCanvas>
      )}
      <div className="hero-shader-veil" />
    </div>
  );
}
