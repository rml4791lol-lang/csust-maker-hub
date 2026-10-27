"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";

/**
 * Hero 3D 场景：金属环面纽结 + 线框，缓慢旋转。
 *
 * 设计目标：
 *  - 默认（不悬停）：深色哑光金属，几乎不反射环境 —— 沉静、有质感；
 *  - 鼠标悬停：环境反射、自发光、跟随光源同时拉满 —— 表面瞬间"亮起来"，
 *    这才是 hover 光效。
 *
 * hover 状态提升到 HeroScene 层，让材质与 PointerLight 同步响应。
 */
function Structure({
  hovered,
  onHoverChange,
}: {
  hovered: boolean;
  onHoverChange: (v: boolean) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const wireMat = useRef<THREE.MeshBasicMaterial>(null);
  const hoverAmount = useRef(0);

  useFrame((state, delta) => {
    if (!group.current) return;
    const step = Math.min(delta, 0.05);
    const ease = 1 - Math.exp(-2.5 * step);

    group.current.rotation.y += step * 0.08;
    group.current.rotation.x = THREE.MathUtils.lerp(
      group.current.rotation.x,
      -state.pointer.y * 0.3,
      ease,
    );
    group.current.rotation.z = THREE.MathUtils.lerp(
      group.current.rotation.z,
      state.pointer.x * 0.12,
      ease,
    );

    hoverAmount.current = THREE.MathUtils.lerp(
      hoverAmount.current,
      hovered ? 1 : 0,
      1 - Math.exp(-7.5 * step),
    );

    group.current.scale.setScalar(1 + hoverAmount.current * 0.045);

    if (mat.current) {
      // 保持整体哑光，只让高光略锐；不做整体提亮（避免"全变亮"）
      mat.current.roughness = THREE.MathUtils.lerp(
        0.28,
        0.1,
        hoverAmount.current,
      );
      mat.current.envMapIntensity = THREE.MathUtils.lerp(
        0.04,
        0.15,
        hoverAmount.current,
      );
      // 极弱自发光，只做一点点"被照亮"的感觉
      mat.current.emissiveIntensity = hoverAmount.current * 0.06;
    }

    if (wireMat.current) {
      wireMat.current.opacity = THREE.MathUtils.lerp(
        0.1,
        0.32,
        hoverAmount.current,
      );
    }
  });

  return (
    <group name="hero-structure" ref={group} position={[-1.6, 0.4, 0]}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          onHoverChange(true);
        }}
        onPointerOut={() => {
          onHoverChange(false);
        }}
      >
        <torusKnotGeometry args={[1.1, 0.3, 180, 28]} />
        <meshStandardMaterial
          ref={mat}
          color="#151519"
          metalness={0.92}
          roughness={0.42}
          envMapIntensity={0.04}
          emissive="#3d7bfd"
          emissiveIntensity={0}
        />
      </mesh>

      {/* 外层线框：禁用 raycast，避免挡住主体的 hover 检测 */}
      <mesh scale={1.5} raycast={() => {}}>
        <icosahedronGeometry args={[1.5, 1]} />
        <meshBasicMaterial
          ref={wireMat}
          color="#3d7bfd"
          wireframe
          transparent
          opacity={0.1}
        />
      </mesh>
    </group>
  );
}

/** 跟随鼠标的光源：默认微弱，hover 时增强，制造流动高光 */
function PointerLight({ active }: { active: boolean }) {
  const light = useRef<THREE.PointLight>(null);
  const amount = useRef(0);

  useFrame((state, delta) => {
    if (!light.current) return;
    const ease = 1 - Math.exp(-6 * Math.min(delta, 0.05));

    amount.current = THREE.MathUtils.lerp(
      amount.current,
      active ? 1 : 0,
      ease,
    );
    // hover 时大幅增强跟随光源，在物块表面打出局部高光点
    light.current.intensity = THREE.MathUtils.lerp(8, 240, amount.current);

    light.current.position.x = THREE.MathUtils.lerp(
      light.current.position.x,
      state.pointer.x * 3.2,
      ease,
    );
    light.current.position.y = THREE.MathUtils.lerp(
      light.current.position.y,
      state.pointer.y * 2.2,
      ease,
    );
    light.current.position.z = 4.2;
  });

  return (
    <pointLight
      name="hero-pointer-light"
      ref={light}
      position={[0, 0, 4.2]}
      intensity={8}
      color="#dbe7ff"
      distance={6}
      decay={2}
    />
  );
}

export function HeroScene() {
  const [hovered, setHovered] = useState(false);

  return (
    <Canvas
      frameloop="always"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
    >
      <ambientLight intensity={0.06} />

      {/* 程序化环境：默认只留极弱反射，hover 时通过材质 envMapIntensity 拉满 */}
      <Environment resolution={256} frames={1}>
        <Lightformer
          intensity={8}
          position={[4, 4, 4]}
          scale={6}
          color="#ffffff"
        />
        <Lightformer
          intensity={4}
          position={[-4, 2, 3]}
          scale={8}
          color="#3d7bfd"
        />
        <Lightformer
          intensity={3}
          position={[0, -3, 2]}
          scale={6}
          color="#22d3ee"
        />
        <Lightformer
          intensity={6}
          position={[0, 5, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[10, 10, 1]}
          color="#ffffff"
        />
      </Environment>

      <PointerLight active={hovered} />
      <Structure hovered={hovered} onHoverChange={setHovered} />
    </Canvas>
  );
}
