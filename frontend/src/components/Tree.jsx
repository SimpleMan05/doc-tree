import React, { useMemo, useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Instances, Instance, Environment } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

const COLOR_MAP = {
  saffron: "#FF9933",
  white: "#c3c3b9",
  green: "#138808",
};

// Recursive branch generator — an L-system-ish approach, no manual modeling.
function generateBranches(
  origin = new THREE.Vector3(0, 0, 0),
  direction = new THREE.Vector3(0, 1, 0),
  length = 2.2,
  radius = 0.22,
  depth = 0,
  maxDepth = 6,
  segments = []
) {
  if (depth > maxDepth || radius < 0.015) return segments;

  const end = origin.clone().add(direction.clone().multiplyScalar(length));
  segments.push({ start: origin.clone(), end, radius, depth });

  if (depth === maxDepth) return segments;

  const branchCount = depth < 2 ? 3 : 2;
  for (let i = 0; i < branchCount; i++) {
    const spread = 0.55 + Math.random() * 0.35;
    const angleOffset = (i / branchCount) * Math.PI * 2 + Math.random() * 0.6;
    const newDir = direction
      .clone()
      .applyAxisAngle(new THREE.Vector3(1, 0, 0), (Math.random() - 0.5) * spread)
      .applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.cos(angleOffset) * spread)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), angleOffset)
      .normalize();
    generateBranches(
      end,
      newDir,
      length * (0.72 + Math.random() * 0.1),
      radius * 0.68,
      depth + 1,
      maxDepth,
      segments
    );
  }
  return segments;
}

function Branches() {
  const segments = useMemo(
    () => generateBranches(new THREE.Vector3(0, -3, 0), new THREE.Vector3(0, 1, 0)),
    []
  );

  return (
    <group>
      {segments.map((seg, i) => {
        const dir = seg.end.clone().sub(seg.start);
        const len = dir.length();
        const mid = seg.start.clone().add(seg.end).multiplyScalar(0.5);
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.clone().normalize()
        );
        return (
          <mesh key={i} position={mid} quaternion={quat}>
            <cylinderGeometry args={[seg.radius * 0.7, seg.radius, len, 6]} />
            <meshStandardMaterial
              color="#3a2418"
              emissive="#1a0f0a"
              emissiveIntensity={0.15}
              roughness={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function Leaves({ leaves, highlightId, onLeafClick }) {
  const groups = useMemo(() => {
    const g = { saffron: [], white: [], green: [] };
    leaves.forEach((leaf) => g[leaf.color]?.push(leaf));
    return g;
  }, [leaves]);

  return (
    <>
      {Object.entries(groups).map(([color, group]) => (
        <Instances key={color} limit={Math.max(group.length, 1)}>
          <icosahedronGeometry args={[0.16, 0]} />
          <meshStandardMaterial
            color={COLOR_MAP[color]}
            emissive={COLOR_MAP[color]}
            emissiveIntensity={0.6}
            roughness={0.35}
            metalness={0.1}
          />
          {group.map((leaf) => (
            <LeafInstance
              key={leaf.id}
              leaf={leaf}
              highlighted={leaf.id === highlightId}
              onClick={() => onLeafClick?.(leaf)}
            />
          ))}
        </Instances>
      ))}
    </>
  );
}

function LeafInstance({ leaf, highlighted, onClick }) {
  const ref = useRef();
  const t0 = useRef(Math.random() * Math.PI * 2);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    const wobble = Math.sin(t * 1.5 + t0.current) * 0.03;
    ref.current.position.set(
      leaf.position[0],
      leaf.position[1] + wobble,
      leaf.position[2]
    );
    const scale = highlighted ? 2.4 + Math.sin(t * 6) * 0.4 : 1;
    ref.current.scale.setScalar(scale);
  });

  return <Instance ref={ref} onClick={onClick} />;
}

function CameraRig({ target }) {
  const { camera } = useThree();
  const targetPos = useRef(null);
  const lookAtPos = useRef(new THREE.Vector3(0, 3, 0));

  useEffect(() => {
    if (target) {
      const [x, y, z] = target.position;
      const dir = new THREE.Vector3(x, y, z).normalize();
      targetPos.current = new THREE.Vector3(x, y, z).add(dir.multiplyScalar(3));
      lookAtPos.current = new THREE.Vector3(x, y, z);
    }
  }, [target]);

  useFrame(() => {
    if (targetPos.current) {
      camera.position.lerp(targetPos.current, 0.04);
      camera.lookAt(lookAtPos.current);
    }
  });

  return null;
}

export default function Tree({ leaves, highlightLeaf, onLeafClick, dark }) {
  return (
    <Canvas
      camera={{ position: [0, 4, 12], fov: 50 }}
      style={{ background: dark ? "#000137" : "#55b6ff" }}
    >
      <ambientLight intensity={0.35} />
      <pointLight position={[5, 8, 5]} intensity={1.2} color="#ffddaa" />
      <pointLight position={[-5, 3, -5]} intensity={0.6} color="#88ccff" />
      <Branches />
      <Leaves leaves={leaves} highlightId={highlightLeaf?.id} onLeafClick={onLeafClick} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3.05, 0]}>
        <circleGeometry args={[12, 32]} />
        <meshStandardMaterial color={dark ? "#1e5a1a" : "#66c42b"} roughness={1} />
      </mesh>
      <Environment preset="night" />
      <CameraRig target={highlightLeaf} />
      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={22}
        autoRotate={!highlightLeaf}
        autoRotateSpeed={0.4}
      />
      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.25} luminanceSmoothing={0.9} mipmapBlur />
        <Vignette eskil={false} offset={0.15} darkness={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
