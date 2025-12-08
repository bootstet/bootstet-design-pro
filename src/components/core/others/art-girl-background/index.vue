<template>
  <div ref="containerRef" class="art-girl-bg"></div>
</template>

<script setup lang="ts">
  /**
   * ArtGirlBackground - Three.js 美女动漫动态背景
   *
   * 思路：
   * - 使用一张美女/动漫风格的背景图贴在全屏平面上
   * - 相机做轻微的平移/缩放动画，形成呼吸感
   * - 叠加一层粉紫色发光粒子，营造氛围感
   *
   * 你可以直接替换 BG_TEXTURE_PATH 指向的图片为你自己的动漫美女图。
   */

  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import * as THREE from 'three'

  defineOptions({ name: 'ArtGirlBackground' })

  const containerRef = ref<HTMLDivElement | null>(null)

  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let plane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null
  let overlay: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null = null
  let particles: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> | null = null
  let animationId: number | null = null
  let startTime = 0
  let resizeHandler: (() => void) | null = null

  // 背景图：默认使用用户背景，你可以换成自己的动漫美女图片
  const BG_TEXTURE_PATH = new URL('@/assets/images/user/rain.jpeg', import.meta.url).href

  // 世界坐标下平面高度（宽度会根据屏幕宽高比自动计算）
  const WORLD_PLANE_HEIGHT = 10

  const initScene = () => {
    const container = containerRef.value
    if (!container) return

    const width = window.innerWidth
    const height = window.innerHeight
    if (scene) {
      scene.background = new THREE.Color(0x080712)
    }
    const aspect = width / height
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100)
    camera.position.set(0, 0, 12)

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.setSize(width, height)
    renderer.domElement.style.pointerEvents = 'none'
    renderer.domElement.style.position = 'fixed'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.zIndex = '0'

    container.appendChild(renderer.domElement)

    scene = new THREE.Scene()

    // 轻微偏紫色的环境色，增强二次元氛围
    const loader = new THREE.TextureLoader()
    loader.load(BG_TEXTURE_PATH, (texture) => {
      texture.wrapS = THREE.MirroredRepeatWrapping
      texture.wrapT = THREE.MirroredRepeatWrapping
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter

      const worldHeight = WORLD_PLANE_HEIGHT
      const worldWidth = worldHeight * aspect

      const geometry = new THREE.PlaneGeometry(worldWidth, worldHeight)
      const material = new THREE.MeshBasicMaterial({ map: texture })

      plane = new THREE.Mesh(geometry, material)
      scene!.add(plane)

      // 轻微的粉色叠加层，做出少女风滤镜
      const overlayGeometry = new THREE.PlaneGeometry(worldWidth * 1.05, worldHeight * 1.05)
      const overlayMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xff7ac7),
        transparent: true,
        opacity: 0.12
      })
      overlay = new THREE.Mesh(overlayGeometry, overlayMaterial)
      overlay.position.z = 0.01
      scene!.add(overlay)

      // 前景发光粒子
      const particleCount = 160
      const particleGeometry = new THREE.BufferGeometry()
      const positions = new Float32Array(particleCount * 3)
      const colors = new Float32Array(particleCount * 3)

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3
        positions[i3 + 0] = (Math.random() - 0.5) * worldWidth * 1.2
        positions[i3 + 1] = (Math.random() - 0.5) * worldHeight * 1.2
        positions[i3 + 2] = Math.random() * 4 + 2 // 稍微靠近相机一点

        // 粉紫色渐变
        const color = new THREE.Color().setHSL(0.87 + Math.random() * 0.03, 0.6, 0.7)
        colors[i3 + 0] = color.r
        colors[i3 + 1] = color.g
        colors[i3 + 2] = color.b
      }

      particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

      const particleMaterial = new THREE.PointsMaterial({
        size: 0.18,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })

      particles = new THREE.Points(particleGeometry, particleMaterial)
      particles.position.z = 3
      scene!.add(particles)

      startTime = performance.now()
      animate()
    })

    resizeHandler = () => {
      if (!renderer || !camera || !plane || !overlay) return
      const w = window.innerWidth
      const h = window.innerHeight
      const asp = w / h

      renderer.setSize(w, h)
      camera.aspect = asp
      camera.updateProjectionMatrix()

      const worldHeight = WORLD_PLANE_HEIGHT
      const worldWidth = worldHeight * asp

      plane.geometry.dispose()
      plane.geometry = new THREE.PlaneGeometry(worldWidth, worldHeight)

      overlay.geometry.dispose()
      overlay.geometry = new THREE.PlaneGeometry(worldWidth * 1.05, worldHeight * 1.05)
    }

    window.addEventListener('resize', resizeHandler)
  }

  const animate = () => {
    if (!renderer || !scene || !camera || !plane) return

    const elapsed = (performance.now() - startTime) / 1000.0

    // 轻微的相机摇摆，类似呼吸感
    const camRadius = 0.6
    camera.position.x = Math.sin(elapsed * 0.35) * camRadius
    camera.position.y = Math.cos(elapsed * 0.25) * (camRadius * 0.5)
    camera.lookAt(0, 0, 0)

    // 背景纹理做一点缓慢平移，营造动态效果
    const material = plane.material
    if (material.map) {
      const t = elapsed * 0.02
      material.map.offset.x = Math.sin(t) * 0.02
      material.map.offset.y = Math.cos(t * 1.3) * 0.01
    }

    // 前景粒子缓慢旋转+上下轻微浮动
    if (particles) {
      particles.rotation.z = elapsed * 0.08
      particles.position.y = Math.sin(elapsed * 0.6) * 0.3
    }

    renderer.render(scene, camera)
    animationId = requestAnimationFrame(animate)
  }

  const disposeScene = () => {
    if (animationId != null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }

    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler)
      resizeHandler = null
    }

    if (particles) {
      particles.geometry.dispose()
      particles.material.dispose()
      particles = null
    }

    if (overlay) {
      overlay.geometry.dispose()
      overlay.material.dispose()
      overlay = null
    }

    if (plane) {
      plane.geometry.dispose()
      plane.material.dispose()
      plane = null
    }

    if (renderer) {
      renderer.dispose()
      const canvas = renderer.domElement
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas)
      }
      renderer = null
    }

    scene = null
    camera = null
  }

  onMounted(() => {
    initScene()
  })

  onBeforeUnmount(() => {
    disposeScene()
  })
</script>

<style scoped>
  .art-girl-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }
</style>
