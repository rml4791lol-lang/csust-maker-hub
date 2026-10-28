"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/** The geometry and framing stay fixed; light describes the metal's curvature. */
function Structure() {
  const group = useRef<THREE.Group>(null);
  const metal = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const wire = useRef<THREE.MeshBasicMaterial>(null);
  const pointerOver = useRef(false);
  const amount = useRef(0);
  const scratch = useMemo(() => ({
    normal: new THREE.Vector3(), view: new THREE.Vector3(),
    direction: new THREE.Vector3(), position: new THREE.Vector3(),
    normalMatrix: new THREE.Matrix3(), ray: new THREE.Raycaster(),
  }), []);

  useFrame((state, delta) => {
    if (!group.current || !metal.current || !light.current) return;
    const step = Math.min(delta, 0.05);
    const ease = 1 - Math.exp(-2.5 * step);
    group.current.rotation.y += step * 0.08;
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -state.pointer.y * 0.3, ease);
    group.current.rotation.z = THREE.MathUtils.lerp(group.current.rotation.z, state.pointer.x * 0.12, ease);

    // Recast after rotation, so a stationary cursor still lights the surface
    // under it. A short light range keeps the rest of the knot unchanged.
    let hit: THREE.Intersection | undefined;
    if (pointerOver.current) {
      group.current.updateWorldMatrix(true, true);
      scratch.ray.setFromCamera(state.pointer, state.camera);
      hit = scratch.ray.intersectObject(metal.current, false)[0];
    }
    const wasDark = amount.current < 0.01;
    amount.current = THREE.MathUtils.damp(amount.current, hit ? 1 : 0, 9, step);
    if (hit?.face) {
      scratch.normalMatrix.getNormalMatrix(metal.current.matrixWorld);
      scratch.normal.copy(hit.face.normal).applyMatrix3(scratch.normalMatrix).normalize();
      scratch.view.copy(state.camera.position).sub(hit.point).normalize();
      // Reflect the view about the hit normal: specular lands under the cursor.
      scratch.direction.copy(scratch.normal)
        .multiplyScalar(2 * scratch.normal.dot(scratch.view)).sub(scratch.view);
      scratch.position.copy(hit.point).addScaledVector(scratch.direction, 0.72);
      if (wasDark) light.current.position.copy(scratch.position);
      else light.current.position.lerp(scratch.position, 1 - Math.exp(-18 * step));
    }
    light.current.intensity = 3.2 * amount.current;
    if (wire.current) wire.current.opacity = 0.1 + amount.current * 0.08;
  });

  return (
    <>
      <group name="hero-structure" ref={group} position={[-1.6, 0.4, 0]}>
        <mesh name="hero-metal" ref={metal}
          onPointerMove={(event) => {
            if (event.pointerType === "touch") return;
            event.stopPropagation(); pointerOver.current = true;
          }}
          onPointerOut={() => { pointerOver.current = false; }}
        >
          <torusKnotGeometry args={[1.1, 0.3, 180, 28]} />
          <meshPhysicalMaterial color="#8e9ba9" metalness={1} roughness={0.23}
            envMapIntensity={0.85} clearcoat={0.18} clearcoatRoughness={0.2} />
        </mesh>
        <mesh scale={1.5} raycast={() => {}}>
          <icosahedronGeometry args={[1.5, 1]} />
          <meshBasicMaterial ref={wire} color="#3d7bfd" wireframe transparent opacity={0.1} />
        </mesh>
      </group>
      <pointLight name="hero-pointer-light" ref={light} intensity={0} color="#e6f2ff" distance={1.35} decay={2} />
    </>
  );
}

export function HeroScene({ active = true }: { active?: boolean }) {
  return (
    <Canvas frameloop={active ? "always" : "never"} dpr={[1, 1.5]}
      camera={{ position: [0, 0, 5], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}>
      {/* Baked once: broad key, narrow edge and black gaps reflect a studio in
          steel, without an external HDR download or emissive fill. */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={3.6} position={[-3, 4, 4]} target={[-1.6, 0.4, 0]} scale={[5, 1.5, 1]} color="#f0f5ff" />
        <Lightformer intensity={2.4} position={[2, 1, 3]} target={[-1.6, 0.4, 0]} scale={[0.7, 5, 1]} color="#c5d9f4" />
        <Lightformer intensity={3} position={[-5, 0, -2]} target={[-1.6, 0.4, 0]} scale={[0.6, 4, 1]} color="#729ed8" />
        <Lightformer intensity={0.7} position={[-1, -4, 2]} target={[-1.6, 0.4, 0]} scale={[5, 1, 1]} color="#c8dcf4" />
        <Lightformer intensity={0.3} position={[0, 1, 5]} target={[-1.6, 0.4, 0]} scale={[7, 7, 1]} color="#e1e9f4" />
      </Environment>
      <Structure />
    </Canvas>
  );
}
