window.init = async function() {
    window.state = {
        scene: new THREE.Scene(),
        camera: null,
        renderer: null,
        world: null,
        mousePos: { x: 0, y: 0 },
        logos: [],
        COLORS: [0xffffff, 0x2f4bce],
        usedPositions: [],
        mouseBall: null
    };

    state.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    state.camera.position.z = 10;

    state.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
    });
    state.renderer.setSize(window.innerWidth, window.innerHeight);
    state.renderer.setPixelRatio(1);
    document.body.appendChild(state.renderer.domElement);

    await RAPIER.init();
    state.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    
    setupBoundaries();
    setupMouseBall();
    await setupLogos();
    setupEventListeners();
    
    animate();
    console.log('Aplicación iniciada correctamente');
};

window.generateRandomPosition = function() {
    const rangeX = 4;
    const rangeY = 3;
    const rangeZ = 0.5;
    const minDistance = 3;
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
        const newPos = [
            (Math.random() * rangeX * 2) - rangeX,
            (Math.random() * rangeY * 2) - rangeY,
            Math.random() * rangeZ
        ];

        const isWithinBounds =
            Math.abs(newPos[0]) <= rangeX &&
            Math.abs(newPos[1]) <= rangeY &&
            newPos[2] >= 0 && newPos[2] <= rangeZ;

        const isFarEnough = state.usedPositions.every(pos =>
            getDistance(pos, newPos) >= minDistance
        );

        if ((isFarEnough && isWithinBounds) || state.usedPositions.length === 0) {
            state.usedPositions.push(newPos);
            return newPos;
        }

        attempts++;
    }

    const fallbackPos = [
        (Math.random() * 2) - 1,
        (Math.random() * 2) - 1,
        Math.random() * 0.25
    ];
    state.usedPositions.push(fallbackPos);
    return fallbackPos;
};

window.getDistance = function(pos1, pos2) {
    const dx = pos1[0] - pos2[0];
    const dy = pos1[1] - pos2[1];
    const dz = pos1[2] - pos2[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

window.setupBoundaries = function() {
    const backWall = RAPIER.ColliderDesc.cuboid(20, 20, 0.5);
    state.world.createCollider(backWall, state.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 1)
    ));

    const rightWall = RAPIER.ColliderDesc.cuboid(0.5, 20, 20);
    state.world.createCollider(rightWall, state.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(12, 0, 0)
    ));

    const leftWall = RAPIER.ColliderDesc.cuboid(0.5, 20, 20);
    state.world.createCollider(leftWall, state.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(-12, 0, 0)
    ));

    const topWall = RAPIER.ColliderDesc.cuboid(20, 0.5, 20);
    state.world.createCollider(topWall, state.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, 12, 0)
    ));

    const bottomWall = RAPIER.ColliderDesc.cuboid(20, 0.5, 20);
    state.world.createCollider(bottomWall, state.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, -12, 0)
    ));
};

window.setupMouseBall = function() {
    const ballDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    const ballBody = state.world.createRigidBody(ballDesc);
    const ballCollider = RAPIER.ColliderDesc.ball(1.5);
    state.world.createCollider(ballCollider, ballBody);
    state.mouseBall = ballBody;
};

window.setupLogos = async function() {
    const loader = new THREE.GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    const matcapTexture = await textureLoader.loadAsync('https://cdn.jsdelivr.net/gh/cb4rr/models@main/matcap.png');

    return new Promise((resolve) => {
        loader.load('https://cdn.jsdelivr.net/gh/cb4rr/models@main/logoSonda.glb', (gltf) => {
            const geometry = gltf.scene.getObjectByName('Curve007').geometry;
            
            for (let i = 0; i < 25; i++) {
                const position = generateRandomPosition();
                const material = new THREE.MeshMatcapMaterial({
                    side: THREE.DoubleSide,
                    matcap: matcapTexture,
                    color: state.COLORS[i % state.COLORS.length]
                });

                const mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.x = Math.PI / 2;
                mesh.scale.set(8, 8, 8);
                state.scene.add(mesh);

                const rigidBody = state.world.createRigidBody(
                    RAPIER.RigidBodyDesc.dynamic()
                        .setTranslation(position[0], position[1], position[2])
                );

                rigidBody.setLinearDamping(0.1);
                rigidBody.setAngularDamping(0.1);
                rigidBody.setRestitution(0.5);
                rigidBody.setFriction(0.1);

                const collider = RAPIER.ColliderDesc.cuboid(0.505, 0.5, 0.2);
                state.world.createCollider(collider, rigidBody);

                state.logos.push({ mesh, rigidBody });
            }
            resolve();
        });
    });
};

window.setupEventListeners = function() {
    window.addEventListener('mousemove', (event) => {
        state.mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
        state.mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('resize', () => {
        state.camera.aspect = window.innerWidth / window.innerHeight;
        state.camera.updateProjectionMatrix();
        state.renderer.setSize(window.innerWidth, window.innerHeight);
    });
};

window.updatePhysics = function() {
    if (state.mouseBall) {
        state.mouseBall.setTranslation({
            x: state.mousePos.x * 5,
            y: state.mousePos.y * 5,
            z: 0
        });
    }

    state.logos.forEach(logo => {
        const pos = logo.rigidBody.translation();
        const position = new THREE.Vector3(pos.x, pos.y, pos.z);
        
        logo.rigidBody.resetForces(true);
        logo.rigidBody.resetTorques(true);

        const dir = position.clone().normalize();
        const distance = position.length();
        const forceStrength = Math.min(distance * 0.3, 0.8);
        
        logo.rigidBody.addForce({
            x: -dir.x * forceStrength,
            y: -dir.y * forceStrength,
            z: -dir.z * forceStrength
        }, true);

        logo.mesh.position.copy(position);
        const rotation = logo.rigidBody.rotation();
        logo.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    });

    state.world.step();
};

window.animate = function() {
    requestAnimationFrame(window.animate);
    updatePhysics();
    state.renderer.render(state.scene, state.camera);
};
