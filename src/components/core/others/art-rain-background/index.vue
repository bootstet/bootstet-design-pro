<template>
  <div ref="containerRef" class="art-rain-bg"></div>
</template>

<script setup lang="ts">
  /**
   * ArtRainBackground - Three.js Shader 雨天玻璃效果
   *
   * 基于 N13 / DropLayer2 思路，实现全屏雨滴玻璃效果：
   * - 使用正交相机 + 全屏平面
   * - 片元着色器中根据时间生成雨滴 mask，并与背景图混合
   */

  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import * as THREE from 'three'

  defineOptions({ name: 'ArtRainBackground' })

  const containerRef = ref<HTMLDivElement | null>(null)

  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.OrthographicCamera | null = null
  let plane: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | null = null
  let animationId: number | null = null
  let startTime = 0

  // 背景图：换成你自己的模糊城市/室内图也可以
  const BG_TEXTURE_PATH = new URL('@/assets/images/common/rain-bg.png', import.meta.url).href

  // 顶点着色器：透传 uv
  const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

  // 片元着色器：集成 N13 + DropLayer2
  const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  uniform float iTime;
  uniform vec3 iResolution;
  uniform sampler2D iChannel0;

  // 生成随机数
  vec3 N13(float p) {
      vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.11369, 0.13787));
      p3 += dot(p3, p3.yzx + 19.19);
      return fract(vec3(
        (p3.x + p3.y) * p3.z,
        (p3.x + p3.z) * p3.y,
        (p3.y + p3.z) * p3.x
      ));
  }

  // 雨滴层
  vec2 DropLayer2(vec2 uv, float t) {
      // uv.y += t * 0.75; // 控制雨滴下落速度
      // 速度稍微减慢一点
      uv.y += t * 0.35;

      // vec2 grid = vec2(6.0, 1.0) * 2.0;

      // 网格更密一点，雨滴更小更精致
      vec2 grid = vec2(8.0, 1.0) * 2.0;
      vec2 id = floor(uv * grid);
      vec3 n = N13(id.x * 35.2 + id.y * 2376.1);
      vec2 st = fract(uv * grid) - vec2(0.5, 0.0);
      // float d = length((st - vec2(n.x - 0.5, n.y - 0.5)) * vec2(1.0, 1.5));

      // 改纵向拉伸比例，让雨滴更“长条”
      float d = length((st - vec2(n.x - 0.5, n.y - 0.5)) * vec2(0.8, 2.0));
      // return vec2(smoothstep(0.4, 0.0, d), 0.0);

      // 让边缘更柔和一点
      return vec2(smoothstep(0.35, 0.0, d), 0.0);
  }

  void main() {
      // vec2 uv = vUv;

      // // 背景颜色
      // vec3 bg = texture2D(iChannel0, uv).rgb;

      // float t = iTime;
      // vec2 drops = DropLayer2(uv, t);
      // float mask = drops.x;

      // // 简单高光混合：雨滴位置更亮
      // vec3 color = mix(bg, vec3(1.0), mask);

      // gl_FragColor = vec4(color, 1.0);

      vec2 uv = vUv;

      vec3 bg = texture2D(iChannel0, uv).rgb;

      bg *= 0.9;
      bg = mix(bg, vec3(0.85, 0.9, 1.0), 0.1);

      float t = iTime;
      vec2 drops = DropLayer2(uv, t);
      float mask = drops.x;

      // 控制高光强度（0.0 ~ 1.0）
      float intensity = 0.6;
      // 高光颜色略微偏蓝
      vec3 highlight = vec3(0.85, 0.9, 1.0);

      // 先把雨滴 mask 做个 gamma 校正，让边缘更柔一点
      float softMask = pow(mask, 1.3);

      vec3 color = mix(bg, highlight, softMask * intensity);

      gl_FragColor = vec4(color, 1.0);
  }
`

  const initScene = () => {
    const container = containerRef.value
    if (!container) return

    const width = window.innerWidth
    const height = window.innerHeight
    const aspect = width / height

    scene = new THREE.Scene()

    // 正交相机铺满全屏
    camera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 10)
    camera.position.z = 1

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio || 1)
    renderer.domElement.style.pointerEvents = 'none'
    renderer.domElement.style.position = 'fixed'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.zIndex = '0'

    container.appendChild(renderer.domElement)

    const loader = new THREE.TextureLoader()
    const bgTexture = loader.load(BG_TEXTURE_PATH, () => {
      bgTexture.wrapS = THREE.ClampToEdgeWrapping
      bgTexture.wrapT = THREE.ClampToEdgeWrapping
      bgTexture.minFilter = THREE.LinearFilter
      bgTexture.magFilter = THREE.LinearFilter

      const geometry = new THREE.PlaneGeometry(2 * aspect, 2)

      const material = new THREE.ShaderMaterial({
        uniforms: {
          iResolution: { value: new THREE.Vector3(width, height, 1) },
          iTime: { value: 0 },
          iChannel0: { value: bgTexture }
        },
        vertexShader,
        fragmentShader,
        transparent: true
      })

      plane = new THREE.Mesh(geometry, material)
      scene!.add(plane)

      startTime = performance.now()
      animate()
    })

    const handleResize = () => {
      if (!renderer || !camera || !plane) return
      const w = window.innerWidth
      const h = window.innerHeight
      const asp = w / h

      renderer.setSize(w, h)
      camera.left = -asp
      camera.right = asp
      camera.top = 1.0
      camera.bottom = -1.0
      camera.updateProjectionMatrix()

      plane.geometry.dispose()
      plane.geometry = new THREE.PlaneGeometry(2 * asp, 2)

      const uniforms = plane.material.uniforms
      uniforms.iResolution.value.set(w, h, 1)
    }

    window.addEventListener('resize', handleResize)
  }

  const animate = () => {
    if (!renderer || !scene || !camera || !plane) return

    const elapsed = (performance.now() - startTime) / 1000.0
    plane.material.uniforms.iTime.value = elapsed

    renderer.render(scene, camera)
    animationId = requestAnimationFrame(animate)
  }

  const disposeScene = () => {
    if (animationId != null) {
      cancelAnimationFrame(animationId)
      animationId = null
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
  .art-rain-bg {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
  }
</style>
