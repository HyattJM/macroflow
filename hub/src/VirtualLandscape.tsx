import React, { useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, KeyboardControls, useKeyboardControls, Html, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';

const APPS = [
  { id: 'portfolio', title: 'Developer Portfolio', color: '#34d399', path: '/portfolio', position: [-10, 0, -10], rotation: [0, Math.PI / 4, 0] },
  { id: 'logic-layer', title: 'Logic Layer', color: '#818cf8', path: '/logic-layer', position: [0, 0, -15], rotation: [0, 0, 0] },
  { id: 'metrix', title: 'Metrix Platform', color: '#22d3ee', path: '/metrix', position: [10, 0, -10], rotation: [0, -Math.PI / 4, 0] },
  { id: 'movie-app', title: 'Movie App', color: '#ef4444', path: '/movie-app', position: [-10, 0, 10], rotation: [0, 3 * Math.PI / 4, 0] },
  { id: 'bot-dashboard', title: 'Discord Bot', color: '#3b82f6', path: '/bot-dashboard', position: [0, 0, 15], rotation: [0, Math.PI, 0] },
  { id: 'return-automator', title: 'Return Automator', color: '#f97316', path: '/return-automator', position: [10, 0, 10], rotation: [0, -3 * Math.PI / 4, 0] },
];

const Player = () => {
  const [, get] = useKeyboardControls();
  const { camera } = useThree();
  const direction = new THREE.Vector3();
  const frontVector = new THREE.Vector3();
  const sideVector = new THREE.Vector3();
  const speed = 10;

  useFrame((_, delta) => {
    const { forward, backward, left, right } = get();
    frontVector.set(0, 0, Number(backward) - Number(forward));
    sideVector.set(Number(left) - Number(right), 0, 0);
    
    // Apply camera rotation to movement
    direction
      .subVectors(frontVector, sideVector)
      .normalize()
      .multiplyScalar(speed * delta)
      .applyEuler(new THREE.Euler(0, camera.rotation.y, 0)); // Only rotate on Y axis for walking
      
    camera.position.add(direction);
    camera.position.y = 1.7; // Keep eye level fixed
  });

  return <PointerLockControls />;
};

const Monolith = ({ app, triggerWarpTo }: { app: typeof APPS[0], triggerWarpTo: (p: string) => void }) => {
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Gentle floating effect
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 2 + app.position[0]) * 0.1 + 1.5;
    }
  });

  return (
    <group position={new THREE.Vector3(...app.position)} rotation={new THREE.Euler(...app.rotation)}>
      {/* Glow / Base */}
      <mesh position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshBasicMaterial color={app.color} transparent opacity={0.2} depthWrite={false} />
      </mesh>
      
      <mesh 
        ref={meshRef}
        onPointerOver={() => setHovered(true)} 
        onPointerOut={() => setHovered(false)}
        onClick={() => triggerWarpTo(app.path)}
      >
        <boxGeometry args={[3, 4, 0.5]} />
        <meshStandardMaterial color={hovered ? app.color : '#18181b'} emissive={hovered ? app.color : '#000000'} emissiveIntensity={0.5} wireframe={hovered} />
        
        <Html transform position={[0, 0, 0.26]} occlude>
          <div 
            className={`w-64 h-80 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 border backdrop-blur-md bg-zinc-950/80 shadow-[0_0_50px_${app.color}40]`}
            style={{ borderColor: hovered ? app.color : '#27272a' }}
            onClick={(e) => {
              e.stopPropagation();
              triggerWarpTo(app.path);
            }}
          >
            <div className="text-4xl mb-4" style={{ color: app.color }}>{app.title.charAt(0)}</div>
            <h2 className="text-xl font-bold text-white text-center font-heading tracking-widest">{app.title}</h2>
            {hovered && <p className="text-xs text-zinc-400 mt-4 animate-pulse uppercase tracking-[0.2em]">[ ENTER REALITY ]</p>}
          </div>
        </Html>
      </mesh>
    </group>
  );
};

interface VirtualLandscapeProps {
  triggerWarpTo: (path: string) => void;
  onExit: () => void;
}

const VirtualLandscape: React.FC<VirtualLandscapeProps> = ({ triggerWarpTo, onExit }) => {
  return (
    <div className="absolute inset-0 z-[60] bg-black">
      
      {/* UI Overlay */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <h1 className="text-emerald-400 font-mono text-sm tracking-widest">[ VR MATRIX ACTIVE ]</h1>
        <p className="text-zinc-500 text-xs mt-2 font-sans uppercase">Controls: W A S D to walk. Mouse to look. Click to lock pointer.</p>
        <p className="text-zinc-500 text-xs mt-1 font-sans uppercase">Escape to unlock pointer. Click monoliths to enter.</p>
      </div>

      <button 
        onClick={onExit}
        className="absolute top-8 right-8 z-10 px-6 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded font-bold tracking-widest uppercase hover:bg-red-500/40 transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)] pointer-events-auto"
      >
        Abort VR
      </button>

      <KeyboardControls
        map={[
          { name: 'forward', keys: ['ArrowUp', 'KeyW'] },
          { name: 'backward', keys: ['ArrowDown', 'KeyS'] },
          { name: 'left', keys: ['ArrowLeft', 'KeyA'] },
          { name: 'right', keys: ['ArrowRight', 'KeyD'] },
        ]}
      >
        <Canvas camera={{ position: [0, 1.7, 0], fov: 75 }}>
          <color attach="background" args={['#000000']} />
          <fog attach="fog" args={['#000000', 10, 40]} />
          
          <ambientLight intensity={0.5} />
          <pointLight position={[0, 10, 0]} intensity={1} color="#34d399" />

          <Player />

          {/* Endless Cyberpunk Grid Floor */}
          <Grid
            args={[100, 100]}
            position={[0, -0.1, 0]}
            cellColor="#10b981"
            sectionColor="#34d399"
            sectionSize={3}
            cellSize={1}
            fadeDistance={30}
            fadeStrength={2}
          />

          {APPS.map((app) => (
            <Monolith key={app.id} app={app} triggerWarpTo={triggerWarpTo} />
          ))}

          {/* Floating Data Particles */}
          {Array.from({ length: 50 }).map((_, i) => (
            <mesh 
              key={i} 
              position={[
                (Math.random() - 0.5) * 40, 
                Math.random() * 10, 
                (Math.random() - 0.5) * 40
              ]}
            >
              <boxGeometry args={[0.05, 0.05, 0.05]} />
              <meshBasicMaterial color="#34d399" transparent opacity={0.3} />
            </mesh>
          ))}

        </Canvas>
      </KeyboardControls>
    </div>
  );
};

export default VirtualLandscape;
